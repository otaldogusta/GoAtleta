import { buildProactiveGroupContext, ProactiveContextUnavailableError, requestProactiveInsight } from "../proactive-insight";

const privateText = "Ana Particular 41999990000 ana.privada@example.invalid CPF12345678900";
const row = {
  ageband: "08-11", modality: "voleibol", goal: "Fundamentos", mv_level: "MV1", level: 1,
  duration: 60, days: [2, 4], daysperweek: 2,
  name: privateText, guardian_name: privateText, phone: privateText, health_issue_notes: privateText,
  needs_medical_clearance: true, history: privateText, institutionalProfile: privateText,
};

function fixture(options: { classRow?: unknown; classError?: unknown; rosterError?: unknown; count?: number | null } = {}) {
  const calls: unknown[][] = [];
  const supabase = { from(table: string) {
    calls.push(["from", table]);
    const result = () => table === "classes"
      ? { data: "classRow" in options ? options.classRow : row, error: options.classError ?? null }
      : { data: [{ name: privateText, phone: privateText, needs_medical_clearance: true }], count: "count" in options ? options.count : 18, error: options.rosterError ?? null };
    const query: any = {
      select: (fields: string, selectOptions?: unknown) => { calls.push([table, "select", fields, selectOptions]); return query; },
      eq: (field: string, value: unknown) => { calls.push([table, "eq", field, value]); return query; },
      maybeSingle: async () => result(),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return query;
  } };
  return { supabase, calls };
}

const originalFetch = global.fetch;
beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ status: "completed", model: "gpt-5.6-luna",
      output: [{ content: [{ type: "output_text", text: JSON.stringify({ insight: "Organize jogos reduzidos.", confidence: .8, based_on: ["MV1"], action: null }) }] }],
      usage: { input_tokens: 12, output_tokens: 8 },
    }),
  });
});
afterAll(() => { global.fetch = originalFetch; });

test("sends only allowlisted collective facts at the actual provider boundary", async () => {
  const { supabase, calls } = fixture();
  const response = await requestProactiveInsight(supabase, "org-private", "class-private", "test-only-key", "gpt-5.6-luna");
  expect(response.ok).toBe(true);
  const [url, request] = (global.fetch as jest.Mock).mock.calls[0];
  expect(url).toBe("https://api.openai.com/v1/responses");
  const payload = JSON.parse(request.body);
  expect(payload.model).toBe("gpt-5.6-luna");
  expect(payload.store).toBe(false);
  expect(payload.input).toHaveLength(2);
  expect(JSON.parse(payload.input[1].content)).toEqual({ group: {
    modality: "voleibol", ageRange: { min: 8, max: 11 }, goal: "Fundamentos", developmentLevel: "MV1",
    sessionsPerWeek: 2, durationMinutes: 60, registeredStudentCount: 18,
  }, request: "Sugira uma decisão pedagógica coletiva para esta turma." });
  expect(request.body).not.toContain(privateText);
  expect(request.body).not.toContain("org-private");
  expect(request.body).not.toContain("class-private");
  expect(payload.text.format).toMatchObject({ type: "json_schema", name: "proactive_insight_response", strict: true,
    schema: { required: ["insight", "confidence", "based_on", "action"] } });
  expect(calls).toContainEqual(["students", "select", "id", { count: "exact", head: true }]);
  for (const table of ["classes", "students"]) expect(calls).toContainEqual([table, "eq", "organization_id", "org-private"]);
  expect(calls).toContainEqual(["students", "eq", "classid", "class-private"]);
  expect(calls.filter(call => call[0] === "from")).toEqual([["from", "classes"], ["from", "students"]]);
});

test("drops injected names and instructions even when placed in known server fields", async () => {
  const injected = { ...row, ageband: `08-11 ${privateText}`, modality: `voleibol ${privateText}`,
    goal: `Fundamentos ${privateText}`, mv_level: `MV1 ${privateText}`, level: privateText,
    duration: privateText, days: [2, privateText], daysperweek: privateText };
  await requestProactiveInsight(fixture({ classRow: injected }).supabase, "org", "class", "test-only", "gpt-5.6-luna");
  const payload = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
  expect(JSON.parse(payload.input[1].content).group).toEqual({ modality: null, ageRange: null, goal: null,
    developmentLevel: null, sessionsPerWeek: null, durationMinutes: null, registeredStudentCount: 18 });
  expect(JSON.stringify(payload)).not.toContain(privateText);
});

test.each([
  { classRow: null }, { classError: { code: "DENIED" } }, { rosterError: { code: "OFFLINE" } },
  { count: null }, { count: -1 }, { count: Number.NaN },
])("never calls the provider with unavailable or invalid source data: %o", async options => {
  await expect(requestProactiveInsight(fixture(options).supabase, "org", "class", "test-only", "gpt-5.6-luna"))
    .rejects.toBeInstanceOf(ProactiveContextUnavailableError);
  expect(global.fetch).not.toHaveBeenCalled();
});

test("does not read any data or call the provider without the validated scope", async () => {
  const { supabase, calls } = fixture();
  await expect(requestProactiveInsight(supabase, "org", "", "test-only", "gpt-5.6-luna"))
    .rejects.toBeInstanceOf(ProactiveContextUnavailableError);
  expect(calls).toEqual([]);
  expect(global.fetch).not.toHaveBeenCalled();
});

test("retains known categories and bounded numbers without carrying arbitrary strings", () => {
  expect(buildProactiveGroupContext({ modality: "VOLEIBOL_AREIA", ageband: "16–18", goal: "potencia/agilidade",
    mv_level: "custom", level: 3, duration: 241, days: [1, 1, 5], daysperweek: 7 }, 0)).toEqual({
    modality: "voleibol_areia", ageRange: { min: 16, max: 18 }, goal: "Potência/Agilidade",
    developmentLevel: "MV3", sessionsPerWeek: 2, durationMinutes: null, registeredStudentCount: 0,
  });
  expect(buildProactiveGroupContext({ ageband: "18-11", daysperweek: 8, level: 4 }, "18")).toEqual({
    modality: null, ageRange: null, goal: null, developmentLevel: null,
    sessionsPerWeek: null, durationMinutes: null, registeredStudentCount: null,
  });
});
