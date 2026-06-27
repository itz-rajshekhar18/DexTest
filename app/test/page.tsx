"use client";

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { MessageSquare, Mic, Gamepad2, ArrowRight, Loader2, Lock, Trophy, FileText } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  getCompletedTests,
  getLatestTestSession,
  getPreviousAttemptSnapshot,
  getStudentProfile,
  savePreviousAttemptSnapshot,
  clearPreviousAttemptSnapshot,
  type StudentProfile,
  type TestType,
  useTestStore,
} from '@/lib/store';
import { voiceIQAgent, writtenIQAgent } from '@/lib/aiAgents';
import CameraMonitor from '@/components/camera/CameraMonitor';

function parseClassLevel(classValue: unknown) {
  const match = String(classValue || '').match(/\d+/);
  return match ? Number(match[0]) : 10;
}

export default function TestSelectionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<'text' | 'voice' | 'game' | null>(null);
  const [completedTests, setCompletedTests] = useState<Record<TestType, boolean>>({
    text: false,
    voice: false,
    game: false,
  });
  const [hasPreviousAttempt, setHasPreviousAttempt] = useState(false);
  const allTestsCompleted = completedTests.text && completedTests.voice && completedTests.game;
  const {
    studentAge,
    studentClass,
    studentCode,
    studentGender,
    studentName,
    setStudentInfo,
    setTestType,
    setQuestions,
    setQuestionsLoading,
    resetTest,
  } = useTestStore();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCompletedTests(getCompletedTests());
      setHasPreviousAttempt(Boolean(getPreviousAttemptSnapshot()?.hasAttempted));
    }, 0);
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

  const resolveStudentProfile = async (): Promise<StudentProfile> => {
    const cachedProfile = getStudentProfile();
    const code = studentCode || cachedProfile?.studentCode || '';

    if (code) {
      try {
        const userDocSnap = await getDoc(doc(db, 'users', code));

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          if (userData.lastTestResults || userData.lastTestDate) {
            savePreviousAttemptSnapshot({
              hasAttempted: true,
              studentCode: code,
              studentName: String(userData.name || cachedProfile?.studentName || studentName || 'Student'),
              studentClass: parseClassLevel(userData.class),
              lastTestDate:
                typeof userData.lastTestDate?.toDate === 'function'
                  ? userData.lastTestDate.toDate().toISOString()
                  : String(userData.lastTestDate || ''),
              lastTestResults: {
                score: Number(userData.lastTestResults?.score || 0),
                iqScore: Number(userData.lastTestResults?.iqScore || 0),
                correctAnswers: Number(userData.lastTestResults?.correctAnswers || 0),
                totalQuestions: Number(userData.lastTestResults?.totalQuestions || 0),
                avgReactionTime: Number(userData.lastTestResults?.avgReactionTime || 0),
                gameScores: userData.lastTestResults?.gameScores || {},
                attentionScore: Number(userData.lastTestResults?.attentionScore || 0),
                analysis: String(userData.lastTestResults?.analysis || ''),
                scholarship: userData.lastTestResults?.scholarship || undefined,
              },
            });
            setHasPreviousAttempt(true);
          } else {
            clearPreviousAttemptSnapshot();
            setHasPreviousAttempt(false);
          }
          const profile = {
            studentCode: code,
            studentClass: parseClassLevel(userData.class),
            studentName: String(userData.name || cachedProfile?.studentName || studentName || 'Student'),
            studentAge: Number(userData.age || cachedProfile?.studentAge || studentAge || 0),
            studentGender: String(userData.gender || userData.sex || cachedProfile?.studentGender || studentGender || ''),
          };

          setStudentInfo(
            profile.studentCode,
            profile.studentClass,
            profile.studentName,
            profile.studentAge,
            profile.studentGender
          );

          return profile;
        }
      } catch (error) {
        console.warn('Could not refresh student profile from Firestore:', error);
      }
    }

    return {
      studentCode: code,
      studentClass: studentClass || cachedProfile?.studentClass || 10,
      studentName: studentName || cachedProfile?.studentName || 'Student',
      studentAge: studentAge || cachedProfile?.studentAge || 0,
      studentGender: studentGender || cachedProfile?.studentGender || '',
    };
  };

  const handleStartTest = async (type: 'text' | 'voice' | 'game') => {
    // A completed test is locked and cannot be retaken.
    if (completedTests[type]) {
      if (allTestsCompleted) {
        router.push('/test/results');
      }
      return;
    }

    setLoading(true);
    setSelectedType(type);
    resetTest();
    setTestType(type);

    if (type === 'game') {
      router.push('/test/games');
      return;
    }

    // Navigate to the test page first so the question-generation loader is shown
    // there, then generate the questions in the background.
    setQuestionsLoading(true);
    router.push(type === 'text' ? '/test/text-test' : '/test/voice-test');

    try {
      const profile = await resolveStudentProfile();

      if (type === 'text') {
        const questions = await writtenIQAgent.generateTest({
          classLevel: profile.studentClass,
          count: 10,
        });
        setQuestions(questions);
      } else {
        const questions = await voiceIQAgent.generateVoiceQuestions(profile.studentClass, 10);
        setQuestions(questions);
      }
    } catch (error) {
      console.error('Error starting test:', error);
      setQuestionsLoading(false);
      alert('Failed to generate questions. Please try again.');
      router.replace('/test');
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
          <div className="inline-flex items-center justify-center overflow-hidden rounded-2xl border border-cyan-300/20 bg-slate-950 p-1.5 shadow-[0_0_45px_rgba(34,211,238,0.18)] mb-4">
            <Image
              src="/dextest-logo-dark.png"
              alt="DexTest"
              width={260}
              height={146}
              priority
              className="h-16 w-auto rounded-xl object-contain"
            />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 bg-gradient-to-r from-indigo-200 via-white to-purple-200 bg-clip-text text-transparent">
            Choose Your Test Type
          </h1>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
            Select how you&apos;d like to take your IQ assessment. Each method tests different cognitive abilities.
          </p>
        </motion.div>

        {allTestsCompleted && (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-10 overflow-hidden rounded-3xl border border-cyan-300/30 bg-gradient-to-br from-cyan-500/12 via-indigo-500/10 to-purple-500/12 shadow-[0_0_55px_rgba(34,211,238,0.12)] backdrop-blur-xl"
          >
            <div className="grid gap-0 md:grid-cols-[1.2fr_auto]">
              <div className="p-7">
                <div className="mb-3 flex items-center gap-3">
                  <div className="rounded-2xl border border-cyan-300/25 bg-cyan-300/10 p-3">
                    <Trophy className="h-7 w-7 text-cyan-200" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/80">Assessment Complete</p>
                    <h2 className="text-2xl font-bold text-white">All tests are locked</h2>
                  </div>
                </div>
                <p className="max-w-2xl text-sm leading-relaxed text-zinc-300">
                  Text-Based, Voice-Based, and Game-Based assessments are complete. Open the results page to view
                  your AI report, scholarship score, and PDF download option.
                </p>
              </div>
              <div className="flex items-center border-t border-white/10 bg-black/20 p-7 md:border-l md:border-t-0">
                <button
                  onClick={() => router.push('/test/results')}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-7 py-3 font-semibold text-white transition hover:opacity-90 md:w-auto"
                >
                  <FileText className="h-5 w-5" />
                  View Results
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {hasPreviousAttempt && !allTestsCompleted && (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-10 overflow-hidden rounded-3xl border border-indigo-300/25 bg-indigo-500/10 shadow-[0_0_40px_rgba(99,102,241,0.12)] backdrop-blur-xl"
          >
            <div className="grid gap-0 md:grid-cols-[1.2fr_auto]">
              <div className="p-7">
                <div className="mb-3 flex items-center gap-3">
                  <div className="rounded-2xl border border-indigo-300/25 bg-indigo-300/10 p-3">
                    <FileText className="h-7 w-7 text-indigo-200" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-indigo-200/80">Previous Attempt Found</p>
                    <h2 className="text-2xl font-bold text-white">Saved results are available</h2>
                  </div>
                </div>
                <p className="max-w-2xl text-sm leading-relaxed text-zinc-300">
                  This student has attempted the assessment before. Open the results page to review the saved report,
                  then continue with a fresh attempt whenever you&apos;re ready.
                </p>
              </div>
              <div className="flex items-center border-t border-white/10 bg-black/20 p-7 md:border-l md:border-t-0">
                <button
                  onClick={() => router.push('/test/results')}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-7 py-3 font-semibold text-white transition hover:opacity-90 md:w-auto"
                >
                  <FileText className="h-5 w-5" />
                  View Previous Results
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

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
                  locked && !allTestsCompleted ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
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
                    disabled={loading || (locked && !allTestsCompleted)}
                    className={`w-full py-3 bg-gradient-to-r ${test.color} hover:opacity-90 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {locked ? (
                      <>
                        {allTestsCompleted ? <FileText className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                        {allTestsCompleted ? 'View Results' : 'Locked'}
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
