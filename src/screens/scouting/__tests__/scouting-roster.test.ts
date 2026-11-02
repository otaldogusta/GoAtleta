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

test("hides the previous roster during scope changes and rejects a late read after returning", async () => {
  await AsyncStorage.setItem("goatleta:scouting-roster:v1:user:org:first", JSON.stringify([{ studentId: "a", jersey: "12" }]));
  const hook = renderHook(({ game }) => useScoutingRoster("user", "org", game), { initialProps: { game: "first" } });
  await waitFor(() => expect(hook.result.current.players).toEqual([{ studentId: "a", jersey: "12" }]));
  let finishSecond!: (value: string | null) => void, finishFirst!: (value: string | null) => void;
  const pending = jest.spyOn(AsyncStorage, "getItem")
    .mockImplementationOnce(() => new Promise(resolve => { finishSecond = resolve; }))
    .mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; }));
  hook.rerender({ game: "second" });
  expect(hook.result.current.players).toBeNull();
  expect(hook.result.current.loading).toBe(true);
  hook.rerender({ game: "first" });
  expect(hook.result.current.players).toBeNull();
  expect(hook.result.current.loading).toBe(true);
  await act(async () => { finishSecond(JSON.stringify([{ studentId: "other", jersey: "7" }])); });
  expect(hook.result.current.players).toBeNull();
  await act(async () => { finishFirst(JSON.stringify([{ studentId: "a", jersey: "14" }])); });
  expect(hook.result.current).toMatchObject({ players: [{ studentId: "a", jersey: "14" }], loading: false, error: "" });
  pending.mockRestore(); hook.unmount();
});
