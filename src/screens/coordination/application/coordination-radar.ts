import type { ClassGroup, SessionLog } from "../../../core/models";
import { buildNextClassSuggestion } from "../../../core/intelligence/suggestion-engine";

export type ClassRadarItem = {
  classId: string;
  className: string;
  unit: string;
  radarScore: number;
  trendLabel: "subindo" | "estavel" | "queda";
  alerts: string[];
  nextTrainingPrompt: string;
  logsCount: number;
};

export function buildCoordinationRadar(
  classes: readonly ClassGroup[],
  sessionLogs: readonly SessionLog[],
): ClassRadarItem[] {
  const logsByClass = new Map<string, SessionLog[]>();
  for (const log of sessionLogs) {
    const logs = logsByClass.get(log.classId) ?? [];
    logs.push(log);
    logsByClass.set(log.classId, logs);
  }

  return classes.map((classGroup) => {
    const logs = logsByClass.get(classGroup.id) ?? [];
    const suggestion = buildNextClassSuggestion({ className: classGroup.name, logs });
    return {
      classId: classGroup.id,
      className: classGroup.name,
      unit: classGroup.unit,
      radarScore: suggestion.radarScore,
      trendLabel: suggestion.trendLabel,
      alerts: suggestion.alerts,
      nextTrainingPrompt: suggestion.nextTrainingPrompt,
      logsCount: logs.length,
    };
  }).sort((a, b) => a.radarScore - b.radarScore).slice(0, 6);
}
