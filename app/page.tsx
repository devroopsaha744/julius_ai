'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function Home() {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-purple-900/20"></div>
        
        <div className="relative max-w-6xl mx-auto px-4 py-20">
          <div className="text-center space-y-8">
            <div className="space-y-4">
              <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Julius AI
              </h1>
              <p className="text-2xl text-gray-300">
                Next-Generation AI Interview System
              </p>
              <p className="text-lg text-gray-400 max-w-2xl mx-auto">
                Experience comprehensive technical interviews with real-time voice interaction, 
                intelligent stage progression, and detailed performance analytics.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link href="/interview">
                <button
                  onMouseEnter={() => setIsHovered(true)}
                  onMouseLeave={() => setIsHovered(false)}
                  className={`px-8 py-4 rounded-lg text-lg font-semibold transition-all duration-300 transform ${
                    isHovered 
                      ? 'bg-blue-500 scale-105 shadow-lg shadow-blue-500/50' 
                      : 'bg-blue-600 hover:bg-blue-500'
                  }`}
                >
                  Start Interview
                </button>
              </Link>
              
              <Link href="/demo">
                <button className="px-8 py-4 rounded-lg text-lg font-semibold border-2 border-gray-600 hover:border-blue-400 hover:text-blue-400 transition-colors">
                  View Demo
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-blue-400 mb-4">Features</h2>
          <p className="text-gray-400">Advanced AI-powered interview capabilities</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Real-time Voice */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 hover:border-blue-500 transition-colors">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
              🎤
            </div>
            <h3 className="text-xl font-semibold text-blue-400 mb-2">Real-time Voice</h3>
            <p className="text-gray-400">
              Natural voice conversations with AI powered by AWS Transcribe and Polly
            </p>
          </div>

          {/* Multi-stage Interview */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 hover:border-blue-500 transition-colors">
            <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center mb-4">
              📊
            </div>
            <h3 className="text-xl font-semibold text-blue-400 mb-2">Multi-stage Process</h3>
            <p className="text-gray-400">
              Complete interview flow: Greeting → Resume → Coding → CS → Behavioral → Wrap-up
            </p>
          </div>

          {/* Code Editor */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 hover:border-blue-500 transition-colors">
            <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center mb-4">
              💻
            </div>
            <h3 className="text-xl font-semibold text-blue-400 mb-2">Code Submission</h3>
            <p className="text-gray-400">
              Built-in code editor for programming challenges with real-time evaluation
            </p>
          </div>

          {/* Intelligent Scoring */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 hover:border-blue-500 transition-colors">
            <div className="w-12 h-12 bg-yellow-600 rounded-lg flex items-center justify-center mb-4">
              🧠
            </div>
            <h3 className="text-xl font-semibold text-blue-400 mb-2">AI Scoring</h3>
            <p className="text-gray-400">
              Comprehensive performance analysis with detailed scoring across all categories
            </p>
          </div>

          {/* Personalized Feedback */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 hover:border-blue-500 transition-colors">
            <div className="w-12 h-12 bg-pink-600 rounded-lg flex items-center justify-center mb-4">
              📝
            </div>
            <h3 className="text-xl font-semibold text-blue-400 mb-2">Smart Recommendations</h3>
            <p className="text-gray-400">
              Actionable feedback with specific improvement suggestions and learning resources
            </p>
          </div>

          {/* Resume Analysis */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 hover:border-blue-500 transition-colors">
            <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center mb-4">
              📄
            </div>
            <h3 className="text-xl font-semibold text-blue-400 mb-2">Resume Integration</h3>
            <p className="text-gray-400">
              Upload and analyze resumes for personalized interview questions and feedback
            </p>
          </div>
        </div>
      </div>

      {/* Interview Stages */}
      <div className="bg-gray-900 border-t border-gray-700">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-blue-400 mb-4">Interview Process</h2>
            <p className="text-gray-400">Six comprehensive stages for complete evaluation</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { name: 'Greeting', color: 'bg-blue-500', description: 'Introduction and ice-breaking' },
              { name: 'Resume', color: 'bg-green-500', description: 'Project discussion and experience' },
              { name: 'Coding', color: 'bg-purple-500', description: 'Algorithm and data structure challenges' },
              { name: 'CS Fundamentals', color: 'bg-yellow-500', description: 'DBMS, OS, and networking concepts' },
              { name: 'Behavioral', color: 'bg-pink-500', description: 'Soft skills and culture fit assessment' },
              { name: 'Wrap-up', color: 'bg-indigo-500', description: 'Final thoughts and Q&A' }
            ].map((stage, index) => (
              <div key={stage.name} className="bg-gray-800 border border-gray-600 rounded-lg p-4">
                <div className="flex items-center space-x-3 mb-2">
                  <div className={`w-8 h-8 ${stage.color} rounded-full flex items-center justify-center text-white font-bold text-sm`}>
                    {index + 1}
                  </div>
                  <h3 className="text-lg font-semibold text-white">{stage.name}</h3>
                </div>
                <p className="text-gray-400 text-sm">{stage.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-700 bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-center md:text-left mb-4 md:mb-0">
              <h3 className="text-xl font-bold text-blue-400">Julius AI</h3>
              <p className="text-gray-400">Revolutionizing technical interviews</p>
            </div>
            
            <div className="flex space-x-6">
              <Link href="/interview" className="text-gray-400 hover:text-blue-400 transition-colors">
                Start Interview
              </Link>
              <Link href="/demo" className="text-gray-400 hover:text-blue-400 transition-colors">
                Demo
              </Link>
              <Link href="/about" className="text-gray-400 hover:text-blue-400 transition-colors">
                About
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
