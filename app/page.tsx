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
      description: "Beautiful coding interface for recruiters"
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

  // Removed 'Coding' stage from visible UI for recruiters per request
  const stages = [
    { name: "Greeting", status: "completed", description: "Welcome & Introduction" },
    { name: "Resume", status: "completed", description: "Background Review" },
    { name: "Computer Science", status: "pending", description: "CS Fundamentals" },
    { name: "Behavioral", status: "pending", description: "Cultural Fit" },
    { name: "Wrap-up", status: "pending", description: "Closing & Next Steps" }
  ];

  // Simple client-side user state
  const [user, setUser] = useState<any>(() => {
    try {
      if (typeof window === 'undefined') return null;
      const raw = localStorage.getItem('julius_user');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  });

  useEffect(() => {
    // Load Google Identity Services script
    if (typeof window === 'undefined') return;
    const existing = document.getElementById('gsi-script');
    if (!existing) {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.id = 'gsi-script';
      s.async = true;
      s.defer = true;
      document.body.appendChild(s);

      s.onload = () => {
        // Safe runtime checks for google identity
  const g = (window as any).google;
        if (g && g.accounts && g.accounts.id) {
          g.accounts.id.initialize({
            client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
            callback: handleCredentialResponse,
          });
          const target = document.getElementById('g_id_onload');
          if (target) {
            g.accounts.id.renderButton(target, { theme: 'outline', size: 'large', width: '240' });
          }
        }
      };
    }
  }, []);

  async function handleCredentialResponse(response: { credential?: string } | any) {
    const id_token = response?.credential as string | undefined;
    if (!id_token) return;
    try {
      const r = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token }),
      });
      const data = await r.json();
      if (data?.ok && data.user) {
        localStorage.setItem('julius_user', JSON.stringify(data.user));
        setUser(data.user);
      } else if (data?.user) {
        localStorage.setItem('julius_user', JSON.stringify(data.user));
        setUser(data.user);
      } else {
        console.error('Auth failed', data);
      }
    } catch (e) {
      console.error('Auth error', e);
    }
  }

  function signOut() {
    localStorage.removeItem('julius_user');
    setUser(null);
  }

  // Inline small user badge component
  function UserBadge() {
    if (!user) return null;
    return (
      <div className="flex items-center space-x-3">
        {user.picture && <img src={user.picture} alt="avatar" className="w-8 h-8 rounded-full" />}
        <div className="text-sm">
          <div className="font-medium">{user.name || user.email}</div>
          <div className="text-xs muted">{user.email}</div>
        </div>
        <button onClick={signOut} className="text-sm btn-outline px-3 py-1">Sign out</button>
      </div>
    );
  }

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
              <img src="/assests/logo.svg" alt="Julius AI" className="w-8 h-8 object-contain" />
            </div>
            <span className="text-2xl font-bold accent-text">Julius AI</span>
          </div>
          <div className="hidden md:flex items-center space-x-8">
            <Link href="#features" className="muted hover:text-black transition-colors">Features</Link>
            <Link href="#demo" className="muted hover:text-black transition-colors">Demo</Link>
            <Link href="#process" className="muted hover:text-black transition-colors">Process</Link>
            <Link href="/interview" className="btn-primary">Start Interview</Link>
            <Link href="/coding" className="btn-outline">Recruiter Coding</Link>
            {/* Google Sign-in area */}
            {/** Show user if signed in */}
            {typeof window !== 'undefined' && (
              <div id="gsi-root" className="flex items-center space-x-4">
                {localStorage.getItem('julius_user') ? (
                  <UserBadge />
                ) : (
                  <div id="g_id_onload"></div>
                )}
              </div>
            )}
          </div>
*** End Patch
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 min-h-screen flex items-center justify-center px-6">
        <div className={`max-w-6xl mx-auto text-center transition-all duration-1000 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          
          {/* Main Heading */}
          <div className="space-y-8 mb-16">
            <h1 className="text-6xl md:text-7xl font-bold leading-tight">
              <span className="accent-text">Julius AI</span>
              <br />
              <span className="text-3xl md:text-4xl muted font-normal">
                Recruiter-friendly technical interviews
              </span>
            </h1>
            
              <p className="text-lg md:text-xl muted max-w-3xl mx-auto leading-relaxed">
                A lean and powerful platform for recruiters — prioritizing clarity, fast screening, and beautiful coding experiences.
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
              <button className="btn-outline text-xl px-12 py-4 group">
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 glass-surface rounded-2xl p-8">
            <div className="text-center">
              <div className="text-3xl font-bold accent-text">6</div>
              <div className="muted">Interview Stages</div>
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
              <span className="accent-text">Intelligent Features</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Powered by cutting-edge AI technology to deliver the most comprehensive and natural interview experience
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
                <div
                key={index}
                className={`glass-surface rounded-2xl p-8 card-hover transition-all duration-500 ${
                  activeFeature === index ? 'purple-glow scale-105' : ''
                }`}
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold mb-3 accent-text">{feature.title}</h3>
                <p className="muted">{feature.description}</p>
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
              <span className="accent-text">Interview Journey</span>
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
                    'bg-gray-300 border-gray-200'
                  }`}></div>
                </div>

                {/* Stage Content */}
                <div className={`w-5/12 ${index % 2 === 0 ? 'text-right pr-12' : 'text-left pl-12'}`}>
                  <div className={`glass-effect rounded-xl p-6 card-hover ${
                    stage.status === 'active' ? 'electric-glow' : ''
                  }`}>
                    <h3 className={`text-xl font-bold mb-2 ${
                      stage.status === 'completed' ? 'text-green-400' :
                      stage.status === 'active' ? 'text-purple-400' :
                      'text-gray-600'
                    }`}>
                      {stage.name}
                    </h3>
                    <p className="text-gray-400 text-sm">{stage.description}</p>
                    
                    {/* Status Indicator */}
                    <div className={`inline-flex items-center mt-3 px-3 py-1 rounded-full text-xs font-medium ${
                      stage.status === 'completed' ? 'bg-green-900/30 text-green-400 border border-green-400/30' :
                      stage.status === 'active' ? 'bg-purple-900/20 text-purple-400 border border-purple-400/20' :
                      'bg-gray-100/40 text-gray-600 border border-gray-200/30'
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
              <span className="accent-text">See It In Action</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Watch how Julius AI conducts comprehensive technical interviews with natural conversation and intelligent assessment
            </p>
          </div>

          <div className="glass-effect rounded-3xl p-2 max-w-5xl mx-auto">
            <div className="bg-gray-900 rounded-2xl p-8 text-center">
              <div className="w-24 h-24 hero-accent rounded-2xl mx-auto mb-6 flex items-center justify-center">
                <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
              <h3 className="text-2xl font-bold mb-4 accent-text">Interactive Demo</h3>
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
                <div className="w-10 h-10 hero-accent rounded-lg flex items-center justify-center overflow-hidden">
                  <img src="/assests/logo.svg" alt="Julius AI" className="w-8 h-8 object-contain" />
                </div>
                <span className="text-2xl font-bold accent-text">Julius AI</span>
              </div>
              <p className="muted max-w-md">
                Revolutionizing technical interviews with recruiter-friendly experiences and clear analytics.
              </p>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-4 text-purple-500">Product</h4>
              <ul className="space-y-2 text-gray-600">
                <li><Link href="/interview" className="hover:text-purple-500 transition-colors">Start Interview</Link></li>
                <li><Link href="/demo" className="hover:text-purple-500 transition-colors">Demo</Link></li>
                <li><Link href="#features" className="hover:text-purple-500 transition-colors">Features</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-4 text-purple-500">Company</h4>
              <ul className="space-y-2 text-gray-600">
                <li><Link href="/about" className="hover:text-purple-500 transition-colors">About</Link></li>
                <li><Link href="/contact" className="hover:text-purple-500 transition-colors">Contact</Link></li>
                <li><Link href="/privacy" className="hover:text-purple-500 transition-colors">Privacy</Link></li>
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
