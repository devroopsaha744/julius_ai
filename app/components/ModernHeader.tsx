'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Home, Menu, X } from 'lucide-react';
import { useState } from 'react';

interface ModernHeaderProps {
  title?: string;
  showBackButton?: boolean;
}

export default function ModernHeader({ title, showBackButton = true }: ModernHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <motion.nav 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="relative z-50 px-6 py-4 backdrop-blur-lg bg-white/70 border-b border-gray-200/50 sticky top-0"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-3 group">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center transform group-hover:scale-110 transition-transform overflow-hidden p-1.5">
            <img src="/julius-white-transparent.png" alt="Julius AI Logo" className="w-full h-full object-contain" />
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Julius AI
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-6">
          {title && (
            <span className="text-sm font-medium text-gray-600">{title}</span>
          )}
          {showBackButton && (
            <Link href="/">
              <button className="px-4 py-2 bg-white/80 backdrop-blur-sm text-gray-900 rounded-xl font-medium border-2 border-gray-200 hover:border-purple-300 hover:shadow-lg transition-all flex items-center space-x-2">
                <Home className="w-4 h-4" />
                <span>Home</span>
              </button>
            </Link>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-lg hover:bg-gray-100"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden mt-4 p-4 bg-white/90 backdrop-blur-lg rounded-xl border border-gray-200/50"
        >
          {showBackButton && (
            <Link href="/">
              <button className="w-full px-4 py-3 bg-gradient-to-r from-purple-100 to-blue-100 text-gray-900 rounded-xl font-medium hover:from-purple-200 hover:to-blue-200 transition-all flex items-center justify-center space-x-2">
                <Home className="w-4 h-4" />
                <span>Back to Home</span>
              </button>
            </Link>
          )}
        </motion.div>
      )}
    </motion.nav>
  );
}
