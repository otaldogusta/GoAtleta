import { sessionReportHtml, type SessionReportPdfData } from "../session-report";

describe("session report attendance count", () => {
  it.each([[null, "-"], [0, "0"], [12, "12"]] as const)(
    "renders attendance %s without inventing a count",
    (participantsCount, expected) => {
      const data: SessionReportPdfData = {
        monthLabel: "Outubro", dateLabel: "06/10/2026", className: "Turma",
        unitLabel: "Unidade", activity: "Passe", conclusion: "Boa evolução",
        participantsCount, photos: "", deadlineLabel: "",
      };
      const text = sessionReportHtml(data).replace(/<[^>]*>/g, "");
      expect(text.match(/Número de participantes:\s*(-|\d+)/)?.[1]).toBe(expected);
    }
  );
});
