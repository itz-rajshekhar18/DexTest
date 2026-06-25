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
  // Try OpenAI directly first
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY;
  const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
  
  if (OPENAI_API_KEY) {
    try {
      console.log('Using OpenAI API directly with gpt-4o-mini');
      const response = await axios.post(
        OPENAI_API_URL,
        {
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are an expert in creating IQ test questions for students in class ${classLevel}. Generate ${count} age-appropriate logical reasoning questions in JSON format. Focus on pattern recognition, logical deduction, spatial reasoning, and analytical thinking.`
            },
            {
              role: 'user',
              content: `Generate ${count} ${mode === 'voice' ? 'voice-friendly ' : ''}IQ test questions suitable for class ${classLevel} students (age ${classLevel + 5} approximately). 

Requirements:
- Mix of difficulty levels (easy, medium, hard)
- Include pattern recognition, logic puzzles, word problems, and analytical questions
- Clear and unambiguous correct answers
- Age-appropriate content and complexity

Return ONLY a valid JSON array with this exact structure:
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

Make sure to return valid JSON only, no markdown formatting or code blocks.`
            }
          ],
          temperature: 0.8,
          max_tokens: 3000
        },
        {
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          }
        }
      );

      const content = response.data.choices[0].message.content;
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const questions = JSON.parse(cleanContent);
      console.log(`Successfully generated ${questions.length} questions with OpenAI gpt-4o-mini`);
      return questions;
    } catch (error) {
      console.error('OpenAI API failed:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  // Fallback to OpenRouter if OpenAI fails
  const OPENROUTER_API_KEY = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;
  const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

  if (OPENROUTER_API_KEY) {
    const modelsToTry = [
      'openai/gpt-4o-mini',
      'google/gemini-2.0-flash-001:free',
      'meta-llama/llama-3.2-3b-instruct:free',
    ];

    for (const model of modelsToTry) {
      try {
        console.log(`Trying OpenRouter model: ${model}`);
        const response = await axios.post<OpenRouterResponse>(
          OPENROUTER_API_URL,
          {
            model,
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
            temperature: 0.8,
            max_tokens: 3000
          },
          {
            headers: {
              'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://dextest.app',
              'X-Title': 'IQ Test Platform'
            }
          }
        );

        const content = response.data.choices[0].message.content;
        const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const questions = JSON.parse(cleanContent);
        console.log(`Successfully generated ${questions.length} questions with OpenRouter model: ${model}`);
        return questions;
      } catch (error) {
        console.error(`OpenRouter model ${model} failed:`, error instanceof Error ? error.message : 'Unknown error');
      }
    }
  }

  // If all models fail, return high-quality mock questions
  console.log('All AI models failed, using fallback mock questions');
  return generateMockQuestions(classLevel, count);
}

function generateMockQuestions(classLevel: number, count: number): any[] {
  const questionBank = [
    {
      question: "If all roses are flowers and some flowers fade quickly, which statement must be true?",
      options: [
        "All roses fade quickly",
        "Some roses might fade quickly",
        "No roses fade quickly",
        "All flowers are roses"
      ],
      correctAnswer: 1,
      difficulty: "medium",
      explanation: "Since some flowers fade quickly and all roses are flowers, it's possible that some roses are among those flowers that fade quickly."
    },
    {
      question: "What comes next in the sequence: 2, 6, 12, 20, 30, ?",
      options: ["40", "42", "44", "46"],
      correctAnswer: 1,
      difficulty: "medium",
      explanation: "The pattern is n(n+1): 1×2=2, 2×3=6, 3×4=12, 4×5=20, 5×6=30, 6×7=42"
    },
    {
      question: "If it takes 5 machines 5 minutes to make 5 widgets, how long would it take 100 machines to make 100 widgets?",
      options: ["5 minutes", "20 minutes", "100 minutes", "500 minutes"],
      correctAnswer: 0,
      difficulty: "hard",
      explanation: "Each machine makes 1 widget in 5 minutes. 100 machines would make 100 widgets in the same 5 minutes working in parallel."
    },
    {
      question: "Which word doesn't belong: Book, Magazine, Newspaper, Television, Novel",
      options: ["Book", "Magazine", "Television", "Novel"],
      correctAnswer: 2,
      difficulty: "easy",
      explanation: "Television is an electronic medium, while all others are printed materials."
    },
    {
      question: "A farmer has 17 sheep. All but 9 die. How many are left?",
      options: ["8", "9", "0", "17"],
      correctAnswer: 1,
      difficulty: "easy",
      explanation: "'All but 9' means 9 sheep survived, so 9 sheep are left."
    },
    {
      question: "If you rearrange the letters 'CIFAIPC' you would have the name of a(n):",
      options: ["City", "Animal", "Ocean", "Country"],
      correctAnswer: 2,
      difficulty: "medium",
      explanation: "CIFAIPC rearranged spells PACIFIC, which is an ocean."
    },
    {
      question: "What is the missing number: 3, 7, 15, 31, 63, ?",
      options: ["95", "127", "111", "125"],
      correctAnswer: 1,
      difficulty: "hard",
      explanation: "Each number is (previous × 2) + 1. So 63 × 2 + 1 = 127"
    },
    {
      question: "If today is Monday, what day will it be 100 days from now?",
      options: ["Monday", "Tuesday", "Wednesday", "Thursday"],
      correctAnswer: 2,
      difficulty: "medium",
      explanation: "100 ÷ 7 = 14 weeks + 2 days. Two days after Monday is Wednesday."
    },
    {
      question: "Which number should replace the question mark: 4, 9, 16, 25, 36, ?",
      options: ["45", "48", "49", "54"],
      correctAnswer: 2,
      difficulty: "easy",
      explanation: "These are perfect squares: 2², 3², 4², 5², 6², 7². So the next is 7² = 49"
    },
    {
      question: "A clock shows 3:15. What is the angle between the hour and minute hands?",
      options: ["0°", "7.5°", "15°", "30°"],
      correctAnswer: 1,
      difficulty: "hard",
      explanation: "At 3:15, the minute hand is at 90° (pointing at 3), and the hour hand is at 97.5° (quarter way between 3 and 4). The difference is 7.5°"
    }
  ];

  // Select random questions and adapt to count needed
  const selectedQuestions = [];
  for (let i = 0; i < count; i++) {
    const q = questionBank[i % questionBank.length];
    selectedQuestions.push({
      id: `q${i + 1}`,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      difficulty: q.difficulty,
      explanation: q.explanation,
      timeLimit: 60
    });
  }

  return selectedQuestions;
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
