import { Animated } from "react-native";
import { WeekTab } from "../WeekTab";

const collectText = (node: unknown): string[] => {
  if (node == null) return [];
  if (typeof node === "string" || typeof node === "number") {
    return [String(node)];
  }
  if (Array.isArray(node)) {
    return node.flatMap((item) => collectText(item));
  }
  if (typeof node === "object") {
    const maybeNode = node as { props?: { children?: unknown } };
    return collectText(maybeNode.props?.children);
  }
  return [];
};

const buildBaseProps = () => ({
  colors: {
    text: "#111111",
    muted: "#666666",
    border: "#dddddd",
    secondaryBg: "#f2f2f2",
    card: "#ffffff",
    infoBg: "#eef5ff",
    warningBg: "#fff6e5",
    warningText: "#7a4b00",
  } as any,
  weekSchedule: [
    { label: "Seg", dayNumber: 1, session: "Passe · Precisao", date: "2026-04-20" },
    { label: "Qua", dayNumber: 3, session: "Jogo reduzido", date: "2026-04-22" },
  ],
  activeWeek: {
    week: 3,
    title: "Base",
    focus: "Continuidade",
    volume: "médio",
    notes: [],
    jumpTarget: "baixo",
    PSETarget: "PSE 5",
    plannedSessionLoad: 360,
    plannedWeeklyLoad: 720,
    source: "AUTO" as const,
  },
  weeklyObservabilitySummary: {
    quarterFocus: "Aplicacao coletiva em contexto reduzido",
    quarter: "Q3" as const,
    closingType: "aplicacao" as const,
    weekRulesApplied: ["quarterly_anchor_alignment"],
    driftRisks: [],
    sessionRoleSummary: "S1: introducao_exploracao | S2: transferencia_jogo",
    sessionSummaries: [
      { sessionIndexInWeek: 1, sessionRole: "introducao_exploracao" as const },
      { sessionIndexInWeek: 2, sessionRole: "transferencia_jogo" as const },
    ],
    coherence: [
      {
        sessionIndexInWeek: 1,
        sessionRole: "introducao_exploracao" as const,
        envelopeRespected: true,
      },
      {
        sessionIndexInWeek: 2,
        sessionRole: "transferencia_jogo" as const,
        envelopeRespected: true,
      },
    ],
    driftSignals: [],
    sessionDebug: [
      {
        sessionIndex: 1,
        sessionRole: "introducao_exploracao" as const,
        finalStrategy: null,
        rulesApplied: ["quarterly_anchor_alignment"],
        envelopeRespected: true,
      },
    ],
  },
  qaModeEnabled: false,
  showQaModeToggle: false,
  onToggleQaMode: jest.fn(),
  showQaDebugPanel: false,
  onToggleQaDebugPanel: jest.fn(),
  classObservabilityTrend: null,
  classObservabilityDriftFrequency: [],
  classRecentUnstableWeeks: [],
  classObservabilityInsights: [],
  onGoToWeek: jest.fn(),
  weekPlans: [
    {
      week: 1,
      title: "Base",
      focus: "Fundamentos",
      volume: "baixo",
      notes: [],
      jumpTarget: "baixo",
      PSETarget: "PSE 4",
      plannedSessionLoad: 300,
      plannedWeeklyLoad: 600,
      source: "AUTO" as const,
    },
    {
      week: 3,
      title: "Base",
      focus: "Continuidade",
      volume: "médio",
      notes: [],
      jumpTarget: "baixo",
      PSETarget: "PSE 5",
      plannedSessionLoad: 360,
      plannedWeeklyLoad: 720,
      source: "AUTO" as const,
    },
  ],
  weekSwitchOpacity: new Animated.Value(1),
  weekSwitchTranslateX: new Animated.Value(0),
  goToPreviousAgendaWeek: jest.fn(),
  goToNextAgendaWeek: jest.fn(),
  handleSelectDay: jest.fn(),
  formatWeekSessionLabel: (value: string) => value,
  hasWeekPlans: true,
  competitiveAgendaCard: null,
});

describe("WeekTab render", () => {
  it("renders teacher intent title, summary and notes when intent exists", () => {
    const element = WeekTab({
      ...buildBaseProps(),
      weeklyTeacherIntent: {
        title: "Semana de consolidacao com progressao leve",
        summary:
          "A semana comeca guiada e termina com aplicacao em jogo reduzido com foco em continuidade.",
        teacherNotes: [
          "Manter orientacoes curtas.",
          "Evitar aumentar a complexidade cedo demais.",
        ],
      },
    });

    const text = collectText(element).join(" ");

    expect(text).toContain("Semana de consolidacao com progressao leve");
    expect(text).toContain("A semana comeca guiada");
    expect(text).toContain("Manter orientacoes curtas.");
  });

  it("does not render internal rule labels in teacher-facing card", () => {
    const element = WeekTab({
      ...buildBaseProps(),
      weeklyTeacherIntent: {
        title: "Semana de consolidacao guiada",
        summary: "A semana organiza uma progressao clara entre as sessoes.",
        teacherNotes: ["Valorizar continuidade e organizacao com o colega."],
      },
    });

    const text = collectText(element).join(" ");

    expect(text).not.toContain("quarterly_closing_alignment");
    expect(text).not.toContain("recent_history_review_lock");
    expect(text).not.toContain("load_contrast_preserved");
  });

  it("does not crash and omits intent card when weekly intent is null", () => {
    const element = WeekTab({
      ...buildBaseProps(),
      weeklyTeacherIntent: null,
    });

    const text = collectText(element).join(" ");

    expect(text).toContain("Semana 3 de 2");
    expect(text).not.toContain("Semana de consolidacao");
    expect(text).not.toContain("QA SUMMARY");
  });

  it("shows qa summary only when qa mode is enabled", () => {
    const element = WeekTab({
      ...buildBaseProps(),
      showQaModeToggle: true,
      qaModeEnabled: true,
      weeklyTeacherIntent: {
        title: "Semana de consolidacao",
        summary: "Fluxo semanal com progressao.",
        teacherNotes: ["Manter orientacoes curtas."],
      },
    });

    const text = collectText(element).join(" ");

    expect(text).toContain("QA SUMMARY");
    expect(text).toContain("QA MODE: ON");
  });

  it("shows trend card when qa mode is on and trend has data", () => {
    const element = WeekTab({
      ...buildBaseProps(),
      qaModeEnabled: true,
      classObservabilityTrend: {
        totalWeeks: 8,
        coherentWeeks: 6,
        coherencePassRate: 0.75,
        averageCoherenceScore: 0.88,
        unstableWeeks: 2,
        highSeverityWeeks: 1,
      },
      classObservabilityDriftFrequency: [],
      classRecentUnstableWeeks: [],
    });

    const text = collectText(element).join(" ");

    expect(text).toContain("TENDÊNCIA DA TURMA");
    expect(text).toContain("8 semanas");
    expect(text).toContain("Instáveis: 2");
  });

  it("hides trend card when qa mode is off", () => {
    const element = WeekTab({
      ...buildBaseProps(),
      qaModeEnabled: false,
      classObservabilityTrend: {
        totalWeeks: 8,
        coherentWeeks: 6,
        coherencePassRate: 0.75,
        averageCoherenceScore: 0.88,
        unstableWeeks: 2,
        highSeverityWeeks: 1,
      },
    });

    const text = collectText(element).join(" ");

    expect(text).not.toContain("TENDÊNCIA DA TURMA");
  });

  it("shows drift frequency card with detected codes only", () => {
    const element = WeekTab({
      ...buildBaseProps(),
      qaModeEnabled: true,
      classObservabilityTrend: null,
      classObservabilityDriftFrequency: [
        { code: "load_flattening", total: 3, low: 1, medium: 2, high: 0 },
        { code: "repetition_excess", total: 1, low: 1, medium: 0, high: 0 },
        { code: "weekly_session_misalignment", total: 0, low: 0, medium: 0, high: 0 },
        { code: "quarter_week_misalignment", total: 0, low: 0, medium: 0, high: 0 },
        { code: "progression_stagnation", total: 0, low: 0, medium: 0, high: 0 },
      ],
      classRecentUnstableWeeks: [],
    });

    const text = collectText(element).join(" ");

    expect(text).toContain("DRIFTS MAIS FREQUENTES");
    expect(text).toContain("load flattening");
    expect(text).toContain("3×");
    expect(text).not.toContain("weekly session misalignment");
  });

  it("shows unstable weeks card with link-to-week entries", () => {
    const element = WeekTab({
      ...buildBaseProps(),
      qaModeEnabled: true,
      classObservabilityTrend: null,
      classObservabilityDriftFrequency: [],
      classRecentUnstableWeeks: [
        {
          planId: "cp_test_1",
          classId: "c_1",
          cycleId: "cy_1",
          weekNumber: 5,
          coherenceScore: 0.5,
          driftSignals: [
            { detected: true, severity: "medium", reason: "load flat", code: "load_flattening" },
          ],
          capturedAt: "2026-04-15T10:00:00.000Z",
          computedAt: "2026-04-20T10:00:00.000Z",
        },
      ],
    });

    const text = collectText(element).join(" ");

    expect(text).toContain("SEMANAS INSTÁVEIS RECENTES");
    expect(text).toContain("Semana 5");
    expect(text).toContain("load flattening");
    expect(text).toContain("medium");
  });

  it("shows automatic insights card when insights are provided", () => {
    const element = WeekTab({
      ...buildBaseProps(),
      qaModeEnabled: true,
      classObservabilityInsights: [
        {
          code: "top_recurring_drift",
          severity: "warning",
          message: "O drift mais recorrente e repetition excess (3 ocorrencias).",
        },
      ],
    });

    const text = collectText(element).join(" ");

    expect(text).toContain("INSIGHTS AUTOMATICOS");
    expect(text).toContain("[WARNING]");
    expect(text).toContain("repetition excess");
  });
});
