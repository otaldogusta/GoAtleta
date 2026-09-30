import { handlePlanningDiscussion, loadPlanningEvidence, normalizePlanningRequest, planningEvidenceWindow, planningProjection, selectCompletedLessons } from "../planning-context-handler";
jest.mock("../../_shared/framework.ts", () => ({ createError: (status: number, code: string) => ({ status, json: async () => ({ code }) }), createSuccess: (data: unknown) => ({ status: 200, json: async () => data }) }));
jest.mock("../model-policy.ts", () => ({ resolveAssistantModel: () => "test", requestAssistantCompletion: jest.fn() }));
import { requestAssistantCompletion } from "../model-policy";
const now = new Date("2026-09-30T12:00:00Z");
function client(data: Record<string, unknown> = {}, allowed = true) {
  const filters: unknown[][] = [];
  return { filters, rpc: jest.fn().mockResolvedValue({ data: allowed }), from: (table: string) => {
    const chain: any = {};
    for (const method of ["select", "eq", "in", "gte", "lte", "lt", "order", "limit"]) chain[method] = (...args: unknown[]) => { filters.push([table, method, ...args]); return chain; };
    chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(data[table] instanceof Error ? { error: data[table] } : { data: data[table] ?? [] }).then(resolve);
    return chain;
  } };
}
beforeEach(() => { jest.clearAllMocks(); (global as any).Deno = { env: { get: () => "test" } }; });
afterAll(() => { delete (global as any).Deno; });
test("30 day window includes boundaries and caps only completed lessons at eight", () => {
  const window = planningEvidenceWindow(now);
  const rows = Array.from({ length: 12 }, (_, i) => ({ id: String(i), status: "completed", start_at: `2026-09-${String(10 + i).padStart(2, "0")}T12:00:00Z` }));
  expect(selectCompletedLessons([...rows, { id: "planned", status: "scheduled", start_at: window.end }, { id: "old", status: "completed", start_at: "2026-08-01T00:00:00Z" }], window).map(row => row.id)).toEqual(["11", "10", "9", "8", "7", "6", "5", "4"]);
  expect(selectCompletedLessons([{ id: "boundary", status: "completed", start_at: window.start }], window)).toHaveLength(1);
});
test("projects no identities, contacts, health, quotes or unrestricted report narrative", () => {
  expect(planningProjection({ athlete_name: "Ana", pain_score: 4, fundamentals: { value: "Ana domina passe", quote: "private" }, email: "a@example.com", health: "private", description: "private" }, ["Ana"])).toEqual({ fundamentals: { value: "[atleta] domina passe" }, email: "[contato omitido]" });
  expect(planningProjection("2026-09-30")).toBe("2026-09-30");
  expect(planningProjection("usa medicação")).toBe("[informação individual omitida]");
  expect(normalizePlanningRequest({ selection: { month: "2026-09", student: "private" }, draft: { goal: "Fundamentos", documents: ["private"], classId: "another" }, documents: ["private"] })).toEqual({ selection: { month: "2026-09" }, surface: "workspace", step: "", draft: { goal: "Fundamentos" } });
});
test("scope every read, exclude planned lessons and label missing/failing sources", async () => {
  const supabase = client({ training_session_classes: [{ session_id: "one" }], training_sessions: [{ id: "one", status: "completed", start_at: "2026-09-25T12:00:00Z" }, { id: "planned", status: "scheduled", start_at: "2026-09-26T12:00:00Z" }], session_logs: new Error("offline"), training_session_attendance: [{ session_id: "one", status: "present", student_id: "private" }] });
  const evidence = await loadPlanningEvidence(supabase as any, "org", "class", { month: "2026-09" }, now);
  expect(evidence.confirmed.lessons).toHaveLength(1);
  expect(evidence.confirmed.lessons[0].attendance).toEqual({ present: 1 });
  expect(evidence.sources).toContainEqual({ table: "session_logs", status: "unavailable", count: 0 });
  expect(evidence.sample).toBe("insufficient");
  for (const table of new Set(supabase.filters.map(row => row[0]))) expect(supabase.filters).toContainEqual([table, "eq", "organization_id", "org"]);
  expect(JSON.stringify(evidence.confirmed)).not.toContain("private");
});
test("permission denial and class mismatch never reach model", async () => {
  const body = { lessonAction: "discuss", planningContext: { version: 1, classId: "class", selection: { month: "2026-09" } }, messages: [{ role: "user", content: "Analise" }] };
  const forbidden = await handlePlanningDiscussion({ supabase: client({}, false) as any, organizationId: "org", classId: "class", body });
  expect(forbidden.status).toBe(403);
  const invalid = await handlePlanningDiscussion({ supabase: client() as any, organizationId: "org", classId: "other", body });
  expect(invalid.status).toBe(400);
  expect(requestAssistantCompletion).not.toHaveBeenCalled();
});
test("successful advisory response carries captured sources and no write or training draft", async () => {
  (requestAssistantCompletion as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ reply: "Considere o objetivo confirmado. O rascunho ainda não foi aplicado." }) } }] }) });
  const supabase = client({ students: [{ name: "Ana" }], class_pedagogical_profiles: [{ profile: { facts: { gameFormat: { value: "6x6", authorId: "private" } } } }] });
  const response = await handlePlanningDiscussion({ supabase: supabase as any, organizationId: "org", classId: "class", body: { lessonAction: "discuss", planningContext: { version: 1, classId: "class", selection: { month: "2026-09", weekNumber: 39 }, draft: { gameLevel: "4x4" } }, messages: [{ role: "user", content: "O que sugere?" }] } });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ planningContextVersion: 1, draftTraining: null, contextDetails: { selection: { month: "2026-09", weekNumber: 39 }, sample: "insufficient" } });
  expect(supabase.rpc.mock.calls.map(call => call[0])).toEqual(["can_read_class_profile"]);
  const prompt = JSON.parse((requestAssistantCompletion as jest.Mock).mock.calls[0][1].messages[1].content);
  expect(prompt.confirmed.profile.profile.facts.gameFormat.value).toBe("6x6");
  expect(prompt.provisional.draft.gameLevel).toBe("4x4");
  expect(JSON.stringify(prompt)).not.toContain("private");
});
test("failed privacy preparation prevents provider transmission", async () => {
  const response = await handlePlanningDiscussion({ supabase: client({ students: new Error("unavailable") }) as any, organizationId: "org", classId: "class", body: { lessonAction: "discuss", planningContext: { version: 1, classId: "class", selection: { month: "2026-09" } }, messages: [{ role: "user", content: "Analise" }] } });
  expect(response.status).toBe(503);
  expect(requestAssistantCompletion).not.toHaveBeenCalled();
});
