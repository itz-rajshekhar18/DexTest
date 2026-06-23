import { NextRequest, NextResponse } from "next/server";

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1";

function hasConfiguredKey(apiKey?: string) {
  return Boolean(apiKey && !apiKey.toLowerCase().includes("your_elevenlabs"));
}

export async function POST(request: NextRequest) {
  const apiKey =
    process.env.ELEVENLABS_API_KEY || process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;

  if (!hasConfiguredKey(apiKey)) {
    return NextResponse.json(
      { error: "ElevenLabs API key is not configured." },
      { status: 503 }
    );
  }
  const configuredApiKey = apiKey as string;

  const input = await request.formData();
  const file = input.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing audio file." }, { status: 400 });
  }

  const modelId =
    process.env.ELEVENLABS_STT_MODEL ||
    process.env.NEXT_PUBLIC_ELEVENLABS_STT_MODEL ||
    "scribe_v2";

  const formData = new FormData();
  formData.append("file", file, file.name || "student-answer.webm");
  formData.append("model_id", modelId);
  formData.append("language_code", "en");
  formData.append("timestamps_granularity", "word");
  formData.append("diarize", "true");
  formData.append("num_speakers", "1");
  formData.append("tag_audio_events", "false");
  formData.append("no_verbatim", "true");
  formData.append("keyterms", "option");
  formData.append("keyterms", "answer");
  formData.append("keyterms", "A");
  formData.append("keyterms", "B");
  formData.append("keyterms", "C");
  formData.append("keyterms", "D");

  const response = await fetch(`${ELEVENLABS_API_URL}/speech-to-text`, {
    method: "POST",
    headers: {
      "xi-api-key": configuredApiKey,
    },
    body: formData,
  });

  const payload = await response.json();

  if (!response.ok) {
    return NextResponse.json(
      { error: "ElevenLabs STT failed.", details: payload },
      { status: response.status }
    );
  }

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
