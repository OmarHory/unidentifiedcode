import base64
import os
import tempfile
import requests
import json
from typing import Dict, Any, Optional, AsyncGenerator

from openai import OpenAI
from app.core.config import settings

class VoiceService:
    def __init__(self):
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        self.elevenlabs_api_key = settings.ELEVENLABS_API_KEY
        self.elevenlabs_voice_id = settings.ELEVENLABS_VOICE_ID
    
    async def transcribe_audio(self, audio_data: str) -> Dict[str, Any]:
        """
        Transcribe audio data to text using OpenAI Whisper
        
        Args:
            audio_data: Base64 encoded audio data or URL
            
        Returns:
            Dict containing transcription text and confidence
        """
        # If audio_data is base64 encoded, decode and save to temp file
        if audio_data.startswith("data:audio/"):
            # Extract the base64 part
            audio_data = audio_data.split(',')[1]
            
        if ';base64,' in audio_data:
            # Extract the base64 part
            audio_data = audio_data.split(';base64,')[1]
            
        try:
            # Create a temporary file to store the audio
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_file:
                temp_file_path = temp_file.name
                
                # Decode base64 to binary
                audio_binary = base64.b64decode(audio_data)
                
                # Write to the temporary file
                temp_file.write(audio_binary)
            
            # Transcribe using OpenAI Whisper API
            with open(temp_file_path, "rb") as audio_file:
                transcript = self.client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file
                )
            
            # Clean up temporary file
            os.remove(temp_file_path)
            
            return {
                "text": transcript.text,
                "confidence": 0.95  # OpenAI doesn't provide confidence scores
            }
            
        except Exception as e:
            # Clean up temporary file if it exists
            if 'temp_file_path' in locals() and os.path.exists(temp_file_path):
                os.remove(temp_file_path)
            
            raise Exception(f"Error transcribing audio: {str(e)}")
    
    async def elevenlabs_transcribe(self, audio_data: str) -> Dict[str, Any]:
        """
        Transcribe audio data to text using ElevenLabs ASR
        
        Args:
            audio_data: Base64 encoded audio data
            
        Returns:
            Dict containing transcription text and metadata
        """
        if not self.elevenlabs_api_key:
            raise ValueError("ElevenLabs API key is not configured")
            
        # If audio_data is base64 encoded, decode and save to temp file
        if audio_data.startswith("data:audio/"):
            # Extract the base64 part
            audio_data = audio_data.split(',')[1]
            
        if ';base64,' in audio_data:
            # Extract the base64 part
            audio_data = audio_data.split(';base64,')[1]
            
        try:
            # Create a temporary file to store the audio
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_file:
                temp_file_path = temp_file.name
                
                # Decode base64 to binary
                audio_binary = base64.b64decode(audio_data)
                
                # Write to the temporary file
                temp_file.write(audio_binary)
            
            # Use ElevenLabs Speech-to-Text API
            url = "https://api.elevenlabs.io/v1/speech-to-text"
            
            headers = {
                "xi-api-key": self.elevenlabs_api_key
            }
            
            with open(temp_file_path, 'rb') as f:
                files = {'audio': f}
                response = requests.post(url, headers=headers, files=files)
            
            # Clean up temporary file
            os.remove(temp_file_path)
            
            if response.status_code == 200:
                return {
                    "text": response.json().get("text", ""),
                    "confidence": 0.9,  # ElevenLabs doesn't provide confidence scores
                    "metadata": response.json()
                }
            else:
                raise Exception(f"ElevenLabs ASR API error: {response.text}")
            
        except Exception as e:
            # Clean up temporary file if it exists
            if 'temp_file_path' in locals() and os.path.exists(temp_file_path):
                os.remove(temp_file_path)
            
            raise Exception(f"Error transcribing audio with ElevenLabs: {str(e)}")
            
    async def text_to_speech(self, text: str, voice: str = "alloy") -> bytes:
        """
        Convert text to speech using OpenAI TTS
        
        Args:
            text: Text to convert to speech
            voice: Voice to use (alloy, echo, fable, onyx, nova, shimmer)
            
        Returns:
            Base64 encoded audio data
        """
        try:
            response = self.client.audio.speech.create(
                model="tts-1",
                voice=voice,
                input=text
            )
            
            # Get the binary audio content
            audio_data = response.content
            
            # Encode to base64
            base64_audio = base64.b64encode(audio_data).decode("utf-8")
            
            return base64_audio
            
        except Exception as e:
            raise Exception(f"Error converting text to speech: {str(e)}")
    
    async def elevenlabs_text_to_speech(self, text: str, voice_id: Optional[str] = None) -> bytes:
        """
        Convert text to speech using ElevenLabs TTS
        
        Args:
            text: Text to convert to speech
            voice_id: ElevenLabs voice ID (defaults to settings)
            
        Returns:
            Base64 encoded audio data
        """
        if not self.elevenlabs_api_key:
            raise ValueError("ElevenLabs API key is not configured")
        
        # Use the configured voice ID if none is provided
        voice_id = voice_id or self.elevenlabs_voice_id
        
        try:
            url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
            
            headers = {
                "xi-api-key": self.elevenlabs_api_key,
                "Content-Type": "application/json"
            }
            
            data = {
                "text": text,
                "model_id": "eleven_monolingual_v1",
                "voice_settings": {
                    "stability": 0.5,
                    "similarity_boost": 0.75
                }
            }
            
            response = requests.post(url, headers=headers, json=data)
            
            if response.status_code == 200:
                # Get binary audio content
                audio_data = response.content
                
                # Encode to base64
                base64_audio = base64.b64encode(audio_data).decode("utf-8")
                
                return base64_audio
            else:
                raise Exception(f"ElevenLabs TTS API error: {response.text}")
            
        except Exception as e:
            raise Exception(f"Error converting text to speech with ElevenLabs: {str(e)}")
    
    async def start_phone_call(self, project_id: str) -> Dict[str, Any]:
        """
        Start a phone call with the LLM
        
        Args:
            project_id: Project ID associated with the call
            
        Returns:
            Dict containing call session details
        """
        # This is a placeholder for actual phone call logic
        # In a real implementation, this would establish a WebSocket connection
        # or other streaming protocol to facilitate real-time voice conversation
        
        call_id = f"call_{project_id}_{int(os.urandom(4).hex(), 16)}"
        
        return {
            "call_id": call_id,
            "status": "started",
            "project_id": project_id,
            "timestamp": "2023-01-01T00:00:00Z"
        }
    
    async def end_phone_call(self, call_id: str) -> Dict[str, Any]:
        """
        End a phone call with the LLM
        
        Args:
            call_id: Call session ID
            
        Returns:
            Dict containing call termination details
        """
        # This is a placeholder for actual call termination logic
        
        return {
            "call_id": call_id,
            "status": "ended",
            "timestamp": "2023-01-01T00:00:00Z"
        }
    
    async def process_audio_chunk(self, audio_chunk: bytes, session_id: str) -> Dict[str, Any]:
        """
        Process an audio chunk from a streaming ASR client
        
        Args:
            audio_chunk: Binary audio data
            session_id: Session ID for tracking the conversation
            
        Returns:
            Dictionary with transcript and metadata
        """
        try:
            # Accumulate audio in the buffer
            from app.api.voice import asr_sessions
            
            if session_id in asr_sessions:
                # Append new chunk to buffer
                asr_sessions[session_id]["buffer"] += audio_chunk
                
                # If buffer exceeds a certain size, process it
                if len(asr_sessions[session_id]["buffer"]) > 16000:  # Process every ~1 second of audio
                    # Convert buffer to base64
                    buffer_base64 = base64.b64encode(asr_sessions[session_id]["buffer"]).decode("utf-8")
                    
                    # Process with appropriate ASR service
                    if self.elevenlabs_api_key:
                        # Use ElevenLabs for better quality
                        result = await self.elevenlabs_transcribe(buffer_base64)
                    else:
                        # Fallback to OpenAI Whisper
                        result = await self.transcribe_audio(buffer_base64)
                    
                    # Update session transcript if we got a result
                    if result and "text" in result:
                        asr_sessions[session_id]["transcript"] = result["text"]
                    
                    # Clear the buffer after processing
                    asr_sessions[session_id]["buffer"] = b""
                    
                    return {
                        "text": asr_sessions[session_id]["transcript"],
                        "is_final": False,
                        "confidence": result.get("confidence", 0)
                    }
                
                # If buffer is smaller than threshold, return current transcript without processing
                return {
                    "text": asr_sessions[session_id]["transcript"],
                    "is_final": False
                }
            
            # Session not found
            return {"error": "Session not found", "is_final": True}
                
        except Exception as e:
            print(f"Error processing audio chunk: {str(e)}")
            return {"error": str(e), "is_final": True}
            
    async def stream_text_to_speech(self, text: str, voice: str = "alloy") -> AsyncGenerator[str, None]:
        """
        Convert text to speech in a streaming manner
        
        Args:
            text: Text to convert to speech
            voice: Voice to use
            
        Yields:
            Base64 encoded audio chunks
        """
        try:
            # Split text into sentences or chunks for streaming
            import re
            chunks = re.split(r'([.!?]\s+)', text)
            buffer = ""
            
            for i in range(0, len(chunks), 2):
                # Build a meaningful chunk (sentence + punctuation)
                if i < len(chunks):
                    buffer += chunks[i]
                if i+1 < len(chunks):
                    buffer += chunks[i+1]
                    
                # Process chunk if it's substantial enough
                if len(buffer) > 20 or i >= len(chunks) - 2:
                    # Use appropriate TTS service
                    if self.elevenlabs_api_key and voice != "alloy":
                        # ElevenLabs TTS
                        audio_base64 = await self.elevenlabs_text_to_speech(buffer)
                    else:
                        # OpenAI TTS
                        audio_base64 = await self.text_to_speech(buffer, voice)
                    
                    # Yield the chunk
                    yield audio_base64
                    
                    # Reset buffer
                    buffer = ""
        
        except Exception as e:
            print(f"Error in TTS streaming: {str(e)}")
            raise e 