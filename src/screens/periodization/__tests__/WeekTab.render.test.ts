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
    successBg: "#e8fff3",
    successText: "#0a6b3f",
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
  weeklyTeacherIntent: null,
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
    authority: {
      checks: [
        {
          sessionIndexInWeek: 1,
          sessionRole: "introducao_exploracao" as const,
          isWithinEnvelope: true,
          violations: [],
        },
      ],
      passRate: 1,
      hasViolations: false,
      totalChecks: 1,
      totalViolations: 0,
    },
    stability: {
      severity: "low" as const,
      status: "stable" as const,
      reasons: [],
    },
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
  classRankedRecommendations: [],
  classObservabilityRecommendationStates: [],
  classRecommendationEvidence: [],
  classRecommendationAggregates: [],
  classRecommendationProblemFamilySummary: {
    dominantFamily: null,
    dominantFamilyLabel: null,
    cohorts: [],
  },
  classRecommendationProblemAxisSummary: null,
  classRecommendationProblemFamilyTimeline: [],
  classRecommendationAxisTransitionSummary: null,
  classRecommendationAxisPersistenceSummary: null,
  classRecommendationQADigest: null,
  classRecommendationWindowComparison: null,
  classRecommendationAxisAlignment: null,
  onAcceptRecommendation: jest.fn(),
  onRejectRecommendation: jest.fn(),
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
    expect(text).toContain("ESTABILIDADE DA SEMANA");
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
        attentionWeeks: 3,
        authorityViolationWeeks: 2,
      },
      classObservabilityDriftFrequency: [],
      classRecentUnstableWeeks: [],
    });

    const text = collectText(element).join(" ");

    expect(text).toContain("TENDÊNCIA DA TURMA");
    expect(text).toContain("8 semanas");
    expect(text).toContain("Instáveis: 2");
    expect(text).toContain("Atenção: 3");
    expect(text).toContain("violacao de autoridade: 2");
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
        attentionWeeks: 3,
        authorityViolationWeeks: 2,
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
          scope: "class_history",
          message: "O drift mais recorrente e repetition excess (3 ocorrencias).",
          evidence: {
            count: 3,
            dominantCode: "repetition_excess",
          },
        },
      ],
    });

    const text = collectText(element).join(" ");

    expect(text).toContain("INSIGHTS AUTOMATICOS");
    expect(text).toContain("[WARNING]");
    expect(text).toContain("[CLASS_HISTORY]");
    expect(text).toContain("repetition excess");
  });

  it("does not show insights card when qa mode is off", () => {
    const element = WeekTab({
      ...buildBaseProps(),
      qaModeEnabled: false,
      classObservabilityInsights: [
        {
          code: "authority_break_recurrence",
          severity: "critical",
          scope: "authority",
          message: "A autoridade semanal esta sendo quebrada repetidamente nas ultimas semanas.",
          evidence: {
            count: 3,
            weeksConsidered: 4,
          },
        },
      ],
    });

    const text = collectText(element).join(" ");

    expect(text).not.toContain("INSIGHTS AUTOMATICOS");
  });

  it("shows internal recommendations only in QA mode", () => {
    const element = WeekTab({
      ...buildBaseProps(),
      qaModeEnabled: true,
      classObservabilityRecommendationStates: [
        {
          recommendation: {
            code: "restore_weekly_role_alignment",
            priority: "high",
            action: "review_current_week",
            title: "Restaurar alinhamento entre semana e sessao",
            message: "Uma ou mais sessoes estao escapando repetidamente do papel semanal esperado.",
            rationale: "A autoridade semanal foi quebrada em multiplas semanas recentes.",
            sourceSignals: ["authority_break_recurrence", "weekly_authority_violation"],
          },
          decisionStatus: "pending",
          decision: null,
        },
      ],
    });

    const text = collectText(element).join(" ");

    expect(text).toContain("RECOMENDACOES INTERNAS");
    expect(text).toContain("[HIGH] Restaurar alinhamento entre semana e sessao");
    expect(text).toContain("STATUS: PENDENTE");
    expect(text).toContain("ACEITAR");
    expect(text).toContain("REJEITAR");
  });

  it("does not show recommendations when qa mode is off", () => {
    const element = WeekTab({
      ...buildBaseProps(),
      qaModeEnabled: false,
      classObservabilityRecommendationStates: [
        {
          recommendation: {
            code: "reduce_repetition_with_controlled_variation",
            priority: "medium",
            action: "adjust_next_week",
            title: "Reduzir repeticao com variacao controlada",
            message: "A turma esta repetindo padroes demais sem ganho claro de progressao.",
            rationale: "O drift mais recorrente atual esta ligado ao excesso de repeticao.",
            sourceSignals: ["top_recurring_drift", "repetition_excess"],
          },
          decisionStatus: "pending",
          decision: null,
        },
      ],
    });

    const text = collectText(element).join(" ");

    expect(text).not.toContain("RECOMENDACOES INTERNAS");
  });

  it("shows accepted recommendation status and reason", () => {
    const element = WeekTab({
      ...buildBaseProps(),
      qaModeEnabled: true,
      classObservabilityRecommendationStates: [
        {
          recommendation: {
            code: "reduce_repetition_with_controlled_variation",
            priority: "medium",
            action: "adjust_next_week",
            title: "Reduzir repeticao com variacao controlada",
            message: "A turma esta repetindo padroes demais sem ganho claro de progressao.",
            rationale: "O drift mais recorrente atual esta ligado ao excesso de repeticao.",
            sourceSignals: ["top_recurring_drift", "repetition_excess"],
          },
          decisionStatus: "accepted",
          decision: {
            id: "decision-1",
            classId: "class-1",
            cycleId: "cycle-1",
            planId: "plan-1",
            weekNumber: 3,
            recommendationCode: "reduce_repetition_with_controlled_variation",
            status: "accepted",
            priority: "medium",
            title: "Reduzir repeticao com variacao controlada",
            message: "A turma esta repetindo padroes demais sem ganho claro de progressao.",
            rationale: "O drift mais recorrente atual esta ligado ao excesso de repeticao.",
            sourceSignals: ["top_recurring_drift", "repetition_excess"],
            reasonType: "teacher_judgment",
            reasonNote: "Aplicar no microciclo seguinte.",
            createdAt: "2026-05-01T10:00:00.000Z",
            updatedAt: "2026-05-01T10:00:00.000Z",
          },
        },
      ],
      classRecommendationEvidence: [
        {
          recommendationCode: "reduce_repetition_with_controlled_variation",
          decisionStatus: "accepted",
          baselineWeekNumber: 3,
          comparedWeeks: [4, 5],
          outcome: "improved",
          rationale: "As semanas seguintes mostraram melhora observacional apos a decisao.",
          delta: {
            coherenceScore: 0.15,
            unstableWeeks: -1,
            authorityViolationWeeks: -1,
          },
        },
      ],
    });

    const text = collectText(element).join(" ");

    expect(text).toContain("STATUS: ACEITA");
    expect(text).toContain("motivo=teacher_judgment");
    expect(text).toContain("nota=Aplicar no microciclo seguinte.");
    expect(text).toContain("evidencia=improved");
    expect(text).not.toContain("ACEITAR");
  });

  it("shows rejected recommendation status", () => {
    const element = WeekTab({
      ...buildBaseProps(),
      qaModeEnabled: true,
      classObservabilityRecommendationStates: [
        {
          recommendation: {
            code: "restore_weekly_role_alignment",
            priority: "high",
            action: "review_current_week",
            title: "Restaurar alinhamento entre semana e sessao",
            message: "Uma ou mais sessoes estao escapando repetidamente do papel semanal esperado.",
            rationale: "A autoridade semanal foi quebrada em multiplas semanas recentes.",
            sourceSignals: ["authority_break_recurrence"],
          },
          decisionStatus: "rejected",
          decision: {
            id: "decision-2",
            classId: "class-1",
            cycleId: "cycle-1",
            planId: "plan-1",
            weekNumber: 3,
            recommendationCode: "restore_weekly_role_alignment",
            status: "rejected",
            priority: "high",
            title: "Restaurar alinhamento entre semana e sessao",
            message: "Uma ou mais sessoes estao escapando repetidamente do papel semanal esperado.",
            rationale: "A autoridade semanal foi quebrada em multiplas semanas recentes.",
            sourceSignals: ["authority_break_recurrence"],
            reasonType: "not_relevant",
            reasonNote: null,
            createdAt: "2026-05-01T10:00:00.000Z",
            updatedAt: "2026-05-01T10:00:00.000Z",
          },
        },
      ],
      classRecommendationEvidence: [
        {
          recommendationCode: "restore_weekly_role_alignment",
          decisionStatus: "rejected",
          baselineWeekNumber: 3,
          comparedWeeks: [4, 5],
          outcome: "worsened",
          rationale: "As semanas seguintes mostraram piora observacional apos a decisao.",
          delta: {
            coherenceScore: -0.2,
            unstableWeeks: 1,
            authorityViolationWeeks: 1,
          },
        },
      ],
    });

    const text = collectText(element).join(" ");

    expect(text).toContain("STATUS: REJEITADA");
    expect(text).toContain("motivo=not_relevant");
    expect(text).toContain("evidencia=worsened");
    expect(text).not.toContain("REJEITAR");
  });

  it("shows recommendation family aggregates and confidence in QA mode", () => {
    const element = WeekTab({
      ...buildBaseProps(),
      qaModeEnabled: true,
      classRecommendationAggregates: [
        {
          recommendationCode: "restore_weekly_role_alignment",
          totalSuggested: 4,
          totalAccepted: 3,
          totalRejected: 1,
          improvedCount: 2,
          unchangedCount: 1,
          worsenedCount: 0,
          insufficientEvidenceCount: 1,
          confidence: "high",
        },
      ],
      classRecommendationProblemFamilySummary: {
        dominantFamily: "weekly_alignment",
        dominantFamilyLabel: "Alinhamento semanal",
        cohorts: [
          {
            family: "weekly_alignment",
            familyLabel: "Alinhamento semanal",
            familyHelperText: "Problemas entre papel da semana e execucao das sessoes.",
            recommendationsCount: 2,
            highPriorityCount: 1,
            cautiousCount: 1,
          },
        ],
      },
      classRecommendationProblemAxisSummary: {
        dominantFamily: "weekly_alignment",
        dominantLabel: "Alinhamento semanal",
        secondaryFamily: "quarter_closing",
        secondaryLabel: "Fechamento trimestral",
        tension: "reinforcing",
        summary:
          "O eixo dominante atual e Alinhamento semanal, reforcado por Fechamento trimestral.",
      },
      classRecommendationProblemFamilyTimeline: [
        {
          weekNumber: 12,
          dominantFamily: "weekly_alignment",
          dominantLabel: "Alinhamento semanal",
        },
        {
          weekNumber: 13,
          dominantFamily: "weekly_alignment",
          dominantLabel: "Alinhamento semanal",
        },
        {
          weekNumber: 14,
          dominantFamily: "quarter_closing",
          dominantLabel: "Fechamento trimestral",
        },
      ],
      classRecommendationAxisTransitionSummary: {
        transitionType: "axis_shift",
        currentFamily: "quarter_closing",
        currentLabel: "Fechamento trimestral",
        previousFamily: "weekly_alignment",
        previousLabel: "Alinhamento semanal",
        summary:
          "O eixo dominante mudou recentemente de Alinhamento semanal para Fechamento trimestral.",
      },
    });

    const text = collectText(element).join(" ");

    expect(text).toContain("HISTORICO DE RECOMMENDATIONS");
    expect(text).toContain("restore_weekly_role_alignment");
    expect(text).toContain("sugestoes=4");
    expect(text).toContain("confianca=high");
    expect(text).toContain("LINHA DO TEMPO DOS EIXOS");
    expect(text).toContain("S12 · Alinhamento semanal");
    expect(text).toContain("TRANSICAO DE EIXO");
    expect(text).toContain("Tipo: axis_shift");
    expect(text).toContain("RESUMO POR EIXO");
    expect(text).toContain("Dominante: Alinhamento semanal");
    expect(text).toContain("Secundario: Fechamento trimestral");
    expect(text).toContain("Tensao: reinforcing");
    expect(text).toContain("EIXOS DE PROBLEMA (FAMILIAS)");
    expect(text).toContain("Dominante: Alinhamento semanal");
    expect(text).toContain("Alinhamento semanal · recs=2");
  });

  it("hides axis timeline and transition when qa mode is off", () => {
    const element = WeekTab({
      ...buildBaseProps(),
      qaModeEnabled: false,
      classRecommendationProblemFamilyTimeline: [
        {
          weekNumber: 12,
          dominantFamily: "weekly_alignment",
          dominantLabel: "Alinhamento semanal",
        },
      ],
      classRecommendationAxisTransitionSummary: {
        transitionType: "stable_axis",
        currentFamily: "weekly_alignment",
        currentLabel: "Alinhamento semanal",
        previousFamily: "weekly_alignment",
        previousLabel: "Alinhamento semanal",
        summary: "O eixo dominante permaneceu em Alinhamento semanal nas semanas recentes.",
      },
    });

    const text = collectText(element).join(" ");

    expect(text).not.toContain("LINHA DO TEMPO DOS EIXOS");
    expect(text).not.toContain("TRANSICAO DE EIXO");
  });

  it("shows confidence-modulated ranking badges on recommendation cards", () => {
    const element = WeekTab({
      ...buildBaseProps(),
      qaModeEnabled: true,
      classRankedRecommendations: [
        {
          recommendation: {
            code: "restore_weekly_role_alignment",
            priority: "high",
            action: "review_current_week",
            title: "Restaurar alinhamento entre semana e sessao",
            message: "Uma ou mais sessoes estao escapando repetidamente do papel semanal esperado.",
            rationale: "A autoridade semanal foi quebrada em multiplas semanas recentes.",
            sourceSignals: ["authority_break_recurrence"],
          },
          confidence: "low",
          framing: "history_inconclusive",
          framingMessage: "Historico ainda inconclusivo para esta recommendation nesta turma.",
          presentation: {
            tone: "neutral",
            shortLabel: "Historico inconclusivo",
            helperText:
              "Ainda nao ha evidencia suficiente para afirmar efeito consistente nesta turma.",
          },
          familyPresentation: {
            family: "weekly_alignment",
            familyLabel: "Alinhamento semanal",
            familyHelperText: "Problemas entre papel da semana e execucao das sessoes.",
          },
          rankingScore: 30,
          rankingReason: "held_by_low_confidence",
        },
      ],
      classObservabilityRecommendationStates: [
        {
          recommendation: {
            code: "restore_weekly_role_alignment",
            priority: "high",
            action: "review_current_week",
            title: "Restaurar alinhamento entre semana e sessao",
            message: "Uma ou mais sessoes estao escapando repetidamente do papel semanal esperado.",
            rationale: "A autoridade semanal foi quebrada em multiplas semanas recentes.",
            sourceSignals: ["authority_break_recurrence"],
          },
          decisionStatus: "pending",
          decision: null,
        },
      ],
    });

    const text = collectText(element).join(" ");

    expect(text).toContain("confianca=low · historico=history_inconclusive");
    expect(text).toContain("Familia: Alinhamento semanal");
    expect(text).toContain("Problemas entre papel da semana e execucao das sessoes.");
    expect(text).toContain("Historico inconclusivo");
    expect(text).toContain(
      "Ainda nao ha evidencia suficiente para afirmar efeito consistente nesta turma."
    );
    expect(text).toContain("Historico ainda inconclusivo para esta recommendation nesta turma.");
    expect(text).toContain("ranking=held_by_low_confidence · score=30");
  });

  it("keeps recommendation visible even when history is unfavorable", () => {
    const element = WeekTab({
      ...buildBaseProps(),
      qaModeEnabled: true,
      classRankedRecommendations: [
        {
          recommendation: {
            code: "rebalance_load_progression",
            priority: "medium",
            action: "adjust_next_week",
            title: "Rebalancear carga",
            message: "Ajustar progressao.",
            rationale: "Carga achatada.",
            sourceSignals: ["top_recurring_drift"],
          },
          confidence: "high",
          framing: "history_unfavorable",
          framingMessage:
            "Historico observacional desfavoravel: esta recommendation ainda nao mostrou melhora consistente nesta turma.",
          presentation: {
            tone: "cautious",
            shortLabel: "Historico desfavoravel",
            helperText:
              "Aplicar com cautela: ainda nao houve melhora consistente nesta turma.",
          },
          familyPresentation: {
            family: "load_progression",
            familyLabel: "Progressao de carga",
            familyHelperText: "Ha sinais de carga achatada ou contraste insuficiente.",
          },
          rankingScore: 25,
          rankingReason: "boosted_by_high_confidence",
        },
      ],
      classObservabilityRecommendationStates: [
        {
          recommendation: {
            code: "rebalance_load_progression",
            priority: "medium",
            action: "adjust_next_week",
            title: "Rebalancear carga",
            message: "Ajustar progressao.",
            rationale: "Carga achatada.",
            sourceSignals: ["top_recurring_drift"],
          },
          decisionStatus: "pending",
          decision: null,
        },
      ],
    });

    const text = collectText(element).join(" ");

    expect(text).toContain("[MEDIUM] Rebalancear carga");
    expect(text).toContain("historico=history_unfavorable");
    expect(text).toContain("Familia: Progressao de carga");
    expect(text).toContain("Ha sinais de carga achatada ou contraste insuficiente.");
    expect(text).toContain("Historico desfavoravel");
    expect(text).toContain("Aplicar com cautela: ainda nao houve melhora consistente nesta turma.");
  });

  it("shows PERSISTENCIA DE EIXO block with warning when qa mode is on", () => {
    const element = WeekTab({
      ...buildBaseProps(),
      qaModeEnabled: true,
      classRecommendationAxisPersistenceSummary: {
        persistenceType: "unstable_rotation",
        earlyWarning: "warning",
        dominantFamily: "weekly_alignment",
        dominantLabel: "Alinhamento semanal",
        weeksAnalyzed: 5,
        summary: "A turma apresenta rotacao instavel de eixos nas ultimas 5 semanas.",
      },
    });

    const text = collectText(element).join(" ");

    expect(text).toContain("PERSISTENCIA DE EIXO");
    expect(text).toContain("Tipo: unstable_rotation");
    expect(text).toContain("Alerta: warning");
    expect(text).toContain("rotacao instavel de eixos");
  });

  it("hides PERSISTENCIA DE EIXO block when qa mode is off", () => {
    const element = WeekTab({
      ...buildBaseProps(),
      qaModeEnabled: false,
      classRecommendationAxisPersistenceSummary: {
        persistenceType: "stable_persistence",
        earlyWarning: "none",
        dominantFamily: "weekly_alignment",
        dominantLabel: "Alinhamento semanal",
        weeksAnalyzed: 4,
        summary: "O eixo Alinhamento semanal manteve dominancia consistente nas ultimas 4 semanas.",
      },
    });

    const text = collectText(element).join(" ");

    expect(text).not.toContain("PERSISTENCIA DE EIXO");
  });

  it("shows DIGEST QA DA TURMA block when qa mode is on", () => {
    const element = WeekTab({
      ...buildBaseProps(),
      qaModeEnabled: true,
      classRecommendationQADigest: {
        dominantAxisLabel: "Alinhamento semanal",
        secondaryAxisLabel: "Fechamento trimestral",
        tension: "reinforcing",
        persistenceType: "mixed_persistence",
        earlyWarning: "attention",
        recommendationFocus: "Restaurar alinhamento",
        summary: "- eixo dominante: Alinhamento semanal\n- tensao: reinforcing com Fechamento trimestral\n- persistencia: mixed_persistence\n- alerta: attention\n- recommendation focus: Restaurar alinhamento",
      },
    });

    const text = collectText(element).join(" ");

    expect(text).toContain("DIGEST QA DA TURMA");
    expect(text).toContain("eixo dominante: Alinhamento semanal");
    expect(text).toContain("persistencia: mixed_persistence");
    expect(text).toContain("alerta: attention");
  });

  it("hides DIGEST QA DA TURMA when qa mode is off", () => {
    const element = WeekTab({
      ...buildBaseProps(),
      qaModeEnabled: false,
      classRecommendationQADigest: {
        dominantAxisLabel: "Alinhamento semanal",
        secondaryAxisLabel: null,
        tension: null,
        persistenceType: "stable_persistence",
        earlyWarning: "none",
        recommendationFocus: null,
        summary: "- eixo dominante: Alinhamento semanal",
      },
    });

    const text = collectText(element).join(" ");

    expect(text).not.toContain("DIGEST QA DA TURMA");
  });

  it("shows JANELA CURTA vs MEDIA block when qa mode is on", () => {
    const element = WeekTab({
      ...buildBaseProps(),
      qaModeEnabled: true,
      classRecommendationWindowComparison: {
        shortWindow: { windowSize: 3, dominantFamily: "load_progression", dominantLabel: "Progressao de carga", distinctFamilies: 1, persistenceType: "stable_persistence" },
        mediumWindow: { windowSize: 7, dominantFamily: "weekly_alignment", dominantLabel: "Alinhamento semanal", distinctFamilies: 2, persistenceType: "mixed_persistence" },
        divergence: "different_axis",
        interpretation: "acute",
        summary: "O problema recente (Progressao de carga) diverge do eixo medio (Alinhamento semanal), sugerindo oscilacao aguda.",
      },
    });

    const text = collectText(element).join(" ");

    expect(text).toContain("JANELA CURTA vs MEDIA");
    expect(text).toContain("Curta (3s): Progressao de carga");
    expect(text).toContain("Media (7s): Alinhamento semanal");
    expect(text).toContain("Divergencia: different_axis");
    expect(text).toContain("oscilacao aguda");
  });

  it("shows ALINHAMENTO EIXO x RECOMMENDATION block when qa mode is on", () => {
    const element = WeekTab({
      ...buildBaseProps(),
      qaModeEnabled: true,
      classRecommendationAxisAlignment: {
        alignmentType: "divergent",
        axisFamily: "weekly_alignment",
        axisLabel: "Alinhamento semanal",
        recommendationFocusFamily: "game_transfer",
        recommendationFocusLabel: "Transferencia para jogo",
        summary: "Recommendation focus (Transferencia para jogo) diverge do eixo dominante (Alinhamento semanal). Verificar coerencia.",
      },
    });

    const text = collectText(element).join(" ");

    expect(text).toContain("ALINHAMENTO EIXO x RECOMMENDATION");
    expect(text).toContain("Tipo: divergent");
    expect(text).toContain("Verificar coerencia.");
  });

  it("hides window comparison and axis alignment when qa mode is off", () => {
    const element = WeekTab({
      ...buildBaseProps(),
      qaModeEnabled: false,
      classRecommendationWindowComparison: {
        shortWindow: { windowSize: 3, dominantFamily: "weekly_alignment", dominantLabel: "Alinhamento semanal", distinctFamilies: 1, persistenceType: "stable_persistence" },
        mediumWindow: { windowSize: 7, dominantFamily: "weekly_alignment", dominantLabel: "Alinhamento semanal", distinctFamilies: 1, persistenceType: "stable_persistence" },
        divergence: "same_axis",
        interpretation: "structural",
        summary: "padrao estrutural.",
      },
      classRecommendationAxisAlignment: {
        alignmentType: "convergent",
        axisFamily: "weekly_alignment",
        axisLabel: "Alinhamento semanal",
        recommendationFocusFamily: "weekly_alignment",
        recommendationFocusLabel: "Alinhamento semanal",
        summary: "Convergente.",
      },
    });

    const text = collectText(element).join(" ");

    expect(text).not.toContain("JANELA CURTA vs MEDIA");
    expect(text).not.toContain("ALINHAMENTO EIXO x RECOMMENDATION");
  });

  it("shows session role and closing cues in week schedule cards", () => {
    const element = WeekTab({
      ...buildBaseProps(),
      weekSchedule: [
        {
          label: "Seg",
          dayNumber: 1,
          session: "Passe · Precisao",
          date: "2026-04-20",
          sessionRoleLabel: "Exploracao guiada",
          sessionClosingLabel: "Fechar com sintese curta e criterio de base.",
          functionalVariationLabel:
            "Variação anti-repetição aplicada em progressão.",
        },
      ],
    });

    const text = collectText(element).join(" ");

    expect(text).toContain("Exploracao guiada");
    expect(text).toContain("Passe · Precisao");
    expect(text).toContain("Fechar com sintese curta e criterio de base.");
    expect(text).toContain("Variação anti-repetição aplicada em progressão.");
  });
});
