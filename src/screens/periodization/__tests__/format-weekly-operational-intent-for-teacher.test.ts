import type { WeeklyOperationalStrategySnapshot } from "../../../core/models";
import {
    formatWeeklyOperationalIntentForTeacher,
    parseWeeklyOperationalStrategySnapshot,
} from "../application/format-weekly-operational-intent-for-teacher";

const snapshot: WeeklyOperationalStrategySnapshot = {
  decisions: [
    {
      sessionIndexInWeek: 1,
      sessionRole: "retomada_consolidacao",
      quarterFocus: "Consolidar continuidade com colega e leitura simples.",
      appliedRules: ["weekly_role_template", "recent_history_review_lock"],
      driftRisks: ["complexidade_alta_precoce_08_10"],
      quarter: "Q2",
      closingType: "consolidacao",
    },
    {
      sessionIndexInWeek: 2,
      sessionRole: "consolidacao_orientada",
      quarterFocus: "Consolidar continuidade com colega e leitura simples.",
      appliedRules: ["weekly_role_template", "recent_history_review_lock"],
      driftRisks: ["complexidade_alta_precoce_08_10"],
      quarter: "Q2",
      closingType: "consolidacao",
    },
  ],
  quarterFocus: "Consolidar continuidade com colega e leitura simples.",
  sessionRoleSummary: "S1: retomada e consolidacao | S2: consolidacao orientada",
  weekIntentSummary: "Foco da semana: consolidacao guiada com progressao leve.",
  weekRulesApplied: ["weekly_role_template", "recent_history_review_lock"],
  diagnostics: {
    quarter: "Q2",
    closingType: "consolidacao",
    driftRisks: ["complexidade_alta_precoce_08_10"],
  },
};

describe("formatWeeklyOperationalIntentForTeacher", () => {
  it("builds teacher-facing intent without exposing internal rule names", () => {
    const result = formatWeeklyOperationalIntentForTeacher(snapshot);

    expect(result).toBeTruthy();
    expect(result?.title ?? "").toContain("consolidacao");
    expect(result?.summary ?? "").toContain("Momento do ciclo:");
    expect(result?.summary ?? "").toContain("Fechamento da semana:");
    expect(result?.summary ?? "").toContain("Distribuicao da semana");
    expect((result?.teacherNotes ?? []).length).toBeGreaterThan(0);
    expect((result?.summary ?? "") + (result?.teacherNotes ?? []).join(" ")).not.toContain(
      "recent_history_review_lock"
    );
  });

  it("uses explicit closing title when week is in fechamento mode", () => {
    const fechamentoSnapshot: WeeklyOperationalStrategySnapshot = {
      ...snapshot,
      diagnostics: {
        ...snapshot.diagnostics,
        quarter: "Q4",
        closingType: "fechamento",
      },
    };

    const result = formatWeeklyOperationalIntentForTeacher(fechamentoSnapshot);

    expect(result?.title).toBe("Semana de fechamento trimestral com síntese aplicada");
    expect(result?.summary ?? "").toContain("fechamento do ciclo");
  });

  it("parses typed weekly snapshot from generation context", () => {
    const parsed = parseWeeklyOperationalStrategySnapshot(
      JSON.stringify({ weeklyOperationalStrategy: snapshot })
    );

    expect(parsed).toBeTruthy();
    expect(parsed?.decisions[0]?.sessionRole).toBe("retomada_consolidacao");
    expect(parsed?.weekRulesApplied).toContain("weekly_role_template");
  });
});
