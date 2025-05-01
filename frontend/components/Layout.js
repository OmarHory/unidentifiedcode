import { useState } from 'react';
import { CodeBracketIcon } from '@heroicons/react/24/solid';
import { useProject } from '../contexts/ProjectContext';
import ProjectSelector from './ProjectSelector';
import CreateProject from './CreateProject';

export default function Layout({ children }) {
  const { currentProject } = useProject();
  const [showCreateProject, setShowCreateProject] = useState(false);

  return (
    <div className="min-h-screen bg-background text-white flex flex-col">
      {/* Header */}
      <header className="bg-background-light border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center">
          <CodeBracketIcon className="h-8 w-8 text-primary mr-2" />
          <h1 className="text-xl font-bold">SpeakCode</h1>
        </div>
        
        <div>
          <ProjectSelector onCreateNewClick={() => setShowCreateProject(true)} />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex">
        {showCreateProject ? (
          <div className="flex-grow flex items-center justify-center">
            <CreateProject
              onProjectCreated={() => setShowCreateProject(false)}
            />
          </div>
        ) : !currentProject ? (
          <div className="flex-grow flex items-center justify-center">
            <div className="text-center p-8">
              <h2 className="text-xl font-semibold mb-4">Welcome to SpeakCode</h2>
              <p className="text-gray-400 mb-6">
                Start by creating a project or selecting an existing one.
              </p>
              <button
                className="btn btn-primary"
                onClick={() => setShowCreateProject(true)}
              >
                Create New Project
              </button>
            </div>
          </div>
        ) : (
          children
        )}
      </main>

      {/* Footer */}
      <footer className="bg-background-light border-t border-gray-700 px-4 py-2 text-xs text-gray-400 text-center">
        SpeakCode - Voice-first, LLM-powered pair-programming experience
      </footer>
    </div>
  );
} 