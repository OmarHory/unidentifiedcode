from typing import List, Optional, Dict, Any
import json
from datetime import datetime, timedelta
from app.core.cache import cache
from app.models.chat import ChatMessage
from app.core.config import settings

class SessionService:
    def __init__(self):
        self.session_prefix = "chat_session:"
        self.session_ttl = 60 * 60 * 24 * 7  # 7 days

    async def get_session(self, session_id: str) -> Optional[List[ChatMessage]]:
        """Get chat session from Redis"""
        key = f"{self.session_prefix}{session_id}"
        data = await cache.get(key)
        
        if not data:
            return None
            
        try:
            # Convert raw data back to ChatMessage objects
            messages = []
            for msg_data in data:
                messages.append(ChatMessage(**msg_data))
            return messages
        except Exception as e:
            print(f"Error deserializing session data: {str(e)}")
            return None

    async def save_session(self, session_id: str, messages: List[ChatMessage]) -> bool:
        """Save chat session to Redis"""
        key = f"{self.session_prefix}{session_id}"
        
        try:
            # Convert ChatMessage objects to dictionaries
            data = [msg.dict() for msg in messages]
            return await cache.set(key, data, self.session_ttl)
        except Exception as e:
            print(f"Error saving session: {str(e)}")
            return False

    async def delete_session(self, session_id: str) -> bool:
        """Delete chat session from Redis"""
        key = f"{self.session_prefix}{session_id}"
        return await cache.delete(key)

    async def cleanup_stale_sessions(self) -> None:
        """Cleanup stale sessions (not implemented as Redis handles TTL automatically)"""
        pass  # Redis automatically handles TTL expiration

    async def get_session_metadata(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session metadata"""
        messages = await self.get_session(session_id)
        if not messages:
            return None
            
        return {
            "session_id": session_id,
            "message_count": len(messages),
            "created_at": messages[0].timestamp if messages else None,
            "last_updated": messages[-1].timestamp if messages else None,
        }

# Create global session service instance
session_service = SessionService() 