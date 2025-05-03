#!/usr/bin/env python3
"""
Resilient WebSocket client for the chat API with better error handling and debugging
"""
import asyncio
import json
import logging
import uuid
import sys
import os
import httpx
from typing import Dict, List, Optional, Any

import websockets
from websockets.exceptions import ConnectionClosed

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,  # Set to DEBUG for more detailed logs
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("resilient_client")

class ResilientWebSocketClient:
    """A more resilient WebSocket client for the chat API"""
    
    def __init__(self, base_url: str = "ws://localhost:8000/api/chat", http_base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.http_base_url = http_base_url
        self.websocket = None
        self.session_id = None
        self.token = None
        self.reconnect_attempts = 3
        self.reconnect_delay = 1  # seconds
    
    async def authenticate(self, username: str, password: str) -> str:
        """Authenticate with the server and get a JWT token"""
        auth_url = f"{self.http_base_url}/api/auth/token"
        
        async with httpx.AsyncClient() as client:
            try:
                logger.info(f"Authenticating with username: {username}")
                response = await client.post(
                    auth_url,
                    json={"username": username, "password": password}
                )
                
                response.raise_for_status()
                data = response.json()
                
                # Extract token from response
                self.token = data.get("token")
                if not self.token:
                    logger.error(f"Token not found in response: {data}")
                    raise RuntimeError("Token not found in authentication response")
                
                logger.info(f"Authentication successful, token received: {self.token[:10]}...")
                return self.token
            
            except Exception as e:
                logger.error(f"Authentication failed: {str(e)}")
                raise
    
    async def connect(self, session_id: Optional[str] = None) -> str:
        """Connect to the WebSocket server"""
        # Generate a session ID if not provided
        if not session_id:
            session_id = str(uuid.uuid4())
            logger.info(f"Generated new session ID: {session_id}")
        
        self.session_id = session_id
        ws_url = f"{self.base_url}/ws/{session_id}"
        
        # Prepare headers with authentication
        headers = {}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
            logger.info(f"Using token for authentication: {self.token[:10]}...")
        
        # Try to connect with retries
        for attempt in range(1, self.reconnect_attempts + 1):
            try:
                logger.info(f"Connecting to WebSocket at {ws_url} (attempt {attempt}/{self.reconnect_attempts})")
                self.websocket = await websockets.connect(ws_url, extra_headers=headers)
                logger.info(f"Connected to WebSocket for session {session_id}")
                return session_id
            
            except Exception as e:
                logger.error(f"Connection attempt {attempt} failed: {str(e)}")
                if attempt < self.reconnect_attempts:
                    wait_time = self.reconnect_delay * attempt
                    logger.info(f"Retrying in {wait_time} seconds...")
                    await asyncio.sleep(wait_time)
                else:
                    logger.error("All connection attempts failed")
                    raise
        
        raise RuntimeError("Failed to connect to WebSocket server")
    
    async def send_message(self, content: str, project_id: Optional[str] = None) -> str:
        """Send a message to the chat server"""
        if self.websocket is None:
            raise RuntimeError("Not connected to WebSocket server")
        
        message_id = str(uuid.uuid4())
        
        # Construct message with exact format expected by server
        message_data = {
            "id": message_id,
            "message": {
                "role": "user",
                "content": content,
            }
        }
        
        # Add project_id if provided
        if project_id:
            message_data["project_id"] = project_id
        
        # Log the exact message being sent
        message_json = json.dumps(message_data)
        logger.debug(f"Sending message data: {message_json}")
        
        try:
            await self.websocket.send(message_json)
            logger.info(f"Message sent successfully with ID: {message_id}")
            return message_id
        except Exception as e:
            logger.error(f"Error sending message: {str(e)}")
            raise
    
    async def receive_messages(self, timeout: float = 30.0) -> str:
        """Receive and process messages with timeout"""
        if self.websocket is None:
            raise RuntimeError("Not connected to WebSocket server")
        
        full_content = ""
        start_time = asyncio.get_event_loop().time()
        
        try:
            while True:
                # Check if we've exceeded the timeout
                elapsed = asyncio.get_event_loop().time() - start_time
                if elapsed > timeout:
                    logger.warning(f"Receive timeout after {elapsed:.2f} seconds")
                    break
                
                # Set a timeout for the receive operation
                try:
                    response = await asyncio.wait_for(
                        self.websocket.recv(), 
                        timeout=min(5.0, timeout - elapsed)
                    )
                    
                    # Try to parse as JSON
                    try:
                        data = json.loads(response)
                        logger.debug(f"Received data: {data}")
                        
                        if data.get("type") == "stream_start":
                            logger.info(f"Stream started with message ID: {data['message']['id']}")
                        
                        elif data.get("type") == "stream_chunk":
                            chunk = data.get("chunk", "")
                            full_content += chunk
                            print(chunk, end="", flush=True)
                        
                        elif data.get("type") == "stream_end":
                            logger.info("Stream complete")
                            print()  # Add newline
                            break
                        
                        elif data.get("type") == "error":
                            error_msg = data.get("error", "Unknown error")
                            logger.error(f"Error from server: {error_msg}")
                            raise RuntimeError(f"Server error: {error_msg}")
                        
                        else:
                            logger.warning(f"Unknown message type: {data.get('type')}")
                    
                    except json.JSONDecodeError:
                        logger.warning(f"Received non-JSON data: {response[:100]}")
                
                except asyncio.TimeoutError:
                    logger.warning("Timeout waiting for server response")
                    if full_content:
                        logger.info("Returning partial content due to timeout")
                        break
                    continue
                
                except ConnectionClosed as e:
                    logger.warning(f"WebSocket connection closed: {e}")
                    if full_content:
                        logger.info("Connection closed but returning partial content")
                        break
                    raise
        
        except Exception as e:
            logger.error(f"Error in receive_messages: {str(e)}")
            if not full_content:
                raise
        
        return full_content
    
    async def close(self):
        """Close the WebSocket connection"""
        if self.websocket:
            try:
                await self.websocket.close()
                logger.info(f"Closed WebSocket connection for session {self.session_id}")
            except Exception as e:
                logger.error(f"Error closing WebSocket: {str(e)}")
            finally:
                self.websocket = None

async def main():
    """Main function to demonstrate the client usage"""
    client = ResilientWebSocketClient()
    
    try:
        # Authenticate
        print("Authenticating...")
        await client.authenticate("test", "test")
        
        # Connect to WebSocket
        print("Connecting to WebSocket...")
        session_id = await client.connect()
        print(f"Connected with session ID: {session_id}")
        
        # Send a message
        message = "Hello, can you help me with Python programming?"
        print(f"\nSending message: {message}")
        await client.send_message(message)
        
        # Receive response with timeout
        print("\nWaiting for response:")
        try:
            response = await client.receive_messages(timeout=10.0)
            if response:
                print(f"\nReceived response ({len(response)} chars)")
            else:
                print("\nNo response received within timeout")
        except Exception as e:
            print(f"\nError receiving response: {str(e)}")
        
        # Try a follow-up message
        try:
            print("\nSending follow-up message...")
            await client.send_message("Can you explain Python decorators?")
            
            print("\nWaiting for response:")
            response = await client.receive_messages(timeout=10.0)
            if response:
                print(f"\nReceived response ({len(response)} chars)")
            else:
                print("\nNo response received within timeout")
        except Exception as e:
            print(f"\nError with follow-up message: {str(e)}")
    
    except Exception as e:
        print(f"Error: {str(e)}")
    
    finally:
        # Always close the connection
        await client.close()
        print("Session ended")

if __name__ == "__main__":
    asyncio.run(main())
