'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import { 
  Sparkles, 
  Target, 
  TrendingUp, 
  Zap,
  ArrowRight,
  CheckCircle2,
  Users,
  Clock,
  BarChart3,
  Shield,
  Brain,
  Rocket
} from 'lucide-react';

// Animated counter component
function AnimatedCounter({ end, duration = 2000, suffix = '' }: { end: number; duration?: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = (timestamp - startTime) / duration;

      if (progress < 1) {
        setCount(Math.floor(end * progress));
        animationFrame = requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [isInView, end, duration]);

  return <span ref={ref}>{count}{suffix}</span>;
}

// Floating orb component for background
function FloatingOrb({ delay = 0, duration = 20 }: { delay?: number; duration?: number }) {
  return (
    <motion.div
      className="absolute w-64 h-64 rounded-full bg-gradient-to-br from-purple-400/20 to-blue-400/20 blur-3xl"
      animate={{
        x: [0, 100, 0],
        y: [0, -100, 0],
        scale: [1, 1.2, 1],
      }}
      transition={{
        duration,
        repeat: Infinity,
        delay,
        ease: "easeInOut"
      }}
    />
  );
}

export default function Home() {
  const [user, setUser] = useState<any>(() => {
    try {
      if (typeof window === 'undefined') return null;
      const raw = localStorage.getItem('julius_user');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  });

  const { scrollYProgress } = useScroll();
  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.2], [1, 0.95]);

  const features = [
    {
      icon: Brain,
      title: "AI-Powered Interviews",
      description: "Intelligent conversation flow that adapts to candidate responses in real-time"
    },
    {
      icon: Target,
      title: "Precision Screening",
      description: "Advanced algorithms assess technical skills with human-like understanding"
    },
    {
      icon: BarChart3,
      title: "Deep Analytics",
      description: "Comprehensive reports with actionable insights and hiring recommendations"
    },
    {
      icon: Shield,
      title: "Bias-Free Assessment",
      description: "Standardized evaluation criteria ensure fair and consistent hiring"
    }
  ];

  useEffect(() => {
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
        const g = (window as any).google;
        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
        if (!clientId) return;
        if (g && g.accounts && g.accounts.id) {
          g.accounts.id.initialize({
            client_id: clientId,
            callback: handleCredentialResponse,
          });
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
      if (data?.user) {
        localStorage.setItem('julius_user', JSON.stringify(data.user));
        setUser(data.user);
      }
    } catch (e) {
      console.error('Auth error', e);
    }
  }

  function signOut() {
    localStorage.removeItem('julius_user');
    setUser(null);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-purple-50/30 to-blue-50/30 text-gray-900 overflow-hidden relative">
      {/* Animated background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <FloatingOrb delay={0} />
        <FloatingOrb delay={5} duration={25} />
        <FloatingOrb delay={10} duration={30} />
      </div>

      {/* Navigation */}
      <motion.nav 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="relative z-50 px-6 py-4 backdrop-blur-lg bg-white/70 border-b border-gray-200/50 sticky top-0"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center transform group-hover:scale-110 transition-transform overflow-hidden">
              <img src="/julius-ai-high-resolution-logo.png" alt="Julius AI Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Julius AI
            </span>
          </Link>
          
          <div className="hidden md:flex items-center space-x-8">
            <Link href="#features" className="text-gray-600 hover:text-purple-600 transition-colors font-medium">
              Features
            </Link>
            <Link href="#process" className="text-gray-600 hover:text-purple-600 transition-colors font-medium">
              Process
            </Link>
            <Link href="#demo" className="text-gray-600 hover:text-purple-600 transition-colors font-medium">
              Demo
            </Link>
            
            {user ? (
              <div className="flex items-center space-x-3">
                {user.picture && <img src={user.picture} alt="avatar" className="w-8 h-8 rounded-full" />}
                <span className="text-sm font-medium">{user.name}</span>
                <button onClick={signOut} className="text-sm text-gray-600 hover:text-purple-600">
                  Sign out
                </button>
              </div>
            ) : (
              <Link href="/profile">
                <button className="text-gray-600 hover:text-purple-600 font-medium">
                  Sign in
                </button>
              </Link>
            )}
            
            <Link href="/recruiter">
              <button className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all transform hover:scale-105">
                Get Started
              </button>
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section className="relative z-10 pt-20 pb-32 px-6">
        <motion.div 
          style={{ opacity, scale }}
          className="max-w-6xl mx-auto text-center"
        >
          
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-purple-100/80 backdrop-blur-sm rounded-full mb-8 border border-purple-200/50"
          >
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-semibold text-purple-700">Backed by Y Combinator</span>
          </motion.div>

          {/* Main Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-6xl md:text-7xl lg:text-8xl font-bold mb-6 leading-tight"
          >
            <span className="bg-gradient-to-r from-gray-900 via-purple-900 to-blue-900 bg-clip-text text-transparent">
              Real-time AI
            </span>
            <br />
            <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Interview Platform
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto mb-12 leading-relaxed"
          >
            Power your hiring process with the freshest, most trusted AI-driven interviews.
            <br />
            Automate screening, ensure consistency, and discover top talent effortlessly.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-20"
          >
            <Link href="/interview">
              <button className="group px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold text-lg hover:shadow-2xl hover:shadow-purple-500/50 transition-all transform hover:scale-105 flex items-center space-x-2">
                <span>Start Interview</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
            <Link href="/recruiter">
              <button className="px-8 py-4 bg-white/80 backdrop-blur-sm text-gray-900 rounded-xl font-semibold text-lg border-2 border-gray-200 hover:border-purple-300 hover:shadow-lg transition-all">
                Book Demo
              </button>
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto"
          >
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
                <AnimatedCounter end={80} suffix="%" />
              </div>
              <div className="text-gray-600 font-medium">Time Saved</div>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
                <AnimatedCounter end={500} suffix="+" />
              </div>
              <div className="text-gray-600 font-medium">Candidates Assessed</div>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
                AI
              </div>
              <div className="text-gray-600 font-medium">Powered Screening</div>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
                24/7
              </div>
              <div className="text-gray-600 font-medium">Automated Interviews</div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative z-10 py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              The only platform providing
              <br />
              <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                truly real-time interviews
              </span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Experience next-generation hiring automation with AI that understands, adapts, and evaluates like never before
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                whileHover={{ scale: 1.02 }}
                className="group p-8 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 hover:border-purple-300 hover:shadow-2xl hover:shadow-purple-500/10 transition-all"
              >
                <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-gray-900">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section id="process" className="relative z-10 py-20 px-6 bg-gradient-to-b from-transparent to-purple-50/50">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              Streamlined hiring in
              <br />
              <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                three simple steps
              </span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Users,
                title: "Configure Interview",
                description: "Set your requirements, choose skills to assess, and customize the interview parameters"
              },
              {
                icon: Rocket,
                title: "AI Conducts Interview",
                description: "Our AI interviewer engages candidates with natural conversation and technical challenges"
              },
              {
                icon: CheckCircle2,
                title: "Get Detailed Report",
                description: "Receive comprehensive analysis with scores, insights, and hiring recommendations"
              }
            ].map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2, duration: 0.6 }}
                className="relative"
              >
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 p-8 hover:shadow-xl transition-all">
                  <div className="absolute -top-4 -left-4 w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
                    {index + 1}
                  </div>
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-blue-100 rounded-xl flex items-center justify-center mb-6 mt-4">
                    <step.icon className="w-8 h-8 text-purple-600" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3 text-gray-900">{step.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{step.description}</p>
                </div>
                {index < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gradient-to-r from-purple-300 to-blue-300"></div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section id="demo" className="relative z-10 py-20 px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-5xl mx-auto"
        >
          <div className="bg-gradient-to-br from-purple-900 to-blue-900 rounded-3xl p-12 text-center relative overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute top-0 left-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl"></div>
            
            <div className="relative z-10">
              <motion.div
                whileHover={{ scale: 1.1, rotate: 5 }}
                className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl mx-auto mb-6 flex items-center justify-center"
              >
                <Sparkles className="w-10 h-10 text-white" />
              </motion.div>
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                Watch Julius AI in Action
              </h2>
              <p className="text-xl text-purple-100 mb-8 max-w-2xl mx-auto">
                See how Julius AI transforms your hiring process with intelligent candidate screening and comprehensive evaluation
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a href="https://youtu.be/gQ2PJVzWenE" target="_blank" rel="noopener noreferrer">
                  <button className="px-8 py-4 bg-white text-purple-900 rounded-xl font-semibold text-lg hover:shadow-2xl transition-all transform hover:scale-105">
                    Watch Demo
                  </button>
                </a>
                <Link href="/demo">
                  <button className="px-8 py-4 bg-white/20 backdrop-blur-sm text-white rounded-xl font-semibold text-lg border-2 border-white/30 hover:bg-white/30 transition-all">
                    Try Interactive Demo
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-gray-200/50 bg-white/70 backdrop-blur-lg mt-20">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center overflow-hidden p-1.5">
                  <img src="/julius-white-transparent.png" alt="Julius AI Logo" className="w-full h-full object-contain" />
                </div>
                <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  Julius AI
                </span>
              </div>
              <p className="text-gray-600 max-w-md leading-relaxed">
                Empowering recruiters with AI-driven automation to streamline technical hiring and find top talent efficiently.
              </p>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-4 text-gray-900">Product</h4>
              <ul className="space-y-2">
                <li><Link href="/recruiter" className="text-gray-600 hover:text-purple-600 transition-colors">Dashboard</Link></li>
                <li><Link href="/demo" className="text-gray-600 hover:text-purple-600 transition-colors">Demo</Link></li>
                <li><Link href="#features" className="text-gray-600 hover:text-purple-600 transition-colors">Features</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-4 text-gray-900">Company</h4>
              <ul className="space-y-2">
                <li><Link href="/about" className="text-gray-600 hover:text-purple-600 transition-colors">About</Link></li>
                <li><Link href="/contact" className="text-gray-600 hover:text-purple-600 transition-colors">Contact</Link></li>
                <li><Link href="/privacy" className="text-gray-600 hover:text-purple-600 transition-colors">Privacy</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-200 pt-8 text-center text-gray-600">
            <p>&copy; 2025 Julius AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
