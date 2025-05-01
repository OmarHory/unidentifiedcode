from fastapi import APIRouter, HTTPException, Body, Query, status
from typing import List, Optional
from app.core.logger import logger

from app.models.ide import Project, ProjectFile, FileContent, FileListResponse, FileOperation
from app.services.ide_service import IDEService

router = APIRouter()

# Initialize services
ide_service = IDEService()

@router.post("/projects", response_model=Project)
async def create_project(
    name: str = Body(..., embed=True),
    description: str = Body("", embed=True),
    technology: str = Body("", embed=True)
):
    """
    Create a new project
    """
    try:
        project = ide_service.create_project(name, description, technology)
        logger.info(f"Created project via API: {project.id} - {name}")
        return project
    except ValueError as e:
        logger.error(f"Value error creating project: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid project data: {str(e)}"
        )
    except Exception as e:
        logger.exception(f"Error creating project: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating project: {str(e)}"
        )

@router.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str):
    """
    Get project details
    """
    try:
        project = ide_service.get_project(project_id)
        if not project:
            logger.warning(f"Project not found in API request: {project_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project not found: {project_id}"
            )
        
        return project
    except Exception as e:
        logger.exception(f"Unexpected error retrieving project {project_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving project: {str(e)}"
        )

@router.get("/projects/{project_id}/files", response_model=FileListResponse)
async def list_files(project_id: str, path: str = "/"):
    """
    List files in a project
    """
    try:
        # Validate project ID
        project = ide_service.get_project(project_id)
        if not project:
            logger.warning(f"Project not found when listing files: {project_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail=f"Project not found: {project_id}"
            )
            
        # Get files
        files = ide_service.list_files(project_id, path)
        return FileListResponse(files=files)
    except ValueError as e:
        logger.error(f"Value error listing files for project {project_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.exception(f"Error listing files for project {project_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing files: {str(e)}"
        )

@router.get("/projects/{project_id}/files/{file_path:path}", response_model=FileContent)
async def get_file_content(project_id: str, file_path: str):
    """
    Get file content
    """
    try:
        # Validate project first
        project = ide_service.get_project(project_id)
        if not project:
            logger.warning(f"Project not found when getting file content: {project_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project not found: {project_id}"
            )
            
        file_content = ide_service.read_file(project_id, file_path)
        if not file_content:
            logger.warning(f"File not found: {file_path} in project {project_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"File not found: {file_path}"
            )
        
        return file_content
    except ValueError as e:
        logger.error(f"Value error reading file {file_path} from project {project_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.exception(f"Error reading file {file_path} from project {project_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error reading file: {str(e)}"
        )

@router.put("/projects/{project_id}/files/{file_path:path}", response_model=FileContent)
async def update_file_content(
    project_id: str,
    file_path: str,
    content: str = Body(..., embed=True)
):
    """
    Update file content
    """
    try:
        file_content = ide_service.write_file(project_id, file_path, content)
        return file_content
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error writing file: {str(e)}"
        )

@router.delete("/projects/{project_id}/files/{file_path:path}")
async def delete_file(project_id: str, file_path: str):
    """
    Delete a file
    """
    try:
        success = ide_service.delete_file(project_id, file_path)
        if not success:
            raise HTTPException(
                status_code=404,
                detail=f"File not found: {file_path}"
            )
        
        return {"status": "success"}
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error deleting file: {str(e)}"
        )

@router.post("/projects/{project_id}/files")
async def operate_on_file(project_id: str, operation: FileOperation = Body(...)):
    """
    Perform operations on files (create, update, delete)
    """
    print(f"Received file operation: {operation.dict()}")
    
    try:
        # Validate project exists
        project = ide_service.get_project(project_id)
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
        
        if operation.operation == "create" or operation.operation == "update":
            # For create/update operations, content can be empty string but not None
            if operation.content is None:
                raise HTTPException(
                    status_code=400,
                    detail="Content is required for create/update operations (can be empty string)"
                )
            
            file_content = ide_service.write_file(
                project_id,
                operation.path,
                operation.content
            )
            
            return {
                "status": "success",
                "operation": operation.operation,
                "path": operation.path
            }
        
        elif operation.operation == "delete":
            success = ide_service.delete_file(project_id, operation.path)
            
            if not success:
                raise HTTPException(
                    status_code=404,
                    detail=f"File not found: {operation.path}"
                )
            
            return {
                "status": "success",
                "operation": "delete",
                "path": operation.path
            }
    
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )
    except Exception as e:
        # Log more details about the error for debugging
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error performing file operation: {str(e)}"
        ) 