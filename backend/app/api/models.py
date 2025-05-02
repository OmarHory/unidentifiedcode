from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    technology: Optional[str] = None
    meta_data: Optional[Dict[str, Any]] = None  # Changed from metadata to meta_data to match the database model

class ProjectResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    technology: Optional[str] = None
    meta_data: Optional[Dict[str, Any]] = None  # Changed from metadata to meta_data to match the database model
    owner_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class FileResponse(BaseModel):
    id: str
    project_id: str
    path: str
    name: str
    type: str
    content: Optional[str] = None
    size: Optional[int] = None
    mime_type: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class FileListResponse(BaseModel):
    files: List[FileResponse]

class FileOperation(BaseModel):
    operation: str  # create, update, delete
    path: str
    content: Optional[str] = None
