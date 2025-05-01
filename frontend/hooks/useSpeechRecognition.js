import { useState, useEffect, useCallback } from 'react';

const useSpeechRecognition = (options = {}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState(null);

  // Check if SpeechRecognition is available
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const isSupported = !!SpeechRecognition;

  // Create recognition instance
  const recognition = isSupported ? new SpeechRecognition() : null;

  // Set recognition options
  useEffect(() => {
    if (!recognition) return;

    recognition.continuous = options.continuous ?? true;
    recognition.interimResults = options.interimResults ?? true;
    recognition.lang = options.language ?? 'en-US';
  }, [recognition, options]);

  // Handle results
  useEffect(() => {
    if (!recognition) return;

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimText += transcript;
        }
      }

      if (finalTranscript) {
        setTranscript((prev) => prev + finalTranscript);
      }
      setInterimTranscript(interimText);
    };

    recognition.onerror = (event) => {
      setError(event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      if (isListening) {
        recognition.start();
      } else {
        setIsListening(false);
      }
    };
  }, [recognition, isListening]);

  // Start listening
  const startListening = useCallback(() => {
    if (!recognition) {
      setError('Speech recognition not supported');
      return;
    }

    setIsListening(true);
    setError(null);
    setTranscript('');
    setInterimTranscript('');

    try {
      recognition.start();
    } catch (err) {
      setError(err.message);
      setIsListening(false);
    }
  }, [recognition]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (!recognition) return;

    recognition.stop();
    setIsListening(false);
  }, [recognition]);

  // Reset transcript
  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
};

export default useSpeechRecognition; 