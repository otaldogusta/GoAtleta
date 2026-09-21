import { partialReply, readProviderStream, streamAssistantResponse } from "../response-stream";
import { TextEncoder, TextDecoder } from "util";
import { ReadableStream } from "stream/web";
Object.assign(global, { TextEncoder, TextDecoder, ReadableStream });
const stream = (chunks: string[]) => new ReadableStream({ start(c) { chunks.forEach(x => c.enqueue(new TextEncoder().encode(x))); c.close(); } });
test("extracts text only, including escaped quotes and split unicode", () => {
  expect(partialReply('{"reply":"Ol')).toBe("Ol");
  expect(partialReply('{"reply":"Ol\\u00')).toBe("Ol");
  const escapedAccent = "\\" + "u00e1";
  expect(partialReply('{"reply":"Ol' + escapedAccent + '\\n\\"Go\\"","draftTraining":{}')).toBe('Olá\n"Go"');
  expect(partialReply('{"draftTraining":{"reply":"not text"}')).toBeNull();
});
test("receives provisional text before requiring completed provider metadata", async () => {
  const events = [
    { type: "response.output_text.delta", delta: '{"reply":"Olá' },
    { type: "response.output_text.delta", delta: ' Go","draftTraining":null}' },
    { type: "response.completed", response: { status: "completed", model: "test", usage: { input_tokens: 5 } } },
  ].map(e => `data: ${JSON.stringify(e)}\r\n\r\n`).join("");
  const shown: string[] = [];
  const result = await readProviderStream({ body: stream([events.slice(0, 37), events.slice(37)]) } as unknown as Response, text => shown.push(text));
  expect(shown).toEqual(["Olá", "Olá Go"]);
  expect(result.model).toBe("test");
});
test("truncated provider response never becomes a completed answer", async () => {
  await expect(readProviderStream({ body: stream(['data: {"type":"response.output_text.delta","delta":"{}"}\n']) } as unknown as Response, jest.fn())).rejects.toThrow("interrupted");
});
test("application stream releases only final validated data and converts errors to a safe event", async () => {
  const flush = jest.fn().mockResolvedValue(undefined);
  const response = streamAssistantResponse(async (emit, _signal, status) => {
    status("context_ready");
    emit("Olá");
    return Response.json({ reply: "Olá", draftTraining: null });
  }, flush);
  const events = (await response.text()).trim().split("\n").map(x => JSON.parse(x));
  expect(events).toEqual([
    { type: "status", status: "context_ready" },
    { type: "reply", text: "Olá" },
    { type: "done", data: { reply: "Olá", draftTraining: null } },
  ]);
  const failed = streamAssistantResponse(async () => { throw new Error("private provider details"); }, flush);
  const error = await failed.text();
  expect(error).toContain('"type":"error"');
  expect(error).not.toContain("private provider details");
});
