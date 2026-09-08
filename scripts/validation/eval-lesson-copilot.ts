// Synthetic evaluation only. Never load production secrets or student data here.
// Usage: deno run --no-lock --allow-env=OPENAI_API_KEY --allow-net=api.openai.com --allow-read=scripts/validation/lesson-copilot-eval-cases.json scripts/validation/eval-lesson-copilot.ts
import { estimateAssistantCost, requestAssistantCompletion } from "../../supabase/functions/assistant/model-policy.ts";
import { lessonConversationPrompt } from "../../supabase/functions/assistant/lesson-conversation.ts";

const key = Deno.env.get("OPENAI_API_KEY");
if (!key) { console.error("Evaluation requires a test OPENAI_API_KEY in this process. No requests sent."); Deno.exit(2); }
const cases = JSON.parse(await Deno.readTextFile("scripts/validation/lesson-copilot-eval-cases.json"));
const selectedModel = Deno.args.find((arg) => arg.startsWith("--model="))?.slice(8);
const selectedCases = Deno.args.filter((arg) => arg.startsWith("--case=")).map((arg) => arg.slice(7));
if (selectedModel && !["gpt-4o-mini", "gpt-5.6-luna"].includes(selectedModel)) throw new Error("Unknown evaluation model");
if (selectedCases.some((id) => !cases.some((item: { id: string }) => item.id === id))) throw new Error("Unknown evaluation case");
const string = { type: "string" };
const strings = { type: "array", items: string };
const draftProperties = { title: string, tags: strings, warmup: strings, main: strings, cooldown: strings, warmupTime: string, mainTime: string, cooldownTime: string };
const schema = {
  type: "object", additionalProperties: false, required: ["reply", "draftTraining"],
  properties: { reply: string, draftTraining: { anyOf: [{ type: "null" }, { type: "object", additionalProperties: false, properties: draftProperties, required: Object.keys(draftProperties) }] } },
};
let failedRequests = 0;
for (const model of ["gpt-4o-mini", "gpt-5.6-luna"]) {
  if (selectedModel && model !== selectedModel) continue;
  for (const item of cases) {
    if (selectedCases.length && !selectedCases.includes(item.id)) continue;
    const started = Date.now();
    const response = await requestAssistantCompletion(key, {
      model, messages: [{ role: "system", content: lessonConversationPrompt(item.action, "2026-09-06") },
        { role: "system", content: `Synthetic evidence: ${item.evidence}` }, { role: "user", content: item.input }],
      response_format: { json_schema: { name: "lesson_evaluation", schema, strict: true } }, max_tokens: 4000,
    });
    if (!response.ok) {
      failedRequests += 1;
      const error = await response.json().catch(() => null);
      console.log(JSON.stringify({ caseId: item.id, model, status: response.status,
        errorCode: error?.error?.code, errorType: error?.error?.type,
        retryAfter: response.headers.get("retry-after") }));
      continue;
    }
    const result = await response.json();
    console.log(JSON.stringify({ caseId: item.id, model: result.model, elapsedMs: Date.now() - started,
      tokensIn: result.usage.prompt_tokens, tokensOut: result.usage.completion_tokens,
      estimatedUsd: estimateAssistantCost(model, result.usage.prompt_tokens, result.usage.completion_tokens),
      expected: item.expected, response: JSON.parse(result.choices[0].message.content), reviewRequired: true }));
  }
}
if (failedRequests > 0) {
  console.error(`Evaluation incomplete: ${failedRequests} provider requests failed. Model selection remains pending.`);
  Deno.exit(1);
}
