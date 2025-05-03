import asyncio
import websockets

async def connect_to_websocket():
    uri = "ws://localhost:8000/ws/test-session"  # Adjust the host/port as needed

    async with websockets.connect(uri) as websocket:
        print("Connected to WebSocket server")

        try:
            while True:
                message = await websocket.recv()
                print("Received:", message)
        except websockets.exceptions.ConnectionClosed:
            print("WebSocket connection closed")

if __name__ == "__main__":
    asyncio.run(connect_to_websocket())
