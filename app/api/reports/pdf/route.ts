import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type PdfReportRequest = {
  studentName?: string;
  studentClass?: number | string;
  iqScore?: number;
  score?: number;
  avgReactionTime?: number;
  attentionScore?: number;
  analysis?: string;
  comprehensiveReport?: string;
  sessions?: Array<unknown>;
  scholarship?: {
    textScore?: number;
    voiceScore?: number;
    gameScore?: number;
    totalPercentage?: number;
    eligible?: boolean;
  };
};

type PythonCandidate = {
  command: string;
  args: string[];
};

function getPythonCandidates(scriptPath: string): PythonCandidate[] {
  const envPath = process.env.PDF_PYTHON_PATH;
  const codexBundled = path.join(
    process.env.USERPROFILE || "",
    ".cache",
    "codex-runtimes",
    "codex-primary-runtime",
    "dependencies",
    "python",
    "python.exe"
  );

  return [
    ...(envPath ? [{ command: envPath, args: [scriptPath] }] : []),
    ...(existsSync(codexBundled) ? [{ command: codexBundled, args: [scriptPath] }] : []),
    { command: "python", args: [scriptPath] },
    { command: "python3", args: [scriptPath] },
    { command: "py", args: ["-3", scriptPath] },
  ];
}

function runPdfGenerator(payload: PdfReportRequest) {
  const scriptPath = path.join(process.cwd(), "lib", "pdf_report_generator.py");
  const candidates = getPythonCandidates(scriptPath);
  let lastError = "";

  for (const candidate of candidates) {
    const result = spawnSync(candidate.command, candidate.args, {
      input: JSON.stringify(payload),
      encoding: "buffer",
      maxBuffer: 20 * 1024 * 1024,
    });

    if (result.error) {
      lastError = result.error.message;
      continue;
    }

    if (result.status === 0 && result.stdout?.length) {
      return result.stdout;
    }

    lastError = result.stderr?.toString("utf8").trim() || `Python exited with code ${result.status}`;
  }

  throw new Error(lastError || "Unable to generate PDF report.");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PdfReportRequest;
    const pdf = runPdfGenerator(body);

    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="dextest-report.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to generate PDF report.",
      },
      { status: 500 }
    );
  }
}
