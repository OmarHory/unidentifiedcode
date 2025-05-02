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
from app.models.user import User
from app.models.project import Project
from app.models.chat import MessageRole, MessageType

router = APIRouter()

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

class StreamResponse(BaseModel):
    type: str
    message_id: Optional[str] = None
    message: Optional[dict] = None
    chunk: Optional[str] = None

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

        # Create message
        message = ChatMessage(
            id=str(uuid.uuid4()),
            session_id=session.id,
            role="user",
            content_type="text",
            content=request.messages[-1].content
        )
        db.add(message)
        await db.commit()

        # TODO: Implement actual chat completion logic here
        # For now, just echo back the message
        response_id = str(uuid.uuid4())
        response = ChatMessage(
            id=response_id,
            session_id=session.id,
            role="assistant",
            content_type="text",
            content=f"Echo: {request.messages[-1].content}"
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
async def websocket_endpoint(
    websocket: WebSocket,
    session_id: str,
    db: AsyncSession = Depends(get_db)
):
    await websocket.accept()
    
    try:
        # TODO: Implement WebSocket authentication
        
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message["type"] == "message":
                # Validate project if context provided
                if "project_context" in message:
                    result = await db.execute(
                        select(Project)
                        .where(Project.id == message["project_context"]["project_id"])
                    )
                    project = result.scalar_one_or_none()
                    if not project:
                        await websocket.send_json({
                            "type": "error",
                            "detail": f"Project not found: {message['project_context']['project_id']}"
                        })
                        continue

                # Create message in database
                chat_message = ChatMessage(
                    id=str(uuid.uuid4()),
                    session_id=session_id,
                    role="user",
                    content_type="text",
                    content=message["content"]
                )
                db.add(chat_message)
                await db.commit()

                # Send stream start
                response_id = str(uuid.uuid4())
                await websocket.send_json({
                    "type": "stream_start",
                    "message": {
                        "id": response_id,
                        "role": "assistant",
                        "content": None
                    }
                })

                # TODO: Implement actual streaming chat completion
                # For now, just echo back the message in chunks
                chunks = message["content"].split()
                content = ""
                
                for chunk in chunks:
                    content += chunk + " "
                    await websocket.send_json({
                        "type": "stream_chunk",
                        "message_id": response_id,
                        "chunk": chunk + " "
                    })

                # Save complete response
                response = ChatMessage(
                    id=response_id,
                    session_id=session_id,
                    role="assistant",
                    content_type="text",
                    content=content.strip()
                )
                db.add(response)
                await db.commit()

    except Exception as e:
        await db.rollback()
        await websocket.close()
