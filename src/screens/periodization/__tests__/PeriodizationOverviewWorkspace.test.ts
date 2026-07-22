import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text } from "react-native";

import type { ThemeColors } from "../../../ui/app-theme";
import { PeriodizationOverviewWorkspace } from "../PeriodizationOverviewWorkspace";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: (props: Record<string, unknown>) => {
    const ReactRuntime = require("react");
    return ReactRuntime.createElement("Ionicons", props);
  },
}));

jest.mock("react-native-svg", () => {
  const ReactRuntime = require("react");
  const component = (name: string) => (props: Record<string, unknown>) =>
    ReactRuntime.createElement(name, props, props.children);
  return {
    __esModule: true,
    default: component("Svg"),
    Circle: component("Circle"),
    Line: component("Line"),
    Path: component("Path"),
    Polyline: component("Polyline"),
  };
});

const colors = {
  background: "#0f172a",
  border: "#253247",
  card: "#111827",
  muted: "#94a3b8",
  primaryBg: "#4ade80",
  primaryText: "#052e16",
  secondaryBg: "#1e293b",
  successBg: "#14532d",
  successText: "#bbf7d0",
  text: "#f8fafc",
} as ThemeColors;

const weeks = [
  {
    week: 1,
    title: "Fundamentos",
    focus: "Recepção",
    volume: "baixo" as const,
    notes: [],
    dateRange: "06–12 Jan",
    jumpTarget: "20",
    PSETarget: "4-5",
    plannedSessionLoad: 240,
    plannedWeeklyLoad: 480,
    source: "AUTO" as const,
  },
  {
    week: 2,
    title: "Jogos reduzidos",
    focus: "Decisão",
    volume: "médio" as const,
    notes: [],
    dateRange: "13–19 Jan",
    jumpTarget: "24",
    PSETarget: "5-6",
    plannedSessionLoad: 300,
    plannedWeeklyLoad: 600,
    source: "AUTO" as const,
  },
];

const collectText = (root: TestRenderer.ReactTestInstance) =>
  root
    .findAllByType(Text)
    .map((node) => (Array.isArray(node.props.children) ? node.props.children.join("") : node.props.children))
    .join(" ");

describe("PeriodizationOverviewWorkspace", () => {
  it("keeps the macrocycle to month, period and block while exposing selectable intervals", () => {
    const onSelectedWeekChange = jest.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        React.createElement(PeriodizationOverviewWorkspace, {
          colors,
          cycleTitle: "Macrociclo anual",
          weekPlans: weeks,
          currentWeek: 1,
          selectedWeekNumber: 1,
          monthSegments: [{ label: "Jan", length: 2 }],
          periodSegments: [{ label: "Base técnica", length: 2 }],
          blockSegments: [{ label: "Fundamentos", length: 2 }],
          weeklySessions: 2,
          periodizationModel: "iniciacao",
          sportProfile: "voleibol",
          classTimeLabel: "14:00",
          classConfigurationLabel: "Fundamentos · Iniciante · 52 semanas",
          onSelectedWeekChange,
          onOpenManager: jest.fn(),
          onOpenClassSettings: jest.fn(),
          onEditSelectedWeek: jest.fn(),
          onOpenPlanning: jest.fn(),
        })
      );
    });

    const root = renderer!.root;
    const text = collectText(root);
    expect(text).toContain("Mês");
    expect(text).toContain("Período");
    expect(text).toContain("Bloco");
    expect(text).toContain("Macrociclo anual");
    expect(text).not.toContain("Macrociclo — Macrociclo");
    expect(text).not.toContain("Sessão em foco");
    expect(text).not.toContain("Evolução do bloco");
    expect(text).not.toContain("Mesociclo");
    expect(text).not.toContain("Carga semanal");

    const secondPoint = root.findByProps({ accessibilityLabel: "Selecionar ponto 13–19 Jan" });
    expect(secondPoint.props.onPressIn).toBeUndefined();
    act(() => secondPoint.props.onPress());
    expect(onSelectedWeekChange).toHaveBeenCalledWith(2);
    expect(onSelectedWeekChange).toHaveBeenCalledTimes(1);
  });
});
