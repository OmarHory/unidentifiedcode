#!/bin/bash

# Test the connection between frontend and backend
echo "Testing connection between frontend and backend..."

# Check if the backend is running
echo "Checking if backend is running..."
BACKEND_HEALTH=$(curl -s http://localhost:8000/api/health || echo "failed")

if [[ $BACKEND_HEALTH == *"ok"* ]]; then
    echo "✅ Backend is running correctly"
else
    echo "❌ Backend is not running or not responding. Please start it with ./start-backend.sh"
    exit 1
fi

# Check if the frontend is running
echo "Checking if frontend is running..."
FRONTEND_HEALTH=$(curl -s http://localhost:3000 || echo "failed")

if [[ $FRONTEND_HEALTH == "failed" ]]; then
    echo "❌ Frontend is not running or not responding. Please start it with ./start-frontend.sh"
    exit 1
else
    echo "✅ Frontend is running correctly"
fi

# Test WebSocket connectivity using wscat if it's installed
echo "Testing WebSocket connectivity..."
if command -v wscat &> /dev/null; then
    echo "Using wscat to test WebSocket connections..."
    
    # Testing chat WebSocket
    echo "Testing chat WebSocket connection..."
    RANDOM_SESSION="test_$(date +%s)"
    CHAT_WS_TEST=$(wscat -c "ws://localhost:8000/api/chat/ws/$RANDOM_SESSION" --connect -t 3000 || echo "failed")
    
    if [[ $CHAT_WS_TEST == "failed" ]]; then
        echo "❌ Chat WebSocket connection failed. There may be issues with the WebSocket server."
    else
        echo "✅ Chat WebSocket connection successful"
    fi
    
    # Testing ASR WebSocket
    echo "Testing ASR WebSocket connection..."
    ASR_WS_TEST=$(wscat -c "ws://localhost:8000/api/voice/stream" --connect -t 3000 || echo "failed")
    
    if [[ $ASR_WS_TEST == "failed" ]]; then
        echo "❌ ASR WebSocket connection failed. There may be issues with the WebSocket server."
    else
        echo "✅ ASR WebSocket connection successful"
    fi
else
    echo "wscat is not installed. Install it with 'npm install -g wscat' to test WebSocket connections."
    echo "NOTE: This is a basic check and doesn't verify actual WebSocket connections"
    echo "Check browser console for WebSocket connection logs when using the application"
fi

echo "✅ Connection test completed"
echo "If you're still experiencing WebSocket connection errors, check:"
echo "  1. Both backend and frontend are running with a single worker (--workers 1)"
echo "  2. Browser console for specific error messages"
echo "  3. Network tab in browser dev tools for failed WebSocket connection attempts"
echo "  4. Backend logs for any errors related to WebSocket connections"
echo "  5. CORS settings in the backend configuration" 