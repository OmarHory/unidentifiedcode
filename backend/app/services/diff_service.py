import difflib
from typing import List, Dict, Any, Tuple
import re

class DiffService:
    def generate_diff(self, original: str, modified: str, context_lines: int = 3) -> List[Dict[str, Any]]:
        """
        Generate a structured diff between original and modified text
        
        Args:
            original: Original text
            modified: Modified text
            context_lines: Number of context lines to include
            
        Returns:
            List of diff operations
        """
        # Split into lines
        original_lines = original.splitlines()
        modified_lines = modified.splitlines()
        
        # Generate unified diff
        diff = difflib.unified_diff(
            original_lines, 
            modified_lines,
            n=context_lines,
            lineterm=''
        )
        
        # Parse the diff into structured operations
        operations = []
        current_hunk = None
        
        for line in diff:
            # Skip the header lines
            if line.startswith('---') or line.startswith('+++'):
                continue
                
            # Handle hunk headers
            if line.startswith('@@'):
                # Extract line numbers from hunk header
                match = re.match(r'^@@ -(\d+),(\d+) \+(\d+),(\d+) @@', line)
                if match:
                    orig_start, orig_count, mod_start, mod_count = map(int, match.groups())
                    current_hunk = {
                        'type': 'hunk',
                        'orig_start': orig_start,
                        'orig_count': orig_count,
                        'mod_start': mod_start,
                        'mod_count': mod_count,
                        'lines': []
                    }
                    operations.append(current_hunk)
                continue
                
            # Handle diff content lines
            if current_hunk is not None:
                if line.startswith('-'):
                    current_hunk['lines'].append({
                        'type': 'delete',
                        'content': line[1:]
                    })
                elif line.startswith('+'):
                    current_hunk['lines'].append({
                        'type': 'add',
                        'content': line[1:]
                    })
                elif line.startswith(' '):
                    current_hunk['lines'].append({
                        'type': 'context',
                        'content': line[1:]
                    })
                    
        return operations
        
    def apply_diff(self, original: str, operations: List[Dict[str, Any]]) -> str:
        """
        Apply diff operations to original text
        
        Args:
            original: Original text content
            operations: List of diff operations
            
        Returns:
            Modified text with diff applied
        """
        original_lines = original.splitlines()
        result_lines = original_lines.copy()
        
        # Track offset as we add/remove lines
        line_offset = 0
        
        for hunk in operations:
            if hunk['type'] != 'hunk':
                continue
                
            orig_start = hunk['orig_start'] - 1  # 0-indexed
            
            # Apply the changes for this hunk
            deletions = 0
            additions = []
            
            for line in hunk['lines']:
                if line['type'] == 'delete':
                    deletions += 1
                elif line['type'] == 'add':
                    additions.append(line['content'])
                # Context lines are ignored as they're already in the original
            
            # Adjust for line offset
            adjusted_start = orig_start + line_offset
            
            # Remove deleted lines
            if deletions > 0:
                del result_lines[adjusted_start:adjusted_start + deletions]
                
            # Add new lines
            if additions:
                result_lines[adjusted_start:adjusted_start] = additions
                
            # Update line offset
            line_offset += len(additions) - deletions
            
        return '\n'.join(result_lines)
        
    def parse_diff_from_text(self, diff_text: str) -> Tuple[List[Dict[str, Any]], List[str]]:
        """
        Parse a textual diff into structured operations
        
        Args:
            diff_text: Diff text in unified diff format
            
        Returns:
            Tuple of (operations, errors)
        """
        operations = []
        errors = []
        current_hunk = None
        
        try:
            for line in diff_text.splitlines():
                # Skip the header lines
                if line.startswith('---') or line.startswith('+++'):
                    continue
                    
                # Handle hunk headers
                if line.startswith('@@'):
                    # Extract line numbers from hunk header
                    match = re.match(r'^@@ -(\d+),(\d+) \+(\d+),(\d+) @@', line)
                    if match:
                        orig_start, orig_count, mod_start, mod_count = map(int, match.groups())
                        current_hunk = {
                            'type': 'hunk',
                            'orig_start': orig_start,
                            'orig_count': orig_count,
                            'mod_start': mod_start,
                            'mod_count': mod_count,
                            'lines': []
                        }
                        operations.append(current_hunk)
                    else:
                        errors.append(f"Invalid hunk header: {line}")
                    continue
                    
                # Handle diff content lines
                if current_hunk is not None:
                    if line.startswith('-'):
                        current_hunk['lines'].append({
                            'type': 'delete',
                            'content': line[1:]
                        })
                    elif line.startswith('+'):
                        current_hunk['lines'].append({
                            'type': 'add',
                            'content': line[1:]
                        })
                    elif line.startswith(' '):
                        current_hunk['lines'].append({
                            'type': 'context',
                            'content': line[1:]
                        })
        except Exception as e:
            errors.append(f"Error parsing diff: {str(e)}")
            
        if not operations and not errors:
            errors.append("No valid diff operations found")
            
        return operations, errors 