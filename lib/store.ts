import { create } from 'zustand';

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
  testType: 'text' | 'voice' | 'game';
  timestamp: Date;
  questions: Question[];
  results: TestResult[];
  gameScores?: {
    templeRun?: { score: number; reactionTime: number };
    memoryGame?: { score: number; reactionTime: number };
    reflexGame?: { score: number; reactionTime: number };
  };
}

// Session storage helper functions
export const saveTestSession = (session: TestSession) => {
  try {
    const existingSessions = getTestSessions();
    existingSessions.push(session);
    sessionStorage.setItem('testSessions', JSON.stringify(existingSessions));
  } catch (error) {
    console.error('Error saving test session:', error);
  }
};

export const getTestSessions = (): TestSession[] => {
  try {
    const sessions = sessionStorage.getItem('testSessions');
    return sessions ? JSON.parse(sessions) : [];
  } catch (error) {
    console.error('Error getting test sessions:', error);
    return [];
  }
};

export const clearTestSessions = () => {
  try {
    sessionStorage.removeItem('testSessions');
  } catch (error) {
    console.error('Error clearing test sessions:', error);
  }
};

interface TestState {
  // User info
  studentCode: string;
  studentClass: number;
  studentName: string;
  
  // Test configuration
  testType: 'text' | 'voice' | 'game' | null;
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
  setStudentInfo: (code: string, classLevel: number, name: string) => void;
  setTestType: (type: 'text' | 'voice' | 'game') => void;
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
  setStudentInfo: (code, classLevel, name) =>
    set({ studentCode: code, studentClass: classLevel, studentName: name }),
  
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
      if (state.testType && (state.results.length > 0 || state.gameScores.templeRun || state.gameScores.reflexGame)) {
        const session: TestSession = {
          sessionId: `session-${Date.now()}`,
          testType: state.testType,
          timestamp: new Date(),
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
