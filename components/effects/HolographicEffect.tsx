"use client";

import { motion } from 'framer-motion';

export function HolographicEffect({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      {/* Holographic scan lines */}
      <motion.div
        className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl"
        initial={{ backgroundPosition: '0% 0%' }}
        animate={{ backgroundPosition: ['0% 0%', '0% 100%'] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(99, 102, 241, 0.03) 2px, rgba(99, 102, 241, 0.03) 4px)',
          backgroundSize: '100% 20px',
        }}
      />
      
      {/* Holographic glow */}
      <motion.div
        className="absolute inset-0 pointer-events-none rounded-3xl"
        animate={{
          boxShadow: [
            '0 0 20px rgba(99, 102, 241, 0.2)',
            '0 0 40px rgba(139, 92, 246, 0.4)',
            '0 0 20px rgba(99, 102, 241, 0.2)',
          ],
        }}
        transition={{ duration: 3, repeat: Infinity }}
      />
      
      {/* Light sweep effect */}
      <motion.div
        className="absolute inset-0 pointer-events-none rounded-3xl overflow-hidden"
        initial={{ x: '-100%' }}
        animate={{ x: '200%' }}
        transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent)',
          width: '50%',
        }}
      />
      
      {children}
    </div>
  );
}
