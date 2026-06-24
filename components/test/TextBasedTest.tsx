"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isTestCompleted, useTestStore } from '@/lib/store';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Brain, ArrowRight } from 'lucide-react';

export default function TextBasedTest() {
  const router = useRouter();
  const { questions, currentQuestionIndex, addResult, nextQuestion } = useTestStore();
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const startTimeRef = useRef(0);

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  useEffect(() => {
    if (isTestCompleted('text')) {
      router.replace('/test');
    }
  }, [router]);

  useEffect(() => {
    if (!isTestCompleted('text') && questions.length === 0) {
      router.replace('/test');
    }
  }, [questions.length, router]);

  const handleSubmit = useCallback(() => {
    if (selectedAnswer === null || !currentQuestion || hasSubmitted) return;

    const reactionTime = Date.now() - startTimeRef.current;
    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;

    addResult({
      questionId: currentQuestion.id,
      selectedAnswer,
      isCorrect,
      reactionTime,
      timestamp: new Date(),
    });

    setHasSubmitted(true);
  }, [addResult, currentQuestion, selectedAnswer, hasSubmitted]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTimeLeft(currentQuestion?.timeLimit || 60);
      startTimeRef.current = Date.now();
      setSelectedAnswer(null);
      setHasSubmitted(false);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [currentQuestionIndex, currentQuestion]);

  useEffect(() => {
    if (timeLeft <= 0) {
      const submitTimer = window.setTimeout(() => handleSubmit(), 0);
      return () => window.clearTimeout(submitTimer);
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [handleSubmit, timeLeft]);

  const handleNext = () => {
    if (isLastQuestion) {
      // Navigate to results
      router.push('/test/results');
    } else {
      nextQuestion();
    }
  };

  if (!currentQuestion) {
    return (
      <div className="ai-page-atmosphere min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Loading question...</div>
      </div>
    );
  }

  return (
    <div className="ai-page-atmosphere min-h-screen text-white py-8 px-4">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="w-8 h-8 text-indigo-500" />
            <div>
              <h1 className="text-2xl font-bold">IQ Test</h1>
              <p className="text-sm text-zinc-400">
                Question {currentQuestionIndex + 1} of {questions.length}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-zinc-900/60 border border-zinc-800 rounded-xl px-4 py-2">
            <Clock className={`w-5 h-5 ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-indigo-500'}`} />
            <span className={`font-mono font-bold text-lg ${timeLeft <= 10 ? 'text-red-500' : ''}`}>
              {timeLeft}s
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 h-2 bg-zinc-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
            initial={{ width: 0 }}
            animate={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Question Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="max-w-4xl mx-auto"
        >
          <div className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-3xl p-8 shadow-2xl">
            {/* Difficulty Badge */}
            <div className="mb-6">
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                currentQuestion.difficulty === 'easy' ? 'bg-green-500/20 text-green-400' :
                currentQuestion.difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-red-500/20 text-red-400'
              }`}>
                {currentQuestion.difficulty.toUpperCase()}
              </span>
            </div>

            {/* Question */}
            <h2 className="text-2xl font-bold mb-8 leading-relaxed">
              {currentQuestion.question}
            </h2>

            {/* Options */}
            <div className="space-y-4 mb-6">
              {currentQuestion.options.map((option, index) => (
                <motion.button
                  key={index}
                  onClick={() => !hasSubmitted && setSelectedAnswer(index)}
                  disabled={hasSubmitted}
                  whileHover={{ scale: hasSubmitted ? 1 : 1.02 }}
                  whileTap={{ scale: hasSubmitted ? 1 : 0.98 }}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    selectedAnswer === index
                      ? 'border-indigo-500 bg-indigo-500/20'
                      : hasSubmitted
                      ? 'border-zinc-800 bg-zinc-900/40 opacity-50'
                      : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      selectedAnswer === index
                        ? 'bg-indigo-500 text-white'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      {String.fromCharCode(65 + index)}
                    </div>
                    <span className="flex-1">{option}</span>
                  </div>
                </motion.button>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              {!hasSubmitted ? (
                <button
                  onClick={handleSubmit}
                  disabled={selectedAnswer === null}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  Submit Answer
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {isLastQuestion ? 'View Results' : 'Next Question'}
                  <ArrowRight className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
