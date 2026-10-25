import type { StudentRow } from "../row-types";
jest.mock("../student-financial-read", () => ({ readStudentFinancialStatuses: async () => null }));

let mockIdentity = { userId: "user-a", generation: 1 };
let mockCacheGeneration = 1;
let mockActiveOrganizationId: string | null = "org-a";
const mockSupabaseGet = jest.fn();
const mockReadCache = jest.fn();
const mockWriteCache = jest.fn();

jest.mock("../../auth/session", () => {
  class IdentityChangedError extends Error {}
  return {
    getSessionIdentity: () => ({ ...mockIdentity }),
    getAccessToken: () => "fixture-token",
    getSessionUserId: jest.fn(),
    SessionIdentityChangedError: IdentityChangedError,
    assertSessionIdentity: (identity: typeof mockIdentity) => {
      if (identity.userId !== mockIdentity.userId || identity.generation !== mockIdentity.generation) {
        throw new IdentityChangedError("session changed");
      }
    },
  };
});
jest.mock("../client", () => ({
  CACHE_KEYS: { students: "cache_students_v1" },
  getActiveOrganizationId: async () => mockActiveOrganizationId,
  getReadCacheGeneration: () => mockCacheGeneration,
  getScopedOrganizationId: async (value?: string | null) => value ?? mockActiveOrganizationId,
  isNetworkError: (error: unknown) => error instanceof Error && error.message === "Failed to fetch",
  isAuthError: () => false,
  isMissingRelation: () => false,
  supabaseGet: (...args: unknown[]) => mockSupabaseGet(...args),
  readCache: (...args: unknown[]) => mockReadCache(...args),
  writeCache: (...args: unknown[]) => mockWriteCache(...args),
}));
jest.mock("@sentry/react-native", () => ({ addBreadcrumb: jest.fn(), captureException: jest.fn() }));
jest.mock("../classes", () => ({}));
jest.mock("../training", () => ({}));
jest.mock("../training-sessions", () => ({}));
jest.mock("../../api/class-responsibles", () => ({}));
jest.mock("../../api/notifications", () => ({}));

// eslint-disable-next-line import/first -- dependencies must be mocked before loading the module
import { getStudentBirthdayCandidates, getStudents } from "../students";
// eslint-disable-next-line import/first -- use the same mocked error constructor as the loader
import { SessionIdentityChangedError } from "../../auth/session";

const row = (id = "student-1"): StudentRow => ({
  id, name: `Atleta de teste ${id}`, organization_id: "org-a", classid: "class-a",
  age: 16, phone: "11999990000", login_email: `${id}@example.test`,
  photo_url: `https://example.test/photos/${id}.jpg`, ra: "2026100001",
  cpf_masked: "***.***.***-00", rg: "00.000.000-0", college_course: "Curso fictício",
  guardian_name: "Responsável fictício", guardian_phone: "11999990001", guardian_relation: "responsavel",
  address: "Endereço fictício de teste", gender_identity: "nao_informar",
  health_issue: false, health_issue_notes: "Observação fictícia de saúde",
  medication_use: false, medication_notes: "Observação fictícia de medicação",
  health_observations: "Observação fictícia de cadastro", membership_status: "active",
  financial_status: "unknown", position_primary: "levantador", position_secondary: "indefinido",
  athlete_objective: "base", learning_style: "misto", birthdate: "2010-10-23",
  createdat: "2026-01-01T12:00:00.000Z",
});

beforeEach(() => {
  jest.clearAllMocks();
  mockIdentity = { userId: "user-a", generation: 1 };
  mockCacheGeneration = 1;
  mockActiveOrganizationId = "org-a";
  mockSupabaseGet.mockResolvedValue([]);
  mockReadCache.mockResolvedValue(null);
  mockWriteCache.mockResolvedValue(undefined);
});

test("loads and caches only birthday fields without replacing the directory or loading finances", async () => {
  mockSupabaseGet.mockResolvedValueOnce([row(), { ...row("student-2"), birthdate: null }]);
  const candidates = await getStudentBirthdayCandidates({ organizationId: "org-a" });
  expect(candidates).toEqual([
    { id: "student-1", name: "Atleta de teste student-1", birthDate: "2010-10-23" },
    { id: "student-2", name: "Atleta de teste student-2", birthDate: "" },
  ]);
  expect(mockSupabaseGet).toHaveBeenCalledTimes(2);
  expect(mockSupabaseGet).toHaveBeenCalledWith(
    "/students?select=id,name,birthdate&organization_id=eq.org-a&order=name.asc,id.asc&limit=500",
    { userId: "user-a", generation: 1 },
  );
  expect(mockWriteCache).toHaveBeenCalledWith("cache_students_v1_org-a_birthdays", candidates);
  expect(mockWriteCache).not.toHaveBeenCalledWith("cache_students_v1_org-a", expect.anything());
  expect(JSON.stringify(candidates)).not.toMatch(/health|financial|phone|guardian|email/);
});

test("does not issue a global query without an organization", async () => {
  mockActiveOrganizationId = null;
  await expect(getStudentBirthdayCandidates()).resolves.toEqual([]);
  expect(mockSupabaseGet).not.toHaveBeenCalled();
});

test("rejects an organization other than the current workspace before reading", async () => {
  await expect(getStudentBirthdayCandidates({ organizationId: "org-b" })).rejects.toBeInstanceOf(SessionIdentityChangedError);
  expect(mockSupabaseGet).not.toHaveBeenCalled();
  expect(mockReadCache).not.toHaveBeenCalled();
});

test("does not read student data or caches without a session", async () => {
  mockIdentity = { userId: "", generation: 2 };
  await expect(getStudentBirthdayCandidates({ organizationId: "org-a" })).rejects.toThrow("Sessão expirada");
  expect(mockSupabaseGet).not.toHaveBeenCalled();
  expect(mockReadCache).not.toHaveBeenCalled();
});

test.each(["account", "organization round trip"])("discards a response after an %s change", async (kind) => {
  mockSupabaseGet.mockImplementationOnce(async () => {
    if (kind === "account") mockIdentity = { userId: "user-b", generation: 2 };
    else mockCacheGeneration += 2;
    return [row()];
  });
  await expect(getStudentBirthdayCandidates({ organizationId: "org-a" })).rejects.toBeInstanceOf(SessionIdentityChangedError);
  expect(mockWriteCache).not.toHaveBeenCalled();
  expect(mockReadCache).not.toHaveBeenCalled();
});

test("retains the existing full-directory offline fallback but returns only birthday fields", async () => {
  mockSupabaseGet.mockRejectedValueOnce(new Error("Failed to fetch"));
  mockReadCache.mockResolvedValueOnce(null).mockResolvedValueOnce([{ id: "cached", name: "Atleta local", birthDate: "2010-10-23", healthIssueNotes: "private" }]);
  await expect(getStudentBirthdayCandidates({ organizationId: "org-a" })).resolves.toEqual([
    { id: "cached", name: "Atleta local", birthDate: "2010-10-23" },
  ]);
  expect(mockReadCache).toHaveBeenCalledWith("cache_students_v1_org-a");
  expect(mockWriteCache).not.toHaveBeenCalled();
});

test("uses its own small offline cache when the directory was never opened", async () => {
  mockSupabaseGet.mockRejectedValueOnce(new Error("Failed to fetch"));
  mockReadCache.mockResolvedValueOnce([{ id: "cached", name: "Atleta local", birthDate: "2010-10-23" }]);
  await expect(getStudentBirthdayCandidates()).resolves.toHaveLength(1);
  expect(mockReadCache).toHaveBeenLastCalledWith("cache_students_v1_org-a_birthdays");
});

test.each([false, true])("keeps the latest birthday projection authoritative over an older directory (empty=%s)", async (empty) => {
  const current = empty ? [] : [{ id: "current", name: "Nome atualizado", birthDate: "2010-10-24" }];
  const cached = new Map<string, unknown>([
    ["cache_students_v1_org-a", [{ id: "removed", name: "Nome antigo", birthDate: "2010-10-23" }]],
  ]);
  mockWriteCache.mockImplementation(async (key: string, value: unknown) => { cached.set(key, value); });
  mockReadCache.mockImplementation(async (key: string) => cached.get(key) ?? null);
  mockSupabaseGet.mockResolvedValueOnce(current.map(({ id, name, birthDate }) => ({ id, name, birthdate: birthDate })));
  await expect(getStudentBirthdayCandidates()).resolves.toEqual(current);

  mockSupabaseGet.mockRejectedValueOnce(new Error("Failed to fetch"));
  await expect(getStudentBirthdayCandidates()).resolves.toEqual(current);
  expect(mockReadCache).toHaveBeenCalledTimes(1);
  expect(mockReadCache).toHaveBeenCalledWith("cache_students_v1_org-a_birthdays");
  expect(cached.get("cache_students_v1_org-a")).toEqual([{ id: "removed", name: "Nome antigo", birthDate: "2010-10-23" }]);
});

test.each([false, true])("uses a newer full directory over an older birthday projection (empty=%s)", async (empty) => {
  const currentRows = empty ? [] : [{ ...row("current"), name: "Nome atualizado", birthdate: "2010-10-24" }];
  const cached = new Map<string, unknown>();
  mockWriteCache.mockImplementation(async (key: string, value: unknown) => { cached.set(key, value); });
  mockReadCache.mockImplementation(async (key: string) => cached.get(key) ?? null);
  mockSupabaseGet.mockResolvedValueOnce([row("removed")]);
  await getStudentBirthdayCandidates();
  expect(cached.get("cache_students_v1_org-a_birthdays")).toHaveLength(1);

  mockSupabaseGet.mockImplementation(async (path: string) => path.startsWith("/students?") && !new URL(path, "https://example.test").searchParams.has("name") ? currentRows : []);
  const current = await getStudents({ organizationId: "org-a" });
  expect(cached.get("cache_students_v1_org-a_birthdays")).toBeNull();

  mockSupabaseGet.mockRejectedValueOnce(new Error("Failed to fetch"));
  await expect(getStudentBirthdayCandidates()).resolves.toEqual(current.map(({ id, name, birthDate }) => ({ id, name, birthDate })));
});

test("returns the previous empty fallback when there is no offline cache", async () => {
  mockSupabaseGet.mockRejectedValueOnce(new Error("Failed to fetch"));
  await expect(getStudentBirthdayCandidates()).resolves.toEqual([]);
});

test("does not turn an authorization failure into a cached success", async () => {
  mockSupabaseGet.mockRejectedValueOnce(new Error("Supabase GET error: 403"));
  await expect(getStudentBirthdayCandidates()).rejects.toThrow("403");
  expect(mockReadCache).not.toHaveBeenCalled();
});

test("rejects cached results if the account changes during storage access", async () => {
  mockSupabaseGet.mockRejectedValueOnce(new Error("Failed to fetch"));
  mockReadCache.mockImplementationOnce(async () => {
    mockIdentity = { userId: "user-b", generation: 2 };
    return [{ id: "cached", name: "Atleta local", birthDate: "2010-10-23" }];
  });
  await expect(getStudentBirthdayCandidates()).rejects.toBeInstanceOf(SessionIdentityChangedError);
});

test("compares actual loader requests and serialized payloads on 1,000 synthetic registrations", async () => {
  const students = Array.from({ length: 1000 }, (_, index) => row(`student-${index}`));
  const metrics = { requests: 0, payloadBytes: 0 };
  mockSupabaseGet.mockImplementation(async (path: string) => {
    const url = new URL(path, "https://example.test");
    const lowerName = url.searchParams.get("name")?.slice(4);
    const offset = lowerName === undefined ? 0 : students.findIndex(student => student.name === lowerName) + 1;
    const limit = Number(url.searchParams.get("limit") || students.length);
    const page = students.slice(offset, offset + limit);
    const data = url.pathname === "/students"
      ? url.searchParams.get("select") === "*" ? page : page.map(({ id, name, birthdate }) => ({ id, name, birthdate }))
      : (url.searchParams.get("student_id") ?? "").slice(4, -1).split(",").map((id) => ({ student_id: id, status: "regular" }));
    metrics.requests += 1;
    metrics.payloadBytes += Buffer.byteLength(JSON.stringify(data), "utf8");
    return data;
  });

  const fullStudents = await getStudents({ organizationId: "org-a" });
  const before = { ...metrics, cacheBytes: Buffer.byteLength(JSON.stringify(mockWriteCache.mock.calls[0][1]), "utf8") };
  mockWriteCache.mockClear();
  metrics.requests = 0;
  metrics.payloadBytes = 0;
  const candidates = await getStudentBirthdayCandidates({ organizationId: "org-a" });
  const after = { ...metrics, cacheBytes: Buffer.byteLength(JSON.stringify(mockWriteCache.mock.calls[0][1]), "utf8") };

  expect(candidates).toEqual(fullStudents.map(({ id, name, birthDate }) => ({ id, name, birthDate })));
  expect(before.requests).toBe(13);
  expect(after.requests).toBe(3);
  expect(after.payloadBytes).toBeLessThan(before.payloadBytes / 5);
  expect(after.cacheBytes).toBeLessThan(before.cacheBytes / 5);
  // Synthetic JSON sizes and mocked request counts only; not network time, CPU or FPS.
  if (process.env.BIRTHDAY_BENCHMARK_REPORT === "1") {
    console.info(JSON.stringify({ fixture: "1000 synthetic students", before, after }));
  }
});

test.each([getStudents, getStudentBirthdayCandidates])("reads all pages beyond the server cap with stable ordering (%#)", async (load) => {
  const rows = Array.from({ length: 1205 }, (_, index) => row(`student-${index}`));
  const cursors: (string | null)[] = [];
  mockSupabaseGet.mockImplementation(async (path: string, identity: typeof mockIdentity) => {
    const url = new URL(path, "https://example.test");
    if (url.pathname !== "/students") return [];
    expect(identity).toEqual({ userId: "user-a", generation: 1 });
    expect(url.searchParams.get("organization_id")).toBe("eq.org-a");
    expect(url.searchParams.get("order")).toBe("name.asc,id.asc");
    expect(url.searchParams.has("offset")).toBe(false);
    const lowerName = url.searchParams.get("name");
    cursors.push(lowerName);
    const offset = lowerName === null ? 0 : rows.findIndex(row => row.name === lowerName.slice(4)) + 1;
    // A short page can be a server cap, not the end of the directory.
    return rows.slice(offset, offset + 137);
  });
  const result = await load({ organizationId: "org-a" });
  expect(result).toHaveLength(1205);
  expect(new Set(result.map(student => student.id)).size).toBe(1205);
  expect(cursors).toEqual([null, ...[136, 273, 410, 547, 684, 821, 958, 1095, 1204].map(index => `gte.${rows[index].name}`)]);
});

test.each([getStudents, getStudentBirthdayCandidates])("keeps raw names and id tie-breakers in the server cursor, including quoted punctuation (%#)", async load => {
  const name = '  Ána, O\'Neil "A" \\ (turma)&+%\n';
  const id = 'athlete-"2"\\,()&+';
  const first = { ...row("first"), name };
  const second = { ...row(id), name };
  const last = { ...row("last"), name: "Zélia" };
  const pages = [[first], [second], [last], []];
  mockSupabaseGet.mockImplementation(async (path: string) => path.startsWith("/students?") ? pages.shift()! : []);
  const result = await load();
  expect(result.map(student => student.id)).toEqual([first.id, second.id, last.id]);
  const requests = mockSupabaseGet.mock.calls.filter(([path]: [string]) => path.startsWith("/students?"));
  const query = new URL(requests[2][0], "https://example.test").searchParams;
  expect(query.get("name")).toBe(`gte.${name}`);
  const expression = query.get("or")!;
  // Decode the protocol's quoted values independently: escapes consume the next
  // character, so JSON-escaping a literal newline would fail this round trip.
  const values = [...expression.matchAll(/"((?:\\[\s\S]|[^"\\])*)"/g)]
    .map(match => match[1].replace(/\\([\s\S])/g, "$1"));
  expect(values).toEqual([name, name, id]);
  expect(expression.startsWith("(name.gt.")).toBe(true);
  expect(expression).toContain(",and(name.eq.");
  expect(expression).toContain(",id.gt.");
  expect(requests.every(([path]: [string]) => !new URL(path, "https://example.test").searchParams.has("offset"))).toBe(true);
});

test.each([getStudents, getStudentBirthdayCandidates])("supports equal empty names using the id cursor without treating a short page as complete (%#)", async load => {
  const pages = [[{ ...row("a"), name: "" }], [{ ...row("b"), name: "" }], []];
  mockSupabaseGet.mockImplementation(async (path: string) => path.startsWith("/students?") ? pages.shift()! : []);
  expect((await load()).map(student => student.id)).toEqual(["a", "b"]);
  const second = new URL(mockSupabaseGet.mock.calls[1][0], "https://example.test").searchParams;
  expect(second.get("name")).toBe("gte.");
  expect(second.get("or")).toBe('(name.gt."",and(name.eq."",id.gt."a"))');
});

test.each([getStudents, getStudentBirthdayCandidates])("rejects an unexpected NULL name instead of creating an invalid cursor or partial cache (%#)", async load => {
  mockSupabaseGet.mockResolvedValueOnce([{ ...row("invalid"), name: null }]);
  await expect(load()).rejects.toThrow("nome inválido");
  expect(mockWriteCache).not.toHaveBeenCalled();
  expect(mockSupabaseGet).toHaveBeenCalledTimes(1);
});

test("preserves an explicitly authorized student/family organization outside the professional workspace", async () => {
  mockSupabaseGet.mockResolvedValueOnce([{ ...row(), organization_id: "org-student" }]);
  await expect(getStudents({ organizationId: "org-student" })).resolves.toHaveLength(1);
  expect(mockSupabaseGet).toHaveBeenCalledWith(
    expect.stringContaining("organization_id=eq.org-student"),
    { userId: "user-a", generation: 1 },
  );
  expect(mockWriteCache).toHaveBeenCalledWith("cache_students_v1_org-student", expect.any(Array));
});

test.each([getStudents, getStudentBirthdayCandidates])("rejects repeated pages without persisting an incomplete directory (%#)", async (load) => {
  mockSupabaseGet.mockResolvedValue([row()]);
  await expect(load()).rejects.toThrow("registros repetidos");
  expect(mockWriteCache).not.toHaveBeenCalled();
});

test.each([getStudents, getStudentBirthdayCandidates])("keeps the previous complete cache after an intermediate page fails (%#)", async (load) => {
  const cached = [{ id: "cached", name: "Nome local", birthDate: "2010-10-23", financialStatus: "unknown" }];
  mockReadCache.mockResolvedValue(cached);
  mockSupabaseGet.mockResolvedValueOnce([row()]).mockRejectedValueOnce(new Error("Failed to fetch"));
  await expect(load()).resolves.toEqual(cached.map(student => load === getStudents ? student : { id: student.id, name: student.name, birthDate: student.birthDate }));
  expect(mockWriteCache.mock.calls.every(([, value]) => value === null || !JSON.stringify(value).includes('"student-1"'))).toBe(true);
});

test.each(["session", "workspace round trip"])('rejects a multi-page directory after %s changes', async kind => {
  let reads = 0;
  mockSupabaseGet.mockImplementation(async () => {
    reads += 1;
    if (reads === 2) {
      if (kind === "session") mockIdentity = { userId: "user-b", generation: 2 };
      else mockCacheGeneration += 2;
    }
    return [row(`student-${reads}`)];
  });
  await expect(getStudents()).rejects.toBeInstanceOf(SessionIdentityChangedError);
  expect(reads).toBe(2);
  expect(mockWriteCache).not.toHaveBeenCalled();
  expect(mockReadCache).not.toHaveBeenCalled();
});
