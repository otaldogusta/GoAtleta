export const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const audioTypes = new Set(["audio/webm", "video/webm", "audio/mp4", "video/mp4", "audio/m4a", "audio/x-m4a", "audio/mpeg", "audio/wav", "audio/x-wav"]);

export function validateAudio(file: unknown): file is File {
  return file instanceof File && file.size > 0 && file.size <= MAX_AUDIO_BYTES &&
    audioTypes.has(file.type.split(";")[0]);
}

export async function readAudioForm(req: Request): Promise<FormData> {
  const reader = req.body?.getReader();
  if (!reader) throw new Error("EMPTY_AUDIO");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_AUDIO_BYTES + 16_384) {
        await reader.cancel();
        throw new Error("AUDIO_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new Response(bytes, { headers: { "Content-Type": req.headers.get("Content-Type") ?? "" } }).formData();
}
