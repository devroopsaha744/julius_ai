'use client';

import React, { useState, useEffect, useRef } from 'react';
import { InterviewWebSocketClient, uploadResume, getInterviewStage, generateReport } from '@/lib/utils/interviewWebSocketClient';
import { testWebSocketConnection, diagnoseConnectionIssue, getWebSocketServerInstructions } from '@/lib/utils/websocketHealth';
import { InterviewStage } from '@/lib/services/orchestrator';

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  stage?: string;
  isCode?: boolean;
}

interface InterviewState {
  isConnected: boolean;
  isTranscribing: boolean;
  currentStage: InterviewStage | null;
  sessionId: string | null;
  resumeUploaded: boolean;
  resumeFilePath: string | null;
  isProcessing: boolean;
  isGeneratingAudio: boolean;
  isPlayingAudio: boolean;
}

export default function InterviewInterface() {
  const [state, setState] = useState<InterviewState>({
    isConnected: false,
    isTranscribing: false,
    currentStage: null,
    sessionId: null,
    resumeUploaded: false,
    resumeFilePath: null,
    isProcessing: false,
    isGeneratingAudio: false,
    isPlayingAudio: false,
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any>(null);

  const clientRef = useRef<InterviewWebSocketClient | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    initializeWebSocket();
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initializeWebSocket = async () => {
    try {
      const client = new InterviewWebSocketClient('ws://localhost:8080');
      clientRef.current = client;

      client.on('connected', (data: any) => {
        console.log('Connected event received:', data);
        setState(prev => ({ 
          ...prev, 
          isConnected: true, 
          sessionId: data?.sessionId || `session_${Date.now()}`
        }));
        addSystemMessage('Connected to interview system');
      });

      client.on('stage_changed', (data: any) => {
        setState(prev => {
          // Only update if stage actually changed
          if (prev.currentStage !== data.newStage) {
            addSystemMessage(`Interview stage: ${data.previousStage} → ${data.newStage}`);
            
            // Show code editor for coding stage
            if (data.newStage === 'coding') {
              setShowCodeEditor(true);
              addSystemMessage('Code editor enabled. You can now submit code solutions.');
            } else {
              setShowCodeEditor(false);
            }
            
            return { ...prev, currentStage: data.newStage };
          }
          return prev;
        });
      });

      client.on('partial_transcript', (data: any) => {
        setCurrentTranscript(data.transcript);
      });

      client.on('final_transcript', (data: any) => {
        setCurrentTranscript('');
        addMessage('user', data.transcript);
      });

      client.on('processing', () => {
        setState(prev => ({ ...prev, isProcessing: true }));
      });

      client.on('agent_response', (data: any) => {
        setState(prev => ({ 
          ...prev, 
          isProcessing: false,
          currentStage: data.currentStage 
        }));
        addMessage('assistant', data.response.assistant_message, data.currentStage);
      });

      client.on('generating_audio', () => {
        setState(prev => ({ ...prev, isGeneratingAudio: true }));
      });

      client.on('audio_response', (data: any) => {
        setState(prev => ({ 
          ...prev, 
          isGeneratingAudio: false,
          isPlayingAudio: true 
        }));
        playAudio(data.audio);
      });

      client.on('scoring_result', (data: any) => {
        setReportData((prev: any) => ({ ...prev, scoring: data.scoring }));
        addSystemMessage(`Interview completed! Final score: ${data.scoring.overall.final_score}/100`);
      });

      client.on('recommendation_result', (data: any) => {
        setReportData((prev: any) => ({ ...prev, recommendation: data.recommendation }));
        addSystemMessage(`Feedback generated with ${data.recommendation.recommendations.length} categories`);
      });

      client.on('error', (data: any) => {
        console.error('WebSocket error event:', data);
        const errorMessage = diagnoseConnectionIssue(data);
        setError(`WebSocket Error: ${errorMessage}\n\n${getWebSocketServerInstructions()}`);
        setState(prev => ({ ...prev, isProcessing: false, isConnected: false }));
        addSystemMessage(`Connection error: ${errorMessage}`);
      });

      client.on('disconnected', (data: any) => {
        console.log('WebSocket disconnected:', data);
        setState(prev => ({ ...prev, isConnected: false }));
        addSystemMessage('Disconnected from interview system. Attempting to reconnect...');
      });

      // Add a connection timeout
      const connectionTimeout = setTimeout(() => {
        if (!clientRef.current?.isConnected()) {
          console.warn('WebSocket connection timeout');
          setError('Connection timeout. Please ensure the WebSocket server is running on port 8080.');
        }
      }, 10000); // 10 second timeout

      // Clear timeout when connected
      client.on('connected', () => {
        clearTimeout(connectionTimeout);
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect to interview system';
      console.error('WebSocket initialization error:', error);
      setError(`Initialization Error: ${errorMessage}\n\n${getWebSocketServerInstructions()}`);
    }
  };

  // Unique ID generator to prevent duplicate keys
  const generateUniqueId = (() => {
    let counter = 0;
    return () => `${Date.now()}-${++counter}`;
  })();

  const addMessage = (type: 'user' | 'assistant', content: string, stage?: string, isCode = false) => {
    const message: Message = {
      id: generateUniqueId(),
      type,
      content,
      timestamp: new Date(),
      stage,
      isCode
    };
    
    setMessages(prev => {
      // Prevent duplicate messages within 1 second
      const recentMessage = prev[prev.length - 1];
      if (recentMessage && 
          recentMessage.content === content && 
          recentMessage.type === type &&
          Date.now() - recentMessage.timestamp.getTime() < 1000) {
        return prev;
      }
      return [...prev, message];
    });
  };

  const addSystemMessage = (content: string) => {
    const message: Message = {
      id: generateUniqueId(),
      type: 'system',
      content,
      timestamp: new Date()
    };
    
    setMessages(prev => {
      // Prevent duplicate system messages within 1 second
      const recentMessage = prev[prev.length - 1];
      if (recentMessage && 
          recentMessage.content === content && 
          recentMessage.type === 'system' &&
          Date.now() - recentMessage.timestamp.getTime() < 1000) {
        return prev;
      }
      return [...prev, message];
    });
  };

  const playAudio = async (audioBase64: string) => {
    try {
      const audioBlob = new Blob([
        new Uint8Array(atob(audioBase64).split('').map(c => c.charCodeAt(0)))
      ], { type: 'audio/mpeg' });
      
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.onended = () => {
          setState(prev => ({ ...prev, isPlayingAudio: false }));
          URL.revokeObjectURL(audioUrl);
        };
        await audioRef.current.play();
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      setState(prev => ({ ...prev, isPlayingAudio: false }));
    }
  };

  const handleResumeUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !state.sessionId) return;

    try {
      setError(null);
      const result = await uploadResume(file, state.sessionId);
      setState(prev => ({ 
        ...prev, 
        resumeUploaded: true, 
        resumeFilePath: result.filePath 
      }));
      
      if (clientRef.current) {
        clientRef.current.setResumePath(result.filePath);
      }
      
      addSystemMessage(`Resume uploaded: ${result.fileName}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to upload resume');
    }
  };

  const startTranscription = async () => {
    try {
      console.log('🎤 Starting audio capture...');
      
      // Request microphone access with specific audio constraints
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1
        } 
      });
      
      console.log('✅ Microphone access granted');
      
      // Create AudioContext for audio processing
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000
      });
      
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      
      let isProcessing = true;
      
      // Process audio data and send to server
      processor.onaudioprocess = (event) => {
        if (!isProcessing || !clientRef.current) return;
        
        const inputData = event.inputBuffer.getChannelData(0);
        
        // Convert Float32Array to Int16Array (PCM 16-bit)
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const sample = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        }
        
        // Send PCM data to server
        clientRef.current.sendAudioChunk(pcmData.buffer);
      };
      
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      // Store cleanup function
      mediaRecorderRef.current = {
        stream,
        stop: () => {
          console.log('🔇 Stopping audio capture...');
          isProcessing = false;
          stream.getTracks().forEach(track => track.stop());
          processor.disconnect();
          source.disconnect();
          audioContext.close();
        }
      } as any;

      // Start transcription on server
      clientRef.current?.startTranscription();
      setState(prev => ({ ...prev, isTranscribing: true }));
      addSystemMessage('🎤 Voice recording started - speak now!');
      
    } catch (error) {
      console.error('❌ Microphone access error:', error);
      setError('Microphone access denied. Please allow microphone access and try again.');
    }
  };

  const stopTranscription = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    clientRef.current?.stopTranscription();
    setState(prev => ({ ...prev, isTranscribing: false }));
    setCurrentTranscript('');
    addSystemMessage('🔇 Voice recording stopped');
  };

  const sendTextMessage = () => {
    if (!textInput.trim() || !clientRef.current) return;
    
    clientRef.current.sendTextInput(textInput);
    setTextInput('');
  };

  const sendCodeMessage = () => {
    if (!textInput.trim() || !clientRef.current) return;
    
    const message = codeInput.trim() ? 
      `${textInput}\n\nCode:\n${codeInput}` : textInput;
    
    clientRef.current.sendCodeInput(textInput, codeInput);
    addMessage('user', message, state.currentStage || undefined, !!codeInput.trim());
    setTextInput('');
    setCodeInput('');
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getStageColor = (stage?: string) => {
    const colors = {
      greet: 'bg-blue-500',
      resume: 'bg-green-500', 
      coding: 'bg-purple-500',
      cs: 'bg-yellow-500',
      behavioral: 'bg-pink-500',
      wrapup: 'bg-indigo-500',
      completed: 'bg-gray-500'
    };
    return colors[stage as keyof typeof colors] || 'bg-gray-400';
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-700 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-blue-400">Julius AI Interview</h1>
            {state.currentStage && (
              <span className={`px-3 py-1 rounded-full text-xs font-medium text-white ${getStageColor(state.currentStage)}`}>
                {state.currentStage.toUpperCase()}
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            <div className={`w-3 h-3 rounded-full ${state.isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-400">
              {state.isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chat Area */}
        <div className="lg:col-span-2 space-y-4">
          {/* Messages */}
          <div className="bg-gray-900 rounded-lg border border-gray-700">
            <div className="p-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-blue-400">Interview Conversation</h2>
            </div>
            
            <div className="h-96 overflow-y-auto p-4 space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.type === 'user'
                        ? 'bg-blue-600 text-white'
                        : message.type === 'system'
                        ? 'bg-gray-700 text-gray-300 text-sm'
                        : 'bg-gray-800 text-gray-100 border border-gray-600'
                    }`}
                  >
                    {message.isCode ? (
                      <pre className="whitespace-pre-wrap text-sm font-mono">
                        {message.content}
                      </pre>
                    ) : (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    )}
                    <div className="text-xs text-gray-400 mt-1">
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Current transcript */}
              {currentTranscript && (
                <div className="flex justify-end">
                  <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-blue-500 bg-opacity-50 text-white border-2 border-dashed border-blue-400">
                    <p className="whitespace-pre-wrap">{currentTranscript}</p>
                    <div className="text-xs text-blue-200 mt-1">Speaking...</div>
                  </div>
                </div>
              )}
              
              {/* Processing indicator */}
              {state.isProcessing && (
                <div className="flex justify-start">
                  <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-gray-700 text-gray-300">
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                      <span>Julius is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Audio generation indicator */}
              {state.isGeneratingAudio && (
                <div className="flex justify-start">
                  <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-gray-700 text-gray-300">
                    <div className="flex items-center space-x-2">
                      <div className="animate-pulse w-4 h-4 bg-green-500 rounded-full"></div>
                      <span>Generating audio...</span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Audio playing indicator */}
              {state.isPlayingAudio && (
                <div className="flex justify-start">
                  <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-gray-700 text-gray-300">
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1">
                        <div className="w-1 h-4 bg-green-500 animate-pulse"></div>
                        <div className="w-1 h-4 bg-green-500 animate-pulse delay-75"></div>
                        <div className="w-1 h-4 bg-green-500 animate-pulse delay-150"></div>
                      </div>
                      <span>Playing audio...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Area */}
          <div className="space-y-4">
            {/* Text Input */}
            <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (showCodeEditor ? sendCodeMessage() : sendTextMessage())}
                  placeholder="Type your message..."
                  className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                  disabled={!state.isConnected || state.isProcessing}
                />
                <button
                  onClick={showCodeEditor ? sendCodeMessage : sendTextMessage}
                  disabled={!textInput.trim() || !state.isConnected || state.isProcessing}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded-lg text-white font-medium transition-colors"
                >
                  Send
                </button>
              </div>
            </div>

            {/* Code Editor (shown during coding stage) */}
            {showCodeEditor && (
              <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-blue-400">Code Editor</h3>
                  <span className="text-xs text-gray-400">Coding Round Active</span>
                </div>
                <textarea
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  placeholder="// Write your code solution here..."
                  className="w-full h-32 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 font-mono text-sm focus:outline-none focus:border-blue-500"
                  disabled={!state.isConnected || state.isProcessing}
                />
                <div className="mt-2 text-xs text-gray-400">
                  💡 Tip: Explain your approach in the text field above, then submit your code here
                </div>
              </div>
            )}

            {/* Voice Controls */}
            <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={state.isTranscribing ? stopTranscription : startTranscription}
                    disabled={!state.isConnected}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                      state.isTranscribing
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-600'
                    }`}
                  >
                    <div className={`w-3 h-3 rounded-full ${state.isTranscribing ? 'bg-white' : 'bg-white'}`}></div>
                    <span>{state.isTranscribing ? 'Stop Recording' : 'Start Recording'}</span>
                  </button>
                  
                  {state.isTranscribing && (
                    <div className="flex items-center space-x-2 text-red-400">
                      <div className="animate-pulse w-2 h-2 bg-red-500 rounded-full"></div>
                      <span className="text-sm">Recording...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Resume Upload */}
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
            <h3 className="text-lg font-semibold text-blue-400 mb-3">Resume Upload</h3>
            
            {!state.resumeUploaded ? (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={handleResumeUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!state.sessionId}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-3 rounded-lg text-white font-medium transition-colors border-2 border-dashed border-blue-500 hover:border-blue-400"
                >
                  Upload Resume
                </button>
                <p className="text-xs text-gray-400 mt-2">
                  Supports PDF, DOC, DOCX, TXT (max 10MB)
                </p>
              </div>
            ) : (
              <div className="flex items-center space-x-2 text-green-400">
                <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
                <span className="text-sm">Resume uploaded successfully</span>
              </div>
            )}
          </div>

          {/* Interview Progress */}
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
            <h3 className="text-lg font-semibold text-blue-400 mb-3">Interview Progress</h3>
            
            <div className="space-y-2">
              {['greet', 'resume', 'coding', 'cs', 'behavioral', 'wrapup', 'completed'].map((stage) => (
                <div
                  key={stage}
                  className={`flex items-center space-x-3 p-2 rounded ${
                    state.currentStage === stage ? 'bg-blue-600' : 'bg-gray-800'
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full ${getStageColor(stage)}`}></div>
                  <span className={`text-sm ${
                    state.currentStage === stage ? 'text-white font-medium' : 'text-gray-400'
                  }`}>
                    {stage.charAt(0).toUpperCase() + stage.slice(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Report Data */}
          {reportData && (
            <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
              <h3 className="text-lg font-semibold text-blue-400 mb-3">Interview Results</h3>
              
              {reportData.scoring && (
                <div className="mb-3">
                  <div className="text-2xl font-bold text-green-400">
                    {reportData.scoring.overall.final_score}/100
                  </div>
                  <div className="text-sm text-gray-400">
                    Recommendation: {reportData.scoring.overall.recommendation}
                  </div>
                </div>
              )}
              
              {reportData.recommendation && (
                <div>
                  <div className="text-sm text-gray-300">
                    {reportData.recommendation.recommendations.length} feedback categories
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-900 border border-red-700 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-xs">!</span>
                </div>
                <div className="flex-1">
                  <div className="text-red-400 font-medium mb-1">Connection Error</div>
                  <div className="text-red-300 text-sm whitespace-pre-line">{error}</div>
                </div>
              </div>
              <div className="flex space-x-2 mt-3">
                <button
                  onClick={() => setError(null)}
                  className="text-red-400 hover:text-red-300 text-sm underline"
                >
                  Dismiss
                </button>
                <button
                  onClick={() => {
                    setError(null);
                    initializeWebSocket();
                  }}
                  className="text-red-400 hover:text-red-300 text-sm underline"
                >
                  Retry Connection
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden audio element for TTS */}
      <audio ref={audioRef} className="hidden" />
    </div>
  );
}
