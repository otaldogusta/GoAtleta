import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Platform } from "react-native";
import { ConfirmUndoProvider, useConfirmUndo } from "../confirm-undo";
import type { ConfirmUndoOptions } from "../confirm-undo";

jest.mock("../app-theme", () => ({
  useAppTheme: () => ({
    colors: {
      background: "#08111f",
      border: "#26354b",
      text: "#f8fafc",
      muted: "#94a3b8",
      secondaryBg: "#172337",
      secondaryText: "#f8fafc",
      dangerSolidBg: "#ef4444",
      dangerSolidText: "#ffffff",
      card: "#111c2f",
      primaryBg: "#34d399",
      primaryText: "#08111f",
    },
  }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("../ModalSheet", () => {
  const ReactModule = jest.requireActual<typeof React>("react");
  return {
    ModalSheet: ({
      visible,
      children,
    }: {
      visible: boolean;
      children: React.ReactNode;
    }) =>
      visible
        ? ReactModule.createElement(ReactModule.Fragment, null, children)
        : null,
  };
});

jest.mock("../Pressable", () => {
  const ReactModule = jest.requireActual<typeof React>("react");
  return {
    Pressable: ({ children, ...props }: { children: React.ReactNode }) =>
      ReactModule.createElement("Pressable", props, children),
  };
});

describe("ConfirmUndoProvider on native", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {},
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    if (originalWindow) {
      Object.defineProperty(globalThis, "window", originalWindow);
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
  });

  it("opens the undo banner without requiring DOM event listeners", async () => {
    expect(Platform.OS).not.toBe("web");

    let confirmAction: ((options: ConfirmUndoOptions) => void) | null = null;
    const onOptimistic = jest.fn();
    const onConfirm = jest.fn();
    const onUndo = jest.fn();

    function Harness() {
      confirmAction = useConfirmUndo().confirm;
      return null;
    }

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        React.createElement(
          ConfirmUndoProvider,
          null,
          React.createElement(Harness)
        )
      );
    });

    act(() => {
      confirmAction?.({
        title: "Excluir?",
        message: "Confirmar exclusão?",
        confirmLabel: "Excluir",
        undoMessage: "Item excluído. Desfazer?",
        onOptimistic,
        onConfirm,
        onUndo,
      });
    });

    const confirmationActions = renderer!.root.findAllByType("Pressable");
    expect(confirmationActions).toHaveLength(2);

    expect(() => {
      act(() => {
        confirmationActions[1].props.onPress();
      });
    }).not.toThrow();

    expect(onOptimistic).toHaveBeenCalledTimes(1);
    const undoActions = renderer!.root.findAllByType("Pressable");
    expect(undoActions).toHaveLength(1);
    const undoBanner = renderer!.root.findAll(
      (node) => node.props.style?.position === "absolute" && node.props.style?.zIndex === 9999
    );
    expect(undoBanner.map((node) => node.props.style.top)).toContain(36);

    await act(async () => {
      await undoActions[0].props.onPress();
    });

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    act(() => {
      renderer!.unmount();
    });
  });
});
