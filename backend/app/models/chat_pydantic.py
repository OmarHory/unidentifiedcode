from enum import Enum
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field
from datetime import datetime

class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"

class MessageType(str, Enum):
    TEXT = "text"
    CODE = "code"
    DIFF = "diff"
    VOICE = "voice"

class CodeSnippet(BaseModel):
    language: str = Field(..., description="Programming language of the code")
    code: str = Field(..., description="Code content")
    file_path: Optional[str] = Field(None, description="File path if applicable")

class DiffOperation(str, Enum):
    ADD = "add"
    DELETE = "delete"
    REPLACE = "replace"

class CodeDiff(BaseModel):
    file_path: str = Field(..., description="File path where changes should be applied")
    operations: List[Dict[str, Any]] = Field(..., description="List of diff operations")
    description: str = Field(..., description="Description of the changes")
    
class MessageContent(BaseModel):
    type: MessageType
    text: Optional[str] = None
    code: Optional[CodeSnippet] = None
    diff: Optional[CodeDiff] = None
    audio_url: Optional[str] = None

class ChatMessagePydantic(BaseModel):
    id: Optional[str] = Field(None, description="Message ID")
    role: MessageRole
    content: Union[str, List[MessageContent]]
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
        }

    def dict(self, *args, **kwargs):
        data = super().dict(*args, **kwargs)
        if self.created_at:
            data["created_at"] = self.created_at.isoformat()
        if isinstance(self.content, list):
            data["content"] = [item.dict() if hasattr(item, "dict") else item for item in self.content]
        return data

class ChatCompletionRequest(BaseModel):
    messages: List[ChatMessagePydantic  ]
    session_id: Optional[str] = None
    project_context: Optional[Dict[str, Any]] = None

class ChatCompletionResponse(BaseModel):
    message: ChatMessagePydantic
    session_id: str
    
class VoiceTranscriptionRequest(BaseModel):
    audio_file: str = Field(..., description="Base64 encoded audio data or URL")
    
class VoiceTranscriptionResponse(BaseModel):
    text: str
