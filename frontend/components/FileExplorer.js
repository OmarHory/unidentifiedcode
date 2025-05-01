import { useState } from 'react';
import { FolderIcon, DocumentTextIcon, PlusIcon, CheckIcon, XMarkIcon, BugAntIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

export default function FileExplorer({ projectId, files, onSelectFile, onCreateFile }) {
  const [newFileName, setNewFileName] = useState('');
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState({'/': true});
  const [debugMode, setDebugMode] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  
  // Group files by directory
  const fileTree = {};
  
  // Sort files and directories
  if (files && files.length > 0) {
    // Add all directories first
    files.forEach(file => {
      if (file.type === 'directory') {
        fileTree[file.path] = { ...file, children: [] };
      }
    });
    
    // Ensure root directory exists
    if (!fileTree['/']) {
      fileTree['/'] = { path: '/', type: 'directory', children: [] };
    }
    
    // Add files to their parent directories
    files.forEach(file => {
      if (file.type === 'file') {
        const pathParts = file.path.split('/');
        const fileName = pathParts.pop();
        const parentPath = pathParts.length === 0 ? '/' : pathParts.join('/');
        
        if (fileTree[parentPath]) {
          fileTree[parentPath].children.push(file);
        } else {
          // If parent directory doesn't exist in our structure, add to root
          fileTree['/'].children.push(file);
        }
      }
    });
  }
  
  const toggleFolder = (path) => {
    setExpandedFolders(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };
  
  const handleCreateFile = () => {
    setIsCreatingFile(true);
    // Make sure root folder is expanded
    setExpandedFolders(prev => ({
      ...prev,
      '/': true
    }));
  };
  
  const submitNewFile = () => {
    if (!newFileName.trim()) {
      toast.error('File name cannot be empty');
      return;
    }
    
    // Basic file name validation
    const fileName = newFileName.trim();
    if (!fileName.includes('.')) {
      toast.error('Please include a file extension (e.g., .js, .py, .html)');
      return;
    }
    
    // Prevent invalid characters in filenames
    const invalidChars = /[<>:"|?*\s]/;
    if (invalidChars.test(fileName)) {
      toast.error('File name contains invalid characters');
      return;
    }
    
    // Call the parent component's function to create the file
    try {
      const filePath = fileName.startsWith('/') ? fileName : '/' + fileName;
      console.log('Creating file with path:', filePath);
      // Show loading toast
      const toastId = toast.loading(`Creating ${fileName}...`);
      
      // Call onCreateFile and handle completion
      onCreateFile(filePath)
        .then(() => {
          toast.success(`File created: ${fileName}`, { id: toastId });
          setNewFileName('');
          setIsCreatingFile(false);
        })
        .catch((error) => {
          console.error('Error in file creation:', error);
          toast.error(`Failed to create file: ${error.message || 'Unknown error'}`, { id: toastId });
        });
    } catch (error) {
      console.error('Error creating file:', error);
      toast.error(`Failed to create file: ${error.message || 'Unknown error'}`);
    }
  };
  
  const debugCreateFile = () => {
    const debugFilename = `debug-${Date.now()}.js`;
    console.log('Debug creating file:', debugFilename);
    toast.loading(`Debug creating ${debugFilename}...`);
    
    try {
      onCreateFile('/' + debugFilename);
      toast.success(`Debug file created: ${debugFilename}`);
    } catch (error) {
      console.error('Debug file creation error:', error);
      toast.error(`Debug error: ${error.message}`);
    } finally {
      toast.dismiss();
    }
  };
  
  const cancelCreateFile = () => {
    setNewFileName('');
    setIsCreatingFile(false);
  };
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      submitNewFile();
    } else if (e.key === 'Escape') {
      cancelCreateFile();
    }
  };

  const handleFileSelect = (file) => {
    setSelectedFile(file.path);
    onSelectFile(file.path);
  };
  
  const renderFileTree = (path = '/') => {
    const folder = fileTree[path];
    if (!folder) return null;
    
    return (
      <div key={path} className={path === '/' ? '' : 'ml-3'}>
        {path !== '/' && (
          <div 
            className="flex items-center py-1.5 px-2 hover:bg-background-lighter/30 rounded cursor-pointer group transition-colors"
            onClick={() => toggleFolder(path)}
          >
            {expandedFolders[path] ? (
              <ChevronDownIcon className="h-3.5 w-3.5 text-gray-400 mr-1" />
            ) : (
              <ChevronRightIcon className="h-3.5 w-3.5 text-gray-400 mr-1" />
            )}
            <FolderIcon className="h-4 w-4 text-yellow-500 mr-1.5" />
            <span className="truncate text-sm group-hover:text-gray-100">{path.split('/').pop()}</span>
          </div>
        )}
        
        <AnimatePresence>
          {expandedFolders[path] && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className={path === '/' ? '' : 'ml-2.5 mt-1 border-l border-background-lighter/30 pl-2'}
            >
              {folder.children && folder.children.sort((a, b) => {
                // Sort directories first, then files alphabetically
                if (a.type === 'directory' && b.type !== 'directory') return -1;
                if (a.type !== 'directory' && b.type === 'directory') return 1;
                return a.path.localeCompare(b.path);
              }).map((file) => (
                file.type === 'directory' ? (
                  renderFileTree(file.path)
                ) : (
                  <motion.div 
                    key={file.path}
                    whileHover={{ x: 2 }}
                    className={`flex items-center py-1.5 px-2 rounded cursor-pointer group transition-all ${
                      selectedFile === file.path ? 'bg-primary/10 text-primary-light' : 'hover:bg-background-lighter/20'
                    }`}
                    onClick={() => handleFileSelect(file)}
                  >
                    <DocumentTextIcon className={`h-4 w-4 mr-1.5 ${
                      selectedFile === file.path ? 'text-primary-light' : 'text-gray-400 group-hover:text-gray-300'
                    }`} />
                    <span className={`truncate text-sm ${
                      selectedFile === file.path ? 'text-primary-light' : 'group-hover:text-gray-100'
                    }`}>
                      {file.path.split('/').pop()}
                    </span>
                  </motion.div>
                )
              ))}
              
              {path === '/' && isCreatingFile && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 pl-2"
                >
                  <div className="flex items-center">
                    <DocumentTextIcon className="h-4 w-4 text-primary mr-1.5" />
                    <input
                      type="text"
                      className="bg-background border border-background-lighter rounded px-2 py-1 text-sm flex-1 focus:outline-none focus:ring-1 focus:ring-primary/50"
                      placeholder="filename.js"
                      value={newFileName}
                      onChange={(e) => setNewFileName(e.target.value)}
                      onKeyDown={handleKeyPress}
                      autoFocus
                    />
                  </div>
                  <div className="flex justify-end mt-1 space-x-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="p-1 bg-success rounded text-white shadow-sm"
                      onClick={() => submitNewFile()}
                      title="Create file"
                    >
                      <CheckIcon className="h-3.5 w-3.5" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="p-1 bg-accent rounded text-white shadow-sm"
                      onClick={cancelCreateFile}
                      title="Cancel"
                    >
                      <XMarkIcon className="h-3.5 w-3.5" />
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };
  
  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium gradient-text">Files</h2>
        <div className="flex">
          {debugMode && (
            <motion.button
              whileHover={{ scale: 1.1, rotate: 10 }}
              whileTap={{ scale: 0.9 }}
              className="p-1.5 rounded-full hover:bg-yellow-600/20 text-yellow-500 hover:text-yellow-400 mr-2 transition-colors"
              onClick={debugCreateFile}
              title="Debug create file"
            >
              <BugAntIcon className="h-5 w-5" />
            </motion.button>
          )}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="p-1.5 rounded-full hover:bg-primary/20 text-primary hover:text-primary-light transition-colors"
            onClick={handleCreateFile}
            title="Create new file"
          >
            <PlusIcon className="h-5 w-5" />
          </motion.button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto pr-1">
        {files && files.length > 0 ? (
          renderFileTree()
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8 text-gray-400 flex flex-col items-center"
          >
            <div className="h-16 w-16 bg-background-lighter/20 rounded-full flex items-center justify-center mb-4 animate-pulse-slow">
              <DocumentTextIcon className="h-8 w-8 text-gray-500" />
            </div>
            <p>No files yet</p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="mt-4 px-4 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-md text-primary-light transition-colors shadow-sm hover:shadow-md"
              onClick={handleCreateFile}
            >
              Create a file
            </motion.button>
            {debugMode && (
              <div className="mt-6">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-3 py-1 bg-yellow-900/40 border border-yellow-700/50 rounded-md text-yellow-500"
                  onClick={debugCreateFile}
                >
                  Debug Create File
                </motion.button>
              </div>
            )}
          </motion.div>
        )}
      </div>
      
      {/* Debug toggle button */}
      <div className="mt-4 text-right">
        <button
          className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
          onClick={() => setDebugMode(!debugMode)}
        >
          {debugMode ? "Disable Debug" : "Enable Debug"}
        </button>
      </div>
    </div>
  );
} 