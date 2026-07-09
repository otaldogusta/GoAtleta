import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text, View } from "react-native";

import { OverviewTab } from "../OverviewTab";

import type { ClassGroup, PlanningCycle } from "../../../core/models";
import type { ThemeColors } from "../../../ui/app-theme";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: (props: Record<string, unknown>) => {
    const React = require("react");
    return React.createElement("Ionicons", props);
  },
}));

const colors = {
  border: "#253247",
  card: "#111827",
  dangerSolidBg: "#b91c1c",
  dangerSolidText: "#ffffff",
  dangerBg: "rgba(248, 113, 113, 0.16)",
  dangerBorder: "rgba(248, 113, 113, 0.36)",
  dangerText: "#FCA5A5",
  inputBg: "#0f172a",
  muted: "#94a3b8",
  primaryBg: "#22c55e",
  primaryDisabledBg: "#334155",
  primaryText: "#052e16",
  secondaryBg: "#1e293b",
  secondaryText: "#94a3b8",
  successBg: "#14532d",
  successText: "#bbf7d0",
  text: "#f8fafc",
  warningText: "#f59e0b",
} as ThemeColors;

const selectedClass = {
  id: "class-1",
  name: "Turma 07-09",
  organizationId: "org-1",
  unit: "Rede Esportes Pinhais",
  unitId: "unit-1",
  colorKey: "green",
  modality: "volleyball",
  ageBand: "07-09",
  gender: "mixed",
  startTime: "09:00",
  endTime: "10:00",
  durationMinutes: 60,
  daysOfWeek: [6],
  daysPerWeek: 1,
  goal: "rendimento",
  equipment: "quadra",
  level: 1,
  mvLevel: "base",
  cycleStartDate: "2026-01-01",
  cycleLengthWeeks: 52,
  acwrLow: 0.8,
  acwrHigh: 1.3,
  createdAt: "2026-01-01T00:00:00.000Z",
} as ClassGroup;

const activeCycle = {
  id: "cycle-1",
  classId: "class-1",
  year: 2026,
  title: "Jan-Dez 2026",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} as PlanningCycle;

const defaultProps = {
  colors,
  normalizeText: (value: string) => value,
  formatShortDate: () => "13 de jun.",
  nextSessionDate: new Date("2026-06-13T12:00:00.000Z"),
  classStartTimeLabel: "09:00",
  hasInitialClass: true,
  showClassPicker: false,
  classTriggerRef: React.createRef<View>(),
  hasUnitSelected: true,
  togglePicker: jest.fn(),
  setClassPickerTop: jest.fn(),
  selectedClass,
  showUnitPicker: false,
  unitTriggerRef: React.createRef<View>(),
  setUnitPickerTop: jest.fn(),
  selectedUnit: "Rede Esportes Pinhais",
  mesoTriggerRef: React.createRef<View>(),
  showMesoPicker: false,
  cycleLength: 52,
  microTriggerRef: React.createRef<View>(),
  showMicroPicker: false,
  sessionsPerWeek: 1,
  painAlert: null,
  painAlertDates: [],
  isOrgAdmin: true,
  router: { push: jest.fn() },
  classPlans: [],
  hasWeekPlans: false,
  isSavingPlans: false,
  activeCycle: null,
  historyCycles: [],
  onCompleteMissingCoverage: jest.fn(),
  onGenerateCycle: jest.fn(),
  onRemoveCycle: jest.fn(),
  unitMismatchWarning: "",
  recentSessionSummaries: [],
  onReviewEvolution: jest.fn(),
};

const collectText = (node: TestRenderer.ReactTestInstance): string => {
  const flattenText = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (!Array.isArray(value)) return "";
    return value.map(flattenText).join("");
  };

  const ownText = node.type === Text ? flattenText(node.props.children) : "";
  const childText = node
    .findAllByType(Text)
    .map((textNode) => flattenText(textNode.props.children))
    .join("");

  return `${ownText}${childText}`;
};

const findNodeByText = (root: TestRenderer.ReactTestInstance, text: string) =>
  root.findAll((node) => collectText(node).includes(text))[0];

describe("OverviewTab", () => {
  it("hides the large generation action when a cycle already exists", () => {
    const onGenerateCycle = jest.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        React.createElement(OverviewTab, {
          ...defaultProps,
          activeCycle,
          hasWeekPlans: true,
          classPlans: [{ weekNumber: 1 } as any],
          onGenerateCycle,
        })
      );
    });

    const root = renderer!.root;
    const disabledGenerateButtons = root.findAll(
      (node) => node.props.disabled === true && collectText(node).includes("Ciclo já gerado")
    );
    const regenerateIcon = root.findByProps({ accessibilityLabel: "Gerar ciclo novamente" });

    expect(disabledGenerateButtons).toHaveLength(0);
    expect(regenerateIcon.props.disabled).toBe(false);
    expect(findNodeByText(root, "Gerado")).toBeTruthy();
    expect(findNodeByText(root, "Para gerar novamente")).toBeTruthy();
    expect(findNodeByText(root, "Remover ciclo")).toBeTruthy();

    act(() => {
      regenerateIcon.props.onPress();
    });

    expect(onGenerateCycle).toHaveBeenCalledTimes(1);
  });

  it("keeps the main generate button enabled when there is no generated cycle", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(React.createElement(OverviewTab, defaultProps));
    });

    const enabledGenerateButton = renderer!.root.findAll(
      (node) => node.props.disabled === false && collectText(node).includes("Gerar ciclo")
    )[0];

    expect(findNodeByText(renderer!.root, "Gerar ciclo")).toBeTruthy();
    expect(enabledGenerateButton).toBeTruthy();
  });

  it("shows the planned versus completed intelligence view for Rede Esperança 8-11", () => {
    const onReviewEvolution = jest.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        React.createElement(OverviewTab, {
          ...defaultProps,
          selectedClass: {
            ...selectedClass,
            name: "Turma 8-11",
            unit: "Rede Esperança",
            ageBand: "08-11",
            gender: "mixed",
            daysOfWeek: [2, 4],
          },
          recentSessionSummaries: [],
          onReviewEvolution,
        })
      );
    });

    const root = renderer!.root;
    expect(findNodeByText(root, "Julho 2026")).toBeTruthy();
    expect(findNodeByText(root, "Recepção direta sem segurar a bola")).toBeTruthy();
    expect(findNodeByText(root, "Portão de prontidão")).toBeTruthy();
    expect(findNodeByText(root, "A IA está aprendendo com a sua turma")).toBeTruthy();

    const reviewButton = root.findByProps({ accessibilityLabel: "Revisar evolução da turma" });
    act(() => reviewButton.props.onPress());
    expect(onReviewEvolution).toHaveBeenCalledTimes(1);
  });
});
