import { buildReportHistory, filterReportHistory } from "../report-history";
import type { SessionReportSummary } from "../../../../db/session-report-history";

const report = (date: string, activity = "Recepção", overrides: Partial<SessionReportSummary> = {}): SessionReportSummary => ({
  id: date, clientId: date, createdAt: `${date}T00:00:00Z`, activity, conclusion: "Comunicação entre duplas", ...overrides,
});

it("sorts by lesson date, validates dates and avoids local timezone shifts", () => {
  const entries = buildReportHistory([report("2025-10-07"), report("2026-02-30"), report("2026-10-07"), report("bad-date")]);
  expect(entries.map(entry => entry.dateKey)).toEqual(["2026-10-07", "2025-10-07"]);
  expect(entries[0]).toMatchObject({ dateLabel: "07/10/2026", day: "07", weekday: "Qua", monthLabel: "Outubro de 2026" });
});

it("presents the same dated report as the existing editor when legacy duplicates exist", () => {
  const entries = buildReportHistory([
    report("2026-10-07", "Earlier version", { clientId: "a", createdAt: "2026-10-07T20:00:00Z" }),
    report("2026-10-07", "Latest version", { clientId: "z" }),
  ]);
  expect(entries).toHaveLength(1);
  expect(entries[0].title).toBe("Latest version");
});

it("combines year, month and accent-insensitive text and date search across all records", () => {
  const entries = buildReportHistory([report("2025-10-07"), report("2026-10-07"), report("2026-09-07", "Saque")]);
  expect(filterReportHistory(entries, "all", "10", "comunicacao recepcao")).toHaveLength(2);
  expect(filterReportHistory(entries, "2025", "10", "07/10/2025")).toHaveLength(1);
  expect(filterReportHistory(entries, "2026", "09", "saque")).toHaveLength(1);
  expect(filterReportHistory(entries, "2026", "09", "recepcao")).toEqual([]);
});

it("keeps reports without narrative visible", () => {
  expect(buildReportHistory([report("2026-10-07", "", { conclusion: "" })])[0].title).toBe("Relatório da aula");
});

it("ranks legacy null client IDs last, as the dated editor does", () => {
  const entries = buildReportHistory([
    report("2026-10-07", "Legacy", { id: "zzzz", clientId: null }),
    report("2026-10-07", "Current", { clientId: "a" }),
  ]);
  expect(entries[0].title).toBe("Current");
});
