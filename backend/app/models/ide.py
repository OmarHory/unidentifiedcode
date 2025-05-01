from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class FileContent(BaseModel):
    path: str = Field(..., description="Path of the file")
    content: str = Field(..., description="Content of the file")
    
class FileOperation(BaseModel):
    operation: str = Field(..., description="Type of operation (create, update, delete)")
    path: str = Field(..., description="Path of the file")
    content: Optional[str] = Field(None, description="Content for create/update operations")

class ProjectFile(BaseModel):
    path: str
    type: str = Field(..., description="File type (file or directory)")
    size: Optional[int] = None
    last_modified: Optional[str] = None
    
class Project(BaseModel):
    id: str
    name: str
    files: List[ProjectFile] = []
    
class FileRequest(BaseModel):
    path: str
    
class FileListResponse(BaseModel):
    files: List[ProjectFile]
    
class ApplyDiffRequest(BaseModel):
    file_path: str
    diff_operations: List[Dict[str, Any]]
    
class ApplyDiffResponse(BaseModel):
    success: bool
    file_path: str
    content: Optional[str] = None
    error: Optional[str] = None 