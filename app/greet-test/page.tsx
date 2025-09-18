'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

interface AgentResponse {
  assistant_message: string;
  // Add other fields from your InterviewStep schema if needed
}

export default function GreetTestPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    connectToWebSocket();
    return () => {
      cleanup();
    };
  }, []);

  const connectToWebSocket = () => {
    try {
      const ws = new WebSocket('ws://localhost:8080');
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setConnectionStatus('Connected');
        console.log('Connected to WebSocket server');
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      };

      ws.onclose = () => {
        setIsConnected(false);
        setConnectionStatus('Disconnected');
        console.log('Disconnected from WebSocket server');
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('Error');
      };
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      setConnectionStatus('Connection Failed');
    }
  };

  const handleWebSocketMessage = (data: any) => {
    switch (data.type) {
      case 'connected':
        console.log('Session ID:', data.sessionId);
        break;

      case 'transcription_started':
        console.log('Transcription started');
        break;

      case 'partial_transcript':
        setCurrentTranscript(data.transcript);
        break;

      case 'final_transcript':
        setCurrentTranscript('');
        addMessage('user', data.transcript);
        break;

      case 'processing':
        setIsProcessing(true);
        break;

      case 'agent_response':
        setIsProcessing(false);
        const agentResponse: AgentResponse = data.response;
        addMessage('assistant', agentResponse.assistant_message);
        break;

      case 'generating_audio':
        setIsGeneratingAudio(true);
        break;

      case 'audio_response':
        setIsGeneratingAudio(false);
        playAudioResponse(data.audio);
        break;

      case 'speak_text':
        setIsGeneratingAudio(false);
        try {
          const text = data?.text || '';
          if (!text) break;
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.onend = () => {
            // notify server that playback finished
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'audio_playback_finished' }));
            }
          };
          speechSynthesis.cancel();
          speechSynthesis.speak(utterance);
        } catch (err) {
          console.error('Browser TTS fallback error:', err);
        }
        break;

      case 'transcription_stopped':
        console.log('Transcription stopped');
        break;

      case 'error':
        console.error('Server error:', data.message);
        setIsProcessing(false);
        setIsGeneratingAudio(false);
        break;
    }
  };

  const addMessage = (type: 'user' | 'assistant', text: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      type,
      text,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const playAudioResponse = (base64Audio: string) => {
    try {
      const audioBlob = base64ToBlob(base64Audio, 'audio/mpeg');
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play().catch(console.error);
      }
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  };

  const base64ToBlob = (base64: string, mimeType: string) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  };

  const startRecording = async () => {
    if (!isConnected || !wsRef.current) {
      alert('Not connected to server');
      return;
    }

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          sampleSize: 16,
        }
      });

      streamRef.current = stream;

      // Create audio context for processing
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (event) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

        const inputData = event.inputBuffer.getChannelData(0);
        const pcmData = new Int16Array(inputData.length);

        // Convert Float32Array to Int16Array (PCM format)
        for (let i = 0; i < inputData.length; i++) {
          const sample = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        }

        // Send audio chunk to server
        const audioChunk = new Uint8Array(pcmData.buffer);
        const base64Audio = btoa(String.fromCharCode(...audioChunk));

        wsRef.current.send(JSON.stringify({
          type: 'audio_chunk',
          data: base64Audio
        }));
      };

      source.connect(processor);
      processor.connect(audioContextRef.current.destination);

      // Start transcription on server
      wsRef.current.send(JSON.stringify({
        type: 'start_transcription'
      }));

      setIsRecording(true);
      setCurrentTranscript('');

    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Failed to start recording. Please check microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (!wsRef.current) return;

    // Stop transcription on server
    wsRef.current.send(JSON.stringify({
      type: 'stop_transcription'
    }));

    // Clean up local resources
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setIsRecording(false);
    setCurrentTranscript('');
  };

  const cleanup = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
  };

  const sendTestMessage = () => {
    if (!wsRef.current || !isConnected) return;
    
    const testMessage = "Hello, this is a test message";
    wsRef.current.send(JSON.stringify({
      type: 'text_input',
      text: testMessage
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-6 border border-white/20">
          <h1 className="text-3xl font-bold text-white mb-2">
            🎤 Voice Chat with AI Agent
          </h1>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
              isConnected ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-400' : 'bg-red-400'
              }`}></div>
              {connectionStatus}
            </div>
            <button
              onClick={sendTestMessage}
              className="px-4 py-2 bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30 transition-colors"
              disabled={!isConnected}
            >
              Test Message
            </button>
          </div>
        </div>

        {/* Recording Controls */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-6 border border-white/20">
          <div className="flex items-center justify-center gap-6">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={!isConnected}
              className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-semibold text-lg transition-all transform hover:scale-105 ${
                isRecording
                  ? 'bg-red-500 text-white shadow-lg shadow-red-500/25'
                  : 'bg-green-500 text-white shadow-lg shadow-green-500/25'
              } ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isRecording ? <MicOff size={24} /> : <Mic size={24} />}
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </button>

            {(isProcessing || isGeneratingAudio) && (
              <div className="flex items-center gap-2 text-yellow-300">
                <div className="animate-spin w-5 h-5 border-2 border-yellow-300 border-t-transparent rounded-full"></div>
                {isProcessing ? 'Processing...' : 'Generating Audio...'}
              </div>
            )}
          </div>

          {/* Current Transcript */}
          {(currentTranscript || isRecording) && (
            <div className="mt-4 p-4 bg-white/5 rounded-lg border border-white/10">
              <div className="text-gray-300 text-sm mb-2">
                {isRecording ? '🎙️ Listening...' : 'Current transcript:'}
              </div>
              <div className="text-white text-lg">
                {currentTranscript || (isRecording ? '(speak now)' : '')}
              </div>
            </div>
          )}
        </div>

        {/* Chat Messages */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 h-96 flex flex-col">
          <div className="p-4 border-b border-white/10">
            <h2 className="text-xl font-semibold text-white">Conversation</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                Start recording to begin the conversation
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                      message.type === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-white/20 text-white border border-white/20'
                    }`}
                  >
                    <div className="text-sm mb-1">
                      {message.type === 'user' ? '🎤 You' : '🤖 AI Agent'}
                    </div>
                    <div>{message.text}</div>
                    <div className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Hidden audio element for playing responses */}
        <audio ref={audioRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
}