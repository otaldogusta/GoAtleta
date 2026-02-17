import type { SessionLog } from "../models";

export type SessionSkillSnapshot = {
  attendanceScore: number;
  techniqueScore: number;
  loadBalanceScore: number;
  consistencyScore: number;
  overallScore: number;
  averageRpe: number;
  alerts: string[];
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const avg = (values: number[]) => {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const stdDev = (values: number[]) => {
  if (values.length <= 1) return 0;
  const mean = avg(values);
  const variance = avg(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
};

const techniqueToScore = (value: SessionLog["technique"]) => {
  if (value === "boa") return 0.88;
  if (value === "ok") return 0.64;
  return 0.38;
};

export const evaluateSessionSkillSnapshot = (logs: SessionLog[]): SessionSkillSnapshot => {
  if (!logs.length) {
    return {
      attendanceScore: 0,
      techniqueScore: 0,
      loadBalanceScore: 0,
      consistencyScore: 0,
      overallScore: 0,
      averageRpe: 0,
      alerts: ["Sem sessões recentes para avaliar a evolução da turma."],
    };
  }

  const attendanceValues = logs.map((log) => clamp01(Number(log.attendance || 0)));
  const techniqueValues = logs.map((log) => techniqueToScore(log.technique));
  const rpeValues = logs.map((log) => Math.max(0, Number(log.PSE || 0)));

  const attendanceScore = avg(attendanceValues);
  const techniqueScore = avg(techniqueValues);

  const averageRpe = avg(rpeValues);
  const loadBalanceScore = clamp01(1 - Math.abs(averageRpe - 6) / 6);
  const consistencyScore = clamp01(1 - stdDev(rpeValues) / 4);

  const overallScore = clamp01(
    attendanceScore * 0.3 + techniqueScore * 0.4 + loadBalanceScore * 0.2 + consistencyScore * 0.1
  );

  const alerts: string[] = [];
  if (attendanceScore < 0.65) {
    alerts.push("Presença recente abaixo de 65%; revisar engajamento e rotina.");
  }
  if (techniqueScore < 0.58) {
    alerts.push("Execução técnica inconsistente; priorizar fundamentos com volume controlado.");
  }
  if (averageRpe >= 7.6) {
    alerts.push("PSE médio alto; ajustar carga para preservar qualidade técnica.");
  }

  return {
    attendanceScore,
    techniqueScore,
    loadBalanceScore,
    consistencyScore,
    overallScore,
    averageRpe,
    alerts,
  };
};
