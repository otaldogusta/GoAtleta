/** Text is provisional; only a terminal done event can authorize the final result. */
export async function readAssistantStream(
  response: Response,
  onReply?: (text: string) => void,
  onStatus?: (status: string) => void,
): Promise<unknown> {
  let final: unknown;
  let complete = false;
  const consume = (line: string) => {
    if (!line.trim()) return;
    if (complete) throw new Error("Resposta inválida após conclusão.");
    const event = JSON.parse(line);
    if (event.type === "reply" && typeof event.text === "string") onReply?.(event.text);
    else if (event.type === "status" && typeof event.status === "string") onStatus?.(event.status);
    else if (event.type === "done") { final = event.data; complete = true; }
    else if (event.type === "error") throw new Error("A resposta foi interrompida. Tente novamente.");
    else throw new Error("Resposta incompleta. Tente novamente.");
  };
  if (!response.body?.getReader) {
    // Some native fetch implementations buffer the body; never issue a second request.
    (await response.text()).split("\n").forEach(consume);
  } else {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
        if (buffer.length > 1_000_000) throw new Error("Resposta muito grande.");
        let end;
        while ((end = buffer.indexOf("\n")) >= 0) { consume(buffer.slice(0, end)); buffer = buffer.slice(end + 1); }
        if (done) { if (buffer.trim()) consume(buffer); break; }
      }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  }
  if (!complete) throw new Error("A resposta foi interrompida. Tente novamente.");
  return final;
}
