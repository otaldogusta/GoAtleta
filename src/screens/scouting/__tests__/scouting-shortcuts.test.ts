import { act, renderHook } from "@testing-library/react-native";
import { useScoutingShortcuts } from "../use-scouting-shortcuts";

const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
let handler: ((event: any) => void) | undefined;
beforeEach(() => {
  handler = undefined;
  Object.defineProperty(globalThis, "document", { configurable: true, value: {
    addEventListener: (_name: string, cb: typeof handler) => { handler = cb; },
    removeEventListener: () => { handler = undefined; },
  } });
});
afterEach(() => {
  if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
  else Reflect.deleteProperty(globalThis, "document");
});
const event = (extra = {}) => ({ key: "z", ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, repeat: false,
  defaultPrevented: false, preventDefault: jest.fn(), stopPropagation: jest.fn(), target: { closest: () => null }, ...extra });
test("Ctrl/Cmd Z undo, Shift Z redo, and listener cleanup", () => {
  const undo = jest.fn(), redo = jest.fn();
  const view = renderHook(() => useScoutingShortcuts({ enabled: true, canUndo: true, canRedo: true, undo, redo }));
  act(() => handler?.(event()));
  act(() => handler?.(event({ ctrlKey: false, metaKey: true, shiftKey: true })));
  expect(undo).toHaveBeenCalledTimes(1); expect(redo).toHaveBeenCalledTimes(1);
  view.unmount(); expect(handler).toBeUndefined();
});
test("inputs, repeat, pending actions and disabled collectors do not mutate points", () => {
  const undo = jest.fn(), redo = jest.fn();
  const view = renderHook(({ enabled, available }) => useScoutingShortcuts({ enabled, canUndo: available, canRedo: available, undo, redo }), { initialProps: { enabled: true, available: true } });
  const typing = event({ target: { closest: () => ({}) } });
  act(() => handler?.(typing)); act(() => handler?.(event({ repeat: true })));
  expect(typing.preventDefault).not.toHaveBeenCalled();
  view.rerender({ enabled: true, available: false });
  act(() => handler?.(event())); act(() => handler?.(event({ shiftKey: true })));
  expect(undo).not.toHaveBeenCalled(); expect(redo).not.toHaveBeenCalled();
  view.rerender({ enabled: false, available: false }); expect(handler).toBeUndefined();
});
