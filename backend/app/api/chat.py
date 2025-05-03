from fastapi import APIRouter, HTTPException, WebSocket, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import json
import uuid
from datetime import datetime

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.chat_models import ChatSession, ChatMessage
from app.models.chat_pydantic import ChatMessagePydantic
from app.models.user_models import User
from app.models.project_models import Project
from app.models.chat_pydantic import MessageRole
from app.services.llm_service import llm_service
from app.services.ide_service import IDEService
from app.core.cache import cache
from app.core.logger import logger
from app.services.session_service import session_service
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status



router = APIRouter()

# Initialize services
ide_service = IDEService()

class Message(BaseModel):
    role: str
    content: str
    id: Optional[str] = None
    created_at: Optional[str] = None

class ProjectContext(BaseModel):
    project_id: str
    file_path: Optional[str] = None

class ChatRequest(BaseModel):
    messages: List[Message]
    session_id: str
    project_context: Optional[ProjectContext] = None

class ChatSessionCreate(BaseModel):
    project_id: str
    name: Optional[str] = None
    
class ChatMessageResponse(BaseModel):
    id: str
    role: str
    content: str
    created_at: str
    
class ChatSessionResponse(BaseModel):
    id: str
    project_id: Optional[str] = None
    name: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None
    
class ChatSessionDetailResponse(BaseModel):
    id: str
    project_id: Optional[str] = None
    name: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None
    messages: List[ChatMessageResponse]


@router.post("/sessions", response_model=ChatSessionResponse)
async def create_chat_session(
    session_data: ChatSessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new chat session associated with a project
    """
    try:
        # Validate project exists and user has access
        result = await db.execute(
            select(Project)
            .where(Project.id == session_data.project_id)
            .where(Project.owner_id == current_user.id)
        )
        project = result.scalar_one_or_none()
        
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project not found or access denied: {session_data.project_id}"
            )
            
        # Create new chat session
        session_id = str(uuid.uuid4())
        session = ChatSession(
            id=session_id,
            user_id=current_user.id,
            project_id=session_data.project_id,
            meta_data={"name": session_data.name} if session_data.name else None
        )
        
        db.add(session)
        await db.commit()
        await db.refresh(session)
        
        return ChatSessionResponse(
            id=session.id,
            project_id=session.project_id,
            name=session_data.name,
            created_at=session.created_at.isoformat(),
            updated_at=session.updated_at.isoformat() if session.updated_at else None
        )
        
    except Exception as e:
        await db.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating chat session: {str(e)}"
        )

@router.get("/sessions", response_model=List[ChatSessionResponse])
async def list_chat_sessions(
    project_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List chat sessions for the current user, optionally filtered by project
    """
    try:
        query = select(ChatSession).where(ChatSession.user_id == current_user.id)
        
        if project_id:
            # Validate project exists and user has access
            project_result = await db.execute(
                select(Project)
                .where(Project.id == project_id)
                .where(Project.owner_id == current_user.id)
            )
            project = project_result.scalar_one_or_none()
            
            if not project:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Project not found or access denied: {project_id}"
                )
                
            query = query.where(ChatSession.project_id == project_id)
            
        result = await db.execute(query.order_by(ChatSession.created_at.desc()))
        sessions = result.scalars().all()
        
        return [
            ChatSessionResponse(
                id=session.id,
                project_id=session.project_id,
                name=session.meta_data.get("name") if session.meta_data else None,
                created_at=session.created_at.isoformat(),
                updated_at=session.updated_at.isoformat() if session.updated_at else None
            ) for session in sessions
        ]
        
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing chat sessions: {str(e)}"
        )

@router.get("/sessions/{session_id}", response_model=ChatSessionDetailResponse)
async def get_chat_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a chat session by ID with its messages
    """
    try:
        # Get the session and verify ownership
        result = await db.execute(
            select(ChatSession)
            .where(ChatSession.id == session_id)
            .where(ChatSession.user_id == current_user.id)
        )
        session = result.scalar_one_or_none()
        
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Chat session not found: {session_id}"
            )
            
        # Get the messages
        messages_result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at)
        )
        messages = messages_result.scalars().all()
        
        # Format the response
        message_responses = [
            ChatMessageResponse(
                id=message.id,
                role=message.role.value,
                content=message.content,
                created_at=message.created_at.isoformat()
            ) for message in messages
        ]
        
        return ChatSessionDetailResponse(
            id=session.id,
            project_id=session.project_id,
            name=session.meta_data.get("name") if session.meta_data else None,
            created_at=session.created_at.isoformat(),
            updated_at=session.updated_at.isoformat() if session.updated_at else None,
            messages=message_responses
        )
        
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving chat session: {str(e)}"
        )

@router.delete("/sessions/{session_id}")
async def delete_chat_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a chat session by ID
    """
    try:
        # Get the session and verify ownership
        result = await db.execute(
            select(ChatSession)
            .where(ChatSession.id == session_id)
            .where(ChatSession.user_id == current_user.id)
        )
        session = result.scalar_one_or_none()
        
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Chat session not found: {session_id}"
            )
            
        # Delete the session (cascade will delete messages)
        await db.delete(session)
        await db.commit()
            
        return {"status": "success", "message": f"Chat session {session_id} deleted successfully"}
        
    except Exception as e:
        await db.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting chat session: {str(e)}"
        )

@router.post("/completions")
async def chat_completion(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Send chat message and get completion
    """
    try:
        # Validate project if context provided
        project_context = None
        if request.project_context:
            result = await db.execute(
                select(Project)
                .where(Project.id == request.project_context.project_id)
                .where(Project.owner_id == current_user.id)
            )
            project = result.scalar_one_or_none()
            if not project:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Project not found: {request.project_context.project_id}"
                )
                
            # Get project context for LLM
            project_context = {
                "project_id": project.id,
                "name": project.name,
                "technology": project.technology,
                "description": project.description,
                "current_file": request.project_context.file_path if request.project_context.file_path else None
            }

        # Get or create chat session
        result = await db.execute(
            select(ChatSession)
            .where(ChatSession.id == request.session_id)
            .where(ChatSession.user_id == current_user.id)
        )
        session = result.scalar_one_or_none()
        
        if not session:
            session = ChatSession(
                id=request.session_id,
                user_id=current_user.id,
                project_id=request.project_context.project_id if request.project_context else None
            )
            db.add(session)
            await db.commit()
            
        # Get existing messages from the database
        existing_messages_result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == session.id)
            .order_by(ChatMessage.created_at)
        )
        existing_messages = existing_messages_result.scalars().all()
        
        # Convert to the format expected by LLM service
        llm_messages = []
        for msg in existing_messages:
            try:
                llm_messages.append(ChatMessage(
                    id=msg.id,
                    role=MessageRole(msg.role),
                    content=msg.content
                ))
            except Exception as e:
                logger.warning(f"Error converting message to LLM format: {str(e)}")
                # Use a simpler format as fallback
                llm_messages.append(ChatMessage(
                    id=msg.id,
                    role="user" if msg.role == "user" else "assistant",
                    content=msg.content
                ))
            
        # Add the new user message
        user_message_id = str(uuid.uuid4())
        user_message = ChatMessage(
            id=user_message_id,
            session_id=session.id,
            role="user",
            content_type="text",
            content=request.messages[-1].content
        )
        db.add(user_message)
        await db.commit()
        
        # Add to LLM messages
        llm_messages.append(ChatMessage(
            id=user_message_id,
            role=MessageRole.USER,
            content=request.messages[-1].content
        ))
        
        # Try to get cached response for the exact same conversation
        cache_key = f"chat_completion:{session.id}:{hash(str(llm_messages))}"
        cached_response = await cache.get(cache_key) if cache else None
        
        if cached_response:
            return cached_response
        
        # Generate response using LLM service
        try:
            response_message = await llm_service.generate_completion(llm_messages, project_context)
            
            # Save the assistant response to the database
            assistant_message = ChatMessage(
                id=response_message.id,
                session_id=session.id,
                role="assistant",
                content_type="text",
                content=response_message.content
            )
            db.add(assistant_message)
            await db.commit()
            
            # Prepare the response
            response = {
                "id": response_message.id,
                "role": "assistant",
                "content": response_message.content
            }
            
            # Cache the response if cache is available
            if cache:
                await cache.set(cache_key, response, 3600)  # Cache for 1 hour
            
            return response
            
        except Exception as llm_error:
            logger.error(f"Error generating LLM completion: {str(llm_error)}")
            # Fallback to a simple echo response
            response_id = str(uuid.uuid4())
            response = ChatMessage(
                id=response_id,
                session_id=session.id,
                role="assistant",
                content_type="text",
                content=f"I'm sorry, I encountered an error processing your request: {str(llm_error)}"
            )
            db.add(response)
            await db.commit()

            return {
                "id": response_id,
                "role": "assistant",
                "content": response.content
            }

    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing chat completion: {str(e)}"
        )



@router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for real-time chat
    """
    print("#####\n\n\nDoneBefore\n\n\n\n")

    await websocket.accept()
    logger.info(f"WebSocket connection accepted for session {session_id}")
    print("#####\n\n\nDone\n\n\n\n")

    messages = await session_service.get_session(session_id)

    if not messages:
        messages = []
    
    try:
        while True:
            # Receive message from client
            try:
                data = await websocket.receive_json()
                logger.info(f"Received WebSocket message for session {session_id}: {type(data)}, {data}")
                
                # Process message
                if "message" in data and "role" in data["message"]:
                    # Create chat message
                    message = ChatMessagePydantic(
                        id=data.get("id", str(uuid.uuid4())),
                        role=data["message"]["role"],
                        content=data["message"]["content"],
                    )
                    
                    # Store user message
                    if message.role == MessageRole.USER:
                        messages.append(message)
                        await session_service.save_session(session_id, messages)
                    
                    # Generate response if it's a user message
                    if message.role == MessageRole.USER:
                        try:
                            # Get project context if provided
                            project_context = None
                            if "project_id" in data:
                                project_id = data["project_id"]
                                project_context = ide_service.get_project_context(project_id)
                            
                            # Generate response with streaming
                            logger.info(f"Generating streaming response for session {session_id} with {len(messages)} messages")
                            
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
                            try:
                                async for content_chunk in llm_service.generate_completion_stream(
                                    messages,
                                    project_context
                                ):
                                    full_content += content_chunk
                                    
                                    # Send the chunk to the client
                                    try:
                                        await websocket.send_json({
                                            "type": "stream_chunk",
                                            "message_id": stream_message_id,
                                            "chunk": content_chunk
                                        })
                                        logger.debug(f"Sent chunk to client: {len(content_chunk)} chars")
                                    except Exception as chunk_error:
                                        logger.error(f"Error sending chunk: {str(chunk_error)}")
                                        break
                            except Exception as stream_error:
                                logger.error(f"Error during streaming: {str(stream_error)}")
                                await websocket.send_json({
                                    "type": "error",
                                    "error": f"Error during streaming: {str(stream_error)}"
                                })
                            
                            # Create the final message if we have content
                            if full_content:
                                response_message = ChatMessagePydantic(
                                    id=stream_message_id,
                                    role=MessageRole.ASSISTANT,
                                    content=full_content
                                )
                                
                                # Store assistant message
                                messages.append(response_message)
                                
                                # Save the session to persistent storage
                                await session_service.save_session(session_id, messages)
                                
                                # Indicate stream is complete
                                await websocket.send_json({
                                    "type": "stream_end",
                                    "message_id": stream_message_id,
                                    "session_id": session_id
                                })
                                logger.info(f"Streaming complete for session {session_id}, response length: {len(full_content)}")
                            
                        except Exception as e:
                            logger.error(f"Error in WebSocket streaming: {str(e)}")
                            try:
                                await websocket.send_json({
                                    "type": "error",
                                    "error": f"Error generating response: {str(e)}"
                                })
                            except Exception as send_error:
                                logger.error(f"Error sending error message: {str(send_error)}")
            except WebSocketDisconnect:
                logger.info(f"WebSocket disconnected for session {session_id} while receiving message")
                break
            except Exception as e:
                logger.error(f"Unexpected error in WebSocket communication: {str(e)}")
                try:
                    await websocket.send_json({
                        "type": "error",
                        "error": f"Unexpected error: {str(e)}"
                    })
                except:
                    # If we can't send the error, the connection is probably gone
                    logger.error("Failed to send error message, connection probably lost")
                    break
    
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for session {session_id}")
    except Exception as e:
        logger.error(f"Unhandled WebSocket error: {str(e)}")
    
    # Save the session before cleaning up
    try:
        await session_service.save_session(session_id, messages)
        logger.info(f"Session {session_id} saved on disconnection")
    except Exception as e:
        logger.error(f"Error saving session on disconnection: {str(e)}")
