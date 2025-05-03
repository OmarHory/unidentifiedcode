from fastapi import Request, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import time
from typing import Dict, Tuple
import jwt
from app.core.config import settings
from app.core.logger import logger

# Rate limiting storage
# Structure: {ip: (requests_count, start_time)}
RATE_LIMIT_STORAGE: Dict[str, Tuple[int, float]] = {}
RATE_LIMIT_WINDOW = 60  # 1 minute
RATE_LIMIT_MAX_REQUESTS = 1000  # Maximum requests per minute

security = HTTPBearer()

class RateLimitMiddleware:
    async def __call__(self, request: Request, call_next):
        # Get client IP
        client_ip = request.client.host

        # Check rate limit
        current_time = time.time()
        if client_ip in RATE_LIMIT_STORAGE:
            requests_count, start_time = RATE_LIMIT_STORAGE[client_ip]
            
            # Reset counter if window has passed
            if current_time - start_time >= RATE_LIMIT_WINDOW:
                RATE_LIMIT_STORAGE[client_ip] = (1, current_time)
            else:
                # Increment counter
                requests_count += 1
                if requests_count > RATE_LIMIT_MAX_REQUESTS:
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="Rate limit exceeded. Please try again later."
                    )
                RATE_LIMIT_STORAGE[client_ip] = (requests_count, start_time)
        else:
            # First request from this IP
            RATE_LIMIT_STORAGE[client_ip] = (1, current_time)

        response = await call_next(request)
        return response

class AuthMiddleware:
    async def __call__(self, request: Request, call_next):
        # Log the request path for debugging
        path = request.url.path
        logger.info(f"AuthMiddleware processing request to path: {path}")
        
        # List of public endpoints that don't require auth
        public_endpoints = [
            "/",
            "/health",
            "/api/health",
            "/docs",
            "/redoc",
            "/openapi.json",
            "/api/auth/token",  # Skip auth for token endpoint
            "/api/debug/auth"   # Skip auth for debug endpoint
        ]
        
        # Skip auth for public endpoints and debug endpoints
        if path in public_endpoints or path.startswith("/favicon"):
            logger.info(f"Skipping auth for public endpoint: {path}")
            return await call_next(request)

        try:
            # Get token from header
            auth_header = request.headers.get("Authorization")
            logger.info(f"Auth header: {auth_header}")
            
            if not auth_header:
                logger.warning(f"No authorization header provided for path: {path}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="No authorization token provided"
                )

            try:
                scheme, token = auth_header.split()
                logger.info(f"Auth scheme: {scheme}, Token: {token[:10]}...")
                
                if scheme.lower() != "bearer":
                    logger.warning(f"Invalid auth scheme: {scheme}")
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid authentication scheme"
                    )
            except ValueError:
                logger.warning(f"Invalid auth header format: {auth_header}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid authorization header format"
                )

            # Verify JWT token
            try:
                logger.info(f"Decoding JWT token with secret key: {settings.SECRET_KEY[:5]}...")
                payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
                logger.info(f"Token decoded successfully. Payload: {payload}")
                
                # Add user info to request state
                request.state.user = payload
            except jwt.InvalidTokenError as e:
                logger.warning(f"Invalid token: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Invalid token: {str(e)}"
                )

        except HTTPException as e:
            logger.warning(f"Auth error: {e.detail}")
            raise e
        except Exception as e:
            logger.error(f"Unexpected auth error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=str(e)
            )

        logger.info(f"Auth successful for path: {path}")
        response = await call_next(request)
        return response 