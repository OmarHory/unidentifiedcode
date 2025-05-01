import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { ArrowUpCircleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function CodeEditor({ projectId, filePath, content, onSave }) {
  const [value, setValue] = useState(content || '');
  const [language, setLanguage] = useState('javascript');
  const [isModified, setIsModified] = useState(false);
  
  useEffect(() => {
    setValue(content || '');
    setIsModified(false);
    
    // Detect language from file extension
    if (filePath) {
      const extension = filePath.split('.').pop().toLowerCase();
      switch (extension) {
        case 'js':
          setLanguage('javascript');
          break;
        case 'py':
          setLanguage('python');
          break;
        case 'html':
          setLanguage('html');
          break;
        case 'css':
          setLanguage('css');
          break;
        case 'json':
          setLanguage('json');
          break;
        case 'md':
          setLanguage('markdown');
          break;
        case 'ts':
          setLanguage('typescript');
          break;
        case 'jsx':
          setLanguage('javascript');
          break;
        case 'tsx':
          setLanguage('typescript');
          break;
        default:
          setLanguage('plaintext');
      }
    }
  }, [filePath, content]);
  
  const handleChange = (newValue) => {
    setValue(newValue);
    setIsModified(newValue !== content);
  };
  
  const handleSave = async () => {
    if (!isModified) return;
    
    try {
      await onSave(filePath, value);
      setIsModified(false);
      toast.success('File saved');
    } catch (err) {
      toast.error(`Error saving file: ${err.message}`);
    }
  };
  
  const handleKeyDown = (e) => {
    // Save on Ctrl+S or Cmd+S
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  };
  
  return (
    <div className="h-full flex flex-col" onKeyDown={handleKeyDown}>
      {filePath ? (
        <>
          <div className="bg-background-light px-4 py-2 border-b border-gray-700 flex justify-between items-center">
            <div className="flex items-center">
              <span className="text-sm text-gray-400">{filePath}</span>
              {isModified && <span className="ml-2 text-xs text-yellow-500">(modified)</span>}
            </div>
            <button
              className={`p-1 rounded ${
                isModified 
                  ? 'text-white bg-primary hover:bg-primary/80' 
                  : 'text-gray-500 bg-gray-700 cursor-not-allowed'
              }`}
              onClick={handleSave}
              disabled={!isModified}
              title="Save file"
            >
              <ArrowUpCircleIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1">
            <Editor
              value={value}
              language={language}
              theme="vs-dark"
              onChange={handleChange}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: 'on',
              }}
            />
          </div>
        </>
      ) : (
        <div className="h-full flex items-center justify-center text-gray-400">
          <p>Select a file to edit or create a new one</p>
        </div>
      )}
    </div>
  );
} 