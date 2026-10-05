import type {
  OnlineConsultationProfile,
  PrescribedWorkout,
  WorkoutExecutionLog,
} from "../../core/consultation";

const mockValues = new Map<string, string>();
const mockStorage = {
  getItem: jest.fn(async (key: string) => mockValues.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => { mockValues.set(key, value); }),
  removeItem: jest.fn(async (key: string) => { mockValues.delete(key); }),
  getAllKeys: jest.fn(async () => [...mockValues.keys()]),
  multiRemove: jest.fn(async (keys: string[]) => { keys.forEach((key) => mockValues.delete(key)); }),
};
let fetchSpy: jest.SpyInstance | null = null;

const scopedKey = (userId = "user-A", organizationId = "org-A") =>
  `goatleta_consultation_v2:${encodeURIComponent(userId)}:${encodeURIComponent(organizationId)}`;
const isConsultationKey = (key: string) => key.startsWith("goatleta_consultation_v2:");
const emptyState = () => ({ profiles: [], workouts: [], executionLogs: [] });
const sessionFor = (userId: string) => ({
  access_token: `token-${userId}`,
  refresh_token: `refresh-${userId}`,
  expires_at: 9999999999,
  user: { id: userId, email: `${userId}@example.test` },
});
const profile = (studentId = "student-shared", notes = "private-A"): OnlineConsultationProfile => ({
  studentId, notes, goal: "saude", environment: "casa",
  availableEquipment: ["peso_corporal"], trainingDaysPerWeek: 3,
});
const workout = (title = "private-A", id = "workout-shared"): PrescribedWorkout => ({
  id, title, studentId: "student-shared", weekStartDate: "2026-10-05",
  dayLabel: "Segunda", objective: "Controle motor", estimatedDurationMin: 30,
  status: "published", exercises: [{ id: "exercise-shared", name: "Agachamento", sets: 2, reps: "8" }],
});
const execution = (workoutId = "workout-shared"): WorkoutExecutionLog => ({
  id: "log-shared", workoutId, studentId: "student-shared",
  completedAt: "2026-10-05T12:00:00.000Z", perceivedExertion: 5, painLevel: 1,
  completedExercises: [{ exerciseId: "exercise-shared", completed: true }],
  studentFeedback: "private feedback", coachReviewStatus: "pending",
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function setup() {
  jest.resetModules();
  mockValues.clear();
  mockStorage.getItem.mockReset().mockImplementation(async (key) => mockValues.get(key) ?? null);
  mockStorage.setItem.mockReset().mockImplementation(async (key, value) => { mockValues.set(key, value); });
  mockStorage.removeItem.mockReset().mockImplementation(async (key) => { mockValues.delete(key); });
  mockStorage.getAllKeys.mockReset().mockImplementation(async () => [...mockValues.keys()]);
  mockStorage.multiRemove.mockReset().mockImplementation(async (keys) => { keys.forEach((key) => mockValues.delete(key)); });
  jest.doMock("@react-native-async-storage/async-storage", () => mockStorage);
  jest.doMock("react-native", () => ({ Platform: { OS: "web" } }));
  jest.doMock("expo-secure-store", () => ({
    getItemAsync: async () => null, setItemAsync: async () => {}, deleteItemAsync: async () => {},
  }));
  jest.doMock("@sentry/react-native", () => ({ addBreadcrumb: jest.fn(), setContext: jest.fn() }));
  jest.doMock("../../api/config", () => ({ SUPABASE_URL: "https://example.test", SUPABASE_ANON_KEY: "dummy" }));
  const auth = jest.requireActual<typeof import("../../auth/session")>("../../auth/session");
  const client = jest.requireActual<typeof import("../client")>("../client");
  const contexts = jest.requireActual<typeof import("../consultation-context")>("../consultation-context");
  const local = jest.requireActual<typeof import("../consultation-local")>("../consultation-local");
  await auth.saveSession(sessionFor("user-A"));
  mockValues.set("active-org-id", "org-A");
  fetchSpy = jest.spyOn(global, "fetch").mockRejectedValue(new Error("Unexpected network access"));
  const activate = async (userId: string, organizationId: string) => {
    await client.clearLocalReadCaches();
    await auth.saveSession(sessionFor(userId));
    mockValues.set("active-org-id", organizationId);
    return contexts.captureConsultationContext(organizationId);
  };
  return { auth, client, contexts, local, activate, context: await contexts.captureConsultationContext() };
}

afterEach(() => {
  if (fetchSpy) expect(fetchSpy).not.toHaveBeenCalled();
  fetchSpy = null;
  jest.restoreAllMocks();
});

test("isolates two users in the same organization even when student and workout IDs match", async () => {
  const { local, context, activate } = await setup();
  await local.saveConsultationProfile(profile(), context);
  await local.savePrescribedWorkout(workout(), context);
  const other = await activate("user-B", "org-A");
  await expect(local.getConsultationLocalState(other)).resolves.toEqual(emptyState());
  await local.saveConsultationProfile(profile("student-shared", "private-B"), other);
  await local.savePrescribedWorkout(workout("private-B"), other);
  const returned = await activate("user-A", "org-A");
  const state = await local.getConsultationLocalState(returned);
  expect(state.profiles[0].notes).toBe("private-A");
  expect(state.workouts[0].title).toBe("private-A");
});

test("isolates two organizations for one user without deleting durable drafts on cache reset", async () => {
  const { local, context, activate } = await setup();
  await local.saveConsultationProfile(profile(), context);
  const other = await activate("user-A", "org-B");
  await expect(local.getConsultationLocalState(other)).resolves.toEqual(emptyState());
  await local.saveConsultationProfile(profile("student-shared", "org-B private"), other);
  const returned = await activate("user-A", "org-A");
  expect((await local.getConsultationLocalState(returned)).profiles[0].notes).toBe("private-A");
  expect(mockValues.has(scopedKey("user-A", "org-B"))).toBe(true);
});

test("leaves unowned v1 data byte-for-byte intact and invisible to all account/workspace pairs", async () => {
  const { local, activate } = await setup();
  const legacy = JSON.stringify({ profiles: [profile()], workouts: [workout()], executionLogs: [execution()] });
  mockValues.set("goatleta_consultation_v1", legacy);
  for (const userId of ["user-A", "user-B"]) {
    for (const organizationId of ["org-A", "org-B"]) {
      const context = await activate(userId, organizationId);
      await expect(local.getConsultationLocalState(context)).resolves.toEqual(emptyState());
      await local.saveConsultationProfile(profile("new-student", userId), context);
      expect(mockValues.get("goatleta_consultation_v1")).toBe(legacy);
    }
  }
});

test("rejects missing session without exposing a previously captured local context", async () => {
  const { auth, local, contexts, context } = await setup();
  await local.saveConsultationProfile(profile(), context);
  await auth.saveSession(null);
  await expect(contexts.captureConsultationContext()).rejects.toThrow("Entre novamente");
  await expect(local.getConsultationLocalState(context)).rejects.toBeInstanceOf(auth.SessionIdentityChangedError);
});

test("rejects missing organization without reading or writing a default namespace", async () => {
  const { auth, local, contexts, context } = await setup();
  mockValues.delete("active-org-id");
  await expect(contexts.captureConsultationContext()).rejects.toThrow("Selecione uma organização");
  await expect(local.saveConsultationProfile(profile(), context)).rejects.toBeInstanceOf(auth.SessionIdentityChangedError);
  expect([...mockValues.keys()].filter(isConsultationKey)).toEqual([]);
});

test("rejects an expected organization different from the active one", async () => {
  const { auth, contexts } = await setup();
  await expect(contexts.captureConsultationContext("org-B")).rejects.toBeInstanceOf(auth.SessionIdentityChangedError);
});

test("invalidates the original context after an organization A to B to A round trip", async () => {
  const { auth, client, local, contexts, context } = await setup();
  await local.saveConsultationProfile(profile(), context);
  await client.clearLocalReadCaches();
  mockValues.set("active-org-id", "org-B");
  await client.clearLocalReadCaches();
  mockValues.set("active-org-id", "org-A");
  await expect(local.getConsultationLocalState(context)).rejects.toBeInstanceOf(auth.SessionIdentityChangedError);
  const current = await contexts.captureConsultationContext();
  expect((await local.getConsultationLocalState(current)).profiles[0].notes).toBe("private-A");
});

test("a fresh login of the same user does not revive an operation from the previous session", async () => {
  const { auth, local, context } = await setup();
  await auth.saveSession(null);
  await auth.saveSession(sessionFor("user-A"));
  await expect(local.savePrescribedWorkout(workout(), context)).rejects.toBeInstanceOf(auth.SessionIdentityChangedError);
  expect([...mockValues.keys()].filter(isConsultationKey)).toEqual([]);
});

test.each(["user", "organization"] as const)("rejects a pending local read after a %s switch", async (change) => {
  const { auth, local, context, activate } = await setup();
  await local.saveConsultationProfile(profile(), context);
  const entered = deferred<void>();
  const release = deferred<string | null>();
  const original = mockValues.get(scopedKey())!;
  let blocked = false;
  mockStorage.getItem.mockImplementation(async (key) => {
    if (key === scopedKey() && !blocked) { blocked = true; entered.resolve(); return release.promise; }
    return mockValues.get(key) ?? null;
  });
  const reading = local.getConsultationLocalState(context);
  const rejected = expect(reading).rejects.toBeInstanceOf(auth.SessionIdentityChangedError);
  await entered.promise;
  const current = await activate(change === "user" ? "user-B" : "user-A", change === "organization" ? "org-B" : "org-A");
  release.resolve(original);
  await rejected;
  await expect(local.getConsultationLocalState(current)).resolves.toEqual(emptyState());
  expect(mockValues.get(scopedKey())).toBe(original);
});

test.each(["user", "organization"] as const)("retains an already submitted write only under its owner after a %s switch", async (change) => {
  const { auth, local, context, activate } = await setup();
  const entered = deferred<void>();
  const release = deferred<void>();
  let blocked = false;
  mockStorage.setItem.mockImplementation(async (key, value) => {
    if (key === scopedKey() && !blocked) { blocked = true; entered.resolve(); await release.promise; }
    mockValues.set(key, value);
  });
  const writing = local.saveConsultationProfile(profile(), context);
  const rejected = expect(writing).rejects.toBeInstanceOf(auth.SessionIdentityChangedError);
  await entered.promise;
  const current = await activate(change === "user" ? "user-B" : "user-A", change === "organization" ? "org-B" : "org-A");
  release.resolve();
  await rejected;
  await expect(local.getConsultationLocalState(current)).resolves.toEqual(emptyState());
  expect([...mockValues.keys()].filter(isConsultationKey)).toEqual([scopedKey()]);
  const returned = await activate("user-A", "org-A");
  expect((await local.getConsultationLocalState(returned)).profiles[0].notes).toBe("private-A");
});

test("does not execute a queued second mutation after its original context changes", async () => {
  const { auth, local, context, activate } = await setup();
  const entered = deferred<void>();
  const release = deferred<void>();
  let blocked = false;
  mockStorage.setItem.mockImplementation(async (key, value) => {
    if (key === scopedKey() && !blocked) { blocked = true; entered.resolve(); await release.promise; }
    mockValues.set(key, value);
  });
  const first = local.saveConsultationProfile(profile("first"), context);
  const firstRejected = expect(first).rejects.toBeInstanceOf(auth.SessionIdentityChangedError);
  await entered.promise;
  const second = local.saveConsultationProfile(profile("second"), context);
  const secondRejected = expect(second).rejects.toBeInstanceOf(auth.SessionIdentityChangedError);
  await new Promise<void>((resolve) => setImmediate(resolve));
  await activate("user-A", "org-B");
  release.resolve();
  await Promise.all([firstRejected, secondRejected]);
  const returned = await activate("user-A", "org-A");
  expect((await local.getConsultationLocalState(returned)).profiles.map((item) => item.studentId)).toEqual(["first"]);
});

test("serializes overlapping saves so neither a profile nor a workout is lost", async () => {
  const { local, context } = await setup();
  const entered = deferred<void>();
  const release = deferred<void>();
  let blocked = false;
  mockStorage.setItem.mockImplementation(async (key, value) => {
    if (key === scopedKey() && !blocked) { blocked = true; entered.resolve(); await release.promise; }
    mockValues.set(key, value);
  });
  const first = local.saveConsultationProfile(profile(), context);
  await entered.promise;
  const second = local.savePrescribedWorkout(workout(), context);
  // Let the second operation advance while the first write remains suspended.
  // Without serialization it would commit first and then be overwritten.
  await new Promise<void>((resolve) => setImmediate(resolve));
  release.resolve();
  await Promise.all([first, second]);
  const state = await local.getConsultationLocalState(context);
  expect(state.profiles).toEqual([profile()]);
  expect(state.workouts).toEqual([workout()]);
});

test("reports a failed storage write and lets the following queued save succeed", async () => {
  const { local, context } = await setup();
  const entered = deferred<void>();
  const release = deferred<void>();
  let failed = false;
  mockStorage.setItem.mockImplementation(async (key, value) => {
    if (key === scopedKey() && !failed) {
      failed = true; entered.resolve(); await release.promise;
      throw new Error("Storage unavailable");
    }
    mockValues.set(key, value);
  });
  const first = local.saveConsultationProfile(profile("failed"), context);
  const rejected = expect(first).rejects.toThrow("Storage unavailable");
  await entered.promise;
  const second = local.saveConsultationProfile(profile("survives"), context);
  await new Promise<void>((resolve) => setImmediate(resolve));
  release.resolve();
  await Promise.all([rejected, second]);
  expect((await local.getConsultationLocalState(context)).profiles.map((item) => item.studentId)).toEqual(["survives"]);
});

test.each([
  ["invalid JSON", "{broken"],
  ["wrong owner", JSON.stringify({ version: 2, userId: "user-B", organizationId: "org-A", state: emptyState() })],
  ["invalid collection", JSON.stringify({ version: 2, userId: "user-A", organizationId: "org-A", state: { ...emptyState(), profiles: {} } })],
])("preserves an envelope with %s rather than reading or overwriting it", async (_label, original) => {
  const { local, context } = await setup();
  mockValues.set(scopedKey(), original);
  await expect(local.getConsultationLocalState(context)).rejects.toThrow("original foi preservado");
  await expect(local.saveConsultationProfile(profile(), context)).rejects.toThrow("original foi preservado");
  expect(mockValues.get(scopedKey())).toBe(original);
});

test("workout completion, review and deletion affect only the selected namespace", async () => {
  const { local, activate } = await setup();
  for (const [userId, organizationId] of [["user-A", "org-A"], ["user-B", "org-A"], ["user-A", "org-B"]]) {
    const context = await activate(userId, organizationId);
    await local.saveConsultationProfile(profile("student-shared", `${userId}/${organizationId}`), context);
    await local.savePrescribedWorkout(workout(`${userId}/${organizationId}`), context);
    await local.saveWorkoutExecutionLog(execution(), context);
  }
  const otherUser = mockValues.get(scopedKey("user-B", "org-A"));
  const otherOrganization = mockValues.get(scopedKey("user-A", "org-B"));
  const context = await activate("user-A", "org-A");
  expect((await local.getConsultationLocalState(context)).workouts[0].status).toBe("completed");
  await local.markExecutionLogReviewed("log-shared", context);
  expect((await local.getConsultationLocalState(context)).executionLogs[0].coachReviewStatus).toBe("reviewed");
  await local.deletePrescribedWorkout("workout-shared", context);
  const state = await local.getConsultationLocalState(context);
  expect(state.workouts).toEqual([]);
  expect(state.executionLogs).toEqual([]);
  expect(state.profiles).toHaveLength(1);
  expect(mockValues.get(scopedKey("user-B", "org-A"))).toBe(otherUser);
  expect(mockValues.get(scopedKey("user-A", "org-B"))).toBe(otherOrganization);
});
