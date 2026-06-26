import { create } from 'zustand';

export type TestType = 'text' | 'voice' | 'game';

export interface StudentProfile {
  studentCode: string;
  studentClass: number;
  studentName: string;
  studentAge: number;
  studentGender: string;
}

export interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  difficulty: 'easy' | 'medium' | 'hard';
  explanation: string;
  timeLimit: number;
}

export interface TestResult {
  questionId: string;
  selectedAnswer: number;
  isCorrect: boolean;
  reactionTime: number;
  timestamp: Date;
}

export interface TestSession {
  sessionId: string;
  testType: TestType;
  timestamp: Date;
  studentCode?: string;
  studentName?: string;
  studentClass?: number;
  studentAge?: number;
  studentGender?: string;
  questions: Question[];
  results: TestResult[];
  accuracy?: number;
  averageReactionTime?: number;
  attentionScore?: number;
  gameScores?: {
    templeRun?: { score: number; reactionTime: number };
    memoryGame?: { score: number; reactionTime: number };
    reflexGame?: { score: number; reactionTime: number };
  };
}

export interface PreviousAttemptResults {
  score?: number;
  iqScore?: number;
  correctAnswers?: number;
  totalQuestions?: number;
  avgReactionTime?: number;
  gameScores?: TestSession['gameScores'];
  attentionScore?: number;
  analysis?: string;
  scholarship?: {
    textScore?: number;
    voiceScore?: number;
    gameScore?: number;
    totalPercentage?: number;
    eligible?: boolean;
  };
}

export interface PreviousAttemptSnapshot {
  hasAttempted: boolean;
  studentCode: string;
  studentName?: string;
  studentClass?: number;
  lastTestDate?: string;
  lastTestResults?: PreviousAttemptResults;
}

const TEST_SESSIONS_KEY = 'testSessions';
const COMPLETED_TESTS_KEY = 'completedTests';
const STUDENT_PROFILE_KEY = 'studentProfile';
const TEST_PROGRESS_CACHE_KEY = 'testProgressCache';
const PREVIOUS_ATTEMPT_KEY = 'previousAttemptSnapshot';

const canUseSessionStorage = () =>
  typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';

type GameScoreMap = NonNullable<TestSession['gameScores']>;

export interface TestProgressCache {
  testType: TestType | null;
  accuracy: number;
  averageReactionTime: number;
  attentionScore: number;
  updatedAt: string;
}

type MetricsSource = {
  results?: TestResult[];
  gameScores?: TestSession['gameScores'];
  accuracy?: number;
  averageReactionTime?: number;
  attentionScore?: number;
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const getQuestionMetrics = (results: TestResult[] = []) => {
  if (results.length === 0) {
    return { accuracy: 0, averageReactionTime: 0, totalCorrect: 0, totalItems: 0 };
  }

  const totalCorrect = results.filter((result) => result.isCorrect).length;
  const totalReactionTime = results.reduce((sum, result) => sum + result.reactionTime, 0);

  return {
    accuracy: clampPercent((totalCorrect / results.length) * 100),
    averageReactionTime: Math.round(totalReactionTime / results.length),
    totalCorrect,
    totalItems: results.length,
  };
};

const getGameMetrics = (gameScores?: TestSession['gameScores']) => {
  const entries = Object.values(gameScores || {}).filter(
    (score): score is NonNullable<GameScoreMap[keyof GameScoreMap]> => Boolean(score)
  );

  if (entries.length === 0) {
    return { accuracy: 0, averageReactionTime: 0, totalCorrect: 0, totalItems: 0 };
  }

  const totalScore = entries.reduce((sum, score) => sum + score.score, 0);
  const totalReactionTime = entries.reduce((sum, score) => sum + score.reactionTime, 0);

  return {
    accuracy: clampPercent(totalScore),
    averageReactionTime: Math.round(totalReactionTime / entries.length),
    totalCorrect: totalScore,
    totalItems: entries.length,
  };
};

const normalizeGameScores = (gameScores: TestState['gameScores']): TestSession['gameScores'] => ({
  ...(gameScores.templeRun ? { templeRun: gameScores.templeRun } : {}),
  ...(gameScores.memoryGame ? { memoryGame: gameScores.memoryGame } : {}),
  ...(gameScores.reflexGame ? { reflexGame: gameScores.reflexGame } : {}),
});

export const getSessionMetrics = (source?: MetricsSource) => {
  if (!source) {
    return { accuracy: 0, averageReactionTime: 0, totalCorrect: 0, totalItems: 0 };
  }

  if (typeof source.accuracy === 'number' || typeof source.averageReactionTime === 'number') {
    return {
      accuracy: clampPercent(source.accuracy || 0),
      averageReactionTime: Math.round(source.averageReactionTime || 0),
      totalCorrect: 0,
      totalItems: 0,
    };
  }

  if ((source.results || []).length > 0) {
    return getQuestionMetrics(source.results);
  }

  return getGameMetrics(source.gameScores);
};

const buildProgressCache = (state: {
  testType: TestType | null;
  results: TestResult[];
  gameScores: TestState['gameScores'];
  attentionScore: number;
}) => {
  const metrics = getSessionMetrics({
    results: state.results,
    gameScores: normalizeGameScores(state.gameScores),
  });

  return {
    testType: state.testType,
    accuracy: metrics.accuracy,
    averageReactionTime: metrics.averageReactionTime,
    attentionScore: state.attentionScore,
    updatedAt: new Date().toISOString(),
  } satisfies TestProgressCache;
};

export const saveTestProgressCache = (cache: TestProgressCache) => {
  try {
    if (!canUseSessionStorage()) return;
    sessionStorage.setItem(TEST_PROGRESS_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('Error saving test progress cache:', error);
  }
};

export const getTestProgressCache = (): TestProgressCache | null => {
  try {
    if (!canUseSessionStorage()) return null;
    const cache = sessionStorage.getItem(TEST_PROGRESS_CACHE_KEY);
    return cache ? JSON.parse(cache) : null;
  } catch (error) {
    console.error('Error getting test progress cache:', error);
    return null;
  }
};

const persistProgressCache = (state: {
  testType: TestType | null;
  results: TestResult[];
  gameScores: TestState['gameScores'];
  attentionScore: number;
}) => {
  saveTestProgressCache(buildProgressCache(state));
};

export const getAssessmentSnapshot = (sessions: TestSession[] = getTestSessions()) => {
  const latestSessions = sessions.reduce<Partial<Record<TestType, TestSession>>>((latest, session) => {
    latest[session.testType] = session;
    return latest;
  }, {});
  const caches = Object.values(latestSessions).filter(Boolean);
  const progress = getTestProgressCache();

  const accuracyValues = caches.map((session) => getSessionMetrics(session).accuracy);
  const reactionValues = caches.map((session) => getSessionMetrics(session).averageReactionTime);
  const attentionValues = caches
    .map((session) => session?.attentionScore)
    .filter((value): value is number => typeof value === 'number' && value > 0);

  const accuracy = accuracyValues.length
    ? Math.round(accuracyValues.reduce((sum, value) => sum + value, 0) / accuracyValues.length)
    : progress?.accuracy || 0;
  const averageReactionTime = reactionValues.length
    ? Math.round(reactionValues.reduce((sum, value) => sum + value, 0) / reactionValues.length)
    : progress?.averageReactionTime || 0;
  const attentionScore = attentionValues.length
    ? Math.round(attentionValues.reduce((sum, value) => sum + value, 0) / attentionValues.length)
    : progress?.attentionScore || 100;

  let estimatedIQ = 100;
  estimatedIQ += (accuracy - 50) * 0.5;
  if (averageReactionTime > 0) {
    estimatedIQ -= (averageReactionTime - 5000) / 1000;
  }

  return {
    accuracy,
    averageReactionTime,
    attentionScore,
    estimatedIQ: Math.round(Math.max(70, Math.min(150, estimatedIQ))),
  };
};

// Session storage helper functions
export const saveStudentProfile = (profile: StudentProfile) => {
  try {
    if (!canUseSessionStorage()) return;
    sessionStorage.setItem(STUDENT_PROFILE_KEY, JSON.stringify(profile));
  } catch (error) {
    console.error('Error saving student profile:', error);
  }
};

export const getStudentProfile = (): StudentProfile | null => {
  try {
    if (!canUseSessionStorage()) return null;
    const profile = sessionStorage.getItem(STUDENT_PROFILE_KEY);
    return profile ? JSON.parse(profile) : null;
  } catch (error) {
    console.error('Error getting student profile:', error);
    return null;
  }
};

export const savePreviousAttemptSnapshot = (snapshot: PreviousAttemptSnapshot) => {
  try {
    if (!canUseSessionStorage()) return;
    sessionStorage.setItem(PREVIOUS_ATTEMPT_KEY, JSON.stringify(snapshot));
  } catch (error) {
    console.error('Error saving previous attempt snapshot:', error);
  }
};

export const getPreviousAttemptSnapshot = (): PreviousAttemptSnapshot | null => {
  try {
    if (!canUseSessionStorage()) return null;
    const snapshot = sessionStorage.getItem(PREVIOUS_ATTEMPT_KEY);
    return snapshot ? JSON.parse(snapshot) : null;
  } catch (error) {
    console.error('Error getting previous attempt snapshot:', error);
    return null;
  }
};

export const clearPreviousAttemptSnapshot = () => {
  try {
    if (!canUseSessionStorage()) return;
    sessionStorage.removeItem(PREVIOUS_ATTEMPT_KEY);
  } catch (error) {
    console.error('Error clearing previous attempt snapshot:', error);
  }
};

export const saveTestSession = (session: TestSession) => {
  try {
    if (!canUseSessionStorage()) return;
    const existingSessions = getTestSessions();
    const nextSessions = [
      ...existingSessions.filter((existingSession) => existingSession.testType !== session.testType),
      session,
    ];
    sessionStorage.setItem(TEST_SESSIONS_KEY, JSON.stringify(nextSessions));
    markTestCompleted(session.testType);
  } catch (error) {
    console.error('Error saving test session:', error);
  }
};

export const getTestSessions = (): TestSession[] => {
  try {
    if (!canUseSessionStorage()) return [];
    const sessions = sessionStorage.getItem(TEST_SESSIONS_KEY);
    return sessions ? JSON.parse(sessions) : [];
  } catch (error) {
    console.error('Error getting test sessions:', error);
    return [];
  }
};

export const getLatestTestSession = (testType?: TestType): TestSession | null => {
  const sessions = getTestSessions();
  const filteredSessions = testType
    ? sessions.filter((session) => session.testType === testType)
    : sessions;

  return filteredSessions[filteredSessions.length - 1] || null;
};

export const getCompletedTests = (): Record<TestType, boolean> => {
  try {
    if (!canUseSessionStorage()) {
      return { text: false, voice: false, game: false };
    }

    const completed = sessionStorage.getItem(COMPLETED_TESTS_KEY);
    return {
      text: false,
      voice: false,
      game: false,
      ...(completed ? JSON.parse(completed) : {}),
    };
  } catch (error) {
    console.error('Error getting completed tests:', error);
    return { text: false, voice: false, game: false };
  }
};

export const isTestCompleted = (testType: TestType): boolean => {
  return Boolean(getCompletedTests()[testType]);
};

export const markTestCompleted = (testType: TestType) => {
  try {
    if (!canUseSessionStorage()) return;
    const completed = getCompletedTests();
    sessionStorage.setItem(
      COMPLETED_TESTS_KEY,
      JSON.stringify({ ...completed, [testType]: true })
    );
  } catch (error) {
    console.error('Error locking completed test:', error);
  }
};

export const clearTestSessions = () => {
  try {
    if (!canUseSessionStorage()) return;
    sessionStorage.removeItem(TEST_SESSIONS_KEY);
    sessionStorage.removeItem(COMPLETED_TESTS_KEY);
    sessionStorage.removeItem(TEST_PROGRESS_CACHE_KEY);
    sessionStorage.removeItem(PREVIOUS_ATTEMPT_KEY);
  } catch (error) {
    console.error('Error clearing test sessions:', error);
  }
};

interface TestState {
  // User info
  studentCode: string;
  studentClass: number;
  studentName: string;
  studentAge: number;
  studentGender: string;
  
  // Test configuration
  testType: TestType | null;
  currentQuestionIndex: number;
  questions: Question[];
  
  // Test results
  results: TestResult[];
  gameScores: {
    templeRun: { score: number; reactionTime: number } | null;
    memoryGame: { score: number; reactionTime: number } | null;
    reflexGame: { score: number; reactionTime: number } | null;
  };
  
  // Camera & monitoring
  cameraEnabled: boolean;
  attentionScore: number;
  
  // Actions
  setStudentInfo: (code: string, classLevel: number, name: string, age?: number, gender?: string) => void;
  setTestType: (type: TestType) => void;
  setQuestions: (questions: Question[]) => void;
  addResult: (result: TestResult) => void;
  nextQuestion: () => void;
  goToQuestion: (index: number) => void;
  updateGameScore: (game: 'templeRun' | 'memoryGame' | 'reflexGame', score: number, reactionTime: number) => void;
  setCameraEnabled: (enabled: boolean) => void;
  updateAttentionScore: (score: number) => void;
  resetTest: () => void;
  saveCurrentSession: () => void;
}

export const useTestStore = create<TestState>((set) => ({
  // Initial state
  studentCode: '',
  studentClass: 0,
  studentName: '',
  studentAge: 0,
  studentGender: '',
  testType: null,
  currentQuestionIndex: 0,
  questions: [],
  results: [],
  gameScores: {
    templeRun: null,
    memoryGame: null,
    reflexGame: null,
  },
  cameraEnabled: false,
  attentionScore: 100,
  
  // Actions
  setStudentInfo: (code, classLevel, name, age = 0, gender = '') =>
    set(() => {
      const profile = {
        studentCode: code,
        studentClass: classLevel,
        studentName: name,
        studentAge: age,
        studentGender: gender,
      };
      saveStudentProfile(profile);
      return profile;
    }),
  
  setTestType: (type) =>
    set((state) => {
      const nextState = { ...state, testType: type };
      persistProgressCache(nextState);
      return { testType: type };
    }),
  
  setQuestions: (questions) =>
    set((state) => {
      const nextState = { ...state, questions, currentQuestionIndex: 0 };
      persistProgressCache(nextState);
      return { questions, currentQuestionIndex: 0 };
    }),
  
  addResult: (result) =>
    set((state) => {
      // Upsert by question so revisiting/changing an answer replaces it
      // instead of recording a duplicate.
      const existingIndex = state.results.findIndex(
        (existing) => existing.questionId === result.questionId
      );
      const results =
        existingIndex >= 0
          ? state.results.map((existing, index) =>
              index === existingIndex ? result : existing
            )
          : [...state.results, result];
      persistProgressCache({ ...state, results });
      return { results };
    }),

  nextQuestion: () =>
    set((state) => ({ currentQuestionIndex: state.currentQuestionIndex + 1 })),

  goToQuestion: (index) =>
    set((state) => ({
      currentQuestionIndex: Math.max(
        0,
        Math.min(index, Math.max(0, state.questions.length - 1))
      ),
    })),
  
  updateGameScore: (game, score, reactionTime) =>
    set((state) => {
      const nextGameScores = {
        ...state.gameScores,
        [game]: { score, reactionTime },
      };
      persistProgressCache({ ...state, gameScores: nextGameScores });
      return {
        gameScores: nextGameScores,
      };
    }),
  
  setCameraEnabled: (enabled) =>
    set({ cameraEnabled: enabled }),
  
  updateAttentionScore: (score) =>
    set((state) => {
      persistProgressCache({ ...state, attentionScore: score });
      return { attentionScore: score };
    }),
  
  resetTest: () =>
    set((state) => {
      const nextState = {
        ...state,
        testType: null,
        currentQuestionIndex: 0,
        questions: [],
        results: [],
        gameScores: {
          templeRun: null,
          memoryGame: null,
          reflexGame: null,
        },
        attentionScore: 100,
      };
      persistProgressCache(nextState);
      return {
        testType: null,
        currentQuestionIndex: 0,
        questions: [],
        results: [],
        gameScores: {
          templeRun: null,
          memoryGame: null,
          reflexGame: null,
        },
        attentionScore: 100,
      };
    }),
  
  saveCurrentSession: () =>
    set((state) => {
      const hasGameScore = Boolean(
        state.gameScores.templeRun ||
        state.gameScores.reflexGame ||
        state.gameScores.memoryGame
      );

      if (state.testType && (state.results.length > 0 || hasGameScore)) {
        const metrics = getSessionMetrics({
          results: state.results,
          gameScores: normalizeGameScores(state.gameScores),
        });
        const session: TestSession = {
          sessionId: `session-${Date.now()}`,
          testType: state.testType,
          timestamp: new Date(),
          studentCode: state.studentCode,
          studentName: state.studentName,
          studentClass: state.studentClass,
          studentAge: state.studentAge,
          studentGender: state.studentGender,
          questions: state.questions,
          results: state.results,
          accuracy: metrics.accuracy,
          averageReactionTime: metrics.averageReactionTime,
          attentionScore: state.attentionScore,
          gameScores: {
            ...(state.gameScores.templeRun && { templeRun: state.gameScores.templeRun }),
            ...(state.gameScores.reflexGame && { reflexGame: state.gameScores.reflexGame }),
            ...(state.gameScores.memoryGame && { memoryGame: state.gameScores.memoryGame }),
          },
        };
        saveTestSession(session);
      }
      return state;
    }),
}));
