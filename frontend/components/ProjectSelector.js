import { useState } from 'react';
import { useProject } from '../contexts/ProjectContext';
import { FolderIcon, PlusIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function ProjectSelector({ onCreateNewClick }) {
  const { projects, currentProject, loadProject, loading } = useProject();
  const [isOpen, setIsOpen] = useState(false);

  const handleProjectSelect = async (projectId) => {
    setIsOpen(false);
    try {
      await loadProject(projectId);
    } catch (err) {
      toast.error(`Error loading project: ${err.message}`);
    }
  };

  return (
    <div className="relative">
      <button
        className="btn btn-outline flex items-center"
        onClick={() => setIsOpen(!isOpen)}
      >
        <FolderIcon className="h-5 w-5 mr-2" />
        <span className="truncate max-w-[200px]">
          {currentProject ? currentProject.name : 'Select Project'}
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-60 bg-background-light rounded-md shadow-lg overflow-hidden z-10">
          <div className="py-1">
            {projects.length === 0 ? (
              <div className="px-4 py-2 text-sm text-gray-400">
                No projects available
              </div>
            ) : (
              projects.map((project) => (
                <button
                  key={project.id}
                  className={`px-4 py-2 text-sm w-full text-left hover:bg-background ${
                    currentProject?.id === project.id ? 'bg-background' : ''
                  }`}
                  onClick={() => handleProjectSelect(project.id)}
                  disabled={loading}
                >
                  {project.name}
                </button>
              ))
            )}
            <div className="border-t border-gray-700 mt-1 pt-1">
              <button
                className="px-4 py-2 text-sm w-full text-left text-primary hover:bg-background flex items-center"
                onClick={() => {
                  setIsOpen(false);
                  onCreateNewClick();
                }}
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Create New Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 