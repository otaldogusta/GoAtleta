import { attendanceSummaryHtml, type AttendanceSummaryPdfData } from "../attendance-summary";

const data: AttendanceSummaryPdfData = {
  organizationName: "Org & Centro",
  periodLabel: "01/08/2026 a 31/08/2026",
  scopeLabel: "Centro · Águias · Professora Joana · Somente faltas",
  timeZone: "America/Sao_Paulo",
  exportedAt: "25/08/2026 09:30:00",
  totalRecords: 1,
  totalPresent: 0,
  totalAbsent: 1,
  attendanceRate: 0,
  rows: [
    {
      unit: "Centro",
      className: "Águias",
      professorNames: "Professora Joana",
      sessions: 1,
      present: 0,
      absent: 1,
      attendanceRate: 0,
    },
  ],
  details: [
    {
      date: "2026-08-04",
      unit: "Centro",
      className: "Águias",
      professorNames: "Professora Joana",
      studentName: "Ana <Silva>",
      membershipStatus: "Inativo",
      attendanceStatus: "Faltou",
    },
  ],
};

describe("attendance summary PDF template", () => {
  test("renders the filtered detail rows and escapes user-provided text", () => {
    const html = attendanceSummaryHtml(data);

    expect(html).toContain("Registros do período");
    expect(html).toContain("04/08/2026");
    expect(html).toContain("Ana &lt;Silva&gt;");
    expect(html).toContain("Org &amp; Centro");
    expect(html).toContain("Professora Joana");
    expect(html).toContain("Fuso: America/Sao_Paulo");
    expect(html).toContain("Inativo");
    expect(html).toContain("Faltou");
  });

  test("does not introduce financial, note or pain columns", () => {
    const html = attendanceSummaryHtml(data);

    expect(html).not.toContain("Financeiro");
    expect(html).not.toContain("Observação");
    expect(html).not.toContain(">Dor<");
  });
});
