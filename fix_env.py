#!/usr/bin/env python3
"""
Script to fix the SpeakCode .env file
"""
import os
import re

# Path to .env file
env_file = os.path.join('backend', '.env')

# Read the current content
with open(env_file, 'r') as f:
    content = f.read()

# Fix 1: Update the LLM model
content = re.sub(r'LLM_MODEL=gpt-4.1', 'LLM_MODEL=gpt-3.5-turbo', content)

# Fix 2: Fix any line breaks in the API key
lines = content.split('\n')
for i, line in enumerate(lines):
    if line.startswith('OPENAI_API_KEY='):
        # Take this line and the next line if it's a continuation of the API key
        if i + 1 < len(lines) and not lines[i + 1].startswith('#') and not '=' in lines[i + 1]:
            api_key = line + lines[i + 1].strip()
            lines[i] = api_key
            lines[i + 1] = ''  # Clear the continuation line

# Join back and write to file
fixed_content = '\n'.join([line for line in lines if line != ''])
with open(env_file, 'w') as f:
    f.write(fixed_content)

print("✅ .env file has been fixed:")
print("  - LLM model updated to gpt-3.5-turbo")
print("  - Fixed any line breaks in API keys")
print("\nPlease make sure you have a valid OpenAI API key in backend/.env")
print("Visit https://platform.openai.com to get your API key.") 