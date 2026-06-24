import axios from 'axios';
import type { Question, TestResult, TestSession } from './store';

const IQ_MODEL = process.env.NEXT_PUBLIC_IQ_MODEL || 'openrouter/auto';
const REPORT_MODEL = process.env.NEXT_PUBLIC_REPORT_MODEL || IQ_MODEL;
const TTS_MODEL = process.env.NEXT_PUBLIC_TTS_MODEL || 'google/gemini-flash-1.5-8b';
const QUESTION_BATCH_SIZE = 1;
const QUESTION_GENERATION_MAX_TOKENS = 380;
const QUESTION_REPAIR_MAX_TOKENS = 420;
const MIN_OPENROUTER_TOKENS = 180;

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

export interface StudentProfile {
  age: number;
  classLevel: number;
  studentName?: string;
}

type QuestionMode = 'text' | 'voice';

const estimateAgeFromClass = (classLevel: number) => Math.max(6, classLevel + 5);

const cleanJsonPayload = (content: string) => {
  const withoutCodeFence = content.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const firstBracket = withoutCodeFence.indexOf('[');
  const lastBracket = withoutCodeFence.lastIndexOf(']');
  const firstBrace = withoutCodeFence.indexOf('{');
  const lastBrace = withoutCodeFence.lastIndexOf('}');

  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    return withoutCodeFence.slice(firstBracket, lastBracket + 1);
  }

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return withoutCodeFence.slice(firstBrace, lastBrace + 1);
  }

  return withoutCodeFence;
};

const normalizeJsonCandidate = (content: string) =>
  content
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, '$1')
    .trim();

const decodeLooseJsonString = (value: string) => {
  const trimmed = value.trim().replace(/^["']|["']$/g, '');

  return trimmed
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .trim();
};

const extractLooseField = (block: string, field: string, nextFields: string[]) => {
  const nextFieldPattern = nextFields.length > 0
    ? `\\s*,\\s*"?(?:${nextFields.join('|')})"?\\s*:`
    : '\\s*$';
  const pattern = new RegExp(
    `"${field}"\\s*:\\s*([\\s\\S]*?)(?=${nextFieldPattern})`,
    'i'
  );

  return block.match(pattern)?.[1]?.trim() || '';
};

const parseLooseOptions = (rawOptions: string) => {
  const normalized = rawOptions.trim().replace(/^\[/, '').replace(/\]$/, '');

  if (!normalized) {
    return [];
  }

  return normalized
    .split(/\s*,\s*/)
    .map((option) => decodeLooseJsonString(option))
    .filter(Boolean)
    .slice(0, 4);
};

const parseLooseQuestionArrayPayload = (content: string): unknown => {
  const baseCandidate = normalizeJsonCandidate(cleanJsonPayload(content));
  const objectMatches =
    baseCandidate.match(/\{[\s\S]*?\}(?=\s*,\s*\{|\s*\]|\s*$)/g) || [];

  const recoveredQuestions = objectMatches
    .map((block, index) => {
      const id = decodeLooseJsonString(
        extractLooseField(block, 'id', ['question', 'options', 'correctAnswer', 'difficulty', 'explanation', 'timeLimit'])
      ) || `q${index + 1}`;
      const question = decodeLooseJsonString(
        extractLooseField(block, 'question', ['options', 'correctAnswer', 'difficulty', 'explanation', 'timeLimit'])
      );
      const options = parseLooseOptions(
        extractLooseField(block, 'options', ['correctAnswer', 'difficulty', 'explanation', 'timeLimit'])
      );
      const correctAnswer = Number(
        decodeLooseJsonString(
          extractLooseField(block, 'correctAnswer', ['difficulty', 'explanation', 'timeLimit'])
        )
      );
      const difficulty = decodeLooseJsonString(
        extractLooseField(block, 'difficulty', ['explanation', 'timeLimit'])
      );
      const explanation = decodeLooseJsonString(
        extractLooseField(block, 'explanation', ['timeLimit'])
      );
      const timeLimit = Number(
        decodeLooseJsonString(extractLooseField(block, 'timeLimit', []))
      );

      if (!question || options.length !== 4 || Number.isNaN(correctAnswer)) {
        return null;
      }

      return {
        id,
        question,
        options,
        correctAnswer,
        difficulty,
        explanation,
        timeLimit,
      };
    })
    .filter(Boolean);

  if (recoveredQuestions.length > 0) {
    return recoveredQuestions;
  }

  throw new Error('Invalid JSON response');
};

const parseQuestionArrayPayload = (content: string): unknown => {
  const baseCandidate = cleanJsonPayload(content);
  const candidates = [
    baseCandidate,
    normalizeJsonCandidate(baseCandidate),
  ];

  let lastError: Error | null = null;

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;

      if (Array.isArray(parsed)) {
        return parsed;
      }

      if (
        parsed &&
        typeof parsed === 'object' &&
        'questions' in parsed &&
        Array.isArray((parsed as { questions?: unknown }).questions)
      ) {
        return (parsed as { questions: unknown[] }).questions;
      }

      if (
        parsed &&
        typeof parsed === 'object' &&
        'question' in parsed &&
        'options' in parsed
      ) {
        return [parsed];
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Invalid JSON response');
    }
  }

  try {
    return parseLooseQuestionArrayPayload(baseCandidate);
  } catch (error) {
    lastError = error instanceof Error ? error : lastError;
  }

  throw lastError || new Error('Invalid JSON response');
};

const sanitizeQuestions = (
  rawQuestions: unknown,
  count: number,
  fallbackQuestions: Question[]
): Question[] => {
  if (!Array.isArray(rawQuestions)) {
    return fallbackQuestions;
  }

  const normalized = rawQuestions
    .slice(0, count)
    .map((item, index): Question | null => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const question = item as Partial<Question>;
      const options = Array.isArray(question.options)
        ? question.options.map((option) => String(option)).slice(0, 4)
        : [];
      const correctAnswer = Number(question.correctAnswer);
      const difficulty = question.difficulty === 'easy' || question.difficulty === 'medium' || question.difficulty === 'hard'
        ? question.difficulty
        : index < 3
        ? 'easy'
        : index < 7
        ? 'medium'
        : 'hard';

      if (!question.question || options.length !== 4 || Number.isNaN(correctAnswer) || correctAnswer < 0 || correctAnswer > 3) {
        return null;
      }

      return {
        id: question.id || `q${index + 1}`,
        question: String(question.question),
        options,
        correctAnswer,
        difficulty,
        explanation: question.explanation ? String(question.explanation) : 'The correct option best matches the reasoning pattern in the question.',
        timeLimit: Math.max(30, Number(question.timeLimit) || 60),
      };
    })
    .filter((question): question is Question => Boolean(question));

  return normalized.length === count ? normalized : fallbackQuestions;
};

const normalizeQuestionIds = (questions: Question[], startIndex: number) =>
  questions.map((question, index) => ({
    ...question,
    id: `q${startIndex + index + 1}`,
  }));

const getTargetDifficulty = (index: number, totalCount: number): Question['difficulty'] => {
  if (index < Math.max(3, Math.ceil(totalCount * 0.3))) {
    return 'easy';
  }

  if (index < Math.max(7, Math.ceil(totalCount * 0.7))) {
    return 'medium';
  }

  return 'hard';
};

const buildBatchDifficultyGuide = (
  startIndex: number,
  batchCount: number,
  totalCount: number
) =>
  Array.from({ length: batchCount }, (_, index) => {
    const questionNumber = startIndex + index + 1;
    return `q${questionNumber}: ${getTargetDifficulty(startIndex + index, totalCount)}`;
  }).join(', ');

const getFallbackQuestions = (profile: StudentProfile, count: number, mode: QuestionMode): Question[] => {
  const ageLabel = profile.age || estimateAgeFromClass(profile.classLevel);
  const deliveryHint = mode === 'voice'
    ? 'Listen carefully and answer by saying the option letter.'
    : 'Read carefully and choose the best option.';

  const templates: Question[] = [
    {
      id: 'q1',
      question: `A ${ageLabel}-year-old student in class ${profile.classLevel} is arranging books from thinnest to thickest. Which skill is mainly being used?`,
      options: ['Pattern matching', 'Ordering by size', 'Guessing randomly', 'Remembering a story'],
      correctAnswer: 1,
      difficulty: 'easy',
      explanation: 'The student is comparing the books and placing them in a logical order by size.',
      timeLimit: 60,
    },
    {
      id: 'q2',
      question: `What comes next in the pattern: 3, 6, 9, 12, ? ${deliveryHint}`,
      options: ['13', '14', '15', '16'],
      correctAnswer: 2,
      difficulty: 'easy',
      explanation: 'The pattern increases by 3 each time, so 12 becomes 15.',
      timeLimit: 45,
    },
    {
      id: 'q3',
      question: 'If all squares are shapes and all shapes have sides, what must be true?',
      options: ['All squares have sides', 'All shapes are squares', 'Some squares have no sides', 'Only circles have sides'],
      correctAnswer: 0,
      difficulty: 'medium',
      explanation: 'If squares are shapes and shapes have sides, then squares must also have sides.',
      timeLimit: 60,
    },
    {
      id: 'q4',
      question: 'Which number should replace the question mark: 5, 10, 20, 40, ?',
      options: ['45', '60', '70', '80'],
      correctAnswer: 3,
      difficulty: 'medium',
      explanation: 'Each number doubles, so 40 becomes 80.',
      timeLimit: 60,
    },
    {
      id: 'q5',
      question: 'Which word does not belong with the others?',
      options: ['Triangle', 'Rectangle', 'Circle', 'Square'],
      correctAnswer: 2,
      difficulty: 'easy',
      explanation: 'A circle is the only shape without sides or corners.',
      timeLimit: 45,
    },
    {
      id: 'q6',
      question: 'A class monitor needs 2 minutes to label 1 notebook. How long will it take to label 6 notebooks at the same speed?',
      options: ['8 minutes', '10 minutes', '12 minutes', '14 minutes'],
      correctAnswer: 2,
      difficulty: 'medium',
      explanation: 'If each notebook takes 2 minutes, then 6 notebooks take 12 minutes.',
      timeLimit: 60,
    },
    {
      id: 'q7',
      question: 'Which letter comes next: A, C, E, G, ?',
      options: ['H', 'I', 'J', 'K'],
      correctAnswer: 1,
      difficulty: 'medium',
      explanation: 'The pattern skips one letter each time, so the next letter is I.',
      timeLimit: 45,
    },
    {
      id: 'q8',
      question: 'If some pencils are blue and all blue things are bright, what can be true?',
      options: ['All pencils are bright', 'Some pencils are bright', 'No pencils are bright', 'Blue things are never bright'],
      correctAnswer: 1,
      difficulty: 'hard',
      explanation: 'Because some pencils are blue and all blue things are bright, some pencils are bright.',
      timeLimit: 60,
    },
    {
      id: 'q9',
      question: 'What is the missing number: 1, 4, 9, 16, ?',
      options: ['20', '24', '25', '36'],
      correctAnswer: 2,
      difficulty: 'hard',
      explanation: 'These are square numbers: 1, 2 squared, 3 squared, 4 squared, so the next is 5 squared, which is 25.',
      timeLimit: 60,
    },
    {
      id: 'q10',
      question: mode === 'voice'
        ? 'Listen to the four options and choose the one that best completes the analogy: Bird is to nest as bee is to what?'
        : 'Complete the analogy: Bird is to nest as bee is to what?',
      options: ['Leaf', 'Hive', 'Tree', 'Garden'],
      correctAnswer: 1,
      difficulty: 'easy',
      explanation: 'A bird lives in a nest and a bee lives in a hive.',
      timeLimit: 45,
    },
  ];

  return templates.slice(0, count).map((question, index) => ({
    ...question,
    id: `q${index + 1}`,
  }));
};

const summarizeSessions = (allSessions: TestSession[]) =>
  allSessions.map((session, index) => {
    const totalCount = session.results?.length || 0;
    const correctCount = session.results?.filter((result) => result.isCorrect).length || 0;
    const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
    const avgReaction = totalCount > 0
      ? Math.round(session.results.reduce((sum, result) => sum + result.reactionTime, 0) / totalCount)
      : 0;

    return {
      sessionNumber: index + 1,
      testType: session.testType,
      studentClass: session.studentClass,
      studentAge: session.studentAge,
      accuracy,
      correctCount,
      totalCount,
      avgReaction,
      gameScores: session.gameScores || null,
      questions: (session.questions || []).map((question) => ({
        question: question.question,
        difficulty: question.difficulty,
        answeredCorrectly: session.results?.find((result) => result.questionId === question.id)?.isCorrect ?? false,
      })),
    };
  });

const getErrorMessage = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data;

    if (typeof responseData === 'string') {
      return responseData;
    }

    if (responseData && typeof responseData === 'object') {
      const data = responseData as Record<string, unknown>;

      if (typeof data.error === 'string') {
        return data.error;
      }

      if (data.error && typeof data.error === 'object') {
        const nested = data.error as Record<string, unknown>;
        if (typeof nested.message === 'string') {
          return nested.message;
        }
      }

      if (typeof data.message === 'string') {
        return data.message;
      }

      try {
        return JSON.stringify(responseData);
      } catch {
        return error.message;
      }
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
};

const getAffordableTokenBudget = (error: unknown) => {
  const message = getErrorMessage(error);
  const match = message.match(/can only afford (\d+)/i);

  if (!match) {
    return null;
  }

  const affordable = Number(match[1]);

  if (Number.isNaN(affordable)) {
    return null;
  }

  return affordable;
};

async function callOpenRouter(
  messages: Message[],
  model: string,
  maxTokens: number,
  temperature: number
): Promise<string> {
  const response = await axios.post<{ content?: string; error?: string }>(
    '/api/openrouter',
    {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }
  );

  if (response.data.error) {
    throw new Error(response.data.error);
  }

  const content = response.data.content?.trim();

  if (!content) {
    throw new Error('The OpenRouter proxy returned an empty response.');
  }

  return content;
}

async function callOpenRouterWithBudgetFallback(
  messages: Message[],
  model: string,
  maxTokens: number,
  temperature: number,
  minimumTokens: number = MIN_OPENROUTER_TOKENS
): Promise<string> {
  try {
    return await callOpenRouter(messages, model, maxTokens, temperature);
  } catch (error: unknown) {
    const affordableBudget = getAffordableTokenBudget(error);

    if (affordableBudget === null) {
      throw error;
    }

    const retryBudget = Math.max(
      minimumTokens,
      Math.min(maxTokens - 40, affordableBudget - 20)
    );

    if (retryBudget >= maxTokens) {
      throw error;
    }

    return callOpenRouter(messages, model, retryBudget, temperature);
  }
}

async function repairQuestionJson(
  rawContent: string,
  count: number,
  mode: QuestionMode,
  startIndex: number = 0
): Promise<unknown> {
  const expectedShape = count === 1 ? 'JSON object' : 'JSON array';
  const repairMessages: Message[] = [
    {
      role: 'system',
      content:
        `You are a JSON repair agent. Convert malformed question output into strictly valid ${expectedShape}. Return only JSON and do not add explanations, markdown, or comments.`,
    },
    {
      role: 'user',
      content: `Repair this malformed ${mode} IQ question JSON into valid ${expectedShape} output.

Rules:
- Return only valid JSON.
- Preserve the intended meaning of each question.
- ${count === 1
    ? `The object must contain: id, question, options, correctAnswer, difficulty, explanation, timeLimit.`
    : `Each item must contain: id, question, options, correctAnswer, difficulty, explanation, timeLimit.`}
- Use sequential ids from q${startIndex + 1} to q${startIndex + count}.
- Ensure options has exactly 4 string values.
- Ensure correctAnswer is a zero-based integer.

Malformed content:
${rawContent}`,
    },
  ];
  const repairedContent = await callOpenRouterWithBudgetFallback(
    repairMessages,
    IQ_MODEL,
    QUESTION_REPAIR_MAX_TOKENS,
    0.1
  );

  return parseQuestionArrayPayload(repairedContent);
}

async function generateQuestionBatch(
  profile: StudentProfile,
  batchCount: number,
  mode: QuestionMode,
  startIndex: number,
  totalCount: number
): Promise<Question[]> {
  const fallbackBatch = normalizeQuestionIds(
    getFallbackQuestions(profile, totalCount, mode).slice(startIndex, startIndex + batchCount),
    startIndex
  );
  const systemPrompt = mode === 'voice'
    ? `You are an Oral IQ Test Agent. Create spoken-question IQ items for a student aged ${profile.age} in class ${profile.classLevel}. Questions must be easy to read aloud, concise, and answerable by saying option A, B, C, or D.`
    : `You are a Written IQ Test Agent. Create age-appropriate IQ questions for a student aged ${profile.age} in class ${profile.classLevel}. Questions should test logic, patterns, reasoning, and verbal intelligence without being too advanced for the student's age.`;
  const difficultyGuide = buildBatchDifficultyGuide(startIndex, batchCount, totalCount);
  const responseShape = batchCount === 1 ? 'object' : 'array';
  const userPrompt = `Generate ${batchCount} ${mode === 'voice' ? 'oral' : 'written'} IQ questions for this student.
Age: ${profile.age}
Class: ${profile.classLevel}
Student name: ${profile.studentName || 'Student'}
Question ids: q${startIndex + 1} to q${startIndex + batchCount}
Target difficulties: ${difficultyGuide}

Return ONLY a valid JSON ${responseShape}.
${batchCount === 1
    ? `Use exactly this object shape:
{"id":"q${startIndex + 1}","question":"...","options":["A","B","C","D"],"correctAnswer":0,"difficulty":"${getTargetDifficulty(startIndex, totalCount)}","explanation":"...","timeLimit":60}`
    : `Use exactly this array item shape:
[{"id":"q${startIndex + 1}","question":"...","options":["A","B","C","D"],"correctAnswer":0,"difficulty":"easy","explanation":"...","timeLimit":60}]`}

Rules:
- Use exactly 4 options per question.
- Keep wording age-appropriate and concise.
- ${mode === 'voice' ? 'Avoid symbols and long option text that are hard to speak aloud.' : 'Keep wording crisp and readable.'}
- Make sure correctAnswer is a zero-based index.
- Do not include markdown, commentary, or headings.`;
  const generationMessages: Message[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  try {
    const content = await callOpenRouterWithBudgetFallback(
      generationMessages,
      IQ_MODEL,
      QUESTION_GENERATION_MAX_TOKENS,
      0.25
    );

    let parsed: unknown;

    try {
      parsed = parseQuestionArrayPayload(content);
    } catch {
      parsed = await repairQuestionJson(content, batchCount, mode, startIndex);
    }

    return normalizeQuestionIds(
      sanitizeQuestions(parsed, batchCount, fallbackBatch),
      startIndex
    );
  } catch (error: unknown) {
    console.error(
      `Error generating ${mode} IQ question batch ${startIndex + 1}-${startIndex + batchCount}, using fallback:`,
      getErrorMessage(error)
    );
    return fallbackBatch;
  }
}

async function generateQuestionsWithAgent(
  profile: StudentProfile,
  count: number,
  mode: QuestionMode
): Promise<Question[]> {
  const allQuestions: Question[] = [];

  for (let startIndex = 0; startIndex < count; startIndex += QUESTION_BATCH_SIZE) {
    const batchCount = Math.min(QUESTION_BATCH_SIZE, count - startIndex);
    const batchQuestions = await generateQuestionBatch(
      profile,
      batchCount,
      mode,
      startIndex,
      count
    );
    allQuestions.push(...batchQuestions);
  }

  return allQuestions.slice(0, count);
}

export async function generateAdaptiveTextIQQuestions(
  profile: StudentProfile,
  count: number = 10
): Promise<Question[]> {
  const normalizedProfile = {
    ...profile,
    age: profile.age || estimateAgeFromClass(profile.classLevel),
  };

  return generateQuestionsWithAgent(normalizedProfile, count, 'text');
}

export async function generateAdaptiveVoiceIQQuestions(
  profile: StudentProfile,
  count: number = 10
): Promise<Question[]> {
  const normalizedProfile = {
    ...profile,
    age: profile.age || estimateAgeFromClass(profile.classLevel),
  };

  return generateQuestionsWithAgent(normalizedProfile, count, 'voice');
}

export async function generateIQQuestions(
  classLevel: number,
  questionType: 'logical' | 'mathematical' | 'spatial' | 'verbal',
  count: number = 5
): Promise<Question[]> {
  void questionType;
  return generateAdaptiveTextIQQuestions(
    { age: estimateAgeFromClass(classLevel), classLevel },
    count
  );
}

export async function generateTTS(text: string): Promise<string> {
  try {
    return await callOpenRouter(
      [
        {
          role: 'user',
          content: `Convert this text into a speech-ready script without changing the meaning. Text: ${text}`,
        },
      ],
      TTS_MODEL,
      600,
      0.3
    );
  } catch (error) {
    console.error('Error generating TTS:', error);
    throw error;
  }
}

export async function analyzePerformance(
  answers: TestResult[],
  reactionTimes: number[],
  classLevel: number,
  studentAge: number = 0,
  testType: 'text' | 'voice' | 'game' = 'text'
): Promise<string> {
  const correctCount = answers.filter((answer) => answer.isCorrect).length;
  const totalCount = answers.length;
  const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
  const avgReaction = reactionTimes.length > 0
    ? Math.round(reactionTimes.reduce((sum, time) => sum + time, 0) / reactionTimes.length)
    : 0;

  try {
    return await callOpenRouter(
      [
        {
          role: 'system',
          content: 'You are a Student Performance Analysis Agent for an IQ assessment platform. Provide concise, supportive, and evidence-based feedback.',
        },
        {
          role: 'user',
          content: `Analyze this ${testType} IQ test performance:
Class Level: ${classLevel}
Student Age: ${studentAge || estimateAgeFromClass(classLevel)}
Correct Answers: ${correctCount}
Total Questions: ${totalCount}
Accuracy: ${accuracy}%
Average Reaction Time: ${avgReaction}ms

Write a clear analysis with:
1. Estimated reasoning band
2. Cognitive strengths
3. Areas to improve
4. Practical next steps

Keep the answer readable for a student and parent. Avoid overclaiming medical or clinical certainty.`,
        },
      ],
      REPORT_MODEL,
      1200,
      0.6
    );
  } catch (error: unknown) {
    console.error('Error analyzing performance:', getErrorMessage(error));

    return `Performance Summary

The student answered ${correctCount} out of ${totalCount} questions correctly, which is ${accuracy}% accuracy for a class ${classLevel} learner.

Average reaction time was ${avgReaction}ms. ${avgReaction > 0 && avgReaction <= 5000 ? 'This suggests quick processing on most questions.' : 'This suggests the student spent more time thinking through each answer.'}

Strengths:
- ${accuracy >= 80 ? 'Strong reasoning and pattern recognition' : accuracy >= 60 ? 'A solid base in logical thinking' : 'Emerging reasoning ability that can improve with guided practice'}
- ${avgReaction > 0 && avgReaction <= 5000 ? 'Good decision speed' : 'Careful and deliberate thinking'}

Recommendations:
- Practice 10 to 15 minutes of logic and pattern questions daily
- Review incorrect answers to learn the reasoning method
- Focus on ${accuracy < 60 ? 'basic sequencing, analogies, and elimination strategies' : 'harder multi-step reasoning questions to build confidence'}`;
  }
}

export async function generateSessionStorageReport(
  allSessions: TestSession[],
  studentClass: number,
  studentName: string,
  studentAge: number = 0
): Promise<string> {
  if (allSessions.length === 0) {
    return 'No test sessions found. Complete at least one test to generate a session report.';
  }

  const sessionSummaries = summarizeSessions(allSessions);
  const totalSessions = allSessions.length;
  const overallAccuracy = Math.round(
    sessionSummaries.reduce((sum, session) => sum + session.accuracy, 0) / totalSessions
  );
  const averageReactionTime = Math.round(
    sessionSummaries.reduce((sum, session) => sum + session.avgReaction, 0) / totalSessions
  );

  try {
    return await callOpenRouter(
      [
        {
          role: 'system',
          content: 'You are a Session Report Agent. You review IQ test sessions saved in browser session storage and generate a polished student report for the UI.',
        },
        {
          role: 'user',
          content: `Create a complete IQ assessment report for this student:
Name: ${studentName || 'Student'}
Class: ${studentClass}
Age: ${studentAge || estimateAgeFromClass(studentClass)}
Total Sessions: ${totalSessions}

Session storage data:
${JSON.stringify(sessionSummaries, null, 2)}

Generate a report with these sections:
1. Overall Assessment
2. Session-by-Session Trend
3. Strengths
4. Improvement Areas
5. Learning Style Signals
6. Recommended Practice Plan

Keep the report professional, easy to read, and grounded only in the provided data.`,
        },
      ],
      REPORT_MODEL,
      2200,
      0.65
    );
  } catch (error: unknown) {
    console.error('Error generating session report:', getErrorMessage(error));

    return `COMPREHENSIVE IQ ASSESSMENT REPORT
For: ${studentName || 'Student'} | Class ${studentClass} | Age ${studentAge || estimateAgeFromClass(studentClass)}
Total Sessions Completed: ${totalSessions}

OVERALL ASSESSMENT
Average Accuracy: ${overallAccuracy}%
Average Reaction Time: ${averageReactionTime}ms
Estimated Reasoning Band: ${overallAccuracy >= 80 ? 'Above Average' : overallAccuracy >= 60 ? 'Average to Strong Developing' : 'Developing'}

SESSION-BY-SESSION TREND
${sessionSummaries
  .map(
    (session) =>
      `Session ${session.sessionNumber} (${session.testType}): ${session.correctCount}/${session.totalCount} correct, ${session.accuracy}% accuracy, ${session.avgReaction}ms average reaction`
  )
  .join('\n')}

STRENGTHS
- ${overallAccuracy >= 75 ? 'Consistent logical performance across sessions' : 'Willingness to engage with multiple test formats'}
- ${averageReactionTime > 0 && averageReactionTime <= 5000 ? 'Quick information processing' : 'Careful and reflective decision-making'}

IMPROVEMENT AREAS
- ${overallAccuracy < 70 ? 'Build stronger foundations in patterns, analogies, and elimination strategy' : 'Push into more advanced multi-step reasoning tasks'}
- ${averageReactionTime > 6000 ? 'Practice timed exercises to improve confidence and speed' : 'Slow down slightly on harder items to avoid avoidable mistakes'}

LEARNING STYLE SIGNALS
- ${sessionSummaries.some((session) => session.testType === 'voice') ? 'The student has experience with oral question delivery.' : 'The student has mainly worked with non-oral formats so far.'}
- ${sessionSummaries.some((session) => session.testType === 'game') ? 'Game sessions provide extra evidence about speed and attention.' : 'Adding game sessions could provide more attention and reaction-time evidence.'}

RECOMMENDED PRACTICE PLAN
- Practice 3 to 4 times per week in short sessions
- Review incorrect answers after each attempt
- Mix text, voice, and game sessions for a more balanced profile
- Track whether accuracy improves before pushing for faster speed`;
  }
}

export async function generateComprehensiveReport(
  allSessions: TestSession[],
  studentClass: number,
  studentName: string,
  studentAge: number = 0
): Promise<string> {
  return generateSessionStorageReport(allSessions, studentClass, studentName, studentAge);
}
