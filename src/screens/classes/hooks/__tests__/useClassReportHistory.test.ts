import { act, renderHook, waitFor } from "@testing-library/react-native";
import { getClassReportHistory } from "../../../../db/session-report-history";
import { useClassReportHistory } from "../useClassReportHistory";

jest.mock("../../../../db/session-report-history", () => ({ getClassReportHistory: jest.fn() }));
const scope = { enabled: true, classId: "class-1", organizationId: "org-1", userId: "user-1" };
const report = { id: "1", clientId: "1", createdAt: "2026-10-07T12:00:00Z", activity: "Recepção", conclusion: "" };

beforeEach(() => jest.resetAllMocks());

it("loads only when opened and retries a failed read", async () => {
  (getClassReportHistory as jest.Mock).mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce([report]);
  const { result, rerender } = renderHook(props => useClassReportHistory(props), { initialProps: { ...scope, enabled: false } });
  expect(getClassReportHistory).not.toHaveBeenCalled();
  rerender(scope);
  await waitFor(() => expect(result.current.error).toBe(true));
  act(() => result.current.reload());
  await waitFor(() => expect(result.current.entries).toHaveLength(1));
  expect(result.current.error).toBe(false);
});

it.each(["organizationId", "userId", "classId"] as const)("discards a late response after %s changes", async field => {
  let resolveOld!: (value: typeof report[]) => void;
  (getClassReportHistory as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })).mockResolvedValueOnce([]);
  const { result, rerender } = renderHook(props => useClassReportHistory(props), { initialProps: scope });
  await waitFor(() => expect(getClassReportHistory).toHaveBeenCalledTimes(1));
  const oldSignal = (getClassReportHistory as jest.Mock).mock.calls[0][0].signal;
  rerender({ ...scope, [field]: "different-scope" });
  expect(oldSignal.aborted).toBe(true);
  await act(async () => resolveOld([report]));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.entries).toEqual([]);
});

it("clears existing records immediately when the user changes", async () => {
  (getClassReportHistory as jest.Mock).mockResolvedValueOnce([report]).mockImplementationOnce(() => new Promise(() => {}));
  const { result, rerender } = renderHook(props => useClassReportHistory(props), { initialProps: scope });
  await waitFor(() => expect(result.current.entries).toHaveLength(1));
  rerender({ ...scope, userId: "user-2" });
  expect(result.current.entries).toEqual([]);
});
