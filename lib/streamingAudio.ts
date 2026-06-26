// Plays an MP3 response while it is still streaming in (via Media Source
// Extensions) and resolves with the full Blob so it can be cached.
// Falls back to buffering the whole response where MSE/audio-mpeg is missing.

const MIME = "audio/mpeg";

export async function playStreamingMp3(
  response: Response,
  audio: HTMLAudioElement
): Promise<Blob> {
  const body = response.body;
  const supportsMse =
    typeof MediaSource !== "undefined" && MediaSource.isTypeSupported(MIME);

  // Fallback: buffer the whole clip, then play.
  if (!body || !supportsMse) {
    const blob = await response.blob();
    audio.src = URL.createObjectURL(blob);
    await audio.play().catch(() => {});
    return blob;
  }

  const mediaSource = new MediaSource();
  audio.src = URL.createObjectURL(mediaSource);

  const chunks: BlobPart[] = [];

  await new Promise<void>((resolve, reject) => {
    mediaSource.addEventListener(
      "sourceopen",
      async () => {
        try {
          const sourceBuffer = mediaSource.addSourceBuffer(MIME);
          const reader = body.getReader();

          const append = (chunk: ArrayBuffer) =>
            new Promise<void>((res) => {
              sourceBuffer.addEventListener("updateend", () => res(), {
                once: true,
              });
              sourceBuffer.appendBuffer(chunk);
            });

          let started = false;
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!value) continue;
            // Copy into a plain ArrayBuffer (decouples from the reader's buffer).
            const buffer = value.buffer.slice(
              value.byteOffset,
              value.byteOffset + value.byteLength
            ) as ArrayBuffer;
            chunks.push(buffer);
            await append(buffer);
            if (!started) {
              started = true;
              audio.play().catch(() => {});
            }
          }

          if (mediaSource.readyState === "open") {
            mediaSource.endOfStream();
          }
          resolve();
        } catch (error) {
          reject(error);
        }
      },
      { once: true }
    );
  });

  return new Blob(chunks, { type: MIME });
}
