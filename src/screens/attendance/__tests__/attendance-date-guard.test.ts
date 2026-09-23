import { act, renderHook } from "@testing-library/react-native";
import type { ConfirmDialogOptions } from "../../../ui/confirm-dialog";
import { useAttendanceDateGuard } from "../use-attendance-date-guard";

let mockOptions: ConfirmDialogOptions;
let mockResolve: (value: boolean) => void;
const mockConfirm = jest.fn((options: ConfirmDialogOptions) => {
  mockOptions = options;
  return new Promise<boolean>((resolve) => { mockResolve = resolve; });
});
jest.mock("../../../ui/confirm-dialog", () => ({ useConfirmDialog: () => ({ confirm: mockConfirm }) }));
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 8, 21, 12));
  mockConfirm.mockClear();
});
afterEach(() => jest.useRealTimers());
const setup = (date = "2026-09-22") => renderHook(
  (props) => useAttendanceDateGuard(props.classId, props.date, props.enabled),
  { initialProps: { classId: "class-a", date, enabled: true } }
);
async function accept() {
  await act(async () => { mockOptions.onConfirm(); mockResolve(true); });
}
it("allows today without a dialog", async () => {
  const { result } = setup("2026-09-21");
  const mark = jest.fn();
  await act(async () => { await result.current(mark); });
  expect(mark).toHaveBeenCalledTimes(1);
  expect(mockConfirm).not.toHaveBeenCalled();
});
it.each(["2026-09-20", "2026-09-22"])("requires consent for %s before marking and only once", async (date) => {
  const { result } = setup(date);
  const mark = jest.fn();
  act(() => { void result.current(mark); void result.current(mark); });
  expect(mark).not.toHaveBeenCalled();
  expect(mockConfirm).toHaveBeenCalledTimes(1);
  expect(mockOptions.message).toContain("21/09/2026");
  await accept();
  expect(mark).toHaveBeenCalledTimes(1);
  await act(async () => { await result.current(mark); });
  expect(mark).toHaveBeenCalledTimes(2);
  expect(mockConfirm).toHaveBeenCalledTimes(1);
});
it("forgets consent after switching dates and reopening", async () => {
  const { result, rerender } = setup();
  act(() => { void result.current(jest.fn()); });
  await accept();
  rerender({ classId: "class-a", date: "2026-09-23", enabled: true });
  rerender({ classId: "class-a", date: "2026-09-22", enabled: true });
  act(() => { void result.current(jest.fn()); });
  expect(mockConfirm).toHaveBeenCalledTimes(2);
  await accept();
  rerender({ classId: "class-a", date: "2026-09-22", enabled: false });
  rerender({ classId: "class-a", date: "2026-09-22", enabled: true });
  act(() => { void result.current(jest.fn()); });
  expect(mockConfirm).toHaveBeenCalledTimes(3);
});
it("does not execute stale marking after changing class", async () => {
  const { result, rerender } = setup();
  const mark = jest.fn();
  act(() => { void result.current(mark); });
  rerender({ classId: "class-b", date: "2026-09-22", enabled: true });
  await accept();
  expect(mark).not.toHaveBeenCalled();
});
it("goes to today only through the explicit button, never on dismissal", async () => {
  const goToday = jest.fn();
  const mark = jest.fn();
  const { result } = renderHook(() => useAttendanceDateGuard("a", "2026-09-22", true, goToday));
  act(() => { void result.current(mark); });
  await act(async () => { mockResolve(false); });
  expect(goToday).not.toHaveBeenCalled();
  act(() => { void result.current(mark); });
  await act(async () => { mockOptions.onCancel?.(); mockResolve(false); });
  expect(goToday).toHaveBeenCalledWith("2026-09-21");
  expect(mark).not.toHaveBeenCalled();
});
