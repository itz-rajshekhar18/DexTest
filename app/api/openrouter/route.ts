import axios from 'axios';
import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

interface RouteMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface OpenRouterResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
    code?: string | number;
  };
}

const extractApiErrorMessage = (payload: unknown): string => {
  if (typeof payload === 'string') {
    return payload;
  }

  if (!payload || typeof payload !== 'object') {
    return 'Unknown OpenRouter error';
  }

  const record = payload as Record<string, unknown>;
  const nestedError = record.error;

  if (typeof nestedError === 'string') {
    return nestedError;
  }

  if (nestedError && typeof nestedError === 'object') {
    const nestedRecord = nestedError as Record<string, unknown>;
    if (typeof nestedRecord.message === 'string') {
      return nestedRecord.message;
    }
  }

  if (typeof record.message === 'string') {
    return record.message;
  }

  try {
    return JSON.stringify(payload);
  } catch {
    return 'Unknown OpenRouter error';
  }
};

const stripQuotes = (value: string) => {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
};

const readEnvValueFromFile = (filePath: string, key: string) => {
  if (!fs.existsSync(filePath)) {
    return '';
  }

  const fileContent = fs.readFileSync(filePath, 'utf8');
  const lines = fileContent.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const envKey = trimmed.slice(0, separatorIndex).trim();
    const envValue = trimmed.slice(separatorIndex + 1);

    if (envKey === key) {
      return stripQuotes(envValue);
    }
  }

  return '';
};

const getRuntimeEnvValue = (keys: string[]) => {
  for (const key of keys) {
    const fromProcess = process.env[key];
    if (fromProcess) {
      return fromProcess;
    }
  }

  const envFiles = ['.env.local', '.env', '.env.example'].map((fileName) =>
    path.join(process.cwd(), fileName)
  );

  for (const filePath of envFiles) {
    for (const key of keys) {
      const value = readEnvValueFromFile(filePath, key);
      if (value) {
        return value;
      }
    }
  }

  return '';
};

export async function POST(request: Request) {
  try {
    const openRouterApiKey = getRuntimeEnvValue([
      'OPENROUTER_API_KEY',
      'NEXT_PUBLIC_OPENROUTER_API_KEY',
    ]);

    if (!openRouterApiKey) {
      return NextResponse.json(
        {
          error:
            'Missing OpenRouter API key on the server. Add OPENROUTER_API_KEY to .env.local or .env.example.',
        },
        { status: 500 }
      );
    }

    const body = (await request.json()) as {
      model?: string;
      messages?: RouteMessage[];
      temperature?: number;
      max_tokens?: number;
    };

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json(
        { error: 'Invalid OpenRouter request payload.' },
        { status: 400 }
      );
    }

    // When the caller doesn't specify a model, use the same model as question
    // generation (QUESTION_MODEL in .env.local) so reports stay in sync.
    const model =
      body.model ||
      getRuntimeEnvValue(['QUESTION_MODEL', 'NEXT_PUBLIC_QUESTION_MODEL']) ||
      'qwen/qwen3.5-9b';

    const response = await axios.post<OpenRouterResponse>(
      OPENROUTER_API_URL,
      {
        model,
        messages: body.messages,
        temperature: body.temperature ?? 0.7,
        max_tokens: body.max_tokens ?? 1200,
      },
      {
        headers: {
          Authorization: `Bearer ${openRouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://dextest.app',
          'X-Title': 'IQ Test Platform',
        },
      }
    );

    if (response.data.error?.message) {
      return NextResponse.json(
        { error: response.data.error.message },
        { status: 502 }
      );
    }

    const content = response.data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return NextResponse.json(
        { error: 'OpenRouter returned no content for this request.' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      content,
    });
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      return NextResponse.json(
        {
          error: extractApiErrorMessage(error.response?.data) || error.message,
        },
        { status: error.response?.status || 500 }
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown server error',
      },
      { status: 500 }
    );
  }
}
