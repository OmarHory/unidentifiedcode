from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from datetime import datetime
import uuid

from app.models.chat_models import ChatSession, ChatMessage
from app.models.chat_pydantic import MessageRole, MessageType
from app.core.logger import logger
from app.core.config import settings

class ChatService:
    async def create_session(
        self,
        db: AsyncSession,
        user_id: str,
        project_id: Optional[str] = None,
        meta_data: Optional[Dict[str, Any]] = None
    ) -> ChatSession:
        """Create a new chat session"""
        session = ChatSession(
            id=str(uuid.uuid4()),
            user_id=user_id,
            project_id=project_id,
            meta_data=meta_data
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)
        return session

    async def get_session(
        self,
        db: AsyncSession,
        session_id: str,
        user_id: str
    ) -> Optional[ChatSession]:
        """Get a chat session by ID"""
        result = await db.execute(
            select(ChatSession)
            .where(ChatSession.id == session_id)
            .where(ChatSession.user_id == user_id)
            .options(joinedload(ChatSession.messages))
        )
        return result.scalar_one_or_none()

    async def list_sessions(
        self,
        db: AsyncSession,
        user_id: str,
        project_id: Optional[str] = None
    ) -> List[ChatSession]:
        """List chat sessions for a user"""
        query = select(ChatSession).where(ChatSession.user_id == user_id)
        if project_id:
            query = query.where(ChatSession.project_id == project_id)
        result = await db.execute(query)
        return result.scalars().all()

    async def add_message(
        self,
        db: AsyncSession,
        session_id: str,
        role: MessageRole,
        content: str,
        content_type: MessageType = MessageType.text,
        meta_data: Optional[Dict[str, Any]] = None
    ) -> ChatMessage:
        """Add a message to a chat session"""
        message = ChatMessage(
            id=str(uuid.uuid4()),
            session_id=session_id,
            role=role,
            content_type=content_type,
            content=content,
            meta_data=meta_data
        )
        db.add(message)
        await db.commit()
        await db.refresh(message)
        return message

    async def get_session_messages(
        self,
        db: AsyncSession,
        session_id: str,
        user_id: str
    ) -> List[ChatMessage]:
        """Get all messages in a chat session"""
        # First verify session ownership
        session = await self.get_session(db, session_id, user_id)
        if not session:
            return []
            
        result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at)
        )
        return result.scalars().all()

    async def delete_session(
        self,
        db: AsyncSession,
        session_id: str,
        user_id: str
    ) -> bool:
        """Delete a chat session and all its messages"""
        session = await self.get_session(db, session_id, user_id)
        if not session:
            return False
            
        await db.delete(session)
        await db.commit()
        return True
