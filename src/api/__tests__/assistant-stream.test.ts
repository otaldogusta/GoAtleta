import { readAssistantStream } from "../assistant-stream";
import { TextEncoder, TextDecoder } from "util";
import { ReadableStream } from "stream/web";
Object.assign(global, { TextEncoder, TextDecoder });
test("decodes split utf8 and requires a final event", async () => {
  const bytes = new TextEncoder().encode(JSON.stringify({ type: "reply", text: "Atenção" }) + "\n" + JSON.stringify({ type: "done", data: { reply: "Atenção", draftTraining: null } }) + "\n");
  const body = new ReadableStream({ start(c) { for (const byte of bytes) c.enqueue(Uint8Array.of(byte)); c.close(); } });
  const onReply = jest.fn();
  await expect(readAssistantStream({ body } as unknown as Response, onReply)).resolves.toMatchObject({ reply: "Atenção" });
  expect(onReply).toHaveBeenCalledWith("Atenção");
});
test.each([
  '{"type":"reply","text":"parcial"}\n',
  '{"type":"reply","text":"parcial"}\n{"type":"error"}\n',
])("buffered native response rejects incomplete or failed streams", async text => {
  await expect(readAssistantStream({ text: async () => text } as Response, jest.fn())).rejects.toThrow("interrompida");
});
test("buffered native response finishes without a second request", async () => {
  await expect(readAssistantStream({ text: async () => '{"type":"done","data":{"reply":"fim"}}\n' } as Response)).resolves.toEqual({ reply: "fim" });
});

test("forwards ordered backend status events without treating them as reply text", async () => {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(
        '{"type":"status","status":"context_ready"}\n' +
        '{"type":"status","status":"drafting_response"}\n' +
        '{"type":"done","data":{"reply":"fim"}}\n'
      ));
      controller.close();
    },
  });
  const onReply = jest.fn();
  const onStatus = jest.fn();

  await readAssistantStream({ body } as unknown as Response, onReply, onStatus);

  expect(onReply).not.toHaveBeenCalled();
  expect(onStatus.mock.calls.map(([status]) => status)).toEqual(["context_ready", "drafting_response"]);
});
