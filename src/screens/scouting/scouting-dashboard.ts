import type { ScoutingLog, Student, StudentScoutingLog } from "../../core/models";
import {
  countsFromLog,
  countsFromStudentLog,
  getFocusSuggestion,
  getSkillMetrics,
  getTechnicalPerformanceScore,
  scoutingSkills,
  type ScoutingCounts,
} from "../../core/scouting";
import type { ScoutingImpact } from "../../core/team-context";

export type ScoutingHistoryItem = {
  id: string;
  date: string;
  modeLabel: string;
  title: string;
  opponent?: string;
  statusLabel: string;
  totalActions: number;
};

export type ScoutingTrendMetric = {
  id: string;
  label: string;
  currentAvg: number;
  previousAvg: number | null;
  currentGoodPct: number;
  trendLabel: string;
};

export type TeamScoutingSummary = {
  performanceScore: number;
  focusLabel: string;
  focusText: string;
  metrics: ScoutingTrendMetric[];
};

export type StudentScoutingSummaryItem = {
  studentId: string;
  studentName: string;
  totalActions: number;
  overallScore: number;
  topSkillLabel: string;
  priorityLabel: string;
  lastDate: string;
};

const roundOne = (value: number) => Math.round(value * 10) / 10;

const buildEmptySkillCounts = () => ({ 0: 0, 1: 0, 2: 0 });

const createAggregateCounts = (): ScoutingCounts => ({
  serve: buildEmptySkillCounts(),
  receive: buildEmptySkillCounts(),
  set: buildEmptySkillCounts(),
  attack_send: buildEmptySkillCounts(),
});

const aggregateScoutingCounts = (logs: ScoutingLog[]): ScoutingCounts => {
  const base = createAggregateCounts();

  for (const log of logs) {
    const counts = countsFromLog(log);
    for (const skill of scoutingSkills) {
      base[skill.id][0] += counts[skill.id][0];
      base[skill.id][1] += counts[skill.id][1];
      base[skill.id][2] += counts[skill.id][2];
    }
  }

  return base;
};

export const buildScoutingHistory = (
  logs: ScoutingLog[],
  impacts: ScoutingImpact[]
): ScoutingHistoryItem[] => {
  const impactByDate = new Map(impacts.map((item) => [item.date, item]));
  return logs.map((log) => {
    const counts = countsFromLog(log);
    const totalActions = scoutingSkills.reduce(
      (sum, skill) => sum + getSkillMetrics(counts[skill.id]).total,
      0
    );
    const linkedImpact = impactByDate.get(log.date);
    return {
      id: log.id,
      date: log.date,
      modeLabel: log.mode === "jogo" ? "Jogo" : "Treino",
      title: log.mode === "jogo" ? "Scouting de jogo" : "Scouting de treino",
      opponent: linkedImpact?.weaknesses[0],
      statusLabel: totalActions >= 10 ? "Finalizado" : "Em análise",
      totalActions,
    };
  });
};

export const buildTeamScoutingSummary = (
  logs: ScoutingLog[]
): TeamScoutingSummary | null => {
  if (!logs.length) return null;
  const current = logs.slice(0, 4);
  const previous = logs.slice(4, 8);
  const currentCounts = aggregateScoutingCounts(current);
  const previousCounts = previous.length ? aggregateScoutingCounts(previous) : null;
  const focus = getFocusSuggestion(currentCounts, 10);

  return {
    performanceScore: getTechnicalPerformanceScore(currentCounts),
    focusLabel: focus?.label ?? "Sem foco dominante",
    focusText: focus?.text ?? "Registre mais ações para destravar uma prioridade técnica.",
    metrics: scoutingSkills.map((skill) => {
      const currentMetrics = getSkillMetrics(currentCounts[skill.id]);
      const previousMetrics = previousCounts ? getSkillMetrics(previousCounts[skill.id]) : null;
      const delta = previousMetrics ? currentMetrics.avg - previousMetrics.avg : null;
      const trendLabel =
        delta == null
          ? "Base inicial"
          : delta > 0.12
          ? "Em evolução"
          : delta < -0.12
          ? "Queda recente"
          : "Estável";
      return {
        id: skill.id,
        label: skill.label,
        currentAvg: roundOne(currentMetrics.avg),
        previousAvg: previousMetrics ? roundOne(previousMetrics.avg) : null,
        currentGoodPct: Math.round(currentMetrics.goodPct * 100),
        trendLabel,
      };
    }),
  };
};

export const buildStudentScoutingSummary = (
  students: Student[],
  logs: StudentScoutingLog[]
): StudentScoutingSummaryItem[] => {
  const studentMap = new Map(students.map((student) => [student.id, student]));
  const grouped = new Map<string, StudentScoutingLog[]>();

  for (const log of logs) {
    const bucket = grouped.get(log.studentId) ?? [];
    bucket.push(log);
    grouped.set(log.studentId, bucket);
  }

  return Array.from(grouped.entries())
    .map(([studentId, studentLogs]) => {
      const student = studentMap.get(studentId);
      if (!student) return null;
      const counts = studentLogs.reduce((acc, log) => {
        const next = countsFromStudentLog(log);
        for (const skill of scoutingSkills) {
          acc[skill.id][0] += next[skill.id][0];
          acc[skill.id][1] += next[skill.id][1];
          acc[skill.id][2] += next[skill.id][2];
        }
        return acc;
      }, createAggregateCounts());
      const focus = getFocusSuggestion(counts, 1);
      const totalActions = scoutingSkills.reduce(
        (sum, skill) => sum + getSkillMetrics(counts[skill.id]).total,
        0
      );
      const strongest = [...scoutingSkills]
        .map((skill) => ({ skill, metrics: getSkillMetrics(counts[skill.id]) }))
        .filter((item) => item.metrics.total > 0)
        .sort((a, b) => b.metrics.avg - a.metrics.avg)[0];

      const lastDate = [...studentLogs].sort((a, b) => b.date.localeCompare(a.date))[0]?.date ?? "";

      return {
        studentId,
        studentName: student.name,
        totalActions,
        overallScore: getTechnicalPerformanceScore(counts),
        topSkillLabel: strongest?.skill.label ?? "Sem leitura",
        priorityLabel: focus?.label ?? "Sem prioridade clara",
        lastDate,
      };
    })
    .filter((item): item is StudentScoutingSummaryItem => Boolean(item))
    .sort((a, b) => {
      if (b.totalActions !== a.totalActions) return b.totalActions - a.totalActions;
      return a.studentName.localeCompare(b.studentName);
    });
};
