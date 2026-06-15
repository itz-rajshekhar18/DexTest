"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Zap, Target, Brain, ArrowLeft } from 'lucide-react';

export default function GameSelectionPage() {
  const router = useRouter();

  const games = [
    {
      id: 'temple-run',
      title: 'Temple Run',
      description: 'Dodge obstacles and test your reaction speed',
      icon: Zap,
      color: 'from-orange-500 to-red-500',
      route: '/test/games/temple-run',
    },
    {
      id: 'reflex',
      title: 'Reflex Challenge',
      description: 'Click targets as fast as you can',
      icon: Target,
      color: 'from-purple-500 to-pink-500',
      route: '/test/games/reflex',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-zinc-900 to-slate-950 text-white py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => router.push('/test')}
          className="mb-8 flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Test Selection
        </button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center p-3 bg-green-500/10 border border-green-500/20 rounded-2xl mb-4">
            <Brain className="w-12 h-12 text-green-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 bg-gradient-to-r from-green-200 via-white to-teal-200 bg-clip-text text-transparent">
            Choose Your Game
          </h1>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
            Test your reflexes, reaction time, and spatial awareness through interactive 3D games
          </p>
        </motion.div>

        {/* Game Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {games.map((game, index) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.05, y: -10 }}
              onClick={() => router.push(game.route)}
              className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-3xl p-8 cursor-pointer transition-all relative overflow-hidden group"
            >
              {/* Background Gradient */}
              <div className={`absolute inset-0 bg-gradient-to-br ${game.color} opacity-0 group-hover:opacity-20 transition-opacity`} />

              {/* Content */}
              <div className="relative z-10 text-center">
                <div className="inline-flex items-center justify-center p-6 bg-zinc-800/50 rounded-full mb-4">
                  <game.icon className="w-12 h-12 text-white" />
                </div>

                <h3 className="text-2xl font-bold mb-3">{game.title}</h3>
                <p className="text-zinc-400 mb-6">{game.description}</p>

                <button
                  className={`w-full py-3 bg-gradient-to-r ${game.color} hover:opacity-90 text-white font-semibold rounded-xl transition-all`}
                >
                  Play Now
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
