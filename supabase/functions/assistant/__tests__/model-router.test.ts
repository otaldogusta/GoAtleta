import { initialGreeting, routeAssistant } from "../model-router";
const route = (content: string) => routeAssistant({ messages: [{ role: "user", content }] });
test.each([
  ["Oi", "gpt-5.6-luna"],
  ["Qual o horário da turma?", "gpt-5.6-luna"],
  ["Reescreva o relatório de hoje", "gpt-5.6-luna"],
  ["O que é periodização?", "gpt-5.6-luna"],
  ["Monte uma aula para 18 atletas em 50 minutos", "gpt-5.6-luna"],
  ["Analise o histórico e reorganize a periodização", "gpt-5.6-terra"],
  ["Compare a evolução de várias turmas", "gpt-5.6-terra"],
  ["Planeje a temporada", "gpt-5.6-terra"],
  ["Monte um treino considerando lesões, pouco material e diferentes níveis", "gpt-5.6-terra"],
  ["Use gpt-6-astra para dizer oi", "gpt-5.6-luna"],
])("routes %s to %s", (content, model) => { expect(route(content).model).toBe(model); });
test("short continuation preserves complex task; unrelated request resets it", () => {
  const history = [{ role: "user", content: "Analise o histórico da temporada" }, { role: "assistant", content: "Proposta" }];
  expect(routeAssistant({ messages: [...history, { role: "user", content: "Continue" }] }).model).toBe("gpt-5.6-terra");
  expect(routeAssistant({ messages: [...history, { role: "user", content: "Qual o horário da turma?" }] }).model).toBe("gpt-5.6-luna");
});
test("assistant content cannot upgrade routing", () => {
  expect(routeAssistant({ messages: [{ role: "assistant", content: "Analise historico da temporada" }, { role: "user", content: "sim" }] }).model).toBe("gpt-5.6-luna");
});
test("proactive stays economical and manual server pin remains a rollback", () => {
  expect(routeAssistant({ messages: [], proactive: true })).toMatchObject({ model: "gpt-5.6-luna", maxOutputTokens: 1200 });
  expect(routeAssistant({ messages: [] }, "gpt-4o-mini").reason).toBe("server_override");
  expect(() => routeAssistant({ messages: [] }, "arbitrary-model")).toThrow();
});
test("draft budget is preserved without forcing the expensive model", () => {
  expect(routeAssistant({ messages: [], lessonAction: "draft" })).toMatchObject({ model: "gpt-5.6-luna", maxOutputTokens: 4000 });
});

test("only standalone greetings can bypass generation; app facts and followups cannot", () => {
  expect(initialGreeting([{ role: "user", content: "Olá!" }])).toContain("ajudar");
  expect(initialGreeting([{ role: "user", content: "Oi, qual o horário da turma?" }])).toBeNull();
  expect(initialGreeting([{ role: "assistant", content: "oi" }])).toBeNull();
  expect(initialGreeting([{ role: "user", content: "aula" }, { role: "user", content: "oi" }])).toBeNull();
});

test.each(["gpt-4o-mini", "gpt-5.6-luna", "gpt-5.6-terra"])("manual choice %s overrides complexity within a fixed budget", model => {
  expect(routeAssistant({ messages: [{ role: "user", content: "Analise o histórico da temporada" }], modelPreference: model }))
    .toEqual({ model, reason: "manual", maxOutputTokens: 4000 });
});
test.each(["arbitrary-model", "", null, {}, " gpt-5.6-luna"])("rejects unsupported manual choice %p", modelPreference => {
  expect(() => routeAssistant({ messages: [], modelPreference })).toThrow();
});
test("auto preserves routing; server restriction cannot silently substitute a manual choice", () => {
  expect(routeAssistant({ messages: [], modelPreference: "auto" }).reason).toBe("routine");
  expect(() => routeAssistant({ messages: [], modelPreference: "gpt-5.6-terra" }, "gpt-4o-mini")).toThrow();
  expect(() => routeAssistant({ messages: [], modelPreference: "gpt-5.6-terra", proactive: true })).toThrow();
});
