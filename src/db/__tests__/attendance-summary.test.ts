import { getMonthlyAttendanceSummary } from "../attendance-summary";
import { supabaseGet } from "../client";
import type { AttendanceRow } from "../row-types";

let mockIdentity = { userId: "teacher-a", generation: 1 };
let mockOrg: string | null = "org-a";
let mockGeneration = 1;
jest.mock("../../auth/session", () => ({
  getSessionIdentity: () => ({ ...mockIdentity }),
  assertSessionIdentity: (value: typeof mockIdentity) => {
    if (value.userId !== mockIdentity.userId || value.generation !== mockIdentity.generation) throw new Error("Session changed");
  },
  SessionIdentityChangedError: class extends Error {},
}));
jest.mock("../client", () => ({
  CACHE_KEYS: {},
  supabaseGet: jest.fn(), getActiveOrganizationId: async () => mockOrg,
  getReadCacheGeneration: () => mockGeneration,
  getScopedOrganizationId: async (id?: string | null) => id ?? mockOrg,
}));
jest.mock("@sentry/react-native", () => ({ addBreadcrumb: jest.fn() }));
jest.mock("../classes", () => ({}));
jest.mock("../training", () => ({}));
jest.mock("../training-sessions", () => ({}));
jest.mock("../../api/class-responsibles", () => ({}));
jest.mock("../../api/notifications", () => ({}));
const day = { classId: "class-a", date: "2026-10-24", total: 50, present: 41 };
beforeEach(() => {
  jest.clearAllMocks();mockIdentity = { userId: "teacher-a", generation: 1 };mockOrg = "org-a";mockGeneration = 1;
  jest.mocked(supabaseGet).mockResolvedValue({ days: [day] });
});
test("uses one explicit month/org RPC and accepts more than the REST row cap", async () => {
  const days = Array.from({ length: 5010 }, (_,index) => ({ ...day, classId: `class-${index}` }));
  jest.mocked(supabaseGet).mockResolvedValue({ days });
  expect(await getMonthlyAttendanceSummary({ monthKey: "2026-10", organizationId: "org-b" })).toEqual(days);
  expect(supabaseGet).toHaveBeenCalledTimes(1);
  expect(supabaseGet).toHaveBeenCalledWith("/rpc/get_monthly_attendance_summary_v1?p_organization_id=org-b&p_start=2026-10-01&p_end=2026-11-01",mockIdentity);
});
test.each(["2026-00","2026-13","2026-1","invalid"])("rejects invalid month %s before HTTP", async monthKey => {
  await expect(getMonthlyAttendanceSummary({ monthKey })).rejects.toThrow("Mês");expect(supabaseGet).not.toHaveBeenCalled();
});
test("leap-year and year transition use civil DATE bounds", async () => {
  jest.mocked(supabaseGet).mockResolvedValue({ days: [] });
  await getMonthlyAttendanceSummary({ monthKey: "2024-02" });await getMonthlyAttendanceSummary({ monthKey: "2026-12" });
  expect(jest.mocked(supabaseGet).mock.calls.map(([url]) => url)).toEqual([
    expect.stringContaining("p_start=2024-02-01&p_end=2024-03-01"),expect.stringContaining("p_start=2026-12-01&p_end=2027-01-01"),
  ]);
});
test("historical empty class identifiers remain included in authorized totals", async () => {
  jest.mocked(supabaseGet).mockResolvedValue({days:[{...day,classId:""}]});
  expect(await getMonthlyAttendanceSummary({monthKey:"2026-10"})).toEqual([{...day,classId:""}]);
});
test.each([null,{}, {days:[{...day,present:51}]},{days:[{...day,total:-1}]},{days:[{...day,date:"2026-11-01"}]},{days:[day,day]},{days:[{...day,total:1.5}]}])("rejects invalid or duplicate payload without a partial summary", async payload => {
  jest.mocked(supabaseGet).mockResolvedValue(payload);
  await expect(getMonthlyAttendanceSummary({ monthKey:"2026-10" })).rejects.toThrow();
});
test.each(["user","session","organization","generation"])("rejects a stale %s after the RPC", async kind => {
  jest.mocked(supabaseGet).mockImplementationOnce(async () => {
    if(kind === "user")mockIdentity.userId="teacher-b";
    if(kind === "session")mockIdentity.generation++;
    if(kind === "organization")mockOrg="org-b";
    if(kind === "generation")mockGeneration++;
    return {days:[day]};
  });
  await expect(getMonthlyAttendanceSummary({ monthKey:"2026-10" })).rejects.toThrow();
});
test("missing RPC and authorization errors remain failures", async () => {
  jest.mocked(supabaseGet).mockRejectedValue(new Error("PGRST202"));
  await expect(getMonthlyAttendanceSummary({ monthKey:"2026-10" })).rejects.toThrow("PGRST202");
  expect(supabaseGet).toHaveBeenCalledTimes(1);
});
test("no active organization never produces a global request", async () => {
  mockOrg=null;expect(await getMonthlyAttendanceSummary({monthKey:"2026-10"})).toEqual([]);expect(supabaseGet).not.toHaveBeenCalled();
});

const missingRpc = () => new Error("Supabase GET error: 404 PGRST202");
const attendanceRow = (index: number, date = "2026-10-24"): AttendanceRow => ({
  id: `call-${String(index).padStart(6, "0")}`, organization_id: "org-a",
  classid: index % 100 === 0 ? "" : `class-${index % 100}`,
  studentid: `student-${index}`, date,
  status: index % 8 === 0 ? "faltou" : index % 8 === 1 ? "legacy-status" : "presente",
  note: "Fictício", createdat: "2026-10-25T12:00:00.000Z",
});

// Exercise the actual canonical reader, not a mocked getAttendanceAll. Enforce
// its organization/date/keyset filters and emulate lower server row caps.
function installLegacyPages(rows: AttendanceRow[], cap = 500, organizationId = "org-a") {
  const pages: { path: string; rows: number }[] = [];
  jest.mocked(supabaseGet).mockImplementation(async (path, identity) => {
    expect(identity).toEqual({ userId: "teacher-a", generation: 1 });
    if (path.startsWith("/rpc/")) throw missingRpc();
    const url = new URL(path, "https://example.test");
    const query = url.searchParams;
    expect(url.pathname).toBe("/attendance_logs");
    expect(query.get("organization_id")).toBe(`eq.${organizationId}`);
    expect(query.get("order")).toBe("date.asc,id.asc");
    expect(query.get("limit")).toBe("500");
    expect(query.has("offset")).toBe(false);
    const bounds = query.getAll("date");
    const start = bounds.find(value => value.startsWith("gte."))?.slice(4);
    const end = bounds.find(value => value.startsWith("lt."))?.slice(3);
    expect(start).toBeDefined(); expect(end).toBeDefined();
    const cursor = query.get("or");
    const lastId = cursor ? /id\.gt\."([^"]+)"/.exec(cursor)?.[1] : null;
    expect(!cursor || lastId).toBeTruthy();
    const page = rows.filter(row => row.organization_id === organizationId && row.date >= start! && row.date < end!
      && (!lastId || row.date > start! || row.date === start && row.id > lastId)).slice(0, cap);
    pages.push({ path, rows: page.length });
    return page;
  });
  return pages;
}

test.each([[5000, 500], [60000, 500], [60000, 137]])(
  "missing exact RPC aggregates all %i authorized rows under cap %i without truncation",
  async (count, cap) => {
    const rows = Array.from({ length: count }, (_, index) => attendanceRow(index,
      `2026-10-${String(Math.floor(index * 30 / count) + 1).padStart(2, "0")}`));
    const pages = installLegacyPages(rows, cap);
    const days = await getMonthlyAttendanceSummary({ monthKey: "2026-10" });
    expect(days.reduce((sum, value) => sum + value.total, 0)).toBe(count);
    expect(days.reduce((sum, value) => sum + value.present, 0)).toBe(rows.filter(row => row.status !== "faltou").length);
    expect(days.some(row => row.classId === "")).toBe(true);
    expect(new Set(days.map(row => JSON.stringify([row.classId, row.date]))).size).toBe(days.length);
    expect(pages.filter(page => page.rows === 0)).toHaveLength(4);
    expect(pages.every(page => page.rows <= cap)).toBe(true);
    expect(pages.length).toBeGreaterThan(Math.floor(count / cap));
  },
);

test("fallback preserves month boundaries, explicit organization and authorized orphan identifiers", async () => {
  const rows = [
    { ...attendanceRow(0, "2026-09-30"), classid: "outside" },
    { ...attendanceRow(1, "2026-10-01"), classid: "" },
    { ...attendanceRow(2, "2026-10-31"), classid: "historical-orphan" },
    { ...attendanceRow(3, "2026-11-01"), classid: "outside" },
    { ...attendanceRow(4, "2026-10-31"), classid: "foreign", organization_id: "org-b" },
  ];
  installLegacyPages(rows);
  expect(await getMonthlyAttendanceSummary({ monthKey: "2026-10", organizationId: "org-a" })).toEqual([
    { classId: "", date: "2026-10-01", total: 1, present: 1 },
    { classId: "historical-orphan", date: "2026-10-31", total: 1, present: 1 },
  ]);
});

test.each([
  ["2024-02", "2024-02-29", "2024-03-01"],
  ["2026-12", "2026-12-31", "2027-01-01"],
])("fallback uses civil bounds across %s", async (monthKey, includedDate, excludedDate) => {
  installLegacyPages([attendanceRow(1, includedDate), attendanceRow(2, excludedDate)]);
  expect(await getMonthlyAttendanceSummary({ monthKey })).toEqual([
    { classId: "class-1", date: includedDate, total: 1, present: 1 },
  ]);
});

test("fallback allows a resolved explicit organization while keeping initial workspace fixed", async () => {
  installLegacyPages([{ ...attendanceRow(1), organization_id: "org-b" }], 500, "org-b");
  expect(await getMonthlyAttendanceSummary({ monthKey: "2026-10", organizationId: "org-b" })).toEqual([
    { classId: "class-1", date: "2026-10-24", total: 1, present: 1 },
  ]);
});

test.each([
  "Supabase GET error: 403 42501", "Supabase GET error: 401 PGRST301",
  "Supabase GET error: 404 42883", "Supabase GET error: 404 REQUEST_FAILED",
  "PGRST202", "Supabase POST error: 404 PGRST202", "Failed to fetch", "Timed out",
])("does not fall back for %s", async message => {
  jest.mocked(supabaseGet).mockRejectedValue(new Error(message));
  await expect(getMonthlyAttendanceSummary({ monthKey: "2026-10" })).rejects.toThrow(message);
  expect(supabaseGet).toHaveBeenCalledTimes(1);
});

test.each(["user", "session", "organization", "generation"])("does not start fallback after stale %s on missing RPC", async kind => {
  jest.mocked(supabaseGet).mockImplementationOnce(async () => {
    if (kind === "user") mockIdentity.userId = "teacher-b";
    if (kind === "session") mockIdentity.generation++;
    if (kind === "organization") mockOrg = "org-b";
    if (kind === "generation") mockGeneration++;
    throw missingRpc();
  });
  await expect(getMonthlyAttendanceSummary({ monthKey: "2026-10" })).rejects.toThrow();
  expect(supabaseGet).toHaveBeenCalledTimes(1);
});

test.each(["user", "session", "organization", "generation"])("rejects stale %s during fallback pages", async kind => {
  jest.mocked(supabaseGet).mockImplementation(async path => {
    if (path.startsWith("/rpc/")) throw missingRpc();
    if (kind === "user") mockIdentity.userId = "teacher-b";
    if (kind === "session") mockIdentity.generation++;
    if (kind === "organization") mockOrg = "org-b";
    if (kind === "generation") mockGeneration++;
    return [];
  });
  await expect(getMonthlyAttendanceSummary({ monthKey: "2026-10" })).rejects.toThrow();
});

test.each(["repeated", "missing-id", "missing-date"])("rejects %s legacy rows instead of publishing a partial total", async kind => {
  jest.mocked(supabaseGet).mockImplementation(async path => {
    if (path.startsWith("/rpc/")) throw missingRpc();
    const row = attendanceRow(1);
    return kind === "repeated" ? [row, row] : [{ ...row, ...(kind === "missing-id" ? { id: "" } : { date: "" }) }];
  });
  await expect(getMonthlyAttendanceSummary({ monthKey: "2026-10" })).rejects.toThrow("inválidos ou repetidos");
});

test("fallback propagates a real transport failure without publishing another range's partial total", async () => {
  jest.mocked(supabaseGet).mockImplementation(async path => {
    if (path.startsWith("/rpc/")) throw missingRpc();
    if (path.includes("gte.2026-10-01")) throw new Error("Failed to fetch");
    return [];
  });
  await expect(getMonthlyAttendanceSummary({ monthKey: "2026-10" })).rejects.toThrow("Failed to fetch");
});
