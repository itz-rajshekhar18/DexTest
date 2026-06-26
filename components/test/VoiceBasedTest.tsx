"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isTestCompleted, useTestStore } from '@/lib/store';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Volume2, VolumeX, Clock, Brain, ArrowRight, ArrowLeft, AudioLines } from 'lucide-react';
import { voiceIQAgent } from '@/lib/aiAgents';
import { getCachedAudio, putCachedAudio } from '@/lib/audioCache';
import { playStreamingMp3 } from '@/lib/streamingAudio';

type AsrWord = {
  text: string;
  start?: number;
  end?: number;
  type?: string;
  speaker_id?: string;
};

type AsrTranscript = {
  text?: string;
  language?: string;
  model?: string;
};

function normalizeSpokenText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAnswerIndex(text: string, options: string[] = []) {
  const normalized = normalizeSpokenText(text);
  const optionMatch =
    normalized.match(/\b(?:option|answer|choose|chose|select|selected|pick|picked|my answer is|it is)\s+(?:number\s+)?([a-d1-4]|one|two|three|four|first|second|third|fourth|ay|bee|be|sea|see|cee|dee|d)\b/i) ||
    normalized.match(/^(a|b|c|d|ay|bee|be|sea|see|cee|dee)$/i) ||
    normalized.match(/\b([1-4]|one|two|three|four|first|second|third|fourth)\b/i);

  if (optionMatch) {
    const answer = optionMatch[1].toLowerCase();
    const spokenMap: Record<string, number> = {
      a: 0,
      ay: 0,
      one: 0,
      first: 0,
      "1": 0,
      b: 1,
      bee: 1,
      be: 1,
      two: 1,
      second: 1,
      "2": 1,
      c: 2,
      cee: 2,
      sea: 2,
      see: 2,
      three: 2,
      third: 2,
      "3": 2,
      d: 3,
      dee: 3,
      four: 3,
      fourth: 3,
      "4": 3,
    };

    if (answer in spokenMap) return spokenMap[answer];
  }

  const exactOptionMatch = options.findIndex((option) => {
    const normalizedOption = normalizeSpokenText(option);
    return normalizedOption.length > 0 && normalized.includes(normalizedOption);
  });

  if (exactOptionMatch >= 0) return exactOptionMatch;

  return null;
}

function fileNameForMime(mimeType: string) {
  if (mimeType.includes('ogg')) return 'student-answer.ogg';
  if (mimeType.includes('webm')) return 'student-answer.webm';
  if (mimeType.includes('mp4')) return 'student-answer.mp4';
  if (mimeType.includes('mpeg')) return 'student-answer.mp3';
  if (mimeType.includes('wav')) return 'student-answer.wav';
  return 'student-answer.webm';
}

export default function VoiceBasedTest() {
  const router = useRouter();
  const { questions, currentQuestionIndex, addResult, nextQuestion, goToQuestion } = useTestStore();
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [transcript, setTranscript] = useState('');
  const [segments, setSegments] = useState<AsrWord[]>([]);
  const [voiceStatus, setVoiceStatus] = useState('Preparing question audio...');
  const startTimeRef = useRef(0);
  // Guards a single navigation per question so a manual click and the timeout
  // auto-advance can't both fire and skip a question. Reset on question change.
  const navLockRef = useRef(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsUrlRef = useRef<string | null>(null);
  const recordingTimeoutRef = useRef<number | null>(null);
  const currentOptionsRef = useRef<string[]>([]);
  // Increments on every speak request; an in-flight (async) request whose token
  // no longer matches must not start playing, preventing overlapping audio.
  const playbackTokenRef = useRef(0);

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  useEffect(() => {
    currentOptionsRef.current = currentQuestion?.options || [];
  }, [currentQuestion?.options]);

  useEffect(() => {
    if (isTestCompleted('voice')) {
      router.replace('/test');
    }
  }, [router]);

  useEffect(() => {
    if (!isTestCompleted('voice') && questions.length === 0) {
      router.replace('/test');
    }
  }, [questions.length, router]);

  useEffect(() => {
    // Initialize Speech Synthesis (for the AI reading the question aloud)
    synthRef.current = window.speechSynthesis;

    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (ttsUrlRef.current) {
        URL.revokeObjectURL(ttsUrlRef.current);
      }
      if (recordingTimeoutRef.current) {
        window.clearTimeout(recordingTimeoutRef.current);
      }
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const speakQuestion = useCallback(async () => {
    if (!currentQuestion) return;

    // Invalidate any earlier in-flight request and stop whatever is playing now.
    const token = ++playbackTokenRef.current;
    const isStale = () => token !== playbackTokenRef.current;

    synthRef.current?.cancel();
    audioRef.current?.pause();
    setIsSpeaking(true);
    setVoiceStatus('Preparing question audio...');

    const cacheKey = `tts-q-${currentQuestion.id}`;

    const playBlob = (blob: Blob) => {
      if (isStale()) return;
      if (ttsUrlRef.current) URL.revokeObjectURL(ttsUrlRef.current);
      ttsUrlRef.current = URL.createObjectURL(blob);
      const audio = new Audio(ttsUrlRef.current);
      audioRef.current = audio;
      audio.onended = () => {
        setIsSpeaking(false);
        setVoiceStatus('Hold the button and say your answer.');
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        setVoiceStatus('Audio playback failed. Tap Repeat Question to try again.');
      };
      void audio.play();
    };

    // 1) Reuse previously generated audio for this question (persists across reloads).
    const cached = await getCachedAudio(cacheKey);
    if (isStale()) return;
    if (cached) {
      setVoiceStatus('Reading the question aloud...');
      playBlob(cached);
      return;
    }

    const spokenPrompt = await voiceIQAgent.createSpokenPrompt(
      currentQuestion,
      currentQuestionIndex + 1
    );
    if (isStale()) return;

    // 2) Generate once, streaming playback in, then store the finished clip.
    try {
      const response = await fetch('/api/elevenlabs/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: spokenPrompt }),
      });

      if (!response.ok) {
        throw new Error('Voice synthesis unavailable');
      }

      if (isStale()) {
        // A newer question started; cache the audio but don't play it.
        const blob = await response.blob();
        void putCachedAudio(cacheKey, blob);
        return;
      }

      setVoiceStatus('Reading the question aloud...');

      if (ttsUrlRef.current) URL.revokeObjectURL(ttsUrlRef.current);
      const audio = new Audio();
      audioRef.current = audio;
      audio.onended = () => {
        setIsSpeaking(false);
        setVoiceStatus('Hold the button and say your answer.');
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        setVoiceStatus('Audio playback failed. Tap Repeat Question to try again.');
      };
      ttsUrlRef.current = null; // managed via audio.src by the streaming helper

      const blob = await playStreamingMp3(response, audio);
      ttsUrlRef.current = audio.src.startsWith('blob:') ? audio.src : null;
      void putCachedAudio(cacheKey, blob);
    } catch (error) {
      console.warn('Falling back to browser speech synthesis:', error);

      if (isStale()) return;
      if (!synthRef.current) {
        setIsSpeaking(false);
        setVoiceStatus('Audio unavailable. Please read the question on screen.');
        return;
      }

      const utterance = new SpeechSynthesisUtterance(spokenPrompt);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;

      utterance.onend = () => {
        setIsSpeaking(false);
        setVoiceStatus('Hold the button and say your answer.');
      };

      synthRef.current.speak(utterance);
    }
  }, [currentQuestion, currentQuestionIndex]);

  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setIsSpeaking(false);
    setVoiceStatus('Audio stopped.');
  };

  const transcribeAnswer = async (audioBlob: Blob, fileName: string) => {
    setVoiceStatus('🔄 Transcribing your answer...');

    try {
      const formData = new FormData();
      formData.append('file', audioBlob, fileName);

      const response = await fetch('/api/asr', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.warn('ASR failed:', response.status, errorData);
        throw new Error(`ASR failed with status ${response.status}`);
      }

      const payload = (await response.json()) as AsrTranscript;
      const text = payload.text?.trim() || '';

      if (!text) {
        setVoiceStatus('❌ No speech detected. Hold the button and speak clearly.');
        return;
      }

      const answerIndex = parseAnswerIndex(text, currentOptionsRef.current);

      setTranscript(text);
      setSegments(
        text
          .split(/\s+/)
          .filter(Boolean)
          .map((word) => ({ text: word, type: 'word', speaker_id: 'student' }))
      );
      setSelectedAnswer(answerIndex);

      if (answerIndex === null) {
        setVoiceStatus('✅ Heard: "' + text + '" — but no A/B/C/D option detected. Try saying just the letter.');
      } else {
        setVoiceStatus(`✅ Detected option ${String.fromCharCode(65 + answerIndex)} from your voice!`);
      }
    } catch (error) {
      console.warn('ASR unavailable:', error);
      setVoiceStatus('🎤 Transcription failed. Please try again or click your answer.');
    }
  };

  const startRecording = async () => {
    if (isListening) return;

    stopSpeaking();
    setTranscript('');
    setSegments([]);
    setSelectedAnswer(null);

    if (!navigator.mediaDevices || typeof MediaRecorder === 'undefined') {
      setVoiceStatus('Voice recording not supported in this browser. Please click your answer manually.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];

      const supportedMimeType =
        [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/ogg;codecs=opus',
          'audio/ogg',
          'audio/mp4',
          'audio/mpeg',
          'audio/wav',
        ].find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || '';

      const recorder = new MediaRecorder(
        stream,
        supportedMimeType
          ? { mimeType: supportedMimeType, audioBitsPerSecond: 128000 }
          : undefined
      );

      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        if (recordingTimeoutRef.current) {
          window.clearTimeout(recordingTimeoutRef.current);
          recordingTimeoutRef.current = null;
        }
        setIsListening(false);
        stream.getTracks().forEach((track) => track.stop());

        const mimeType = recorder.mimeType || supportedMimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

        if (audioBlob.size < 1000) {
          setVoiceStatus('Recording too short. Hold the button while you say your answer.');
          return;
        }

        void transcribeAnswer(audioBlob, fileNameForMime(mimeType));
      };

      setVoiceStatus('🎤 Listening... keep holding and say option A, B, C, or D.');
      setIsListening(true);
      recorder.start(100); // capture in small chunks for quality

      // Safety stop so a stuck "press" can't record forever.
      recordingTimeoutRef.current = window.setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          setVoiceStatus('⏳ Processing your answer...');
          mediaRecorderRef.current.stop();
        }
      }, 15000);
    } catch (error) {
      console.warn('Microphone access failed:', error);
      setVoiceStatus('❌ Microphone access denied. Please click your answer manually.');
      setIsListening(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      setVoiceStatus('⏳ Processing your answer...');
      mediaRecorderRef.current.stop();
    }
  };

  // Hold the Space bar to talk (mirrors the "Hold to Talk" button).
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      event.preventDefault();
      if (!isListening) void startRecording();
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      event.preventDefault();
      if (isListening) stopRecording();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening]);

  // Save the current selection (upsert) so it survives navigating away/back.
  const persistCurrentAnswer = useCallback(() => {
    if (selectedAnswer === null || !currentQuestion) return;
    addResult({
      questionId: currentQuestion.id,
      selectedAnswer,
      isCorrect: selectedAnswer === currentQuestion.correctAnswer,
      reactionTime: Date.now() - startTimeRef.current,
      timestamp: new Date(),
    });
  }, [addResult, currentQuestion, selectedAnswer]);

  // Move to another question, saving the current answer first. The nav lock
  // ensures only one transition happens per question.
  const goToIndex = useCallback(
    (target: number) => {
      if (navLockRef.current) return;
      if (target < 0 || target >= questions.length) return;
      navLockRef.current = true;
      persistCurrentAnswer();
      stopSpeaking();
      goToQuestion(target);
    },
    [goToQuestion, persistCurrentAnswer, questions.length]
  );

  // Submit the current answer and go straight to the next question (or results).
  const handleSubmitNext = useCallback(() => {
    if (navLockRef.current) return;
    navLockRef.current = true;
    persistCurrentAnswer();
    stopSpeaking();
    if (isLastQuestion) {
      router.push('/test/results');
    } else {
      nextQuestion();
    }
  }, [isLastQuestion, nextQuestion, persistCurrentAnswer, router]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      navLockRef.current = false;
      setTimeLeft(currentQuestion?.timeLimit || 60);
      startTimeRef.current = Date.now();
      // Restore any previously chosen answer for this question (back/forth nav).
      const existing = useTestStore
        .getState()
        .results.find((result) => result.questionId === currentQuestion?.id);
      setSelectedAnswer(
        existing && existing.selectedAnswer >= 0 ? existing.selectedAnswer : null
      );
      setTranscript('');
      setSegments([]);
      setVoiceStatus('Preparing question audio...');
      speakQuestion();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [currentQuestionIndex, currentQuestion, speakQuestion]);

  useEffect(() => {
    if (timeLeft <= 0) {
      // Time's up: auto-advance (recording the current selection if any).
      const submitTimer = window.setTimeout(() => handleSubmitNext(), 0);
      return () => window.clearTimeout(submitTimer);
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [handleSubmitNext, timeLeft]);

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
            <Brain className="w-8 h-8 text-purple-500" />
            <div>
              <h1 className="text-2xl font-bold">Voice IQ Test</h1>
              <p className="text-sm text-zinc-400">
                Question {currentQuestionIndex + 1} of {questions.length}
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

        {/* Progress Bar */}
        <div className="mt-4 h-2 bg-zinc-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
            initial={{ width: 0 }}
            animate={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Voice Controls */}
      <div className="max-w-4xl mx-auto mb-6">
        <div className="mb-4 rounded-2xl border border-purple-400/20 bg-purple-400/10 px-4 py-3 text-sm text-purple-100">
          <div className="flex items-center gap-2">
            <AudioLines className="h-4 w-4" />
            {voiceStatus}
          </div>
        </div>

        {/* Helpful Instructions */}
        <div className="mb-4 rounded-xl border border-blue-400/20 bg-blue-400/10 px-3 py-2 text-xs text-blue-100">
          <strong>💡 Tip:</strong> Press and hold &quot;Hold to Talk&quot; (or hold the <kbd>Space</kbd> bar),
          say &quot;Option A&quot;, &quot;Option B&quot;, &quot;Option C&quot;, or &quot;Option D&quot;, then release.
          You can also click your answer manually below.
        </div>

        <div className="flex flex-wrap gap-4 justify-center">
        <button
          onClick={isSpeaking ? stopSpeaking : speakQuestion}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
            isSpeaking
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-purple-600 hover:bg-purple-700'
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
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onMouseLeave={() => {
            if (isListening) stopRecording();
          }}
          onTouchStart={(event) => {
            event.preventDefault();
            void startRecording();
          }}
          onTouchEnd={(event) => {
            event.preventDefault();
            stopRecording();
          }}
          onContextMenu={(event) => event.preventDefault()}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all select-none touch-none ${
            isListening
              ? 'bg-red-600 hover:bg-red-700 animate-pulse'
              : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          <Mic className="w-5 h-5" />
          {isListening ? 'Listening… release to submit' : 'Hold to Talk'}
        </button>
        </div>
      </div>

      {/* Transcript Display */}
      {transcript && (
        <div className="max-w-4xl mx-auto mb-6">
          <div className="bg-purple-950/30 border border-purple-900/50 rounded-xl p-4">
            <p className="text-sm text-purple-400 mb-1">You said:</p>
            <p className="text-white font-medium">{transcript}</p>
            {segments.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {segments.slice(0, 18).map((segment, index) => (
                  <span
                    key={`${segment.text}-${index}`}
                    className="rounded-full border border-purple-300/20 bg-purple-300/10 px-3 py-1 text-xs text-purple-100"
                  >
                    {segment.text}
                    {typeof segment.start === 'number' && typeof segment.end === 'number'
                      ? ` ${segment.start.toFixed(1)}-${segment.end.toFixed(1)}s`
                      : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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
            {/* Question */}
            <h2 className="text-2xl font-bold mb-8 leading-relaxed">
              {currentQuestion.question}
            </h2>

            {/* Options */}
            <div className="space-y-4 mb-6">
              {currentQuestion.options.map((option, index) => (
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

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={() => goToIndex(currentQuestionIndex - 1)}
                disabled={currentQuestionIndex === 0}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                Previous
              </button>

              <button
                onClick={handleSubmitNext}
                disabled={selectedAnswer === null}
                className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {isLastQuestion ? 'Submit & View Results' : 'Submit & Next'}
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
