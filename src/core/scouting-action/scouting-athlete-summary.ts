import type { ScoutingAction, ScoutingActionSkill } from "./types";

export type ScoutingAthleteSkillBreakdown = {
  skill: ScoutingActionSkill;
  total: number;
  averageScore: number;
  positiveActions: number;
  negativeActions: number;
};

export type ScoutingAthleteSummary = {
  athleteId?: string;
  athleteName: string;
  totalActions: number;
  averageScore: number;
  strongestSkill?: string;
  weakestSkill?: string;
  strengths: string[];
  attentionPoints: string[];
  skillBreakdown: ScoutingAthleteSkillBreakdown[];
};

const skillLabelMap: Record<ScoutingActionSkill, string> = {
  serve: "Saque",
  receive: "Recepção",
  set: "Levantamento",
  attack: "Ataque",
  block: "Bloqueio",
  defense: "Defesa",
  coverage: "Cobertura",
  transition: "Transição",
  communication: "Comunicação",
};

const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const roundOne = (value: number) => Math.round(value * 10) / 10;

const actionScore = (action: ScoutingAction) => action.score ?? 0;

function groupByAthlete(actions: ScoutingAction[]) {
  const groups = new Map<string, ScoutingAction[]>();
  for (const action of actions) {
    const normalizedName = action.athleteName?.trim() || "Equipe";
    const key = action.athleteId?.trim() || `name:${normalizedName.toLowerCase()}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(action);
    groups.set(key, bucket);
  }
  return Array.from(groups.values());
}

function buildSkillBreakdown(actions: ScoutingAction[]): ScoutingAthleteSkillBreakdown[] {
  const bySkill = new Map<ScoutingActionSkill, ScoutingAction[]>();
  for (const action of actions) {
    const bucket = bySkill.get(action.skill) ?? [];
    bucket.push(action);
    bySkill.set(action.skill, bucket);
  }

  return Array.from(bySkill.entries())
    .map(([skill, bucket]) => {
      const scores = bucket.map(actionScore);
      return {
        skill,
        total: bucket.length,
        averageScore: roundOne(average(scores)),
        positiveActions: bucket.filter((item) => actionScore(item) >= 2).length,
        negativeActions: bucket.filter((item) => actionScore(item) <= 1).length,
      };
    })
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return b.averageScore - a.averageScore;
    });
}

function getStrongestSkill(breakdown: ScoutingAthleteSkillBreakdown[]) {
  const eligible = breakdown.filter((item) => item.total >= 2);
  if (!eligible.length) return undefined;
  const best = [...eligible].sort((a, b) => {
    if (b.averageScore !== a.averageScore) return b.averageScore - a.averageScore;
    return b.positiveActions - a.positiveActions;
  })[0];
  return best?.averageScore >= 2 ? skillLabelMap[best.skill] : undefined;
}

function getWeakestSkill(breakdown: ScoutingAthleteSkillBreakdown[]) {
  const eligible = breakdown.filter((item) => item.total >= 2);
  if (!eligible.length) return undefined;
  const weakest = [...eligible].sort((a, b) => {
    if (a.averageScore !== b.averageScore) return a.averageScore - b.averageScore;
    return b.negativeActions - a.negativeActions;
  })[0];
  return weakest?.averageScore <= 1.5 || (weakest?.negativeActions ?? 0) >= 2
    ? skillLabelMap[weakest.skill]
    : undefined;
}

export function summarizeScoutingActionsByAthleteDetailed(
  actions: ScoutingAction[],
): ScoutingAthleteSummary[] {
  return groupByAthlete(actions)
    .map((bucket) => {
      const scores = bucket.map(actionScore);
      const skillBreakdown = buildSkillBreakdown(bucket);
      const strongestSkill = getStrongestSkill(skillBreakdown);
      const weakestSkill = getWeakestSkill(skillBreakdown);
      const lowVolume = bucket.length < 2;
      const strengths = lowVolume
        ? ["dados insuficientes"]
        : skillBreakdown
            .filter((item) => item.total >= 2 && item.averageScore >= 2.5)
            .map((item) => skillLabelMap[item.skill])
            .slice(0, 2);
      const attentionPoints = lowVolume
        ? ["dados insuficientes"]
        : skillBreakdown
            .filter((item) => item.total >= 2 && (item.averageScore <= 1.5 || item.negativeActions >= 2))
            .map((item) => skillLabelMap[item.skill])
            .slice(0, 2);

      return {
        athleteId: bucket[0]?.athleteId,
        athleteName: bucket[0]?.athleteName?.trim() || "Equipe",
        totalActions: bucket.length,
        averageScore: roundOne(average(scores)),
        strongestSkill,
        weakestSkill,
        strengths,
        attentionPoints,
        skillBreakdown,
      };
    })
    .sort((a, b) => {
      if (a.athleteName === "Equipe") return 1;
      if (b.athleteName === "Equipe") return -1;
      if (b.totalActions !== a.totalActions) return b.totalActions - a.totalActions;
      return b.averageScore - a.averageScore;
    });
}

export function getAthletesInFocus(actions: ScoutingAction[]) {
  return summarizeScoutingActionsByAthleteDetailed(actions)
    .filter((item) => item.athleteName !== "Equipe" && item.totalActions >= 2)
    .sort((a, b) => {
      if (b.averageScore !== a.averageScore) return b.averageScore - a.averageScore;
      return b.totalActions - a.totalActions;
    })
    .slice(0, 3);
}

export function getAthletesNeedingAttention(actions: ScoutingAction[]) {
  return summarizeScoutingActionsByAthleteDetailed(actions)
    .filter((item) => item.athleteName !== "Equipe" && item.totalActions >= 2)
    .filter((item) => Boolean(item.weakestSkill) || item.averageScore <= 1.5)
    .sort((a, b) => {
      if (a.averageScore !== b.averageScore) return a.averageScore - b.averageScore;
      return b.totalActions - a.totalActions;
    })
    .slice(0, 3);
}
