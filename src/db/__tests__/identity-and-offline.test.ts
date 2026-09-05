import type { AttendanceRecord, ScoutingLog } from "../../core/models";
import type { PendingWrite } from "../pending-write-storage";

const mockValues = new Map<string, string>();
const mockBreadcrumbs: unknown[] = [];
const mockStorage = {
  getItem: jest.fn(async (key: string) => mockValues.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => { mockValues.set(key, value); }),
  removeItem: jest.fn(async (key: string) => { mockValues.delete(key); }),
  getAllKeys: jest.fn(async () => [...mockValues.keys()]),
  multiRemove: jest.fn(async (keys: string[]) => { keys.forEach((key) => mockValues.delete(key)); }),
};
const response = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(data),
}) as Response;
const sessionFor = (userId: string) => ({ access_token: `token-${userId}`, refresh_token: `refresh-${userId}`,
  expires_at: 9999999999, user: { id: userId, email: `${userId}@example.test` } });
const log = (id: string): ScoutingLog => ({ id, classId: `class-${id}`, date: "2026-09-05", mode: "treino",
  serve0: 0, serve1: 0, serve2: 0, receive0: 0, receive1: 0, receive2: 0, set0: 0, set1: 0, set2: 0,
  attackSend0: 0, attackSend1: 0, attackSend2: 0, createdAt: "2026-09-05T12:00:00Z", unit: "" });

async function setup(os: "web" | "android" = "web", database: object = {}) {
  jest.resetModules();
  mockValues.clear(); mockBreadcrumbs.length = 0;
  jest.doMock("@react-native-async-storage/async-storage", () => mockStorage);
  jest.doMock("react-native", () => ({ Platform: { OS: os } }));
  jest.doMock("expo-secure-store", () => ({ getItemAsync: async () => null, setItemAsync: async () => {}, deleteItemAsync: async () => {} }));
  jest.doMock("@sentry/react-native", () => ({ addBreadcrumb: (value: unknown) => mockBreadcrumbs.push(value), setContext: jest.fn() }));
  jest.doMock("../../api/config", () => ({ SUPABASE_URL: "https://example.test", SUPABASE_ANON_KEY: "dummy" }));
  jest.doMock("../sqlite", () => ({ db: database }));
  jest.doMock("../classes", () => ({ getClassById: async () => null }));
  jest.doMock("../training", () => ({ getTrainingPlans: async () => [] }));
  jest.doMock("../training-sessions", () => ({ resolveTrainingPlanForDate: () => null }));
  const auth = jest.requireActual<typeof import("../../auth/session")>("../../auth/session");
  const client = jest.requireActual<typeof import("../client")>("../client");
  const storage = jest.requireActual<typeof import("../pending-write-storage")>("../pending-write-storage");
  const sync = jest.requireActual<typeof import("../nfc-sync")>("../nfc-sync");
  await auth.saveSession(sessionFor("A"));
  mockValues.set("active-org-id", "org-A");
  return { auth, client, storage, sync };
}

afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test("cache separates users in one organization and removes legacy read keys only", async () => {
  const { auth, client } = await setup();
  mockValues.set("cache_students_v1_org-A", "legacy-private");
  mockValues.set("pending_writes_v1", "durable-draft");
  await client.writeCache("cache_students_v1_org-A", [{ name: "private-A" }]);
  await auth.saveSession(sessionFor("B"));
  await expect(client.readCache("cache_students_v1_org-A")).resolves.toBeNull();
  await client.clearLocalReadCaches();
  expect([...mockValues.keys()].some((key) => key.includes("cache_students"))).toBe(false);
  expect(mockValues.get("pending_writes_v1")).toBe("durable-draft");
});

test("a response started in A is rejected after a workspace switch", async () => {
  const { client } = await setup();
  let resolveResponse!: (value: Response) => void;
  const fetchMock = jest.spyOn(global, "fetch").mockReturnValue(new Promise((resolve) => { resolveResponse = resolve; }));
  const request = client.supabaseGet("/students?organization_id=eq.org-A");
  for (let attempt = 0; attempt < 100 && !fetchMock.mock.calls.length; attempt += 1) await Promise.resolve();
  expect(fetchMock).toHaveBeenCalled();
  await client.clearLocalReadCaches();
  mockValues.set("active-org-id", "org-B");
  resolveResponse(response([{ name: "private-A" }]));
  await expect(request).rejects.toThrow("sessão mudou");
});

test("telemetry excludes response bodies and query parameters", async () => {
  const { client } = await setup();
  jest.spyOn(global, "fetch").mockResolvedValue(response([{ name: "private-name", phone: "private-phone" }]));
  await client.supabaseGet("/students?login_email=eq.private-email");
  const output = JSON.stringify(mockBreadcrumbs);
  expect(output).toContain("GET /students");
  expect(output).not.toMatch(/private-name|private-phone|private-email|response/);
  jest.mocked(global.fetch).mockResolvedValue(response({ code: "23505", message: "private-email", details: "private-phone" }, 409));
  await expect(client.supabaseGet("/students?phone=eq.private-phone")).rejects.toThrow("409 23505");
  expect(JSON.stringify(mockBreadcrumbs)).not.toMatch(/private-name|private-phone|private-email/);
});

test("request timeout has a typed network classification", async () => {
  const { client } = await setup();
  jest.useFakeTimers();
  jest.spyOn(global, "fetch").mockImplementation((_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
  }));
  const request = client.supabaseRequest("POST", "/attendance_logs", []);
  const rejected = expect(request).rejects.toBeInstanceOf(client.SupabaseRequestTimeoutError);
  await jest.advanceTimersByTimeAsync(20001);
  await rejected;
  expect(client.classifyPendingWriteError(new client.SupabaseRequestTimeoutError())).toBe("network");
});

test("legacy queue is preserved in quarantine without adoption or transmission", async () => {
  const { storage, sync } = await setup();
  mockValues.set("pending_writes_v1", JSON.stringify([{ id: "legacy", kind: "scouting_log", payload: log("1"), createdAt: "2026-09-05" }]));
  const fetchMock = jest.spyOn(global, "fetch");
  await expect(sync.flushPendingWrites()).resolves.toEqual({ flushed: 0, remaining: 0 });
  expect(fetchMock).not.toHaveBeenCalled();
  await expect(storage.getPendingWriteQuarantineSummary()).resolves.toEqual({ missingOrigin: 1 });
  await expect(sync.getPendingWritePayloadById("legacy")).resolves.toBeNull();
  expect(JSON.parse(mockValues.get("pending_writes_v1")!).length).toBe(1);
});

test("queue deduplication preserves another owner's write and the current org filter", async () => {
  const { storage, sync } = await setup();
  const draft = { id: "same-id", kind: "scouting_log" as const, payload: log("1"), createdAt: "2026-09-05" };
  await storage.enqueueWrite({ ...draft, origin: { userId: "A", organizationId: "org-A" } });
  await storage.enqueueWrite({ ...draft, origin: { userId: "B", organizationId: "org-A" } });
  mockValues.set("active-org-id", "org-B");
  const fetchMock = jest.spyOn(global, "fetch");
  await sync.flushPendingWrites();
  expect(fetchMock).not.toHaveBeenCalled();
  expect((await storage.readWriteQueue()).length).toBe(2);
});

test("editing a pending write while it is being sent preserves the newer payload", async () => {
  const { storage, sync } = await setup();
  const draft: PendingWrite = { id: "same-id", kind: "scouting_log", payload: log("1"), createdAt: "2026-09-05",
    origin: { userId: "A", organizationId: "org-A" } };
  await storage.enqueueWrite(draft);
  let release!: (value: Response) => void;
  const fetchMock = jest.spyOn(global, "fetch").mockReturnValue(new Promise((resolve) => { release = resolve; }));
  const flushing = sync.flushPendingWrites();
  for (let attempt = 0; attempt < 100 && !fetchMock.mock.calls.length; attempt += 1) await Promise.resolve();
  expect(fetchMock).toHaveBeenCalled();
  await storage.enqueueWrite({ ...draft, payload: { ...log("1"), serve0: 99 } });
  release(response([]));
  await flushing;
  const queue = await storage.readWriteQueue();
  expect(queue).toHaveLength(1);
  expect((queue[0].payload as ScoutingLog).serve0).toBe(99);
});

test("account switch mid-batch does not transmit the next write with the new token", async () => {
  const { storage, sync, auth } = await setup();
  for (const id of ["1", "2"]) await storage.enqueueWrite({ id, kind: "scouting_log", payload: log(id),
    createdAt: `2026-09-05T12:0${id}:00Z`, origin: { userId: "A", organizationId: "org-A" } });
  let release!: (value: Response) => void;
  const fetchMock = jest.spyOn(global, "fetch").mockReturnValue(new Promise((resolve) => { release = resolve; }));
  const flushing = sync.flushPendingWrites();
  for (let attempt = 0; attempt < 100 && !fetchMock.mock.calls.length; attempt += 1) await Promise.resolve();
  expect(fetchMock).toHaveBeenCalled();
  await auth.saveSession(sessionFor("B"));
  release(response([]));
  await expect(flushing).rejects.toThrow("SYNC_PAUSED_AUTH");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe("Bearer token-A");
  expect(await storage.readWriteQueue()).toHaveLength(2);
  await expect(sync.getPendingWritesCount()).resolves.toBe(0);
});

test("attendance calls only the atomic RPC and retains old data if it fails", async () => {
  await setup();
  const { saveAttendanceRecords } = jest.requireActual<typeof import("../students")>("../students");
  const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(response({ code: "22023", message: "Invalid records" }, 400));
  const record: AttendanceRecord = { id: "record-1", classId: "class-1", studentId: "student-1", date: "2026-09-05",
    status: "presente", note: "", painScore: 0, createdAt: "2026-09-05T12:00:00Z" };
  await expect(saveAttendanceRecords("class-1", record.date, [record])).rejects.toThrow("400");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toContain("/rpc/replace_attendance_records");
  expect(fetchMock.mock.calls[0][1]?.method).toBe("POST");
});

test("invalid queued data is durably archived without being reported as synchronized", async () => {
  const { storage, sync, auth } = await setup();
  await storage.enqueueWrite({ id: "invalid", kind: "scouting_log", payload: log("1"), createdAt: "2026-09-05",
    origin: { userId: "A", organizationId: "org-A" } });
  jest.spyOn(global, "fetch").mockResolvedValue(response({ code: "22023" }, 400));
  await expect(sync.flushPendingWrites()).resolves.toEqual({ flushed: 0, remaining: 0 });
  expect(await storage.readWriteQueue()).toHaveLength(0);
  expect(await storage.readArchivedPendingWrites()).toHaveLength(1);
  expect(await sync.listPendingWritesDeadLetter()).toHaveLength(1);
  await auth.saveSession(sessionFor("B"));
  expect(await sync.listPendingWritesDeadLetter()).toHaveLength(0);
});

test("native SQLite migration keeps legacy data and only acknowledges the exact sent version", async () => {
  const { DatabaseSync } = jest.requireActual<typeof import("node:sqlite")>("node:sqlite");
  const connection = new DatabaseSync(":memory:");
  try {
    connection.exec("CREATE TABLE pending_writes (id TEXT PRIMARY KEY, kind TEXT, payload TEXT, createdAt TEXT, retryCount INTEGER DEFAULT 0, lastError TEXT, dedupKey TEXT DEFAULT '')");
    connection.prepare("INSERT INTO pending_writes (id, kind, payload, createdAt) VALUES (?, ?, ?, ?)")
      .run("legacy-native", "scouting_log", JSON.stringify(log("legacy")), "2026-09-01");
    const database = {
      runAsync: async (sql: string, args: (string | number | null)[] = []) => { connection.prepare(sql).run(...args); },
      getAllAsync: async (sql: string, args: (string | number | null)[] = []) => connection.prepare(sql).all(...args),
    };
    const { storage } = await setup("android", database);
    const draft: PendingWrite = { id: "native-write", kind: "scouting_log", payload: log("1"), createdAt: "2026-09-05",
      origin: { userId: "A", organizationId: "org-A" } };
    await storage.enqueueWrite(draft);
    const sent = (await storage.readWriteQueue()).find((item) => item.origin)!;
    await storage.enqueueWrite({ ...draft, payload: { ...log("1"), serve0: 99 } });
    await storage.completePendingWrite(sent);
    const remaining = await storage.readWriteQueue();
    expect(remaining).toHaveLength(2);
    expect(remaining.find((item) => !item.origin)?.id).toBe("legacy-native");
    expect((remaining.find((item) => item.origin)?.payload as ScoutingLog).serve0).toBe(99);
  } finally { connection.close(); }
});
