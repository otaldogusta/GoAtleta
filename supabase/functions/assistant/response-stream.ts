/** Expose only the leading reply string, never partial action JSON. */
export function partialReply(json: string): string | null {
  const match = /^\s*\{\s*"reply"\s*:\s*"((?:\\.|[^"\\])*)/.exec(json);
  if (!match) return null;
  let text = match[1];
  // A transport chunk may stop within a JSON escape or UTF-16 surrogate pair.
  text = text.replace(/\\u[\da-fA-F]{0,3}$/, "");
  try {
    const decoded = JSON.parse(`"${text}"`) as string;
    return decoded.replace(/[\uD800-\uDBFF]$/, "");
  } catch { return null; }
}

export async function readProviderStream(response: Response, onReply: (text: string) => void) {
  if (!response.body) throw new Error("Missing provider stream");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "", json = "", shown = "";
  let completed: Record<string, any> | null = null;
  const line = (raw: string) => {
    if (!raw.startsWith("data:")) return;
    const event = JSON.parse(raw.slice(5).trim());
    if (event.type === "response.output_text.delta") {
      json += event.delta;
      if (json.length > 200_000) throw new Error("Provider response too large");
      const text = partialReply(json);
      if (text !== null && text !== shown) { shown = text; onReply(text); }
    }
    if (event.type === "response.completed") completed = event.response;
    if (["error", "response.failed", "response.incomplete"].includes(event.type)) throw new Error("Provider stream failed");
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      if (buffer.length > 1_000_000) throw new Error("Provider event too large");
      let end;
      while ((end = buffer.indexOf("\n")) >= 0) { line(buffer.slice(0, end).trimEnd()); buffer = buffer.slice(end + 1); }
      if (done) { if (buffer.trim()) line(buffer.trimEnd()); break; }
    }
    if (!completed) throw new Error("Provider stream interrupted");
    return completed;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export function streamAssistantResponse(
  generate: (
    onReply: (text: string) => void,
    signal: AbortSignal,
    onStatus: (status: string) => void,
  ) => Promise<Response>,
  flush: () => Promise<void>,
) {
  const abort = new AbortController();
  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (event: unknown) => { if (!closed) controller.enqueue(encoder.encode(JSON.stringify(event) + "\n")); };
      const task = (async () => {
        try {
          const result = await generate(
            text => emit({ type: "reply", text }),
            abort.signal,
            status => emit({ type: "status", status }),
          );
          if (!result.ok) throw new Error("Generation failed");
          emit({ type: "done", data: await result.json() });
        } catch {
          emit({ type: "error", message: "A resposta foi interrompida. Tente novamente." });
        } finally {
          if (!closed) { closed = true; controller.close(); }
          await flush().catch(() => {});
        }
      })();
      // Keep validation/persistence alive for the duration of the response stream.
      (globalThis as unknown as { EdgeRuntime?: { waitUntil: (task: Promise<void>) => void } }).EdgeRuntime?.waitUntil(task);
    },
    cancel() { closed = true; abort.abort(); },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform" } });
}
