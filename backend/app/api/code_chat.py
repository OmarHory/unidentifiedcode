from typing import Dict, List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
import uuid

from app.models.chat import ChatCompletionRequest, ChatCompletionResponse, ChatMessage, MessageRole
from app.services.llm_service import LLMService
from app.services.ide_service import IDEService

router = APIRouter()

# In-memory store for chat sessions
chat_sessions = {}

# Initialize services
llm_service = LLMService()
ide_service = IDEService()

@router.post("/completions", response_model=ChatCompletionResponse)
async def create_chat_completion(request: ChatCompletionRequest):
    """
    Generate a chat completion response
    """
    # Initialize the session if it doesn't exist
    session_id = request.session_id or str(uuid.uuid4())
    if session_id not in chat_sessions:
        chat_sessions[session_id] = []
    
    # Store the user messages in the session
    for message in request.messages:
        if message.role == MessageRole.USER:
            chat_sessions[session_id].append(message)
    
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
        chat_sessions[session_id].append(response_message)
        
        return ChatCompletionResponse(
            message=response_message,
            session_id=session_id
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating completion: {str(e)}"
        )

@router.get("/sessions/{session_id}", response_model=List[ChatMessage])
async def get_chat_session(session_id: str):
    """
    Get messages from a chat session
    """
    if session_id not in chat_sessions:
        raise HTTPException(
            status_code=404,
            detail="Chat session not found"
        )
    
    return chat_sessions[session_id]

@router.delete("/sessions/{session_id}")
async def delete_chat_session(session_id: str):
    """
    Delete a chat session
    """
    if session_id in chat_sessions:
        del chat_sessions[session_id]
    
    return {"status": "success"}

@router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for real-time chat
    """
    await websocket.accept()
    
    # Initialize session if it doesn't exist
    if session_id not in chat_sessions:
        chat_sessions[session_id] = []
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_json()
            
            # Process message
            if "message" in data and "role" in data["message"]:
                # Create chat message
                message = ChatMessage(
                    id=data.get("id", str(uuid.uuid4())),
                    role=data["message"]["role"],
                    content=data["message"]["content"],
                )
                
                # Store user message
                if message.role == MessageRole.USER:
                    chat_sessions[session_id].append(message)
                
                # Generate response if it's a user message
                if message.role == MessageRole.USER:
                    try:
                        # Get project context if provided
                        project_context = None
                        if "project_id" in data:
                            project_id = data["project_id"]
                            project_context = ide_service.get_project_context(project_id)
                        
                        # Generate response with streaming
                        messages = chat_sessions[session_id]
                        
                        # Send initial response with an empty message to indicate streaming start
                        stream_message_id = str(uuid.uuid4())
                        await websocket.send_json({
                            "type": "stream_start",
                            "message": {
                                "id": stream_message_id,
                                "role": "assistant",
                                "content": ""
                            },
                            "session_id": session_id
                        })
                        
                        # Accumulate the full response content
                        full_content = ""
                        async for content_chunk in llm_service.generate_completion_streaming(
                            messages,
                            project_context
                        ):
                            full_content += content_chunk
                            
                            # Send the chunk to the client
                            await websocket.send_json({
                                "type": "stream_chunk",
                                "message_id": stream_message_id,
                                "chunk": content_chunk
                            })
                        
                        # Create the final message
                        response_message = ChatMessage(
                            id=stream_message_id,
                            role=MessageRole.ASSISTANT,
                            content=full_content
                        )
                        
                        # Store assistant message
                        chat_sessions[session_id].append(response_message)
                        
                        # Indicate stream is complete
                        await websocket.send_json({
                            "type": "stream_end",
                            "message_id": stream_message_id,
                            "session_id": session_id
                        })
                        
                    except Exception as e:
                        await websocket.send_json({
                            "type": "error",
                            "error": f"Error generating response: {str(e)}"
                        })
    
    except WebSocketDisconnect:
        # Handle disconnect
        pass 