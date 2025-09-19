'use client';

import React, { useEffect, useRef, useState } from 'react';
import CodeEditor from '@/app/components/CodeEditor';
import { InterviewWebSocketClient } from '@/lib/utils/interviewWebSocketClient';
import { InterviewStage } from '@/lib/services/orchestrator';

export default function DebugCodingPage() {
  const clientRef = useRef<InterviewWebSocketClient | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<{id:string, role:string, text:string}[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  useEffect(() => {
    const client = new InterviewWebSocketClient('ws://localhost:8080');
    clientRef.current = client;

    client.on('connected', (data:any) => {
      setConnected(true);
      setSessionId(data.sessionId || null);
      pushMessage('system', `Connected - session ${data.sessionId}`);
    });

    client.on('stage_changed', (data:any) => {
      pushMessage('system', `Stage changed ${data.previousStage} -> ${data.newStage}`);
      setShowEditor(data.newStage === 'coding');
    });

    client.on('partial_transcript', (d:any) => {
      pushMessage('user', `(partial) ${d.transcript || d.text || ''}`);
    });

    client.on('final_transcript', (d:any) => {
      pushMessage('user', `(final) ${d.transcript || d.text || ''}`);
    });

    client.on('agent_response', (d:any) => {
      pushMessage('assistant', d.response.assistant_message || JSON.stringify(d.response));
    });

    client.on('server_error', (d:any) => pushMessage('system', `Server error: ${d.message}`));

    return () => client.disconnect();
  }, []);

  function pushMessage(role:string, text:string) {
    setMessages(prev => [...prev, { id: String(Date.now()) + Math.random(), role, text }]);
  }

  // Controls
  const startTranscription = () => clientRef.current?.startTranscription();
  const stopTranscription = () => clientRef.current?.stopTranscription();
  const enterCodingStage = () => {
    // Tell backend we're in coding stage
    clientRef.current?.sendStageChange('coding');
  };
  const leaveCodingStage = () => clientRef.current?.sendStageChange('cs');

  const handleCodeKeystroke = (code:string, language:string) => {
    clientRef.current?.sendCodeKeystroke(code, language);
  };

  const handleCodeSubmit = async (code:string, language:string, explanation:string) => {
    const message = explanation.trim() ? `${explanation}\n\nCode:\n\`\`\`${language}\n${code}\n\`\`\`` : `Code:\n\`\`\`${language}\n${code}\n\`\`\``;
    clientRef.current?.sendCodeInput(message, code, language, explanation);
    pushMessage('user', 'Submitted code — check server invocation');
  };

  return (
    <div className="p-6 text-white bg-black min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Debug: Coding Stage</h1>

      <div className="flex gap-2 mb-4">
        <button onClick={startTranscription} className="px-3 py-1 bg-green-600 rounded">Start Transcription</button>
        <button onClick={stopTranscription} className="px-3 py-1 bg-yellow-600 rounded">Stop Transcription</button>
        <button onClick={enterCodingStage} className="px-3 py-1 bg-purple-600 rounded">Enter Coding Stage</button>
        <button onClick={leaveCodingStage} className="px-3 py-1 bg-gray-600 rounded">Leave Coding Stage</button>
      </div>

      <div className="mb-6">
        <strong>Connected:</strong> {connected ? 'yes' : 'no'} &nbsp;
        <strong>Session:</strong> {sessionId || 'n/a'}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 p-4 rounded">
          <h2 className="font-semibold mb-2">Messages</h2>
          <div className="h-96 overflow-y-auto p-2 bg-black/30 rounded">
            {messages.map(m => (
              <div key={m.id} className="mb-2">
                <div className="text-xs text-gray-400">{m.role}</div>
                <div className="text-sm">{m.text}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-900 p-4 rounded">
          <h2 className="font-semibold mb-2">Code Editor (coding stage only)</h2>
          {showEditor ? (
            <CodeEditor
              value={''}
              onChange={() => {}}
              onKeystroke={handleCodeKeystroke}
              onSubmit={handleCodeSubmit}
            />
          ) : (
            <div className="text-gray-400">Editor hidden — enter coding stage to enable</div>
          )}
        </div>
      </div>
    </div>
  );
}
