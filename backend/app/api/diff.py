from fastapi import APIRouter, HTTPException, Body
from typing import Dict, Any, List

from app.models.ide import ApplyDiffRequest, ApplyDiffResponse
from app.services.diff_service import DiffService
from app.services.ide_service import IDEService
from app.services.llm_service import LLMService

router = APIRouter()

# Initialize services
diff_service = DiffService()
ide_service = IDEService()
llm_service = LLMService()

@router.post("/generate", response_model=List[Dict[str, Any]])
async def generate_diff(
    project_id: str,
    file_path: str,
    modified_content: str = Body(..., embed=True)
):
    """
    Generate a diff between original and modified content
    """
    try:
        # Get original file content
        file_content = ide_service.read_file(project_id, file_path)
        if not file_content:
            raise HTTPException(
                status_code=404,
                detail=f"File not found: {file_path}"
            )
        
        # Generate diff
        diff_operations = diff_service.generate_diff(
            file_content.content,
            modified_content
        )
        
        return diff_operations
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating diff: {str(e)}"
        )

@router.post("/apply", response_model=ApplyDiffResponse)
async def apply_diff(request: ApplyDiffRequest, project_id: str):
    """
    Apply a diff to a file
    """
    try:
        # Get original file content
        file_content = ide_service.read_file(project_id, request.file_path)
        if not file_content:
            raise HTTPException(
                status_code=404,
                detail=f"File not found: {request.file_path}"
            )
        
        # Apply diff
        modified_content = diff_service.apply_diff(
            file_content.content,
            request.diff_operations
        )
        
        # Write modified content back to file
        ide_service.write_file(
            project_id,
            request.file_path,
            modified_content
        )
        
        return ApplyDiffResponse(
            success=True,
            file_path=request.file_path,
            content=modified_content
        )
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error applying diff: {str(e)}"
        )

@router.post("/analyze")
async def analyze_diff(
    project_id: str,
    file_path: str,
    original_content: str = Body(...),
    modified_content: str = Body(...),
):
    """
    Analyze a diff and provide explanation
    """
    try:
        # Use LLM to analyze diff
        analysis = await llm_service.analyze_code_diff(
            file_path,
            original_content,
            modified_content
        )
        
        return analysis
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error analyzing diff: {str(e)}"
        )

@router.post("/parse")
async def parse_diff_text(diff_text: str = Body(..., embed=True)):
    """
    Parse diff text into structured operations
    """
    try:
        operations, errors = diff_service.parse_diff_from_text(diff_text)
        
        if errors:
            return {
                "operations": operations,
                "errors": errors,
                "success": len(operations) > 0
            }
        
        return {
            "operations": operations,
            "errors": [],
            "success": True
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error parsing diff: {str(e)}"
        ) 