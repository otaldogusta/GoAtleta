import type { ScoutingAction, ScoutingActionSkill } from "./types";

export type ScoutingActionsSummary = {
  totalActions: number;
  dominantStrengths: string[];
  dominantWeaknesses: string[];
};

export type ScoutingActionsByAthleteSummary = {
  athleteId?: string;
  athleteName: string;
  totalActions: number;
  averageScore: number;
  strengths: string[];
  weaknesses: string[];
};

export type ScoutingActionsBySkillSummary = {
  skill: ScoutingActionSkill;
  totalActions: number;
  averageScore: number;
  errorRate: number;
};

const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const skillLabelMap: Record<ScoutingActionSkill, string> = {
  serve: "Saque",
  receive: "Recepção",
  set: "Toque",
  attack: "Ataque",
  block: "Bloqueio",
  defense: "Defesa",
  coverage: "Cobertura",
  transition: "Transição",
  communication: "Comunicação",
};

export const summarizeScoutingActionsByAthlete = (
  actions: ScoutingAction[]
): ScoutingActionsByAthleteSummary[] => {
  const groups = new Map<string, ScoutingAction[]>();
  for (const action of actions) {
    const key = action.athleteId?.trim() || `name:${action.athleteName?.trim() || "Equipe"}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(action);
    groups.set(key, bucket);
  }
  return Array.from(groups.values())
    .map((bucket) => {
      const scores = bucket.map((item) => item.score ?? 0);
      const athleteName = bucket[0]?.athleteName?.trim() || "Equipe";
      const bySkill = summarizeScoutingActionsBySkill(bucket);
      return {
        athleteId: bucket[0]?.athleteId,
        athleteName,
        totalActions: bucket.length,
        averageScore: Math.round(average(scores) * 10) / 10,
        strengths: bySkill.filter((item) => item.averageScore >= 2.5).map((item) => skillLabelMap[item.skill]).slice(0, 2),
        weaknesses: bySkill.filter((item) => item.averageScore <= 1.5).map((item) => skillLabelMap[item.skill]).slice(0, 2),
      };
    })
    .sort((a, b) => {
      if (a.athleteName === "Equipe") return 1;
      if (b.athleteName === "Equipe") return -1;
      return b.totalActions - a.totalActions;
    });
};

export const summarizeScoutingActionsBySkill = (
  actions: ScoutingAction[]
): ScoutingActionsBySkillSummary[] => {
  const groups = new Map<ScoutingActionSkill, ScoutingAction[]>();
  for (const action of actions) {
    const bucket = groups.get(action.skill) ?? [];
    bucket.push(action);
    groups.set(action.skill, bucket);
  }
  return Array.from(groups.entries())
    .map(([skill, bucket]) => {
      const scores = bucket.map((item) => item.score ?? 0);
      const errors = bucket.filter((item) => (item.score ?? 0) === 0).length;
      return {
        skill,
        totalActions: bucket.length,
        averageScore: Math.round(average(scores) * 10) / 10,
        errorRate: bucket.length ? Math.round((errors / bucket.length) * 100) : 0,
      };
    })
    .sort((a, b) => b.totalActions - a.totalActions);
};

export const getDominantWeaknesses = (actions: ScoutingAction[]) =>
  summarizeScoutingActionsBySkill(actions)
    .filter((item) => item.averageScore <= 1.5 || item.errorRate >= 40)
    .map((item) => skillLabelMap[item.skill])
    .slice(0, 3);

export const getDominantStrengths = (actions: ScoutingAction[]) =>
  summarizeScoutingActionsBySkill(actions)
    .filter((item) => item.averageScore >= 2.5 && item.errorRate <= 20)
    .map((item) => skillLabelMap[item.skill])
    .slice(0, 3);

export const summarizeScoutingActions = (actions: ScoutingAction[]): ScoutingActionsSummary => ({
  totalActions: actions.length,
  dominantStrengths: getDominantStrengths(actions),
  dominantWeaknesses: getDominantWeaknesses(actions),
});
