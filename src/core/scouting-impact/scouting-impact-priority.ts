import type { ScoutingAction, ScoutingActionSkill } from "../scouting-action";

export type ScoutingSkillPriority = {
  skill: ScoutingActionSkill;
  label: string;
  totalActions: number;
  averageScore: number;
  negativeActions: number;
  positiveActions: number;
  weaknessLabel?: string;
  strengthLabel?: string;
  priorityScore: number;
};

const skillLabelMap: Record<ScoutingActionSkill, string> = {
  serve: "saque",
  receive: "recepção",
  set: "levantamento",
  attack: "ataque",
  block: "bloqueio",
  defense: "defesa",
  coverage: "cobertura",
  transition: "transição",
  communication: "comunicação",
};

const weaknessLabelBySkill: Record<ScoutingActionSkill, string> = {
  serve: "saque sob pressão",
  receive: "recepção sob pressão",
  set: "levantamento fora do sistema",
  attack: "continuidade ofensiva",
  block: "leitura de bloqueio",
  defense: "defesa em continuidade",
  coverage: "cobertura pós-ataque",
  transition: "transição lenta",
  communication: "comunicação defensiva",
};

const strengthLabelBySkill: Record<ScoutingActionSkill, string> = {
  serve: "saque",
  receive: "recepção",
  set: "levantamento",
  attack: "ataque",
  block: "bloqueio",
  defense: "defesa",
  coverage: "cobertura",
  transition: "transição",
  communication: "comunicação",
};

const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const roundOne = (value: number) => Math.round(value * 10) / 10;

const score = (action: ScoutingAction) => action.score ?? 0;

export function calculateScoutingPriorityBySkill(actions: ScoutingAction[]): ScoutingSkillPriority[] {
  const bySkill = new Map<ScoutingActionSkill, ScoutingAction[]>();
  for (const action of actions) {
    const bucket = bySkill.get(action.skill) ?? [];
    bucket.push(action);
    bySkill.set(action.skill, bucket);
  }

  return Array.from(bySkill.entries())
    .map(([skill, bucket]) => {
      const scores = bucket.map(score);
      const negativeActions = bucket.filter((item) => score(item) <= 1).length;
      const positiveActions = bucket.filter((item) => score(item) >= 2).length;
      const averageScore = roundOne(average(scores));
      const isWeakness = bucket.length >= 3 && averageScore <= 1.5;
      const isStrength = bucket.length >= 3 && averageScore >= 2.5;
      return {
        skill,
        label: skillLabelMap[skill],
        totalActions: bucket.length,
        averageScore,
        negativeActions,
        positiveActions,
        weaknessLabel: isWeakness ? weaknessLabelBySkill[skill] : undefined,
        strengthLabel: isStrength ? strengthLabelBySkill[skill] : undefined,
        priorityScore: negativeActions * 2 + bucket.length - averageScore,
      };
    })
    .sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
      return b.totalActions - a.totalActions;
    });
}

export function resolveRecommendedFocusFromPriorities(priorities: ScoutingSkillPriority[]) {
  const focus: string[] = [];
  for (const priority of priorities) {
    if (!priority.weaknessLabel) continue;
    if (!focus.includes(priority.weaknessLabel)) {
      focus.push(priority.weaknessLabel);
    }
    if (focus.length >= 3) break;
  }
  return focus;
}
