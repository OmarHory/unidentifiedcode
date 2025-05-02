from fastapi import APIRouter, HTTPException, WebSocket, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
import json
import uuid

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.chat_models import ChatSession, ChatMessage
from app.models.user import User
from app.models.project import Project

router = APIRouter()

class Message(BaseModel):
    role: str
    content: str

class ProjectContext(BaseModel):
    project_id: str
    file_path: Optional[str] = None

class ChatRequest(BaseModel):
    messages: List[Message]
    session_id: str
    project_context: Optional[ProjectContext] = None

class StreamResponse(BaseModel):
    type: str
    message_id: Optional[str] = None
    message: Optional[dict] = None
    chunk: Optional[str] = None

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
