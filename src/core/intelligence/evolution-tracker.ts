import type { SessionLog, VolleyballSkill } from "../models";
import { evaluateSessionSkillSnapshot, type SessionSkillSnapshot } from "./skill-evaluator";

export type TrendDirection = "up" | "down" | "stable";

export type EvolutionTrackerOutput = {
  recent: SessionSkillSnapshot;
  previous: SessionSkillSnapshot;
  trend: TrendDirection;
  deltaOverall: number;
  prioritySkills: VolleyballSkill[];
};

const toTrend = (delta: number): TrendDirection => {
  if (delta >= 0.06) return "up";
  if (delta <= -0.06) return "down";
  return "stable";
};

export const trackClassEvolution = (logs: SessionLog[]): EvolutionTrackerOutput => {
  if (!logs.length) {
    const empty = evaluateSessionSkillSnapshot([]);
    return {
      recent: empty,
      previous: empty,
      trend: "stable",
      deltaOverall: 0,
      prioritySkills: ["passe", "defesa"],
    };
  }

  const ordered = [...logs].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const splitIndex = Math.max(1, Math.floor(ordered.length / 2));

  const previousLogs = ordered.slice(0, splitIndex);
  const recentLogs = ordered.slice(splitIndex);

  const previous = evaluateSessionSkillSnapshot(previousLogs);
  const recent = evaluateSessionSkillSnapshot(recentLogs.length ? recentLogs : ordered);

  const deltaOverall = recent.overallScore - previous.overallScore;
  const trend = toTrend(deltaOverall);

  const weaknessOrder = [
    { key: "technique", value: recent.techniqueScore },
    { key: "attendance", value: recent.attendanceScore },
    { key: "load", value: recent.loadBalanceScore },
  ].sort((a, b) => a.value - b.value);

  const prioritySkills: VolleyballSkill[] =
    weaknessOrder[0]?.key === "technique"
      ? ["passe", "levantamento"]
      : weaknessOrder[0]?.key === "attendance"
        ? ["transicao", "defesa"]
        : ["saque", "bloqueio"];

  return {
    recent,
    previous,
    trend,
    deltaOverall,
    prioritySkills,
  };
};
