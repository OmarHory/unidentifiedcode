#!/usr/bin/env python3
"""
WebSocket client for interacting with the chat API
"""
import asyncio
import json
import logging
import uuid
import httpx
from typing import Dict, List, Optional

import websockets

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("websocket_client")


class ChatWebSocketClient:
    """Client for interacting with the chat WebSocket API"""

    def __init__(self, base_url: str = "ws://localhost:8000", http_base_url: str = "http://localhost:8000"):
        """
        Initialize the WebSocket client
        
        Args:
            base_url: Base URL for the WebSocket server
            http_base_url: Base URL for HTTP endpoints (for authentication)
        """
        self.base_url = base_url
        self.http_base_url = http_base_url
        self.websocket = None
        self.session_id = None
        self.token = None

    async def authenticate(self, username: str, password: str) -> str:
        """
        Authenticate with the server and get a JWT token
        
        Args:
            username: Username for authentication
            password: Password for authentication
            
        Returns:
            JWT token
        """
        auth_url = f"{self.http_base_url}/api/auth/token"
        
        async with httpx.AsyncClient() as client:
            try:
                # Send as JSON with the expected format
                response = await client.post(
                    auth_url,
                    json={"username": username, "password": password}
                )
                
                response.raise_for_status()  # Raise exception for 4XX/5XX responses
                
                data = response.json()
                # The response structure is different from what we expected
                # The token is in the 'token' field, not 'access_token'
                self.token = data.get("token")
                if not self.token:
                    logger.error(f"Token not found in response: {data}")
                    raise RuntimeError("Token not found in authentication response")
                    
                logger.info(f"Authentication successful, token received")
                return self.token
            
            except httpx.HTTPStatusError as e:
                try:
                    error_detail = e.response.json().get("detail", str(e))
                except:
                    error_detail = str(e)
                    
                logger.error(f"Authentication failed: {e.response.status_code} - {error_detail}")
                raise RuntimeError(f"Authentication failed: {error_detail}")
            except Exception as e:
                logger.error(f"Error during authentication: {str(e)}")
                raise

    async def connect(self, session_id: str):
        """
        Connect to the WebSocket server
        
        Args:
            session_id: Chat session ID
        """
        self.session_id = session_id
        ws_url = f"{self.base_url}/ws/{session_id}"
        
        # Prepare headers with authentication if token is available
        headers = {}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
            logger.info(f"Using token for authentication: {self.token[:10]}...")
        else:
            logger.warning("No authentication token available")
        
        logger.info(f"Connecting to WebSocket at {ws_url}")
        try:
            self.websocket = await websockets.connect(ws_url, extra_headers=headers)
            logger.info(f"Connected to WebSocket for session {session_id}")
            return self.websocket
        except Exception as e:
            logger.error(f"WebSocket connection failed: {str(e)}")
            # Print the full URL and headers for debugging
            logger.error(f"Connection details - URL: {ws_url}, Headers: {headers}")
            raise

    async def send_message(
        self, content: str, project_id: Optional[str] = None
    ) -> str:
        """
        Send a message to the chat server
        
        Args:
            content: Message content
            project_id: Optional project ID for context
            
        Returns:
            Message ID
        """
        if self.websocket is None:
            raise RuntimeError("Not connected to WebSocket server")

        message_id = str(uuid.uuid4())
        message_data = {
            "id": message_id,
            "message": {
                "role": "user",  # Using string value instead of enum reference
                "content": content,
            },
        }

        # Add project_id if provided
        if project_id:
            message_data["project_id"] = project_id
            
        # Log the exact message being sent for debugging
        logger.info(f"Sending message data: {json.dumps(message_data)}")

        await self.websocket.send(json.dumps(message_data))
        logger.info(f"Sent message: {message_id}")
        return message_id

    async def receive_stream(self) -> str:
        """
        Receive and process the streaming response
        
        Returns:
            Complete response content
        """
        if self.websocket is None:
            raise RuntimeError("Not connected to WebSocket server")

        full_content = ""
        message_id = None
        
        # Process incoming messages until stream_end is received
        try:
            while True:
                try:
                    response = await self.websocket.recv()
                    data = json.loads(response)
                    
                    if data["type"] == "stream_start":
                        message_id = data["message"]["id"]
                        logger.info(f"Stream started with message ID: {message_id}")
                    
                    elif data["type"] == "stream_chunk":
                        chunk = data["chunk"]
                        full_content += chunk
                        logger.debug(f"Received chunk: {len(chunk)} chars")
                        # Print chunk for interactive display
                        print(chunk, end="", flush=True)
                    
                    elif data["type"] == "stream_end":
                        logger.info("Stream complete")
                        print()  # Add newline after streaming
                        break
                    
                    elif data["type"] == "error":
                        error_msg = data.get("error", "Unknown error")
                        logger.error(f"Error from server: {error_msg}")
                        raise RuntimeError(f"Server error: {error_msg}")
                
                except json.JSONDecodeError as e:
                    logger.error(f"Invalid JSON received: {str(e)}")
                    if isinstance(response, str) and response.strip():
                        logger.error(f"Raw response: {response[:100]}")
                    break
                except websockets.exceptions.ConnectionClosed as e:
                    logger.error(f"WebSocket connection closed unexpectedly: {str(e)}")
                    logger.info(f"Connection close code: {e.code}, reason: {e.reason}")
                    # If we have some content, return it, otherwise re-raise
                    if full_content:
                        logger.warning("Connection closed but returning partial content")
                        break
                    raise
                except Exception as e:
                    logger.error(f"Error processing response: {str(e)}")
                    raise
        except Exception as e:
            logger.error(f"Error in receive_stream: {str(e)}")
            raise
        
        return full_content

    async def close(self):
        """Close the WebSocket connection"""
        if self.websocket:
            await self.websocket.close()
            logger.info(f"Closed WebSocket connection for session {self.session_id}")
            self.websocket = None


async def demo():
    """Demo function to show usage of the client"""
    # Create a new session ID or use an existing one
    session_id = str(uuid.uuid4())
    
    client = ChatWebSocketClient()
    
    # Authenticate first
    await client.authenticate("username", "password")
    
    # Connect with the token
    await client.connect(session_id)
    
    try:
        # Send a message and get the streaming response
        await client.send_message("Hello, can you help me with Python programming?")
        response = await client.receive_stream()
        
        # Send a follow-up message
        await client.send_message("How do I create a FastAPI application?")
        response = await client.receive_stream()
    
    finally:
        # Always close the connection when done
        await client.close()


if __name__ == "__main__":
    asyncio.run(demo())
