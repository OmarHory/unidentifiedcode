import asyncio
import sys
import os
import getpass
import time

# Add the parent directory to sys.path to allow importing the websocket_client module
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from client.websocket_client import ChatWebSocketClient

async def main():
    # Make sure the server is running on this URL
    client = ChatWebSocketClient(
        base_url="ws://localhost:8000/api/chat",  # Updated path to include /api/chat
        http_base_url="http://localhost:8000"
    )
    session_id = "f182a08b-5652-4403-86a9-afbb89f1c1f3"
    
    print(f"Connecting to WebSocket with session ID: {session_id}")
    
    try:
        # First authenticate to get a token
        print("Authentication required")
        username = "test"
        password = "test"
        
        try:
            await client.authenticate(username, password)
            print("Authentication successful!")
        except Exception as auth_error:
            print(f"Authentication failed: {str(auth_error)}")
            return
        
        # Now connect with the token
        await client.connect(session_id)
        
        # Add a small delay to ensure the connection is fully established
        print("Connection established, waiting briefly before sending message...")
        await asyncio.sleep(1)
        
        message = "Hello, can you help me with Python programming?"
        print(f"Sending message: {message}")
        await client.send_message(message)
        
        try:
            response = await client.receive_stream()
            print(f"Full response received, length: {len(response)}")
        except Exception as stream_error:
            print(f"Error receiving stream: {str(stream_error)}")
    except Exception as e:
        print(f"Error: {str(e)}")
    finally:
        if client.websocket:
            await client.close()
            print("Connection closed")

if __name__ == "__main__":
    asyncio.run(main())