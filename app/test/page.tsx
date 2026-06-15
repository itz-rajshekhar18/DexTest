"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { MessageSquare, Mic, Gamepad2, Brain, ArrowRight, Loader2 } from 'lucide-react';
import { useTestStore } from '@/lib/store';
import { generateIQQuestions } from '@/lib/openrouter';
import CameraMonitor from '@/components/camera/CameraMonitor';

export default function TestSelectionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<'text' | 'voice' | 'game' | null>(null);
  const { studentClass, setTestType, setQuestions } = useTestStore();

  const testTypes = [
    {
      id: 'text' as const,
      title: 'Text-Based Test',
      description: 'Answer IQ questions using text input',
      icon: MessageSquare,
      color: 'from-indigo-500 to-blue-500',
      bgColor: 'bg-indigo-500/10',
      borderColor: 'border-indigo-500/50',
    },
    {
      id: 'voice' as const,
      title: 'Voice-Based Test',
      description: 'Answer questions using voice commands',
      icon: Mic,
      color: 'from-purple-500 to-pink-500',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/50',
    },
    {
      id: 'game' as const,
      title: 'Game-Based Test',
      description: 'Test your reflexes and reaction time',
      icon: Gamepad2,
      color: 'from-green-500 to-teal-500',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/50',
    },
  ];

  const handleStartTest = async (type: 'text' | 'voice' | 'game') => {
    setLoading(true);
    setSelectedType(type);
    setTestType(type);

    try {
      if (type === 'text' || type === 'voice') {
        // Generate IQ questions based on class level
        const questions = await generateIQQuestions(studentClass, 'logical', 10);
        setQuestions(questions);
        
        if (type === 'text') {
          router.push('/test/text-test');
        } else {
          router.push('/test/voice-test');
        }
      } else {
        // Navigate to game selection
        router.push('/test/games');
      }
    } catch (error) {
      console.error('Error starting test:', error);
      alert('Failed to generate questions. Please try again.');
      setLoading(false);
      setSelectedType(null);
    }
  };

  return (
    <div className="ai-page-atmosphere min-h-screen text-white py-12 px-4">
      <CameraMonitor />

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl mb-4">
            <Brain className="w-12 h-12 text-indigo-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 bg-gradient-to-r from-indigo-200 via-white to-purple-200 bg-clip-text text-transparent">
            Choose Your Test Type
          </h1>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
            Select how you&apos;d like to take your IQ assessment. Each method tests different cognitive abilities.
          </p>
        </motion.div>

        {/* Test Type Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {testTypes.map((test, index) => (
            <motion.div
              key={test.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02, y: -5 }}
              className={`bg-zinc-900/60 backdrop-blur-xl border ${test.borderColor} rounded-3xl p-8 cursor-pointer transition-all relative overflow-hidden group`}
              onClick={() => !loading && handleStartTest(test.id)}
            >
              {/* Background Gradient */}
              <div className={`absolute inset-0 bg-gradient-to-br ${test.color} opacity-0 group-hover:opacity-10 transition-opacity`} />

              {/* Content */}
              <div className="relative z-10">
                <div className={`inline-flex items-center justify-center p-4 ${test.bgColor} border ${test.borderColor} rounded-2xl mb-4`}>
                  <test.icon className="w-8 h-8" />
                </div>

                <h3 className="text-2xl font-bold mb-3">{test.title}</h3>
                <p className="text-zinc-400 mb-6">{test.description}</p>

                <button
                  disabled={loading}
                  className={`w-full py-3 bg-gradient-to-r ${test.color} hover:opacity-90 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {loading && selectedType === test.id ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      Start Test
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Information Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6"
        >
          <h3 className="text-xl font-bold mb-4 text-indigo-400">Test Information</h3>
          <div className="grid md:grid-cols-3 gap-6 text-sm">
            <div>
              <h4 className="font-semibold mb-2 text-white">Text-Based</h4>
              <ul className="space-y-1 text-zinc-400">
                <li>• 10 IQ questions</li>
                <li>• Multiple choice format</li>
                <li>• Timed responses</li>
                <li>• Measures logical reasoning</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-white">Voice-Based</h4>
              <ul className="space-y-1 text-zinc-400">
                <li>• Spoken questions</li>
                <li>• Voice recognition</li>
                <li>• Audio feedback</li>
                <li>• Tests verbal comprehension</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-white">Game-Based</h4>
              <ul className="space-y-1 text-zinc-400">
                <li>• 3D interactive games</li>
                <li>• Reaction time measurement</li>
                <li>• Spatial awareness tests</li>
                <li>• Attention monitoring</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
