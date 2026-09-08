import { act, renderHook, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Animated, PanResponder } from "react-native";
import { useDraggableCopilotFab } from "../components/useDraggableCopilotFab";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: jest.fn().mockResolvedValue(null), setItem: jest.fn().mockResolvedValue(undefined) },
}));

describe("draggable assistant button", () => {
  beforeEach(() => jest.clearAllMocks());

  it("distinguishes a click from dragging, docks and persists the new position", async () => {
    const create = jest.spyOn(PanResponder, "create");
    const { result } = renderHook(() => useDraggableCopilotFab(108));
    await waitFor(() => expect(AsyncStorage.getItem).toHaveBeenCalled());
    const handlers = create.mock.calls[0][0];
    expect(result.current.canOpen()).toBe(true);
    expect(handlers.onMoveShouldSetPanResponder?.({} as never, { dx: 2, dy: 2 } as never)).toBe(false);
    act(() => {
      handlers.onPanResponderGrant?.({} as never, {} as never);
      handlers.onPanResponderMove?.({} as never, { dx: -10000, dy: -10000 } as never);
      handlers.onPanResponderRelease?.({} as never, {} as never);
    });
    expect(result.current.canOpen()).toBe(false);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith("copilot-fab-position:v1", JSON.stringify({ side: "left", ratio: 0 }));
    create.mockRestore();
  });

  it("restores a saved dock without opening the chat", async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce(JSON.stringify({ side: "left", ratio: 0 }));
    const setValue = jest.spyOn(Animated.ValueXY.prototype, "setValue");
    const { result } = renderHook(() => useDraggableCopilotFab(108));
    await waitFor(() => expect(setValue).toHaveBeenCalledWith({ x: 16, y: 16 }));
    expect(result.current.canOpen()).toBe(true);
    setValue.mockRestore();
  });
});
