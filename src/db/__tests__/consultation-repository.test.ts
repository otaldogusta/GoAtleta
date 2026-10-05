import type { OnlineConsultationProfile, PrescribedWorkout, WorkoutExecutionLog } from "../../core/consultation";
import type { ConsultationContext } from "../consultation-context";

const mockValues = new Map<string, string>();
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
const sessionFor = (userId: string) => ({
  access_token: `token-${userId}`, refresh_token: `refresh-${userId}`, expires_at: 9999999999,
  user: { id: userId, email: `${userId}@example.test`, app_metadata: { email_verified_hybrid_at: "2026-10-05T12:00:00.000Z" } },
});
const profile = (notes = "owner-A"): OnlineConsultationProfile => ({
  studentId: "student-1", goal: "saude", environment: "casa", availableEquipment: ["peso_corporal"],
  trainingDaysPerWeek: 3, notes,
});
const workout = (): PrescribedWorkout => ({
  id: "workout-1", studentId: "student-1", title: "Treino A", weekStartDate: "2026-10-05",
  dayLabel: "Segunda", objective: "Controle motor", estimatedDurationMin: 30, status: "published",
  exercises: [{ id: "exercise-1", name: "Agachamento", sets: 2, reps: "8" }],
});
const execution = (): WorkoutExecutionLog => ({
  id: "execution-1", workoutId: "workout-1", studentId: "student-1", completedAt: "2026-10-05T12:00:00.000Z",
  perceivedExertion: 5, painLevel: 1, completedExercises: [{ exerciseId: "exercise-1", completed: true }],
  studentFeedback: "Concluído", coachReviewStatus: "pending",
});
const localEntries = () => [...mockValues.entries()].filter(([key]) => key.startsWith("goatleta_consultation_v2:"));
const scopedKey = (userId = "A", organizationId = "org-A") => `goatleta_consultation_v2:${userId}:${organizationId}`;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

async function setup() {
  jest.resetModules();
  mockValues.clear();
  jest.clearAllMocks();
  jest.doMock("@react-native-async-storage/async-storage", () => mockStorage);
  jest.doMock("react-native", () => ({ Platform: { OS: "web" } }));
  jest.doMock("expo-secure-store", () => ({ getItemAsync: async () => null, setItemAsync: async () => {}, deleteItemAsync: async () => {} }));
  jest.doMock("@sentry/react-native", () => ({ addBreadcrumb: jest.fn(), setContext: jest.fn() }));
  jest.doMock("../../api/config", () => ({ SUPABASE_URL: "https://example.test", SUPABASE_ANON_KEY: "dummy" }));
  const auth = jest.requireActual<typeof import("../../auth/session")>("../../auth/session");
  const client = jest.requireActual<typeof import("../client")>("../client");
  const local = jest.requireActual<typeof import("../consultation-local")>("../consultation-local");
  const repository = jest.requireActual<typeof import("../consultation")>("../consultation");
  await auth.saveSession(sessionFor("A"));
  mockValues.set("active-org-id", "org-A");
  // All transport is fictitious; identity, request guards and local storage code remain real.
  const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(response([]));
  const activate = async (userId: string, organizationId: string) => {
    await client.clearLocalReadCaches();
    await auth.saveSession(sessionFor(userId));
    mockValues.set("active-org-id", organizationId);
  };
  const loadedContext = async () => (await repository.getConsultationLocalState()).context;
  return { auth, client, local, repository, fetchMock, activate, loadedContext };
}

afterEach(() => { jest.restoreAllMocks(); });

test("student binding permits an athlete without a staff workspace and scopes their data", async () => {
  const { repository, fetchMock } = await setup();
  mockValues.delete("active-org-id");
  fetchMock.mockResolvedValueOnce(response([{ id: "student-1" }]));
  const context = await repository.captureStudentConsultationContext("student-1", "org-athlete");
  expect(context).toMatchObject({ organizationId: "org-athlete", student: { id: "student-1", workspaceOrganizationId: null } });
  expect(String(fetchMock.mock.calls[0][0])).toContain("student_user_id=eq.A");
  expect(String(fetchMock.mock.calls[0][0])).toContain("organization_id=eq.org-athlete");
  await expect(repository.getConsultationLocalState(context)).resolves.toMatchObject({ context, persistenceStatus: { mode: "supabase" } });
  await expect(repository.saveWorkoutExecutionLog(execution(), context)).resolves.toMatchObject({ mode: "supabase" });
  expect(fetchMock.mock.calls.some(([url]) => String(url).includes("student_id=eq.student-1"))).toBe(true);
  const count = fetchMock.mock.calls.length;
  await expect(repository.saveWorkoutExecutionLog({ ...execution(), studentId: "another-student" }, context)).rejects.toThrow("não pertence");
  expect(fetchMock).toHaveBeenCalledTimes(count);
});

test("unverified student binding never reads or adopts local data", async () => {
  const { repository, fetchMock } = await setup();
  mockValues.delete("active-org-id");
  await expect(repository.captureStudentConsultationContext("student-1", "org-athlete")).rejects.toThrow("Vínculo do atleta indisponível");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(localEntries()).toEqual([]);
});

test("verified student context is invalidated by workspace activation and cannot be reused", async () => {
  const { repository, client, fetchMock } = await setup();
  mockValues.delete("active-org-id");
  fetchMock.mockResolvedValueOnce(response([{ id: "student-1" }]));
  const context = await repository.captureStudentConsultationContext("student-1", "org-athlete");
  await client.clearLocalReadCaches();
  mockValues.set("active-org-id", "org-new");
  await expect(repository.getConsultationLocalState(context)).rejects.toThrow("A sessão mudou");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(localEntries()).toEqual([]);
});

test("student scope filters local data belonging to another student in the same namespace", async () => {
  const { repository, local, fetchMock, loadedContext } = await setup();
  const staffContext = await loadedContext();
  await local.saveConsultationProfile(profile(), staffContext);
  await local.saveConsultationProfile({ ...profile(), studentId: "another-student" }, staffContext);
  fetchMock.mockResolvedValueOnce(response([{ id: "student-1" }]));
  const context = await repository.captureStudentConsultationContext("student-1", "org-A");
  fetchMock.mockRejectedValue(new TypeError("Network request failed"));
  const snapshot = await repository.getConsultationLocalState(context);
  expect(snapshot.profiles.map((item) => item.studentId)).toEqual(["student-1"]);
  expect(snapshot.persistenceStatus.mode).toBe("local");
  expect((await local.getConsultationLocalState(context)).profiles).toHaveLength(2);
});

test("loads an owner-bound snapshot and publishes status only after the load", async () => {
  const { repository, fetchMock, activate } = await setup();
  expect(repository.getLastConsultationPersistenceStatus()).toMatchObject({ mode: "unavailable", reason: "unavailable" });
  const rows: Record<string, unknown[]> = {
    consultation_profiles: [repository.buildConsultationProfilePayload(profile(), "org-A")],
    prescribed_workouts: [repository.buildPrescribedWorkoutPayload(workout(), "org-A")],
    prescribed_exercises: repository.buildPrescribedExercisePayloads(workout(), "org-A"),
    workout_execution_logs: [repository.buildWorkoutExecutionPayload(execution(), "org-A")],
    completed_exercise_logs: repository.buildCompletedExercisePayloads(execution(), "org-A"),
  };
  fetchMock.mockImplementation(async (url) => response(rows[new URL(String(url)).pathname.split("/").pop()!] ?? []));
  const snapshot = await repository.getConsultationLocalState();
  expect(snapshot.context).toMatchObject({ identity: { userId: "A" }, organizationId: "org-A" });
  expect(snapshot.profiles[0]).toMatchObject(profile());
  expect(snapshot.workouts[0]).toMatchObject(workout());
  expect(snapshot.executionLogs[0]).toMatchObject(execution());
  expect(snapshot.persistenceStatus).toMatchObject({ mode: "supabase", reason: "supabase" });
  expect(repository.getLastConsultationPersistenceStatus(snapshot.context)).toEqual(snapshot.persistenceStatus);
  expect(fetchMock).toHaveBeenCalledTimes(5);
  for (const [url, init] of fetchMock.mock.calls) {
    expect(String(url)).toContain("organization_id=eq.org-A");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer token-A" });
  }
  await activate("B", "org-B");
  expect(repository.getLastConsultationPersistenceStatus()).toMatchObject({ mode: "unavailable" });
  expect(repository.getLastConsultationPersistenceStatus(snapshot.context)).toMatchObject({ mode: "unavailable" });
});

test.each(["session", "organization"])("does not load or create local data without %s", async (missing) => {
  const { auth, repository, fetchMock } = await setup();
  if (missing === "session") await auth.saveSession(null);
  else mockValues.delete("active-org-id");
  await expect(repository.getConsultationLocalState()).rejects.toThrow(missing === "session" ? "Entre novamente" : "Selecione uma organização");
  expect(fetchMock).not.toHaveBeenCalled();
  expect(localEntries()).toEqual([]);
  expect(repository.getLastConsultationPersistenceStatus()).toMatchObject({ mode: "unavailable" });
});

test.each([
  { status: 401, code: "PGRST301" },
  { status: 403, code: "42501" },
  { status: 400, code: "42501" },
])("never converts denial $status/$code into a local save or read", async ({ status, code }) => {
  const { repository, local, fetchMock, loadedContext } = await setup();
  const context = await loadedContext();
  await local.saveConsultationProfile(profile("original"), context);
  const original = mockValues.get(scopedKey());
  fetchMock.mockImplementation(async (url) => String(url).includes("/auth/v1/token")
    ? response(sessionFor("A"))
    : response({ code, message: "Could not find the table 'public.consultation_profiles' in the schema cache" }, status));
  await expect(repository.saveConsultationProfile(profile("must-not-save"), context)).rejects.toThrow();
  await expect(repository.getConsultationLocalState(context)).rejects.toThrow();
  expect(mockValues.get(scopedKey())).toBe(original);
  expect(localEntries()).toHaveLength(1);
  expect(repository.getLastConsultationPersistenceStatus().mode).not.toBe("local");
});

test.each(["network", "missing_schema"] as const)("falls back for %s only under the captured owner", async (reason) => {
  const { repository, fetchMock, loadedContext, activate } = await setup();
  const context = await loadedContext();
  if (reason === "network") fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
  else fetchMock.mockResolvedValue(response({ code: "PGRST205", message: "Could not find the table 'public.consultation_profiles' in the schema cache" }, 404));
  const status = await repository.saveConsultationProfile(profile(), context);
  expect(status).toMatchObject({ mode: "local", reason });
  expect(repository.getLastConsultationPersistenceStatus(context)).toEqual(status);
  expect(JSON.parse(mockValues.get(scopedKey())!)).toMatchObject({ version: 2, userId: "A", organizationId: "org-A" });
  const own = await repository.getConsultationLocalState(context);
  expect(own.profiles).toEqual([profile()]);
  expect(own.persistenceStatus).toEqual(status);
  await activate("B", "org-A");
  const other = await repository.getConsultationLocalState();
  expect(other.context.identity.userId).toBe("B");
  expect(other.profiles).toEqual([]);
  expect(other.workouts).toEqual([]);
  expect(other.executionLogs).toEqual([]);
  expect(mockValues.has(scopedKey("B"))).toBe(false);
  expect(localEntries()).toHaveLength(1);
});

test("propagates an unclassified server failure without local persistence", async () => {
  const { repository, fetchMock, loadedContext } = await setup();
  const context = await loadedContext();
  fetchMock.mockResolvedValue(response({ code: "XX000", message: "Unexpected database failure" }, 500));
  await expect(repository.saveConsultationProfile(profile(), context)).rejects.toThrow("500 XX000");
  expect(localEntries()).toEqual([]);
});

test.each([
  { userId: "B", organizationId: "org-A" },
  { userId: "A", organizationId: "org-B" },
])("rejects a draft/context from A before transport in $userId/$organizationId", async ({ userId, organizationId }) => {
  const { repository, fetchMock, loadedContext, activate } = await setup();
  const contextA = await loadedContext();
  await activate(userId, organizationId);
  fetchMock.mockClear();
  await expect(repository.savePrescribedWorkout(workout(), contextA)).rejects.toThrow("sessão mudou");
  expect(fetchMock).not.toHaveBeenCalled();
  expect(localEntries()).toEqual([]);
});

test.each([
  { operation: "workout", stopAfter: 1, switchTo: "account" },
  { operation: "workout", stopAfter: 2, switchTo: "organization" },
  { operation: "execution", stopAfter: 1, switchTo: "organization" },
  { operation: "execution", stopAfter: 2, switchTo: "account" },
])("stops $operation after request $stopAfter when $switchTo changes", async ({ operation, stopAfter, switchTo }) => {
  const { auth, client, repository, fetchMock, loadedContext } = await setup();
  const context = await loadedContext();
  const reached = deferred<void>();
  const pendingResponse = deferred<Response>();
  fetchMock.mockClear();
  let requests = 0;
  fetchMock.mockImplementation(async () => {
    requests += 1;
    if (requests !== stopAfter) return response([]);
    reached.resolve();
    return pendingResponse.promise;
  });
  const saving = operation === "workout"
    ? repository.savePrescribedWorkout(workout(), context)
    : repository.saveWorkoutExecutionLog(execution(), context);
  const rejected = expect(saving).rejects.toThrow("sessão mudou");
  await reached.promise;
  if (switchTo === "account") await auth.saveSession(sessionFor("B"));
  else {
    await client.clearLocalReadCaches();
    mockValues.set("active-org-id", "org-B");
  }
  pendingResponse.resolve(response([]));
  await rejected;
  expect(fetchMock).toHaveBeenCalledTimes(stopAfter);
  expect(fetchMock.mock.calls.map(([, init]) => init?.method)).toEqual(stopAfter === 1 ? ["POST"] : ["POST", "DELETE"]);
  for (const [, init] of fetchMock.mock.calls) expect(init?.headers).toMatchObject({ Authorization: "Bearer token-A" });
  expect(localEntries()).toEqual([]);
  expect(repository.getLastConsultationPersistenceStatus()).toMatchObject({ mode: "unavailable" });
});

test("discards an old read response after account switch without adopting its data or status", async () => {
  const { repository, auth, fetchMock } = await setup();
  const reached = deferred<void>();
  const pendingResponse = deferred<Response>();
  fetchMock.mockImplementation(async (url) => {
    if (String(url).includes("/consultation_profiles?")) {
      reached.resolve();
      return pendingResponse.promise;
    }
    return response([]);
  });
  const loading = repository.getConsultationLocalState();
  const rejected = expect(loading).rejects.toThrow("sessão mudou");
  await reached.promise;
  await auth.saveSession(sessionFor("B"));
  pendingResponse.resolve(response([repository.buildConsultationProfilePayload(profile("private-A"), "org-A")]));
  await rejected;
  expect(localEntries()).toEqual([]);
  expect(repository.getLastConsultationPersistenceStatus()).toMatchObject({ mode: "unavailable" });
});

test("rejects mutation without a captured context instead of binding an old draft to the current user", async () => {
  const { repository, fetchMock } = await setup();
  await expect(repository.saveConsultationProfile(profile(), undefined as unknown as ConsultationContext)).rejects.toThrow();
  expect(fetchMock).not.toHaveBeenCalled();
  expect(localEntries()).toEqual([]);
});

test("persists profile, workout, execution, review and deletion with the loaded organization and identity", async () => {
  const { repository, fetchMock, loadedContext } = await setup();
  const context = await loadedContext();
  fetchMock.mockClear();
  await expect(repository.saveConsultationProfile(profile(), context)).resolves.toMatchObject({ mode: "supabase" });
  await expect(repository.savePrescribedWorkout(workout(), context)).resolves.toMatchObject({ mode: "supabase" });
  await expect(repository.saveWorkoutExecutionLog(execution(), context)).resolves.toMatchObject({ mode: "supabase" });
  await expect(repository.markExecutionLogReviewed("execution-1", context)).resolves.toMatchObject({ mode: "supabase" });
  await expect(repository.deletePrescribedWorkout("workout-1", context)).resolves.toMatchObject({ mode: "supabase" });
  const requests = fetchMock.mock.calls.map(([url, init]) => ({
    url: String(url), method: init?.method, headers: init?.headers,
    body: init?.body ? JSON.parse(String(init.body)) : undefined,
  }));
  expect(requests.map(({ method }) => method)).toEqual(["POST", "POST", "DELETE", "POST", "POST", "DELETE", "POST", "PATCH", "PATCH", "DELETE"]);
  for (const request of requests) {
    expect(request.headers).toMatchObject({ Authorization: "Bearer token-A" });
    if (request.method === "POST") {
      for (const row of request.body) expect(row.organization_id).toBe("org-A");
    } else expect(request.url).toContain("organization_id=eq.org-A");
  }
  expect(requests[2].url).toContain("/prescribed_exercises?workout_id=eq.workout-1");
  expect(requests[3].body[0]).toMatchObject({ workout_id: "workout-1", id: "exercise-1" });
  expect(requests[5].url).toContain("/completed_exercise_logs?execution_log_id=eq.execution-1");
  expect(requests[6].body[0]).toMatchObject({ execution_log_id: "execution-1", exercise_id: "exercise-1" });
  expect(requests[7].body).toMatchObject({ status: "completed" });
  expect(requests[8].body).toMatchObject({ coach_review_status: "reviewed" });
  expect(requests[9].url).toContain("/prescribed_workouts?id=eq.workout-1");
  expect(localEntries()).toEqual([]);
  expect(repository.getLastConsultationPersistenceStatus(context)).toMatchObject({ mode: "supabase" });
});
