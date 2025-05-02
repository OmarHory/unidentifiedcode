from typing import Any, Optional
import json
import redis
from datetime import datetime
from app.core.config import settings
from app.core.logger import logger

class DateTimeEncoder(json.JSONEncoder):
    """Custom JSON encoder that handles datetime objects"""
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

class RedisCache:
    def __init__(self):
        self.redis_client = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=0,
            decode_responses=True
        )
        self.default_ttl = 3600  # 1 hour default TTL

    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        try:
            value = self.redis_client.get(key)
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            logger.error(f"Cache get error: {str(e)}")
            return None

    async def set(self, key: str, value: Any, ttl: int = None) -> bool:
        """Set value in cache with optional TTL"""
        try:
            ttl = ttl or self.default_ttl
            # Use the custom encoder to handle datetime objects
            json_value = json.dumps(value, cls=DateTimeEncoder)
            return self.redis_client.setex(
                key,
                ttl,
                json_value
            )
        except Exception as e:
            logger.error(f"Cache set error: {str(e)}")
            return False

    async def delete(self, key: str) -> bool:
        """Delete value from cache"""
        try:
            return bool(self.redis_client.delete(key))
        except Exception as e:
            logger.error(f"Cache delete error: {str(e)}")
            return False

    async def clear(self) -> bool:
        """Clear all cache"""
        try:
            return self.redis_client.flushdb()
        except Exception as e:
            logger.error(f"Cache clear error: {str(e)}")
            return False

# Create global cache instance
cache = RedisCache() 