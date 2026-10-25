import { getCalendarTrainingPlanApplications, getTrainingPlanById, getTrainingPlans, getTrainingPlanSummaries } from "../training";
import { readCache, supabaseGet, writeCache } from "../client";
import type { TrainingPlanRow } from "../row-types";

let mockIdentity = { userId: "teacher-a", generation: 1 };
let mockOrganizationId: string | null = "org-a";
let mockGeneration = 1;
jest.mock("../../auth/session", () => ({
  getSessionIdentity: () => ({ ...mockIdentity }),
  assertSessionIdentity: (captured: typeof mockIdentity) => {
    if (captured.userId !== mockIdentity.userId || captured.generation !== mockIdentity.generation) throw new Error("Session changed");
  },
  SessionIdentityChangedError: class extends Error { constructor() { super("Context changed"); } },
}));
jest.mock("../client", () => ({
  CACHE_KEYS: { trainingPlans: "cache_training_plans_v1" },
  getActiveOrganizationId: async () => mockOrganizationId,
  getReadCacheGeneration: () => mockGeneration,
  isNetworkError: (error: unknown) => error instanceof Error && error.message === "Network request failed",
  readCache: jest.fn(), writeCache: jest.fn(), supabaseGet: jest.fn(),
}));
jest.mock("@sentry/react-native", () => ({ addBreadcrumb: jest.fn() }));

const row = (index: number, patch: Partial<TrainingPlanRow> = {}): TrainingPlanRow => ({
  id: `plan-${String(index).padStart(5, "0")}`, classid: `class-${Math.floor(index / 157)}`, organization_id: "org-a",
  title: `Plano ${index}`, tags: ["recepção"], warmup: ["Aquecimento autoral"], main: ["Parte principal autoral"], cooldown: ["Retorno"],
  warmuptime: "10", maintime: "40", cooldowntime: "10", applydate: "2026-10-23", applydays: [],
  version: 3, status: "final", createdat: new Date(Date.UTC(2026, 9, 24) - index * 1000).toISOString(), pedagogy: { authored: true }, ...patch,
});
const serve = (rows: TrainingPlanRow[], cap = 1000) => {
  jest.mocked(supabaseGet).mockImplementation((async (endpoint: string) => {
    const query = new URL(endpoint, "https://fixture.invalid").searchParams;
    const columns = query.get("select")!;
    const offset = Number(query.get("offset") ?? 0);
    const limit = Math.min(Number(query.get("limit") ?? 1000), cap);
    let matching = rows;
    const classes = query.get("classid");
    if (classes?.startsWith("in.(")) {
      const ids = JSON.parse(`[${classes.slice(4, -1)}]`) as string[];
      matching = matching.filter(item => ids.includes(item.classid));
    }
    const dateFilter = query.get("createdat");
    if (dateFilter?.startsWith("eq.")) matching = matching.filter(item => item.createdat === dateFilter.slice(3));
    if (dateFilter?.startsWith("lt.")) matching = matching.filter(item => Date.parse(item.createdat) < Date.parse(dateFilter.slice(3)));
    const idFilter = query.get("id");
    if (idFilter?.startsWith("lt.")) matching = matching.filter(item => item.id < idFilter.slice(3));
    const page = matching.slice(offset, offset + limit);
    return columns === "*" ? page : page.map(item => Object.fromEntries(columns.split(",").map(column => [column, item[column as keyof TrainingPlanRow]])));
  }) as typeof supabaseGet);
};
const range = { organizationId: "org-a", startDate: "2026-09-28", endDate: "2026-11-08" };
const flush = async () => { for (let tick = 0; tick < 15; tick += 1) await Promise.resolve(); };

beforeEach(() => {
  jest.clearAllMocks();
  mockIdentity = { userId: "teacher-a", generation: 1 };
  mockOrganizationId = "org-a";
  mockGeneration = 1;
  jest.mocked(readCache).mockResolvedValue(null);
  jest.mocked(writeCache).mockResolvedValue(undefined);
});

test("lists all 15,700 lightweight summaries across the server cap without hydrating lesson bodies", async () => {
  serve(Array.from({ length: 15_700 }, (_, index) => row(index)));
  const result = await getTrainingPlanSummaries({ organizationId: "org-a" });
  expect(result).toHaveLength(15_700);
  expect(result.filter(plan => plan.classId === "class-99")).toHaveLength(157);
  expect(result[0]).toMatchObject({ id: "plan-00000", tags: ["recepção"], version: 3, status: "final" });
  expect(result[0]).not.toHaveProperty("warmup");
  expect(result[0]).not.toHaveProperty("pedagogy");
  expect(supabaseGet).toHaveBeenCalledTimes(65);
  expect(jest.mocked(supabaseGet).mock.calls.every(([path]) => path.includes("organization_id=eq.org-a") && path.includes("order=createdat.desc,id.desc") && !path.includes("select=*"))).toBe(true);
  expect(writeCache).toHaveBeenCalledWith("cache_training_plans_v1_org-a_summaries_v1", result);
});

test("full reads also traverse clipped pages and persist only the complete snapshot", async () => {
  serve(Array.from({ length: 1301 }, (_, index) => row(index)), 73);
  const result = await getTrainingPlans({ organizationId: "org-a" });
  expect(result).toHaveLength(1301);
  expect(result[1300].main).toEqual(["Parte principal autoral"]);
  expect(supabaseGet).toHaveBeenCalledTimes(37);
  expect(writeCache).toHaveBeenCalledTimes(1);
  expect(writeCache).toHaveBeenCalledWith("cache_training_plans_v1_org-a", result);
});

test("explicit limits preserve version ordering without loading the full history", async () => {
  serve(Array.from({ length: 1301 }, (_, index) => row(index)));
  const result = await getTrainingPlans({ organizationId: "org-a", classId: "class-a", orderBy: "version_desc", status: "final", limit: 40 });
  expect(result).toHaveLength(40);
  expect(supabaseGet).toHaveBeenCalledTimes(1);
  expect(jest.mocked(supabaseGet).mock.calls[0][0]).toContain("order=version.desc,createdat.desc,id.desc&limit=40&offset=0");
  expect(writeCache).not.toHaveBeenCalled();
});

test("the apply picker can load all compatible classes using its own complete cache", async () => {
  serve([row(1, { classid: "class-a" }), row(2, { classid: "class-b" })]);
  const result = await getTrainingPlans({ organizationId: "org-a", classIds: ["class-b", "class-a", "class-a"] });
  const path = new URL(jest.mocked(supabaseGet).mock.calls[0][0], "https://fixture.invalid");
  expect(path.searchParams.get("classid")).toBe('in.("class-a","class-b")');
  expect(result).toHaveLength(2);
  expect(writeCache).toHaveBeenCalledWith(expect.stringContaining("_query_v1_"), result);
  jest.mocked(supabaseGet).mockRejectedValue(new Error("Network request failed"));
  jest.mocked(readCache).mockResolvedValue(result);
  await expect(getTrainingPlans({ organizationId: "org-a", classIds: [" class-a ", "class-b"] })).resolves.toEqual(result);
  expect(jest.mocked(readCache).mock.calls.at(-1)![0]).toContain("_query_v1_");
});

test("calendar reads use only application fields and the exact inclusive grid OR recurring predicate", async () => {
  const rows = [row(1), row(2, { applydate: "2001-01-01", applydays: [1, 4] })];
  serve(rows);
  const result = await getCalendarTrainingPlanApplications(range);
  expect(result).toEqual(rows.map(item => ({ id: item.id, classId: item.classid, applyDate: item.applydate, applyDays: item.applydays, createdAt: item.createdat })));
  const query = new URL(jest.mocked(supabaseGet).mock.calls[0][0], "https://fixture.invalid").searchParams;
  expect(query.get("select")).toBe("id,classid,applydate,applydays,createdat");
  expect(query.get("or")).toBe("(and(applydate.gte.2026-09-28,applydate.lte.2026-11-08),applydays.not.eq.{})");
  expect(result[1]).not.toHaveProperty("main");
  expect(writeCache).toHaveBeenCalledWith("cache_training_plans_v1_org-a_calendar_v1_2026-09-28_2026-11-08", result);
});

test("keyset reads every tied creation date without offset and keeps calendar's range OR independent", async () => {
  const rows = Array.from({ length: 1205 }, (_, index) => row(1204 - index, { createdat: "2026-10-24T12:00:00.000Z", applydays: [2, 4, 6] }));
  serve(rows, 137);
  const result = await getCalendarTrainingPlanApplications(range);
  expect(result.map(plan => plan.id)).toEqual(rows.map(plan => plan.id));
  expect(new Set(result.map(plan => plan.id)).size).toBe(1205);
  expect(supabaseGet).toHaveBeenCalledTimes(11);
  const calls = jest.mocked(supabaseGet).mock.calls;
  calls.forEach(([path], index) => {
    const query = new URL(path, "https://fixture.invalid").searchParams;
    expect(query.has("offset")).toBe(false);
    expect(query.getAll("or")).toEqual(["(and(applydate.gte.2026-09-28,applydate.lte.2026-11-08),applydays.not.eq.{})"]);
    expect(query.get("order")).toBe("createdat.desc,id.desc");
    expect(query.has("and")).toBe(false);
    expect(query.get("createdat")).toBe(index === 0 ? null :
      `${index === calls.length - 1 ? "lt" : "eq"}.2026-10-24T12:00:00.000Z`);
    expect(query.has("id")).toBe(index > 0 && index < calls.length - 1);
  });
});

test("drains short timestamp buckets before moving older and preserves raw microsecond precision", async () => {
  const current = "2026-10-24T12:00:00.123456+00:00";
  const older = "2026-10-24T12:00:00.123455+00:00";
  jest.mocked(supabaseGet)
    .mockResolvedValueOnce([row(3, { createdat: current })])
    .mockResolvedValueOnce([row(2, { createdat: current })])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([row(1, { createdat: older })])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([]);
  const result = await getTrainingPlanSummaries({ organizationId: "org-a" });
  expect(result.map(plan => plan.id)).toEqual(["plan-00003", "plan-00002", "plan-00001"]);
  const queries = jest.mocked(supabaseGet).mock.calls.map(([path]) => new URL(path, "https://fixture.invalid").searchParams);
  expect(queries.map(query => query.get("createdat"))).toEqual([
    null, `eq.${current}`, `eq.${current}`, `lt.${current}`, `eq.${older}`, `lt.${older}`,
  ]);
  expect(queries.map(query => query.get("id"))).toEqual([
    null, "lt.plan-00003", "lt.plan-00002", null, "lt.plan-00001", null,
  ]);
  expect(queries.every(query => query.get("limit") === "500" && !query.has("offset"))).toBe(true);
  expect(writeCache).toHaveBeenCalledTimes(1);
});

test("the summary picker scopes all compatible classes without downloading their bodies or overwriting the global summary cache", async () => {
  serve([row(1, { classid: "class-a" }), row(2, { classid: "class-b" }), row(3, { classid: "class-c" })], 1);
  const result = await getTrainingPlanSummaries({ organizationId: "org-a", classIds: [" class-b ", "class-a", "class-a"] });
  expect(result.map(plan => plan.id)).toEqual(["plan-00001", "plan-00002"]);
  expect(result.every(plan => !("main" in plan) && !("pedagogy" in plan))).toBe(true);
  expect(supabaseGet).toHaveBeenCalledTimes(5);
  const query = new URL(jest.mocked(supabaseGet).mock.calls[0][0], "https://fixture.invalid").searchParams;
  expect(query.get("classid")).toBe('in.("class-a","class-b")');
  expect(query.get("select")).not.toBe("*");
  expect(writeCache).toHaveBeenCalledWith(expect.stringContaining("_summaries_v1_classes_"), result);
  expect(writeCache).not.toHaveBeenCalledWith("cache_training_plans_v1_org-a_summaries_v1", expect.anything());
});

test("a full plan is fetched by ID before any edit/apply; it is cached separately from summaries", async () => {
  serve([row(12)]);
  const full = await getTrainingPlanById("plan-00012", { organizationId: "org-a" });
  expect(full).toMatchObject({ main: ["Parte principal autoral"], warmupTime: "10", version: 3, pedagogy: { authored: true } });
  expect(jest.mocked(supabaseGet).mock.calls[0][0]).toBe("/training_plans?select=*&id=eq.plan-00012&organization_id=eq.org-a&limit=1");
  expect(writeCache).toHaveBeenCalledWith("cache_training_plans_v1_org-a_detail_v1_plan-00012", full);
  jest.mocked(supabaseGet).mockRejectedValue(new Error("Network request failed"));
  jest.mocked(readCache).mockResolvedValue(full);
  await expect(getTrainingPlanById("plan-00012", { organizationId: "org-a" })).resolves.toEqual(full);
});

test("does not persist or return a partial history when later pages fail or repeat IDs", async () => {
  jest.mocked(supabaseGet).mockResolvedValueOnce([row(1)]).mockRejectedValueOnce(new Error("403 forbidden"));
  await expect(getTrainingPlanSummaries({ organizationId: "org-a" })).rejects.toThrow("403");
  expect(writeCache).not.toHaveBeenCalled();
  jest.mocked(supabaseGet).mockReset().mockResolvedValue([row(1)]);
  await expect(getTrainingPlans()).rejects.toThrow("repetidos");
  expect(writeCache).not.toHaveBeenCalled();
});

test.each(["user", "organization", "round trip"])("guards pages and caches after a %s change", async change => {
  jest.mocked(supabaseGet).mockImplementation((async () => {
    if (change === "user") mockIdentity = { userId: "teacher-b", generation: 2 };
    else { mockOrganizationId = change === "organization" ? "org-b" : "org-a"; mockGeneration += 2; }
    return [row(1)];
  }) as typeof supabaseGet);
  await expect(getTrainingPlanSummaries({ organizationId: "org-a" })).rejects.toThrow();
  expect(supabaseGet).toHaveBeenCalledTimes(1);
  expect(writeCache).not.toHaveBeenCalled();
  expect(readCache).not.toHaveBeenCalled();
});

test("changing months cancels old pagination before another page is started", async () => {
  let release!: (rows: TrainingPlanRow[]) => void;
  jest.mocked(supabaseGet).mockImplementation((() => new Promise(resolve => { release = resolve; })) as typeof supabaseGet);
  const controller = new AbortController();
  const result = getCalendarTrainingPlanApplications({ ...range, signal: controller.signal }).catch(error => error);
  await flush();
  controller.abort();
  release([row(1)]);
  expect(await result).toBeInstanceOf(Error);
  expect(supabaseGet).toHaveBeenCalledTimes(1);
  expect(writeCache).not.toHaveBeenCalled();
});

test("does not disguise an uncached network failure as an authorized empty calendar", async () => {
  jest.mocked(supabaseGet).mockRejectedValue(new Error("Network request failed"));
  await expect(getCalendarTrainingPlanApplications(range)).rejects.toThrow("Network request failed");
  jest.mocked(readCache).mockResolvedValue([]);
  await expect(getCalendarTrainingPlanApplications(range)).resolves.toEqual([]);
  expect(jest.mocked(readCache).mock.calls.at(-1)![0]).toContain("_calendar_v1_");
});

test("supports a legacy schema without version/status without introducing empty lesson fields", async () => {
  serve([row(1)]);
  const normal = jest.mocked(supabaseGet).getMockImplementation()!;
  jest.mocked(supabaseGet).mockImplementationOnce(async () => { throw new Error("column training_plans.version does not exist"); }).mockImplementation(normal);
  const summaries = await getTrainingPlanSummaries({ organizationId: "org-a" });
  expect(summaries[0]).toMatchObject({ title: "Plano 1", version: undefined, status: undefined });
  expect(summaries[0]).not.toHaveProperty("warmup");
  expect(jest.mocked(supabaseGet).mock.calls[1][0]).not.toContain(",version,status");
});

test("rejects missing organization or invalid ranges before fetching and treats empty class scopes as empty", async () => {
  await expect(getCalendarTrainingPlanApplications({ ...range, startDate: "invalid" })).rejects.toThrow();
  await expect(getTrainingPlanSummaries({ organizationId: "" })).rejects.toThrow();
  await expect(getTrainingPlanById("", { organizationId: "org-a" })).rejects.toThrow();
  await expect(getTrainingPlans({ classIds: [] })).resolves.toEqual([]);
  expect(supabaseGet).not.toHaveBeenCalled();
});

test("preserves explicit organization queries while guarding the originating active workspace", async () => {
  serve([row(1, { organization_id: "org-b", classid: "class-a" })]);
  await expect(getTrainingPlans({ organizationId: "org-b", classIds: ["class-a"] })).resolves.toHaveLength(1);
  await expect(getTrainingPlanSummaries({ organizationId: "org-b" })).resolves.toHaveLength(1);
  await expect(getTrainingPlanById("plan-00001", { organizationId: "org-b" })).resolves.toMatchObject({ id: "plan-00001" });
  expect(jest.mocked(supabaseGet).mock.calls.every(([path]) => path.includes("organization_id=eq.org-b"))).toBe(true);
  expect(mockOrganizationId).toBe("org-a");
});

test("never emits a global training-plan GET without an explicit or active organization", async () => {
  mockOrganizationId = null;
  await expect(getTrainingPlans()).resolves.toEqual([]);
  expect(supabaseGet).not.toHaveBeenCalled();
  expect(writeCache).not.toHaveBeenCalled();
});
