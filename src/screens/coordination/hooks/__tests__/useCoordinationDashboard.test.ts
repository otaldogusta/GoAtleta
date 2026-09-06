import { act, renderHook } from "@testing-library/react-native";
import {
  loadCoordinationDashboard, loadCoordinationInsights,
  type CoordinationDashboardData, type CoordinationInsights,
} from "../../application/load-coordination-dashboard";
import { useCoordinationDashboard } from "../useCoordinationDashboard";

jest.mock("../../application/load-coordination-dashboard", () => ({
  loadCoordinationDashboard: jest.fn(), loadCoordinationInsights: jest.fn(),
}));
jest.mock("../../../../observability/perf", () => ({
  measureAsync: (_name: string, run: () => Promise<unknown>) => run(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function dashboard(name: string): CoordinationDashboardData {
  return {
    classes: [], pendingAttendance: [], pendingReports: [], failedWrites: [],
    organizationMembers: [], memberClassHeads: [], pendingTrainerInvites: [], pendingAccessRequests: [],
    organizationClasses: [{ id: name, name, unit: "Unit", daysOfWeek: [], startTime: "", endTime: "" }],
    pendingWritesDiagnostics: { total: 0, highRetry: 0, maxRetry: 0, deadLetterCandidates: 0, deadLetterStored: 0 },
  };
}
const noInsights: CoordinationInsights = { recentActivity: [], signals: [], classRadarItems: [] };
const scope = { userId: "user-a", organizationId: "org-a", enabled: true };

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(loadCoordinationDashboard).mockResolvedValue(dashboard("initial"));
  jest.mocked(loadCoordinationInsights).mockResolvedValue(noInsights);
});

it("opens the operational workspace without waiting for optional intelligence", async () => {
  const slowInsights = deferred<CoordinationInsights>();
  jest.mocked(loadCoordinationInsights).mockReturnValue(slowInsights.promise);
  const { result } = renderHook(() => useCoordinationDashboard(scope));
  await act(async () => { await result.current.loadDashboard(); });
  expect(result.current.loading).toBe(false);
  expect(result.current.loadedOrganizationId).toBe("org-a");
  expect(result.current.organizationClasses[0].name).toBe("initial");
  await act(async () => { slowInsights.reject(new Error("AI offline")); });
  expect(result.current.error).toBeNull();
  expect(result.current.organizationClasses[0].name).toBe("initial");
});

it("clears a previous snapshot and exposes an error when a critical refresh fails", async () => {
  const { result } = renderHook(() => useCoordinationDashboard(scope));
  await act(async () => { await result.current.loadDashboard(); });
  jest.mocked(loadCoordinationDashboard).mockRejectedValue(new Error("network failed"));
  await act(async () => { await result.current.refreshDashboard(); });
  expect(result.current.error).toBeTruthy();
  expect(result.current.organizationClasses).toEqual([]);
  expect(result.current.refreshing).toBe(false);
  expect(result.current.loading).toBe(false);
});

it.each(["organizationId", "userId"] as const)("hides old data immediately when %s changes and ignores its late request", async (field) => {
  const old = deferred<CoordinationDashboardData>();
  const { result, rerender } = renderHook((props) => useCoordinationDashboard(props), { initialProps: scope });
  await act(async () => { await result.current.loadDashboard(); });
  jest.mocked(loadCoordinationDashboard).mockReturnValueOnce(old.promise);
  let oldRequest!: Promise<void>;
  act(() => { oldRequest = result.current.refreshDashboard(); });
  rerender({ ...scope, [field]: "new-context" });
  expect(result.current.organizationClasses).toEqual([]);
  expect(result.current.loadedOrganizationId).toBeNull();
  jest.mocked(loadCoordinationDashboard).mockResolvedValueOnce(dashboard("new"));
  await act(async () => { await result.current.loadDashboard(); });
  await act(async () => { old.resolve(dashboard("stale")); await oldRequest; });
  expect(result.current.organizationClasses[0].name).toBe("new");
});

it("keeps the newest refresh even when an older request fails afterward", async () => {
  const old = deferred<CoordinationDashboardData>();
  jest.mocked(loadCoordinationDashboard).mockReturnValueOnce(old.promise);
  const { result } = renderHook(() => useCoordinationDashboard(scope));
  let oldRequest!: Promise<void>;
  act(() => { oldRequest = result.current.loadDashboard(); });
  jest.mocked(loadCoordinationDashboard).mockResolvedValueOnce(dashboard("new"));
  await act(async () => { await result.current.refreshDashboard(); });
  await act(async () => { old.reject(new Error("late failure")); await oldRequest; });
  expect(result.current.organizationClasses[0].name).toBe("new");
  expect(result.current.error).toBeNull();
});

it("does not attach insights from a previous snapshot after a refresh", async () => {
  const oldInsights = deferred<CoordinationInsights>();
  jest.mocked(loadCoordinationInsights).mockReturnValueOnce(oldInsights.promise);
  const { result } = renderHook(() => useCoordinationDashboard(scope));
  await act(async () => { await result.current.loadDashboard(); });
  await act(async () => { await result.current.refreshDashboard(); });
  await act(async () => { oldInsights.resolve({ ...noInsights, recentActivity: [{
    organizationId: "org-a", classId: "old", className: "Old", unit: "Unit", kind: "attendance",
    occurredAt: "2026-09-01", actorUserId: null, affectedRows: 1, referenceDate: "2026-09-01",
  }] }); });
  expect(result.current.recentActivity).toEqual([]);
});

it.each([
  { ...scope, enabled: false }, { ...scope, userId: null }, { ...scope, organizationId: null },
])("does not read without a complete authorized scope: %j", async (props) => {
  const { result } = renderHook(() => useCoordinationDashboard(props));
  await act(async () => { await result.current.loadDashboard(); });
  expect(loadCoordinationDashboard).not.toHaveBeenCalled();
});

it("invalidates in-flight work and old callbacks when access is revoked", async () => {
  const old = deferred<CoordinationDashboardData>();
  jest.mocked(loadCoordinationDashboard).mockReturnValueOnce(old.promise);
  const { result, rerender } = renderHook((props) => useCoordinationDashboard(props), { initialProps: scope });
  const staleCallback = result.current.loadDashboard;
  let oldRequest!: Promise<void>;
  act(() => { oldRequest = staleCallback(); });
  rerender({ ...scope, enabled: false });
  await act(async () => { old.resolve(dashboard("stale")); await oldRequest; await staleCallback(); });
  expect(result.current.organizationClasses).toEqual([]);
  expect(loadCoordinationInsights).not.toHaveBeenCalled();
  expect(loadCoordinationDashboard).toHaveBeenCalledTimes(1);
});

it("does not start optional work after unmounting", async () => {
  const old = deferred<CoordinationDashboardData>();
  jest.mocked(loadCoordinationDashboard).mockReturnValueOnce(old.promise);
  const { result, unmount } = renderHook(() => useCoordinationDashboard(scope));
  let oldRequest!: Promise<void>;
  act(() => { oldRequest = result.current.loadDashboard(); });
  unmount();
  await act(async () => { old.resolve(dashboard("stale")); await oldRequest; });
  expect(loadCoordinationInsights).not.toHaveBeenCalled();
});
