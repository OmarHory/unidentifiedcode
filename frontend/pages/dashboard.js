import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { CodeBracketIcon, PlusIcon, FolderIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import Layout from '../components/Layout';
import { useProject } from '../contexts/ProjectContext';
import toast from 'react-hot-toast';
import ProtectedRoute from '../components/ProtectedRoute';

export default function ProtectedDashboard() {
  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  );
}

function Dashboard() {
  const router = useRouter();
  const { projects, createProject, loadProject, setProjects } = useProject();
  const [isCreating, setIsCreating] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [selectedTech, setSelectedTech] = useState([]);
  const [loadingProject, setLoadingProject] = useState(false);

  const technologies = [
    { id: 'python', name: 'Python', icon: '🐍' },
    { id: 'javascript', name: 'JavaScript', icon: '📜' },
    { id: 'typescript', name: 'TypeScript', icon: '🔷' },
    { id: 'react', name: 'React', icon: '⚛️' },
    { id: 'vue', name: 'Vue.js', icon: '🟢' },
    { id: 'angular', name: 'Angular', icon: '🔺' },
    { id: 'node', name: 'Node.js', icon: '🟩' },
    { id: 'fastapi', name: 'FastAPI', icon: '⚡' },
    { id: 'django', name: 'Django', icon: '🦄' },
    { id: 'flask', name: 'Flask', icon: '🧪' },
    { id: 'golang', name: 'Go', icon: '🔹' },
    { id: 'java', name: 'Java', icon: '☕' },
    { id: 'csharp', name: 'C#', icon: '🔷' },
    { id: 'cpp', name: 'C++', icon: '🔴' },
    { id: 'ruby', name: 'Ruby', icon: '💎' },
    { id: 'php', name: 'PHP', icon: '🐘' },
  ];

  const toggleTech = (techId) => {
    if (selectedTech.includes(techId)) {
      setSelectedTech(selectedTech.filter(id => id !== techId));
    } else {
      setSelectedTech([...selectedTech, techId]);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    
    if (!projectName.trim()) {
      toast.error('Please enter a project name');
      return;
    }
    
    try {
      setLoadingProject(true);
      
      // Prepare metadata
      const metadata = {
        technologies: selectedTech,
        created_at: new Date().toISOString()
      };
      
      console.log('Creating project:', { name: projectName, metadata });
      
      // Try to create the project
      const newProject = await createProject(projectName, metadata);
      
      toast.success(`Project "${newProject.name}" created successfully`);
      setIsCreating(false);
      setProjectName('');
      setSelectedTech([]);
      
      // Redirect to the editor
      router.push(`/editor/${newProject.id}`);
    } catch (err) {
      console.error('Project creation error:', err);
      
      // Provide more specific error messages based on error type
      if (err.code === 'ECONNREFUSED' || err.message.includes('Network Error')) {
        toast.error('Network error: Could not connect to the server. Please check your connection.');
      } else if (err.response && err.response.status === 400) {
        toast.error(`Bad request: ${err.response.data.detail || 'Invalid project data'}`);
      } else if (err.response && err.response.status === 500) {
        toast.error('Server error: The server encountered an error. Please try again later.');
      } else {
        toast.error(`Error creating project: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setLoadingProject(false);
    }
  };

  const handleOpenProject = async (projectId) => {
    try {
      setLoadingProject(true);
      await loadProject(projectId);
      router.push(`/editor/${projectId}`);
    } catch (err) {
      console.error('Failed to open project:', err);
      // Show more specific error message based on the error type
      if (err.response && err.response.status === 404) {
        toast.error(`Project not found. It may have been deleted.`);
        // Remove this project from the list if it no longer exists
        setProjects(prevProjects => prevProjects.filter(p => p.id !== projectId));
      } else {
        toast.error(`Error opening project: ${err.message || 'Unknown error'}`);
      }
      setLoadingProject(false);
    }
  };

  return (
    <>
      <Head>
        <title>Dashboard - SpeakCode</title>
        <meta name="description" content="Manage your coding projects" />
      </Head>

      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="bg-background-light border-b border-gray-700 px-6 py-4">
          <div className="container mx-auto max-w-6xl">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <CodeBracketIcon className="h-8 w-8 text-primary mr-2" />
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
                  SpeakCode
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="container mx-auto max-w-6xl py-10 px-6">
          <div className="flex justify-between items-center mb-10">
            <h1 className="text-3xl font-bold">Your Projects</h1>
            <button 
              className="btn btn-primary flex items-center"
              onClick={() => setIsCreating(true)}
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              New Project
            </button>
          </div>

          {isCreating ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-background-light rounded-lg border border-gray-700 p-6 mb-10"
            >
              <h2 className="text-xl font-semibold mb-6">Create New Project</h2>
              <form onSubmit={handleCreateProject}>
                <div className="mb-6">
                  <label htmlFor="projectName" className="block text-sm font-medium mb-2">
                    Project Name
                  </label>
                  <input
                    type="text"
                    id="projectName"
                    className="input w-full"
                    placeholder="My Awesome Project"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                  />
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2">
                    Technologies Used
                    <span className="text-gray-400 ml-2 text-xs">(Select all that apply)</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {technologies.map((tech) => (
                      <div
                        key={tech.id}
                        className={`cursor-pointer rounded-md p-3 border transition-colors ${
                          selectedTech.includes(tech.id)
                            ? 'border-primary bg-primary/10'
                            : 'border-gray-700 hover:border-gray-600'
                        }`}
                        onClick={() => toggleTech(tech.id)}
                      >
                        <div className="flex items-center">
                          <span className="text-xl mr-2">{tech.icon}</span>
                          <span>{tech.name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => {
                      setIsCreating(false);
                      setProjectName('');
                      setSelectedTech([]);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loadingProject || !projectName.trim()}
                  >
                    {loadingProject ? 'Creating...' : 'Create Project'}
                  </button>
                </div>
              </form>
            </motion.div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.length === 0 ? (
              <div className="col-span-full py-20 text-center">
                <div className="text-gray-400 mb-4">
                  <FolderIcon className="h-12 w-12 mx-auto mb-4 opacity-40" />
                  <p className="text-lg">No projects yet</p>
                  <p className="mt-2">Create your first project to get started</p>
                </div>
                <button 
                  className="btn btn-primary mt-4"
                  onClick={() => setIsCreating(true)}
                >
                  Create Project
                </button>
              </div>
            ) : (
              projects.map((project) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -5, transition: { duration: 0.2 } }}
                  className="bg-background-light rounded-lg border border-gray-700 hover:border-gray-600 overflow-hidden transition-colors"
                >
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center">
                        <FolderIcon className="h-6 w-6 text-primary mr-2" />
                        <h3 className="text-lg font-medium">{project.name}</h3>
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(project.created_at || new Date()).toLocaleDateString()}
                      </span>
                    </div>
                    
                    {project.metadata?.technologies && project.metadata.technologies.length > 0 && (
                      <div className="mb-4">
                        <div className="flex flex-wrap gap-2">
                          {project.metadata.technologies.map(techId => {
                            const tech = technologies.find(t => t.id === techId);
                            if (!tech) return null;
                            return (
                              <span 
                                key={techId} 
                                className="bg-background px-2 py-1 rounded-md text-xs text-gray-300"
                              >
                                {tech.icon} {tech.name}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    <button
                      className="w-full mt-2 flex justify-center items-center py-2 rounded-md bg-background hover:bg-background-light border border-gray-700 transition-colors"
                      onClick={() => handleOpenProject(project.id)}
                      disabled={loadingProject}
                    >
                      <span className="mr-1">Open</span>
                      <ChevronRightIcon className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </main>
      </div>
    </>
  );
} 