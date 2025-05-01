#!/bin/bash

# Change to the frontend directory
cd frontend

# Install dependencies if they don't exist
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Run the Next.js development server
echo "Starting frontend..."
npm run dev 