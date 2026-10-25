import type { AttendanceRow } from "../row-types";

let mockIdentity = { userId: "user-a", generation: 1 };
let mockCacheGeneration = 1;
let mockActiveOrganization: string | null = "org-a";
const mockGet = jest.fn();
const mockActiveOrg = jest.fn(async () => mockActiveOrganization);

jest.mock("../../auth/session", () => {
  class Changed extends Error {}
  return {
    getSessionIdentity: () => ({ ...mockIdentity }),
    assertSessionIdentity: (identity: typeof mockIdentity) => {
      if (identity.userId !== mockIdentity.userId || identity.generation !== mockIdentity.generation) throw new Changed();
    },
    SessionIdentityChangedError: Changed,
  };
});
jest.mock("../client", () => ({
  CACHE_KEYS: {},
  getActiveOrganizationId: () => mockActiveOrg(),
  getScopedOrganizationId: async (id?: string | null) => id ?? mockActiveOrganization,
  getReadCacheGeneration: () => mockCacheGeneration,
  supabaseGet: (...args: unknown[]) => mockGet(...args),
}));
jest.mock("@sentry/react-native", () => ({ addBreadcrumb: jest.fn() }));
jest.mock("../classes", () => ({}));
jest.mock("../training", () => ({}));
jest.mock("../training-sessions", () => ({}));
jest.mock("../../api/class-responsibles", () => ({}));
jest.mock("../../api/notifications", () => ({}));

// eslint-disable-next-line import/first -- mocked transport and session precede the loader
import { getAttendanceAll, getAttendanceSignalRecords } from "../students";
// eslint-disable-next-line import/first -- use the mocked identity error constructor
import { SessionIdentityChangedError } from "../../auth/session";

const row = (index: number): AttendanceRow => ({
  id: `attendance-${String(index).padStart(5, "0")}`,
  classid: "class-a", studentid: `student-${index}`,
  date: index < 600 ? "2026-10-01" : "2026-10-02",
  status: index % 3 === 0 ? "faltou" : "presente",
  note: "Nota fictícia", pain_score: index % 5,
  createdat: "2026-10-24T12:00:00.000Z",
});
const options = { organizationId: "org-a", startIso: "2026-10-01", endIso: "2026-10-03" };
const monthOptions = { organizationId: "org-a", startIso: "2026-10-01T03:00:00.000Z", endIso: "2026-11-01T03:00:00.000Z" };

beforeEach(() => {
  jest.clearAllMocks();
  mockIdentity = { userId: "user-a", generation: 1 };
  mockCacheGeneration = 1;
  mockActiveOrganization = "org-a";
  mockActiveOrg.mockImplementation(async () => mockActiveOrganization);
  mockGet.mockResolvedValue([]);
});

test.each([500, 137])("reads 1,205 calls with keyset pages under a server cap of %i", async cap => {
  const rows = Array.from({ length: 1205 }, (_, index) => row(index));
  let position = 0;
  mockGet.mockImplementation(async (path: string, identity: typeof mockIdentity) => {
    const query = new URL(path, "https://example.test").searchParams;
    expect(identity).toEqual({ userId: "user-a", generation: 1 });
    expect(query.get("organization_id")).toBe("eq.org-a");
    expect(query.get("order")).toBe("date.asc,id.asc");
    expect(query.get("offset")).toBeNull();
    expect(query.get("limit")).toBe("500");
    expect(query.get("select")).toBe("id,classid,studentid,date,status,note,pain_score,createdat");
    expect(query.getAll("date")).toContain("lt.2026-10-03");
    if (position === 0) {
      expect(query.get("or")).toBeNull();
      expect(query.getAll("date")).toContain("gte.2026-10-01");
    } else {
      const previous = rows[position - 1];
      expect(query.getAll("date")).toContain(`gte.${previous.date}`);
      expect(query.get("or")).toBe(`(date.gt."${previous.date}",and(date.eq."${previous.date}",id.gt."${previous.id}"))`);
    }
    const page = rows.slice(position, position + cap);
    position += page.length;
    return page;
  });
  const result = await getAttendanceAll(options);
  expect(result).toHaveLength(1205);
  expect(new Set(result.map(item => item.id)).size).toBe(1205);
  expect(result[0].date).toBe("2026-10-02");
  expect(result.at(-1)?.date).toBe("2026-10-01");
  expect(result.at(-1)).toMatchObject({ id: "attendance-00000", status: "faltou", note: "Nota fictícia", painScore: 0 });
});

test.each([1000, 500, 137])("unbounded reads request 1,000 rows and remain complete under server cap %i", async cap => {
  const rows = Array.from({ length: 1205 }, (_, index) => row(index));
  let position = 0;
  mockGet.mockImplementation(async (path: string, identity: typeof mockIdentity) => {
    const query = new URL(path, "https://example.test").searchParams;
    expect(identity).toEqual(mockIdentity);
    expect(query.get("limit")).toBe("1000");
    expect(query.get("select")).toBe("id,classid,studentid,date,status,note,pain_score,createdat");
    expect(query.get("order")).toBe("date.asc,id.asc");
    expect(query.get("offset")).toBeNull();
    expect(query.getAll("date").every(value => value.startsWith("gte."))).toBe(true);
    if (position) {
      const previous = rows[position - 1];
      expect(query.get("or")).toBe(`(date.gt."${previous.date}",and(date.eq."${previous.date}",id.gt."${previous.id}"))`);
    }
    const page = rows.slice(position, position + cap);
    position += page.length;
    return page;
  });
  const result = await getAttendanceAll({ organizationId: "org-a" });
  expect(result).toEqual([...rows].reverse().map(value => ({
    id: value.id, classId: value.classid, studentId: value.studentid, date: value.date,
    status: value.status, note: value.note, painScore: value.pain_score, createdAt: value.createdat,
  })));
  expect(mockGet).toHaveBeenCalledTimes(Math.ceil(rows.length / cap) + 1);
});

test("quotes reserved cursor ID characters without changing the logical filter", async () => {
  const id = 'id,with.(reserved)"\\characters';
  mockGet.mockResolvedValueOnce([{ ...row(1), id }]);
  await getAttendanceAll(options);
  const query = new URL(mockGet.mock.calls[1][0], "https://example.test").searchParams;
  expect(query.get("or")).toBe('(date.gt."2026-10-01",and(date.eq."2026-10-01",id.gt."id,with.(reserved)\\"\\\\characters"))');
});

test.each([1000, 137])("signal projection preserves complete history and public order under cap %i", async cap => {
  const rows = Array.from({ length: 1205 }, (_, index) => ({ ...row(index),
    ...(index === 0 ? { date: "2026-01-01" } : {}), createdat: `2026-10-24T12:00:${String(index % 60).padStart(2, "0")}.123456Z` }));
  const install = (columns: string) => {
    let position = 0;
    mockGet.mockImplementation(async (path: string) => {
      const query = new URL(path, "https://example.test").searchParams;
      expect(query.get("select")).toBe(columns); expect(query.get("limit")).toBe("1000");
      expect(query.get("order")).toBe("date.asc,id.asc"); expect(query.has("offset")).toBe(false);
      if (!position) expect(query.has("date")).toBe(false);
      else { const previous = rows[position - 1]; expect(query.get("or")).toBe(`(date.gt."${previous.date}",and(date.eq."${previous.date}",id.gt."${previous.id}"))`); }
      const page = rows.slice(position, position + cap); position += page.length;
      return columns.includes("classid") ? page : page.map(({ id, studentid, date, status, createdat }) => ({ id, studentid, date, status, createdat }));
    });
  };
  install("id,classid,studentid,date,status,note,pain_score,createdat");
  const full = await getAttendanceAll({ organizationId: "org-a" });
  mockGet.mockClear(); install("id,studentid,date,status,createdat");
  const signals = await getAttendanceSignalRecords({ organizationId: "org-a" });
  expect(signals).toEqual(full.map(({ id, studentId, date, status, createdAt }) => ({ id, studentId, date, status, createdAt })));
  expect(Object.keys(signals[0]).sort()).toEqual(["createdAt", "date", "id", "status", "studentId"]);
  expect(signals.at(-1)?.date).toBe("2026-01-01");
  expect(mockGet).toHaveBeenCalledTimes(Math.ceil(rows.length / cap) + 1);
});

test.each(["session", "organization", "generation", "failed page"])("signal projection rejects %s without returning partial records", async change => {
  let page = 0;
  mockGet.mockImplementation(async () => {
    if (++page === 1) return [row(1)];
    if (change === "session") mockIdentity.generation += 1;
    if (change === "organization") mockActiveOrganization = "org-b";
    if (change === "generation") mockCacheGeneration += 2;
    if (change === "failed page") throw new Error("Failed to fetch");
    return [row(2)];
  });
  await expect(getAttendanceSignalRecords({ organizationId: "org-a" })).rejects.toThrow();
  expect(mockGet).toHaveBeenCalledTimes(2);
});

test.each([new Error("Failed to fetch"), new Error("Supabase GET error: 403")])("does not return partial totals after a page fails (%s)", async error => {
  mockGet.mockResolvedValueOnce([row(1)]).mockRejectedValueOnce(error);
  await expect(getAttendanceAll(options)).rejects.toBe(error);
});

test("rejects repeated pages rather than looping or counting duplicates", async () => {
  mockGet.mockResolvedValue([row(1)]);
  await expect(getAttendanceAll(options)).rejects.toThrow("repetidos");
  expect(mockGet).toHaveBeenCalledTimes(2);
});

test.each(["account", "same-account-login", "organization", "round-trip"])('invalidates pages after %s changes', async kind => {
  mockGet.mockImplementationOnce(async () => {
    if (kind === "account") mockIdentity = { userId: "user-b", generation: 2 };
    if (kind === "same-account-login") mockIdentity.generation += 1;
    if (kind === "organization") mockActiveOrganization = "org-b";
    if (kind === "round-trip") mockCacheGeneration += 2;
    return [row(1)];
  });
  await expect(getAttendanceAll(options)).rejects.toBeInstanceOf(SessionIdentityChangedError);
  expect(mockGet).toHaveBeenCalledTimes(1);
});

test("rechecks session after awaiting the active workspace", async () => {
  let calls = 0;
  mockActiveOrg.mockImplementation(async () => {
    if (++calls === 2) mockIdentity.generation += 1;
    return mockActiveOrganization;
  });
  await expect(getAttendanceAll(options)).rejects.toBeInstanceOf(SessionIdentityChangedError);
  expect(mockGet).not.toHaveBeenCalled();
});

test("preserves an explicit authorized organization while guarding the initial active workspace", async () => {
  await expect(getAttendanceAll({ organizationId: "org-student" })).resolves.toEqual([]);
  expect(mockGet).toHaveBeenCalledWith(expect.stringContaining("organization_id=eq.org-student"), mockIdentity);
});

test("does not perform an unscoped or unauthenticated read", async () => {
  mockActiveOrganization = null;
  await expect(getAttendanceAll()).resolves.toEqual([]);
  mockActiveOrganization = "org-a";
  mockIdentity.userId = "";
  await expect(getAttendanceAll(options)).rejects.toThrow("Sessão expirada");
  expect(mockGet).not.toHaveBeenCalled();
});

test.each([500, 137])("reads a complete month in at most four disjoint date ranges under cap %i", async cap => {
  const rows = Array.from({ length: 3100 }, (_, index) => ({
    ...row(index), date: `2026-10-${String(Math.floor(index / 100) + 1).padStart(2, "0")}`,
  }));
  const outside = { ...row(4000), date: "2026-11-01" };
  let pending = 0;
  let peak = 0;
  const starts: string[] = [];
  mockGet.mockImplementation(async (path: string, identity: typeof mockIdentity) => {
    const query = new URL(path, "https://example.test").searchParams;
    expect(identity).toEqual(mockIdentity);
    expect(query.get("organization_id")).toBe("eq.org-a");
    expect(query.get("offset")).toBeNull();
    expect(query.get("order")).toBe("date.asc,id.asc");
    const dates = query.getAll("date");
    const lower = dates.find(value => value.startsWith("gte."))!.slice(4);
    const upper = dates.find(value => value.startsWith("lt."))!.slice(3);
    const cursor = query.get("or")?.match(/date\.eq\."([^"]+)",id\.gt\."([^"]+)"/);
    if (!cursor) starts.push(`${lower}|${upper}`);
    pending += 1;
    peak = Math.max(peak, pending);
    await Promise.resolve();
    pending -= 1;
    return [...rows, outside].filter(value => value.date >= lower.slice(0, 10) && value.date < upper.slice(0, 10)
      && (!cursor || value.date > cursor[1] || value.date === cursor[1] && value.id > cursor[2])).slice(0, cap);
  });
  const result = await getAttendanceAll(monthOptions);
  expect(peak).toBe(4);
  expect(starts).toEqual([
    "2026-10-01T03:00:00.000Z|2026-10-09",
    "2026-10-09|2026-10-17",
    "2026-10-17|2026-10-25",
    "2026-10-25|2026-11-01T03:00:00.000Z",
  ]);
  expect(result.map(value => value.id)).toEqual(rows.map(value => value.id).reverse());
  expect(result).toHaveLength(3100);
  expect(result.at(-1)).toMatchObject({ id: rows[0].id, date: "2026-10-01", status: "faltou", note: "Nota fictícia", painScore: 0 });
  expect(result[0]).toMatchObject({ id: rows.at(-1)!.id, date: "2026-10-31" });
});

test("keeps SQL range order despite responses finishing out of order and empty ranges", async () => {
  const resolvers: ((value: AttendanceRow[]) => void)[] = [];
  mockGet.mockImplementation(() => new Promise<AttendanceRow[]>(resolve => resolvers.push(resolve)));
  const reading = getAttendanceAll(monthOptions);
  for (let count = 0; count < 15 && resolvers.length < 4; count += 1) await Promise.resolve();
  expect(resolvers).toHaveLength(4);
  resolvers[3]([{ ...row(3), date: "2026-10-31" }]);
  resolvers[2]([{ ...row(2), date: "2026-10-20" }]);
  resolvers[1]([]);
  resolvers[0]([{ ...row(0), date: "2026-10-01" }]);
  for (let count = 0; count < 15 && resolvers.length < 7; count += 1) await Promise.resolve();
  expect(resolvers).toHaveLength(7);
  resolvers.slice(4).forEach(resolve => resolve([]));
  await expect(reading).resolves.toMatchObject([{ id: row(3).id }, { id: row(2).id }, { id: row(0).id }]);
});

test.each([
  {}, { startIso: "2026-10-01" }, { startIso: "2026-10-01", endIso: "2026-10-08" },
  { startIso: "2026-10-01", endIso: "2026-12-01" },
  { startIso: "2026-02-30", endIso: "2026-03-10" },
])("keeps short, unbounded, long or noncanonical date intervals serial (%j)", async bounds => {
  await getAttendanceAll({ organizationId: "org-a", ...bounds });
  expect(mockGet).toHaveBeenCalledTimes(1);
});

test.each([["2026-10-09", 4], ["2026-10-10", 3]])("bounds concurrency for the eight/nine-day edge ending %s", async (endIso, count) => {
  await getAttendanceAll({ organizationId: "org-a", startIso: "2026-10-01", endIso: String(endIso) });
  expect(mockGet).toHaveBeenCalledTimes(Number(count));
  const ranges = mockGet.mock.calls.map(([path]) => {
    const dates = new URL(path, "https://example.test").searchParams.getAll("date");
    return { start: dates.find(value => value.startsWith("gte."))!.slice(4), end: dates.find(value => value.startsWith("lt."))!.slice(3) };
  });
  expect(ranges[0].start).toBe("2026-10-01");
  expect(ranges.at(-1)?.end).toBe(endIso);
  ranges.slice(1).forEach((range, index) => expect(range.start).toBe(ranges[index].end));
});

test("shares the 1,000 request safety budget across all four ranges", async () => {
  let index = 0;
  mockGet.mockImplementation(async (path: string) => {
    const query = new URL(path, "https://example.test").searchParams;
    const lower = query.getAll("date").find(value => value.startsWith("gte."))!.slice(4, 14);
    return [{ ...row(index++), date: lower }];
  });
  await expect(getAttendanceAll(monthOptions)).rejects.toThrow("limite seguro");
  expect(mockGet).toHaveBeenCalledTimes(1000);
});

test("a failed range rejects the whole read and stops other ranges before another page", async () => {
  const error = new Error("Supabase GET error: 403");
  const pending: ((value: AttendanceRow[]) => void)[] = [];
  mockGet.mockImplementation(() => new Promise<AttendanceRow[]>(resolve => pending.push(resolve)));
  const reading = getAttendanceAll(monthOptions);
  const rejection = expect(reading).rejects.toBe(error);
  for (let count = 0; count < 15 && pending.length < 4; count += 1) await Promise.resolve();
  pending[0]([{ ...row(0), date: "2026-10-01" }]);
  mockGet.mockRejectedValueOnce(error);
  await rejection;
  pending.slice(1).forEach((resolve, index) => resolve([{ ...row(index + 1), date: "2026-10-20" }]));
  for (let count = 0; count < 15; count += 1) await Promise.resolve();
  expect(mockGet).toHaveBeenCalledTimes(5);
});

test("a failed range prevents a sibling awaiting its workspace from resuming pagination", async () => {
  const error = new Error("Supabase GET error: 403");
  const pending: { resolve: (value: AttendanceRow[]) => void; reject: (error: Error) => void }[] = [];
  let releaseWorkspace: ((value: string) => void) | undefined;
  let workspaceReads = 0;
  mockActiveOrg.mockImplementation(() => ++workspaceReads === 6
    ? new Promise<string>(resolve => { releaseWorkspace = resolve; })
    : Promise.resolve(mockActiveOrganization));
  mockGet.mockImplementation(() => new Promise<AttendanceRow[]>((resolve, reject) => pending.push({ resolve, reject })));
  const reading = getAttendanceAll(monthOptions);
  const rejection = expect(reading).rejects.toBe(error);
  for (let count = 0; count < 15 && pending.length < 4; count += 1) await Promise.resolve();
  expect(pending).toHaveLength(4);
  pending[0].resolve([row(0)]);
  for (let count = 0; count < 15 && !releaseWorkspace; count += 1) await Promise.resolve();
  expect(releaseWorkspace).toBeDefined();
  pending[1].reject(error);
  await rejection;
  releaseWorkspace!("org-a");
  pending.slice(2).forEach(entry => entry.resolve([]));
  for (let count = 0; count < 15; count += 1) await Promise.resolve();
  expect(mockGet).toHaveBeenCalledTimes(4);
});

test.each(["account", "same-account-login", "organization", "round-trip"])("invalidates all four ranges after %s changes", async kind => {
  const pending: ((value: AttendanceRow[]) => void)[] = [];
  mockGet.mockImplementation(() => new Promise<AttendanceRow[]>(resolve => pending.push(resolve)));
  const reading = getAttendanceAll(monthOptions);
  const rejection = expect(reading).rejects.toBeInstanceOf(SessionIdentityChangedError);
  for (let count = 0; count < 15 && pending.length < 4; count += 1) await Promise.resolve();
  expect(pending).toHaveLength(4);
  if (kind === "account") mockIdentity = { userId: "user-b", generation: 2 };
  if (kind === "same-account-login") mockIdentity.generation += 1;
  if (kind === "organization") mockActiveOrganization = "org-b";
  if (kind === "round-trip") mockCacheGeneration += 2;
  pending.forEach(resolve => resolve([]));
  await rejection;
  expect(mockGet).toHaveBeenCalledTimes(4);
});

test("rejects duplicate IDs across ranges instead of publishing an ambiguous total", async () => {
  mockGet.mockResolvedValueOnce([row(1)]).mockResolvedValueOnce([{ ...row(1), date: "2026-10-09" }]);
  await expect(getAttendanceAll(monthOptions)).rejects.toThrow("repetidos");
});
