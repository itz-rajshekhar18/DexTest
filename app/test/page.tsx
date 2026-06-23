"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { MessageSquare, Mic, Gamepad2, Brain, ArrowRight, Loader2, Lock } from 'lucide-react';
import { getCompletedTests, getLatestTestSession, type TestType, useTestStore } from '@/lib/store';
import { voiceIQAgent, writtenIQAgent } from '@/lib/aiAgents';
import CameraMonitor from '@/components/camera/CameraMonitor';

export default function TestSelectionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<'text' | 'voice' | 'game' | null>(null);
  const [completedTests, setCompletedTests] = useState<Record<TestType, boolean>>({
    text: false,
    voice: false,
    game: false,
  });
  const { studentAge, studentClass, setTestType, setQuestions, resetTest } = useTestStore();

  useEffect(() => {
    const timer = window.setTimeout(() => setCompletedTests(getCompletedTests()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const testTypes = [
    {
      id: 'text' as const,
      title: 'Text-Based Test',
      description: 'AI creates written IQ questions adapted to the student profile',
      icon: MessageSquare,
      color: 'from-indigo-500 to-blue-500',
      bgColor: 'bg-indigo-500/10',
      borderColor: 'border-indigo-500/50',
      agent: writtenIQAgent.name,
    },
    {
      id: 'voice' as const,
      title: 'Voice-Based Test',
      description: 'AI asks oral IQ questions and listens for spoken answers',
      icon: Mic,
      color: 'from-purple-500 to-pink-500',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/50',
      agent: voiceIQAgent.name,
    },
    {
      id: 'game' as const,
      title: 'Game-Based Test',
      description: 'Test your reflexes and reaction time',
      icon: Gamepad2,
      color: 'from-green-500 to-teal-500',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/50',
      agent: 'Game IQ Test Agent',
    },
  ];

  const handleStartTest = async (type: 'text' | 'voice' | 'game') => {
    if (completedTests[type]) return;

    setLoading(true);
    setSelectedType(type);
    resetTest();
    setTestType(type);

    try {
      if (type === 'text') {
        const questions = await writtenIQAgent.generateTest({
          classLevel: studentClass || 10,
          questionType: 'logical',
          count: 10,
          studentAge,
        });
        setQuestions(questions);
        router.push('/test/text-test');
      } else if (type === 'voice') {
        const questions = await voiceIQAgent.generateVoiceQuestions(studentClass || 10, 10, studentAge);
        setQuestions(questions);
        router.push('/test/voice-test');
      } else {
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
          {testTypes.map((test, index) => {
            const locked = completedTests[test.id];
            const latestSession = getLatestTestSession(test.id);
            const correct = latestSession?.results?.filter((result) => result.isCorrect).length || 0;
            const total = latestSession?.results?.length || 0;

            return (
              <motion.div
                key={test.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={locked ? undefined : { scale: 1.02, y: -5 }}
                className={`bg-zinc-900/60 backdrop-blur-xl border ${test.borderColor} rounded-3xl p-8 transition-all relative overflow-hidden group ${
                  locked ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
                }`}
                onClick={() => !loading && handleStartTest(test.id)}
              >
                {/* Background Gradient */}
                <div className={`absolute inset-0 bg-gradient-to-br ${test.color} opacity-0 group-hover:opacity-10 transition-opacity`} />

                {/* Content */}
                <div className="relative z-10">
                  <div className={`inline-flex items-center justify-center p-4 ${test.bgColor} border ${test.borderColor} rounded-2xl mb-4`}>
                    {locked ? <Lock className="w-8 h-8" /> : <test.icon className="w-8 h-8" />}
                  </div>

                  <h3 className="text-2xl font-bold mb-3">{test.title}</h3>
                  <p className="text-zinc-400 mb-5">{test.description}</p>

                  <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-400">
                    <span className="text-zinc-200">{test.agent}</span>
                    {locked && (
                      <span className="mt-1 block text-emerald-300">
                        Completed and locked{total > 0 ? ` - ${correct}/${total} correct` : ''}
                      </span>
                    )}
                  </div>

                  <button
                    disabled={loading || locked}
                    className={`w-full py-3 bg-gradient-to-r ${test.color} hover:opacity-90 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {locked ? (
                      <>
                        <Lock className="w-5 h-5" />
                        Locked
                      </>
                    ) : loading && selectedType === test.id ? (
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
            );
          })}
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
