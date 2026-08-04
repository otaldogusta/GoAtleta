import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import { ClassOperationsWorkspace } from "../ClassOperationsWorkspace";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("../../../../ui/icon-registry", () => {
  const ReactModule = jest.requireActual<typeof React>("react");
  const { Text } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    GoAtletaIcon: ({ name, ...props }: { name: string }) =>
      ReactModule.createElement(Text, props, name),
  };
});

jest.mock("../../../../ui/ModalSheet", () => {
  const ReactModule = jest.requireActual<typeof React>("react");

  return {
    ModalSheet: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
      visible ? ReactModule.createElement(ReactModule.Fragment, null, children) : null,
  };
});

const colors = {
  card: "#162033",
  border: "#334155",
  muted: "#8A9AB3",
  successBg: "#1E4D3B",
  successText: "#B8F5D1",
  primaryBg: "#3DDC84",
  primaryText: "#0A1322",
  text: "#F1F4F9",
  secondaryBg: "#0A1322",
} as any;

function renderWorkspace(compact: boolean, appliedPlan: any = null) {
  const onOpenPlanning = jest.fn();
  const onOpenLessonCalendar = jest.fn();
  const screen = render(
    React.createElement(ClassOperationsWorkspace, {
      colors,
      compact,
      scheduleLabel: "Qua e Sex · 18:00",
      lessonDateLabel: "31/07/2026",
      appliedPlan,
      isLoadingLessonPlan: false,
      onPreviousLesson: jest.fn(),
      onNextLesson: jest.fn(),
      onOpenLessonCalendar,
      onViewPlan: jest.fn(),
      onGeneratePlan: jest.fn(),
      isGeneratingPlan: false,
      studentCount: 24,
      contactStatusValue: "24 pendentes",
      contactStatusLabel: "contatos para atualizar",
      reportStatusValue: "Pendente",
      reportStatusLabel: "registre a última aula",
      onOpenSession: jest.fn(),
      onOpenAttendance: jest.fn(),
      onOpenReport: jest.fn(),
      onOpenPlanning,
      onOpenVisualTech: jest.fn(),
      onOpenScouting: jest.fn(),
      onOpenStudents: jest.fn(),
      onExportRoster: jest.fn(),
      onOpenWhatsApp: jest.fn(),
    })
  );

  return { screen, onOpenPlanning, onOpenLessonCalendar };
}

describe("ClassOperationsWorkspace responsive navigation", () => {
  it("opens the complete class navigation from the compact trigger", () => {
    const { screen, onOpenPlanning } = renderWorkspace(true);

    expect(screen.queryByLabelText("Chamada")).toBeNull();
    fireEvent.press(screen.getByLabelText("Abrir menu da turma"));

    expect(screen.queryByLabelText("Abrir menu da turma")).toBeNull();
    expect(screen.getByLabelText("Fechar menu da turma")).toBeTruthy();
    expect(screen.getByText("Hoje")).toBeTruthy();
    expect(screen.getByText("Planejamento")).toBeTruthy();
    expect(screen.getByText("Desempenho")).toBeTruthy();
    expect(screen.getByText("Gestão")).toBeTruthy();
    expect(screen.queryByLabelText("Periodização da turma")).toBeNull();

    fireEvent.press(screen.getByLabelText("Planejamentos da turma"));

    expect(onOpenPlanning).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Fechar menu da turma")).toBeNull();
  });

  it("keeps the permanent rail on the desktop layout", () => {
    const { screen } = renderWorkspace(false);

    expect(screen.queryByLabelText("Abrir menu da turma")).toBeNull();
    expect(screen.getByLabelText("Chamada")).toBeTruthy();
    expect(screen.getByLabelText("Relatório")).toBeTruthy();
    expect(screen.queryByLabelText("Periodização da turma")).toBeNull();
  });

  it("opens the lesson calendar from the centered date", () => {
    const { screen, onOpenLessonCalendar } = renderWorkspace(false);

    fireEvent.press(screen.getByLabelText("Selecionar data da aula"));

    expect(onOpenLessonCalendar).toHaveBeenCalledTimes(1);
  });

  it("opens the class planning from the applied plan actions", () => {
    const { screen, onOpenPlanning } = renderWorkspace(true, {
      title: "Capivaras · Passe",
      warmup: ["Caça aos 3 contatos"],
      warmupTime: 10,
      main: ["Passe em duplas para zona-alvo"],
      mainTime: 45,
      cooldown: ["Roda rápida de fechamento"],
      cooldownTime: 5,
    });

    fireEvent.press(screen.getByLabelText("Ver planejamento"));

    expect(onOpenPlanning).toHaveBeenCalledTimes(1);
  });
});
