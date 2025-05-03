from typing import Dict, List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
import uuid

from app.models.chat_pydantic import ChatCompletionRequest, ChatCompletionResponse, ChatMessagePydantic, MessageRole
from app.services.llm_service import LLMService
from app.services.ide_service import IDEService
from app.services.session_service import session_service
from app.core.cache import cache
from app.core.logger import logger

router = APIRouter()

# Initialize services
llm_service = LLMService()
ide_service = IDEService()

# Store active chat sessions
chat_sessions: Dict[str, List[ChatMessagePydantic]] = {}

@router.post("/completions", response_model=ChatCompletionResponse)
async def create_chat_completion(request: ChatCompletionRequest):
    """
    Generate a chat completion response
    """
    # Initialize or get existing session
    session_id = request.session_id or str(uuid.uuid4())
    messages = await session_service.get_session(session_id) or []
    
    # Store the user messages in the session
    for message in request.messages:
        if message.role == MessageRole.USER:
            messages.append(message)
    
    # Try to get cached response for the exact same conversation
    cache_key = f"chat_completion:{session_id}:{hash(str(request.messages))}"
    cached_response = await cache.get(cache_key)
    if cached_response:
        return ChatCompletionResponse(**cached_response)
    
    # Get project context if project ID is provided
    project_context = None
    if request.project_context and "project_id" in request.project_context:
        project_id = request.project_context["project_id"]
        project_context = ide_service.get_project_context(project_id)
    
    # Generate response using the LLM service
    try:
        response_message = await llm_service.generate_completion(
            request.messages, 
            project_context
        )
        
        # Store the assistant message in the session
        messages.append(response_message)
        await session_service.save_session(session_id, messages)
        
        # Cache the response
        response = ChatCompletionResponse(
            message=response_message,
            session_id=session_id
        )
        await cache.set(cache_key, response.dict(), 3600)  # Cache for 1 hour
        
        return response
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating completion: {str(e)}"
        )

@router.get("/sessions/{session_id}", response_model=List[ChatMessagePydantic])
async def get_chat_session(session_id: str):
    """
    Get messages from a chat session
    """
    messages = await session_service.get_session(session_id)
    if not messages:
        raise HTTPException(
            status_code=404,
            detail="Chat session not found"
        )
    
    return messages

@router.delete("/sessions/{session_id}")
async def delete_chat_session(session_id: str):
    """
    Delete a chat session
    """
    success = await session_service.delete_session(session_id)
    if not success:
        raise HTTPException(
            status_code=404,
            detail="Chat session not found"
        )
    
    return {"status": "success", "message": "Session deleted"}

@router.get("/sessions/{session_id}/metadata")
async def get_session_metadata(session_id: str):
    """
    Get session metadata
    """
    metadata = await session_service.get_session_metadata(session_id)
    if not metadata:
        raise HTTPException(
            status_code=404,
            detail="Chat session not found"
        )
    
    return metadata


@router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    print("#####\n\n\nDoneBefore\n\n\n\n")
    await websocket.accept()
    await websocket.send_text("Streaming will start...")

    # Simulated streaming chunks
    tokens = ["Hello", ", ", "this ", "is ", "a ", "streamed ", "message!"]

    for token in tokens:
        await asyncio.sleep(0.5)  # simulate delay
        await websocket.send_text(token)

    await websocket.send_text("\n[Stream ended]")


# @router.websocket("/ws/{session_id}")
# async def websocket_endpoint(websocket: WebSocket, session_id: str):
#     """
#     WebSocket endpoint for real-time chat
#     """
#     print("#####\n\n\nDoneBefore\n\n\n\n")

#     await websocket.accept()
#     logger.info(f"WebSocket connection accepted for session {session_id}")
#     print("#####\n\n\nDone\n\n\n\n")

    # messages = await session_service.get_session(session_id)


    
    # try:
    #     while True:
    #         # Receive message from client
    #         try:
    #             data = await websocket.receive_json()
    #             logger.info(f"Received WebSocket message for session {session_id}: {type(data)}")
                
    #             # Process message
    #             if "message" in data and "role" in data["message"]:
    #                 # Create chat message
    #                 message = ChatMessagePydantic(
    #                     id=data.get("id", str(uuid.uuid4())),
    #                     role=data["message"]["role"],
    #                     content=data["message"]["content"],
    #                 )
                    
    #                 # Store user message
    #                 if message.role == MessageRole.USER:
    #                     messages.append(message)
    #                     await session_service.save_session(session_id, messages)
                    
    #                 # Generate response if it's a user message
    #                 if message.role == MessageRole.USER:
    #                     try:
    #                         # Get project context if provided
    #                         project_context = None
    #                         if "project_id" in data:
    #                             project_id = data["project_id"]
    #                             project_context = ide_service.get_project_context(project_id)
                            
    #                         # Generate response with streaming
    #                         logger.info(f"Generating streaming response for session {session_id} with {len(messages)} messages")
                            
    #                         # Send initial response with an empty message to indicate streaming start
    #                         stream_message_id = str(uuid.uuid4())
    #                         await websocket.send_json({
    #                             "type": "stream_start",
    #                             "message": {
    #                                 "id": stream_message_id,
    #                                 "role": "assistant",
    #                                 "content": ""
    #                             },
    #                             "session_id": session_id
    #                         })
                            
    #                         # Accumulate the full response content
    #                         full_content = ""
    #                         try:
    #                             async for content_chunk in llm_service.generate_completion_stream(
    #                                 messages,
    #                                 project_context
    #                             ):
    #                                 full_content += content_chunk
                                    
    #                                 # Send the chunk to the client
    #                                 try:
    #                                     await websocket.send_json({
    #                                         "type": "stream_chunk",
    #                                         "message_id": stream_message_id,
    #                                         "chunk": content_chunk
    #                                     })
    #                                     logger.debug(f"Sent chunk to client: {len(content_chunk)} chars")
    #                                 except Exception as chunk_error:
    #                                     logger.error(f"Error sending chunk: {str(chunk_error)}")
    #                                     break
    #                         except Exception as stream_error:
    #                             logger.error(f"Error during streaming: {str(stream_error)}")
    #                             await websocket.send_json({
    #                                 "type": "error",
    #                                 "error": f"Error during streaming: {str(stream_error)}"
    #                             })
                            
    #                         # Create the final message if we have content
    #                         if full_content:
    #                             response_message = ChatMessagePydantic(
    #                                 id=stream_message_id,
    #                                 role=MessageRole.ASSISTANT,
    #                                 content=full_content
    #                             )
                                
    #                             # Store assistant message
    #                             messages.append(response_message)
                                
    #                             # Save the session to persistent storage
    #                             await session_service.save_session(session_id, messages)
                                
    #                             # Indicate stream is complete
    #                             await websocket.send_json({
    #                                 "type": "stream_end",
    #                                 "message_id": stream_message_id,
    #                                 "session_id": session_id
    #                             })
    #                             logger.info(f"Streaming complete for session {session_id}, response length: {len(full_content)}")
                            
    #                     except Exception as e:
    #                         logger.error(f"Error in WebSocket streaming: {str(e)}")
    #                         try:
    #                             await websocket.send_json({
    #                                 "type": "error",
    #                                 "error": f"Error generating response: {str(e)}"
    #                             })
    #                         except Exception as send_error:
    #                             logger.error(f"Error sending error message: {str(send_error)}")
    #         except WebSocketDisconnect:
    #             logger.info(f"WebSocket disconnected for session {session_id} while receiving message")
    #             break
    #         except Exception as e:
    #             logger.error(f"Unexpected error in WebSocket communication: {str(e)}")
    #             try:
    #                 await websocket.send_json({
    #                     "type": "error",
    #                     "error": f"Unexpected error: {str(e)}"
    #                 })
    #             except:
    #                 # If we can't send the error, the connection is probably gone
    #                 logger.error("Failed to send error message, connection probably lost")
    #                 break
    
    # except WebSocketDisconnect:
    #     logger.info(f"WebSocket disconnected for session {session_id}")
    # except Exception as e:
    #     logger.error(f"Unhandled WebSocket error: {str(e)}")
    
    # # Save the session before cleaning up
    # try:
    #     await session_service.save_session(session_id, messages)
    #     logger.info(f"Session {session_id} saved on disconnection")
    # except Exception as e:
    #     logger.error(f"Error saving session on disconnection: {str(e)}")
    
    # # Don't remove from chat_sessions as other connections might use it 