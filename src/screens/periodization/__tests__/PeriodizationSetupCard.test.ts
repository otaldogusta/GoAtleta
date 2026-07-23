import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text, View } from "react-native";

import { PeriodizationSetupCard } from "../PeriodizationSetupCard";
import type { ThemeColors } from "../../../ui/app-theme";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: (props: Record<string, unknown>) => {
    const ReactRuntime = require("react");
    return ReactRuntime.createElement("Ionicons", props);
  },
}));

const colors = {
  border: "#253247",
  card: "#111827",
  dangerText: "#FCA5A5",
  inputBg: "#0f172a",
  inputText: "#f8fafc",
  muted: "#94a3b8",
  placeholder: "#64748b",
  primaryBg: "#22c55e",
  primaryDisabledBg: "#334155",
  primaryText: "#052e16",
  secondaryBg: "#1e293b",
  secondaryText: "#94a3b8",
  successBg: "#14532d",
  successText: "#bbf7d0",
  text: "#f8fafc",
} as ThemeColors;

const collectText = (node: TestRenderer.ReactTestInstance): string => {
  const flatten = (value: unknown): string =>
    typeof value === "string" ? value : Array.isArray(value) ? value.map(flatten).join("") : "";

  return node.findAllByType(Text).map((item) => flatten(item.props.children)).join("");
};

const defaultProps = {
  colors,
  goal: "Fundamentos",
  mvLevel: "MV1",
  cycleStartDate: "2026-08-03",
  cycleLength: 52,
  showCyclePicker: false,
  cycleTriggerRef: React.createRef<View>(),
  configured: true,
  dirty: false,
  saving: false,
  error: "",
  onGoalChange: jest.fn(),
  onMvLevelChange: jest.fn(),
  onCycleStartDateChange: jest.fn(),
  onToggleCyclePicker: jest.fn(),
  onOpenCalendar: jest.fn(),
  onSave: jest.fn(),
};

describe("PeriodizationSetupCard", () => {
  it("keeps objective, level and cycle settings together per class", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(React.createElement(PeriodizationSetupCard, defaultProps));
    });

    const root = renderer!.root;
    expect(collectText(root)).toContain("Configuração da periodização");
    expect(collectText(root)).toContain("Macrociclo anual");
    expect(collectText(root)).toContain("Início do ciclo");
    expect(root.findByProps({ accessibilityLabel: "Objetivo da periodização" }).props.value).toBe(
      "Fundamentos"
    );
    expect(root.findByProps({ accessibilityLabel: "Nível Iniciação" })).toBeTruthy();
    expect(root.findByProps({ accessibilityLabel: "Duração do macrociclo anual" })).toBeTruthy();
  });

  it("only enables saving when the class setup changed", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        React.createElement(PeriodizationSetupCard, { ...defaultProps, dirty: true })
      );
    });

    const saveButton = renderer!.root.findAll(
      (node) => node.props.disabled === false && collectText(node).includes("Salvar configuração")
    )[0];

    expect(saveButton).toBeTruthy();
    act(() => saveButton.props.onPress());
    expect(defaultProps.onSave).toHaveBeenCalledTimes(1);
  });
});
