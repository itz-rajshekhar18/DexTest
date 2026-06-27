import axios from "axios";
import type { Question, TestResult, TestSession, TestType } from "./store";

// All OpenRouter calls go through the server proxy at /api/openrouter, which
// reads OPENROUTER_API_KEY from .env.local. The browser never needs a key.
const OPENROUTER_PROXY_URL = "/api/openrouter";

type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

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

// Reports omit `model`, so the proxy falls back to QUESTION_MODEL (.env.local) —
// keeping report generation on the same model as question generation.
async function chatCompletion(messages: Message[], maxTokens = 1600) {
  // The proxy returns { content } on success, or { error } when the server has
  // no key / the upstream call fails. Callers catch this and fall back.
  const response = await axios.post<{ content?: string; error?: string }>(
    OPENROUTER_PROXY_URL,
    {
      messages,
      temperature: 0.65,
      max_tokens: maxTokens,
    }
  );

  if (response.data.error) {
    throw new Error(response.data.error);
  }

  return response.data.content?.trim() || "";
}

// --- Local question bank ---------------------------------------------------
// Questions come from /public/questions.json (no LLM). The band is chosen by
// class: below 8 -> easy, 8-10 -> medium, 11-12 -> hard. We pick `count` at
// random from that band.
type BankQuestion = {
  question: string;
  options: string[];
  correctAnswer: number;
  difficulty: "easy" | "medium" | "hard";
  explanation: string;
};

type QuestionBank = {
  easy: BankQuestion[];
  medium: BankQuestion[];
  hard: BankQuestion[];
};

function bandForClass(classLevel: number): keyof QuestionBank {
  if (classLevel <= 7) return "easy";
  if (classLevel <= 10) return "medium";
  return "hard";
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function loadQuestionsFromBank(classLevel: number, count: number): Promise<Question[]> {
  const response = await fetch("/questions.json", { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`Could not load question bank (${response.status}).`);
  }

  const bank = (await response.json()) as QuestionBank;
  const pool = bank[bandForClass(classLevel)] || [];

  if (pool.length === 0) {
    throw new Error("Question bank is empty for this class level.");
  }

  return shuffle(pool)
    .slice(0, count)
    .map((q, index) => ({
      id: `q${index + 1}`,
      question: q.question,
      options: q.options.slice(0, 4).map(String),
      correctAnswer: Number(q.correctAnswer),
      difficulty: q.difficulty || "medium",
      explanation: q.explanation || "",
      timeLimit: 60,
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
  model: "Local question bank",
  async generateTest({
    classLevel,
    count = 10,
  }: {
    classLevel: number;
    count?: number;
  }): Promise<Question[]> {
    try {
      return await loadQuestionsFromBank(classLevel, count);
    } catch (error) {
      throw new Error(`Written IQ Test Agent could not load questions. ${getErrorSummary(error)}`);
    }
  },
};

export const voiceIQAgent = {
  name: "Voice IQ Test Agent",
  model: "Local question bank",
  async generateVoiceQuestions(classLevel: number, count = 10) {
    try {
      return await loadQuestionsFromBank(classLevel, count);
    } catch (error) {
      throw new Error(`Voice IQ Test Agent could not load questions. ${getErrorSummary(error)}`);
    }
  },
  // Build the spoken script directly from the question. No LLM call here — the
  // text goes straight to ElevenLabs TTS, so there is no OpenRouter round-trip
  // before each audio clip.
  createSpokenPrompt(question: Question, questionNumber: number) {
    return `Question ${questionNumber}. ${question.question}. ${question.options
      .map((option, index) => `Option ${String.fromCharCode(65 + index)}. ${option}.`)
      .join(" ")}`;
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
  model: "Same as question model (QUESTION_MODEL)",
  async analyzeCurrentSession(session: TestSession, classLevel: number, studentName: string) {
    const isGame = session.testType === "game";
    const summary = isGame ? getGameSummary(session) : summarizeResults(session.results);

    try {
      return await chatCompletion(
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
