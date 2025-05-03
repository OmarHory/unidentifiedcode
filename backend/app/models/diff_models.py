from sqlalchemy import Column, String, DateTime, ForeignKey, Text, JSON, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from app.models.chat_pydantic import DiffOperation
import uuid

class Diff(Base):
    __tablename__ = "diffs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey('projects.id'), nullable=False)
    file_id = Column(String(36), ForeignKey('files.id'), nullable=False)
    operation_type = Column(SQLEnum(DiffOperation), nullable=False)
    original_content = Column(Text, nullable=True)
    modified_content = Column(Text, nullable=True)
    patch = Column(Text, nullable=True)
    meta_data = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    project = relationship("Project", backref="diffs")
    file = relationship("File", backref="diffs")
