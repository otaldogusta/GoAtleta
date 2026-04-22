import type { NextPedagogicalStep } from "../../../core/pedagogy/pedagogical-types";
import { resolveWeekStrategyFromCycleContext } from "../application/resolve-week-strategy-from-cycle-context";

const nextPedagogicalStep: NextPedagogicalStep = {
  stageId: "08-10_apr_01",
  currentStage: "Consolidação de continuidade no mini 2x2",
  gameForm: "mini_2x2",
  complexityLevel: "baixo_moderado",
  nextStep: ["two_action_continuity"],
  pedagogicalConstraints: ["manter continuidade"],
  blockRecommendations: {
    warmup: {
      objective: "coordenação",
      taskStyle: "duplas",
      intensity: "low",
      contexts: ["cooperative_control"],
    },
    main: {
      objective: "continuidade",
      taskStyle: "jogo reduzido",
      intensity: "medium",
      contexts: ["application_game"],
    },
    cooldown: {
      objective: "síntese",
      taskStyle: "feedback guiado",
      intensity: "low",
      contexts: ["reflection"],
    },
  },
  selectionReason: "Histórico consistente e avanço controlado da etapa no trimestre.",
  originMonthIndex: 4,
  chosenBy: "catalog_with_history",
  alreadyIntroduced: ["ball_control_pairs"],
  alreadyPracticedContexts: ["cooperative_control"],
};

describe("resolveWeekStrategyFromCycleContext", () => {
  it("preserves intensive contrast in three-session weeks", () => {
    const result = resolveWeekStrategyFromCycleContext({
      ageBand: "08-10",
      monthIndex: 4,
      weeklySessions: 3,
      weeklyVolume: "alto",
      historicalConfidence: 0.9,
      recentTeacherOverrides: [],
      nextPedagogicalStep,
    });

    expect(result.decisions[1]?.sessionRole).toBe("pressao_decisao");
    expect(result.weekRulesApplied).toContain("load_contrast_preserved");
    expect(result.decisions[0]?.appliedRules).not.toContain("load_contrast_preserved");
    expect(result.decisions[1]?.appliedRules).toContain("load_contrast_preserved");
    expect(result.decisions[2]?.appliedRules).not.toContain("load_contrast_preserved");
  });

  it("holds transfer when review signals indicate consolidation", () => {
    const result = resolveWeekStrategyFromCycleContext({
      ageBand: "08-10",
      monthIndex: 4,
      weeklySessions: 2,
      weeklyVolume: "médio",
      historicalConfidence: 0.5,
      recentTeacherOverrides: ["revisar e consolidar fundamentos da turma"],
      nextPedagogicalStep,
    });

    expect(result.decisions[0]?.sessionRole).toBe("retomada_consolidacao");
    expect(result.decisions[1]?.sessionRole).toBe("consolidacao_orientada");
    expect(result.weekRulesApplied).toContain("recent_history_review_lock");
    expect(result.decisions[0]?.appliedRules).toContain("recent_history_review_lock");
    expect(result.decisions[1]?.appliedRules).toContain("recent_history_review_lock");
  });

  it("changes weekly behavior when quarter changes under the same context", () => {
    const q1 = resolveWeekStrategyFromCycleContext({
      ageBand: "08-10",
      monthIndex: 1,
      weeklySessions: 2,
      weeklyVolume: "médio",
      historicalConfidence: 0.85,
      recentTeacherOverrides: [],
      nextPedagogicalStep,
    });
    const q4 = resolveWeekStrategyFromCycleContext({
      ageBand: "08-10",
      monthIndex: 12,
      weeklySessions: 2,
      weeklyVolume: "médio",
      historicalConfidence: 0.85,
      recentTeacherOverrides: [],
      nextPedagogicalStep,
    });

    expect(q1.decisions[1]?.sessionRole).toBe("transferencia_jogo");
    expect(q4.decisions[1]?.sessionRole).toBe("sintese_fechamento");
    expect(q4.weekRulesApplied).toContain("quarterly_closing_alignment");
    expect(q4.decisions[0]?.appliedRules).not.toContain("quarterly_closing_alignment");
    expect(q4.decisions[1]?.appliedRules).toContain("quarterly_closing_alignment");
    expect(q1.weekIntentSummary).toContain("Momento do ciclo:");
    expect(q1.weekIntentSummary).toContain("Fechamento esperado:");
    expect(q4.weekIntentSummary).toContain("fechamento do ciclo");
  });
});
