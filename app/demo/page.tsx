'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function DemoPage() {
  const [activeTab, setActiveTab] = useState('overview');

  const demoMessages = [
    { type: 'assistant', content: 'Hello! I\'m Julius, your AI interviewer. Welcome to our technical interview. How are you doing today?', timestamp: '10:00:00' },
    { type: 'user', content: 'Hi Julius! I\'m doing well, thank you. I\'m excited for this interview.', timestamp: '10:00:15' },
    { type: 'assistant', content: 'That\'s great to hear! Let\'s start by having you tell me a bit about yourself and your background.', timestamp: '10:00:20' },
    { type: 'system', content: 'Stage changed: greeting → resume', timestamp: '10:02:30' },
    { type: 'assistant', content: 'I\'ve reviewed your resume. Can you tell me more about the e-commerce platform project you worked on?', timestamp: '10:02:35' },
  ];

  const demoStages = [
    { name: 'greeting', status: 'completed', score: 8 },
    { name: 'resume', status: 'active', score: null },
    { name: 'coding', status: 'pending', score: null },
    { name: 'cs', status: 'pending', score: null },
    { name: 'behavioral', status: 'pending', score: null },
    { name: 'wrapup', status: 'pending', score: null },
  ];

  const codeExample = `function twoSum(nums, target) {
    const map = new Map();
    
    for (let i = 0; i < nums.length; i++) {
        const complement = target - nums[i];
        
        if (map.has(complement)) {
            return [map.get(complement), i];
        }
        
        map.set(nums[i], i);
    }
    
    return [];
}`;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-700 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-blue-400">Julius AI Demo</h1>
            <p className="text-gray-400 mt-2">Experience the future of AI-powered interviews</p>
          </div>
          <Link href="/interview">
            <button className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg text-white font-medium transition-colors">
              Try Live Interview
            </button>
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4">
        {/* Demo Navigation */}
        <div className="bg-gray-900 rounded-lg border border-gray-700 mb-6">
          <div className="flex space-x-0 border-b border-gray-700">
            {[
              { id: 'overview', label: 'Overview', icon: '📋' },
              { id: 'conversation', label: 'Conversation', icon: '💬' },
              { id: 'coding', label: 'Code Editor', icon: '💻' },
              { id: 'analytics', label: 'Analytics', icon: '📊' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-6 py-4 transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white border-b-2 border-blue-400'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Demo Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Interview Flow */}
            <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
              <h2 className="text-xl font-semibold text-blue-400 mb-4">Interview Flow</h2>
              <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4">
                {demoStages.map((stage, index) => (
                  <div
                    key={stage.name}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      stage.status === 'completed'
                        ? 'bg-green-900 border-green-500'
                        : stage.status === 'active'
                        ? 'bg-blue-900 border-blue-500 animate-pulse'
                        : 'bg-gray-800 border-gray-600'
                    }`}
                  >
                    <div className="text-center">
                      <div className={`w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center text-sm font-bold ${
                        stage.status === 'completed' ? 'bg-green-500' : 
                        stage.status === 'active' ? 'bg-blue-500' : 'bg-gray-600'
                      }`}>
                        {stage.status === 'completed' ? '✓' : index + 1}
                      </div>
                      <div className="text-sm font-medium capitalize">{stage.name}</div>
                      {stage.score && (
                        <div className="text-xs text-gray-400 mt-1">{stage.score}/10</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Key Features */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-blue-400 mb-4">🎤 Voice Interaction</h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm text-gray-300">Real-time speech-to-text</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm text-gray-300">AI-generated voice responses</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span className="text-sm text-gray-300">Natural conversation flow</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-blue-400 mb-4">🧠 AI Intelligence</h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span className="text-sm text-gray-300">Contextual question generation</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
                    <span className="text-sm text-gray-300">Resume-based personalization</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                    <span className="text-sm text-gray-300">Real-time performance analysis</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'conversation' && (
          <div className="bg-gray-900 rounded-lg border border-gray-700">
            <div className="p-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-blue-400">Live Conversation Demo</h2>
              <p className="text-gray-400 text-sm">Real-time interview conversation with AI</p>
            </div>
            
            <div className="h-96 overflow-y-auto p-4 space-y-3">
              {demoMessages.map((message, index) => (
                <div
                  key={index}
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
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    <div className="text-xs text-gray-400 mt-1">{message.timestamp}</div>
                  </div>
                </div>
              ))}
              
              {/* Typing indicator */}
              <div className="flex justify-start">
                <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-gray-700 text-gray-300">
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-75"></div>
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-150"></div>
                    </div>
                    <span className="text-sm">Julius is thinking...</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-700">
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Type your response... (Demo mode)"
                  className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400"
                  disabled
                />
                <button className="bg-gray-600 px-4 py-2 rounded-lg text-gray-400" disabled>
                  Send
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'coding' && (
          <div className="space-y-6">
            <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-blue-400 mb-4">Code Editor Interface</h2>
              <p className="text-gray-400 mb-4">During coding rounds, candidates can submit code solutions along with explanations</p>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-md font-medium text-white mb-2">Problem Statement</h3>
                  <div className="bg-gray-800 rounded p-4 text-sm text-gray-300">
                    <strong className="text-blue-400">Two Sum Problem:</strong><br/>
                    Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.
                  </div>
                </div>
                
                <div>
                  <h3 className="text-md font-medium text-white mb-2">Code Solution</h3>
                  <div className="bg-gray-800 rounded p-4">
                    <pre className="text-sm text-gray-300 font-mono overflow-x-auto">
                      <code>{codeExample}</code>
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-blue-400 mb-4">Code Evaluation Features</h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-gray-800 rounded p-4">
                  <h4 className="text-white font-medium mb-2">🔍 Analysis</h4>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• Time complexity assessment</li>
                    <li>• Space complexity analysis</li>
                    <li>• Code readability scoring</li>
                  </ul>
                </div>
                <div className="bg-gray-800 rounded p-4">
                  <h4 className="text-white font-medium mb-2">✅ Validation</h4>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• Syntax checking</li>
                    <li>• Logic verification</li>
                    <li>• Edge case handling</li>
                  </ul>
                </div>
                <div className="bg-gray-800 rounded p-4">
                  <h4 className="text-white font-medium mb-2">📊 Feedback</h4>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• Detailed explanations</li>
                    <li>• Improvement suggestions</li>
                    <li>• Best practice tips</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-blue-400 mb-6">Performance Analytics</h2>
              
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="text-white font-medium mb-4">Overall Score</h3>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-green-400 mb-2">78/100</div>
                    <div className="text-sm text-gray-400">Recommended for Hire</div>
                  </div>
                </div>
                
                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="text-white font-medium mb-4">Stage Breakdown</h3>
                  <div className="space-y-2">
                    {[
                      { name: 'Technical Skills', score: 8.5 },
                      { name: 'Communication', score: 7.8 },
                      { name: 'Problem Solving', score: 8.2 },
                      { name: 'Culture Fit', score: 8.0 }
                    ].map((metric) => (
                      <div key={metric.name} className="flex justify-between items-center">
                        <span className="text-sm text-gray-300">{metric.name}</span>
                        <span className="text-sm text-white">{metric.score}/10</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-white font-medium mb-4">Detailed Feedback</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-green-400 font-medium mb-2">Strengths</h4>
                    <ul className="text-sm text-gray-300 space-y-1">
                      <li>• Strong algorithmic thinking</li>
                      <li>• Clear communication style</li>
                      <li>• Good problem decomposition</li>
                      <li>• Solid CS fundamentals</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-yellow-400 font-medium mb-2">Areas for Improvement</h4>
                    <ul className="text-sm text-gray-300 space-y-1">
                      <li>• Optimize for edge cases</li>
                      <li>• Practice system design</li>
                      <li>• Code documentation</li>
                      <li>• Time management</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Call to Action */}
        <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-lg border border-blue-500/30 p-8 text-center">
          <h2 className="text-2xl font-bold text-blue-400 mb-4">Ready to Experience Julius AI?</h2>
          <p className="text-gray-300 mb-6">
            Start your comprehensive AI-powered interview experience today
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/interview">
              <button className="bg-blue-600 hover:bg-blue-700 px-8 py-3 rounded-lg text-white font-medium transition-colors">
                Start Live Interview
              </button>
            </Link>
            <Link href="/reports">
              <button className="border border-blue-400 hover:bg-blue-400/10 px-8 py-3 rounded-lg text-blue-400 font-medium transition-colors">
                View Sample Reports
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
