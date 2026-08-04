import type { ClassGroup } from "../../../core/models";
import type { ClassSessionCoverage } from "../../../api/class-session-coverages";

const pad = (value: number) => String(value).padStart(2, "0");

export const toLocalDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export function resolveNextClassSessionDate(classGroup: ClassGroup, now = new Date()): string {
  const classDays = new Set(classGroup.daysOfWeek ?? []);
  for (let offset = 0; offset < 14; offset += 1) {
    const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    if (classDays.has(candidate.getDay())) return toLocalDateKey(candidate);
  }
  return toLocalDateKey(now);
}

export const formatCoverageDate = (value: string) => {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
};

export const parseCoverageDate = (value: string) => {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) return null;
  return `${year}-${month}-${day}`;
};

export function getCoverageSummary(coverage?: ClassSessionCoverage | null) {
  if (!coverage) return null;
  const role = coverage.replacementRole === "intern" ? "Estagiário" : coverage.replacementRole === "assistant" ? "Assistente" : "Substituto";
  const status = coverage.status === "confirmed" ? "confirmado" : coverage.status === "completed" ? "concluído" : "pendente";
  return {
    label: `${role} ${status}`,
    dateLabel: formatCoverageDate(coverage.sessionDate),
    tone: coverage.status === "confirmed" || coverage.status === "completed" ? "success" as const : "warning" as const,
  };
}
