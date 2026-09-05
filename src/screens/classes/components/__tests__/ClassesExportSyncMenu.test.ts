import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Platform } from "react-native";

import type { ThemeColors } from "../../../../ui/app-theme";
import { ClassesExportSyncMenu } from "../ClassesExportSyncMenu";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///cache/",
  documentDirectory: "file:///documents/",
  EncodingType: { UTF8: "utf8" },
  writeAsStringAsync: jest.fn(),
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(),
}));

jest.mock("../../../../utils/export-xlsx", () => ({
  exportWorkbookXlsx: jest.fn(),
  slugify: (value: string) => value,
}));

jest.mock("../../../../ui/save-toast", () => ({
  useSaveToast: () => ({ showSaveToast: jest.fn() }),
}));

jest.mock("../../../../ui/use-collapsible", () => ({
  useCollapsibleAnimation: (open: boolean) => ({
    animatedStyle: { opacity: open ? 1 : 0 },
    isVisible: open,
  }),
}));

jest.mock("../../../../ui/icon-registry", () => ({
  GoAtletaIcon: (props: Record<string, unknown>) => {
    const ReactRuntime = jest.requireActual("react");
    return ReactRuntime.createElement("GoAtletaIcon", props);
  },
}));

jest.mock("../../../../ui/AnchoredDropdown", () => ({
  AnchoredDropdown: ({ visible, children, ...props }: Record<string, unknown>) => {
    const ReactRuntime = jest.requireActual("react");
    return ReactRuntime.createElement(
      "AnchoredDropdown",
      { ...props, visible },
      visible ? children : null
    );
  },
}));

jest.mock("../../../../ui/ModalSheet", () => ({
  ModalSheet: ({ visible, children, ...props }: Record<string, unknown>) => {
    const ReactRuntime = jest.requireActual("react");
    return ReactRuntime.createElement(
      "ModalSheet",
      { ...props, visible },
      visible ? children : null
    );
  },
}));

const colors = {
  background: "#0f172a",
  border: "#253247",
  borderSubtle: "#1e293b",
  card: "#111827",
  muted: "#94a3b8",
  primaryBg: "#22c55e",
  primaryText: "#052e16",
  secondaryBg: "#182235",
  secondaryText: "#cbd5e1",
  success: "#22c55e",
  text: "#f8fafc",
  textMuted: "#94a3b8",
  textPrimary: "#f8fafc",
} as ThemeColors;

const setPlatform = (os: "android" | "web") => {
  Object.defineProperty(Platform, "OS", { configurable: true, value: os });
};

const renderMenu = () =>
  TestRenderer.create(
    React.createElement(ClassesExportSyncMenu, {
      classes: [{ id: "class-1", name: "Turma A" }] as never,
      classCardViewModelsById: {},
      colors,
      googleAccountConnected: true,
      compact: true,
      onImportStudents: jest.fn(),
      onExportAttendance: jest.fn(),
    }),
    {
      createNodeMock: () => ({
        measureInWindow: (
          callback: (x: number, y: number, width: number, height: number) => void
        ) => callback(300, 24, 44, 40),
      }),
    }
  );

describe("ClassesExportSyncMenu", () => {
  const originalPlatform = Platform.OS;

  afterAll(() => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: originalPlatform,
    });
  });

  it("opens a native sheet with accessible actions on Android", () => {
    setPlatform("android");
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = renderMenu();
    });

    expect(renderer!.root.findAllByType("AnchoredDropdown")).toHaveLength(0);
    act(() => {
      renderer!.root.findByProps({ accessibilityLabel: "Exportar e sincronizar" }).props.onPress();
    });

    expect(renderer!.root.findByType("ModalSheet").props.visible).toBe(true);
    expect(
      renderer!.root.findByProps({ accessibilityLabel: "Exportar chamadas" }).props
        .accessibilityRole
    ).toBe("button");
    expect(
      renderer!.root.findByProps({ accessibilityLabel: "Fechar ações de exportação" })
    ).toBeTruthy();
  });

  it("keeps the anchored dropdown presentation on web", () => {
    setPlatform("web");
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = renderMenu();
    });

    expect(renderer!.root.findAllByType("ModalSheet")).toHaveLength(0);
    expect(renderer!.root.findByType("AnchoredDropdown").props).toEqual(
      expect.objectContaining({ visible: false, density: "menu", container: null })
    );
    expect(
      renderer!.root.findByProps({ accessibilityLabel: "Exportar e sincronizar" }).props
        .accessibilityRole
    ).toBe("button");
  });
});
