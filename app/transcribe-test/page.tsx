'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

const SAMPLE_RATE = 16000;
const CHUNK_SIZE = 1024 * 8;

export default function TranscriptionPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState('');

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const connectWebSocket = useCallback(() => {
    try {
      const ws = new WebSocket('ws://localhost:8080');
      
      ws.onopen = () => {
        console.log('Connected to WebSocket');
        setIsConnected(true);
        setError('');
      };

      ws.onmessage = (event) => {
        console.log('📥 Received message:', event.data);
        try {
          const data = JSON.parse(event.data);
          console.log('📝 Parsed data:', data);
          
          if (data.error) {
            console.error('❌ Transcription error:', data.error);
            setError(data.error);
            return;
          }

          if (data.transcript) {
            console.log('✅ Got transcript:', data.transcript);
            if (data.transcript.includes('[Partial]')) {
              setPartialTranscript(data.transcript.replace('[Partial]', '').trim());
            } else if (data.transcript.includes('[Final]')) {
              const finalText = data.transcript.replace('[Final]', '').trim();
              setTranscript(prev => prev + (prev ? ' ' : '') + finalText);
              setPartialTranscript('');
            }
          }
        } catch (err) {
          console.error('❌ Error parsing message:', err);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('WebSocket connection failed');
        setIsConnected(false);
      };

      wsRef.current = ws;
    } catch (err) {
      setError('Failed to connect to WebSocket');
      console.error('Connection error:', err);
    }
  }, []);

  const startRecording = async () => {
    try {
      setError('');
      
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        connectWebSocket();
        // Wait a moment for connection
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      streamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(CHUNK_SIZE, 1, 1);

      // Set recording to true BEFORE creating the processor
      setIsRecording(true);

      processor.onaudioprocess = (event) => {
        // Use a ref instead of state to avoid stale closure issues
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          console.log('❌ WebSocket not ready');
          return;
        }

        const inputData = event.inputBuffer.getChannelData(0);
        
        // Check if we're getting audio data
        const volume = Math.sqrt(inputData.reduce((sum, sample) => sum + sample * sample, 0) / inputData.length);
        console.log('🎤 Audio volume:', volume.toFixed(4));

        const pcmData = new Int16Array(inputData.length);

        // Convert float32 to int16
        for (let i = 0; i < inputData.length; i++) {
          const sample = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        }

        const audioChunk = new Uint8Array(pcmData.buffer);
        console.log('📤 Sending audio chunk:', audioChunk.length, 'bytes');
        wsRef.current.send(audioChunk);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      audioContextRef.current = audioContext;
      processorRef.current = processor;

    } catch (err) {
      setError('Failed to start recording. Please check microphone permissions.');
      console.error('Recording error:', err);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    setIsRecording(false);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
  };

  const clearTranscript = () => {
    setTranscript('');
    setPartialTranscript('');
  };

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      stopRecording();
    };
  }, [connectWebSocket]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-8 text-center">
            🎙️ Real-Time Speech Transcription
          </h1>

          {/* Connection Status */}
          <div className="mb-6 p-4 rounded-lg bg-gray-50">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="font-medium">
                {isConnected ? 'Connected to server' : 'Disconnected from server'}
              </span>
            </div>
            {!isConnected && (
              <button
                onClick={connectWebSocket}
                className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Reconnect
              </button>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700">❌ {error}</p>
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-4 mb-8 justify-center">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={!isConnected}
              className={`px-8 py-3 rounded-full font-semibold text-white transition-all duration-200 ${
                isRecording
                  ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                  : 'bg-green-500 hover:bg-green-600 disabled:bg-gray-400'
              }`}
            >
              {isRecording ? '⏹️ Stop Recording' : '🎙️ Start Recording'}
            </button>

            <button
              onClick={clearTranscript}
              className="px-6 py-3 rounded-full font-semibold text-gray-700 bg-gray-200 hover:bg-gray-300 transition-colors"
            >
              🗑️ Clear
            </button>
          </div>

          {/* Transcript Display */}
          <div className="space-y-4">
            {/* Partial (real-time) transcript */}
            {partialTranscript && (
              <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-lg">
                <h3 className="font-semibold text-yellow-800 mb-2">Processing...</h3>
                <p className="text-yellow-700 italic">{partialTranscript}</p>
              </div>
            )}

            {/* Final transcript */}
            <div className="p-6 bg-gray-50 border rounded-lg min-h-[300px]">
              <h3 className="font-semibold text-gray-800 mb-4">Transcript:</h3>
              <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {transcript || (
                  <span className="text-gray-400 italic">
                    {isRecording 
                      ? "Listening... Start speaking to see transcription here."
                      : "Click 'Start Recording' to begin transcription."
                    }
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-800 mb-2">📝 Instructions:</h3>
            <ol className="text-blue-700 space-y-1 list-decimal list-inside">
              <li>Make sure your WebSocket server is running on port 8080</li>
              <li>Click "Start Recording" and allow microphone access</li>
              <li>Speak clearly - you'll see partial results in yellow, final results below</li>
              <li>Click "Stop Recording" when done</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}