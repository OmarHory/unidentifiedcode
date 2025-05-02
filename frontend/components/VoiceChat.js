import { useState, useRef, useEffect } from 'react';
import { MicrophoneIcon, SpeakerWaveIcon, XMarkIcon, PauseIcon, PhoneIcon } from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

// Import API clients from lib directory
import { voiceApi, getWebSocketBaseUrl, createReconnectingWebSocket } from '../lib/api';

export default function VoiceChat({ onVoiceInput, projectTechnology, isProcessing, onPhoneCall }) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [audioQueue, setAudioQueue] = useState([]);
  
  const microphoneRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const elevenLabsSocketRef = useRef(null);
  const audioPlayerRef = useRef(null);
  const audioChunksRef = useRef([]);
  const wsRef = useRef(null);
  
  // Set up audio context
  useEffect(() => {
    // Initialize audio context for better browser compatibility
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioContextRef.current = new AudioContext();
    
    // Initialize audio player
    audioPlayerRef.current = new Audio();
    audioPlayerRef.current.onended = () => {
      if (audioQueue.length > 0) {
        playNextInQueue();
      } else {
        setIsSpeaking(false);
      }
    };
    
    return () => {
      // Clean up audio resources
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.src = '';
      }
    };
  }, []);
  
  // Handle playing audio from queue
  useEffect(() => {
    if (audioQueue.length > 0 && !isSpeaking) {
      playNextInQueue();
    }
  }, [audioQueue, isSpeaking]);

  const playNextInQueue = () => {
    if (audioQueue.length === 0) return;
    
    setIsSpeaking(true);
    const nextAudio = audioQueue[0];
    
    // Create a blob URL from the audio data
    const blob = new Blob([nextAudio], { type: 'audio/mp3' });
    const url = URL.createObjectURL(blob);
    
    // Play the audio
    audioPlayerRef.current.src = url;
    audioPlayerRef.current.play()
      .catch(error => {
        console.error('Error playing audio:', error);
        setIsSpeaking(false);
      });
    
    // Remove the played audio from the queue
    setAudioQueue(prevQueue => prevQueue.slice(1));
    
    // Clean up the blob URL after playing
    audioPlayerRef.current.onended = () => {
      URL.revokeObjectURL(url);
      if (audioQueue.length > 1) {
        playNextInQueue();
      } else {
        setIsSpeaking(false);
      }
    };
  };

  const startListening = async () => {
    try {
      // Request microphone access
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create media recorder with proper audio format for ElevenLabs
      mediaRecorderRef.current = new MediaRecorder(streamRef.current, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 16000 // 16kHz is optimal for speech recognition
      });
      
      // Clear audio chunks
      audioChunksRef.current = [];
      
      // Connect directly to ElevenLabs WebSocket - bypass our backend proxy
      const elevenlabsWsUrl = "wss://api.elevenlabs.io/v1/speech-to-text/stream";
      console.log('Connecting directly to ElevenLabs ASR at:', elevenlabsWsUrl);
      
      // Get ElevenLabs API key - in production, this would be retrieved securely
      // For this demo, we'll use a mock key from localStorage if available
      const apiKey = "sk_3c531c1e03af744dcbbe1e1182935ee97b6f2dcd45eb104d";
      
      // Create WebSocket with headers
      const ws = new WebSocket(elevenlabsWsUrl);
      wsRef.current = ws;
      
      // Set up WebSocket event handlers
      ws.onopen = () => {
        console.log('ElevenLabs ASR WebSocket connected directly');
        toast.success('Voice recognition connected');
        
        // Start recording
        mediaRecorderRef.current.start(100); // Send smaller chunks more frequently
        setIsListening(true);
        setTranscript('');
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('ASR direct stream data:', data);
          
          if (data.text) {
            // Update transcript with the latest text
            setTranscript(data.text);
            
            // If this is final, process it
            if (data.is_final) {
              onVoiceInput && onVoiceInput(data.text);
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      ws.onerror = (error) => {
        console.error('ElevenLabs ASR WebSocket error:', error);
        toast.error('Voice recognition error');
        stopListening();
      };
      
      ws.onclose = (event) => {
        console.log(`ElevenLabs ASR WebSocket closed (code: ${event.code})`, event.reason);
        
        if (isListening) {
          toast.info('Voice recognition disconnected');
          stopListening();
        }
      };
      
      // Set up media recorder to send audio chunks directly to ElevenLabs
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          // Process and send the audio chunk
          processAndSendAudioChunk(event.data, ws, apiKey);
          
          // Also store locally
          audioChunksRef.current.push(event.data);
        }
      };
      
      console.log('Voice recognition started with direct ElevenLabs streaming');
      
    } catch (error) {
      console.error('Error starting voice recognition:', error);
      toast.error('Could not access microphone');
      setIsListening(false);
    }
  };
  
  // Helper to process and send audio chunks directly to ElevenLabs
  const processAndSendAudioChunk = async (audioBlob, ws, apiKey) => {
    if (!audioBlob || !ws || ws.readyState !== WebSocket.OPEN) return;
    
    try {
      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = () => {
        try {
          // Get base64 data without the prefix
          const base64data = reader.result.split(',')[1];
          
          // Send to ElevenLabs in the format they expect
          ws.send(JSON.stringify({
            audio: base64data,
            type: "audio_data",
            xi_api_key: apiKey
          }));
        } catch (error) {
          console.error('Error sending audio chunk:', error);
        }
      };
    } catch (error) {
      console.error('Error processing audio chunk:', error);
    }
  };

  const setupElevenLabsASRConnection = () => {
    // Close any existing connection
    if (elevenLabsSocketRef.current) {
      elevenLabsSocketRef.current.close();
    }
    
    // In a production implementation, we would use ElevenLabs' API key from environment variables
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const hasApiKey = apiKey && apiKey.length > 0;
    
    console.log(`Setting up ElevenLabs connection for streaming ASR. API Key ${hasApiKey ? 'is configured' : 'is missing'}`);
    
    // Set up event handlers for the media recorder
    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) {
        // Collect audio chunks
        audioChunksRef.current.push(event.data);
        
        // Process audio every second for a more realistic streaming experience
        if (audioChunksRef.current.length % 4 === 0) { // 4 * 250ms = 1s
          processAudioChunk();
        }
      }
    };
  };
  
  const processAudioChunk = async () => {
    if (!isListening || audioChunksRef.current.length === 0) return;
    
    try {
      // Create a blob from collected chunks
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      
      // Convert blob to base64 for API transmission
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = reader.result.split(',')[1]; // Remove the data URL prefix
        
        try {
          const apiKey = process.env.ELEVENLABS_API_KEY;
          const hasApiKey = apiKey && apiKey.length > 0;
          
          // Call the appropriate API based on environment and API key availability
          if (process.env.NODE_ENV === 'production' && hasApiKey) {
            // Use ElevenLabs ASR
            const response = await voiceApi.elevenLabsTranscribe(base64Audio);
            if (response.data && response.data.text) {
              setTranscript(response.data.text);
            }
          } else {
            // Simulate a response for demo purposes
            simulateTranscription();
          }
        } catch (error) {
          console.error('Error with transcription:', error);
        }
      };
    } catch (error) {
      console.error('Error processing audio chunk:', error);
    }
  };
  
  const simulateTranscription = () => {
    // Simulate receiving transcription from ElevenLabs
    setTimeout(() => {
      if (isListening) {
        // Random phrases for simulation
        const phrases = [
          "I'm looking for",
          "Can you help me with",
          "How do I implement",
          "Write code for",
          "Explain how to use"
        ];
        
        if (!transcript) {
          // Start with one of the phrases
          const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
          setTranscript(randomPhrase);
        } else {
          // Add some random tech words based on the project technology
          const techTerms = {
            "React": [" components", " hooks", " state management", " React Router"],
            "Node.js": [" Express", " middleware", " API endpoints", " async functions"],
            "Python": [" Flask", " Django", " data analysis", " machine learning models"],
            "Vue": [" components", " Vuex", " Vue Router", " Composition API"],
            "Angular": [" services", " modules", " dependency injection", " observables"]
          };
          
          const defaultTerms = [" functions", " code structure", " best practices", " implementation"];
          const terms = techTerms[projectTechnology] || defaultTerms;
          const randomTerm = terms[Math.floor(Math.random() * terms.length)];
          
          // Only add the term if we're still below a reasonable length
          if (transcript.length < 50) {
            setTranscript(prev => prev + randomTerm);
          }
        }
      }
    }, 1000);
  };

  const stopListening = () => {
    // Stop recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      
      // Process final transcript if needed
      if (transcript && onVoiceInput) {
        onVoiceInput(transcript);
      }
    }
    
    // Close WebSocket connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Reset state
    setIsListening(false);
    audioChunksRef.current = [];
  };
  
  const speakResponse = async (text) => {
    try {
      console.log('Speaking response with streaming TTS:', text);
      setIsSpeaking(true);
      
      // Establish WebSocket connection for streaming TTS with the updated URL format
      const wsBaseUrl = getWebSocketBaseUrl();
      const wsUrl = `${wsBaseUrl}/voice/tts/stream`;
      console.log('Connecting to TTS WebSocket URL:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('TTS WebSocket connection established');
        ws.send(JSON.stringify({ text }));
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'audio_chunk' && data.audio_data) {
          // Handle streaming audio chunk
          const audioData = atob(data.audio_data);
          const arrayBuffer = new ArrayBuffer(audioData.length);
          const uint8Array = new Uint8Array(arrayBuffer);
          
          for (let i = 0; i < audioData.length; i++) {
            uint8Array[i] = audioData.charCodeAt(i);
          }
          
          // Add to audio queue
          setAudioQueue(prev => [...prev, uint8Array]);
          
          // Start playing if not already playing
          if (!isSpeaking) {
            playNextInQueue();
          }
        }
        else if (data.type === 'complete') {
          console.log('TTS streaming complete');
          ws.close();
        }
      };
      
      ws.onerror = (error) => {
        console.error('TTS WebSocket error:', error);
        setIsSpeaking(false);
        ws.close();
        
        // Fall back to browser TTS if available
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.onend = () => setIsSpeaking(false);
          window.speechSynthesis.speak(utterance);
        }
      };
      
      ws.onclose = () => {
        console.log('TTS WebSocket connection closed');
      };
      
    } catch (error) {
      console.error('Error speaking response:', error);
      setIsSpeaking(false);
      
      // Fall back to browser TTS
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onend = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
      }
    }
  };
  
  const handleToggleMicrophone = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };
  
  const handleClearTranscript = () => {
    setTranscript('');
  };
  
  const handleStopSpeaking = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.src = '';
    }
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setAudioQueue([]);
  };
  
  const handlePhoneCall = () => {
    // Toggle call state
    const newCallState = !isCallActive;
    setIsCallActive(newCallState);
    
    // Notify parent component
    if (onPhoneCall) {
      onPhoneCall(newCallState);
    }
    
    // Show toast notification
    toast(newCallState ? 'Starting voice call with AI...' : 'Ending voice call', {
      icon: newCallState ? '📞' : '🔇',
      duration: 2000
    });
    
    // If starting a call, automatically start listening
    if (newCallState && !isListening) {
      startListening();
    } 
    // If ending a call, stop listening
    else if (!newCallState && isListening) {
      stopListening();
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-center space-x-2 p-3 bg-background-light/40 backdrop-blur-md border-b border-background-lighter/30 rounded-t-lg">
        <div className="flex-1 flex items-center space-x-3">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className={`p-2 rounded-full ${
              isListening 
                ? 'bg-red-500 text-white shadow-glow' 
                : 'bg-background-lighter text-gray-300 hover:text-white hover:bg-background-lighter/80'
            }`}
            onClick={handleToggleMicrophone}
            disabled={isSpeaking || isProcessing}
          >
            <MicrophoneIcon className="h-5 w-5" />
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className={`p-2 rounded-full ${
              isCallActive 
                ? 'bg-green-500 text-white shadow-glow' 
                : 'bg-background-lighter text-gray-300 hover:text-white hover:bg-background-lighter/80'
            }`}
            onClick={handlePhoneCall}
            disabled={isProcessing}
          >
            <PhoneIcon className="h-5 w-5" />
          </motion.button>
          
          <AnimatePresence>
            {transcript && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex-1 bg-background-light/20 rounded-lg px-3 py-1.5 text-sm relative max-w-full"
              >
                <p className="truncate">{transcript}</p>
                <button 
                  className="absolute right-1 top-1.5 text-gray-400 hover:text-white"
                  onClick={handleClearTranscript}
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          
          {!transcript && (
            <span className="text-gray-400 text-sm">
              {isListening ? "Listening..." : isCallActive ? "Voice call active" : "Click microphone to speak"}
            </span>
          )}
        </div>
        
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className={`p-2 rounded-full ${
            isSpeaking 
              ? 'bg-primary text-white shadow-glow' 
              : 'bg-background-lighter text-gray-300 hover:text-white hover:bg-background-lighter/80'
          }`}
          onClick={isSpeaking ? handleStopSpeaking : () => {}}
          disabled={!isSpeaking}
        >
          {isSpeaking ? (
            <PauseIcon className="h-5 w-5" />
          ) : (
            <SpeakerWaveIcon className="h-5 w-5" />
          )}
        </motion.button>
      </div>
      
      {isListening && (
        <div className="w-full flex justify-center">
          <div className="flex justify-center items-center space-x-1 py-1">
            <div className="w-1 h-1 bg-red-500 rounded-full animate-pulse"></div>
            <div className="w-1 h-2 bg-red-500 rounded-full animate-pulse delay-75"></div>
            <div className="w-1 h-3 bg-red-500 rounded-full animate-pulse delay-150"></div>
            <div className="w-1 h-4 bg-red-500 rounded-full animate-pulse delay-300"></div>
            <div className="w-1 h-3 bg-red-500 rounded-full animate-pulse delay-150"></div>
            <div className="w-1 h-2 bg-red-500 rounded-full animate-pulse delay-75"></div>
            <div className="w-1 h-1 bg-red-500 rounded-full animate-pulse"></div>
          </div>
        </div>
      )}
    </div>
  );
} 