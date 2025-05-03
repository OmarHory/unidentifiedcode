from sqlalchemy import Column, String, DateTime, ForeignKey, Text, JSON, Float, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from app.models.chat_pydantic import MessageRole, MessageType
import uuid

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    project_id = Column(String(36), ForeignKey('projects.id'), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    meta_data = Column(JSON, nullable=True)

    # Relationships
    user = relationship("User", backref="chat_sessions")
    project = relationship("Project", backref="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey('chat_sessions.id'), nullable=False)
    role = Column(SQLEnum(MessageRole), nullable=False)
    content_type = Column(SQLEnum(MessageType), nullable=False)
    content = Column(Text, nullable=False)
    meta_data = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    session = relationship("ChatSession", back_populates="messages")

class VoiceSession(Base):
    __tablename__ = "voice_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    chat_session_id = Column(String(36), ForeignKey('chat_sessions.id'), nullable=True)
    status = Column(String(20), nullable=False)  # active, completed, failed
    audio_url = Column(String(255), nullable=True)
    transcript = Column(Text, nullable=True)
    confidence = Column(Float, nullable=True)
    meta_data = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", backref="voice_sessions")
    chat_session = relationship("ChatSession", backref="voice_sessions")
