import { useState } from 'react';
import { CheckIcon, XMarkIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { useProject } from '../contexts/ProjectContext';

export default function CodeSuggestion({ 
  code, 
  language, 
  filePath, 
  onAccept, 
  onReject 
}) {
  const { currentProject, currentFile, createFile } = useProject();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  
  // Handle creating a new file or updating an existing one
  const handleAccept = async () => {
    if (!filePath) {
      // If no file path is specified, just pass the code
      onAccept(code);
      return;
    }
    
    if (currentProject) {
      try {
        // This could be a new file or an existing file
        await onAccept(code, filePath);
      } catch (err) {
        console.error('Error accepting code:', err);
      }
    }
  };
  
  return (
    <div 
      className="border border-gray-700 rounded-md overflow-hidden bg-background mb-3"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header with file info and actions */}
      <div className="flex items-center justify-between bg-background-light px-3 py-2 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <DocumentTextIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-mono truncate">
            {filePath || `Code (${language})`}
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-gray-700"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </button>
        </div>
      </div>
      
      {/* Code content */}
      {isExpanded && (
        <div className="relative">
          <pre className="p-3 overflow-x-auto text-sm font-mono text-gray-200">
            <code>{code}</code>
          </pre>
          
          {/* Accept/Reject buttons fixed at bottom */}
          <div className="absolute bottom-0 left-0 right-0 bg-background-light border-t border-gray-700 p-2 flex justify-end space-x-3">
            <button
              className="flex items-center space-x-1 px-3 py-1 rounded-md bg-green-600 hover:bg-green-700 text-white text-sm"
              onClick={handleAccept}
              title="Apply this code"
            >
              <CheckIcon className="h-4 w-4" />
              <span>Apply</span>
            </button>
            
            <button
              className="flex items-center space-x-1 px-3 py-1 rounded-md bg-red-600 hover:bg-red-700 text-white text-sm"
              onClick={onReject}
              title="Reject this code"
            >
              <XMarkIcon className="h-4 w-4" />
              <span>Reject</span>
            </button>
          </div>
          
          {/* Extra padding to ensure code doesn't get cut off by buttons */}
          <div className="h-10"></div>
        </div>
      )}
    </div>
  );
} 