"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isTestCompleted, useTestStore } from '@/lib/store';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume2, VolumeX, Clock, Brain, ArrowRight, AudioLines } from 'lucide-react';
import { voiceIQAgent } from '@/lib/aiAgents';

type SpeechRecognitionResultEventLike = {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event?: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type ElevenLabsWord = {
  text: string;
  start?: number;
  end?: number;
  type?: string;
  speaker_id?: string;
};

type ElevenLabsTranscript = {
  text?: string;
  words?: ElevenLabsWord[];
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

export default function VoiceBasedTest() {
  const router = useRouter();
  const { questions, currentQuestionIndex, addResult, nextQuestion } = useTestStore();
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [transcript, setTranscript] = useState('');
  const [segments, setSegments] = useState<ElevenLabsWord[]>([]);
  const [voiceStatus, setVoiceStatus] = useState('AI voice ready');
  const [showExplanation, setShowExplanation] = useState(false);
  const startTimeRef = useRef(0);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsUrlRef = useRef<string | null>(null);
  const recordingTimeoutRef = useRef<number | null>(null);
  const browserTranscriptRef = useRef('');
  const currentOptionsRef = useRef<string[]>([]);

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
    // Initialize Speech Recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const browserWindow = window as Window & {
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
        SpeechRecognition?: SpeechRecognitionConstructor;
      };
      const SpeechRecognition =
        browserWindow.webkitSpeechRecognition || browserWindow.SpeechRecognition;

      if (!SpeechRecognition) return;

      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript?.toLowerCase() || '';
        if (!transcript) return;
        setTranscript(transcript);
        browserTranscriptRef.current = transcript;
        const answerIndex = parseAnswerIndex(transcript, currentOptionsRef.current);
        setSelectedAnswer(answerIndex);
        setSegments(
          transcript.split(/\s+/).filter(Boolean).map((word, index) => ({
            text: word,
            start: index * 0.35,
            end: index * 0.35 + 0.3,
            type: 'word',
            speaker_id: 'student',
          }))
        );
        setVoiceStatus(
          answerIndex === null
            ? 'Browser STT heard speech, but no answer option was detected.'
            : `Detected option ${String.fromCharCode(65 + answerIndex)} from voice.`
        );

        setIsListening(false);
      };

      recognitionRef.current.onerror = (event) => {
        const error = event?.error || 'unknown';
        let message = '';
        
        switch (error) {
          case 'network':
            message = 'Network error - speech recognition needs internet. Click "Answer by Voice" to use microphone recording instead.';
            break;
          case 'not-allowed':
          case 'permission-denied':
            message = 'Microphone permission denied. Please allow microphone access in your browser settings.';
            break;
          case 'no-speech':
            message = 'No speech detected. Click "Answer by Voice" to try again.';
            break;
          case 'aborted':
            message = 'Speech recognition stopped. Click "Answer by Voice" to try again.';
            break;
          case 'audio-capture':
            message = 'No microphone found. Please connect a microphone and try again.';
            break;
          case 'service-not-allowed':
            message = 'Speech recognition service not available. Using audio recording fallback.';
            break;
          default:
            message = `Speech recognition error (${error}). Click "Answer by Voice" to use audio recording.`;
        }
        
        setVoiceStatus(message);
        setIsListening(false);
        
        // If browser speech fails due to network, we'll use MediaRecorder + ElevenLabs STT instead
        if (error === 'network' || error === 'service-not-allowed') {
          console.log('Browser speech recognition unavailable, will use MediaRecorder + ElevenLabs STT on next attempt');
        }
      };

      recognitionRef.current.onend = () => {
        if (mediaRecorderRef.current?.state !== 'recording') {
          setIsListening(false);
        }
      };
    }

    // Initialize Speech Synthesis
    synthRef.current = window.speechSynthesis;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
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
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const speakQuestion = useCallback(async () => {
    if (!currentQuestion) return;

    synthRef.current?.cancel();
    audioRef.current?.pause();
    setIsSpeaking(true);
    setVoiceStatus('Generating ElevenLabs AI voice...');

    const spokenPrompt = await voiceIQAgent.createSpokenPrompt(
      currentQuestion,
      currentQuestionIndex + 1
    );

    try {
      const response = await fetch('/api/elevenlabs/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: spokenPrompt }),
      });

      if (!response.ok) {
        throw new Error('ElevenLabs TTS unavailable');
      }

      const audioBlob = await response.blob();
      if (ttsUrlRef.current) URL.revokeObjectURL(ttsUrlRef.current);
      ttsUrlRef.current = URL.createObjectURL(audioBlob);

      const audio = new Audio(ttsUrlRef.current);
      audioRef.current = audio;
      audio.onended = () => {
        setIsSpeaking(false);
        setVoiceStatus('AI finished. Student can answer by voice.');
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        setVoiceStatus('AI voice playback failed. Use repeat to try again.');
      };
      await audio.play();
    } catch (error) {
      console.warn('Falling back to browser speech synthesis:', error);

      if (!synthRef.current) {
        setIsSpeaking(false);
        setVoiceStatus('TTS unavailable. Read the question on screen.');
        return;
      }

      const utterance = new SpeechSynthesisUtterance(spokenPrompt);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;

      utterance.onend = () => {
        setIsSpeaking(false);
        setVoiceStatus('AI finished. Student can answer by voice.');
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
    setVoiceStatus('AI voice stopped.');
  };

  const startBrowserSpeechFallback = () => {
    if (recognitionRef.current && !isListening) {
      browserTranscriptRef.current = '';
      setVoiceStatus('Listening with browser speech recognition...');
      setIsListening(true);
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.warn('Speech recognition start failed:', error);
        setVoiceStatus('Voice recognition already active or unavailable. Speak now, then try again if needed.');
      }
      return true;
    }

    setVoiceStatus('Voice recognition not available. Click "Answer by Voice" to record audio instead.');
    return false;
  };

  const transcribeWithElevenLabs = async (audioBlob: Blob) => {
    setVoiceStatus('🔄 Transcribing your answer...');

    // First, check if we have browser transcription from parallel processing
    const browserText = browserTranscriptRef.current?.trim();
    
    // Try ElevenLabs STT with proper audio format
    try {
      // Convert audio to supported format if needed
      let audioFile = audioBlob;
      let fileName = 'student-answer.webm';
      
      // Check if we need to convert the format
      const mimeType = audioBlob.type;
      console.log('Original audio format:', mimeType, 'Size:', audioBlob.size);
      
      // ElevenLabs accepts: mp3, mp4, mpeg, mpga, m4a, wav, webm
      if (audioBlob.size < 1000) {
        console.warn('Audio file too small, likely empty recording');
        throw new Error('Audio recording too short or empty');
      }

      const formData = new FormData();
      formData.append('file', audioFile, fileName);

      const response = await fetch('/api/elevenlabs/stt', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.warn('ElevenLabs STT failed:', response.status, errorData);
        throw new Error(`ElevenLabs STT failed with status ${response.status}`);
      }

      const payload = (await response.json()) as ElevenLabsTranscript;
      const aiText = payload.text?.trim() || '';
      
      // Prefer AI transcription, fallback to browser
      const text = aiText || browserText;
      
      if (!text) {
        setVoiceStatus('❌ No speech detected. Please speak louder and try again.');
        return;
      }

      const answerIndex = parseAnswerIndex(text, currentOptionsRef.current);

      setTranscript(text);
      setSegments(payload.words || []);
      setSelectedAnswer(answerIndex);
      
      if (answerIndex === null) {
        setVoiceStatus('✅ Heard: "' + text + '" - but no A/B/C/D option detected. Try saying just the letter.');
      } else {
        setVoiceStatus(`✅ Detected option ${String.fromCharCode(65 + answerIndex)} from your voice!`);
      }
    } catch (error) {
      console.warn('ElevenLabs STT unavailable, using browser transcription:', error);
      
      // If we have browser transcription from parallel processing, use it
      if (browserText) {
        const browserAnswer = parseAnswerIndex(browserText, currentOptionsRef.current);
        setTranscript(browserText);
        setSelectedAnswer(browserAnswer);
        
        if (browserAnswer === null) {
          setVoiceStatus('📝 Heard: "' + browserText + '" - but no option detected. Click your answer or say the letter clearly.');
        } else {
          setVoiceStatus(`✅ Detected option ${String.fromCharCode(65 + browserAnswer)} from browser voice!`);
        }
        return;
      }
      
      // If no browser transcription, inform user
      setVoiceStatus('🎤 AI transcription unavailable. Using browser speech recognition. Please say your answer again or click your choice.');
    }
  };

  const startListening = async () => {
    if (isListening || showExplanation) return;

    stopSpeaking();
    setTranscript('');
    setSegments([]);
    setSelectedAnswer(null);
    browserTranscriptRef.current = '';

    // For this use case (detecting A/B/C/D), browser speech recognition is actually more reliable
    // than recording + transcription with external API
    if (recognitionRef.current) {
      // Primary method: Use browser speech recognition directly
      browserTranscriptRef.current = '';
      setVoiceStatus('🎤 Listening... Say option A, B, C, or D clearly.');
      setIsListening(true);
      
      try {
        recognitionRef.current.start();
        
        // Auto-stop after 5 seconds
        recordingTimeoutRef.current = window.setTimeout(() => {
          if (recognitionRef.current && isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
            
            const text = browserTranscriptRef.current?.trim();
            if (text) {
              const answerIndex = parseAnswerIndex(text, currentOptionsRef.current);
              if (answerIndex !== null) {
                setVoiceStatus(`✅ Detected option ${String.fromCharCode(65 + answerIndex)}!`);
              } else {
                setVoiceStatus('Heard: "' + text + '" - but no option detected. Try again or click your answer.');
              }
            } else {
              setVoiceStatus('No speech detected. Please speak louder and try again.');
            }
          }
        }, 5000);
        
        return;
      } catch (error) {
        console.warn('Browser speech recognition failed:', error);
        setVoiceStatus('Speech recognition failed. Please click your answer manually.');
        setIsListening(false);
        return;
      }
    }

    // Fallback: If browser speech recognition is not available, use MediaRecorder
    if (!navigator.mediaDevices || typeof MediaRecorder === 'undefined') {
      setVoiceStatus('Voice recognition not available in this browser. Please click your answer manually.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];

      // Prefer formats that ElevenLabs supports well: mp3, mp4, mpeg, mpga, m4a, wav, webm
      const supportedMimeType = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/mpeg',
        'audio/wav',
      ].find((mimeType) => MediaRecorder.isTypeSupported(mimeType));

      if (!supportedMimeType) {
        console.warn('No supported audio MIME type found');
        throw new Error('Browser does not support audio recording in a compatible format');
      }

      console.log('Using audio format:', supportedMimeType);

      const recorder = new MediaRecorder(stream, { 
        mimeType: supportedMimeType,
        audioBitsPerSecond: 128000 // Higher quality for better transcription
      });

      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log('Audio chunk received:', event.data.size, 'bytes');
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
        
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || supportedMimeType,
        });
        
        console.log('Recording stopped. Total size:', audioBlob.size, 'bytes, Type:', audioBlob.type);
        
        if (audioBlob.size === 0) {
          setVoiceStatus('No voice audio captured. Please allow microphone access and speak clearly.');
          return;
        }
        
        if (audioBlob.size < 1000) {
          setVoiceStatus('Recording too short. Please speak for at least 1 second.');
          return;
        }
        
        void transcribeWithElevenLabs(audioBlob);
      };

      setVoiceStatus('🎤 Recording for 5 seconds... Say option A, B, C, or D clearly.');
      setIsListening(true);
      recorder.start(100); // Capture in smaller chunks for better quality

      recordingTimeoutRef.current = window.setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          setVoiceStatus('⏳ Processing your answer...');
          mediaRecorderRef.current.stop();
        }
      }, 5000);
    } catch (error) {
      console.warn('Microphone access failed:', error);
      setVoiceStatus('❌ Microphone access denied. Please click your answer manually.');
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recordingTimeoutRef.current) {
      window.clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }

    if (mediaRecorderRef.current?.state === 'recording') {
      setVoiceStatus('Processing recorded answer...');
      mediaRecorderRef.current.stop();
      recognitionRef.current?.stop();
      return;
    }

    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const handleSubmit = useCallback(() => {
    if (selectedAnswer === null || !currentQuestion || showExplanation) return;

    const reactionTime = Date.now() - startTimeRef.current;
    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;

    addResult({
      questionId: currentQuestion.id,
      selectedAnswer,
      isCorrect,
      reactionTime,
      timestamp: new Date(),
    });

    setShowExplanation(true);

    const resultText = isCorrect
      ? 'Correct! ' + currentQuestion.explanation
      : 'Incorrect. The correct answer is option ' +
        String.fromCharCode(65 + currentQuestion.correctAnswer) +
        '. ' +
        currentQuestion.explanation;

    void (async () => {
      try {
        const response = await fetch('/api/elevenlabs/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: resultText }),
        });

        if (!response.ok) throw new Error('ElevenLabs feedback TTS unavailable');

        const audioBlob = await response.blob();
        if (ttsUrlRef.current) URL.revokeObjectURL(ttsUrlRef.current);
        ttsUrlRef.current = URL.createObjectURL(audioBlob);
        const audio = new Audio(ttsUrlRef.current);
        audioRef.current = audio;
        await audio.play();
      } catch {
        if (synthRef.current) {
          const utterance = new SpeechSynthesisUtterance(resultText);
          utterance.rate = 0.9;
          synthRef.current.speak(utterance);
        }
      }
    })();
  }, [addResult, currentQuestion, selectedAnswer, showExplanation]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTimeLeft(currentQuestion?.timeLimit || 60);
      startTimeRef.current = Date.now();
      setSelectedAnswer(null);
      setShowExplanation(false);
      setTranscript('');
      setSegments([]);
      setVoiceStatus('AI voice ready');
      speakQuestion();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [currentQuestionIndex, currentQuestion, speakQuestion]);

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
    stopSpeaking();
    if (isLastQuestion) {
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
        {!showExplanation && (
          <div className="mb-4 rounded-xl border border-blue-400/20 bg-blue-400/10 px-3 py-2 text-xs text-blue-100">
            <strong>💡 Tip:</strong> Say "Option A", "Option B", "Option C", or "Option D" clearly. 
            You can also click your answer manually below.
          </div>
        )}
        
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
          onClick={isListening ? stopListening : startListening}
          disabled={showExplanation}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
            isListening
              ? 'bg-red-600 hover:bg-red-700 animate-pulse'
              : 'bg-green-600 hover:bg-green-700'
          } disabled:bg-zinc-800 disabled:cursor-not-allowed`}
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
                  onClick={() => !showExplanation && setSelectedAnswer(index)}
                  disabled={showExplanation}
                  whileHover={{ scale: showExplanation ? 1 : 1.02 }}
                  whileTap={{ scale: showExplanation ? 1 : 0.98 }}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    showExplanation && index === currentQuestion.correctAnswer
                      ? 'border-green-500 bg-green-500/20'
                      : showExplanation && index === selectedAnswer
                      ? 'border-red-500 bg-red-500/20'
                      : selectedAnswer === index
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
              {!showExplanation ? (
                <button
                  onClick={handleSubmit}
                  disabled={selectedAnswer === null}
                  className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
                >
                  Submit Answer
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
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
