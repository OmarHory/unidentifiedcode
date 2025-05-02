import os
from typing import Optional
from fastapi import UploadFile, HTTPException, status
from app.core.config import settings

class FileValidator:
    @staticmethod
    def validate_file_size(file_size: int, max_size: Optional[int] = None) -> bool:
        """Validate file size"""
        max_size = max_size or settings.MAX_UPLOAD_SIZE
        return file_size <= max_size

    @staticmethod
    def validate_file_extension(filename: str) -> bool:
        """Validate file extension"""
        _, ext = os.path.splitext(filename.lower())
        return ext in settings.ALLOWED_EXTENSIONS

    @staticmethod
    async def validate_upload_file(file: UploadFile, max_size: Optional[int] = None) -> None:
        """Validate uploaded file"""
        # Check file extension
        if not FileValidator.validate_file_extension(file.filename):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type not allowed. Allowed extensions: {', '.join(settings.ALLOWED_EXTENSIONS)}"
            )

        # Check file size
        file_size = 0
        chunk_size = 8192  # 8KB chunks
        
        while True:
            chunk = await file.read(chunk_size)
            if not chunk:
                break
            file_size += len(chunk)
            
            if not FileValidator.validate_file_size(file_size, max_size):
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"File too large. Maximum size allowed: {settings.MAX_UPLOAD_SIZE / (1024 * 1024)}MB"
                )
        
        # Reset file position for subsequent reads
        await file.seek(0)

    @staticmethod
    def validate_file_path(file_path: str) -> None:
        """Validate file path for security"""
        # Prevent directory traversal
        normalized_path = os.path.normpath(file_path)
        if normalized_path.startswith("..") or normalized_path.startswith("/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file path. Directory traversal not allowed."
            )

        # Check file extension for new files
        if not any(normalized_path.endswith(ext) for ext in settings.ALLOWED_EXTENSIONS):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type not allowed. Allowed extensions: {', '.join(settings.ALLOWED_EXTENSIONS)}"
            ) 