/**
 * Extracts code blocks from markdown text
 * @param {string} text - The markdown text containing code blocks
 * @returns {Array} Array of objects with language and code content
 */
export function extractCodeBlocks(text) {
  if (!text) return [];
  
  // Regular expression to match markdown code blocks
  // Captures:
  // 1. The language (optional)
  // 2. The file path (optional, in various formats)
  // 3. The code content
  const codeBlockRegex = /```(?:([\w-]+)(?:[:\s]+(.+?))?)?([^`]+?)```/gs;
  
  const codeBlocks = [];
  let match;
  
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const language = match[1] || 'plaintext';
    let filePath = match[2] || null;
    const code = match[3].trim();
    
    // Further process file path if it exists
    if (filePath) {
      // Check for line number patterns like "12:15:filename.js"
      const lineNumberPattern = /^(\d+):(\d+):(.*)/;
      const lineMatch = filePath.match(lineNumberPattern);
      
      if (lineMatch) {
        // Extract just the filename part
        filePath = lineMatch[3];
      }
      
      // If it doesn't have a file extension, it's probably not a file path
      if (!/\.\w+$/.test(filePath)) {
        filePath = null;
      }
    }
    
    codeBlocks.push({
      language,
      filePath,
      code,
    });
  }
  
  return codeBlocks;
}

/**
 * Extracts content before, between, and after code blocks
 * @param {string} text - The markdown text
 * @returns {Array} Array of text segments (alternating between text and code block placeholders)
 */
export function extractTextSegments(text) {
  if (!text) return [];
  
  const codeBlockRegex = /```(?:[\w-]+(?:[:\s]+.+?)?)?[^`]+?```/gs;
  const segments = [];
  
  let lastIndex = 0;
  let match;
  
  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Add text before this code block
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.substring(lastIndex, match.index)
      });
    }
    
    // Add code block as a placeholder
    segments.push({
      type: 'codeBlock',
      content: match[0]
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.substring(lastIndex)
    });
  }
  
  return segments;
}

/**
 * Gets the target file path from a code block if available
 * @param {string} language - The language extracted from the code block
 * @param {string} filePath - The file path extracted from the code block
 * @returns {string|null} The target file path or null
 */
export function getTargetFilePath(language, filePath) {
  if (!filePath) return null;
  
  // Remove line numbers if present (e.g., 12:15:app/components/Todo.tsx)
  const lineNumberPattern = /^\d+:\d+:/;
  return filePath.replace(lineNumberPattern, '');
} 