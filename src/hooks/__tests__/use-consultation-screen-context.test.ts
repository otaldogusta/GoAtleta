import { act, renderHook } from "@testing-library/react-native";

import { captureConsultationContext, captureStudentConsultationContext, getConsultationLocalState } from "../../db/consultation";
import type { ConsultationContext } from "../../db/consultation";
import { getStudents } from "../../db/seed";
import { useConsultationScreenContext, useConsultationScreenIdentity } from "../use-consultation-screen-context";

let mockSession = { userId: "user-a", generation: 1 };
let mockOrganizationId = "org-a";
const mockListeners = new Set<() => void>();
jest.mock("../../auth/session", () => ({
  getSessionIdentity: () => mockSession,
  isSessionIdentityCurrent: (identity: typeof mockSession) => identity.userId === mockSession.userId && identity.generation === mockSession.generation,
  subscribeSession: (listener: () => void) => { mockListeners.add(listener); return () => mockListeners.delete(listener); },
}));
jest.mock("../../providers/organization-context", () => ({
  useOrganization: () => ({ activeOrganizationId: mockOrganizationId }),
}));
jest.mock("../../db/consultation", () => ({
  captureConsultationContext: jest.fn(),
  captureStudentConsultationContext: jest.fn(),
  assertConsultationContext: jest.fn(async () => undefined),
  isConsultationContextCurrent: (context: ConsultationContext) =>
    (context.student ? context.student.workspaceOrganizationId === (mockOrganizationId || null) : context.organizationId === mockOrganizationId) &&
    context.identity.userId === mockSession.userId && context.identity.generation === mockSession.generation,
  getConsultationLocalState: jest.fn(),
}));
jest.mock("../../db/seed", () => ({ getStudents: jest.fn() }));

const context = (): ConsultationContext => ({ identity: { ...mockSession }, organizationId: mockOrganizationId, cacheGeneration: 1 });
const snapshot = (scope: ConsultationContext) => ({
  context: scope, profiles: [], workouts: [], executionLogs: [],
  persistenceStatus: { mode: "supabase" as const, reason: "supabase" as const, message: "Servidor" },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockSession = { userId: "user-a", generation: 1 };
  mockOrganizationId = "org-a";
  jest.mocked(captureConsultationContext).mockImplementation(async () => context());
  jest.mocked(captureStudentConsultationContext).mockImplementation(async (studentId, organizationId) => ({
    ...context(), organizationId, student: { id: studentId, workspaceOrganizationId: mockOrganizationId || null },
  }));
  jest.mocked(getConsultationLocalState).mockImplementation(async scope => snapshot(scope!));
  jest.mocked(getStudents).mockResolvedValue([]);
});

it("captures and validates scope before loading students or consultation data", async () => {
  let release!: (value: ConsultationContext) => void;
  jest.mocked(captureConsultationContext).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  const { result, unmount } = renderHook(() => useConsultationScreenContext("org-a"));
  const pending = result.current.load(true);
  expect(getStudents).not.toHaveBeenCalled();
  expect(getConsultationLocalState).not.toHaveBeenCalled();
  const scope = context();
  await act(async () => { release(scope); await pending; });
  expect(getConsultationLocalState).toHaveBeenCalledWith(scope);
  expect(result.current.getContext()).toBe(scope);
  unmount();
  expect(result.current.getContext()).toBeNull();
});

it("drops a response after organization A to B to A instead of accepting its old callback", async () => {
  let finish!: (value: ReturnType<typeof snapshot>) => void;
  jest.mocked(getConsultationLocalState).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const { result, rerender } = renderHook(({ org }) => useConsultationScreenContext(org), { initialProps: { org: "org-a" } });
  const scope = context();
  let pending!: ReturnType<typeof result.current.load>;
  await act(async () => { pending = result.current.load(true); });
  mockOrganizationId = "org-b";
  rerender({ org: "org-b" });
  mockOrganizationId = "org-a";
  rerender({ org: "org-a" });
  await act(async () => finish(snapshot(scope)));
  expect(await pending).toBeNull();
  expect(result.current.getContext()).toBeNull();
});

it("rejects callbacks from an old session even if the same user signs back in", async () => {
  const { result } = renderHook(() => useConsultationScreenContext("org-a"));
  await act(async () => { await result.current.load(false); });
  const scope = result.current.getContext()!;
  mockSession = { userId: "user-a", generation: 3 };
  expect(result.current.isCurrent(scope)).toBe(false);
  expect(result.current.getContext()).toBeNull();
});

it("changes the screen key for session rotation and organization round trips", () => {
  const { result, rerender } = renderHook(() => useConsultationScreenIdentity());
  const firstKey = result.current.key;
  act(() => { mockSession = { userId: "user-a", generation: 2 }; mockListeners.forEach(listener => listener()); });
  expect(result.current.key).not.toBe(firstKey);
  const sessionKey = result.current.key;
  mockOrganizationId = "org-b";
  rerender({});
  mockOrganizationId = "org-a";
  rerender({});
  expect(result.current.key).not.toBe(sessionKey);
});

it("propagates a current authorization failure without publishing a loaded context", async () => {
  jest.mocked(getConsultationLocalState).mockRejectedValueOnce(new Error("Acesso negado"));
  const { result } = renderHook(() => useConsultationScreenContext("org-a"));
  await expect(result.current.load(false)).rejects.toThrow("Acesso negado");
  expect(result.current.getContext()).toBeNull();
});

it("loads a verified athlete scope without a staff workspace or a global student list", async () => {
  mockOrganizationId = "";
  const { result } = renderHook(() => useConsultationScreenContext("athlete-org", { studentId: "athlete-1", organizationId: "athlete-org" }));
  await act(async () => { await result.current.load(false); });
  expect(captureStudentConsultationContext).toHaveBeenCalledWith("athlete-1", "athlete-org");
  expect(captureConsultationContext).not.toHaveBeenCalled();
  expect(getStudents).not.toHaveBeenCalled();
  expect(result.current.getContext()).toEqual(expect.objectContaining({
    organizationId: "athlete-org", student: { id: "athlete-1", workspaceOrganizationId: null },
  }));
});

it("does not read consultation data when the athlete binding is rejected", async () => {
  mockOrganizationId = "";
  jest.mocked(captureStudentConsultationContext).mockRejectedValueOnce(new Error("Vínculo indisponível"));
  const { result } = renderHook(() => useConsultationScreenContext("other-org", { studentId: "other-athlete", organizationId: "other-org" }));
  await expect(result.current.load(false)).rejects.toThrow("Vínculo indisponível");
  expect(getConsultationLocalState).not.toHaveBeenCalled();
  expect(getStudents).not.toHaveBeenCalled();
  expect(result.current.getContext()).toBeNull();
});

it("reuses a still-current verified athlete binding for an offline reload", async () => {
  mockOrganizationId = "";
  const { result } = renderHook(() => useConsultationScreenContext("athlete-org", { studentId: "athlete-1", organizationId: "athlete-org" }));
  await act(async () => { await result.current.load(false); });
  const verified = result.current.getContext()!;
  jest.mocked(captureStudentConsultationContext).mockRejectedValueOnce(new Error("Rede indisponível"));
  jest.mocked(getConsultationLocalState).mockResolvedValueOnce({
    ...snapshot(verified), persistenceStatus: { mode: "local", reason: "network", message: "Salvo neste dispositivo" },
  });
  const reloaded = await result.current.load(false);
  expect(reloaded?.snapshot.persistenceStatus.mode).toBe("local");
  expect(captureStudentConsultationContext).toHaveBeenCalledTimes(1);
  expect(getConsultationLocalState).toHaveBeenLastCalledWith(verified);
});

it("does not recapture scope through a callback belonging to an old session", async () => {
  const { result } = renderHook(() => useConsultationScreenContext("org-a"));
  await act(async () => { await result.current.load(false); });
  const oldLoad = result.current.load;
  mockSession = { userId: "user-b", generation: 2 };
  expect(await oldLoad(true)).toBeNull();
  expect(captureConsultationContext).toHaveBeenCalledTimes(1);
  expect(getStudents).not.toHaveBeenCalled();
});
