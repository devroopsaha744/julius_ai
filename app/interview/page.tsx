'use client';

import React, { useState, useEffect, useRef } from 'react';
import { InterviewWebSocketClient, uploadResume, getInterviewStage, generateReport } from '@/lib/utils/interviewWebSocketClient';
import { testWebSocketConnection, diagnoseConnectionIssue, getWebSocketServerInstructions } from '@/lib/utils/websocketHealth';
import { InterviewStage } from '@/lib/services/orchestrator';
import CodeEditor from '@/app/components/CodeEditor';

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
            
            // Notify server of stage change for dual-stream tracking
            if (clientRef.current) {
              clientRef.current.sendStageChange(data.newStage);
            }
            
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

      client.on('server_error', (data: any) => {
        console.error('Server error:', data);
        const errorMessage = data?.message || 'Server error occurred';
        setError(`Server Error: ${errorMessage}`);
        setState(prev => ({ ...prev, isProcessing: false }));
        addSystemMessage(`Server error: ${errorMessage}`);
      });

      client.on('error', (data: any) => {
        console.error('WebSocket connection error:', data);
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

      // Handle new audio playback messages
      client.on('audio_playback_started', () => {
        console.log('Audio playback started');
      });

      client.on('microphone_enabled', (data: any) => {
        console.log('Microphone enabled:', data.message);
        addSystemMessage('✅ You can now speak');
      });

      client.on('transcription_blocked', (data: any) => {
        console.log('Transcription blocked:', data.message);
        addSystemMessage(`🚫 ${data.message}`);
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
          
          // Notify server that audio playback is finished
          if (clientRef.current) {
            clientRef.current.notifyAudioPlaybackFinished();
          }
          
          // 🎯 AUTO-RESUME TRANSCRIPTION AFTER JULIUS STOPS SPEAKING
          console.log('🎤 Audio playback finished - auto-resuming transcription');
          addSystemMessage('🎤 Ready to listen - you can speak now');
          
          // Auto-start transcription if not already running
          if (!state.isTranscribing && state.isConnected) {
            setTimeout(() => {
              startTranscription();
            }, 500); // Small delay to ensure clean transition
          }
        };
        await audioRef.current.play();
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      setState(prev => ({ ...prev, isPlayingAudio: false }));
      
      // Notify server even on error to prevent permanent blocking
      if (clientRef.current) {
        clientRef.current.notifyAudioPlaybackFinished();
      }
      
      // 🎯 AUTO-RESUME TRANSCRIPTION EVEN ON AUDIO ERROR
      console.log('🎤 Audio error - auto-resuming transcription');
      addSystemMessage('🎤 Ready to listen - you can speak now');
      
      // Auto-start transcription if not already running
      if (!state.isTranscribing && state.isConnected) {
        setTimeout(() => {
          startTranscription();
        }, 500);
      }
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

  // Helper function to determine microphone state
  const getMicrophoneState = () => {
    if (!state.isConnected) {
      return { blocked: true, reason: 'Not connected' };
    }
    if (state.isProcessing) {
      return { blocked: true, reason: 'Julius is thinking...' };
    }
    if (state.isGeneratingAudio) {
      return { blocked: true, reason: 'Generating audio...' };
    }
    if (state.isPlayingAudio) {
      return { blocked: true, reason: 'Julius speaking (auto-resume after)' };
    }
    return { blocked: false, reason: '' };
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

  const handleCodeSubmission = async (code: string, language: string, explanation: string) => {
    if (!clientRef.current) return;
    
    // Combine explanation and code into a comprehensive message
    const fullMessage = explanation.trim() 
      ? `${explanation}\n\nCode Solution (${language}):\n\`\`\`${language}\n${code}\n\`\`\``
      : `Code Solution (${language}):\n\`\`\`${language}\n${code}\n\`\`\``;
    
    // Send through WebSocket with language and explanation metadata
    clientRef.current.sendCodeInput(fullMessage, code, language, explanation);
    
    // Add to message history
    addMessage('user', fullMessage, state.currentStage || undefined, true);
    
    // Clear any text input
    setTextInput('');
  };

  const handleCodeKeystroke = (code: string, language: string) => {
    if (!clientRef.current) return;
    
    // Send keystroke events to server for dual-stream tracking
    clientRef.current.sendCodeKeystroke(code, language);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getStageColor = (stage?: string) => {
    const colors = {
      greet: 'bg-gradient-to-r from-cyan-500 to-blue-500',
      resume: 'bg-gradient-to-r from-green-400 to-cyan-500', 
      coding: 'bg-gradient-to-r from-purple-500 to-cyan-500',
      cs: 'bg-gradient-to-r from-yellow-400 to-cyan-500',
      behavioral: 'bg-gradient-to-r from-pink-500 to-cyan-500',
      wrapup: 'bg-gradient-to-r from-indigo-500 to-cyan-500',
      completed: 'bg-gradient-to-r from-gray-500 to-cyan-600'
    };
    return colors[stage as keyof typeof colors] || 'bg-gradient-to-r from-gray-400 to-cyan-600';
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="glass-effect border-b border-gray-800/50 p-4 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-black font-bold text-xl">J</span>
              </div>
              <h1 className="text-2xl font-bold electric-text">Julius AI Interview</h1>
            </div>
            {state.currentStage && (
              <span className={`px-3 py-1 rounded-full text-xs font-medium text-white electric-glow ${getStageColor(state.currentStage)}`}>
                {state.currentStage.toUpperCase()}
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            <div className={`w-3 h-3 rounded-full ${state.isConnected ? 'bg-green-400 shadow-lg shadow-green-400/50' : 'bg-red-500'}`}></div>
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
          <div className="glass-effect rounded-xl border border-gray-800/50">
            <div className="p-4 border-b border-gray-800/50">
              <h2 className="text-lg font-semibold electric-text">Interview Conversation</h2>
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
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white electric-glow'
                        : message.type === 'system'
                        ? 'glass-effect text-cyan-300 text-sm border border-cyan-400/30'
                        : 'glass-effect text-gray-100 border border-gray-600/50'
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
                  <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-cyan-500/20 text-white border-2 border-dashed border-cyan-400 electric-glow">
                    <p className="whitespace-pre-wrap">{currentTranscript}</p>
                    <div className="text-xs text-cyan-200 mt-1">Speaking...</div>
                  </div>
                </div>
              )}
              
              {/* Processing indicator */}
              {state.isProcessing && (
                <div className="flex justify-start">
                  <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg glass-effect text-gray-300 border border-cyan-400/30">
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-cyan-400"></div>
                      <span>Julius is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Audio generation indicator */}
              {state.isGeneratingAudio && (
                <div className="flex justify-start">
                  <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg glass-effect text-gray-300 border border-green-400/30">
                    <div className="flex items-center space-x-2">
                      <div className="animate-pulse w-4 h-4 bg-green-400 rounded-full shadow-lg shadow-green-400/50"></div>
                      <span>Generating audio...</span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Audio playing indicator */}
              {state.isPlayingAudio && (
                <div className="flex justify-start">
                  <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg glass-effect text-gray-300 border border-blue-400/30">
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1">
                        <div className="w-1 h-4 bg-blue-400 animate-pulse shadow-lg shadow-blue-400/50"></div>
                        <div className="w-1 h-4 bg-blue-400 animate-pulse delay-75 shadow-lg shadow-blue-400/50"></div>
                        <div className="w-1 h-4 bg-blue-400 animate-pulse delay-150 shadow-lg shadow-blue-400/50"></div>
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
            <div className="glass-effect rounded-xl border border-gray-800/50 p-4">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendTextMessage()}
                  placeholder={showCodeEditor ? "Ask a question about the problem..." : "Type your message..."}
                  className="flex-1 bg-black/40 border border-gray-600/50 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 focus:shadow-lg focus:shadow-cyan-400/20"
                  disabled={!state.isConnected || state.isProcessing}
                />
                <button
                  onClick={sendTextMessage}
                  disabled={!textInput.trim() || !state.isConnected || state.isProcessing}
                  className="btn-electric px-4 py-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {showCodeEditor ? 'Ask' : 'Send'}
                </button>
              </div>
              {showCodeEditor && (
                <div className="mt-2 text-xs text-cyan-300">
                  💡 Use this to ask questions about the problem. Submit your code solution using the editor below.
                </div>
              )}
            </div>

            {/* Code Editor (shown during coding stage) */}
            {showCodeEditor && (
              <CodeEditor
                value={codeInput}
                onChange={setCodeInput}
                onSubmit={handleCodeSubmission}
                onKeystroke={handleCodeKeystroke}
                disabled={!state.isConnected || state.isProcessing}
                className="mb-4"
              />
            )}

            {/* Voice Controls */}
            <div className="glass-effect rounded-xl border border-gray-800/50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {(() => {
                    const micState = getMicrophoneState();
                    return (
                      <button
                        onClick={state.isTranscribing ? stopTranscription : startTranscription}
                        disabled={micState.blocked}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all ${
                          state.isTranscribing
                            ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/30'
                            : micState.blocked
                            ? 'bg-yellow-600 text-white cursor-not-allowed shadow-lg shadow-yellow-500/30'
                            : 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/30'
                        }`}
                      >
                        <div className={`w-3 h-3 rounded-full ${
                          state.isTranscribing 
                            ? 'bg-white animate-pulse' 
                            : micState.blocked 
                            ? 'bg-white animate-pulse' 
                            : 'bg-white'
                        }`}></div>
                        <span>
                          {state.isTranscribing 
                            ? 'Stop Recording' 
                            : micState.blocked 
                            ? (state.isPlayingAudio ? 'Auto-resuming after Julius...' : micState.reason)
                            : 'Start Recording'
                          }
                        </span>
                      </button>
                    );
                  })()}
                  
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
          <div className="glass-effect rounded-xl border border-gray-800/50 p-4">
            <h3 className="text-lg font-semibold electric-text mb-3">Resume Upload</h3>
            
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
                  className="w-full btn-electric px-4 py-3 font-medium border-2 border-dashed border-cyan-400 hover:border-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="glass-effect rounded-xl border border-gray-800/50 p-4">
            <h3 className="text-lg font-semibold electric-text mb-4">Interview Journey</h3>
            
            {/* Tree-like Progress Structure */}
            <div className="relative">
              {/* Vertical Connection Line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-cyan-400 via-blue-500 to-cyan-400 opacity-40"></div>
              
              <div className="space-y-3">
                {[
                  { key: 'greet', name: 'Greeting', description: 'Welcome & Introduction' },
                  { key: 'resume', name: 'Resume Review', description: 'Project Discussion' },
                  { key: 'coding', name: 'Coding Challenge', description: 'Algorithm & DSA' },
                  { key: 'cs', name: 'CS Fundamentals', description: 'DBMS, OS, Networks' },
                  { key: 'behavioral', name: 'Behavioral', description: 'Culture & Teamwork' },
                  { key: 'wrapup', name: 'Wrap-up', description: 'Final Thoughts' },
                  { key: 'completed', name: 'Completed', description: 'Interview Finished' }
                ].map((stage, index) => {
                  const isActive = state.currentStage === stage.key;
                  const isPassed = ['greet', 'resume', 'coding', 'cs', 'behavioral', 'wrapup'].indexOf(state.currentStage || '') > 
                                   ['greet', 'resume', 'coding', 'cs', 'behavioral', 'wrapup'].indexOf(stage.key);
                  const isCompleted = stage.key === 'completed' && state.currentStage === 'completed';
                  
                  return (
                    <div key={stage.key} className="relative flex items-start space-x-3">
                      {/* Stage Node */}
                      <div className="relative z-10">
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                          isCompleted ? 'bg-green-400 border-green-400 shadow-lg shadow-green-400/30' :
                          isPassed ? 'bg-cyan-400 border-cyan-400 shadow-lg shadow-cyan-400/30' :
                          isActive ? 'bg-cyan-400 border-cyan-400 shadow-lg shadow-cyan-400/50 electric-glow animate-pulse' :
                          'bg-gray-700 border-gray-600'
                        }`}>
                          {isCompleted || isPassed ? (
                            <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : isActive ? (
                            <div className="w-3 h-3 bg-black rounded-full"></div>
                          ) : (
                            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                          )}
                        </div>
                      </div>

                      {/* Stage Content */}
                      <div className={`flex-1 pb-3 ${isActive ? 'electric-glow' : ''}`}>
                        <div className={`glass-effect rounded-lg p-3 card-hover transition-all duration-300 ${
                          isActive ? 'border-cyan-400/50 bg-cyan-900/10' : 
                          isPassed || isCompleted ? 'border-green-400/30 bg-green-900/5' :
                          'border-gray-700/50'
                        }`}>
                          <h4 className={`font-medium text-sm ${
                            isCompleted ? 'text-green-400' :
                            isPassed ? 'text-cyan-300' :
                            isActive ? 'text-cyan-400' :
                            'text-gray-400'
                          }`}>
                            {stage.name}
                          </h4>
                          <p className="text-xs text-gray-500 mt-1">{stage.description}</p>
                          
                          {/* Status Badge */}
                          {(isActive || isPassed || isCompleted) && (
                            <div className={`inline-flex items-center mt-2 px-2 py-1 rounded-full text-xs font-medium ${
                              isCompleted ? 'bg-green-900/30 text-green-400 border border-green-400/20' :
                              isPassed ? 'bg-cyan-900/30 text-cyan-400 border border-cyan-400/20' :
                              'bg-cyan-900/30 text-cyan-400 border border-cyan-400/30 electric-glow'
                            }`}>
                              {isCompleted ? '✓ Complete' :
                               isPassed ? '✓ Passed' :
                               '⚡ Current'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Report Data */}
          {reportData && (
            <div className="glass-effect rounded-xl border border-gray-800/50 p-4">
              <h3 className="text-lg font-semibold electric-text mb-4">Interview Results</h3>
              
              {reportData.scoring && (
                <div className="mb-4">
                  <div className="glass-effect rounded-lg p-4 bg-gradient-to-r from-green-900/20 to-cyan-900/20 border border-green-400/30">
                    <div className="flex items-center space-x-3">
                      <div className="text-3xl font-bold text-green-400 electric-glow">
                        {reportData.scoring.overall.final_score}/100
                      </div>
                      <div>
                        <div className="text-sm text-gray-300 font-medium">Overall Score</div>
                        <div className="text-xs text-cyan-400">
                          Recommendation: {reportData.scoring.overall.recommendation}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {reportData.recommendation && (
                <div className="glass-effect rounded-lg p-3 border border-cyan-400/20">
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div className="text-sm text-cyan-300 font-medium">
                      {reportData.recommendation.recommendations.length} feedback categories available
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="glass-effect rounded-xl border border-red-400/50 p-4 bg-red-900/20">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg shadow-red-500/30">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="text-red-400 font-medium mb-2">Connection Error</div>
                  <div className="text-red-300 text-sm whitespace-pre-line leading-relaxed">{error}</div>
                </div>
              </div>
              <div className="flex space-x-3 mt-4">
                <button
                  onClick={() => setError(null)}
                  className="btn-outline-electric text-sm px-4 py-2 border-red-400 text-red-400 hover:bg-red-400/10"
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
