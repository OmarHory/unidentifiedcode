#!/bin/bash

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python -m venv venv
fi

# Activate virtual environment (using full path to ensure proper activation)
echo "Activating virtual environment..."
source "$(pwd)/venv/bin/activate"

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Create projects directory if it doesn't exist
mkdir -p projects

# Run the application
echo "Starting SpeakCode API server..."
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 