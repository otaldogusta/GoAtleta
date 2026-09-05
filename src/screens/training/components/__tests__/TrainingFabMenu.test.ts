import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Modal, Platform, View } from "react-native";

import { AnchoredDropdown } from "../../../../ui/AnchoredDropdown";
import { Pressable } from "../../../../ui/Pressable";
import {
  resolveTrainingFabMenuLayout,
  TrainingFabMenu,
} from "../TrainingFabMenu";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("expo-router", () => ({
  usePathname: () => "/training",
}));

jest.mock("../../../../ui/app-theme", () => ({
  useAppTheme: () => ({
    mode: "dark",
    colors: {
      background: "#0f172a",
      border: "#253247",
      card: "#111827",
      primaryBg: "#22c55e",
      primaryText: "#052e16",
      text: "#f8fafc",
    },
  }),
}));

jest.mock("../../../../ui/icon-registry", () => ({
  GoAtletaIcon: (props: Record<string, unknown>) => {
    const ReactRuntime = jest.requireActual("react");
    return ReactRuntime.createElement("GoAtletaIcon", props);
  },
}));

describe("TrainingFabMenu", () => {
  const originalPlatform = Platform.OS;

  afterAll(() => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: originalPlatform,
    });
  });

  it("right-aligns a measured FAB and rejects invalid measurements", () => {
    expect(resolveTrainingFabMenuLayout(300, 600, 56, 56)).toEqual({
      x: 136,
      y: 600,
      width: 220,
      height: 56,
    });
    expect(resolveTrainingFabMenuLayout(4, 600, 56, 56)?.x).toBe(16);
    expect(resolveTrainingFabMenuLayout(300, 600, 0, 56)).toBeNull();
    expect(resolveTrainingFabMenuLayout(Number.NaN, 600, 56, 56)).toBeNull();
  });

  it("uses the menu-density dropdown and forwards native backdrop and Back closes", () => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
    const anchorRef = React.createRef<View>();
    const onClose = jest.fn();
    const onCreatePress = jest.fn();
    const onImportPress = jest.fn();
    const layout = resolveTrainingFabMenuLayout(300, 600, 56, 56);
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        React.createElement(TrainingFabMenu, {
          visible: true,
          anchorRef,
          layout,
          onClose,
          onCreatePress,
          onImportPress,
        }),
      );
    });

    const dropdown = renderer!.root.findByType(AnchoredDropdown);
    expect(dropdown.props).toEqual(
      expect.objectContaining({
        visible: true,
        layout,
        container: null,
        density: "menu",
        nestedScrollEnabled: false,
        onRequestClose: onClose,
      }),
    );
    expect(dropdown.props.interactiveRefs).toEqual([anchorRef]);

    act(() => {
      renderer!.root.findByType(Modal).props.onRequestClose();
      renderer!.root.findByProps({ accessibilityLabel: "Fechar lista" }).props.onPress();
    });
    expect(onClose).toHaveBeenCalledTimes(2);

    const actions = renderer!.root.findAllByType(Pressable);
    expect(actions).toHaveLength(2);
    act(() => {
      actions[0].props.onPress();
      actions[1].props.onPress();
    });
    expect(onCreatePress).toHaveBeenCalledTimes(1);
    expect(onImportPress).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(renderer!.toJSON())).toContain("Criar treino");
    expect(JSON.stringify(renderer!.toJSON())).toContain("Importar planilha");
  });
});
