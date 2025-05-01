import { useState } from 'react';
import { useProject } from '../contexts/ProjectContext';
import toast from 'react-hot-toast';

export default function CreateProject({ onProjectCreated }) {
  const [projectName, setProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const { createProject } = useProject();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!projectName.trim()) {
      toast.error('Please enter a project name');
      return;
    }
    
    setIsCreating(true);
    try {
      const newProject = await createProject(projectName);
      setProjectName('');
      toast.success(`Project "${newProject.name}" created successfully`);
      if (onProjectCreated) {
        onProjectCreated(newProject);
      }
    } catch (err) {
      toast.error(`Error creating project: ${err.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-md w-full mx-auto p-6 bg-background-light rounded-lg shadow-lg">
      <h2 className="text-xl font-semibold mb-4 text-center">Create a New Project</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="projectName" className="block text-sm font-medium mb-1">
            Project Name
          </label>
          <input
            type="text"
            id="projectName"
            className="input w-full"
            placeholder="My Awesome Project"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            disabled={isCreating}
          />
        </div>
        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={isCreating}
        >
          {isCreating ? 'Creating...' : 'Create Project'}
        </button>
      </form>
    </div>
  );
} 