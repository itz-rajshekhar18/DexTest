"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BrainCircuit } from "lucide-react";

type LoaderNode = {
  x: number;
  y: number;
  delay: number;
};

const nodes: LoaderNode[] = [
  { x: 16, y: 28, delay: 0 },
  { x: 30, y: 18, delay: 0.08 },
  { x: 48, y: 30, delay: 0.16 },
  { x: 68, y: 18, delay: 0.24 },
  { x: 82, y: 34, delay: 0.32 },
  { x: 26, y: 58, delay: 0.4 },
  { x: 46, y: 68, delay: 0.48 },
  { x: 64, y: 54, delay: 0.56 },
  { x: 78, y: 72, delay: 0.64 },
];

const paths = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [2, 6],
  [3, 7],
];

export function LoadingAnimation() {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    timerRef.current = window.setTimeout(() => setVisible(false), 3200);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[99999] flex items-center justify-center overflow-hidden bg-[#030712]"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.015, filter: "blur(8px)" }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(37,99,235,0.18),transparent_34%),radial-gradient(circle_at_68%_18%,rgba(168,85,247,0.15),transparent_28%),linear-gradient(180deg,#030712,#050816)]" />
          <div className="absolute inset-0 ai-loader-scan" />

          <svg className="absolute h-[72vmin] w-[72vmin] max-w-[760px] opacity-90" viewBox="0 0 100 100" aria-hidden="true">
            <defs>
              <filter id="loader-glow">
                <feGaussianBlur stdDeviation="1.2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient id="loader-line" x1="0" x2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.08" />
                <stop offset="48%" stopColor="#dbeafe" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.14" />
              </linearGradient>
            </defs>

            {paths.map(([from, to], index) => {
              const a = nodes[from];
              const b = nodes[to];
              return (
                <motion.line
                  key={`${from}-${to}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="url(#loader-line)"
                  strokeWidth="0.42"
                  strokeLinecap="round"
                  filter="url(#loader-glow)"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: [0, 0.82, 0.48] }}
                  transition={{ duration: 0.9, delay: 0.38 + index * 0.055, ease: "easeInOut" }}
                />
              );
            })}

            {paths.slice(0, 7).map(([from, to], index) => {
              const a = nodes[from];
              const b = nodes[to];
              return (
                <motion.circle
                  key={`pulse-${from}-${to}`}
                  r="0.72"
                  fill="#e0f2fe"
                  filter="url(#loader-glow)"
                  initial={{ cx: a.x, cy: a.y, opacity: 0 }}
                  animate={{
                    cx: [a.x, b.x],
                    cy: [a.y, b.y],
                    opacity: [0, 1, 0],
                  }}
                  transition={{ duration: 0.95, delay: 1.28 + index * 0.09, ease: "easeInOut" }}
                />
              );
            })}

            {nodes.map((node, index) => (
              <motion.circle
                key={index}
                cx={node.x}
                cy={node.y}
                r="1.18"
                fill="#bfdbfe"
                filter="url(#loader-glow)"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 1.35, 1], opacity: [0, 1, 0.72] }}
                transition={{ duration: 0.65, delay: node.delay, ease: [0.22, 1, 0.36, 1] }}
                style={{ transformOrigin: `${node.x}px ${node.y}px` }}
              />
            ))}
          </svg>

          <motion.div
            className="relative z-10 flex flex-col items-center gap-5 text-center"
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 1.95, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              className="relative rounded-[2rem] border border-cyan-300/25 bg-white/[0.055] p-5 shadow-[0_0_70px_rgba(34,211,238,0.22)] backdrop-blur-2xl"
              animate={{
                boxShadow: [
                  "0 0 50px rgba(34,211,238,0.18)",
                  "0 0 85px rgba(129,140,248,0.34)",
                  "0 0 50px rgba(34,211,238,0.18)",
                ],
              }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            >
              <BrainCircuit className="h-14 w-14 text-cyan-100" />
              <span className="absolute inset-0 rounded-[2rem] ai-card-sweep" />
            </motion.div>
            <div>
              <div className="bg-gradient-to-r from-cyan-200 via-white to-violet-200 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">
                DexTest
              </div>
              <div className="mt-3 text-xs font-semibold uppercase tracking-[0.38em] text-cyan-100/55">
                Neural Interface Online
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
