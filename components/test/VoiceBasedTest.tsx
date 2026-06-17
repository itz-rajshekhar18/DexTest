"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTestStore } from '@/lib/store';
import { motion } from 'framer-motion';
import { Mic, MicOff, Volume2, VolumeX, Clock, Brain } from 'lucide-react';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results: {
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

interface VoiceQuestionRunnerProps {
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

function VoiceQuestionRunner({
  questionId,
  question,
  questionNumber,
  totalQuestions,
  onSubmitAnswer,
}: VoiceQuestionRunnerProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(question.timeLimit || 60);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const startTimeRef = useRef(0);
  const hasSubmittedRef = useRef(false);
  const timeLeftRef = useRef(question.timeLimit || 60);
  const selectedAnswerRef = useRef<number | null>(null);

  const stopSpeaking = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, [isListening]);

  const submitAnswer = useCallback(
    (answer: number | null) => {
      if (hasSubmittedRef.current) {
        return;
      }

      hasSubmittedRef.current = true;
      stopListening();
      stopSpeaking();

      const reactionTime = Math.max(0, Date.now() - startTimeRef.current);
      onSubmitAnswer(answer, reactionTime);
    },
    [onSubmitAnswer, stopListening, stopSpeaking]
  );

  const speakQuestion = useCallback(() => {
    if (!synthRef.current) {
      return;
    }

    synthRef.current.cancel();
    setIsSpeaking(true);

    const questionText = `Question ${questionNumber}. ${question.question}. `;
    const optionsText = question.options
      .map((option, index) => `Option ${String.fromCharCode(65 + index)}. ${option}. `)
      .join('');

    const utterance = new SpeechSynthesisUtterance(questionText + optionsText);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.onend = () => setIsSpeaking(false);

    synthRef.current.speak(utterance);
  }, [question.options, question.question, questionNumber]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      setIsListening(true);
      recognitionRef.current.start();
    }
  }, [isListening]);

  useEffect(() => {
    selectedAnswerRef.current = selectedAnswer;
  }, [selectedAnswer]);

  useEffect(() => {
    const speechRecognitionConstructor =
      (window as Window & { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition ||
      (window as Window & { SpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition;

    if (speechRecognitionConstructor) {
      const recognition = new speechRecognitionConstructor();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      recognition.onresult = (event) => {
        const nextTranscript = event.results[0][0].transcript.toLowerCase();
        setTranscript(nextTranscript);

        const answerMatch =
          nextTranscript.match(/option ([a-d]|[1-4])/i) ||
          nextTranscript.match(/\b([a-d]|[1-4])\b/i);

        if (answerMatch) {
          const answer = answerMatch[1].toLowerCase();
          const answerIndex = answer >= 'a' && answer <= 'd'
            ? answer.charCodeAt(0) - 97
            : parseInt(answer, 10) - 1;
          setSelectedAnswer(answerIndex);
        }

        setIsListening(false);
      };
      recognition.onerror = () => {
        setIsListening(false);
      };
      recognitionRef.current = recognition;
    }

    synthRef.current = window.speechSynthesis;
    startTimeRef.current = Date.now();
    timeLeftRef.current = question.timeLimit || 60;
    selectedAnswerRef.current = null;
    setSelectedAnswer(null);
    setTimeLeft(question.timeLimit || 60);
    setTranscript('');
    hasSubmittedRef.current = false;
    speakQuestion();

    return () => {
      recognitionRef.current?.stop();
      synthRef.current?.cancel();
    };
  }, [speakQuestion]);

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
        submitAnswer(selectedAnswerRef.current);
        return;
      }

      timeLeftRef.current -= 1;
      setTimeLeft(timeLeftRef.current);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [submitAnswer]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-zinc-900 to-slate-950 text-white py-8 px-4">
      <div className="max-w-4xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="w-8 h-8 text-purple-500" />
            <div>
              <h1 className="text-2xl font-bold">Voice IQ Test</h1>
              <p className="text-sm text-zinc-400">
                Question {questionNumber} of {totalQuestions}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-zinc-900/60 border border-zinc-800 rounded-xl px-4 py-2">
            <Clock className={`w-5 h-5 ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-purple-500'}`} />
            <span className={`font-mono font-bold text-lg ${timeLeft <= 10 ? 'text-red-500' : ''}`}>
              {timeLeft}s
            </span>
          </div>
        </div>

        <div className="mt-4 h-2 bg-zinc-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
            initial={{ width: 0 }}
            animate={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      <div className="max-w-4xl mx-auto mb-6 flex gap-4 justify-center">
        <button
          onClick={isSpeaking ? stopSpeaking : speakQuestion}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
            isSpeaking ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-600 hover:bg-purple-700'
          }`}
        >
          {isSpeaking ? (
            <>
              <VolumeX className="w-5 h-5" />
              Stop Speaking
            </>
          ) : (
            <>
              <Volume2 className="w-5 h-5" />
              Repeat Question
            </>
          )}
        </button>

        <button
          onClick={isListening ? stopListening : startListening}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
            isListening ? 'bg-red-600 hover:bg-red-700 animate-pulse' : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {isListening ? (
            <>
              <MicOff className="w-5 h-5" />
              Stop Listening
            </>
          ) : (
            <>
              <Mic className="w-5 h-5" />
              Answer by Voice
            </>
          )}
        </button>
      </div>

      {transcript && (
        <div className="max-w-4xl mx-auto mb-6">
          <div className="bg-purple-950/30 border border-purple-900/50 rounded-xl p-4">
            <p className="text-sm text-purple-400 mb-1">You said:</p>
            <p className="text-white font-medium">{transcript}</p>
          </div>
        </div>
      )}

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
                    ? 'border-purple-500 bg-purple-500/20'
                    : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                    selectedAnswer === index ? 'bg-purple-500 text-white' : 'bg-zinc-800 text-zinc-400'
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
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
          >
            Submit Answer
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function VoiceBasedTest() {
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
    <VoiceQuestionRunner
      key={currentQuestion.id}
      questionId={currentQuestion.id}
      question={currentQuestion}
      questionNumber={currentQuestionIndex + 1}
      totalQuestions={questions.length}
      onSubmitAnswer={handleSubmitAnswer}
    />
  );
}
