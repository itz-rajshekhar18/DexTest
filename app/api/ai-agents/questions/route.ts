import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NextResponse } from 'next/server';

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

type PythonCandidate = {
  command: string;
  args: string[];
};

const getPythonCandidates = (): PythonCandidate[] => {
  const configuredPython =
    process.env.IQ_AGENT_PYTHON_PATH ||
    process.env.PDF_PYTHON_PATH ||
    process.env.PYTHON ||
    process.env.PYTHON_PATH;
  const homeDir = os.homedir();
  const codexBundled = path.join(
    process.env.USERPROFILE || homeDir,
    '.cache',
    'codex-runtimes',
    'codex-primary-runtime',
    'dependencies',
    'python',
    'python.exe'
  );

  return [
    ...(configuredPython ? [{ command: configuredPython, args: [] }] : []),
    ...(existsSync(codexBundled) ? [{ command: codexBundled, args: [] }] : []),
    { command: 'python3', args: [] },
    { command: 'python', args: [] },
    { command: 'py', args: ['-3'] },
  ];
};

const runCandidate = (candidate: PythonCandidate, scriptPath: string, payload: string) =>
  new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(candidate.command, [...candidate.args, scriptPath], {
      cwd: process.cwd(),
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    const timeout = windowlessTimeout(() => {
      child.kill();
      reject(new Error('Python IQ agent timed out.'));
    }, 60_000);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(new Error(stderr.trim() || `Python IQ agent exited with code ${code}.`));
    });

    child.stdin.write(payload);
    child.stdin.end();
  });

const runPythonQuestionAgent = async (scriptPath: string, payload: string) => {
  let lastError = 'No Python interpreter available for the IQ agent.';

  for (const candidate of getPythonCandidates()) {
    try {
      return await runCandidate(candidate, scriptPath, payload);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  throw new Error(lastError);
};

const windowlessTimeout = (callback: () => void, timeoutMs: number) =>
  setTimeout(callback, timeoutMs);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as QuestionAgentRequest;
    const mode = isQuestionAgentMode(body.mode) ? body.mode : 'written';
    const count = Math.max(1, Math.min(Number(body.count || 10), 20));
    const classLevel = Math.max(1, Math.min(Number(body.classLevel || 10), 12));
    const studentGender = String(body.studentGender || '').trim();
    const previousQuestions = Array.isArray(body.previousQuestions)
      ? body.previousQuestions.filter((question): question is string => typeof question === 'string')
      : [];
    const uniquenessSeed =
      body.uniquenessSeed || `${mode}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const scriptPath = path.join(process.cwd(), 'agents', 'iq_question_agents.py');
    if (!existsSync(scriptPath)) {
      return NextResponse.json(
        { error: `Python IQ agent script not found at ${scriptPath}.` },
        { status: 500 }
      );
    }
    const payload = JSON.stringify({
      mode,
      classLevel,
      studentGender,
      count,
      previousQuestions,
      uniquenessSeed,
    });

    const { stdout, stderr } = await runPythonQuestionAgent(scriptPath, payload);

    const stderrText = stderr.trim();

    if (stderrText) {
      try {
        const parsedError = JSON.parse(stderrText) as { error?: string; warning?: string };
        if (parsedError.error) {
          return NextResponse.json({ error: parsedError.error }, { status: 502 });
        }
      } catch {
        return NextResponse.json({ error: stderrText }, { status: 502 });
      }
    }

    const parsed = JSON.parse(stdout) as { questions?: unknown };
    if (!Array.isArray(parsed.questions)) {
      return NextResponse.json(
        { error: 'Python IQ agent returned no questions.' },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        mode,
        questions: parsed.questions,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown Python IQ agent error.',
      },
      { status: 500 }
    );
  }
}
