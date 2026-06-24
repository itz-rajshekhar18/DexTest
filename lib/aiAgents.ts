import axios from "axios";
import type { Question, TestResult, TestSession, TestType } from "./store";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const API_KEY = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;

const IQ_MODEL =
  process.env.NEXT_PUBLIC_IQ_MODEL || "openrouter/auto";
const FREE_IQ_MODEL =
  process.env.OPENROUTER_FREE_IQ_MODEL ||
  process.env.NEXT_PUBLIC_FREE_IQ_MODEL ||
  "openai/gpt-oss-20b:free";
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
type QuestionAgentMode = "written" | "voice";

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

function canCallOpenRouter() {
  return Boolean(API_KEY && API_KEY !== "your_api_key_here");
}

async function chatCompletion(model: string, messages: Message[], maxTokens = 1600) {
  if (!canCallOpenRouter()) {
    throw new Error("OpenRouter API key is not configured.");
  }

  const requestCompletion = async (modelId: string) => {
    const response = await axios.post<OpenRouterResponse>(
      OPENROUTER_API_URL,
      {
        model: modelId,
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
  };

  try {
    return await requestCompletion(model);
  } catch (error) {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 402 &&
      model !== FREE_IQ_MODEL
    ) {
      console.warn(`OpenRouter model ${model} requires credits. Retrying with ${FREE_IQ_MODEL}.`);
      return requestCompletion(FREE_IQ_MODEL);
    }

    throw error;
  }
}

function normalizeGeneratedQuestions(rawQuestions: unknown, count: number, uniquenessSeed: string): Question[] {
  if (!Array.isArray(rawQuestions)) {
    throw new Error("Question agent returned non-array JSON.");
  }

  const normalized = rawQuestions.slice(0, count).map((rawQuestion, index) => {
    const question = rawQuestion as Partial<Question>;
    const correctAnswer = Number(question.correctAnswer);
    const options = Array.isArray(question.options) ? question.options.slice(0, 4).map(String) : [];

    if (
      typeof question.question !== "string" ||
      question.question.trim().length === 0 ||
      options.length !== 4 ||
      !Number.isInteger(correctAnswer) ||
      correctAnswer < 0 ||
      correctAnswer > 3
    ) {
      throw new Error(`Question agent returned invalid question at index ${index}.`);
    }

    return {
      id: `${uniquenessSeed}-q${index + 1}`,
      question: question.question.trim(),
      options,
      correctAnswer,
      difficulty: question.difficulty || "medium",
      explanation: "",
      timeLimit: question.timeLimit || 60,
    };
  });

  if (normalized.length !== count) {
    throw new Error(`Question agent returned ${normalized.length} questions instead of ${count}.`);
  }

  return normalized;
}

async function runPythonQuestionAgent({
  mode,
  classLevel,
  count,
  studentGender,
  previousQuestions,
  uniquenessSeed,
}: {
  mode: QuestionAgentMode;
  classLevel: number;
  count: number;
  studentGender?: string;
  previousQuestions?: string[];
  uniquenessSeed: string;
}) {
  const response = await fetch("/api/ai-agents/questions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode,
      classLevel,
      studentGender,
      count,
      previousQuestions,
      uniquenessSeed,
    }),
  });

  const payload = (await response.json()) as {
    questions?: unknown;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error || `Python IQ agent failed with ${response.status}.`);
  }

  return normalizeGeneratedQuestions(payload.questions, count, uniquenessSeed);
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
  model: `${IQ_MODEL} via Python`,
  async generateTest({
    classLevel,
    count = 10,
    studentGender,
    previousQuestions = [],
    uniquenessSeed = `written-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  }: {
    classLevel: number;
    questionType: QuestionType;
    count?: number;
    studentAge?: number;
    studentGender?: string;
    previousQuestions?: string[];
    uniquenessSeed?: string;
  }): Promise<Question[]> {
    try {
      return await runPythonQuestionAgent({
        mode: "written",
        classLevel,
        count,
        studentGender,
        previousQuestions,
        uniquenessSeed,
      });
    } catch (error) {
      throw new Error(`Written IQ Test Agent could not generate AI questions. ${getErrorSummary(error)}`);
    }
  },
};

export const voiceIQAgent = {
  name: "Voice IQ Test Agent",
  model: `${IQ_MODEL} via Python`,
  async generateVoiceQuestions(
    classLevel: number,
    count = 10,
    studentAge?: number,
    studentGender?: string,
    previousQuestions: string[] = [],
    uniquenessSeed = `voice-${Date.now()}-${Math.random().toString(36).slice(2)}`
  ) {
    void studentAge;

    try {
      return await runPythonQuestionAgent({
        mode: "voice",
        classLevel,
        count,
        studentGender,
        previousQuestions,
        uniquenessSeed,
      });
    } catch (error) {
      throw new Error(`Voice IQ Test Agent could not generate AI questions. ${getErrorSummary(error)}`);
    }
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
