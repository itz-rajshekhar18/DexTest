"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Trophy, Brain, Clock, Target, TrendingUp, CheckCircle, XCircle, Home, Loader2, FileText } from 'lucide-react';
import { useTestStore, getTestSessions } from '@/lib/store';
import { analyzePerformance, generateComprehensiveReport } from '@/lib/openrouter';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function ResultsPage() {
  const router = useRouter();
  const { results, gameScores, studentCode, studentClass, studentName, questions, attentionScore, saveCurrentSession } = useTestStore();
  const [analysis, setAnalysis] = useState<string>('');
  const [comprehensiveReport, setComprehensiveReport] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showComprehensiveReport, setShowComprehensiveReport] = useState(false);

  useEffect(() => {
    // Redirect if no results
    if (results.length === 0 && !gameScores.templeRun && !gameScores.reflexGame && !gameScores.memoryGame) {
      router.push('/test');
      return;
    }
    
    // Save current session to session storage
    saveCurrentSession();
    
    // Analyze results
    analyzeResults();
  }, []);

  const analyzeResults = async () => {
    try {
      if (results.length === 0) {
        setAnalysis('No test results available. Please complete a test first.');
        setLoading(false);
        return;
      }

      const reactionTimes = results.map(r => r.reactionTime);
      const performanceAnalysis = await analyzePerformance(results, reactionTimes, studentClass);
      setAnalysis(performanceAnalysis);

      // Save results to Firestore
      if (studentCode) {
        const userDocRef = doc(db, 'users', studentCode);
        await updateDoc(userDocRef, {
          lastTestDate: serverTimestamp(),
          lastTestResults: {
            score: calculateScore(),
            correctAnswers: results.filter(r => r.isCorrect).length,
            totalQuestions: results.length,
            avgReactionTime: reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length,
            gameScores,
            attentionScore,
            analysis: performanceAnalysis,
          },
        });
      }
    } catch (error) {
      console.error('Error analyzing results:', error);
      setAnalysis('Unable to generate detailed analysis at this time. Your scores are displayed above.');
    } finally {
      setLoading(false);
    }
  };

  const calculateScore = () => {
    if (results.length === 0) return 0;
    const correctAnswers = results.filter(r => r.isCorrect).length;
    const totalQuestions = results.length;
    return Math.round((correctAnswers / totalQuestions) * 100);
  };

  const calculateIQScore = () => {
    if (results.length === 0) return 100;
    
    const baseScore = calculateScore();
    const avgReactionTime = results.reduce((sum, r) => sum + r.reactionTime, 0) / results.length;
    
    // IQ calculation (simplified)
    // Base IQ: 100, adjust based on score and reaction time
    let iq = 100;
    iq += (baseScore - 50) * 0.5; // ±25 points based on accuracy
    iq -= (avgReactionTime - 5000) / 1000; // Adjust for reaction time
    
    const finalIQ = Math.round(Math.max(70, Math.min(150, iq)));
    return isNaN(finalIQ) ? 100 : finalIQ;
  };

  const handleGenerateComprehensiveReport = async () => {
    setLoading(true);
    try {
      const allSessions = getTestSessions();
      if (allSessions.length === 0) {
        setComprehensiveReport('No test sessions found. Complete at least one test to generate a comprehensive report.');
        return;
      }

      const report = await generateComprehensiveReport(allSessions, studentClass, studentName);
      setComprehensiveReport(report);
      setShowComprehensiveReport(true);
    } catch (error) {
      console.error('Error generating comprehensive report:', error);
      setComprehensiveReport('Unable to generate comprehensive report. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const avgReactionTime = results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + r.reactionTime, 0) / results.length)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-zinc-900 to-slate-950 text-white py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-full mb-4">
            <Trophy className="w-16 h-16 text-yellow-500" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 bg-gradient-to-r from-yellow-200 via-white to-yellow-200 bg-clip-text text-transparent">
            Test Results
          </h1>
          <p className="text-zinc-400 text-lg">
            {studentName} - Class {studentClass}
          </p>
        </motion.div>

        {/* Score Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-indigo-900/40 to-indigo-950/40 backdrop-blur-xl border border-indigo-800 rounded-2xl p-6"
          >
            <Brain className="w-10 h-10 text-indigo-400 mb-3" />
            <p className="text-sm text-zinc-400 mb-1">Estimated IQ</p>
            <p className="text-4xl font-bold text-white">{calculateIQScore()}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-green-900/40 to-green-950/40 backdrop-blur-xl border border-green-800 rounded-2xl p-6"
          >
            <CheckCircle className="w-10 h-10 text-green-400 mb-3" />
            <p className="text-sm text-zinc-400 mb-1">Accuracy</p>
            <p className="text-4xl font-bold text-white">{calculateScore()}%</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-purple-900/40 to-purple-950/40 backdrop-blur-xl border border-purple-800 rounded-2xl p-6"
          >
            <Clock className="w-10 h-10 text-purple-400 mb-3" />
            <p className="text-sm text-zinc-400 mb-1">Avg Reaction</p>
            <p className="text-4xl font-bold text-white">{avgReactionTime}ms</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-br from-yellow-900/40 to-yellow-950/40 backdrop-blur-xl border border-yellow-800 rounded-2xl p-6"
          >
            <Target className="w-10 h-10 text-yellow-400 mb-3" />
            <p className="text-sm text-zinc-400 mb-1">Attention</p>
            <p className="text-4xl font-bold text-white">{attentionScore}%</p>
          </motion.div>
        </div>

        {/* Detailed Results */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Question Results */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-3xl p-8"
          >
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-indigo-400" />
              Question Breakdown
            </h2>
            <div className="space-y-3">
              {results.map((result, index) => (
                <div
                  key={result.questionId}
                  className="flex items-center justify-between p-3 bg-zinc-950/40 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    {result.isCorrect ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                    <span className="text-sm">Question {index + 1}</span>
                  </div>
                  <span className="text-xs text-zinc-500">{result.reactionTime}ms</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* AI Analysis */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-3xl p-8"
          >
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <Brain className="w-6 h-6 text-purple-400" />
              AI Analysis
            </h2>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              </div>
            ) : (
              <div className="prose prose-invert prose-sm max-w-none">
                <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">{analysis}</p>
              </div>
            )}
          </motion.div>
        </div>

        {/* Game Scores */}
        {(gameScores.templeRun || gameScores.reflexGame || gameScores.memoryGame) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-3xl p-8 mb-12"
          >
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <Trophy className="w-6 h-6 text-yellow-400" />
              Game Performance
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {gameScores.templeRun && (
                <div className="p-4 bg-zinc-950/40 rounded-xl">
                  <h3 className="font-semibold mb-2">Temple Run</h3>
                  <p className="text-2xl font-bold text-orange-400">{gameScores.templeRun.score}</p>
                  <p className="text-xs text-zinc-500">Avg: {Math.round(gameScores.templeRun.reactionTime)}ms</p>
                </div>
              )}
              {gameScores.reflexGame && (
                <div className="p-4 bg-zinc-950/40 rounded-xl">
                  <h3 className="font-semibold mb-2">Reflex Challenge</h3>
                  <p className="text-2xl font-bold text-purple-400">{gameScores.reflexGame.score}</p>
                  <p className="text-xs text-zinc-500">Avg: {Math.round(gameScores.reflexGame.reactionTime)}ms</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="flex flex-wrap gap-4 justify-center"
        >
          <button
            onClick={handleGenerateComprehensiveReport}
            disabled={loading && showComprehensiveReport}
            className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <FileText className="w-5 h-5" />
            {showComprehensiveReport ? 'Regenerate Full Report' : 'Generate Comprehensive Report'}
          </button>
          <button
            onClick={() => router.push('/test')}
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors"
          >
            Take Another Test
          </button>
          <button
            onClick={() => router.push('/')}
            className="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-xl transition-colors flex items-center gap-2"
          >
            <Home className="w-5 h-5" />
            Home
          </button>
        </motion.div>

        {/* Comprehensive Report Section */}
        {showComprehensiveReport && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-12 bg-gradient-to-br from-purple-900/20 to-pink-900/20 backdrop-blur-xl border border-purple-800/50 rounded-3xl p-8"
          >
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
              <FileText className="w-8 h-8 text-purple-400" />
              Comprehensive Assessment Report
            </h2>
            <div className="bg-zinc-950/60 rounded-2xl p-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                </div>
              ) : (
                <div className="prose prose-invert prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap text-zinc-300 leading-relaxed font-sans">
                    {comprehensiveReport}
                  </pre>
                </div>
              )}
            </div>
            <p className="text-xs text-zinc-500 mt-4 text-center">
              This report analyzes all test sessions stored in your browser. Total sessions: {getTestSessions().length}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
