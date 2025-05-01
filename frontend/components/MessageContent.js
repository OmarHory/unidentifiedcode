import { useState, useEffect } from 'react';
import { extractCodeBlocks, extractTextSegments } from '../utils/codeParser';
import CodeSuggestion from './CodeSuggestion';
import { useProject } from '../contexts/ProjectContext';
import toast from 'react-hot-toast';

export default function MessageContent({ message }) {
  const [segments, setSegments] = useState([]);
  const [codeBlocks, setCodeBlocks] = useState([]);
  const { currentProject, currentFile, createFile, loadFile, saveFile } = useProject();
  
  useEffect(() => {
    if (!message || !message.content) {
      setSegments([]);
      setCodeBlocks([]);
      return;
    }
    
    // Parse message content
    const extractedSegments = extractTextSegments(message.content);
    const extractedCodeBlocks = extractCodeBlocks(message.content);
    
    setSegments(extractedSegments);
    setCodeBlocks(extractedCodeBlocks);
  }, [message]);
  
  // Handle accepting a code suggestion
  const handleAcceptCode = async (code, filePath) => {
    if (!currentProject) {
      toast.error('No project selected');
      return;
    }
    
    try {
      // If no explicit file path and there's a current file open, use that file
      if (!filePath && currentFile) {
        filePath = currentFile.path;
      }
      
      if (filePath) {
        // Clean the file path (remove any leading /)
        const cleanPath = filePath.replace(/^\/+/, '');
        
        // Check if file exists
        try {
          await loadFile(currentProject.id, cleanPath);
          // If file exists, update it
          await saveFile(currentProject.id, cleanPath, code);
          toast.success(`Updated file: ${cleanPath}`);
        } catch (err) {
          // File doesn't exist, create it
          await createFile(currentProject.id, cleanPath, code);
          toast.success(`Created file: ${cleanPath}`);
        }
      } else {
        // No file path specified and no current file, copy to clipboard
        await navigator.clipboard.writeText(code);
        toast.success('Code copied to clipboard (no file specified)');
      }
    } catch (err) {
      console.error('Error handling code:', err);
      toast.error('Failed to apply code: ' + (err.message || 'Unknown error'));
    }
  };
  
  // Handle rejecting a code suggestion
  const handleRejectCode = () => {
    toast.success('Code suggestion rejected');
  };
  
  // If message is from user, just show the content
  if (message.role === 'user') {
    return <div className="whitespace-pre-wrap">{message.content}</div>;
  }
  
  // Render message with code blocks
  return (
    <div>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return (
            <div key={index} className="whitespace-pre-wrap mb-3">
              {segment.content}
            </div>
          );
        } else if (segment.type === 'codeBlock') {
          // Find the corresponding code block
          const blockIndex = segments.slice(0, index)
            .filter(s => s.type === 'codeBlock')
            .length;
            
          const codeBlock = codeBlocks[blockIndex];
          
          if (!codeBlock) return null;
          
          // If we have a current file open and no file path specified,
          // pass the current file path as a hint
          const suggestedPath = codeBlock.filePath || 
            (currentFile ? currentFile.path : null);
          
          return (
            <CodeSuggestion
              key={index}
              code={codeBlock.code}
              language={codeBlock.language}
              filePath={suggestedPath}
              onAccept={handleAcceptCode}
              onReject={handleRejectCode}
            />
          );
        }
        
        return null;
      })}
    </div>
  );
} 