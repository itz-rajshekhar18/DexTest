"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTestStore } from '@/lib/store';
import { motion } from 'framer-motion';
import { Clock, Brain } from 'lucide-react';

interface TextQuestionRunnerProps {
  questionId: string;
  question: {
    question: string;
    options: string[];
    timeLimit: number;
  };
  questionNumber: number;
  totalQuestions: number;
  onSubmitAnswer: (selectedAnswer: number | null, reactionTime: number) => void;
}

function TextQuestionRunner({
  questionId,
  question,
  questionNumber,
  totalQuestions,
  onSubmitAnswer,
}: TextQuestionRunnerProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(question.timeLimit || 60);
  const startTimeRef = useRef(0);
  const hasSubmittedRef = useRef(false);
  const timeLeftRef = useRef(question.timeLimit || 60);

  const submitAnswer = useCallback(
    (answer: number | null) => {
      if (hasSubmittedRef.current) {
        return;
      }

      hasSubmittedRef.current = true;
      const reactionTime = Math.max(0, Date.now() - startTimeRef.current);
      onSubmitAnswer(answer, reactionTime);
    },
    [onSubmitAnswer]
  );

  useEffect(() => {
    startTimeRef.current = Date.now();
    timeLeftRef.current = question.timeLimit || 60;
    setTimeLeft(question.timeLimit || 60);
    hasSubmittedRef.current = false;
  }, []);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (hasSubmittedRef.current) {
        window.clearInterval(timer);
        return;
      }

      if (timeLeftRef.current <= 1) {
        timeLeftRef.current = 0;
        setTimeLeft(0);
        window.clearInterval(timer);
        submitAnswer(null);
        return;
      }

      timeLeftRef.current -= 1;
      setTimeLeft(timeLeftRef.current);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [submitAnswer]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-zinc-900 to-slate-950 text-white py-8 px-4">
      <div className="max-w-4xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="w-8 h-8 text-indigo-500" />
            <div>
              <h1 className="text-2xl font-bold">IQ Test</h1>
              <p className="text-sm text-zinc-400">
                Question {questionNumber} of {totalQuestions}
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

        <div className="mt-4 h-2 bg-zinc-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
            initial={{ width: 0 }}
            animate={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      <motion.div
        key={questionId}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        <div className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-3xl p-8 shadow-2xl">
          <h2 className="text-2xl font-bold mb-8 leading-relaxed">
            {question.question}
          </h2>

          <div className="space-y-4 mb-6">
            {question.options.map((option, index) => (
              <motion.button
                key={index}
                onClick={() => setSelectedAnswer(index)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                  selectedAnswer === index
                    ? 'border-indigo-500 bg-indigo-500/20'
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

          <button
            onClick={() => submitAnswer(selectedAnswer)}
            disabled={selectedAnswer === null}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
          >
            Submit Answer
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function TextBasedTest() {
  const { questions, currentQuestionIndex, addResult, nextQuestion } = useTestStore();
  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-zinc-900 to-slate-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading question...</div>
      </div>
    );
  }

  const handleSubmitAnswer = (selectedAnswer: number | null, reactionTime: number) => {
    addResult({
      questionId: currentQuestion.id,
      selectedAnswer: selectedAnswer ?? -1,
      isCorrect: selectedAnswer === currentQuestion.correctAnswer,
      reactionTime,
      timestamp: new Date(),
    });

    if (isLastQuestion) {
      window.location.href = '/test/results';
      return;
    }

    nextQuestion();
  };

  return (
    <TextQuestionRunner
      key={currentQuestion.id}
      questionId={currentQuestion.id}
      question={currentQuestion}
      questionNumber={currentQuestionIndex + 1}
      totalQuestions={questions.length}
      onSubmitAnswer={handleSubmitAnswer}
    />
  );
}
