import { act, renderHook } from "@testing-library/react-native";
import { useScreenRefresh } from "../useScreenRefresh";
const mockToast = jest.fn();
jest.mock("../save-toast", () => ({ useSaveToast: () => ({ showSaveToast: mockToast }) }));
it("deduplicates requests and ends loading after actual completion", async () => {
  let finish!: () => void;
  const load = jest.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  const { result } = renderHook(() => useScreenRefresh(load));
  let pending!: Promise<void>;
  act(() => { pending = result.current.onRefresh(); void result.current.onRefresh(); });
  expect(load).toHaveBeenCalledTimes(1);
  expect(result.current.refreshing).toBe(true);
  await act(async () => { finish(); await pending; });
  expect(result.current.refreshing).toBe(false);
});
it("reports failures and allows retry", async () => {
  const error = new Error("offline");
  const load = jest.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(undefined);
  const { result } = renderHook(() => useScreenRefresh(load));
  await act(async () => { await result.current.onRefresh(); });
  expect(mockToast).toHaveBeenCalledWith({ error, variant: "error" });
  expect(result.current.refreshing).toBe(false);
  await act(async () => { await result.current.onRefresh(); });
  expect(load).toHaveBeenCalledTimes(2);
});
