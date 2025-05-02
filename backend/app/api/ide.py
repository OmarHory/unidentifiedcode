from fastapi import APIRouter, HTTPException, Body, Query, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from typing import List, Optional
from app.core.logger import logger
from app.core.database import get_db
from app.core.auth import get_current_user

from app.models.project import Project
from app.models.file import File
from app.models.user import User
from app.api.models import ProjectCreate, ProjectResponse, FileResponse, FileListResponse, FileOperation

router = APIRouter()

@router.post("/projects", response_model=ProjectResponse)
async def create_project(
    project: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new project
    """
    try:
        new_project = Project(
            name=project.name,
            description=project.description,
            technology=project.technology,
            meta_data=project.metadata,
            owner_id=current_user.id
        )
        db.add(new_project)
        await db.commit()
        await db.refresh(new_project)
        
        logger.info(f"Created project via API: {new_project.id} - {project.name}")
        return new_project
    except Exception as e:
        logger.exception(f"Error creating project: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating project: {str(e)}"
        )

@router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get project details
    """
    try:
        result = await db.execute(
            select(Project)
            .where(Project.id == project_id)
            .where(Project.owner_id == current_user.id)
        )
        project = result.scalar_one_or_none()
        
        if not project:
            logger.warning(f"Project not found in API request: {project_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project not found: {project_id}"
            )
        
        return project
    except Exception as e:
        logger.exception(f"Error retrieving project: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving project: {str(e)}"
        )

@router.get("/projects/{project_id}/files", response_model=FileListResponse)
async def list_files(
    project_id: str,
    path: str = "/",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List files in a project
    """
    try:
        # Validate project ID and ownership
        result = await db.execute(
            select(Project)
            .where(Project.id == project_id)
            .where(Project.owner_id == current_user.id)
        )
        project = result.scalar_one_or_none()
        
        if not project:
            logger.warning(f"Project not found when listing files: {project_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail=f"Project not found: {project_id}"
            )
            
        # Get files
        result = await db.execute(
            select(File)
            .where(File.project_id == project_id)
            .where(File.path.startswith(path))
        )
        files = result.scalars().all()
        
        return FileListResponse(files=files)
    except Exception as e:
        logger.exception(f"Error listing files for project {project_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing files: {str(e)}"
        )

@router.get("/projects/{project_id}/files/{file_path:path}", response_model=FileResponse)
async def get_file_content(
    project_id: str,
    file_path: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get file content
    """
    try:
        # Validate project ownership
        result = await db.execute(
            select(Project)
            .where(Project.id == project_id)
            .where(Project.owner_id == current_user.id)
        )
        project = result.scalar_one_or_none()
        
        if not project:
            logger.warning(f"Project not found when getting file content: {project_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project not found: {project_id}"
            )
        
        # Get file
        result = await db.execute(
            select(File)
            .where(File.project_id == project_id)
            .where(File.path == file_path)
        )
        file = result.scalar_one_or_none()
        
        if not file:
            logger.warning(f"File not found: {file_path} in project {project_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"File not found: {file_path}"
            )
        
        return file
    except Exception as e:
        logger.exception(f"Error reading file {file_path} in project {project_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error reading file: {str(e)}"
        )

@router.put("/projects/{project_id}/files/{file_path:path}", response_model=FileResponse)
async def update_file_content(
    project_id: str,
    file_path: str,
    content: str = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update file content
    """
    try:
        # Validate project ownership
        result = await db.execute(
            select(Project)
            .where(Project.id == project_id)
            .where(Project.owner_id == current_user.id)
        )
        project = result.scalar_one_or_none()
        
        if not project:
            logger.warning(f"Project not found when updating file content: {project_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project not found: {project_id}"
            )
        
        # Get file
        result = await db.execute(
            select(File)
            .where(File.project_id == project_id)
            .where(File.path == file_path)
        )
        file = result.scalar_one_or_none()
        
        if not file:
            logger.warning(f"File not found: {file_path} in project {project_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"File not found: {file_path}"
            )
        
        # Update file content
        file.content = content
        await db.commit()
        
        return file
    except Exception as e:
        logger.exception(f"Error updating file {file_path} in project {project_id}: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating file: {str(e)}"
        )

@router.delete("/projects/{project_id}/files/{file_path:path}")
async def delete_file(
    project_id: str,
    file_path: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a file
    """
    try:
        # Validate project ownership
        result = await db.execute(
            select(Project)
            .where(Project.id == project_id)
            .where(Project.owner_id == current_user.id)
        )
        project = result.scalar_one_or_none()
        
        if not project:
            logger.warning(f"Project not found when deleting file: {project_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project not found: {project_id}"
            )
        
        # Get file
        result = await db.execute(
            select(File)
            .where(File.project_id == project_id)
            .where(File.path == file_path)
        )
        file = result.scalar_one_or_none()
        
        if not file:
            logger.warning(f"File not found: {file_path} in project {project_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"File not found: {file_path}"
            )
        
        # Delete file
        await db.execute(
            delete(File)
            .where(File.project_id == project_id)
            .where(File.path == file_path)
        )
        await db.commit()
        
        return {"status": "success"}
    except Exception as e:
        logger.exception(f"Error deleting file {file_path} in project {project_id}: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting file: {str(e)}"
        )

@router.post("/projects/{project_id}/files")
async def operate_on_file(
    project_id: str,
    operation: FileOperation,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Perform operations on files (create, update, delete)
    """
    try:
        # Validate project ownership
        result = await db.execute(
            select(Project)
            .where(Project.id == project_id)
            .where(Project.owner_id == current_user.id)
        )
        project = result.scalar_one_or_none()
        
        if not project:
            raise HTTPException(
                status_code=404,
                detail=f"Project not found: {project_id}"
            )
        
        # Validate operation
        valid_operations = ["create", "update", "delete"]
        if operation.operation not in valid_operations:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid operation: {operation.operation}. Must be one of: {', '.join(valid_operations)}"
            )
        
        # Validate path
        if not operation.path or not operation.path.strip():
            raise HTTPException(
                status_code=400, 
                detail="File path is required"
            )
        
        if operation.operation in ["create", "update"]:
            # For create/update operations, content can be empty string but not None
            if operation.content is None:
                raise HTTPException(
                    status_code=400,
                    detail="Content is required for create/update operations (can be empty string)"
                )
            
            # Check if file exists
            result = await db.execute(
                select(File)
                .where(File.project_id == project_id)
                .where(File.path == operation.path)
            )
            existing_file = result.scalar_one_or_none()
            
            if operation.operation == "create" and existing_file:
                raise HTTPException(
                    status_code=400,
                    detail=f"File already exists: {operation.path}"
                )
            
            if operation.operation == "update" and not existing_file:
                raise HTTPException(
                    status_code=404,
                    detail=f"File not found: {operation.path}"
                )
            
            if existing_file:
                # Update
                existing_file.content = operation.content
                await db.commit()
                file = existing_file
            else:
                # Create
                file = File(
                    project_id=project_id,
                    path=operation.path,
                    name=operation.path.split("/")[-1],
                    type="file",  # You might want to determine this based on extension
                    content=operation.content
                )
                db.add(file)
                await db.commit()
            
            return {
                "status": "success",
                "operation": operation.operation,
                "path": operation.path
            }
        
        elif operation.operation == "delete":
            result = await db.execute(
                delete(File)
                .where(File.project_id == project_id)
                .where(File.path == operation.path)
                .returning(File.id)
            )
            deleted = result.scalar_one_or_none()
            
            if not deleted:
                raise HTTPException(
                    status_code=404,
                    detail=f"File not found: {operation.path}"
                )
            
            await db.commit()
            
            return {
                "status": "success",
                "operation": "delete",
                "path": operation.path
            }
    
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        logger.exception(f"Error performing file operation: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error performing file operation: {str(e)}"
        )