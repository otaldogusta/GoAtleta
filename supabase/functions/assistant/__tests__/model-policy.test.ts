import { buildAssistantRequest, estimateAssistantCost, resolveAssistantModel, requestAssistantCompletion } from "../model-policy";
const payload = { model: "gpt-5.6-luna", messages: [{ role: "user", content: "Consolidar manchete para 18 atletas, 50 minutos." }], response_format: { json_schema: { name: "lesson", schema: { type: "object" }, strict: true } }, max_tokens: 4000 };
test("central policy selects economical modern model and rejects arbitrary configuration", () => {
  expect(resolveAssistantModel()).toBe("gpt-5.6-luna");
  expect(resolveAssistantModel("gpt-4o-mini")).toBe("gpt-4o-mini");
  expect(() => resolveAssistantModel("client-supplied")).toThrow();
});
test("uses Responses structured output without provider storage or unsupported legacy fields", () => {
  const request = buildAssistantRequest(payload);
  expect(request).toMatchObject({ store: false, model: "gpt-5.6-luna", reasoning: { effort: "none" }, max_output_tokens: 4000, text: { format: { type: "json_schema", strict: true } } });
  expect(request).not.toHaveProperty("temperature");
  expect(buildAssistantRequest({ ...payload, model: "gpt-4o-mini" })).not.toHaveProperty("reasoning");
});
test("cost uses selected model rather than the former fixed label", () => {
  expect(estimateAssistantCost("gpt-5.6-luna", 1000, 1000)).toBeCloseTo(0.0014);
  expect(estimateAssistantCost("unknown", 1000, 1000)).toBeUndefined();
});
test("adapts completed output and actual model usage", async () => {
  const spy = jest.spyOn(global, "fetch").mockResolvedValue({ ok: true, json: async () => ({ status: "completed", model: "snapshot", output: [{ type: "reasoning" }, { content: [{ type: "output_text", text: '{"reply":"Olá"}' }] }], usage: { input_tokens: 42, output_tokens: 12 } }) } as Response);
  const result = await requestAssistantCompletion("test-key", payload);
  expect(await result.json()).toMatchObject({ model: "snapshot", choices: [{ message: { content: '{"reply":"Olá"}' } }], usage: { prompt_tokens: 42 } });
  spy.mockRestore();
});
test("does not present incomplete output as a valid plan", async () => {
  const spy = jest.spyOn(global, "fetch").mockResolvedValue({ ok: true, json: async () => ({ status: "incomplete" }) } as Response);
  expect((await requestAssistantCompletion("test-key", payload)).status).toBe(502);
  spy.mockRestore();
});
