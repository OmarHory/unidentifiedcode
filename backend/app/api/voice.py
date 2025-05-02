from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Body, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel
import base64
from typing import Optional, Dict, Any, List
import uuid
import json
import asyncio
import io
import time
from openai import OpenAIError
import websockets

from app.models.chat import VoiceTranscriptionRequest, VoiceTranscriptionResponse
from app.services.voice_service import VoiceService, voice_service
from app.core.logger import logger
from app.core.config import settings

router = APIRouter()

# Initialize services
voice_service = VoiceService()

# Store active ASR sessions
asr_sessions = {}

# WebSocket session configuration
WEBSOCKET_IDLE_TIMEOUT = 60  # seconds
MAX_SESSION_DURATION = 300  # 5 minutes
SESSION_CLEANUP_INTERVAL = 60  # 1 minute

class TextToSpeechRequest(BaseModel):
    text: str
    voice_id: Optional[str] = None

class ElevenLabsTextToSpeechRequest(BaseModel):
    text: str
    voice: Optional[str] = None  # Voice ID, defaults to config

class TextToSpeechResponse(BaseModel):
    audio_data: str

class StreamChunkRequest(BaseModel):
    session_id: str
    audio_chunk: str  # Base64 encoded audio

class PhoneCallRequest(BaseModel):
    project_id: str

class PhoneCallResponse(BaseModel):
    call_id: str
    status: str
    project_id: str
    timestamp: str

@router.post("/transcribe", response_model=VoiceTranscriptionResponse)
async def transcribe_audio(audio_file: UploadFile = File(...)):
    """
    Transcribe an audio file to text using OpenAI Whisper
    """
    try:
        # Read audio file content
        audio_data = await audio_file.read()
        
        # Convert to base64
        audio_base64 = base64.b64encode(audio_data).decode("utf-8")
        
        # Transcribe using the voice service
        result = await voice_service.transcribe_audio(audio_base64)
        
        return VoiceTranscriptionResponse(
            text=result["text"],
            confidence=result["confidence"]
        )
    except OpenAIError as e:
        logger.error(f"OpenAI API error during transcription: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"OpenAI service error: {str(e)}"
        )
    except ValueError as e:
        logger.error(f"Value error during transcription: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid input: {str(e)}"
        )
    except Exception as e:
        logger.exception(f"Unexpected error during transcription: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error transcribing audio: {str(e)}"
        )

@router.post("/transcribe-base64", response_model=VoiceTranscriptionResponse)
async def transcribe_audio_base64(request: VoiceTranscriptionRequest):
    """
    Transcribe base64 encoded audio to text using OpenAI Whisper
    """
    try:
        # Transcribe using the voice service
        result = await voice_service.transcribe_audio(request.audio_file)
        
        return VoiceTranscriptionResponse(
            text=result["text"],
            confidence=result["confidence"]
        )
    except OpenAIError as e:
        logger.error(f"OpenAI API error during base64 transcription: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"OpenAI service error: {str(e)}"
        )
    except ValueError as e:
        logger.error(f"Value error during base64 transcription: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid input: {str(e)}"
        )
    except Exception as e:
        logger.exception(f"Unexpected error during base64 transcription: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error transcribing audio: {str(e)}"
        )

@router.post("/text-to-speech", response_model=TextToSpeechResponse)
async def convert_text_to_speech(request: TextToSpeechRequest):
    """
    Convert text to speech using OpenAI TTS
    """
    try:
        # Convert text to speech using the voice service
        audio_data = await voice_service.text_to_speech(
            request.text,
            request.voice_id
        )
        
        return TextToSpeechResponse(audio_data=audio_data)
    except OpenAIError as e:
        logger.error(f"OpenAI API error during text-to-speech conversion: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"OpenAI service error: {str(e)}"
        )
    except ValueError as e:
        logger.error(f"Value error during text-to-speech conversion: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid input: {str(e)}"
        )
    except Exception as e:
        logger.exception(f"Unexpected error during text-to-speech conversion: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error converting text to speech: {str(e)}"
        )

@router.post("/elevenlabs/transcribe", response_model=VoiceTranscriptionResponse)
async def elevenlabs_transcribe_audio(audio_file: UploadFile = File(...)):
    """
    Transcribe an audio file to text using ElevenLabs ASR
    """
    try:
        # Read audio file content
        audio_data = await audio_file.read()
        
        # Convert to base64
        audio_base64 = base64.b64encode(audio_data).decode("utf-8")
        
        # Transcribe using ElevenLabs
        result = await voice_service.elevenlabs_transcribe(audio_base64)
        
        return VoiceTranscriptionResponse(
            text=result["text"],
            confidence=result["confidence"]
        )
    except ValueError as e:
        logger.error(f"Value error during ElevenLabs transcription: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid input: {str(e)}"
        )
    except Exception as e:
        logger.exception(f"Unexpected error during ElevenLabs transcription: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error transcribing audio with ElevenLabs: {str(e)}"
        )

@router.post("/elevenlabs/stream-chunk", response_model=VoiceTranscriptionResponse)
async def stream_audio_chunk(
    session_id: str = Form(...),
    audio_chunk: UploadFile = File(...)
):
    """
    Process a streaming audio chunk using ElevenLabs ASR
    """
    try:
        # Read audio chunk content
        audio_data = await audio_chunk.read()
        
        # Convert to base64
        audio_base64 = base64.b64encode(audio_data).decode("utf-8")
        
        # Transcribe using ElevenLabs
        result = await voice_service.elevenlabs_transcribe(audio_base64)
        
        return VoiceTranscriptionResponse(
            text=result["text"],
            confidence=result["confidence"]
        )
    except ValueError as e:
        logger.error(f"Value error during ElevenLabs chunk processing: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid input: {str(e)}"
        )
    except Exception as e:
        logger.exception(f"Unexpected error during ElevenLabs chunk processing: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing audio chunk: {str(e)}"
        )

@router.post("/elevenlabs/text-to-speech", response_model=TextToSpeechResponse)
async def elevenlabs_text_to_speech(request: ElevenLabsTextToSpeechRequest):
    """
    Convert text to speech using ElevenLabs TTS
    """
    try:
        # Convert text to speech using ElevenLabs
        audio_data = await voice_service.elevenlabs_text_to_speech(
            request.text,
            request.voice
        )
        
        return TextToSpeechResponse(audio_data=audio_data)
    except ValueError as e:
        logger.error(f"Value error during ElevenLabs text-to-speech: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid input: {str(e)}"
        )
    except Exception as e:
        logger.exception(f"Unexpected error during ElevenLabs text-to-speech: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error converting text to speech with ElevenLabs: {str(e)}"
        )

@router.post("/phone-call/start", response_model=PhoneCallResponse)
async def start_phone_call(request: PhoneCallRequest):
    """
    Start a phone call with the LLM
    """
    try:
        result = await voice_service.start_phone_call(request.project_id)
        return PhoneCallResponse(**result)
    except ValueError as e:
        logger.error(f"Value error starting phone call: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid input: {str(e)}"
        )
    except Exception as e:
        logger.exception(f"Unexpected error starting phone call: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error starting phone call: {str(e)}"
        )

@router.post("/phone-call/end/{call_id}", response_model=Dict[str, Any])
async def end_phone_call(call_id: str):
    """
    End a phone call with the LLM
    """
    try:
        result = await voice_service.end_phone_call(call_id)
        return result
    except ValueError as e:
        logger.error(f"Value error ending phone call: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid input: {str(e)}"
        )
    except Exception as e:
        logger.exception(f"Unexpected error ending phone call: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error ending phone call: {str(e)}"
        )

@router.websocket("/asr/stream")
async def stream_asr(websocket: WebSocket):
    """
    WebSocket endpoint for streaming ASR using ElevenLabs
    """
    await websocket.accept()
    logger.info("WebSocket connection accepted for ElevenLabs ASR streaming")
    
    # Check if ElevenLabs API key is configured
    if not settings.ELEVENLABS_API_KEY:
        await websocket.send_json({
            "error": "ElevenLabs API key is not configured",
            "is_final": True
        })
        await websocket.close()
        return
    
    # Connect to ElevenLabs ASR WebSocket
    try:
        # ElevenLabs ASR WebSocket URL
        elevenlabs_ws_url = "wss://api.elevenlabs.io/v1/speech-to-text/stream"
        
        # Set up headers with API key
        headers = {
            "xi-api-key": settings.ELEVENLABS_API_KEY
        }
        
        logger.info(f"Connecting to ElevenLabs ASR WebSocket at {elevenlabs_ws_url}")
        
        # Create WebSocket connection to ElevenLabs
        async with websockets.connect(
            elevenlabs_ws_url,
            extra_headers=headers
        ) as elevenlabs_ws:
            logger.info("Connected to ElevenLabs ASR WebSocket")
            
            # Send success message to client
            await websocket.send_json({
                "status": "connected",
                "message": "Connected to ElevenLabs ASR service"
            })
            
            # Create tasks for handling bidirectional communication
            async def forward_to_elevenlabs():
                """Forward audio chunks from client to ElevenLabs"""
                try:
                    while True:
                        # Receive audio chunk from client
                        message = await websocket.receive_json()
                        
                        if "audio_chunk" in message:
                            # Create the ElevenLabs compatible message
                            elevenlabs_message = {
                                "audio": message["audio_chunk"],
                                "type": "audio_data"
                            }
                            
                            # Forward to ElevenLabs
                            await elevenlabs_ws.send(json.dumps(elevenlabs_message))
                except Exception as e:
                    logger.error(f"Error forwarding to ElevenLabs: {str(e)}")
            
            async def forward_to_client():
                """Forward transcription results from ElevenLabs to client"""
                try:
                    while True:
                        # Receive result from ElevenLabs
                        result = await elevenlabs_ws.recv()
                        logger.debug(f"Received from ElevenLabs: {result[:100]}...")
                        
                        # Parse result
                        result_data = json.loads(result)
                        
                        # Forward to client
                        await websocket.send_json({
                            "text": result_data.get("text", ""),
                            "is_final": result_data.get("is_final", False),
                            "confidence": result_data.get("confidence", 0)
                        })
                except Exception as e:
                    logger.error(f"Error forwarding to client: {str(e)}")
            
            # Create and run both tasks
            forward_task = asyncio.create_task(forward_to_elevenlabs())
            receive_task = asyncio.create_task(forward_to_client())
            
            # Wait for either task to complete (which would indicate a disconnect)
            done, pending = await asyncio.wait(
                [forward_task, receive_task],
                return_when=asyncio.FIRST_COMPLETED
            )
            
            # Cancel any pending tasks
            for task in pending:
                task.cancel()
            
            logger.info("ASR streaming session ended")
    
    except websockets.exceptions.ConnectionClosed:
        logger.warning("Connection to ElevenLabs closed unexpectedly")
        await websocket.send_json({
            "error": "Connection to ElevenLabs closed",
            "is_final": True
        })
    except Exception as e:
        error_message = f"Error in ASR streaming: {str(e)}"
        logger.error(error_message)
        try:
            await websocket.send_json({
                "error": error_message,
                "is_final": True
            })
        except:
            pass
    
    # Ensure websocket is closed
    await websocket.close()

@router.websocket("/tts/stream")
async def stream_tts(websocket: WebSocket):
    """
    WebSocket endpoint for streaming TTS using ElevenLabs
    """
    await websocket.accept()
    
    session_id = str(uuid.uuid4())
    logger.info(f"TTS streaming session started: {session_id}")
    
    try:
        # Receive text from client
        data = await asyncio.wait_for(
            websocket.receive_text(),
            timeout=WEBSOCKET_IDLE_TIMEOUT
        )
        
        message = json.loads(data)
        
        if "text" in message:
            text = message["text"]
            voice_id = message.get("voice_id")
            
            logger.info(f"TTS streaming request: {len(text)} chars")
            
            # Stream the TTS response
            chunk_index = 0
            async for audio_chunk in voice_service.text_to_speech_streaming(text, voice_id):
                # Send the chunk to the client
                await websocket.send_json({
                    "type": "audio_chunk",
                    "audio_data": audio_chunk,
                    "chunk_index": chunk_index
                })
                chunk_index += 1
            
            # Send completion message
            await websocket.send_json({
                "type": "complete"
            })
            
            logger.info(f"TTS streaming completed: {chunk_index} chunks sent")
            
    except asyncio.TimeoutError:
        logger.warning(f"TTS session {session_id} timed out")
        await websocket.send_json({
            "error": "Session timeout",
            "type": "error"
        })
    except WebSocketDisconnect:
        logger.info(f"TTS streaming session disconnected: {session_id}")
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in TTS session {session_id}: {str(e)}")
        await websocket.send_json({
            "error": "Invalid JSON data",
            "type": "error"
        })
    except Exception as e:
        logger.exception(f"Error in TTS streaming session {session_id}: {str(e)}")
        try:
            await websocket.send_json({
                "error": str(e),
                "type": "error"
            })
        except:
            pass
    finally:
        logger.info(f"TTS streaming session ended: {session_id}")
        try:
            await websocket.close()
        except:
            pass

async def monitor_session_timeout(session_id: str, websocket: WebSocket):
    """
    Monitor a session for timeout due to inactivity
    """
    try:
        while True:
            await asyncio.sleep(10)  # Check every 10 seconds
            
            if session_id not in asr_sessions:
                break
                
            session = asr_sessions[session_id]
            current_time = time.time()
            
            # Check for idle timeout
            if current_time - session["last_activity"] > WEBSOCKET_IDLE_TIMEOUT:
                logger.warning(f"Session {session_id} timed out due to inactivity")
                try:
                    await websocket.send_json({
                        "error": "Session timeout: inactivity",
                        "is_final": True
                    })
                    await websocket.close(code=1000, reason="Idle timeout")
                except:
                    pass
                
                # Clean up session
                if session_id in asr_sessions:
                    del asr_sessions[session_id]
                break
                
            # Check for max duration
            if current_time - session["start_time"] > MAX_SESSION_DURATION:
                logger.warning(f"Session {session_id} exceeded maximum duration")
                try:
                    await websocket.send_json({
                        "error": "Session timeout: maximum duration exceeded",
                        "is_final": True
                    })
                    await websocket.close(code=1000, reason="Max duration exceeded")
                except:
                    pass
                
                # Clean up session
                if session_id in asr_sessions:
                    del asr_sessions[session_id]
                break
    except asyncio.CancelledError:
        # Task was cancelled - normal termination
        pass
    except Exception as e:
        logger.exception(f"Error in timeout monitor for session {session_id}: {str(e)}")

async def cleanup_stale_sessions():
    """
    Periodically clean up stale sessions
    """
    while True:
        try:
            await asyncio.sleep(SESSION_CLEANUP_INTERVAL)
            current_time = time.time()
            
            # Find stale sessions
            stale_sessions = []
            for session_id, session in asr_sessions.items():
                if current_time - session["last_activity"] > WEBSOCKET_IDLE_TIMEOUT:
                    stale_sessions.append(session_id)
            
            # Clean up stale sessions
            for session_id in stale_sessions:
                if session_id in asr_sessions:
                    try:
                        session = asr_sessions[session_id]
                        websocket = session["websocket"]
                        await websocket.close(code=1000, reason="Session cleanup")
                    except:
                        pass
                    
                    del asr_sessions[session_id]
                    logger.warning(f"Cleaned up stale session: {session_id}")
        except Exception as e:
            logger.exception(f"Error in session cleanup task: {str(e)}")

# Initialize the cleanup task - this needs to be done at app startup instead of here
cleanup_task = None 