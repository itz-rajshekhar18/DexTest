import axios from 'axios';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const API_KEY = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface OpenRouterResponse {
  id: string;
  choices: {
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Fallback mock questions if API fails
const getMockQuestions = (classLevel: number, count: number) => {
  const mockQuestions = [
    {
      id: "q1",
      question: "If all roses are flowers and some flowers fade quickly, which statement must be true?",
      options: ["All roses fade quickly", "Some roses may fade quickly", "No roses fade quickly", "All flowers are roses"],
      correctAnswer: 1,
      difficulty: "medium",
      explanation: "Since some flowers fade quickly and all roses are flowers, it's possible (but not certain) that some roses fade quickly.",
      timeLimit: 60
    },
    {
      id: "q2",
      question: "What comes next in the sequence: 2, 6, 12, 20, 30, ?",
      options: ["40", "42", "38", "36"],
      correctAnswer: 1,
      difficulty: "medium",
      explanation: "The pattern adds consecutive even numbers: +4, +6, +8, +10, +12. So 30 + 12 = 42",
      timeLimit: 60
    },
    {
      id: "q3",
      question: "If it takes 5 machines 5 minutes to make 5 widgets, how long would it take 100 machines to make 100 widgets?",
      options: ["100 minutes", "5 minutes", "20 minutes", "1 minute"],
      correctAnswer: 1,
      difficulty: "hard",
      explanation: "Each machine makes 1 widget in 5 minutes. So 100 machines make 100 widgets in 5 minutes.",
      timeLimit: 60
    },
    {
      id: "q4",
      question: "Which word does not belong with the others?",
      options: ["Square", "Triangle", "Circle", "Rectangle"],
      correctAnswer: 2,
      difficulty: "easy",
      explanation: "Circle is the only shape without corners/angles.",
      timeLimit: 60
    },
    {
      id: "q5",
      question: "If you rearrange the letters 'CIFAIPC' you would have the name of a(n):",
      options: ["City", "Animal", "Ocean", "Country"],
      correctAnswer: 2,
      difficulty: "medium",
      explanation: "CIFAIPC rearranged spells PACIFIC, which is an ocean.",
      timeLimit: 60
    },
    {
      id: "q6",
      question: "A book costs $7 plus half its price. What does the book cost?",
      options: ["$10.50", "$14", "$7", "$21"],
      correctAnswer: 1,
      difficulty: "hard",
      explanation: "Let x be the price. x = 7 + x/2. Solving: x/2 = 7, so x = 14",
      timeLimit: 60
    },
    {
      id: "q7",
      question: "Which number should replace the question mark? 3, 7, 15, 31, ?",
      options: ["62", "63", "64", "65"],
      correctAnswer: 1,
      difficulty: "medium",
      explanation: "Each number is double the previous number plus 1: 3×2+1=7, 7×2+1=15, 15×2+1=31, 31×2+1=63",
      timeLimit: 60
    },
    {
      id: "q8",
      question: "If some Smaugs are Thors and some Thors are Thrains, which statement must be true?",
      options: ["All Smaugs are Thrains", "Some Smaugs are Thrains", "No Smaugs are Thrains", "Cannot be determined"],
      correctAnswer: 3,
      difficulty: "hard",
      explanation: "We cannot determine if any Smaugs are Thrains because we don't know if the Smaugs that are Thors overlap with the Thors that are Thrains.",
      timeLimit: 60
    },
    {
      id: "q9",
      question: "What is the missing number? 1, 1, 2, 3, 5, 8, ?",
      options: ["11", "13", "12", "10"],
      correctAnswer: 1,
      difficulty: "easy",
      explanation: "This is the Fibonacci sequence where each number is the sum of the previous two: 5 + 8 = 13",
      timeLimit: 60
    },
    {
      id: "q10",
      question: "Which comes next: J, F, M, A, M, ?",
      options: ["J", "S", "A", "N"],
      correctAnswer: 0,
      difficulty: "medium",
      explanation: "These are the first letters of months: January, February, March, April, May, June",
      timeLimit: 60
    }
  ];

  return mockQuestions.slice(0, count);
};

/**
 * Generate IQ questions using Claude Sonnet 3.5
 */
export async function generateIQQuestions(
  classLevel: number,
  questionType: 'logical' | 'mathematical' | 'spatial' | 'verbal',
  count: number = 5
): Promise<any> {
  // First, try the API
  try {
    const response = await axios.post<OpenRouterResponse>(
      OPENROUTER_API_URL,
      {
        model: 'nvidia/llama-nemotron-rerank-vl-1b-v2:free',
        messages: [
          {
            role: 'system',
            content: `You are an expert in creating IQ test questions for students in class ${classLevel}. Generate ${count} age-appropriate ${questionType} reasoning questions in JSON format.`
          },
          {
            role: 'user',
            content: `Generate ${count} ${questionType} IQ questions for class ${classLevel} students. Return ONLY a JSON array with this structure:
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
    // Remove markdown code blocks if present
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleanContent);
  } catch (error: any) {
    console.error('Error generating IQ questions, using fallback:', error.response?.data || error.message);
    // Fallback to mock questions
    console.log('Using mock questions as fallback');
    return getMockQuestions(classLevel, count);
  }
}

/**
 * Generate text-to-speech using Gemini Flash TTS
 */
export async function generateTTS(text: string): Promise<string> {
  try {
    const response = await axios.post<OpenRouterResponse>(
      OPENROUTER_API_URL,
      {
        model: 'google/gemini-flash-1.5-8b',
        messages: [
          {
            role: 'user',
            content: `Convert this text to speech-ready format: ${text}`
          }
        ],
        temperature: 0.3
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

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Error generating TTS:', error);
    throw error;
  }
}

/**
 * Analyze student performance using all test sessions
 */
export async function analyzePerformance(
  answers: any[],
  reactionTimes: number[],
  classLevel: number
): Promise<string> {
  try {
    const correctCount = answers.filter(a => a.isCorrect).length;
    const totalCount = answers.length;
    const avgReaction = reactionTimes.length > 0 
      ? reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length 
      : 0;

    const response = await axios.post<OpenRouterResponse>(
      OPENROUTER_API_URL,
      {
        model: 'nvidia/llama-nemotron-rerank-vl-1b-v2:free',
        messages: [
          {
            role: 'system',
            content: 'You are an expert educational psychologist analyzing IQ test results.'
          },
          {
            role: 'user',
            content: `Analyze this student's performance:
Class Level: ${classLevel}
Correct Answers: ${correctCount} out of ${totalCount}
Average Reaction Time: ${Math.round(avgReaction)}ms

Provide a brief analysis (3-4 paragraphs) including:
1. IQ Score estimation based on performance
2. Cognitive strengths and areas for improvement
3. Specific recommendations for the student`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
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

    return response.data.choices[0].message.content;
  } catch (error: any) {
    console.error('Error analyzing performance:', error.response?.data || error.message);
    
    // Fallback analysis
    const correctCount = answers.filter(a => a.isCorrect).length;
    const totalCount = answers.length;
    const accuracy = Math.round((correctCount / totalCount) * 100);
    const avgReaction = reactionTimes.length > 0 
      ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
      : 0;

    return `Performance Analysis:

You answered ${correctCount} out of ${totalCount} questions correctly (${accuracy}% accuracy).

Your average reaction time was ${avgReaction}ms, which ${avgReaction < 5000 ? 'shows quick thinking and good cognitive speed' : 'suggests you took time to carefully consider each answer'}.

${accuracy >= 80 ? 'Excellent performance! You demonstrate strong logical reasoning and problem-solving abilities.' : accuracy >= 60 ? 'Good performance! With practice, you can further improve your analytical skills.' : 'You show potential! Focus on practicing logical reasoning and pattern recognition exercises.'}

Recommendations:
- Continue practicing IQ test questions regularly
- Work on improving your ${avgReaction > 6000 ? 'response speed while maintaining accuracy' : 'accuracy through careful analysis'}
- Focus on ${accuracy < 60 ? 'understanding question patterns and logical reasoning' : 'challenging yourself with harder problems'}`;
  }
}

/**
 * Generate comprehensive report from all test sessions in session storage
 */
export async function generateComprehensiveReport(
  allSessions: any[],
  studentClass: number,
  studentName: string
): Promise<string> {
  try {
    // Prepare session data summary
    const sessionSummaries = allSessions.map((session, index) => {
      const correctCount = session.results?.filter((r: any) => r.isCorrect).length || 0;
      const totalCount = session.results?.length || 0;
      const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
      const avgReaction = session.results && session.results.length > 0
        ? Math.round(session.results.reduce((sum: number, r: any) => sum + r.reactionTime, 0) / session.results.length)
        : 0;

      return {
        sessionNumber: index + 1,
        testType: session.testType,
        accuracy,
        correctCount,
        totalCount,
        avgReaction,
        questions: session.questions?.map((q: any) => ({
          question: q.question,
          difficulty: q.difficulty,
          answer: session.results?.find((r: any) => r.questionId === q.id)?.isCorrect ? 'Correct' : 'Incorrect'
        })) || [],
        gameScores: session.gameScores
      };
    });

    const response = await axios.post<OpenRouterResponse>(
      OPENROUTER_API_URL,
      {
        model: 'nvidia/llama-nemotron-rerank-vl-1b-v2:free',
        messages: [
          {
            role: 'system',
            content: 'You are an expert educational psychologist generating comprehensive IQ assessment reports for students.'
          },
          {
            role: 'user',
            content: `Generate a comprehensive IQ assessment report for ${studentName} (Class ${studentClass}).

Test Sessions Data:
${JSON.stringify(sessionSummaries, null, 2)}

Please provide a detailed report with:
1. **Overall IQ Assessment** - Estimated IQ range based on all sessions
2. **Performance Trends** - How performance changed across sessions
3. **Cognitive Strengths** - Areas where the student excels
4. **Areas for Improvement** - Specific weaknesses identified
5. **Detailed Recommendations** - Actionable steps for improvement
6. **Learning Style Analysis** - Based on performance patterns

Format the report in a professional, easy-to-read manner with clear sections.`
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

    return response.data.choices[0].message.content;
  } catch (error: any) {
    console.error('Error generating comprehensive report:', error.response?.data || error.message);
    
    // Fallback comprehensive report
    const totalSessions = allSessions.length;
    const overallAccuracy = allSessions.reduce((sum, session) => {
      const correct = session.results?.filter((r: any) => r.isCorrect).length || 0;
      const total = session.results?.length || 0;
      return sum + (total > 0 ? (correct / total) * 100 : 0);
    }, 0) / totalSessions;

    const avgReactionOverall = allSessions.reduce((sum, session) => {
      const avgReaction = session.results && session.results.length > 0
        ? session.results.reduce((s: number, r: any) => s + r.reactionTime, 0) / session.results.length
        : 0;
      return sum + avgReaction;
    }, 0) / totalSessions;

    return `COMPREHENSIVE IQ ASSESSMENT REPORT
For: ${studentName} | Class ${studentClass}
Total Sessions Completed: ${totalSessions}

═══════════════════════════════════════

📊 OVERALL PERFORMANCE SUMMARY

Average Accuracy: ${Math.round(overallAccuracy)}%
Average Reaction Time: ${Math.round(avgReactionOverall)}ms
Sessions Completed: ${totalSessions}

═══════════════════════════════════════

🧠 IQ ASSESSMENT

Based on your performance across ${totalSessions} test session(s), your estimated IQ range is ${overallAccuracy >= 80 ? '115-125 (Above Average)' : overallAccuracy >= 60 ? '100-115 (Average)' : '85-100 (Average)'}.

This assessment considers:
- Accuracy in logical reasoning questions
- Speed of information processing
- Consistency across multiple test sessions
- Pattern recognition abilities

═══════════════════════════════════════

💪 COGNITIVE STRENGTHS

${overallAccuracy >= 70 ? '• Strong analytical thinking skills\n• Good pattern recognition abilities\n• Effective problem-solving approach' : '• Demonstrates potential for growth\n• Shows persistence in completing tests\n• Improving with practice'}

${avgReactionOverall < 5000 ? '• Quick decision-making\n• Efficient cognitive processing\n• Good time management' : '• Careful and thorough approach\n• Takes time to analyze problems\n• Methodical thinking style'}

═══════════════════════════════════════

🎯 AREAS FOR IMPROVEMENT

${overallAccuracy < 70 ? '• Practice more logical reasoning exercises\n• Work on pattern recognition skills\n• Focus on understanding question types' : '• Challenge yourself with harder problems\n• Work on speed while maintaining accuracy\n• Explore advanced reasoning topics'}

${avgReactionOverall > 6000 ? '• Practice timed exercises\n• Work on quicker decision-making\n• Build confidence in your answers' : '• Consider double-checking answers\n• Balance speed with accuracy\n• Take time on difficult questions'}

═══════════════════════════════════════

📚 RECOMMENDATIONS

1. **Daily Practice**: Spend 15-20 minutes daily on IQ puzzles
2. **Focus Areas**: ${overallAccuracy < 60 ? 'Basic logical reasoning and patterns' : overallAccuracy < 80 ? 'Intermediate problem-solving and speed' : 'Advanced analytical thinking'}
3. **Resources**: Use online IQ training platforms and puzzle books
4. **Consistency**: Take regular practice tests to track improvement
5. **Review**: Analyze incorrect answers to understand mistakes

═══════════════════════════════════════

📈 PROGRESS TRACKING

Continue taking tests regularly to track your progress. Aim for:
- ${overallAccuracy < 70 ? '70%+' : overallAccuracy < 85 ? '85%+' : '90%+'} accuracy in future tests
- Faster response times (under ${avgReactionOverall > 5000 ? '5000ms' : '4000ms'})
- Consistent performance across all question types

═══════════════════════════════════════

Keep up the excellent work and continue practicing!`;
  }
}
