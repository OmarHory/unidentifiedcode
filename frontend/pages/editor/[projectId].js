import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useProject } from '../../contexts/ProjectContext';
import Head from 'next/head';
import toast from 'react-hot-toast';
import ChatInterface from '../../components/ChatInterface';
import FileExplorer from '../../components/FileExplorer';
import CodeEditor from '../../components/CodeEditor';
import { motion } from 'framer-motion';

export default function EditorPage() {
  const router = useRouter();
  const { projectId } = router.query;
  const { 
    currentProject, 
    loading, 
    error, 
    loadProject,
    files,
    loadFiles,
    loadFile,
    currentFile,
    saveFile,
    createFile
  } = useProject();
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedFilePath, setSelectedFilePath] = useState(null);
  const [fileContent, setFileContent] = useState('');

  useEffect(() => {
    // Only run this effect when projectId is available and not yet initialized
    if (!projectId || isInitialized) return;

    const loadCurrentProject = async () => {
      try {
        await loadProject(projectId);
        // Removed success toast to reduce notification noise
        setIsInitialized(true);
      } catch (err) {
        console.error('Error loading project:', err);
        if (err.response && err.response.status === 404) {
          toast.error('Project not found. It may have been deleted.');
          // Redirect to dashboard after a short delay
          setTimeout(() => router.push('/dashboard'), 2000);
        } else {
          toast.error(`Error loading project: ${err.message || 'Unknown error'}`);
        }
      }
    };

    loadCurrentProject();
  }, [projectId, isInitialized]); // Remove loadProject and router from dependencies

  useEffect(() => {
    if (currentFile) {
      setSelectedFilePath(currentFile.path);
      setFileContent(currentFile.content);
    }
  }, [currentFile]);

  const handleSelectFile = async (filePath) => {
    try {
      await loadFile(projectId, filePath);
    } catch (err) {
      toast.error(`Error loading file: ${err.message}`);
    }
  };

  const handleCreateFile = async (filePath) => {
    let toastId;
    try {
      // Show a loading toast
      toastId = toast.loading('Creating file...');
      console.log(`Creating file ${filePath} for project ${projectId}`);
      
      // Create the file
      const initialContent = '// New file created in SpeakCode';
      await createFile(projectId, filePath, initialContent);
      
      // Reload the file list
      await loadFiles(projectId);
      
      // Show success message
      toast.success(`File ${filePath} created successfully`, { id: toastId });
      
      // Load the newly created file
      await handleSelectFile(filePath);
    } catch (err) {
      console.error('Error creating file:', err);
      // Show detailed error message
      toast.error(`Error creating file: ${err.message || 'Unknown error'}`, { id: toastId });
      
      // Log more details for debugging
      if (err.response) {
        console.error('API error response:', {
          status: err.response.status,
          data: err.response.data
        });
      }
      throw err; // Re-throw to allow the caller to handle
    }
  };

  const handleSaveFile = async (filePath, content) => {
    try {
      await saveFile(projectId, filePath, content);
    } catch (err) {
      throw err; // Let the editor component handle the error
    }
  };

  const handleCodeSuggestion = (code) => {
    if (!selectedFilePath) {
      toast.error('No file selected to apply code. Please select or create a file first.');
      return;
    }
    
    // Apply the suggested code to the current file
    handleSaveFile(selectedFilePath, code.content)
      .then(() => toast.success('Code applied successfully'))
      .catch(err => toast.error(`Error applying code: ${err.message}`));
  };

  if (loading && !isInitialized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ 
              duration: 1.5, 
              repeat: Infinity, 
              ease: "linear" 
            }}
            className="w-16 h-16 border-t-2 border-r-2 border-primary rounded-full mx-auto mb-6"
          />
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="text-gray-300 text-lg"
          >
            Loading your project...
          </motion.p>
          <motion.div
            className="mt-4 max-w-sm mx-auto h-2 bg-background-lighter rounded-full overflow-hidden"
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ 
                duration: 2,
                repeat: Infinity, 
                ease: "easeInOut",
              }}
              className="h-full bg-gradient-to-r from-primary to-secondary animate-pulse"
            />
          </motion.div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center glassmorphism p-8 rounded-xl max-w-md"
        >
          <div className="text-accent text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-semibold mb-4 gradient-text">Something went wrong</h2>
          <p className="text-red-400 mb-6">{error}</p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push('/dashboard')}
            className="btn btn-primary"
          >
            Return to Dashboard
          </motion.button>
        </motion.div>
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center glassmorphism p-8 rounded-xl max-w-md"
        >
          <div className="text-warning text-5xl mb-4">🔍</div>
          <h2 className="text-2xl font-semibold mb-4">Project Not Found</h2>
          <p className="text-gray-300 mb-6">The project could not be loaded or might have been deleted.</p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push('/dashboard')}
            className="btn btn-primary"
          >
            Return to Dashboard
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{currentProject.name} - SpeakCode</title>
        <meta name="description" content={`Editing project ${currentProject.name}`} />
      </Head>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="min-h-screen bg-background flex flex-col"
      >
        {/* Editor header */}
        <header className="bg-background-light/70 backdrop-blur-sm border-b border-background-lighter/50 px-4 py-3 shadow-md z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <motion.button
                whileHover={{ scale: 1.05, x: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push('/dashboard')}
                className="px-3 py-1 text-gray-400 hover:text-white flex items-center space-x-1 hover:bg-background-lighter/30 rounded-md transition-all"
              >
                <span>←</span>
                <span>Dashboard</span>
              </motion.button>
              <div className="h-6 w-[1px] bg-gray-700"></div>
              <motion.h1 
                className="text-xl font-semibold gradient-text"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                {currentProject.name}
              </motion.h1>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex -space-x-1">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm shadow-glow">AI</div>
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-white text-sm">SC</div>
              </div>
              <div className="text-xs px-2 py-1 bg-success/20 text-success rounded-full border border-success/20">
                Active
              </div>
            </div>
          </div>
        </header>

        {/* Editor content */}
        <div className="flex-1 flex">
          {/* File Explorer */}
          <motion.div 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="w-72 border-r border-background-lighter/20 bg-background-light/30 backdrop-blur-sm shadow-xl z-10"
          >
            <div className="h-full p-4">
              <FileExplorer 
                projectId={projectId}
                files={files} 
                onSelectFile={handleSelectFile}
                onCreateFile={handleCreateFile}
              />
            </div>
          </motion.div>

          {/* Code Editor */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="flex-1 bg-editor"
          >
            <CodeEditor 
              projectId={projectId}
              filePath={selectedFilePath}
              content={fileContent}
              onSave={handleSaveFile}
            />
          </motion.div>

          {/* Chat Interface */}
          <motion.div 
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="w-96 bg-background-light/30 backdrop-blur-sm border-l border-background-lighter/20 shadow-xl z-10"
          >
            <ChatInterface 
              projectId={projectId}
              onCodeSuggestion={handleCodeSuggestion}
            />
          </motion.div>
        </div>
      </motion.div>
    </>
  );
} 