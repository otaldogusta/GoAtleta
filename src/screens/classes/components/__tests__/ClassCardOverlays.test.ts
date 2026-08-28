import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Dimensions, Platform } from "react-native";

import type { ClassGroup } from "../../../../core/models";
import { buildClassCardViewModel } from "../../application/class-card-view-model";
import { ClassCard } from "../ClassCard";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../../../../observability/perf", () => ({ markRender: jest.fn() }));

jest.mock("react-native", () => {
  const ReactRuntime = require("react");
  const actual = jest.requireActual("react-native");
  const View = ReactRuntime.forwardRef(
    (props: Record<string, unknown>, ref: React.Ref<unknown>) =>
      ReactRuntime.createElement("View", { ...props, ref }, props.children)
  );
  return new Proxy(actual, {
    get(target, property, receiver) {
      if (property === "View") return View;
      return Reflect.get(target, property, receiver);
    },
  });
});

jest.mock("../../../../ui/AnchoredDropdown", () => ({
  AnchoredDropdown: ({ visible, children, ...props }: Record<string, unknown>) => {
    const ReactRuntime = require("react");
    return ReactRuntime.createElement(
      "AnchoredDropdown",
      { ...props, visible },
      visible ? children : null
    );
  },
}));

jest.mock("../../../../ui/ClassGenderBadge", () => ({
  ClassGenderBadge: (props: Record<string, unknown>) => {
    const ReactRuntime = require("react");
    return ReactRuntime.createElement("ClassGenderBadge", props);
  },
}));

jest.mock("../../../../ui/icon-registry", () => ({
  GoAtletaIcon: (props: Record<string, unknown>) => {
    const ReactRuntime = require("react");
    return ReactRuntime.createElement("GoAtletaIcon", props);
  },
}));

jest.mock("../../../../ui/Shimmer", () => ({
  ShimmerBlock: (props: Record<string, unknown>) => {
    const ReactRuntime = require("react");
    return ReactRuntime.createElement("ShimmerBlock", props);
  },
}));

const colors = {
  background: "#0f172a",
  backgroundSubtle: "#111c31",
  border: "#253247",
  borderSubtle: "#1e293b",
  card: "#111827",
  dangerText: "#fca5a5",
  infoBg: "#1e3a5f",
  infoText: "#bfdbfe",
  muted: "#94a3b8",
  primaryBg: "#22c55e",
  primaryText: "#052e16",
  secondaryBg: "#182235",
  surface: "#111827",
  surfaceElevated: "#172033",
  text: "#f8fafc",
  textMuted: "#94a3b8",
  textPrimary: "#f8fafc",
};

const classGroup = {
  id: "class-1",
  name: "Amigos do Vôlei",
  unit: "Capão da Imbuia",
  ageBand: "16-18",
  gender: "misto",
  goal: "Iniciação",
  modality: "voleibol",
  startTime: "13:30",
  durationMinutes: 75,
  daysOfWeek: [6],
} as ClassGroup;

const viewModel = buildClassCardViewModel({
  classGroup,
  students: [],
  teacher: { name: "Gustavo Ribeiro", photoUrl: null },
  staff: [
    { id: "assistant-1", name: "João Martins", role: "assistant" },
    { id: "intern-1", name: "Ana Júlia", role: "intern" },
  ],
});

const renderCard = (overrides: Record<string, unknown> = {}) =>
  TestRenderer.create(
    React.createElement(ClassCard, {
      item: classGroup,
      conflicts: [],
      dayNames: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
      colors,
      onOpen: jest.fn(),
      viewModel,
      onToggleActionMenu: jest.fn(),
      onCloseActionMenu: jest.fn(),
      onEdit: jest.fn(),
      onDuplicate: jest.fn(),
      onDelete: jest.fn(),
      ...overrides,
    }),
    {
      createNodeMock: () => ({
        measureInWindow: (
          callback: (x: number, y: number, width: number, height: number) => void
        ) => callback(300, 100, 40, 40),
      }),
    }
  );

describe("ClassCard mobile overlays", () => {
  const originalPlatform = Platform.OS;
  let dimensionsSpy: jest.SpyInstance;

  beforeEach(() => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
    dimensionsSpy = jest.spyOn(Dimensions, "get").mockReturnValue({
      width: 390,
      height: 844,
      scale: 3,
      fontScale: 1,
    });
  });

  afterEach(() => {
    dimensionsSpy.mockRestore();
  });

  afterAll(() => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: originalPlatform,
    });
  });

  it("anchors the class action menu on Android and preserves every action", () => {
    const onCloseActionMenu = jest.fn();
    const onEdit = jest.fn();
    const onDuplicate = jest.fn();
    const onDelete = jest.fn();
    const onOpen = jest.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = renderCard({
        actionMenuOpen: true,
        onCloseActionMenu,
        onEdit,
        onDuplicate,
        onDelete,
        onOpen,
      });
    });

    const openDropdown = renderer!.root
      .findAllByType("AnchoredDropdown")
      .find((node) => node.props.visible);

    expect(openDropdown).toBeDefined();
    expect(openDropdown?.props.density).toBe("menu");
    expect(openDropdown?.props.container).toBeNull();
    expect(openDropdown?.props.layout).toEqual({ x: 208, y: 100, width: 132, height: 40 });
    expect(renderer!.root.findByProps({ accessibilityLabel: "Editar Amigos do Vôlei" })).toBeTruthy();
    expect(renderer!.root.findByProps({ accessibilityLabel: "Duplicar Amigos do Vôlei" })).toBeTruthy();
    expect(renderer!.root.findByProps({ accessibilityLabel: "Ver turma Amigos do Vôlei" })).toBeTruthy();
    expect(renderer!.root.findByProps({ accessibilityLabel: "Apagar Amigos do Vôlei" })).toBeTruthy();

    act(() => {
      openDropdown?.props.onRequestClose();
    });
    expect(onCloseActionMenu).toHaveBeenCalledTimes(1);

    onCloseActionMenu.mockClear();
    act(() => {
      renderer!.root
        .findByProps({ accessibilityLabel: "Editar Amigos do Vôlei" })
        .props.onPress({ stopPropagation: jest.fn() });
    });
    expect(onCloseActionMenu).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(classGroup);
    expect(onDuplicate).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();

    act(() => renderer!.unmount());
  });

  it("opens and closes the support-team popover through the canonical Android overlay", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = renderCard({ actionMenuOpen: false });
    });

    const trigger = renderer!.root.findByProps({
      accessibilityLabel: "2 profissionais de apoio",
    });
    act(() => {
      trigger.props.onPress({ stopPropagation: jest.fn() });
    });

    const openDropdown = renderer!.root
      .findAllByType("AnchoredDropdown")
      .find((node) => node.props.visible);

    expect(openDropdown).toBeDefined();
    expect(openDropdown?.props.density).toBe("menu");
    expect(openDropdown?.props.container).toBeNull();
    expect(openDropdown?.props.layout).toEqual({ x: 92, y: 100, width: 248, height: 40 });

    act(() => {
      openDropdown?.props.onRequestClose();
    });
    expect(
      renderer!.root.findAllByType("AnchoredDropdown").filter((node) => node.props.visible)
    ).toHaveLength(0);

    act(() => renderer!.unmount());
  });
});
