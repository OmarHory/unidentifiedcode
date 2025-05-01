import os
import json
from typing import List, Dict, Any, Optional
from datetime import datetime
import uuid
from pathlib import Path

from app.models.ide import ProjectFile, Project, FileContent

# Update the projects directory path to work with the new structure
PROJECTS_DIR = Path("projects").resolve()

class IDEService:
    def __init__(self):
        # Ensure projects directory exists
        os.makedirs(PROJECTS_DIR, exist_ok=True)
        
    def create_project(self, name: str, description: str, technology: str) -> Project:
        """
        Create a new project
        
        Args:
            name: Project name
            description: Project description
            technology: Project technology
            
        Returns:
            Project details
        """
        project_id = str(uuid.uuid4())
        project_dir = PROJECTS_DIR / project_id
        
        # Create project directory
        os.makedirs(project_dir, exist_ok=True)
        
        # Create project metadata
        project = Project(
            id=project_id,
            name=name,
            description=description,
            technology=technology
        )
        
        return project
    
    def get_project(self, project_id: str) -> Optional[Project]:
        """
        Get project by ID
        
        Args:
            project_id: Project ID
            
        Returns:
            Project details or None if not found
        """
        project_path = PROJECTS_DIR / project_id
        
        if not os.path.exists(project_path):
            return None
            
        # Read metadata
        metadata_path = project_path / ".metadata.json"
        if os.path.exists(metadata_path):
            with open(metadata_path, "r") as f:
                metadata = json.load(f)
                
            project = Project(id=metadata["id"], name=metadata["name"])
            return project
            
        return None
    
    def list_files(self, project_id: str, path: str = "/") -> List[ProjectFile]:
        """
        List files in a project
        
        Args:
            project_id: Project ID
            path: Path within project
            
        Returns:
            List of files
        """
        # Ensure project exists
        project_path = PROJECTS_DIR / project_id
        if not os.path.exists(project_path):
            raise ValueError(f"Project not found: {project_id}")
            
        # Handle path
        clean_path = path.lstrip("/")
        target_path = os.path.normpath(os.path.join(project_path, clean_path))
        
        # Ensure the path is within the project
        if not os.path.abspath(target_path).startswith(os.path.abspath(project_path)):
            raise ValueError("Invalid path")
            
        if not os.path.exists(target_path) or not os.path.isdir(target_path):
            return []
            
        files = []
        
        for item in os.listdir(target_path):
            # Skip metadata file
            if item == ".metadata.json":
                continue
                
            item_path = os.path.join(target_path, item)
            rel_path = os.path.relpath(item_path, project_path)
            
            # Use forward slashes for consistency
            rel_path = rel_path.replace(os.path.sep, "/")
            
            file_type = "directory" if os.path.isdir(item_path) else "file"
            size = os.path.getsize(item_path) if file_type == "file" else None
            
            # Format last modified time
            last_modified = datetime.fromtimestamp(
                os.path.getmtime(item_path)
            ).isoformat()
            
            files.append(
                ProjectFile(
                    path=rel_path,
                    type=file_type,
                    size=size,
                    last_modified=last_modified
                )
            )
            
        return files
    
    def read_file(self, project_id: str, file_path: str) -> Optional[FileContent]:
        """
        Read file content
        
        Args:
            project_id: Project ID
            file_path: Path to file within project
            
        Returns:
            File content or None if not found
        """
        # Ensure project exists
        project_path = PROJECTS_DIR / project_id
        if not os.path.exists(project_path):
            raise ValueError(f"Project not found: {project_id}")
            
        # Handle path
        clean_path = file_path.lstrip("/")
        target_path = os.path.normpath(os.path.join(project_path, clean_path))
        
        # Ensure the path is within the project
        if not os.path.abspath(target_path).startswith(os.path.abspath(project_path)):
            raise ValueError("Invalid path")
            
        if not os.path.exists(target_path) or not os.path.isfile(target_path):
            return None
            
        with open(target_path, "r") as f:
            content = f.read()
            
        return FileContent(path=file_path, content=content)
    
    def write_file(self, project_id: str, file_path: str, content: str) -> FileContent:
        """
        Write file content
        
        Args:
            project_id: Project ID
            file_path: Path to file within project
            content: File content
            
        Returns:
            Updated file content
        """
        # Ensure project exists
        project_path = PROJECTS_DIR / project_id
        if not os.path.exists(project_path):
            raise ValueError(f"Project not found: {project_id}")
            
        # Handle path
        clean_path = file_path.lstrip("/")
        target_path = os.path.normpath(os.path.join(project_path, clean_path))
        
        # Ensure the path is within the project
        if not os.path.abspath(target_path).startswith(os.path.abspath(project_path)):
            raise ValueError("Invalid path")
            
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(target_path), exist_ok=True)
            
        with open(target_path, "w") as f:
            f.write(content)
            
        return FileContent(path=file_path, content=content)
    
    def delete_file(self, project_id: str, file_path: str) -> bool:
        """
        Delete a file or directory
        
        Args:
            project_id: Project ID
            file_path: Path to file within project
            
        Returns:
            True if successful, False otherwise
        """
        # Ensure project exists
        project_path = PROJECTS_DIR / project_id
        if not os.path.exists(project_path):
            raise ValueError(f"Project not found: {project_id}")
        
        if not file_path or file_path == '/':
            raise ValueError("Invalid file path: Cannot delete root directory")
            
        # Handle path
        clean_path = file_path.lstrip("/")
        if not clean_path:
            raise ValueError("Invalid file path: Path cannot be empty")
            
        target_path = os.path.normpath(os.path.join(project_path, clean_path))
        
        # Ensure the path is within the project
        if not os.path.abspath(target_path).startswith(os.path.abspath(project_path)):
            raise ValueError(f"Invalid path: {file_path} is outside project directory")
            
        if not os.path.exists(target_path):
            return False
            
        try:
            if os.path.isdir(target_path):
                os.rmdir(target_path)  # Will only remove if empty
            else:
                os.remove(target_path)
            return True
        except Exception as e:
            raise ValueError(f"Error deleting file: {str(e)}")
    
    def get_project_context(self, project_id: str) -> Dict[str, Any]:
        """
        Get project context for LLM
        
        Args:
            project_id: Project ID
            
        Returns:
            Project context dict
        """
        project = self.get_project(project_id)
        if not project:
            return {}
            
        # Get project files
        files = self.list_files(project_id)
        
        # Determine project info (language, framework, etc.)
        # based on file extensions and patterns
        info = {
            "name": project.name,
            "language": self._detect_language(project_id, files),
            "framework": self._detect_framework(project_id, files)
        }
        
        return {
            "info": info,
            "files": [{"path": f.path, "type": f.type} for f in files]
        }
    
    def _detect_language(self, project_id: str, files: List[ProjectFile]) -> str:
        """
        Detect the primary language in a project
        """
        # Count file extensions
        extensions = {}
        for file in files:
            if file.type != "file":
                continue
                
            ext = os.path.splitext(file.path)[1].lower()
            if ext:
                extensions[ext] = extensions.get(ext, 0) + 1
                
        # Map extensions to languages
        lang_map = {
            ".py": "Python",
            ".js": "JavaScript",
            ".ts": "TypeScript",
            ".jsx": "JavaScript (React)",
            ".tsx": "TypeScript (React)",
            ".java": "Java",
            ".cpp": "C++",
            ".c": "C",
            ".go": "Go",
            ".rs": "Rust",
            ".rb": "Ruby",
            ".php": "PHP",
            ".cs": "C#"
        }
        
        # Find the most common language
        most_common = None
        max_count = 0
        
        for ext, count in extensions.items():
            if count > max_count and ext in lang_map:
                most_common = lang_map[ext]
                max_count = count
                
        return most_common or "Unknown"
    
    def _detect_framework(self, project_id: str, files: List[ProjectFile]) -> str:
        """
        Detect frameworks used in the project
        """
        project_path = PROJECTS_DIR / project_id
        
        # Check for specific framework files
        framework_files = {
            "package.json": ["react", "angular", "vue", "next", "express"],
            "requirements.txt": ["django", "flask", "fastapi"],
            "Cargo.toml": ["actix", "rocket"],
            "go.mod": ["gin", "echo"],
            "pom.xml": ["spring"],
            "build.gradle": ["spring"]
        }
        
        for filename, frameworks in framework_files.items():
            file_path = os.path.join(project_path, filename)
            if os.path.exists(file_path):
                with open(file_path, "r") as f:
                    content = f.read().lower()
                    
                for framework in frameworks:
                    if framework in content:
                        return framework.capitalize()
                        
        return "Unknown" 