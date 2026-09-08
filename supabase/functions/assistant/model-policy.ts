import { readProviderStream } from "./response-stream.ts";
// Server allowlist. Client preferences must pass the router; budgets remain server-owned.
export const ASSISTANT_MODELS = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-5.6-luna": { input: 0.2, output: 1.2 },
  "gpt-5.6-terra": { input: 2, output: 12 },
} as const;

export function resolveAssistantModel(configured?: string) {
  const value = configured?.trim() || "gpt-5.6-luna";
  if (!Object.prototype.hasOwnProperty.call(ASSISTANT_MODELS, value)) throw new Error("Unsupported assistant model configuration");
  return value as keyof typeof ASSISTANT_MODELS;
}

export function estimateAssistantCost(model: string, input: number, output: number) {
  const price = ASSISTANT_MODELS[model as keyof typeof ASSISTANT_MODELS];
  return price ? (input * price.input + output * price.output) / 1_000_000 : undefined;
}

type CompletionPayload = {
  model: string;
  messages: { role: string; content: string }[];
  response_format: { json_schema: { name: string; schema: unknown; strict: boolean } };
  max_tokens: number;
};

export function buildAssistantRequest(payload: CompletionPayload) {
  return {
    model: payload.model,
    store: false,
    input: payload.messages,
    ...(payload.model.startsWith("gpt-5") ? { reasoning: { effort: "none" } } : {}),
    text: { format: { type: "json_schema", ...payload.response_format.json_schema } },
    max_output_tokens: Math.max(1200, payload.max_tokens),
  };
}

// Adapt at the provider boundary so existing callers retain their response contract.
export async function requestAssistantCompletion(apiKey: string, payload: CompletionPayload, onReply?: (text: string) => void, signal?: AbortSignal) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ ...buildAssistantRequest(payload), ...(onReply ? { stream: true } : {}) }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(60_000)]) : AbortSignal.timeout(60_000),
  });
  if (!response.ok) return response;
  const data = onReply ? await readProviderStream(response, onReply) : await response.json();
  if (data.status !== "completed") return new Response(null, { status: 502 });
  const content = (data.output ?? []).flatMap((item: { content?: { type: string; text?: string }[] }) =>
    item.content ?? []).filter((item: { type: string }) => item.type === "output_text")
    .map((item: { text?: string }) => item.text ?? "").join("");
  return Response.json({
    model: data.model ?? payload.model,
    choices: [{ message: { content } }],
    usage: { prompt_tokens: data.usage?.input_tokens ?? 0, completion_tokens: data.usage?.output_tokens ?? 0 },
  });
}
