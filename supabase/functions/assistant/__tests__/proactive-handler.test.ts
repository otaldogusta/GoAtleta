import { loadActivityContext } from "../activity-context";
import { resolveAIContext, buildSystemAIContextPrompt } from "../../_shared/ai-context";
import { resolveAIMemory } from "../../_shared/ai-memory";
import { resolveAIGovernance } from "../../_shared/ai-governance";
import { resolveAIDocumentContext } from "../../_shared/ai-document-context";
import { resolveAIPeriodizationContext } from "../../_shared/ai-periodization-context";
import { handlePlanningDiscussion } from "../planning-context-handler";

jest.mock("https://esm.sh/@supabase/supabase-js@2", () => ({ createClient: jest.fn() }), { virtual: true });
jest.mock("../../_shared/framework.ts", () => ({
  createEdgeFunction: (config: { handler: unknown }) => config.handler,
  createSuccess: (data: unknown) => ({ status: 200, json: async () => data }),
  createError: (status: number, code: string) => ({ status, json: async () => ({ code }) }),
}));
jest.mock("../../_shared/ai-context.ts", () => ({ resolveAIContext: jest.fn(), buildSystemAIContextPrompt: jest.fn() }));
jest.mock("../../_shared/ai-memory.ts", () => ({ resolveAIMemory: jest.fn(), buildSystemAIMemoryPrompt: jest.fn() }));
jest.mock("../../_shared/ai-governance.ts", () => ({ resolveAIGovernance: jest.fn(), buildSystemAIGovernancePrompt: jest.fn() }));
jest.mock("../../_shared/ai-document-context.ts", () => ({ resolveAIDocumentContext: jest.fn(), buildSystemAIDocumentContextPrompt: jest.fn(), validateAIDocumentCitations: jest.fn() }));
jest.mock("../../_shared/ai-periodization-context.ts", () => ({ resolveAIPeriodizationContext: jest.fn() }));
jest.mock("../../_shared/scientific-evidence-runtime.ts", () => ({ resolveScientificEvidence: jest.fn() }));
jest.mock("../../_shared/security-logger.ts", () => ({ securityLogger: {} }));
jest.mock("../activity-context.ts", () => ({ loadActivityContext: jest.fn() }));
jest.mock("../planning-context-handler.ts", () => ({ handlePlanningDiscussion: jest.fn() }));
jest.mock("../class-profile-handler.ts", () => ({ handleClassProfile: jest.fn() }));
jest.mock("../attendance-ranking.ts", () => ({ resolveAttendanceRanking: jest.fn() }));
jest.mock("../model-router.ts", () => ({ initialGreeting: jest.fn(), routeAssistant: () => ({ model: "gpt-5.6-luna", reason: "proactive", maxOutputTokens: 300 }) }));
jest.mock("../trusted-sources.ts", () => ({ keepServerTrustedSources: jest.fn() }));
jest.mock("../regulation-resolver.ts", () => ({ resolveRegulationAssistantResponse: jest.fn() }));
jest.mock("../report-proposal.ts", () => ({ resolveReportProposal: jest.fn() }));
jest.mock("../class-memory-proposal.ts", () => ({ resolveClassMemoryProposal: jest.fn() }));
jest.mock("../lesson-history.ts", () => ({ loadPreviousLessonPlans: jest.fn() }));

const privateText = "Pessoa Particular 41999990000 pessoa@example.invalid medical-clearance-private";
let handler: (context: unknown) => Promise<{ status: number; json: () => Promise<any> }>;
const originalFetch = global.fetch;
const originalDeno = (global as any).Deno;
beforeAll(() => {
  (global as any).Deno = { env: { get: () => "test-only" }, serve: (value: typeof handler) => { handler = value; } };
  require("../index.ts");
});
afterAll(() => { global.fetch = originalFetch; (global as any).Deno = originalDeno; });

test("the real proactive branch excludes injected client and history context from the provider request", async () => {
  jest.clearAllMocks();
  (resolveAIContext as jest.Mock).mockResolvedValue({ user: { id: "coach-private", role: "coach", organizationId: "org-private", permissions: [] },
    action: { classId: "class-private", date: "2026-10-21" }, institutionalProfile: { philosophy: privateText } });
  for (const source of [loadActivityContext, resolveAIMemory, resolveAIGovernance, resolveAIDocumentContext, resolveAIPeriodizationContext, buildSystemAIContextPrompt])
    (source as jest.Mock).mockResolvedValue(privateText);
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "completed", model: "gpt-5.6-luna",
    output: [{ content: [{ type: "output_text", text: JSON.stringify({ insight: "Organize grupos pequenos para a iniciação.", confidence: .85,
      based_on: ["Nível MV1", "18 atletas cadastrados"], action: { type: "whatsapp_reminder", label: "Lembrete", params: { phone: "invented-phone", message: "invented-contact" } } }) }] }],
    usage: { input_tokens: 12, output_tokens: 8 },
  }) });
  const writes: unknown[] = [];
  const reads: string[] = [];
  const supabase = { from(table: string) {
    reads.push(table);
    const result = () => ({ data: table === "classes" ? { id: "class-private", name: privateText, ageband: "08-11", modality: "voleibol",
      goal: "Fundamentos", mv_level: "MV1", duration: 60, days: [2, 4], teacherNotes: privateText } : null, count: table === "students" ? 18 : null, error: null });
    const query: any = { select: () => query, eq: () => query, maybeSingle: async () => result(),
      insert: async (data: unknown) => { writes.push(data); return { error: null }; },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve) };
    return query;
  } };
  const response = await handler({ supabase, user: { id: "coach-private" }, token: "test-token", requestId: "test-request",
    metrics: { trackPerf: jest.fn(), trackAiUsage: jest.fn() }, body: { mode: "proactive", organizationId: "org-private", classId: "class-private",
      classSnapshot: { name: privateText, ageBand: privateText, goal: privateText }, appSnapshot: { notes: privateText },
      planningContext: { teacherReport: privateText },
      memoryContext: [{ content: privateText }], messages: [{ role: "user", content: privateText }], sport: privateText,
    } });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ insight: "Organize grupos pequenos para a iniciação.", confidence: .85,
    based_on: ["Nível MV1", "18 atletas cadastrados"], action: null });
  expect(global.fetch).toHaveBeenCalledTimes(1);
  const sent = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
  expect(sent).toMatchObject({ model: "gpt-5.6-luna", store: false });
  expect(JSON.parse(sent.input[1].content).group).toEqual({ modality: "voleibol", ageRange: { min: 8, max: 11 }, goal: "Fundamentos",
    developmentLevel: "MV1", sessionsPerWeek: 2, durationMinutes: 60, registeredStudentCount: 18 });
  expect(JSON.stringify(sent)).not.toContain(privateText);
  expect(JSON.stringify(sent)).not.toContain("coach-private");
  for (const source of [loadActivityContext, resolveAIMemory, resolveAIGovernance, resolveAIDocumentContext, resolveAIPeriodizationContext, buildSystemAIContextPrompt])
    expect(source).not.toHaveBeenCalled();
  expect(handlePlanningDiscussion).not.toHaveBeenCalled();
  expect(reads).toEqual(["classes", "classes", "students", "ai_decision_traces"]);
  expect(writes).toHaveLength(1);
});
