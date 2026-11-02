import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useScoutingRoster, validateScoutingRoster } from "../use-scouting-roster";

beforeEach(async () => { await AsyncStorage.clear(); jest.clearAllMocks(); });
test("rejects duplicate jerseys including leading zeros", () => {
  expect(validateScoutingRoster([{ studentId: "a", jersey: "01" }, { studentId: "b", jersey: "1" }])).toMatch(/repetidas/);
  expect(validateScoutingRoster([{ studentId: "a", jersey: "12" }, { studentId: "b", jersey: "14" }])).toBeNull();
});
test("restores a roster only for the same user, organization and game", async () => {
  const first = renderHook(() => useScoutingRoster("user", "org", "game"));
  await waitFor(() => expect(first.result.current.loading).toBe(false));
  await act(async () => { expect(await first.result.current.save([{ studentId: "a", jersey: "12" }])).toBe(true); });
  first.unmount();
  const restored = renderHook(() => useScoutingRoster("user", "org", "game"));
  await waitFor(() => expect(restored.result.current.players).toEqual([{ studentId: "a", jersey: "12" }]));
  for (const scope of [["other", "org", "game"], ["user", "other", "game"], ["user", "org", "other"]]) {
    const isolated = renderHook(() => useScoutingRoster(scope[0], scope[1], scope[2]));
    await waitFor(() => expect(isolated.result.current.loading).toBe(false));
    expect(isolated.result.current.players).toBeNull(); isolated.unmount();
  }
});
