from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from datetime import datetime, timedelta
import jwt
from app.core.config import settings

router = APIRouter()

class TokenRequest(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")
    return encoded_jwt

@router.post("/token", response_model=Token)
async def login_for_access_token(request: TokenRequest):
    """
    Get JWT access token for authentication
    """
    # For development/testing purposes, accept any username/password
    # In production, you should validate against a user database
    if settings.DEBUG:
        access_token = create_access_token(
            data={"sub": request.username}
        )
        return Token(access_token=access_token, token_type="bearer")
    
    # In production, implement proper authentication here
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials"
    ) 