#!/bin/bash

# Script to fix the .env file for the SpeakCode project

# Fix the line break in the OpenAI API key
sed -i '' 's/sk-proj--.*tP/sk-proj--YOURKEY/g' backend/.env

# Echo a message to manually update with a valid API key
echo "Please update the OpenAI API key in backend/.env with a valid key."

# Update the LLM model to a valid one
sed -i '' 's/LLM_MODEL=gpt-4.1/LLM_MODEL=gpt-3.5-turbo/g' backend/.env

echo "LLM model updated to gpt-3.5-turbo."
echo ""
echo "Important: You need to manually add a valid OpenAI API key to backend/.env"
echo "Visit https://platform.openai.com to get your API key." 