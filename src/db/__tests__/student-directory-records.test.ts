import type { StudentRow } from "../row-types";

let mockIdentity = { userId: "user-a", generation: 1 };
let mockGeneration = 1;
let mockOrganization = "org-a";
let mockToken = "token-a";
const mockGet = jest.fn();
const mockFinance = jest.fn();
const mockPatch = jest.fn();
const mockStore = new Map<string, unknown>();
const mockWrite = jest.fn(async (key: string, value: unknown) => { mockStore.set(key, value); });
const mockRead = jest.fn(async (key: string) => mockStore.get(key) ?? null);
jest.mock("../../auth/session", () => {
  class Changed extends Error {}
  return { getSessionIdentity: () => ({ ...mockIdentity }), getAccessToken: () => mockToken,
    getSessionUserId: async () => mockIdentity.userId, SessionIdentityChangedError: Changed,
    assertSessionIdentity: (value: typeof mockIdentity) => { if (value.userId !== mockIdentity.userId || value.generation !== mockIdentity.generation) throw new Changed(); } };
});
jest.mock("../client", () => ({ CACHE_KEYS: { students: "students" },
  getActiveOrganizationId: async () => mockOrganization, getScopedOrganizationId: async (value?: string) => value ?? mockOrganization,
  getReadCacheGeneration: () => mockGeneration, readCache: (...args: [string]) => mockRead(...args),
  writeCache: (...args: [string, unknown]) => mockWrite(...args), isNetworkError: (error: Error) => error.message === "offline",
  isAuthError: () => false, isMissingRelation: () => false,
  supabaseGet: (...args: unknown[]) => mockGet(...args), supabasePatch: (...args: unknown[]) => mockPatch(...args),
}));
jest.mock("../student-financial-read", () => ({ readStudentFinancialStatuses: (...args: unknown[]) => mockFinance(...args) }));
jest.mock("@sentry/react-native", () => ({ addBreadcrumb() {}, captureException() {} }));
jest.mock("../classes", () => ({}));
jest.mock("../training", () => ({}));
jest.mock("../training-sessions", () => ({}));
jest.mock("../../api/class-responsibles", () => ({}));
jest.mock("../../api/notifications", () => ({}));
// eslint-disable-next-line import/first -- isolated transports precede the actual module
import { getClassStudentRecords, getStudentById, getStudentDirectoryRecords, getStudents, getStudentsByClass, updateStudentPhoto } from "../students";
// eslint-disable-next-line import/first -- the real mocked identity error must match the adapter
import { SessionIdentityChangedError } from "../../auth/session";

const row = (index: number): StudentRow => ({ id: `s${String(index).padStart(5, "0")}`, name: `Atleta ${String(index).padStart(5, "0")}`,
  organization_id: "org-a", classid: "class-a", age: 16, phone: "11999990000", birthdate: "2010-01-01", student_user_id: null,
  guardian_name: "Responsável", guardian_phone: "11999990001", guardian_relation: "Mãe", login_email: "fixture@example.test",
  membership_status: "active", is_experimental: false, ra: "202610001", photo_url: "org-a/fixture.jpg",
  health_issue: true, health_issue_notes: "Informação completa fictícia", medication_use: false,
  medication_notes: "", health_observations: "Outra informação fictícia", createdat: "2026-01-01T00:00:00Z" });
function install(rows: StudentRow[], cap = 500) {
  mockGet.mockImplementation(async (path: string) => {
    const query = new URL(path, "https://fixture.test").searchParams;
    if (query.has("id")) return rows.filter(item => `eq.${item.id}` === query.get("id"));
    expect(query.get("limit")).toBe("500");
    const lower = query.get("name")?.slice(4);
    const offset = lower === undefined ? 0 : rows.findIndex(item => item.name === lower) + 1;
    const page = rows.slice(offset, offset + cap);
    const columns = query.get("select")!;
    return columns === "*" ? page : page.map(item => Object.fromEntries(columns.split(",").map(key => [key, item[key as keyof StudentRow]])));
  });
}
beforeEach(() => {
  jest.clearAllMocks(); mockStore.clear(); mockIdentity = { userId: "user-a", generation: 1 };
  mockOrganization = "org-a"; mockGeneration = 1; mockToken = "token-a"; mockPatch.mockResolvedValue([]);
  mockFinance.mockImplementation(async (_org: string, ids: string[]) => ids.map(student_id => ({ student_id, status: "regular" })));
});
test("5,000 typed directory and avatar records retain all selected fields/order without writing a partial full cache", async () => {
  const rows = Array.from({ length: 5000 }, (_, index) => row(index)); install(rows);
  mockStore.set("students_org-a", [{ id: "existing-full" }]);
  const directory = await getStudentDirectoryRecords({ includeFinancial: false });
  expect(directory.map(item => item.id)).toEqual(rows.map(item => item.id));
  expect(Object.keys(directory[0])).toHaveLength(17);
  expect(directory[0]).toMatchObject({ name: rows[0].name, guardianName: rows[0].guardian_name, ra: rows[0].ra, financialStatus: "unknown" });
  expect(directory[0]).not.toHaveProperty("healthIssueNotes"); expect(directory[0]).not.toHaveProperty("createdAt");
  expect(mockGet).toHaveBeenCalledTimes(11); expect(mockFinance).not.toHaveBeenCalled();
  const avatars = await getClassStudentRecords();
  expect(avatars.map(item => item.id)).toEqual(directory.map(item => item.id));
  expect(Object.keys(avatars[0]).sort()).toEqual(["classId", "id", "name", "organizationId", "photoUrl"]);
  expect(mockStore.get("students_org-a")).toEqual([{ id: "existing-full" }]);
});
test.each([getStudentDirectoryRecords, getClassStudentRecords])("a server cap137 continues to EMPTY rather than returning a partial directory (%#)", async load => {
  const rows = Array.from({ length: 1205 }, (_, index) => row(index)); install(rows, 137);
  expect((await load()).map(item => item.id)).toEqual(rows.map(item => item.id));
  expect(mockGet).toHaveBeenCalledTimes(10);
});
test("mixed pending directory consumers share one base and one authorized financial read with separate editable copies", async () => {
  install(Array.from({ length: 5000 }, (_, index) => row(index)));
  const serve = mockGet.getMockImplementation()!;
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }); let first = true;
  mockGet.mockImplementation(async (...args: unknown[]) => { if (first) { first = false; await gate; } return serve(...args); });
  const jobs = [getStudentDirectoryRecords({ includeFinancial: false }), getStudentDirectoryRecords(), getStudentDirectoryRecords()];
  release(); const [plain, a, b] = await Promise.all(jobs);
  expect(mockGet).toHaveBeenCalledTimes(11); expect(mockFinance).toHaveBeenCalledTimes(1);
  expect(plain[0].financialStatus).toBe("unknown"); expect(a[0].financialStatus).toBe("regular");
  a[0].name = "Edição local"; expect(b[0].name).toBe(row(0).name); expect(plain[0].name).toBe(row(0).name);
  expect((mockStore.get("students_org-a_directory") as typeof plain)[0].financialStatus).toBe("unknown");
});
test.each(["identity", "organization", "generation"])("projection rejects %s changes before any cache or partial publication", async kind => {
  mockGet.mockImplementationOnce(async () => {
    if (kind === "identity") mockIdentity = { userId: "user-b", generation: 2 };
    if (kind === "organization") mockOrganization = "org-b";
    if (kind === "generation") mockGeneration += 2;
    return [row(0)];
  });
  await expect(getStudentDirectoryRecords()).rejects.toThrow(); expect(mockWrite).not.toHaveBeenCalled();
});
test("the existing full directory supports an unvisited offline profile; a DTO alone never fabricates a full record", async () => {
  install([row(1)]); const [full] = await getStudents({ includeFinancial: false });
  mockGet.mockRejectedValue(new Error("offline"));
  expect(await getStudentById(full.id)).toMatchObject({ healthIssueNotes: row(1).health_issue_notes, financialStatus: "unknown" });
  mockStore.delete("students_org-a");
  mockStore.set("students_org-a_directory", [{ id: row(1).id, name: "Resumo" }]);
  await expect(getStudentById(full.id)).rejects.toThrow("primeira vez");
});
test("offline details reflect the last per-ID sync until the next online detail refresh", async () => {
  install([row(1)]); await getStudents({ includeFinancial: false });
  install([{ ...row(1), health_issue_notes: "Detalhe novo" }]); await getStudentById(row(1).id);
  mockGet.mockRejectedValue(new Error("offline"));
  expect((await getStudentById(row(1).id))?.healthIssueNotes).toBe("Detalhe novo");
  install([{ ...row(1), health_issue_notes: "Diretório posterior" }]); await getStudents({ includeFinancial: false });
  mockGet.mockRejectedValue(new Error("offline"));
  expect((await getStudentById(row(1).id))?.healthIssueNotes).toBe("Detalhe novo");
  install([{ ...row(1), health_issue_notes: "Detalhe atualizado online" }]); await getStudentById(row(1).id);
  mockGet.mockRejectedValue(new Error("offline"));
  expect((await getStudentById(row(1).id))?.healthIssueNotes).toBe("Detalhe atualizado online");
});
test.each(["id", "organization", "identity"])("full detail never caches a mismatched %s response", async kind => {
  mockGet.mockImplementationOnce(async () => {
    if (kind === "identity") mockIdentity = { userId: "user-b", generation: 2 };
    return [{ ...row(1), ...(kind === "id" ? { id: "wrong" } : kind === "organization" ? { organization_id: "org-b" } : {}) }];
  });
  await expect(getStudentById(row(1).id)).rejects.toThrow(); expect(mockWrite).not.toHaveBeenCalled();
});
test("canonical mutations invalidate only derived caches and the following reader refreshes its projection", async () => {
  install([row(1)]); await getStudentDirectoryRecords({ includeFinancial: false });
  mockStore.set("students_org-a", [{ id: "full-preserved" }]);
  await updateStudentPhoto(row(1).id, "new.jpg");
  expect(mockStore.get("students_org-a_directory")).toBeNull();
  expect(mockStore.get("students_org-a")).toEqual([{ id: "full-preserved" }]);
  install([{ ...row(1), photo_url: "new.jpg" }]);
  expect((await getStudentDirectoryRecords({ includeFinancial: false }))[0].photoUrl).toBe("new.jpg");
});
test("legacy public financial hydration without an explicit context still propagates identity abandonment", async () => {
  mockGet.mockImplementation(async (path: string) => path.startsWith("/students?") ? [row(1)] : []);
  mockFinance.mockRejectedValueOnce(new SessionIdentityChangedError());
  await expect(getStudentsByClass("class-a", { organizationId: "org-a" })).rejects.toBeInstanceOf(SessionIdentityChangedError);
});
test("opening A never reads B; a B mutation preserves A and its tombstone blocks stale legacy B", async () => {
  install([row(1), row(2)]); await getStudents({ includeFinancial: false });
  await getStudentById(row(1).id); await getStudentById(row(2).id);
  mockRead.mockClear(); await getStudentById(row(1).id);
  expect(mockRead.mock.calls.some(([key]) => key.includes(`detail_${row(2).id}`))).toBe(false);
  await updateStudentPhoto(row(2).id, "new.jpg"); mockGet.mockRejectedValue(new Error("offline"));
  expect((await getStudentById(row(1).id))?.id).toBe(row(1).id);
  await expect(getStudentById(row(2).id)).rejects.toThrow("atualizar esta ficha");
  install([{ ...row(2), photo_url: "new.jpg" }]); await getStudentById(row(2).id);
  mockGet.mockRejectedValue(new Error("offline")); expect((await getStudentById(row(2).id))?.photoUrl).toBe("new.jpg");
});
test("an earlier held detail commit cannot resurrect a record after its queued mutation tombstone", async () => {
  install([row(1)]); await getStudents({ includeFinancial: false });
  let release!: () => void, started!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const holding = new Promise<void>(resolve => { started = resolve; });
  mockWrite.mockImplementationOnce(async (key, value) => { started(); await gate; mockStore.set(key, value); });
  const old = getStudentById(row(1).id);
  const rejected = expect(old).rejects.toThrow(); await holding;
  const mutation = updateStudentPhoto(row(1).id, "new.jpg");
  for (let index = 0; index < 30; index++) await Promise.resolve();
  release(); await Promise.all([mutation, rejected]);
  expect(mockStore.get(`students_org-a_detail_${row(1).id}`)).toEqual({ kind: "invalidated" });
  mockGet.mockRejectedValue(new Error("offline"));
  await expect(getStudentById(row(1).id)).rejects.toThrow("atualizar esta ficha");
});
