"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Trophy, Brain, Clock, Target, TrendingUp, CheckCircle, XCircle, Home, Loader2, FileText, Lock, Download } from 'lucide-react';
import { useTestStore, getAssessmentSnapshot, getCompletedTests, getLatestTestSession, getPreviousAttemptSnapshot, getSessionMetrics, getTestSessions, type TestType } from '@/lib/store';
import { reportAgent } from '@/lib/aiAgents';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

type ScholarshipSession = ReturnType<typeof getTestSessions>[number];

function getLatestSessionsByType(sessions: ScholarshipSession[]) {
  return sessions.reduce<Partial<Record<TestType, ScholarshipSession>>>((latest, session) => {
    latest[session.testType] = session;
    return latest;
  }, {});
}

function getQuestionPercent(session?: ScholarshipSession) {
  const sessionResults = session?.results || [];
  if (sessionResults.length === 0) return 0;

  const correct = sessionResults.filter((result) => result.isCorrect).length;
  return Math.round((correct / sessionResults.length) * 100);
}

function getGamePercent(session?: ScholarshipSession) {
  if (!session?.gameScores) return 0;

  const scoreTotal =
    (session.gameScores.templeRun?.score || 0) +
    (session.gameScores.reflexGame?.score || 0) +
    (session.gameScores.memoryGame?.score || 0);

  return Math.max(0, Math.min(100, Math.round(scoreTotal)));
}

function getScholarshipSummary(sessions: ScholarshipSession[]) {
  const latest = getLatestSessionsByType(sessions);
  const textScore = getQuestionPercent(latest.text);
  const voiceScore = getQuestionPercent(latest.voice);
  const gameScore = getGamePercent(latest.game);
  const totalPercentage = Math.round((textScore + voiceScore + gameScore) / 3);

  return {
    textScore,
    voiceScore,
    gameScore,
    totalPercentage,
    eligible: totalPercentage > 30,
  };
}

export default function ResultsPage() {
  const router = useRouter();
  const { results, gameScores, studentCode, studentClass, studentName, attentionScore, saveCurrentSession, testType } = useTestStore();
  const [analysis, setAnalysis] = useState<string>('');
  const [comprehensiveReport, setComprehensiveReport] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [showComprehensiveReport, setShowComprehensiveReport] = useState(false);
  const [completedTests, setCompletedTests] = useState<Record<TestType, boolean>>({
    text: false,
    voice: false,
    game: false,
  });

  const allTestsCompleted = completedTests.text && completedTests.voice && completedTests.game;
  const storedSessions = getTestSessions();
  const previousAttempt = getPreviousAttemptSnapshot();
  const remoteResults = previousAttempt?.lastTestResults;
  const hasRemoteAttempt = Boolean(previousAttempt?.hasAttempted && remoteResults);
  const latestSession =
    getLatestTestSession(testType || undefined) ||
    getLatestTestSession();
  const currentGameScores = {
    ...(gameScores.templeRun ? { templeRun: gameScores.templeRun } : {}),
    ...(gameScores.reflexGame ? { reflexGame: gameScores.reflexGame } : {}),
    ...(gameScores.memoryGame ? { memoryGame: gameScores.memoryGame } : {}),
  };
  const hasCurrentAttempt =
    results.length > 0 ||
    Boolean(gameScores.templeRun || gameScores.reflexGame || gameScores.memoryGame);
  const activeSession = hasCurrentAttempt
    ? {
        sessionId: 'current-attempt',
        testType: testType || latestSession?.testType || 'text',
        timestamp: new Date(),
        questions: latestSession?.questions || [],
        results,
        gameScores: currentGameScores,
        attentionScore,
      }
    : latestSession;
  const hasLocalSessionData = hasCurrentAttempt || storedSessions.length > 0;
  const displayResults = activeSession?.results || [];
  const displayGameScores = activeSession?.gameScores || remoteResults?.gameScores || {};
  const activeMetrics = getSessionMetrics(activeSession || undefined);
  const assessmentSnapshot = hasLocalSessionData
    ? getAssessmentSnapshot(storedSessions)
    : {
        accuracy: Number(remoteResults?.score || 0),
        averageReactionTime: Math.round(Number(remoteResults?.avgReactionTime || 0)),
        attentionScore: Math.round(Number(remoteResults?.attentionScore || 100)),
        estimatedIQ: Number(remoteResults?.iqScore || Math.round(Math.max(70, Math.min(150, 100 + ((Number(remoteResults?.score || 0) - 50) * 0.5) - ((Number(remoteResults?.avgReactionTime || 0) - 5000) / 1000))))),
      };
  const scholarshipSummary = hasLocalSessionData
    ? getScholarshipSummary(storedSessions)
    : {
        textScore: Number(remoteResults?.scholarship?.textScore || 0),
        voiceScore: Number(remoteResults?.scholarship?.voiceScore || 0),
        gameScore: Number(remoteResults?.scholarship?.gameScore || 0),
        totalPercentage: Number(remoteResults?.scholarship?.totalPercentage || remoteResults?.score || 0),
        eligible: Boolean(
          typeof remoteResults?.scholarship?.eligible === 'boolean'
            ? remoteResults.scholarship.eligible
            : Number(remoteResults?.score || 0) > 30
        ),
      };
  const displayStudentName = studentName || previousAttempt?.studentName || 'Student';
  const displayStudentClass = studentClass || previousAttempt?.studentClass || 'N/A';
  const canShowSavedAnalysis = Boolean(remoteResults?.analysis);

  const analyzeResults = async () => {
    try {
      if (!latestSession && hasRemoteAttempt) {
        setCompletedTests(getCompletedTests());
        setAnalysis(remoteResults?.analysis || 'Saved results found for this student. Detailed AI analysis is not available in this browser session yet.');
        setLoading(false);
        return;
      }

      if (!latestSession) {
        setAnalysis('No test results available. Please complete a test first.');
        setLoading(false);
        return;
      }

      const lockedTests = getCompletedTests();
      setCompletedTests(lockedTests);

      if (!lockedTests.text || !lockedTests.voice || !lockedTests.game) {
        setAnalysis('AI report is locked until Text-Based, Voice-Based, and Game-Based tests are all completed in this browser session.');
        setLoading(false);
        return;
      }

      const performanceAnalysis = await reportAgent.analyzeCurrentSession(
        latestSession,
        studentClass,
        studentName
      );
      setAnalysis(performanceAnalysis);

      // Save results to Firestore
      if (studentCode) {
        const userDocRef = doc(db, 'users', studentCode);
        await updateDoc(userDocRef, {
          lastTestDate: serverTimestamp(),
          lastTestResults: {
            score: assessmentSnapshot.accuracy,
            iqScore: calculateIQScore(),
            correctAnswers: displayResults.filter(r => r.isCorrect).length,
            totalQuestions: displayResults.length,
            avgReactionTime: assessmentSnapshot.averageReactionTime,
            gameScores: displayGameScores,
            attentionScore: activeSession?.attentionScore ?? assessmentSnapshot.attentionScore,
            analysis: performanceAnalysis,
            scholarship: scholarshipSummary,
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
    return activeMetrics.accuracy;
  };

  const calculateIQScore = () => {
    return assessmentSnapshot.estimatedIQ;
  };

  useEffect(() => {
    const hasStoredAttempt = storedSessions.length > 0 || hasRemoteAttempt;

    if (!hasCurrentAttempt && !hasStoredAttempt) {
      router.push('/test');
      return;
    }

    if (hasCurrentAttempt) {
      saveCurrentSession();
    }
    const timer = window.setTimeout(() => {
      setCompletedTests(getCompletedTests());
      analyzeResults();
    }, 0);

    return () => window.clearTimeout(timer);
    // Commit the just-finished session once when the results page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerateComprehensiveReport = async () => {
    setLoading(true);
    try {
      const allSessions = getTestSessions();
      const lockedTests = getCompletedTests();
      setCompletedTests(lockedTests);

      if (!lockedTests.text || !lockedTests.voice || !lockedTests.game) {
        setComprehensiveReport('Complete Text-Based, Voice-Based, and Game-Based tests to unlock the AI-generated report.');
        setShowComprehensiveReport(true);
        return;
      }

      if (allSessions.length === 0) {
        setComprehensiveReport('No test sessions found. Complete at least one test to generate a comprehensive report.');
        return;
      }

      const report = await reportAgent.generateComprehensiveReport(allSessions, studentClass, studentName);
      setComprehensiveReport(report);
      setShowComprehensiveReport(true);
    } catch (error) {
      console.error('Error generating comprehensive report:', error);
      setComprehensiveReport('Unable to generate comprehensive report. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);

    try {
      const response = await fetch('/api/reports/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName,
          studentClass,
          iqScore: calculateIQScore(),
          score: calculateScore(),
          avgReactionTime,
          attentionScore: activeSession?.attentionScore ?? assessmentSnapshot.attentionScore,
          analysis,
          comprehensiveReport: showComprehensiveReport ? comprehensiveReport : '',
          sessions: storedSessions,
          scholarship: scholarshipSummary,
        }),
      });

      if (!response.ok) {
        throw new Error('PDF generation failed.');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeName = (studentName || 'student').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
      link.href = url;
      link.download = `dextest-report-${safeName || 'student'}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Unable to generate the PDF right now. Please try again.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const avgReactionTime = assessmentSnapshot.averageReactionTime;

  return (
    <div className="ai-page-atmosphere min-h-screen text-white py-12 px-4">
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
            {displayStudentName} - Class {displayStudentClass}
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
            <p className="text-4xl font-bold text-white">{assessmentSnapshot.accuracy}%</p>
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
            <p className="text-4xl font-bold text-white">{activeSession?.attentionScore ?? assessmentSnapshot.attentionScore}%</p>
          </motion.div>
        </div>

        {/* Scholarship Summary */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className={`mb-12 overflow-hidden rounded-3xl border backdrop-blur-xl ${
            scholarshipSummary.eligible
              ? 'border-emerald-400/40 bg-emerald-500/10'
              : 'border-rose-400/40 bg-rose-500/10'
          }`}
        >
          <div className="grid gap-0 md:grid-cols-[1.15fr_1fr]">
            <div className="p-7">
              <div className="mb-2 flex items-center gap-3">
                <Trophy
                  className={`h-7 w-7 ${
                    scholarshipSummary.eligible ? 'text-emerald-300' : 'text-rose-300'
                  }`}
                />
                <h2 className="text-2xl font-bold">Scholarship Eligibility</h2>
              </div>
              <p className="text-sm leading-relaxed text-zinc-300">
                Total score is calculated from all three test formats: text, voice, and game. Students scoring
                greater than 30% are eligible for scholarship consideration.
              </p>
            </div>
            <div className="border-t border-white/10 bg-black/20 p-7 md:border-l md:border-t-0">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Total Score</p>
                  <p className="text-5xl font-extrabold text-white">{scholarshipSummary.totalPercentage}%</p>
                </div>
                <span
                  className={`rounded-full px-4 py-2 text-sm font-bold ${
                    scholarshipSummary.eligible
                      ? 'bg-emerald-400/20 text-emerald-200'
                      : 'bg-rose-400/20 text-rose-200'
                  }`}
                >
                  {scholarshipSummary.eligible ? 'Eligible' : 'Not Eligible'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center text-sm">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-zinc-400">Text</p>
                  <p className="text-lg font-bold">{scholarshipSummary.textScore}%</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-zinc-400">Voice</p>
                  <p className="text-lg font-bold">{scholarshipSummary.voiceScore}%</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-zinc-400">Game</p>
                  <p className="text-lg font-bold">{scholarshipSummary.gameScore}%</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

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
            {displayResults.length > 0 ? (
              <div className="space-y-3">
                {displayResults.map((result, index) => (
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
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-zinc-400">
                Detailed question-by-question data is unavailable for this saved attempt. Summary results are shown from
                the student&apos;s previous Firestore record.
              </div>
            )}
          </motion.div>

          {/* AI Analysis */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-3xl p-8"
          >
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              {allTestsCompleted ? (
                <Brain className="w-6 h-6 text-purple-400" />
              ) : canShowSavedAnalysis ? (
                <Brain className="w-6 h-6 text-purple-400" />
              ) : (
                <Lock className="w-6 h-6 text-purple-400" />
              )}
              {allTestsCompleted || canShowSavedAnalysis ? 'AI Analysis' : 'AI Analysis Locked'}
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
        {(displayGameScores.templeRun || displayGameScores.reflexGame || displayGameScores.memoryGame) && (
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
              {displayGameScores.templeRun && (
                <div className="p-4 bg-zinc-950/40 rounded-xl">
                  <h3 className="font-semibold mb-2">Temple Run</h3>
                  <p className="text-2xl font-bold text-orange-400">{displayGameScores.templeRun.score}</p>
                  <p className="text-xs text-zinc-500">Avg: {Math.round(displayGameScores.templeRun.reactionTime)}ms</p>
                </div>
              )}
              {displayGameScores.reflexGame && (
                <div className="p-4 bg-zinc-950/40 rounded-xl">
                  <h3 className="font-semibold mb-2">Reflex Challenge</h3>
                  <p className="text-2xl font-bold text-purple-400">{displayGameScores.reflexGame.score}</p>
                  <p className="text-xs text-zinc-500">Avg: {Math.round(displayGameScores.reflexGame.reactionTime)}ms</p>
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
            disabled={!allTestsCompleted || (loading && showComprehensiveReport)}
            className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {allTestsCompleted ? <FileText className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            {allTestsCompleted
              ? showComprehensiveReport
                ? 'Regenerate Full Report'
                : 'Generate Comprehensive Report'
              : 'Complete All Tests to Unlock Report'}
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={loading || downloadingPdf}
            className="px-8 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {downloadingPdf ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Download className="w-5 h-5" />
            )}
            {downloadingPdf ? 'Generating PDF...' : 'Download PDF'}
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
