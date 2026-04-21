import type {
    SessionStrategy,
    WeeklyOperationalStrategySnapshot,
} from "../../../core/models";
import type { PeriodizationWeekScheduleItem } from "../application/build-auto-plan-for-cycle-day";
import {
    buildWeeklyObservabilitySummary,
    detectPedagogicalDrift,
    validateWeeklySessionCoherence,
} from "../application/build-weekly-observability-summary";
import { formatWeeklyOperationalIntentForTeacher } from "../application/format-weekly-operational-intent-for-teacher";

const buildStrategy = (
  overrides: Partial<SessionStrategy> = {}
): SessionStrategy => ({
  primarySkill: "passe",
  secondarySkill: "levantamento",
  progressionDimension: "pressao_tempo",
  pedagogicalIntent: "pressure_adaptation",
  loadIntent: "moderado",
  drillFamilies: ["deslocamento", "cooperacao"],
  forbiddenDrillFamilies: [],
  oppositionLevel: "medium",
  timePressureLevel: "medium",
  gameTransferLevel: "medium",
  ...overrides,
});

const buildScheduleItem = (params: {
  sessionIndexInWeek: number;
  strategy: SessionStrategy;
  dayNumber: number;
}): PeriodizationWeekScheduleItem => ({
  label: `D${params.dayNumber}`,
  dayNumber: params.dayNumber,
  date: `2026-05-0${params.sessionIndexInWeek}`,
  session: `S${params.sessionIndexInWeek}`,
  summary: "Resumo",
  sessionIndexInWeek: params.sessionIndexInWeek,
  autoPlan: {
    sessionDate: `2026-05-0${params.sessionIndexInWeek}`,
    sessionIndexInWeek: params.sessionIndexInWeek,
    historicalConfidence: "medium",
    historyMode: "partial_history",
    fingerprint: `fp-${params.sessionIndexInWeek}`,
    structuralFingerprint: `sfp-${params.sessionIndexInWeek}`,
    repetitionAdjustment: {
      detected: false,
      risk: "low",
      reason: null,
      changedFields: [],
    },
    strategy: params.strategy,
    sessionLabel: "Sessao",
    primarySkillLabel: "Passe",
    progressionLabel: "Pressao",
    pedagogicalIntentLabel: "Adaptacao",
    coachSummary: "Resumo coach",
    explanationSummary: "Resumo",
    drillFamiliesLabel: params.strategy.drillFamilies.join(", "),
  },
});

const snapshot: WeeklyOperationalStrategySnapshot = {
  decisions: [
    {
      sessionIndexInWeek: 1,
      sessionRole: "introducao_exploracao",
      quarterFocus: "Consolidar leitura coletiva antes da aplicacao.",
      appliedRules: ["weekly_role_template", "quarterly_anchor_alignment"],
      driftRisks: [],
      quarter: "Q3",
      closingType: "aplicacao",
    },
    {
      sessionIndexInWeek: 2,
      sessionRole: "pressao_decisao",
      quarterFocus: "Consolidar leitura coletiva antes da aplicacao.",
      appliedRules: ["weekly_role_template", "load_contrast_preserved"],
      driftRisks: [],
      quarter: "Q3",
      closingType: "aplicacao",
    },
    {
      sessionIndexInWeek: 3,
      sessionRole: "transferencia_jogo",
      quarterFocus: "Consolidar leitura coletiva antes da aplicacao.",
      appliedRules: ["weekly_role_template", "quarterly_anchor_alignment"],
      driftRisks: [],
      quarter: "Q3",
      closingType: "aplicacao",
    },
  ],
  quarterFocus: "Consolidar leitura coletiva antes da aplicacao.",
  sessionRoleSummary:
    "S1: introducao_exploracao | S2: pressao_decisao | S3: transferencia_jogo",
  weekIntentSummary: "Semana com progressao de exploracao para transferencia.",
  weekRulesApplied: ["weekly_role_template", "load_contrast_preserved"],
  diagnostics: {
    quarter: "Q3",
    closingType: "aplicacao",
    driftRisks: ["excesso_tecnico"],
  },
};

describe("weekly session observability", () => {
  it("builds observability summary from the real weekly snapshot shape", () => {
    const summary = buildWeeklyObservabilitySummary({
      weeklySnapshot: snapshot,
      weekSchedule: [
        buildScheduleItem({
          sessionIndexInWeek: 1,
          dayNumber: 2,
          strategy: buildStrategy({
            progressionDimension: "precisao",
            loadIntent: "baixo",
            oppositionLevel: "low",
            timePressureLevel: "low",
            gameTransferLevel: "low",
          }),
        }),
        buildScheduleItem({ sessionIndexInWeek: 2, dayNumber: 4, strategy: buildStrategy() }),
        buildScheduleItem({
          sessionIndexInWeek: 3,
          dayNumber: 6,
          strategy: buildStrategy({
            progressionDimension: "tomada_decisao",
            gameTransferLevel: "high",
            drillFamilies: ["jogo_condicionado", "cooperacao"],
          }),
        }),
      ],
    });

    expect(summary).toBeTruthy();
    expect(summary?.quarter).toBe("Q3");
    expect(summary?.weekRulesApplied).toContain("load_contrast_preserved");
    expect(summary?.sessionSummaries).toHaveLength(3);
  });

  it("marks coherent sessions as envelope respected", () => {
    const coherence = validateWeeklySessionCoherence({
      weeklySnapshot: snapshot,
      weekSchedule: [
        buildScheduleItem({
          sessionIndexInWeek: 1,
          dayNumber: 2,
          strategy: buildStrategy({
            progressionDimension: "precisao",
            loadIntent: "baixo",
            gameTransferLevel: "low",
            oppositionLevel: "low",
            timePressureLevel: "low",
          }),
        }),
        buildScheduleItem({ sessionIndexInWeek: 2, dayNumber: 4, strategy: buildStrategy() }),
        buildScheduleItem({
          sessionIndexInWeek: 3,
          dayNumber: 6,
          strategy: buildStrategy({ progressionDimension: "tomada_decisao" }),
        }),
      ],
    });

    expect(coherence.every((item) => item.envelopeRespected)).toBe(true);
  });

  it("detects misalignment without blocking summary generation", () => {
    const incoherentSchedule = [
      buildScheduleItem({
        sessionIndexInWeek: 1,
        dayNumber: 2,
        strategy: buildStrategy({
          progressionDimension: "transferencia_jogo",
          loadIntent: "alto",
        }),
      }),
      buildScheduleItem({ sessionIndexInWeek: 2, dayNumber: 4, strategy: buildStrategy() }),
      buildScheduleItem({ sessionIndexInWeek: 3, dayNumber: 6, strategy: buildStrategy() }),
    ];

    const summary = buildWeeklyObservabilitySummary({
      weeklySnapshot: snapshot,
      weekSchedule: incoherentSchedule,
    });

    expect(summary).toBeTruthy();
    expect(summary?.coherence.some((item) => !item.envelopeRespected)).toBe(true);
  });

  it("detects drift when contrast is flattened", () => {
    const coherentContrastFlattened = [
      buildScheduleItem({
        sessionIndexInWeek: 1,
        dayNumber: 2,
        strategy: buildStrategy({
          progressionDimension: "precisao",
          loadIntent: "baixo",
          gameTransferLevel: "low",
          oppositionLevel: "low",
          timePressureLevel: "low",
        }),
      }),
      buildScheduleItem({
        sessionIndexInWeek: 2,
        dayNumber: 4,
        strategy: buildStrategy({ loadIntent: "baixo" }),
      }),
      buildScheduleItem({
        sessionIndexInWeek: 3,
        dayNumber: 6,
        strategy: buildStrategy({
          progressionDimension: "tomada_decisao",
          loadIntent: "baixo",
        }),
      }),
    ];

    const coherence = validateWeeklySessionCoherence({
      weeklySnapshot: snapshot,
      weekSchedule: coherentContrastFlattened,
    });
    const drift = detectPedagogicalDrift({
      weeklySnapshot: snapshot,
      weekSchedule: coherentContrastFlattened,
      coherence,
    });

    expect(drift.some((signal) => signal.code === "load_flattening")).toBe(true);
  });

  it("exposes quarterly closing in summary and flags cosmetic closing drift", () => {
    const closingSnapshot: WeeklyOperationalStrategySnapshot = {
      ...snapshot,
      decisions: [
        {
          ...snapshot.decisions[0],
          sessionRole: "introducao_exploracao",
          sessionIndexInWeek: 1,
          closingType: "fechamento",
        },
        {
          ...snapshot.decisions[1],
          sessionRole: "consolidacao_orientada",
          sessionIndexInWeek: 2,
          closingType: "fechamento",
        },
      ],
      diagnostics: {
        quarter: "Q4",
        closingType: "fechamento",
        driftRisks: [],
      },
    };

    const summary = buildWeeklyObservabilitySummary({
      weeklySnapshot: closingSnapshot,
      weekSchedule: [
        buildScheduleItem({
          sessionIndexInWeek: 1,
          dayNumber: 2,
          strategy: buildStrategy({
            progressionDimension: "precisao",
            loadIntent: "baixo",
            gameTransferLevel: "low",
            oppositionLevel: "low",
            timePressureLevel: "low",
          }),
        }),
        buildScheduleItem({
          sessionIndexInWeek: 2,
          dayNumber: 4,
          strategy: buildStrategy({ progressionDimension: "precisao", gameTransferLevel: "low" }),
        }),
      ],
    });

    expect(summary?.closingType).toBe("fechamento");
    expect(summary?.driftSignals.some((signal) => signal.code === "quarter_week_misalignment")).toBe(
      true
    );
  });

  it("keeps teacher intent free from internal rule labels", () => {
    const teacherIntent = formatWeeklyOperationalIntentForTeacher(snapshot);
    const merged = `${teacherIntent?.summary ?? ""} ${(teacherIntent?.teacherNotes ?? []).join(" ")}`;

    expect(merged).not.toContain("load_contrast_preserved");
    expect(merged).not.toContain("quarterly_anchor_alignment");
  });
});
