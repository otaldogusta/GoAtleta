import { supportsUndoKeyboardShortcut } from "../confirm-undo-keyboard";

describe("supportsUndoKeyboardShortcut", () => {
  const keyboardHost = {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };

  it("never registers DOM keyboard listeners on Android", () => {
    expect(supportsUndoKeyboardShortcut("android", keyboardHost)).toBe(false);
  });

  it("rejects incomplete window-like hosts", () => {
    expect(supportsUndoKeyboardShortcut("web", {})).toBe(false);
    expect(
      supportsUndoKeyboardShortcut("web", {
        addEventListener: jest.fn(),
      })
    ).toBe(false);
  });

  it("allows the browser keyboard shortcut when both listeners exist", () => {
    expect(supportsUndoKeyboardShortcut("web", keyboardHost)).toBe(true);
  });
});
