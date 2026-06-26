import { NextRequest, NextResponse } from "next/server";

const ASR_API_URL =
  process.env.ASR_API_URL ||
  process.env.NEXT_PUBLIC_ASR_API_URL ||
  "https://dexschool.dexlabsai.in/v1/english-asr";

export async function POST(request: NextRequest) {
  const input = await request.formData();
  const file = input.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing audio file." }, { status: 400 });
  }

  // Re-build the multipart body. We intentionally do NOT set Content-Type
  // ourselves — fetch adds the correct multipart boundary for FormData.
  const formData = new FormData();
  formData.append("file", file, file.name || "student-answer.webm");

  try {
    const response = await fetch(ASR_API_URL, {
      method: "POST",
      headers: { accept: "application/json" },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ASR API error:", response.status, errorText);
      return NextResponse.json(
        { error: "ASR API failed.", status: response.status, details: errorText },
        { status: response.status }
      );
    }

    const payload = await response.json();

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("ASR request failed:", error);
    return NextResponse.json(
      {
        error: "ASR service unavailable.",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    );
  }
}
