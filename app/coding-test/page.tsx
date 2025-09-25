"use client";

import { useState } from 'react';
import Link from 'next/link';

export default function CodingTestLanding() {
  const [isStarting, setIsStarting] = useState(false);

  const startTest = () => {
    setIsStarting(true);
    // Open in new tab
    window.open('/coding-test/test', '_blank');
    setIsStarting(false);
  };

  return (
    <div className="min-h-screen bg-white text-black overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 opacity-12">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-400/12 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/12 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Navigation */}
      <nav className="relative z-10 px-6 py-4 border-b border-gray-800/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 hero-accent rounded-lg flex items-center justify-center overflow-hidden">
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#6B21A8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: 'white', fontWeight: 700 }}>JA</span>
              </div>
            </div>
            <span className="text-2xl font-bold accent-text">Julius AI</span>
          </div>
          <div className="hidden md:flex items-center space-x-8">
            <Link href="/" className="muted hover:text-black transition-colors">Home</Link>
            <a href="#about" className="muted hover:text-black transition-colors">About</a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 min-h-screen flex items-center justify-center px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-8">
            <span className="accent-text">Coding Test</span>
            <br />
            <span className="text-2xl md:text-3xl muted font-normal">
              Assess your programming skills
            </span>
          </h1>
          <p className="text-lg md:text-xl muted max-w-2xl mx-auto leading-relaxed mb-12">
            Take a comprehensive coding test with curated problems, real-time code execution, and instant feedback.
          </p>
          <button
            onClick={startTest}
            disabled={isStarting}
            className="btn-primary text-xl px-12 py-4 group disabled:opacity-50"
          >
            {isStarting ? 'Starting...' : 'Start Coding Test'}
          </button>
        </div>
      </section>
    </div>
  );
}