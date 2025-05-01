import { createContext, useContext, useState } from 'react';
import { diffApi } from '../lib/api';
import { useProject } from './ProjectContext';

const DiffContext = createContext();

export function DiffProvider({ children }) {
  const [currentDiff, setCurrentDiff] = useState(null);
  const [diffAnalysis, setDiffAnalysis] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const { currentProject, currentFile, saveFile } = useProject();

  async function generateDiff(originalContent, modifiedContent, filePath) {
    if (!currentProject || !filePath) {
      setError('Project or file path not specified');
      return null;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await diffApi.generate(
        currentProject.id, 
        filePath, 
        modifiedContent
      );
      
      const diff = response.data;
      setCurrentDiff(diff);
      return diff;
    } catch (err) {
      setError(err.message || 'Error generating diff');
      throw err;
    } finally {
      setIsGenerating(false);
    }
  }

  async function analyzeDiff(originalContent, modifiedContent, filePath) {
    if (!currentProject || !filePath) {
      setError('Project or file path not specified');
      return null;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await diffApi.analyze(
        currentProject.id,
        filePath,
        originalContent,
        modifiedContent
      );
      
      const analysis = response.data;
      setDiffAnalysis(analysis);
      return analysis;
    } catch (err) {
      setError(err.message || 'Error analyzing diff');
      throw err;
    } finally {
      setIsGenerating(false);
    }
  }

  async function applyDiff(diffOperations, filePath) {
    if (!currentProject || !filePath) {
      setError('Project or file path not specified');
      return null;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await diffApi.apply(
        currentProject.id,
        filePath,
        diffOperations
      );
      
      // Update the current file with the modified content
      if (currentFile && currentFile.path === filePath) {
        await saveFile(currentProject.id, filePath, response.data.content);
      }
      
      // Clear the current diff
      setCurrentDiff(null);
      setDiffAnalysis(null);
      
      return response.data;
    } catch (err) {
      setError(err.message || 'Error applying diff');
      throw err;
    } finally {
      setIsGenerating(false);
    }
  }

  async function parseDiffText(diffText) {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await diffApi.parse(diffText);
      
      if (response.data.success) {
        setCurrentDiff(response.data.operations);
        return response.data.operations;
      } else {
        setError('Failed to parse diff: ' + response.data.errors.join(', '));
        return null;
      }
    } catch (err) {
      setError(err.message || 'Error parsing diff');
      throw err;
    } finally {
      setIsGenerating(false);
    }
  }

  function clearDiff() {
    setCurrentDiff(null);
    setDiffAnalysis(null);
  }

  return (
    <DiffContext.Provider
      value={{
        currentDiff,
        diffAnalysis,
        isGenerating,
        error,
        generateDiff,
        analyzeDiff,
        applyDiff,
        parseDiffText,
        clearDiff,
      }}
    >
      {children}
    </DiffContext.Provider>
  );
}

export function useDiff() {
  const context = useContext(DiffContext);
  if (!context) {
    throw new Error('useDiff must be used within a DiffProvider');
  }
  return context;
}

export default DiffContext; 