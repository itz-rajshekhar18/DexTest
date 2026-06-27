"use client";

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Brain, Sparkles } from 'lucide-react';

type Props = {
  type: 'text' | 'voice';
};

const STEPS = [
  'Reading your class profile…',
  'Designing fresh reasoning puzzles…',
  'Balancing easy, medium and hard questions…',
  'Finalising your unique question set…',
];

// Full literal class strings per accent so Tailwind keeps them at build time.
const ACCENTS = {
  voice: {
    card: 'border-purple-300/20',
    ring: 'border-purple-300/30 border-t-purple-300',
    icon: 'text-purple-200',
    badge: 'border-purple-300/25 bg-purple-300/10 text-purple-100',
    step: 'text-purple-100',
    bar: 'from-purple-400 to-pink-400',
  },
  text: {
    card: 'border-cyan-300/20',
    ring: 'border-cyan-300/30 border-t-cyan-300',
    icon: 'text-cyan-200',
    badge: 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100',
    step: 'text-cyan-100',
    bar: 'from-cyan-400 to-pink-400',
  },
} as const;

export default function QuestionGenerationLoader({ type }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const accent = ACCENTS[type];

  useEffect(() => {
    const id = window.setInterval(() => {
      setStepIndex((prev) => (prev + 1) % STEPS.length);
    }, 1800);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="ai-page-atmosphere min-h-screen flex items-center justify-center px-6 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(37,99,235,0.16),transparent_42%),radial-gradient(circle_at_72%_72%,rgba(168,85,247,0.14),transparent_38%)]" />

      <motion.div
        initial={{ opacity: 0, y: 22, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className={`relative z-10 flex w-full max-w-lg flex-col items-center gap-7 rounded-[2rem] border ${accent.card} bg-slate-950/70 px-10 py-14 text-center shadow-[0_0_70px_rgba(34,211,238,0.16)] backdrop-blur-xl`}
      >
        {/* Animated brain core */}
        <div className="relative flex h-24 w-24 items-center justify-center">
          <motion.span
            className={`absolute inset-0 rounded-full border-2 ${accent.ring}`}
            animate={{ rotate: 360 }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
          />
          <motion.span
            className="absolute inset-3 rounded-full border-2 border-pink-300/25 border-b-pink-300"
            animate={{ rotate: -360 }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            animate={{ scale: [1, 1.12, 1], opacity: [0.85, 1, 0.85] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Brain className={`h-9 w-9 ${accent.icon}`} />
          </motion.div>
        </div>

        <div>
          <div className={`mb-2 inline-flex items-center gap-2 rounded-full border ${accent.badge} px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em]`}>
            <Sparkles className="h-3.5 w-3.5" />
            AI Generating
          </div>
          <h2 className="text-2xl font-bold text-white">
            Building your {type === 'voice' ? 'Voice' : 'Written'} IQ test
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            A brand-new, unique set of questions is being created just for you. Please keep this window open — it only takes a few seconds.
          </p>
        </div>

        {/* Rotating progress step */}
        <div className="h-6 w-full overflow-hidden">
          <motion.p
            key={stepIndex}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className={`text-sm font-medium ${accent.step}`}
          >
            {STEPS[stepIndex]}
          </motion.p>
        </div>

        {/* Indeterminate progress bar */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <motion.div
            className={`h-full w-1/3 rounded-full bg-gradient-to-r ${accent.bar}`}
            animate={{ x: ['-100%', '300%'] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </motion.div>
    </div>
  );
}
