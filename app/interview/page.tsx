'use client';

import React, { useState, useEffect, useRef } from 'react';
import { InterviewWebSocketClient, uploadResume, getInterviewStage, generateReport } from '@/lib/utils/interviewWebSocketClient';
import { testWebSocketConnection, diagnoseConnectionIssue, getWebSocketServerInstructions } from '@/lib/utils/websocketHealth';
import { InterviewStage } from '@/lib/services/orchestrator';
import CodeEditor from '@/app/components/CodeEditor';
import { Mic, MicOff, CheckCircle, X, Lightbulb, Zap, Volume2, VolumeX, Play, Square, Upload, FileText, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

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
  const [user, setUser] = useState<any>(() => {
    try {
      if (typeof window === 'undefined') return null;
      const raw = localStorage.getItem('julius_user');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  });

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
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const clientRef = useRef<InterviewWebSocketClient | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    // Check authentication
    if (!user) {
      window.location.href = '/profile';
      return;
    }

    initializeWebSocket();
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
      }
    };
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);


  const initializeWebSocket = async () => {
    try {
      const client = new InterviewWebSocketClient('ws://localhost:8080');
      clientRef.current = client;

      client.on('connected', (data: any) => {
        console.log('Connected event received:', data);
        const sessionId = data?.sessionId || `session_${Date.now()}`;
        setState(prev => ({
          ...prev,
          isConnected: true,
          sessionId
        }));
        addSystemMessage('Connected to interview system');

        // Send start message with sessionId and userId
        if (user?._id) {
          client.startTranscription(sessionId, user._id);
        }
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
              addSystemMessage('Code editor enabled. You can now proceed to the coding challenge.');
            } else {
              setShowCodeEditor(false);
            }

            return { ...prev, currentStage: data.newStage };
          }
          return prev;
        });
      });

      client.on('partial_transcript', (data: any) => {
        try {
          const t = data?.transcript ?? data?.text ?? '';
          if (!t) {
            console.warn('Received partial_transcript with empty payload:', data);
            return;
          }
          console.log('UI received partial_transcript:', t);
          setCurrentTranscript(String(t));
        } catch (e) {
          console.error('Error handling partial_transcript:', e, data);
        }
      });

      client.on('final_transcript', (data: any) => {
        try {
          console.log('UI received final_transcript:', data);
          const t = data?.transcript ?? data?.text ?? '';
          if (t) {
            addMessage('user', String(t));
          }
          setCurrentTranscript('');
        } catch (e) {
          console.error('Error handling final_transcript:', e, data);
        }
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

      // Fallback: browser TTS if server-side TTS fails or is not available
      client.on('speak_text', (data: any) => {
        try {
          const text = data?.text || '';
          if (!text) return;
          setState(prev => ({ ...prev, isGeneratingAudio: false, isPlayingAudio: true }));

          const utterance = new SpeechSynthesisUtterance(text);
          utterance.onend = () => {
            setState(prev => ({ ...prev, isPlayingAudio: false }));
            if (clientRef.current) clientRef.current.notifyAudioPlaybackFinished();
            addSystemMessage('Ready to listen - you can speak now');
            if (!state.isTranscribing && state.isConnected) {
              setTimeout(() => startTranscription(), 500);
            }
          };
          speechSynthesis.cancel();
          speechSynthesis.speak(utterance);
        } catch (err) {
          console.error('Browser TTS error:', err);
          if (clientRef.current) clientRef.current.notifyAudioPlaybackFinished();
        }
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
        addSystemMessage('You can now speak');
      });

      client.on('transcription_blocked', (data: any) => {
        // Keep this as a console/debug message only to avoid polluting the UI
        console.debug('Transcription blocked (silently):', data?.message);
      });

      client.on('stop_recording', (data: any) => {
        console.log('Server requested to stop recording:', data?.message);
        if (mediaRecorderRef.current) {
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current = null;
        }
        setState(prev => ({ ...prev, isTranscribing: false }));
      });

      client.on('start_recording', (data: any) => {
        console.log('Server requested to start recording:', data?.message);
        // Always attempt to start recording when server requests it, regardless of current state
        // The server knows when TTS has finished and it's safe to record again
        setTimeout(() => {
          // Inline the startTranscription logic here since we can't call it directly
          (async () => {
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
          })();
        }, 500); // Small delay to ensure clean transition
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
          
          // AUTO-RESUME TRANSCRIPTION AFTER JULIUS STOPS SPEAKING
          console.log('Audio playback finished - auto-resuming transcription');
          addSystemMessage('Ready to listen - you can speak now');
          
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
      
      // AUTO-RESUME TRANSCRIPTION EVEN ON AUDIO ERROR
      console.log('Audio error - auto-resuming transcription');
      addSystemMessage('Ready to listen - you can speak now');
      
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
    if (!file || !state.sessionId || !user?._id) return;

    try {
      setError(null);
      const result = await uploadResume(file, state.sessionId, user._id);
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

  const startCodingTest = () => {
    try {
      // Notify the server/orchestrator to move to coding stage
      if (clientRef.current) {
        clientRef.current.sendStageChange('coding');
      }
      // Open the coding test (curator) in a new tab so the candidate sees the coding UI
      window.open(`/coding-test/test?sessionId=${state.sessionId}`, '_blank');
      addSystemMessage('Starting coding test...');
    } catch (e) {
      console.error('Failed to start coding test', e);
      addSystemMessage('Failed to start coding test.');
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
      console.log('Starting audio capture...');

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

      console.log('Microphone access granted');

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
          console.log('Stopping audio capture...');
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
      addSystemMessage('Voice recording started - speak now!');

    } catch (error) {
      console.error('Microphone access error:', error);
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
    addSystemMessage('Voice recording stopped');
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

  const handleCodeSubmission = async (code: string, language: string, explanation?: string) => {
    if (!clientRef.current) return;
    
    // Combine explanation and code into a comprehensive message
    const explanationText = (explanation || '').trim();
    const fullMessage = explanationText
      ? `${explanationText}\n\nCode Solution (${language}):\n\`\`\`${language}\n${code}\n\`\`\``
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
      greet: 'bg-gradient-to-r from-purple-500 to-pink-500',
      resume: 'bg-gradient-to-r from-purple-400 to-indigo-500', 
      coding: 'bg-gradient-to-r from-purple-500 to-violet-500',
      cs: 'bg-gradient-to-r from-indigo-500 to-purple-500',
      behavioral: 'bg-gradient-to-r from-pink-500 to-purple-500',
      wrapup: 'bg-gradient-to-r from-violet-500 to-purple-500',
      completed: 'bg-gradient-to-r from-gray-500 to-purple-600'
    };
    return colors[stage as keyof typeof colors] || 'bg-gradient-to-r from-gray-400 to-purple-600';
  };

  return (
    <div className="min-h-screen bg-white text-black overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 opacity-12">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-400/12 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/12 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>
  {/* Header */}
  <div className="glass-effect border-b border-gray-200/30 p-4 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 hero-accent rounded-lg flex items-center justify-center overflow-hidden">
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#6B21A8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: 'white', fontWeight: 700 }}>JA</span>
                </div>
              </div>
              <h1 className="text-2xl font-bold accent-text">Julius AI Interview</h1>
            </div>
            {state.currentStage && (
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStageColor(state.currentStage)}`}>
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
          <div className="glass-effect rounded-xl border border-gray-200/30">
            <div className="p-4 border-b border-gray-200/20">
              <h2 className="text-lg font-semibold text-purple-700">Interview Conversation</h2>
            </div>
            
            <div className="h-[600px] overflow-y-auto p-4 space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.type === 'user'
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                        : message.type === 'system'
                        ? 'bg-purple-50 text-purple-700 text-sm border border-purple-200'
                        : 'bg-gray-50 text-gray-800 border border-gray-200'
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
                  <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-purple-500/20 text-purple-800 border-2 border-dashed border-purple-400 purple-glow">
                    <p className="whitespace-pre-wrap">{currentTranscript}</p>
                    <div className="text-xs text-purple-600 mt-1">Speaking...</div>
                  </div>
                </div>
              )}
              
              {/* Processing indicator */}
              {state.isProcessing && (
                <div className="flex justify-start">
                  <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg glass-effect text-gray-700 border border-purple-400/30">
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-400"></div>
                      <span>Julius is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Audio generation indicator */}
              {state.isGeneratingAudio && (
                <div className="flex justify-start">
                  <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg glass-effect text-gray-700 border border-purple-400/30">
                    <div className="flex items-center space-x-2">
                      <div className="animate-pulse w-4 h-4 bg-purple-400 rounded-full shadow-lg shadow-purple-400/50"></div>
                      <span>Generating audio...</span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Audio playing indicator */}
              {state.isPlayingAudio && (
                <div className="flex justify-start">
                  <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg glass-effect text-gray-700 border border-purple-400/30">
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1">
                        <div className="w-1 h-4 bg-purple-400 animate-pulse shadow-lg shadow-purple-400/50"></div>
                        <div className="w-1 h-4 bg-purple-400 animate-pulse delay-75 shadow-lg shadow-purple-400/50"></div>
                        <div className="w-1 h-4 bg-purple-400 animate-pulse delay-150 shadow-lg shadow-purple-400/50"></div>
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
            <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 p-4">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendTextMessage()}
                  placeholder={showCodeEditor ? "Ask a question about the problem..." : "Type your message..."}
                  className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-black placeholder-gray-500 focus:outline-none focus:border-purple-400 focus:shadow-lg focus:shadow-purple-400/20"
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
                <div className="mt-2 text-xs text-purple-600 flex items-center">
                  <Lightbulb className="w-3 h-3 mr-1" />
                  Use this to ask questions about the problem. Submit your code solution using the editor below.
                </div>
              )}
            </div>

            {/* Code Editor (shown during coding stage) */}
            {showCodeEditor && (
              <CodeEditor
                value={codeInput}
                onChange={setCodeInput}
                onSubmit={handleCodeSubmission}
                className="mb-4"
              />
            )}

            {/* Voice Controls */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 p-4">
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
          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 p-4">
            <h3 className="text-lg font-semibold text-purple-700 mb-3">Resume Upload</h3>
            
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
                  className="w-full btn-electric px-4 py-3 font-medium border-2 border-dashed border-purple-400 hover:border-purple-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Upload Resume
                </button>
                <p className="text-xs text-gray-400 mt-2">
                  Supports PDF, DOC, DOCX, TXT (max 10MB)
                </p>
              </div>
            ) : (
              <div className="flex items-center space-x-2 text-green-400">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-sm">Resume uploaded successfully</span>
              </div>
            )}
              {/* Start Coding Test Button - Show when interview is completed */}
              {state.currentStage === 'completed' && (
                <div className="mt-3">
                  <button
                    onClick={startCodingTest}
                    disabled={!state.isConnected}
                    className="w-full btn-primary px-4 py-3 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Start Coding Challenge
                  </button>
                </div>
              )}
          </div>

          {/* Interview Progress */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 p-4">
            <h3 className="text-lg font-semibold text-purple-700 mb-4">Interview Journey</h3>
            
            {/* Tree-like Progress Structure */}
            <div className="relative">
              {/* Vertical Connection Line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-purple-400 via-pink-500 to-purple-400 opacity-40"></div>
              
              <div className="space-y-3">
                {[
                  { key: 'greet', name: 'Greeting', description: 'Welcome & Introduction' },
                  { key: 'resume', name: 'Resume Review', description: 'Project Discussion' },
                  { key: 'cs', name: 'CS Fundamentals', description: 'DBMS, OS, Networks' },
                  { key: 'behavioral', name: 'Behavioral', description: 'Culture & Teamwork' },
                  { key: 'wrapup', name: 'Wrap-up', description: 'Final Thoughts' },
                  { key: 'completed', name: 'Interview Complete', description: 'Access coding challenge' }
                ].map((stage, index) => {
                  const isActive = state.currentStage === stage.key;
                  const isPassed = ['greet', 'resume', 'cs', 'behavioral', 'wrapup', 'coding'].indexOf(state.currentStage || '') > 
                                   ['greet', 'resume', 'cs', 'behavioral', 'wrapup', 'coding'].indexOf(stage.key);
                  const isCompleted = stage.key === 'completed' && state.currentStage === 'completed';
                  
                  return (
                    <div key={stage.key} className="relative flex items-start space-x-3">
                      {/* Stage Node */}
                      <div className="relative z-10">
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                          isCompleted ? 'bg-green-400 border-green-400 shadow-lg shadow-green-400/30' :
                          isPassed ? 'bg-purple-400 border-purple-400 shadow-lg shadow-purple-400/30' :
                          isActive ? 'bg-purple-400 border-purple-400 shadow-lg shadow-purple-400/50 animate-pulse' :
                          'bg-gray-300 border-gray-400'
                        }`}>
                          {isCompleted || isPassed ? (
                            <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : isActive ? (
                            <div className="w-3 h-3 bg-purple-700 rounded-full"></div>
                          ) : (
                            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                          )}
                        </div>
                      </div>

                      {/* Stage Content */}
                      <div className={`flex-1 pb-3 ${isActive ? '' : ''}`}>
                        <div className={`bg-white/60 rounded-lg p-3 border transition-all duration-300 ${
                          isActive ? 'border-purple-400/50 bg-purple-50/50' : 
                          isPassed || isCompleted ? 'border-green-400/30 bg-green-50/30' :
                          'border-gray-200'
                        }`}>
                          <h4 className={`font-medium text-sm ${
                            isCompleted ? 'text-green-600' :
                            isPassed ? 'text-purple-600' :
                            isActive ? 'text-purple-700' :
                            'text-gray-500'
                          }`}>
                            {stage.name}
                          </h4>
                          <p className="text-xs text-gray-600 mt-1">{stage.description}</p>
                          
                          {/* Status Badge */}
                          {(isActive || isPassed || isCompleted) && (
                            <div className={`inline-flex items-center mt-2 px-2 py-1 rounded-full text-xs font-medium ${
                              isCompleted ? 'bg-green-900/30 text-green-400 border border-green-400/20' :
                              isPassed ? 'bg-purple-900/30 text-purple-400 border border-purple-400/20' :
                              'bg-purple-900/30 text-purple-400 border border-purple-400/30 purple-glow'
                            }`}>
                              {isCompleted ? (
                                <>
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Complete
                                </>
                              ) : isPassed ? (
                                <>
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Passed
                                </>
                              ) : (
                                <>
                                  <Zap className="w-3 h-3 mr-1" />
                                  Current
                                </>
                              )}
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
          <div className="mb-4">
            {/* Button to view / generate report for current session */}
            <div className="glass-effect rounded-xl border border-gray-200/30 p-3 mb-3">
              <h3 className="text-sm font-semibold text-purple-700 mb-2">Interview Report</h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={async () => {
                    if (!state.sessionId || !state.resumeFilePath) {
                      setReportError('Session ID or resume not available. Upload resume and ensure you are connected.');
                      return;
                    }
                    setReportError(null);
                    setReportLoading(true);
                    try {
                      const res = await generateReport(state.sessionId, state.resumeFilePath, 'full');
                      setReportData(res);
                    } catch (err: any) {
                      setReportError(err?.message || 'Failed to generate report');
                    } finally {
                      setReportLoading(false);
                    }
                  }}
                  className="btn-electric px-3 py-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!state.sessionId || !state.resumeFilePath || reportLoading}
                >
                  {reportLoading ? (
                    <span className="flex items-center space-x-2">
                      <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                      </svg>
                      <span>Preparing report...</span>
                    </span>
                  ) : (
                    'View Report'
                  )}
                </button>

                <button
                  onClick={() => { setReportData(null); setReportError(null); }}
                  className="btn-outline-electric px-3 py-2 text-sm"
                >
                  Clear
                </button>
              </div>
              {reportError && <div className="text-xs text-red-400 mt-2">{reportError}</div>}
            </div>

            {reportData && (
              <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 p-4">
                <h3 className="text-lg font-semibold text-purple-700 mb-4">Interview Results</h3>

                {reportData.scoring && (
                  <div className="mb-4">
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                      <div className="flex items-center space-x-3">
                        <div className="text-3xl font-bold text-green-600">
                          {reportData.scoring.overall.final_score}/100
                        </div>
                        <div>
                          <div className="text-sm text-gray-600 font-medium">Overall Score</div>
                          <div className="text-xs text-purple-600">Recommendation: {reportData.scoring.overall.recommendation}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {reportData.recommendation && (
                  <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                    <h4 className="text-sm font-medium text-purple-700 mb-2">Recommendations</h4>
                    <div className="space-y-3">
                      {reportData.recommendation.recommendations.map((r: any, idx: number) => (
                        <div key={idx} className="p-3 bg-white border border-purple-100 rounded-md">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="text-sm font-semibold text-gray-800">{r.category}</div>
                              <div className="text-xs text-gray-600 mt-1">{r.overallSummary}</div>
                            </div>
                          </div>
                          <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-gray-700">
                            <div>
                              <div className="font-medium text-green-600">Strengths</div>
                              <ul className="list-disc pl-4 mt-1">{r.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                            </div>
                            <div>
                              <div className="font-medium text-orange-600">Areas to Improve</div>
                              <ul className="list-disc pl-4 mt-1">{r.areasOfImprovement.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                            </div>
                            <div>
                              <div className="font-medium text-green-300">Actionable Tips</div>
                              <ul className="list-disc pl-4 mt-1">{r.actionableTips.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="text-xs text-gray-600">Final Advice: {reportData.recommendation.finalAdvice}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 rounded-xl border border-red-200 p-4">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg shadow-red-500/30">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="text-red-700 font-medium mb-2">Connection Error</div>
                  <div className="text-red-600 text-sm whitespace-pre-line leading-relaxed">{error}</div>
                </div>
              </div>
              <div className="flex space-x-3 mt-4">
                <button
                  onClick={() => setError(null)}
                  className="border border-red-400 text-red-600 hover:bg-red-100 px-4 py-2 rounded-lg text-sm"
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
