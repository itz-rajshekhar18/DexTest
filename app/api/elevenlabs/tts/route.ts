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

  const body = await request.json();
  const text = String(body.text || "").trim();
  const voiceId =
    body.voiceId ||
    process.env.ELEVENLABS_VOICE_ID ||
    process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID ||
    "JBFqnCBsd6RMkjVDRZzb";
  const modelId =
    body.modelId ||
    process.env.ELEVENLABS_TTS_MODEL ||
    process.env.NEXT_PUBLIC_ELEVENLABS_TTS_MODEL ||
    "eleven_multilingual_v2";

  if (!text) {
    return NextResponse.json({ error: "Missing TTS text." }, { status: 400 });
  }

  const response = await fetch(
    `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}/stream?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": configuredApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.48,
          similarity_boost: 0.76,
          style: 0.18,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!response.ok || !response.body) {
    const details = response.body ? await response.text() : "No audio stream.";
    return NextResponse.json(
      { error: "Voice synthesis failed.", details },
      { status: response.ok ? 502 : response.status }
    );
  }

  // Pipe the upstream audio straight through so playback can start while the
  // rest of the clip is still being generated.
  return new NextResponse(response.body, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
