import type { WeekDecisionReport } from "./types";

const joinItems = (items: string[]) => items.filter(Boolean).slice(0, 5).join("; ");

export function formatWeekDecisionReport(report: WeekDecisionReport): string {
  const lines = [
    report.shortReason,
    report.appliedFocus.length ? `Focos: ${joinItems(report.appliedFocus)}` : "",
    report.scoutingSignals.length ? `Scouting: ${joinItems(report.scoutingSignals)}` : "",
    report.coachInterventions.length ? `Intervenções: ${joinItems(report.coachInterventions)}` : "",
    report.competitiveContext.length ? `Contexto competitivo: ${joinItems(report.competitiveContext)}` : "",
    report.avoidedSignals.length ? `Evitar: ${joinItems(report.avoidedSignals)}` : "",
    report.evidenceSummary.length ? `Base aplicada: ${joinItems(report.evidenceSummary)}` : "",
  ].filter(Boolean);

  return lines.join("\n");
}
