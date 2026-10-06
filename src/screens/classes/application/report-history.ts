import type { SessionReportSummary } from "../../../db/session-report-history";

export const REPORT_MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
const compact = (text: string) => text.trim().replace(/\s+/g, " ");

export type ReportHistoryEntry = SessionReportSummary & {
  dateKey: string;
  dateLabel: string;
  day: string;
  weekday: string;
  monthKey: string;
  monthLabel: string;
  title: string;
  preview: string;
  searchText: string;
};

export function buildReportHistory(logs: SessionReportSummary[]): ReportHistoryEntry[] {
  const byDate = new Map<string, SessionReportSummary>();
  for (const log of logs) {
    const dateKey = log.createdAt.slice(0, 10);
    const date = new Date(`${dateKey}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== dateKey) continue;
    const previous = byDate.get(dateKey);
    // Match getSessionLogByDate: client_id desc, then createdat desc.
    if (!previous || (log.clientId !== null && (previous.clientId === null || log.clientId > previous.clientId)) ||
      (log.clientId === previous.clientId && log.createdAt > previous.createdAt)) byDate.set(dateKey, log);
  }
  return [...byDate.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([dateKey, log]) => {
    const dateLabel = dateKey.split("-").reverse().join("/");
    const monthLabel = `${REPORT_MONTHS[Number(dateKey.slice(5, 7)) - 1]} de ${dateKey.slice(0, 4)}`;
    const title = compact(log.activity) || "Relatório da aula";
    const preview = compact(log.conclusion);
    return {
      ...log, dateKey, dateLabel, day: dateKey.slice(8, 10),
      weekday: WEEKDAYS[new Date(`${dateKey}T12:00:00Z`).getUTCDay()],
      monthKey: dateKey.slice(0, 7), monthLabel, title, preview,
      searchText: normalize(`${dateLabel} ${monthLabel} ${log.activity} ${log.conclusion}`),
    };
  });
}

export function filterReportHistory(entries: ReportHistoryEntry[], year: string, month: string, query: string) {
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  return entries.filter(entry => (year === "all" || entry.dateKey.startsWith(`${year}-`)) &&
    (month === "all" || entry.dateKey.slice(5, 7) === month) && terms.every(term => entry.searchText.includes(term)));
}
