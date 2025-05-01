import { createContext, useContext, useState, useEffect } from 'react';
import { projectsApi } from '../lib/api';

const ProjectContext = createContext();

export function ProjectProvider({ children }) {
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [files, setFiles] = useState([]);
  const [currentFile, setCurrentFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load projects from localStorage on mount
  useEffect(() => {
    const storedProjects = localStorage.getItem('projects');
    if (storedProjects) {
      try {
        setProjects(JSON.parse(storedProjects));
      } catch (e) {
        console.error('Error parsing stored projects:', e);
      }
    }

    const lastProjectId = localStorage.getItem('currentProjectId');
    if (lastProjectId) {
      loadProject(lastProjectId).catch(err => {
        console.error('Failed to load last project:', err);
        // Clear invalid project ID from localStorage
        if (err.response && err.response.status === 404) {
          localStorage.removeItem('currentProjectId');
        }
      });
    }
  }, []);

  // Save projects to localStorage when they change
  useEffect(() => {
    if (projects.length > 0) {
      localStorage.setItem('projects', JSON.stringify(projects));
    }
  }, [projects]);

  // Save current project ID to localStorage
  useEffect(() => {
    if (currentProject) {
      localStorage.setItem('currentProjectId', currentProject.id);
    }
  }, [currentProject]);

  async function createProject(name, metadata = {}) {
    setLoading(true);
    setError(null);
    try {
      const response = await projectsApi.create(name, metadata);
      const newProject = response.data;
      setProjects((prev) => [...prev, newProject]);
      setCurrentProject(newProject);
      await loadFiles(newProject.id);
      return newProject;
    } catch (err) {
      console.error('Error creating project:', err);
      // Check for timeout errors
      if (err.code === 'ECONNABORTED' || err.isTimeout) {
        setError('Project creation timed out. The server might be starting up or under heavy load. Please try again in a moment.');
      } else {
        setError(err.customMessage || err.message || 'Error creating project');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function loadProject(projectId) {
    setLoading(true);
    setError(null);
    try {
      const response = await projectsApi.get(projectId);
      const project = response.data;
      setCurrentProject(project);
      await loadFiles(projectId);
      return project;
    } catch (err) {
      console.error('Error loading project:', err);
      // If project not found (404), clear current project and localStorage
      if (err.response && err.response.status === 404) {
        setCurrentProject(null);
        localStorage.removeItem('currentProjectId');
        setError('Project not found. It may have been deleted.');
      } 
      // Check for timeout errors
      else if (err.code === 'ECONNABORTED' || err.isTimeout) {
        setError('Connection timed out while loading the project. The server might be starting up or under heavy load. Please try again in a moment.');
      } else {
        setError(err.customMessage || err.message || 'Error loading project');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function loadFiles(projectId, path = '/') {
    setLoading(true);
    setError(null);
    try {
      const response = await projectsApi.listFiles(projectId, path);
      
      // Check if response has the expected format
      if (response.data && Array.isArray(response.data.files)) {
        setFiles(response.data.files);
        return response.data.files;
      } else {
        console.error('Unexpected API response format:', response.data);
        setError('Unexpected API response format');
        return [];
      }
    } catch (err) {
      console.error('Error loading files:', err);
      // Check for timeout errors
      if (err.code === 'ECONNABORTED' || err.isTimeout) {
        setError('Connection timed out while loading files. The server might be starting up or under heavy load. Please try again in a moment.');
      } else {
        setError(err.response?.data?.detail || err.customMessage || err.message || 'Error loading files');
      }
      setFiles([]); // Reset files on error
      return [];
    } finally {
      setLoading(false);
    }
  }

  async function loadFile(projectId, filePath) {
    setLoading(true);
    setError(null);
    try {
      const response = await projectsApi.getFile(projectId, filePath);
      const fileContent = response.data;
      setCurrentFile(fileContent);
      return fileContent;
    } catch (err) {
      setError(err.message || 'Error loading file');
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function saveFile(projectId, filePath, content) {
    setLoading(true);
    setError(null);
    try {
      const response = await projectsApi.updateFile(projectId, filePath, content);
      const updatedFile = response.data;
      setCurrentFile(updatedFile);
      // Refresh file list to update file metadata (like last modified)
      await loadFiles(projectId);
      return updatedFile;
    } catch (err) {
      setError(err.message || 'Error saving file');
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function createFile(projectId, filePath, content = '') {
    setLoading(true);
    setError(null);
    try {
      console.log('Creating file:', { projectId, filePath, content: content.slice(0, 50) + (content.length > 50 ? '...' : '') });
      
      // Validate the path - this is an extra precaution
      if (!filePath || !filePath.trim()) {
        throw new Error('File path cannot be empty');
      }
      
      // Ensure path starts with /
      const normalizedPath = filePath.startsWith('/') ? filePath : '/' + filePath;
      
      // Make the API call with detailed logging
      console.log('Sending file operation API call', {
        projectId,
        operation: 'create',
        path: normalizedPath
      });
      
      const response = await projectsApi.fileOperation(projectId, {
        operation: 'create',
        path: normalizedPath,
        content: content || '', // Ensure content is at least an empty string
      });
      
      console.log('File creation response:', response.data);
      
      // Reload the file list
      await loadFiles(projectId);
      return response.data;
    } catch (err) {
      console.error('Error creating file:', err);
      
      // Log more detailed error information
      if (err.response) {
        console.error('API error details:', {
          status: err.response.status,
          statusText: err.response.statusText,
          data: err.response.data,
          headers: err.response.headers
        });
      } else if (err.request) {
        console.error('No response received:', err.request);
      }
      
      // Set a more descriptive error message
      const errorMessage = err.response?.data?.detail || err.message || 'Error creating file';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function deleteFile(projectId, filePath) {
    setLoading(true);
    setError(null);
    try {
      console.log('Deleting file:', { projectId, filePath });
      await projectsApi.deleteFile(projectId, filePath);
      if (currentFile?.path === filePath) {
        setCurrentFile(null);
      }
      await loadFiles(projectId);
      return true;
    } catch (err) {
      console.error('Error deleting file:', err);
      setError(err.response?.data?.detail || err.message || 'Error deleting file');
      return false;
    } finally {
      setLoading(false);
    }
  }

  return (
    <ProjectContext.Provider
      value={{
        projects,
        currentProject,
        files,
        currentFile,
        loading,
        error,
        createProject,
        loadProject,
        loadFiles,
        loadFile,
        saveFile,
        createFile,
        deleteFile,
        setCurrentFile,
        setProjects,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}

export default ProjectContext; 