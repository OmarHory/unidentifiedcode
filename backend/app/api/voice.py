from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Body, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
import base64
from typing import Optional, Dict, Any
import uuid
import json
import asyncio
import io

from app.models.chat import VoiceTranscriptionRequest, VoiceTranscriptionResponse
from app.services.voice_service import VoiceService

router = APIRouter()

# Initialize services
voice_service = VoiceService()

# Store active ASR sessions
asr_sessions = {}

class TextToSpeechRequest(BaseModel):
    text: str
    voice: str = "alloy"  # alloy, echo, fable, onyx, nova, shimmer

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
    except Exception as e:
        raise HTTPException(
            status_code=500,
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
    except Exception as e:
        raise HTTPException(
            status_code=500,
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
            request.voice
        )
        
        return TextToSpeechResponse(audio_data=audio_data)
    except Exception as e:
        raise HTTPException(
            status_code=500,
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
    except Exception as e:
        raise HTTPException(
            status_code=500,
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
    except Exception as e:
        raise HTTPException(
            status_code=500,
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
    except Exception as e:
        raise HTTPException(
            status_code=500,
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
    except Exception as e:
        raise HTTPException(
            status_code=500,
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
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error ending phone call: {str(e)}"
        )

@router.websocket("/stream")
async def stream_asr(websocket: WebSocket):
    """
    WebSocket endpoint for streaming ASR
    """
    await websocket.accept()
    
    # Generate a unique session ID
    session_id = str(uuid.uuid4())
    asr_sessions[session_id] = {
        "websocket": websocket,
        "buffer": b"",
        "transcript": ""
    }
    
    print(f"ASR streaming session started: {session_id}")
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if "audio_chunk" in message:
                # Decode the base64 audio chunk
                audio_chunk = base64.b64decode(message["audio_chunk"])
                
                # Process the audio chunk with the voice service
                result = await voice_service.process_audio_chunk(audio_chunk, session_id)
                
                # Send the result back to the client
                await websocket.send_json({
                    "text": result.get("text", ""),
                    "is_final": result.get("is_final", False)
                })
                
    except WebSocketDisconnect:
        # Clean up session
        if session_id in asr_sessions:
            del asr_sessions[session_id]
        print(f"ASR streaming session ended: {session_id}")
    except Exception as e:
        print(f"Error in ASR streaming: {str(e)}")
        await websocket.close(code=1011, reason=f"Error: {str(e)}")
        # Clean up session
        if session_id in asr_sessions:
            del asr_sessions[session_id]

@router.websocket("/tts/stream")
async def stream_tts(websocket: WebSocket):
    """
    WebSocket endpoint for streaming TTS
    """
    await websocket.accept()
    
    try:
        # Receive message from client
        data = await websocket.receive_text()
        message = json.loads(data)
        
        if "text" in message:
            text = message["text"]
            voice = message.get("voice", "alloy")
            
            # Stream the TTS response
            chunk_generator = voice_service.stream_text_to_speech(text, voice)
            
            chunk_index = 0
            async for audio_chunk in chunk_generator:
                # Send the chunk to the client
                await websocket.send_json({
                    "type": "audio_chunk",
                    "audio_data": audio_chunk,
                    "chunk_index": chunk_index
                })
                chunk_index += 1
                
                # Add a small delay to prevent overwhelming the client
                await asyncio.sleep(0.05)
            
            # Send completion message
            await websocket.send_json({
                "type": "complete"
            })
            
    except WebSocketDisconnect:
        print("TTS streaming session ended")
    except Exception as e:
        print(f"Error in TTS streaming: {str(e)}")
        await websocket.close(code=1011, reason=f"Error: {str(e)}") 