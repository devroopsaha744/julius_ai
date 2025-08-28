'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Home() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    setIsLoaded(true);
    const interval = setInterval(() => {
      setActiveFeature(prev => (prev + 1) % 4);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const features = [
    {
      icon: "🎤",
      title: "Real-time Voice Interaction",
      description: "Natural conversation with AI using advanced speech recognition"
    },
    {
      icon: "💻",
      title: "Live Code Editor",
      description: "Professional code environment with syntax highlighting"
    },
    {
      icon: "🧠",
      title: "Intelligent Assessment",
      description: "Comprehensive evaluation across technical and soft skills"
    },
    {
      icon: "📊",
      title: "Detailed Analytics",
      description: "Performance insights with actionable recommendations"
    }
  ];

  const stages = [
    { name: "Greeting", status: "completed", description: "Welcome & Introduction" },
    { name: "Resume", status: "completed", description: "Background Review" },
    { name: "Coding", status: "active", description: "Technical Challenges" },
    { name: "Computer Science", status: "pending", description: "CS Fundamentals" },
    { name: "Behavioral", status: "pending", description: "Cultural Fit" },
    { name: "Wrap-up", status: "pending", description: "Closing & Next Steps" }
  ];

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 opacity-30">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-3/4 left-1/2 w-64 h-64 bg-cyan-400/20 rounded-full blur-3xl animate-pulse delay-2000"></div>
      </div>

      {/* Navigation */}
      <nav className="relative z-10 px-6 py-4 border-b border-gray-800/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-black font-bold text-xl">J</span>
            </div>
            <span className="text-2xl font-bold electric-text">Julius AI</span>
          </div>
          <div className="hidden md:flex items-center space-x-8">
            <Link href="#features" className="text-gray-300 hover:text-cyan-400 transition-colors">Features</Link>
            <Link href="#demo" className="text-gray-300 hover:text-cyan-400 transition-colors">Demo</Link>
            <Link href="#process" className="text-gray-300 hover:text-cyan-400 transition-colors">Process</Link>
            <Link href="/interview" className="btn-electric">Start Interview</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 min-h-screen flex items-center justify-center px-6">
        <div className={`max-w-6xl mx-auto text-center transition-all duration-1000 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          
          {/* Main Heading */}
          <div className="space-y-8 mb-16">
            <h1 className="text-7xl md:text-8xl font-bold leading-tight">
              <span className="electric-text">Julius AI</span>
              <br />
              <span className="text-4xl md:text-5xl text-gray-300 font-normal">
                The Future of Technical Interviews
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
              Experience the next generation of AI-powered technical interviews with 
              <span className="text-cyan-400"> real-time voice interaction</span>, 
              <span className="text-cyan-400"> intelligent coding challenges</span>, and 
              <span className="text-cyan-400"> comprehensive performance analytics</span>.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-20">
            <Link href="/interview">
              <button className="btn-electric text-xl px-12 py-4 group">
                <span className="flex items-center space-x-3">
                  <span>Start Your Interview</span>
                  <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </button>
            </Link>
            
            <Link href="#demo">
              <button className="btn-outline-electric text-xl px-12 py-4 group">
                <span className="flex items-center space-x-3">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.5a1.5 1.5 0 011.5 1.5V13M4.5 19.5h15" />
                  </svg>
                  <span>Watch Demo</span>
                </span>
              </button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 glass-effect rounded-2xl p-8">
            <div className="text-center">
              <div className="text-3xl font-bold electric-text">6</div>
              <div className="text-gray-400">Interview Stages</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold electric-text">10+</div>
              <div className="text-gray-400">Programming Languages</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold electric-text">AI</div>
              <div className="text-gray-400">Powered Assessment</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold electric-text">Real-time</div>
              <div className="text-gray-400">Voice Interaction</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative z-10 py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold mb-6">
              <span className="electric-text">Intelligent Features</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Powered by cutting-edge AI technology to deliver the most comprehensive and natural interview experience
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className={`glass-effect rounded-2xl p-8 card-hover transition-all duration-500 ${
                  activeFeature === index ? 'electric-glow scale-105' : ''
                }`}
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold mb-3 text-cyan-400">{feature.title}</h3>
                <p className="text-gray-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Interview Process Section */}
      <section id="process" className="relative z-10 py-20 px-6 bg-gradient-to-b from-transparent to-gray-900/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold mb-6">
              <span className="electric-text">Interview Journey</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Follow the intelligent flow designed to assess every aspect of your technical expertise
            </p>
          </div>

          {/* Tree-like Structure */}
          <div className="relative max-w-4xl mx-auto">
            {/* Connection Lines */}
            <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-cyan-400 via-blue-500 to-cyan-400 transform -translate-x-1/2 opacity-30"></div>
            
            {stages.map((stage, index) => (
              <div key={index} className={`relative flex items-center mb-12 ${index % 2 === 0 ? 'flex-row' : 'flex-row-reverse'}`}>
                {/* Stage Node */}
                <div className="absolute left-1/2 transform -translate-x-1/2 z-10">
                  <div className={`w-6 h-6 rounded-full border-4 ${
                    stage.status === 'completed' ? 'bg-green-400 border-green-400 shadow-lg shadow-green-400/50' :
                    stage.status === 'active' ? 'bg-cyan-400 border-cyan-400 shadow-lg shadow-cyan-400/50 electric-glow' :
                    'bg-gray-700 border-gray-600'
                  }`}></div>
                </div>

                {/* Stage Content */}
                <div className={`w-5/12 ${index % 2 === 0 ? 'text-right pr-12' : 'text-left pl-12'}`}>
                  <div className={`glass-effect rounded-xl p-6 card-hover ${
                    stage.status === 'active' ? 'electric-glow' : ''
                  }`}>
                    <h3 className={`text-xl font-bold mb-2 ${
                      stage.status === 'completed' ? 'text-green-400' :
                      stage.status === 'active' ? 'text-cyan-400' :
                      'text-gray-400'
                    }`}>
                      {stage.name}
                    </h3>
                    <p className="text-gray-400 text-sm">{stage.description}</p>
                    
                    {/* Status Indicator */}
                    <div className={`inline-flex items-center mt-3 px-3 py-1 rounded-full text-xs font-medium ${
                      stage.status === 'completed' ? 'bg-green-900/30 text-green-400 border border-green-400/30' :
                      stage.status === 'active' ? 'bg-cyan-900/30 text-cyan-400 border border-cyan-400/30' :
                      'bg-gray-800/30 text-gray-500 border border-gray-600/30'
                    }`}>
                      {stage.status === 'completed' ? '✓ Completed' :
                       stage.status === 'active' ? '⚡ Active' :
                       '○ Pending'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section id="demo" className="relative z-10 py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold mb-6">
              <span className="electric-text">See It In Action</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Watch how Julius AI conducts comprehensive technical interviews with natural conversation and intelligent assessment
            </p>
          </div>

          <div className="glass-effect rounded-3xl p-2 max-w-5xl mx-auto">
            <div className="bg-gray-900 rounded-2xl p-8 text-center">
              <div className="w-24 h-24 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-2xl mx-auto mb-6 flex items-center justify-center">
                <svg className="w-12 h-12 text-black" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
              <h3 className="text-2xl font-bold mb-4 text-cyan-400">Interactive Demo</h3>
              <p className="text-gray-400 mb-8">Experience the full interview flow with sample questions and real-time feedback</p>
              <Link href="/demo">
                <button className="btn-electric text-lg px-8 py-3">
                  Launch Demo
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-gray-800/50 bg-black/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-black font-bold text-xl">J</span>
                </div>
                <span className="text-2xl font-bold electric-text">Julius AI</span>
              </div>
              <p className="text-gray-400 max-w-md">
                Revolutionizing technical interviews with AI-powered assessment, real-time interaction, and comprehensive analytics.
              </p>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-4 text-cyan-400">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/interview" className="hover:text-cyan-400 transition-colors">Start Interview</Link></li>
                <li><Link href="/demo" className="hover:text-cyan-400 transition-colors">Demo</Link></li>
                <li><Link href="#features" className="hover:text-cyan-400 transition-colors">Features</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-4 text-cyan-400">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/about" className="hover:text-cyan-400 transition-colors">About</Link></li>
                <li><Link href="/contact" className="hover:text-cyan-400 transition-colors">Contact</Link></li>
                <li><Link href="/privacy" className="hover:text-cyan-400 transition-colors">Privacy</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
            <p>&copy; 2025 Julius AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
