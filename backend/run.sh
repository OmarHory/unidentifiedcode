#!/bin/bash

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    echo "Activating virtual environment..."
    source venv/bin/activate
else
    echo "Creating virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    
    echo "Installing dependencies..."
    pip install -r requirements.txt
fi

# Run the FastAPI application with 1 worker
# This is critical for WebSocket functionality to work correctly
echo "Starting FastAPI app with 1 worker..."
export PYTHONPATH=$(pwd):$PYTHONPATH
python main.py 