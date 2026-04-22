import type {
    WeekSessionRole,
    WeeklyOperationalClosingType,
    WeeklyOperationalDecision,
    WeeklyOperationalQuarter,
    WeeklyOperationalStrategySnapshot,
} from "../../../core/models";
import { buildPedagogicalQuarterlyMatrix } from "../../../core/pedagogy/pedagogical-quarterly-matrix";
import type { AgeBandKey, NextPedagogicalStep } from "../../../core/pedagogy/pedagogical-types";

export type WeeklyOperationalStrategy = {
  decisions: WeeklyOperationalDecision[];
  sessionRoleSummary: string;
  weekIntentSummary: string;
  quarterFocus: string;
  weekRulesApplied: string[];
  // Backward-compatible alias while callers migrate to weekRulesApplied.
  operationalRulesApplied: string[];
  diagnostics: {
    quarter: WeeklyOperationalQuarter;
    closingType: WeeklyOperationalClosingType;
    driftRisks: string[];
  };
};

type ResolveWeekStrategyParams = {
  ageBand: AgeBandKey | null;
  monthIndex: number;
  weeklySessions: number;
  weeklyVolume: "baixo" | "médio" | "alto";
  historicalConfidence: number;
  recentTeacherOverrides: string[];
  nextPedagogicalStep: NextPedagogicalStep | null;
};

const roleLabel = (value: WeekSessionRole): string => {
  switch (value) {
    case "introducao_exploracao":
      return "introdução e exploração";
    case "retomada_consolidacao":
      return "retomada e consolidação";
    case "consolidacao_orientada":
      return "consolidação orientada";
    case "pressao_decisao":
      return "pressão e tomada de decisão";
    case "transferencia_jogo":
      return "transferência para jogo";
    case "sintese_fechamento":
      return "síntese e fechamento";
    default:
      return "consolidação orientada";
  }
};

const buildBaseRoles = (weeklySessions: number): WeekSessionRole[] => {
  const sessions = Number.isFinite(weeklySessions) ? Math.max(1, Math.min(6, weeklySessions)) : 1;
  if (sessions === 1) return ["consolidacao_orientada"];
  if (sessions === 2) return ["introducao_exploracao", "transferencia_jogo"];

  const roles: WeekSessionRole[] = ["introducao_exploracao"];
  for (let index = 2; index < sessions; index += 1) {
    roles.push("consolidacao_orientada");
  }
  roles.push("transferencia_jogo");
  return roles;
};

const resolveQuarter = (monthIndex: number): WeeklyOperationalQuarter => {
  if (monthIndex >= 10) return "Q4";
  if (monthIndex >= 7) return "Q3";
  if (monthIndex >= 4) return "Q2";
  return "Q1";
};

const quarterMomentLabel = (quarter: WeeklyOperationalQuarter) => {
  if (quarter === "Q1") return "início do ciclo";
  if (quarter === "Q2") return "fase de desenvolvimento";
  if (quarter === "Q3") return "fase de aplicação";
  if (quarter === "Q4") return "fechamento do ciclo";
  return "momento em definição";
};

const closingTypeLabel = (closingType: WeeklyOperationalClosingType) => {
  if (closingType === "exploracao") return "exploração guiada";
  if (closingType === "consolidacao") return "consolidação de base";
  if (closingType === "aplicacao") return "aplicação em jogo";
  if (closingType === "fechamento") return "síntese e fechamento";
  return "fechamento em definição";
};

const hasReviewSignal = (signals: string[]) => {
  const merged = signals.join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /(revis|retom|consolid|base|manter simples)/.test(merged);
};

const resolveReviewSignalScore = (signals: string[]) => {
  const merged = signals
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (!merged.trim()) return 0;

  let score = 0;
  if (/(revis|retom|consolid|base)/.test(merged)) score += 0.35;
  if (/(manter simples|segur|reduzir|passo a passo)/.test(merged)) score += 0.25;
  if (/(intervencao docente|ajustar progressao)/.test(merged)) score += 0.2;
  return Math.min(score, 1);
};

const createSessionRuleMap = (size: number) =>
  Array.from({ length: size }, () => new Set<string>(["weekly_role_template"]));

const addRuleToSessions = (
  sessionRuleMap: Array<Set<string>>,
  sessionIndexes: number[],
  rule: string
) => {
  for (const index of sessionIndexes) {
    if (index >= 0 && index < sessionRuleMap.length) {
      sessionRuleMap[index].add(rule);
    }
  }
};

const toSnapshot = (strategy: WeeklyOperationalStrategy): WeeklyOperationalStrategySnapshot => ({
  decisions: strategy.decisions,
  quarterFocus: strategy.quarterFocus,
  sessionRoleSummary: strategy.sessionRoleSummary,
  weekIntentSummary: strategy.weekIntentSummary,
  weekRulesApplied: strategy.weekRulesApplied,
  diagnostics: strategy.diagnostics,
});

export const toWeeklyOperationalStrategySnapshot = toSnapshot;

export const resolveWeekStrategyFromCycleContext = (
  params: ResolveWeekStrategyParams
): WeeklyOperationalStrategy => {
  const sessionRoles = buildBaseRoles(params.weeklySessions);
  const weekRulesApplied = ["weekly_role_template"];
  const sessionRuleMap = createSessionRuleMap(sessionRoles.length);
  const quarter = resolveQuarter(params.monthIndex);
  let closingType: WeeklyOperationalClosingType = "unknown";
  let quarterFocus = params.nextPedagogicalStep?.selectionReason ?? "Progressão orientada pela etapa pedagógica";
  let driftRisks: string[] = [];

  if (params.ageBand) {
    const quarterly = buildPedagogicalQuarterlyMatrix(params.ageBand).find((row) => row.monthIndex === params.monthIndex);
    if (quarterly) {
      closingType = quarterly.closingType;
      quarterFocus = quarterly.pedagogicalFocus;
      driftRisks = [...quarterly.driftRisks];
      weekRulesApplied.push("quarterly_anchor_alignment");
      addRuleToSessions(
        sessionRuleMap,
        sessionRoles.map((_, index) => index),
        "quarterly_anchor_alignment"
      );
    }
  }

  const reviewSignalScore = resolveReviewSignalScore(params.recentTeacherOverrides);
  const reviewLock =
    params.historicalConfidence <= 0.45 ||
    (params.historicalConfidence < 0.65 && reviewSignalScore >= 0.35) ||
    reviewSignalScore >= 0.6 ||
    (params.historicalConfidence < 0.55 && hasReviewSignal(params.recentTeacherOverrides));
  if (reviewLock) {
    sessionRoles[0] = "retomada_consolidacao";
    const lastIndex = sessionRoles.length - 1;
    const affected = [0];
    if (lastIndex >= 1 && sessionRoles[lastIndex] === "transferencia_jogo") {
      sessionRoles[lastIndex] = "consolidacao_orientada";
      affected.push(lastIndex);
    }
    weekRulesApplied.push("recent_history_review_lock");
    addRuleToSessions(sessionRuleMap, affected, "recent_history_review_lock");
  }

  if (!reviewLock && params.weeklyVolume === "alto" && sessionRoles.length >= 3) {
    sessionRoles[1] = "pressao_decisao";
    weekRulesApplied.push("load_contrast_preserved");
    addRuleToSessions(sessionRuleMap, [1], "load_contrast_preserved");
  }

  if (closingType === "fechamento") {
    const lastIndex = sessionRoles.length - 1;
    sessionRoles[lastIndex] = "sintese_fechamento";
    weekRulesApplied.push("quarterly_closing_alignment");
    addRuleToSessions(sessionRuleMap, [lastIndex], "quarterly_closing_alignment");
  }

  const sessionRoleSummary = sessionRoles
    .map((role, index) => `S${index + 1}: ${roleLabel(role)}`)
    .join(" | ");
  const decisions: WeeklyOperationalDecision[] = sessionRoles.map((sessionRole, index) => ({
    sessionIndexInWeek: index + 1,
    sessionRole,
    quarterFocus,
    appliedRules: [...sessionRuleMap[index]],
    driftRisks: [...driftRisks],
    quarter,
    closingType,
  }));
  const weekIntentSummary = `Momento do ciclo: ${quarterMomentLabel(quarter)}. Foco da semana: ${quarterFocus}. Fechamento esperado: ${closingTypeLabel(closingType)}. Papel das sessões: ${sessionRoleSummary}.`;

  return {
    decisions,
    sessionRoleSummary,
    weekIntentSummary,
    quarterFocus,
    weekRulesApplied,
    operationalRulesApplied: weekRulesApplied,
    diagnostics: {
      quarter,
      closingType,
      driftRisks,
    },
  };
};
