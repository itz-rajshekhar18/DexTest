import { NextResponse } from 'next/server';
import axios from 'axios';

export const runtime = 'nodejs';

type QuestionAgentMode = 'written' | 'voice';

type QuestionAgentRequest = {
  mode?: QuestionAgentMode;
  classLevel?: number;
  studentGender?: string;
  count?: number;
  previousQuestions?: string[];
  uniquenessSeed?: string;
};

const isQuestionAgentMode = (value: unknown): value is QuestionAgentMode =>
  value === 'written' || value === 'voice';

interface OpenRouterResponse {
  id: string;
  choices: {
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
}

async function generateQuestionsWithAI(
  classLevel: number,
  count: number,
  mode: QuestionAgentMode
): Promise<any[]> {
  const API_KEY = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;
  const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

  try {
    const response = await axios.post<OpenRouterResponse>(
      OPENROUTER_API_URL,
      {
        model: 'nvidia/llama-nemotron-rerank-vl-1b-v2:free',
        messages: [
          {
            role: 'system',
            content: `You are an expert in creating IQ test questions for students in class ${classLevel}. Generate ${count} age-appropriate logical reasoning questions in JSON format.`
          },
          {
            role: 'user',
            content: `Generate ${count} ${mode === 'voice' ? 'voice-friendly ' : ''}IQ questions for class ${classLevel} students. Return ONLY a JSON array with this structure:
[
  {
    "id": "q1",
    "question": "question text",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0,
    "difficulty": "easy",
    "explanation": "why this is the correct answer",
    "timeLimit": 60
  }
]

Make sure to return valid JSON only, no markdown formatting.`
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      },
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://dextest.app',
          'X-Title': 'IQ Test Platform'
        }
      }
    );

    const content = response.data.choices[0].message.content;
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleanContent);
  } catch (error) {
    console.error('Error generating questions with AI:', error);
    
    // Fallback: return mock questions
    return Array.from({ length: count }, (_, i) => ({
      id: `q${i + 1}`,
      question: `Sample IQ question ${i + 1} for class ${classLevel}`,
      options: ["Option A", "Option B", "Option C", "Option D"],
      correctAnswer: Math.floor(Math.random() * 4),
      difficulty: ["easy", "medium", "hard"][Math.floor(Math.random() * 3)],
      explanation: "This is the correct answer based on logical reasoning.",
      timeLimit: 60
    }));
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as QuestionAgentRequest;
    const mode = isQuestionAgentMode(body.mode) ? body.mode : 'written';
    const count = Math.max(1, Math.min(Number(body.count || 10), 20));
    const classLevel = Math.max(1, Math.min(Number(body.classLevel || 10), 12));

    const questions = await generateQuestionsWithAI(classLevel, count, mode);

    return NextResponse.json(
      {
        mode,
        questions,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error generating questions.',
      },
      { status: 500 }
    );
  }
}
