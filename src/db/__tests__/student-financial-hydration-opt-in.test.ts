import type { StudentRow } from "../row-types";
jest.mock("../student-financial-read", () => ({ readStudentFinancialStatuses: async () => null }));

let mockIdentity = { userId: "user-a", generation: 1 };
let mockGeneration = 1;
let mockOrganization: string | null = "org-a";
let mockToken = "fixture-token";
const mockGet = jest.fn();
const mockPatch = jest.fn();
const mockReadCache = jest.fn();
const mockWriteCache = jest.fn();
jest.mock("../../auth/session", () => {
  class Changed extends Error {}
  return {
    SessionIdentityChangedError: Changed,
    getSessionIdentity: () => ({ ...mockIdentity }),
    getAccessToken: () => mockToken,
    getSessionUserId: jest.fn(),
    assertSessionIdentity: (identity: typeof mockIdentity) => {
      if (identity.userId !== mockIdentity.userId || identity.generation !== mockIdentity.generation) throw new Changed();
    },
  };
});
jest.mock("../client", () => ({
  CACHE_KEYS: { students: "students" },
  getActiveOrganizationId: async () => mockOrganization,
  getReadCacheGeneration: () => mockGeneration,
  getScopedOrganizationId: async (value?: string | null) => value ?? mockOrganization,
  isNetworkError: (error: unknown) => error instanceof Error && error.message === "offline",
  isAuthError: () => false,
  isMissingRelation: () => false,
  supabaseGet: (...args: unknown[]) => mockGet(...args),
  supabasePatch: (...args: unknown[]) => mockPatch(...args),
  readCache: (...args: unknown[]) => mockReadCache(...args),
  writeCache: (...args: unknown[]) => mockWriteCache(...args),
}));
jest.mock("@sentry/react-native", () => ({ addBreadcrumb: jest.fn(), captureException: jest.fn() }));
jest.mock("../classes", () => ({}));
jest.mock("../training", () => ({}));
jest.mock("../training-sessions", () => ({}));
jest.mock("../../api/class-responsibles", () => ({}));
jest.mock("../../api/notifications", () => ({}));

// eslint-disable-next-line import/first -- load the guarded adapter after its isolated transports
import { getStudents, updateStudentPhoto } from "../students";
// eslint-disable-next-line import/first -- assert against the same mocked identity error
import { SessionIdentityChangedError } from "../../auth/session";

const row = (index: number): StudentRow => ({
  id: `student-${String(index).padStart(5, "0")}`, name: `Atleta fictício ${String(index).padStart(5, "0")}`,
  organization_id: "org-a", classid: `class-${index % 100}`, age: 16, birthdate: "2010-10-24",
  phone: "11999990000", login_email: "fixture@example.test", photo_url: "org-a/photo-fixture.jpg",
  guardian_name: "Responsável fictício", guardian_phone: "11999990001", guardian_relation: "responsavel",
  ra: "2026100001", cpf_masked: "***.***.***-00", rg: "00.000.000-0", college_course: "Curso fictício",
  address: "Endereço fictício", gender_identity: "nao_informar", health_issue: false,
  health_issue_notes: "Nota fictícia", medication_use: false, medication_notes: "Outra nota fictícia",
  health_observations: "Cadastro fictício", membership_status: "active", financial_status: "delinquent",
  position_primary: "levantador", position_secondary: "indefinido", athlete_objective: "base", learning_style: "misto",
  createdat: "2026-01-01T12:00:00.000Z",
});
function installDirectory(rows: StudentRow[]) {
  let offset = 0;
  mockGet.mockImplementation(async (path: string) => {
    if (path.startsWith("/students?")) {
      const page = rows.slice(offset, offset + 500); offset += page.length;
      return page;
    }
    if (path.startsWith("/student_financial_statuses?")) {
      const filter = new URL(path, "https://fixture.test").searchParams.get("student_id")!;
      return filter.slice("in.(".length, -1).split(",").map(student_id => ({ student_id, status: "regular" }));
    }
    throw new Error(`Unexpected fixture query: ${path}`);
  });
}
const financeRequests = () => mockGet.mock.calls.filter(([path]: [string]) => path.startsWith("/student_financial_statuses?"));
beforeEach(() => {
  jest.clearAllMocks();
  mockIdentity = { userId: "user-a", generation: 1 }; mockGeneration = 1; mockOrganization = "org-a";
  mockToken = "fixture-token"; mockPatch.mockResolvedValue([]);
  mockReadCache.mockResolvedValue(null); mockWriteCache.mockResolvedValue(undefined);
});

test("5,000 full students preserve fields/order/cache while opting out removes 50 financial requests", async () => {
  const rows = Array.from({ length: 5000 }, (_, index) => row(index));
  installDirectory(rows);
  const ordinary = await getStudents();
  expect(financeRequests()).toHaveLength(50);
  expect(ordinary.every(student => student.financialStatus === "regular")).toBe(true);
  const ordinaryDirectoryQueries = mockGet.mock.calls.filter(([path]: [string]) => path.startsWith("/students?")).map(([path]) => path);
  const ordinaryCache = mockWriteCache.mock.calls.find(([key]) => key === "students_org-a")![1];
  expect(ordinaryDirectoryQueries).toHaveLength(11);

  jest.clearAllMocks(); installDirectory(rows);
  const withoutFinance = await getStudents({ includeFinancial: false });
  expect(financeRequests()).toHaveLength(0);
  expect(mockGet.mock.calls.map(([path]) => path)).toEqual(ordinaryDirectoryQueries);
  expect(withoutFinance).toEqual(ordinary.map(student => ({ ...student, financialStatus: "unknown" })));
  expect(withoutFinance[0]).toMatchObject({ name: rows[0].name, classId: rows[0].classid,
    phone: rows[0].phone, address: rows[0].address, healthObservations: rows[0].health_observations });
  expect(mockWriteCache).toHaveBeenCalledWith("students_org-a", ordinaryCache);
  expect(mockWriteCache).toHaveBeenCalledWith("students_org-a_birthdays", null);
  expect(withoutFinance.every(student => student.financialStatus === "unknown")).toBe(true);
});

test("explicit true keeps authorized financial hydration enabled", async () => {
  installDirectory([row(1)]);
  expect((await getStudents({ includeFinancial: true }))[0].financialStatus).toBe("regular");
  expect(financeRequests()).toHaveLength(1);
});

test.each(["user", "organization", "generation"])("opt-out still rejects stale scope after a %s change between pages", async change => {
  mockGet.mockImplementationOnce(async () => {
    if (change === "user") mockIdentity = { userId: "user-b", generation: 2 };
    if (change === "organization") mockOrganization = "org-b";
    if (change === "generation") mockGeneration += 2;
    return [row(1)];
  });
  await expect(getStudents({ includeFinancial: false })).rejects.toBeInstanceOf(SessionIdentityChangedError);
  expect(financeRequests()).toHaveLength(0); expect(mockWriteCache).not.toHaveBeenCalled();
});

test("opt-out checks identity again after the shared cache write completes", async () => {
  installDirectory([row(1)]);
  mockWriteCache.mockImplementationOnce(async () => { mockIdentity = { userId: "user-b", generation: 2 }; });
  await expect(getStudents({ includeFinancial: false })).rejects.toBeInstanceOf(SessionIdentityChangedError);
  expect(financeRequests()).toHaveLength(0);
  expect(mockWriteCache).not.toHaveBeenCalledWith("students_org-a_birthdays", null);
});

test("an explicit authorized organization can differ from the starting workspace", async () => {
  mockOrganization = "org-prof"; installDirectory([{ ...row(1), organization_id: "org-student" }]);
  const result = await getStudents({ organizationId: "org-student", includeFinancial: false });
  expect(result[0].organizationId).toBe("org-student");
  expect(mockGet.mock.calls.every(([path]) => new URL(path, "https://fixture.test").searchParams.get("organization_id") === "eq.org-student")).toBe(true);
  expect(mockWriteCache).toHaveBeenCalledWith("students_org-student", expect.any(Array));
  expect(financeRequests()).toHaveLength(0);
});

test("offline opt-out still sanitizes legacy financial values in the same shared cache", async () => {
  installDirectory([row(1)]);
  const [student] = await getStudents({ includeFinancial: false });
  jest.clearAllMocks(); mockGet.mockRejectedValueOnce(new Error("offline"));
  mockReadCache.mockResolvedValueOnce([{ ...student, financialStatus: "delinquent" }]);
  expect(await getStudents({ includeFinancial: false })).toEqual([{ ...student, financialStatus: "unknown" }]);
  expect(mockReadCache).toHaveBeenCalledWith("students_org-a"); expect(financeRequests()).toHaveLength(0);
});

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
};
const flush = async () => { for (let index = 0; index < 30; index++) await Promise.resolve(); };

test("overlapping mixed readers share one 5,000-row base and one authorized hydration, with independent editable results", async () => {
  const rows = Array.from({ length: 5000 }, (_, index) => row(index));
  installDirectory(rows);
  const serve = mockGet.getMockImplementation()!;
  const gate = deferred(); let held = false;
  mockGet.mockImplementation(async (...args: unknown[]) => {
    if (!held && String(args[0]).startsWith("/students?")) { held = true; await gate.promise; }
    return serve(...args);
  });
  const pending = [getStudents({ includeFinancial: false }), getStudents(), getStudents({ includeFinancial: true })];
  await flush();
  const pendingRequests = mockGet.mock.calls.length;
  gate.resolve();
  const [plain, first, second] = await Promise.all(pending);
  expect(pendingRequests).toBe(1);
  expect(mockGet.mock.calls.filter(([path]) => path.startsWith("/students?"))).toHaveLength(11);
  expect(financeRequests()).toHaveLength(50);
  expect(plain.every(student => student.financialStatus === "unknown")).toBe(true);
  expect(first.every(student => student.financialStatus === "regular")).toBe(true);
  expect(second.map(student => student.id)).toEqual(plain.map(student => student.id));
  expect(mockWriteCache.mock.calls.filter(([key]) => key === "students_org-a")).toHaveLength(1);
  const cached = mockWriteCache.mock.calls.find(([key]) => key === "students_org-a")![1];
  first[0].name = "Edição particular do consumidor"; first.reverse();
  expect(second[0].name).toBe(rows[0].name); expect(plain[0].name).toBe(rows[0].name);
  expect(cached[0].name).toBe(rows[0].name); expect(cached[0].financialStatus).toBe("unknown");
});

test("a reader starting after base settlement gets fresh data and never joins an older financial snapshot", async () => {
  const gate = deferred(), started = deferred(); let finances = 0; let photo = "org-a/old.jpg";
  mockGet.mockImplementation(async (path: string) => {
    if (path.startsWith("/students?")) return new URL(path, "https://fixture.test").searchParams.has("or") ? [] : [{ ...row(1), photo_url: photo }];
    if (++finances === 1) { started.resolve(); await gate.promise; return [{ student_id: row(1).id, status: "regular" }]; }
    return [{ student_id: row(1).id, status: "delinquent" }];
  });
  const first = getStudents(); await started.promise;
  photo = "org-a/new.jpg";
  const fresh = await getStudents();
  gate.resolve(); await first;
  expect(fresh[0]).toMatchObject({ photoUrl: photo, financialStatus: "delinquent" });
  expect(financeRequests()).toHaveLength(2);
  expect(mockGet.mock.calls.filter(([path]) => path.startsWith("/students?"))).toHaveLength(4);
});

test("a changed access token separates pending requests even for the same user and generation", async () => {
  const gate = deferred(); let first = true;
  mockGet.mockImplementation(async (path: string) => {
    if (new URL(path, "https://fixture.test").searchParams.has("or")) return [];
    if (first) { first = false; await gate.promise; }
    return [row(1)];
  });
  const old = getStudents({ includeFinancial: false }); await flush();
  mockToken = "new-fixture-token";
  const fresh = await getStudents({ includeFinancial: false });
  gate.resolve(); await old;
  expect(fresh).toHaveLength(1); expect(mockGet).toHaveBeenCalledTimes(4);
});

test("a committed mutation invalidates old shared work and all old readers follow the current pending generation", async () => {
  const oldGate = deferred(), freshGate = deferred(); let pages = 0;
  mockGet.mockImplementation(async (path: string) => {
    if (new URL(path, "https://fixture.test").searchParams.has("or")) return [];
    pages += 1;
    if (pages === 1) { await oldGate.promise; return [{ ...row(1), photo_url: "org-a/old.jpg" }]; }
    await freshGate.promise; return [{ ...row(1), photo_url: "org-a/new.jpg" }];
  });
  const first = getStudents({ includeFinancial: false });
  const second = getStudents({ includeFinancial: false }); await flush();
  await updateStudentPhoto(row(1).id, "org-a/new.jpg");
  const fresh = getStudents({ includeFinancial: false }); await flush();
  oldGate.resolve(); await flush(); freshGate.resolve();
  const result = await Promise.all([first, second, fresh]);
  expect(result.every(students => students[0].photoUrl === "org-a/new.jpg")).toBe(true);
  expect(mockGet).toHaveBeenCalledTimes(3);
  expect(mockWriteCache.mock.calls.filter(([key]) => key === "students_org-a")).toHaveLength(1);
});

test("a mutation during pending finances replays current base data without publishing the obsolete result", async () => {
  const gate = deferred(), started = deferred(); let finances = 0; let photo = "org-a/old.jpg";
  mockGet.mockImplementation(async (path: string) => {
    if (path.startsWith("/students?")) return new URL(path, "https://fixture.test").searchParams.has("or") ? [] : [{ ...row(1), photo_url: photo }];
    finances += 1; if (finances === 1) { started.resolve(); await gate.promise; }
    return [{ student_id: row(1).id, status: "regular" }];
  });
  const result = getStudents(); await started.promise;
  await updateStudentPhoto(row(1).id, "org-a/new.jpg"); photo = "org-a/new.jpg";
  gate.resolve();
  expect((await result)[0]).toMatchObject({ photoUrl: photo, financialStatus: "regular" });
  expect(financeRequests()).toHaveLength(2);
});

test("a rejected obsolete GET follows the post-write pending reader instead of using an old offline cache", async () => {
  const oldGate = deferred(), freshGate = deferred(), oldStarted = deferred(), freshStarted = deferred(); let pages = 0;
  mockReadCache.mockResolvedValue([{ id: "old-cache", name: "Cache obsoleto", financialStatus: "unknown" }]);
  mockGet.mockImplementation(async (path: string) => {
    if (new URL(path, "https://fixture.test").searchParams.has("or")) return [];
    pages += 1;
    if (pages === 1) { oldStarted.resolve(); await oldGate.promise; throw new Error("offline"); }
    freshStarted.resolve(); await freshGate.promise;
    return [{ ...row(1), photo_url: "org-a/new.jpg" }];
  });
  const old = getStudents({ includeFinancial: false }); await oldStarted.promise;
  await updateStudentPhoto(row(1).id, "org-a/new.jpg");
  const fresh = getStudents({ includeFinancial: false }); await freshStarted.promise;
  oldGate.resolve(); await flush(); freshGate.resolve();
  const result = await Promise.all([old, fresh]);
  expect(result.every(students => students[0].photoUrl === "org-a/new.jpg")).toBe(true);
  expect(mockGet).toHaveBeenCalledTimes(3); expect(mockReadCache).not.toHaveBeenCalled();
});

test("continuous confirmed mutations exhaust a finite recovery budget without publishing partial data", async () => {
  mockGet.mockImplementation(async () => {
    await updateStudentPhoto(row(1).id, "org-a/changing.jpg");
    return [row(1)];
  });
  await expect(getStudents({ includeFinancial: false })).rejects.toThrow("dados dos atletas estão mudando");
  expect(mockGet).toHaveBeenCalledTimes(4);
  expect(mockWriteCache.mock.calls.every(([, value]) => value === null || value.kind === "invalidated")).toBe(true); expect(mockReadCache).not.toHaveBeenCalled();
});

test("a mutation during offline storage access discards that cache snapshot and reads the current directory", async () => {
  mockGet.mockRejectedValueOnce(new Error("offline"));
  mockReadCache.mockImplementationOnce(async () => {
    await updateStudentPhoto(row(1).id, "org-a/new.jpg");
    installDirectory([{ ...row(1), photo_url: "org-a/new.jpg" }]);
    return [{ id: "old-cache", name: "Cache obsoleto", financialStatus: "unknown" }];
  });
  const result = await getStudents({ includeFinancial: false });
  expect(result[0]).toMatchObject({ id: row(1).id, photoUrl: "org-a/new.jpg" });
  expect(mockReadCache).toHaveBeenCalledTimes(1);
  expect(mockWriteCache.mock.calls.filter(([key]) => key === "students_org-a")[0][1][0].id).toBe(row(1).id);
});
