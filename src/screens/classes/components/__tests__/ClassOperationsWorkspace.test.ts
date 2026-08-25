import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";

import { COPILOT_FAB_SIZE, COPILOT_FAB_STACK_GAP, resolveCopilotCompanionFabBottom, resolveCopilotFabBottom } from "../../../../copilot/components/CopilotFab";
import { buildClassAttendanceWorkspaceHref, parseClassWorkspaceRouteDate, resolveClassWorkspaceRouteSection } from "../../class-workspace-route";
import { ClassOperationsWorkspace, resolveDenseClassWorkspace } from "../ClassOperationsWorkspace";
import { ClassAttendanceWorkspacePanel, resolveStackedAttendancePanel } from "../ClassAttendanceWorkspacePanel";
import { isTodayLessonDateLabel } from "../ClassLessonDateNavigator";

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual<typeof import("react-native")>("react-native").View,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("../../../../ui/icon-registry", () => {
  const ReactModule = jest.requireActual<typeof React>("react");
  const { Text } = jest.requireActual<typeof import("react-native")>("react-native");

  return {
    GoAtletaIcon: ({ name, ...props }: { name: string }) => ReactModule.createElement(Text, props, name),
  };
});

jest.mock("../../../../ui/ModalSheet", () => {
  const ReactModule = jest.requireActual<typeof React>("react");

  return {
    ModalSheet: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => (visible ? ReactModule.createElement(ReactModule.Fragment, null, children) : null),
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
  dangerBg: "#4A2530",
  dangerText: "#FFB4BC",
  dangerBorder: "#7F1D1D",
} as any;

function renderWorkspace(compact: boolean, appliedPlan: any = null, overrides: Record<string, unknown> = {}) {
  const onOpenPlanning = jest.fn();
  const onOpenLessonCalendar = jest.fn();
  const onGeneratePlan = jest.fn();
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
      onGeneratePlan,
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
      ...overrides,
    }),
  );

  return { screen, onGeneratePlan, onOpenPlanning, onOpenLessonCalendar };
}

describe("ClassOperationsWorkspace responsive navigation", () => {
  it("uses the dense workspace only when the permanent rail has limited room", () => {
    expect(resolveDenseClassWorkspace(1159, false)).toBe(true);
    expect(resolveDenseClassWorkspace(1160, false)).toBe(false);
    expect(resolveDenseClassWorkspace(800, true)).toBe(false);
  });

  it("anchors the compact trigger directly above the copilot", () => {
    const copilotBottom = resolveCopilotFabBottom(0);

    expect(resolveCopilotCompanionFabBottom(0)).toBe(copilotBottom + COPILOT_FAB_SIZE + COPILOT_FAB_STACK_GAP);
  });

  it("stacks attendance only when the compact panel is actually narrow", () => {
    expect(resolveStackedAttendancePanel(359, true)).toBe(true);
    expect(resolveStackedAttendancePanel(360, true)).toBe(false);
    expect(resolveStackedAttendancePanel(620, true)).toBe(false);
    expect(resolveStackedAttendancePanel(320, false)).toBe(false);
    expect(resolveStackedAttendancePanel(0, true)).toBe(false);
  });

  it("identifies today's lesson date without changing the selected date", () => {
    const today = new Date(2026, 7, 24, 12);

    expect(isTodayLessonDateLabel("24/08/2026", today)).toBe(true);
    expect(isTodayLessonDateLabel("19/08/2026", today)).toBe(false);
  });

  it("builds the Home attendance deep link for the embedded class workspace", () => {
    expect(buildClassAttendanceWorkspaceHref("class-1", "2026-08-24")).toEqual({
      pathname: "/class/[id]",
      params: {
        id: "class-1",
        date: "2026-08-24",
        section: "attendance",
      },
    });
    expect(resolveClassWorkspaceRouteSection("attendance")).toBe("attendance");
    expect(resolveClassWorkspaceRouteSection("nfc")).toBe("attendance");
    expect(parseClassWorkspaceRouteDate("2026-08-24")).toEqual(new Date(2026, 7, 24));
  });

  it("keeps NFC out of the class navigation", () => {
    const { screen } = renderWorkspace(false);

    expect(screen.queryByLabelText("Chamada NFC")).toBeNull();
  });

  it("keeps student rows inside the embedded attendance list without legacy navigation", () => {
    const onOpenReport = jest.fn();
    const onSetDetails = jest.fn();
    const screen = render(
      React.createElement(ClassAttendanceWorkspacePanel, {
        colors,
        compact: false,
        mobile: false,
        dense: false,
        dateLabel: "27/08/2026",
        students: [
          { id: "student-1", name: "Alexsandra Pinheiro", photoUrl: null },
          { id: "student-2", name: "Ana Caroline", photoUrl: null },
        ],
        statusById: { "student-1": "presente" },
        detailsById: { "student-1": { note: "", painScore: 0 } },
        markedCount: 1,
        hasChanges: false,
        isLoading: false,
        isSaving: false,
        error: null,
        onPrevious: jest.fn(),
        onNext: jest.fn(),
        onOpenCalendar: jest.fn(),
        onOpenReport,
        onSetStatus: jest.fn(),
        onSetDetails,
        onSave: jest.fn(),
      }),
    );

    expect(screen.getByText("Alexsandra Pinheiro")).toBeTruthy();
    expect(screen.getByText("Alexsandra Pinheiro")).toHaveStyle({ flex: 0 });
    expect(screen.getByText("Ana Caroline")).toBeTruthy();
    expect(screen.queryByLabelText("Abrir detalhes de Alexsandra Pinheiro")).toBeNull();

    fireEvent.press(screen.getByLabelText("Abrir relatório"));
    expect(onOpenReport).toHaveBeenCalledTimes(1);
  });

  it("keeps one mobile save action beside the report action", () => {
    const onOpenReport = jest.fn();
    const onSave = jest.fn();
    const screen = render(
      React.createElement(ClassAttendanceWorkspacePanel, {
        colors,
        compact: true,
        mobile: true,
        dense: false,
        dateLabel: "27/08/2026",
        students: [{ id: "student-1", name: "Alexsandra Pinheiro", photoUrl: null }],
        statusById: { "student-1": "presente" },
        detailsById: { "student-1": { note: "", painScore: 0 } },
        markedCount: 1,
        hasChanges: true,
        isLoading: false,
        isSaving: false,
        error: null,
        onPrevious: jest.fn(),
        onNext: jest.fn(),
        onOpenCalendar: jest.fn(),
        onOpenReport,
        onSetStatus: jest.fn(),
        onSetDetails: jest.fn(),
        onSave,
      }),
    );

    expect(screen.getAllByLabelText("Salvar chamada")).toHaveLength(1);
    expect(screen.getByText("Salvar chamada")).toBeTruthy();
    expect(screen.queryByText("save")).toBeNull();
    expect(screen.queryByLabelText("Alterações da chamada pendentes")).toBeNull();
    fireEvent.press(screen.getByLabelText("Abrir relatório"));
    fireEvent.press(screen.getByLabelText("Salvar chamada"));

    expect(onOpenReport).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("uses the overview date navigator proportions in embedded attendance", () => {
    const screen = render(
      React.createElement(ClassAttendanceWorkspacePanel, {
        colors,
        compact: true,
        mobile: false,
        dense: true,
        dateLabel: "27/08/2026",
        students: [],
        statusById: {},
        detailsById: {},
        markedCount: 0,
        hasChanges: false,
        isLoading: false,
        isSaving: false,
        error: null,
        onPrevious: jest.fn(),
        onNext: jest.fn(),
        onOpenCalendar: jest.fn(),
        onOpenReport: jest.fn(),
        onSetStatus: jest.fn(),
        onSetDetails: jest.fn(),
        onSave: jest.fn(),
      }),
    );

    expect(screen.getByTestId("attendance-date-navigator")).toHaveStyle({
      width: "100%",
      minHeight: 68,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 10,
    });
    expect(screen.getByLabelText("Aula anterior")).toHaveStyle({ width: 36, height: 36, borderRadius: 18 });
    expect(screen.getByLabelText("Próxima aula")).toHaveStyle({ width: 36, height: 36, borderRadius: 18 });
    expect(screen.queryByLabelText("Chamada sincronizada")).toBeNull();
  });

  it("edits pain and notes without leaving the embedded attendance", () => {
    const onSetDetails = jest.fn();
    const screen = render(
      React.createElement(ClassAttendanceWorkspacePanel, {
        colors,
        compact: true,
        mobile: true,
        dense: false,
        dateLabel: "27/08/2026",
        students: [{ id: "student-1", name: "Alexsandra Pinheiro", photoUrl: null }],
        statusById: { "student-1": "presente" },
        detailsById: { "student-1": { note: "", painScore: 0 } },
        markedCount: 1,
        hasChanges: false,
        isLoading: false,
        isSaving: false,
        error: null,
        onPrevious: jest.fn(),
        onNext: jest.fn(),
        onOpenCalendar: jest.fn(),
        onOpenReport: jest.fn(),
        onSetStatus: jest.fn(),
        onSetDetails,
        onSave: jest.fn(),
      }),
    );

    fireEvent.press(screen.getByLabelText("Abrir dor e observações de Alexsandra Pinheiro"));
    expect(screen.getByText("Dor agora")).toBeTruthy();
    expect(screen.queryByText("Dor (0-3)")).toBeNull();
    expect(screen.getByLabelText("Dor: Sem dor")).toBeTruthy();
    expect(screen.getByLabelText("Dor: Leve")).toBeTruthy();
    expect(screen.getByLabelText("Dor: Moderada")).toBeTruthy();
    expect(screen.getByLabelText("Dor: Intensa")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Dor: Moderada"));
    fireEvent.changeText(screen.getByPlaceholderText("Observação (opcional)"), "Dor no ombro");
    fireEvent.press(screen.getByText("Concluir"));

    expect(onSetDetails).toHaveBeenCalledWith("student-1", {
      note: "Dor no ombro",
      painScore: 2,
    });
  });

  it("starts the selected student's NFC binding from the attendance modal", () => {
    const student = { id: "student-1", name: "Alexsandra Pinheiro", photoUrl: null };
    const onBindStudentNfc = jest.fn();
    const screen = render(
      React.createElement(ClassAttendanceWorkspacePanel, {
        colors,
        compact: true,
        mobile: true,
        dense: false,
        dateLabel: "27/08/2026",
        students: [student],
        statusById: { "student-1": "presente" },
        detailsById: { "student-1": { note: "", painScore: 0 } },
        markedCount: 1,
        hasChanges: false,
        isLoading: false,
        isSaving: false,
        error: null,
        onPrevious: jest.fn(),
        onNext: jest.fn(),
        onOpenCalendar: jest.fn(),
        onOpenReport: jest.fn(),
        onSetStatus: jest.fn(),
        onSetDetails: jest.fn(),
        onSave: jest.fn(),
        onBindStudentNfc,
      }),
    );

    fireEvent.press(screen.getByLabelText("Abrir dor e observações de Alexsandra Pinheiro"));
    fireEvent.press(screen.getByLabelText("Cadastrar tag NFC de Alexsandra Pinheiro"));

    expect(onBindStudentNfc).toHaveBeenCalledWith(student);
  });

  it("falls back to student initials when the photo cannot be displayed", () => {
    const screen = render(
      React.createElement(ClassAttendanceWorkspacePanel, {
        colors,
        compact: true,
        mobile: false,
        dense: true,
        dateLabel: "27/08/2026",
        students: [{ id: "student-1", name: "Alyce dos Santos da Silva", photoUrl: "https://example.com/alyce.jpg" }],
        statusById: {},
        detailsById: {},
        markedCount: 0,
        hasChanges: false,
        isLoading: false,
        isSaving: false,
        error: null,
        onPrevious: jest.fn(),
        onNext: jest.fn(),
        onOpenCalendar: jest.fn(),
        onOpenReport: jest.fn(),
        onSetStatus: jest.fn(),
        onSetDetails: jest.fn(),
        onSave: jest.fn(),
      }),
    );

    fireEvent(screen.getByLabelText("Foto de Alyce dos Santos da Silva"), "error");

    expect(screen.getByText("AD")).toBeTruthy();
  });

  it("opens the standard student photo preview from the avatar", () => {
    const screen = render(
      React.createElement(ClassAttendanceWorkspacePanel, {
        colors,
        compact: true,
        mobile: false,
        dense: true,
        dateLabel: "27/08/2026",
        students: [{ id: "student-1", name: "Alyce dos Santos da Silva", photoUrl: "https://example.com/alyce.jpg" }],
        statusById: {},
        detailsById: {},
        markedCount: 0,
        hasChanges: false,
        isLoading: false,
        isSaving: false,
        error: null,
        onPrevious: jest.fn(),
        onNext: jest.fn(),
        onOpenCalendar: jest.fn(),
        onOpenReport: jest.fn(),
        onSetStatus: jest.fn(),
        onSetDetails: jest.fn(),
        onSave: jest.fn(),
      }),
    );

    fireEvent.press(screen.getByLabelText("Ampliar foto de Alyce dos Santos da Silva"));

    expect(screen.getByText("Foto de Alyce dos Santos da Silva")).toBeTruthy();
    expect(screen.getByLabelText("Fechar foto")).toBeTruthy();
  });

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

  it("keeps the compact navigation trigger available in the mobile layout", () => {
    const { screen } = renderWorkspace(true);

    expect(screen.getByLabelText("Abrir menu da turma")).toBeTruthy();
  });

  it("keeps the permanent rail on the desktop layout", () => {
    const { screen } = renderWorkspace(false);

    expect(screen.queryByLabelText("Abrir menu da turma")).toBeNull();
    expect(screen.getByLabelText("Chamada")).toBeTruthy();
    expect(screen.queryByLabelText("Chamada NFC")).toBeNull();
    expect(screen.getByLabelText("Relatório")).toBeTruthy();
    expect(screen.queryByLabelText("Periodização da turma")).toBeNull();
  });

  it("switches to the embedded attendance section without leaving the class workspace", () => {
    const onSelectSection = jest.fn();
    const firstRender = renderWorkspace(false, null, { onSelectSection });

    fireEvent.press(firstRender.screen.getByLabelText("Chamada"));

    expect(onSelectSection).toHaveBeenCalledWith("attendance");
    firstRender.screen.unmount();

    const attendanceRender = renderWorkspace(false, null, {
      activeSection: "attendance",
      attendanceContent: React.createElement(Text, null, "Chamada incorporada"),
      onSelectSection,
    });

    expect(attendanceRender.screen.getByText("Chamada incorporada")).toBeTruthy();
    expect(attendanceRender.screen.queryByText("Plano da aula")).toBeNull();
  });

  it("opens the lesson calendar from the centered date", () => {
    const { screen, onOpenLessonCalendar } = renderWorkspace(false);

    fireEvent.press(screen.getByLabelText("Selecionar data da aula"));

    expect(onOpenLessonCalendar).toHaveBeenCalledTimes(1);
  });

  it("starts the document-first plan flow from an empty lesson", () => {
    const { screen, onGeneratePlan } = renderWorkspace(false);

    expect(screen.queryByText("Aplicar treino")).toBeNull();
    expect(screen.queryByText("Gerar plano automático")).toBeNull();
    fireEvent.press(screen.getByLabelText("Montar plano"));

    expect(onGeneratePlan).toHaveBeenCalledTimes(1);
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
