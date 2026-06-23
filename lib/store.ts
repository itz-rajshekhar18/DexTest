import { create } from 'zustand';

export type TestType = 'text' | 'voice' | 'game';

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
  questions: Question[];
  results: TestResult[];
  gameScores?: {
    templeRun?: { score: number; reactionTime: number };
    memoryGame?: { score: number; reactionTime: number };
    reflexGame?: { score: number; reactionTime: number };
  };
}

const TEST_SESSIONS_KEY = 'testSessions';
const COMPLETED_TESTS_KEY = 'completedTests';

const canUseSessionStorage = () =>
  typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';

// Session storage helper functions
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
  setStudentInfo: (code: string, classLevel: number, name: string, age?: number) => void;
  setTestType: (type: TestType) => void;
  setQuestions: (questions: Question[]) => void;
  addResult: (result: TestResult) => void;
  nextQuestion: () => void;
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
  setStudentInfo: (code, classLevel, name, age = 0) =>
    set({ studentCode: code, studentClass: classLevel, studentName: name, studentAge: age }),
  
  setTestType: (type) =>
    set({ testType: type }),
  
  setQuestions: (questions) =>
    set({ questions, currentQuestionIndex: 0 }),
  
  addResult: (result) =>
    set((state) => ({ results: [...state.results, result] })),
  
  nextQuestion: () =>
    set((state) => ({ currentQuestionIndex: state.currentQuestionIndex + 1 })),
  
  updateGameScore: (game, score, reactionTime) =>
    set((state) => ({
      gameScores: {
        ...state.gameScores,
        [game]: { score, reactionTime },
      },
    })),
  
  setCameraEnabled: (enabled) =>
    set({ cameraEnabled: enabled }),
  
  updateAttentionScore: (score) =>
    set({ attentionScore: score }),
  
  resetTest: () =>
    set({
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
    }),
  
  saveCurrentSession: () =>
    set((state) => {
      const hasGameScore = Boolean(
        state.gameScores.templeRun ||
        state.gameScores.reflexGame ||
        state.gameScores.memoryGame
      );

      if (state.testType && (state.results.length > 0 || hasGameScore)) {
        const session: TestSession = {
          sessionId: `session-${Date.now()}`,
          testType: state.testType,
          timestamp: new Date(),
          studentCode: state.studentCode,
          studentName: state.studentName,
          studentClass: state.studentClass,
          studentAge: state.studentAge,
          questions: state.questions,
          results: state.results,
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
