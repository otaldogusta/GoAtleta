import { MAX_AUDIO_BYTES, readAudioForm, validateAudio } from "./audio-input.ts";
function assert(value: unknown) { if (!value) throw new Error("Assertion failed"); }
Deno.test("accepts supported recordings and rejects empty, oversized or non-audio payloads", () => {
  assert(validateAudio(new File(["audio"], "recording.webm", { type: "audio/webm;codecs=opus" })));
  assert(!validateAudio(new File([], "empty.webm", { type: "audio/webm" })));
  assert(!validateAudio(new File(["text"], "fake.webm", { type: "text/plain" })));
  assert(!validateAudio(new File([new Uint8Array(MAX_AUDIO_BYTES + 1)], "big.webm", { type: "audio/webm" })));
});
Deno.test("reads multipart form without persisting audio", async () => {
  const form = new FormData(); form.append("file", new File(["sample"], "audio.m4a", { type: "audio/mp4" }));
  form.append("classId", "class-a");
  const result = await readAudioForm(new Request("http://localhost", { method: "POST", body: form }));
  assert(result.get("classId") === "class-a"); assert(validateAudio(result.get("file")));
});
Deno.test("enforces streamed size even without a Content-Length header", async () => {
  let cancelled = false;
  const body = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(MAX_AUDIO_BYTES)); }, cancel() { cancelled = true; } });
  let rejected = false;
  try { await readAudioForm(new Request("http://localhost", { method: "POST", body })); }
  catch { rejected = true; }
  assert(rejected && cancelled);
});
