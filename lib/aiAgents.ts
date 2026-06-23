import axios from "axios";
import type { Question, TestResult, TestSession, TestType } from "./store";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const API_KEY = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;

const IQ_MODEL =
  process.env.NEXT_PUBLIC_IQ_MODEL || "nvidia/llama-nemotron-rerank-vl-1b-v2:free";
const TTS_MODEL =
  process.env.NEXT_PUBLIC_TTS_MODEL || "google/gemini-flash-1.5-8b";

type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type QuestionType = "logical" | "mathematical" | "spatial" | "verbal";

type GameAssessment = {
  score: number;
  avgReactionTime: number;
  cognitiveSignal: string;
};

function getErrorSummary(error: unknown) {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const message =
      typeof error.response?.data === "object" && error.response?.data
        ? JSON.stringify(error.response.data)
        : error.response?.data || error.message;

    return status ? `OpenRouter request failed with ${status}: ${message}` : error.message;
  }

  return error instanceof Error ? error.message : String(error);
}

const fallbackQuestions: Question[] = [
  {
    id: "q1",
    question: "If all roses are flowers and some flowers fade quickly, which statement must be true?",
    options: ["All roses fade quickly", "Some roses may fade quickly", "No roses fade quickly", "All flowers are roses"],
    correctAnswer: 1,
    difficulty: "medium",
    explanation: "The statement allows the possibility that some roses fade quickly, but it does not prove all do.",
    timeLimit: 60,
  },
  {
    id: "q2",
    question: "What comes next in the sequence: 2, 6, 12, 20, 30, ?",
    options: ["40", "42", "38", "36"],
    correctAnswer: 1,
    difficulty: "medium",
    explanation: "The differences are consecutive even numbers: 4, 6, 8, 10, so the next difference is 12.",
    timeLimit: 60,
  },
  {
    id: "q3",
    question: "If 5 machines make 5 widgets in 5 minutes, how long do 100 machines need to make 100 widgets?",
    options: ["100 minutes", "5 minutes", "20 minutes", "1 minute"],
    correctAnswer: 1,
    difficulty: "hard",
    explanation: "Each machine makes one widget in 5 minutes, so 100 machines make 100 widgets in 5 minutes.",
    timeLimit: 60,
  },
  {
    id: "q4",
    question: "Which word does not belong with the others?",
    options: ["Square", "Triangle", "Circle", "Rectangle"],
    correctAnswer: 2,
    difficulty: "easy",
    explanation: "Circle is the only shape listed without straight sides or corners.",
    timeLimit: 60,
  },
  {
    id: "q5",
    question: "If you rearrange the letters CIFAIPC, you would have the name of a:",
    options: ["City", "Animal", "Ocean", "Country"],
    correctAnswer: 2,
    difficulty: "medium",
    explanation: "The letters rearrange to PACIFIC, which is an ocean.",
    timeLimit: 60,
  },
  {
    id: "q6",
    question: "A book costs $7 plus half its price. What does the book cost?",
    options: ["$10.50", "$14", "$7", "$21"],
    correctAnswer: 1,
    difficulty: "hard",
    explanation: "Let x be the price. x = 7 + x/2, so x/2 = 7 and x = 14.",
    timeLimit: 60,
  },
  {
    id: "q7",
    question: "Which number should replace the question mark? 3, 7, 15, 31, ?",
    options: ["62", "63", "64", "65"],
    correctAnswer: 1,
    difficulty: "medium",
    explanation: "Each number is double the previous number plus 1.",
    timeLimit: 60,
  },
  {
    id: "q8",
    question: "If some Smaugs are Thors and some Thors are Thrains, which statement must be true?",
    options: ["All Smaugs are Thrains", "Some Smaugs are Thrains", "No Smaugs are Thrains", "Cannot be determined"],
    correctAnswer: 3,
    difficulty: "hard",
    explanation: "The overlapping groups are not guaranteed to include the same members.",
    timeLimit: 60,
  },
  {
    id: "q9",
    question: "What is the missing number? 1, 1, 2, 3, 5, 8, ?",
    options: ["11", "13", "12", "10"],
    correctAnswer: 1,
    difficulty: "easy",
    explanation: "This is the Fibonacci sequence. The next number is 5 + 8 = 13.",
    timeLimit: 60,
  },
  {
    id: "q10",
    question: "Which comes next: J, F, M, A, M, ?",
    options: ["J", "S", "A", "N"],
    correctAnswer: 0,
    difficulty: "medium",
    explanation: "These are the first letters of the months. After May comes June.",
    timeLimit: 60,
  },
];

function canCallOpenRouter() {
  return Boolean(API_KEY && API_KEY !== "your_api_key_here");
}

async function chatCompletion(model: string, messages: Message[], maxTokens = 1600) {
  if (!canCallOpenRouter()) {
    throw new Error("OpenRouter API key is not configured.");
  }

  const response = await axios.post<OpenRouterResponse>(
    OPENROUTER_API_URL,
    {
      model,
      messages,
      temperature: 0.65,
      max_tokens: maxTokens,
    },
    {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://dextest.app",
        "X-Title": "DexTest AI Agents",
      },
    }
  );

  return response.data.choices?.[0]?.message?.content?.trim() || "";
}

function parseQuestionJson(content: string, count: number): Question[] {
  const clean = content.replace(/```json/g, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(clean) as Question[];

  if (!Array.isArray(parsed)) {
    throw new Error("Question agent returned non-array JSON.");
  }

  return parsed.slice(0, count).map((question, index) => ({
    id: question.id || `q${index + 1}`,
    question: question.question,
    options: question.options.slice(0, 4),
    correctAnswer: question.correctAnswer,
    difficulty: question.difficulty || "medium",
    explanation: question.explanation || "This follows from the reasoning pattern in the question.",
    timeLimit: question.timeLimit || 60,
  }));
}

function getFallbackQuestions(count: number) {
  return fallbackQuestions.slice(0, count).map((question, index) => ({
    ...question,
    id: `q${index + 1}`,
  }));
}

function summarizeResults(results: TestResult[]) {
  const correct = results.filter((result) => result.isCorrect).length;
  const total = results.length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  const avgReactionTime =
    total > 0 ? Math.round(results.reduce((sum, result) => sum + result.reactionTime, 0) / total) : 0;

  return { correct, total, accuracy, avgReactionTime };
}

function getGameSummary(session: TestSession) {
  const scores = session.gameScores || {};
  const entries = Object.entries(scores).filter(([, value]) => Boolean(value));
  const scoreTotal = entries.reduce((sum, [, value]) => sum + (value?.score || 0), 0);
  const avgReactionTime =
    entries.length > 0
      ? Math.round(entries.reduce((sum, [, value]) => sum + (value?.reactionTime || 0), 0) / entries.length)
      : 0;

  return { scoreTotal, avgReactionTime, gamesPlayed: entries.map(([name]) => name) };
}

export const writtenIQAgent = {
  name: "Written IQ Test Agent",
  model: IQ_MODEL,
  async generateTest({
    classLevel,
    questionType,
    count = 10,
    studentAge,
  }: {
    classLevel: number;
    questionType: QuestionType;
    count?: number;
    studentAge?: number;
  }): Promise<Question[]> {
    try {
      const content = await chatCompletion(
        IQ_MODEL,
        [
          {
            role: "system",
            content:
              "You create age-appropriate IQ test questions. Return only valid JSON and no markdown.",
          },
          {
            role: "user",
            content: `Generate ${count} ${questionType} IQ questions for a class ${classLevel || 10}${studentAge ? `, age ${studentAge},` : ""} student. Use this exact JSON shape:
[
  {
    "id": "q1",
    "question": "question text",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0,
    "difficulty": "easy",
    "explanation": "brief explanation",
    "timeLimit": 60
  }
]`,
          },
        ],
        2200
      );

      return parseQuestionJson(content, count);
    } catch (error) {
      console.warn("Written IQ Test Agent fallback:", getErrorSummary(error));
      return getFallbackQuestions(count);
    }
  },
};

export const voiceIQAgent = {
  name: "Voice IQ Test Agent",
  model: TTS_MODEL,
  async generateVoiceQuestions(classLevel: number, count = 10, studentAge?: number) {
    return writtenIQAgent.generateTest({
      classLevel,
      questionType: "verbal",
      count,
      studentAge,
    });
  },
  async createSpokenPrompt(question: Question, questionNumber: number) {
    const fallback = `Question ${questionNumber}. ${question.question}. ${question.options
      .map((option, index) => `Option ${String.fromCharCode(65 + index)}. ${option}.`)
      .join(" ")}`;

    try {
      const content = await chatCompletion(
        TTS_MODEL,
        [
          {
            role: "system",
            content:
              "You are a voice-based test narration agent. Convert test content into a clear, concise spoken script. Return plain text only.",
          },
          {
            role: "user",
            content: fallback,
          },
        ],
        600
      );

      return content || fallback;
    } catch (error) {
      console.warn("Voice IQ Test Agent fallback:", getErrorSummary(error));
      return fallback;
    }
  },
};

export const gameIQAgent = {
  name: "Game IQ Test Agent",
  model: "local-reaction-spatial-agent-v1",
  assessReflexGame(score: number, reactionTimes: number[]): GameAssessment {
    const avgReactionTime =
      reactionTimes.length > 0
        ? Math.round(reactionTimes.reduce((sum, time) => sum + time, 0) / reactionTimes.length)
        : 0;

    return {
      score,
      avgReactionTime,
      cognitiveSignal:
        avgReactionTime > 0 && avgReactionTime < 650
          ? "Fast visual processing and strong motor response."
          : "Measured responses with room to improve visual reaction speed.",
    };
  },
  assessTempleRun(score: number, reactionTimes: number[]): GameAssessment {
    const avgReactionTime =
      reactionTimes.length > 0
        ? Math.round(reactionTimes.reduce((sum, time) => sum + time, 0) / reactionTimes.length)
        : 0;

    return {
      score,
      avgReactionTime,
      cognitiveSignal:
        score >= 120
          ? "Strong spatial tracking and sustained attention."
          : "Developing spatial anticipation and timed movement control.",
    };
  },
};

export const reportAgent = {
  name: "Session Report Agent",
  model: IQ_MODEL,
  async analyzeCurrentSession(session: TestSession, classLevel: number, studentName: string) {
    const isGame = session.testType === "game";
    const summary = isGame ? getGameSummary(session) : summarizeResults(session.results);

    try {
      return await chatCompletion(
        IQ_MODEL,
        [
          {
            role: "system",
            content:
              "You are an educational psychologist. Give concise, supportive IQ assessment feedback based only on the provided session data.",
          },
          {
            role: "user",
            content: `Student: ${studentName || "Student"}
Class: ${classLevel || "Not provided"}
Test type: ${session.testType}
Session data:
${JSON.stringify(summary, null, 2)}

Write 3 short sections: Performance, Cognitive Signals, Recommendations.`,
          },
        ],
        1000
      );
    } catch (error) {
      console.warn("Session Report Agent fallback:", getErrorSummary(error));
      if (isGame) {
        const game = summary as ReturnType<typeof getGameSummary>;
        return `Performance
You completed the game-based assessment with a total game score of ${game.scoreTotal}.

Cognitive Signals
Your average reaction time was ${game.avgReactionTime}ms across ${game.gamesPlayed.join(", ") || "the game task"}.

Recommendations
Practice short visual reaction drills and spatial tracking games. Focus on staying calm while responding quickly.`;
      }

      const result = summary as ReturnType<typeof summarizeResults>;
      return `Performance
You answered ${result.correct} out of ${result.total} questions correctly, for ${result.accuracy}% accuracy.

Cognitive Signals
Your average reaction time was ${result.avgReactionTime}ms, which reflects your current processing rhythm for this test.

Recommendations
Review missed question patterns, practice timed reasoning sets, and aim for steady accuracy before increasing speed.`;
    }
  },
  async generateComprehensiveReport(allSessions: TestSession[], studentClass: number, studentName: string) {
    const summaries = allSessions.map((session) => ({
      testType: session.testType,
      timestamp: session.timestamp,
      questionSummary: summarizeResults(session.results || []),
      gameSummary: session.testType === "game" ? getGameSummary(session) : null,
    }));

    try {
      return await chatCompletion(
        IQ_MODEL,
        [
          {
            role: "system",
            content:
              "You generate comprehensive student IQ assessment reports from session storage data. Be professional, clear, and actionable.",
          },
          {
            role: "user",
            content: `Generate a comprehensive IQ report for ${studentName || "Student"} in class ${studentClass || "N/A"}.
Use these completed browser session-storage test records:
${JSON.stringify(summaries, null, 2)}

Include: overall assessment, written reasoning, voice reasoning, game cognition, strengths, improvements, and next steps.`,
          },
        ],
        2200
      );
    } catch (error) {
      console.warn("Comprehensive Report Agent fallback:", getErrorSummary(error));
      const completedTypes = summaries.map((summary) => summary.testType).join(", ");
      const avgAccuracy =
        summaries.length > 0
          ? Math.round(
              summaries.reduce((sum, summary) => sum + summary.questionSummary.accuracy, 0) / summaries.length
            )
          : 0;

      return `Comprehensive IQ Assessment Report

Student: ${studentName || "Student"}
Class: ${studentClass || "N/A"}
Completed tests: ${completedTypes || "None"}

Overall Assessment
The stored sessions show an average written/voice accuracy of ${avgAccuracy}% where question data was available. Game results contribute reaction-speed and spatial-attention signals.

Strengths
Completed test sessions show persistence, task engagement, and measurable cognitive performance across multiple formats.

Areas for Improvement
Continue practicing reasoning accuracy, timed decision-making, and visual reaction control.

Next Steps
Review incorrect answers, repeat short practice drills outside this locked assessment session, and compare future session reports over time.`;
    }
  },
};

export function getAgentForTestType(testType: TestType) {
  if (testType === "text") return writtenIQAgent;
  if (testType === "voice") return voiceIQAgent;
  return gameIQAgent;
}
