import { attendanceSummaryHtml, type AttendanceSummaryPdfData } from "../attendance-summary";

const classInfo = { scheduleLabel: "18:00 - 19:00", daysLabel: "Qua, Sex", ageBandLabel: "09-11", levelLabel: "Iniciação", genderLabel: "Misto", trainingSpace: "Quadra 1" };
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
      classInfo,
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
      classInfo,
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

    expect(html).toContain("Chamadas por turma");
    expect(html).toContain("04/08");
    expect(html).toContain("Ana &lt;Silva&gt;");
    expect(html).toContain("Org &amp; Centro");
    expect(html).toContain("Professora Joana");
    expect(html).toContain("Fuso: America/Sao_Paulo");
    expect(html).toContain("Inativo");
    expect(html).toContain("Faltou");
    expect(html).toContain("18:00 - 19:00");
    expect(html).toContain("09-11");
    expect(html).toContain("Iniciação");
  });

  test("does not introduce financial, note or pain columns", () => {
    const html = attendanceSummaryHtml(data);

    expect(html).not.toContain("Financeiro");
    expect(html).not.toContain("Observação");
    expect(html).not.toContain(">Dor<");
  });
});


test("renders class before month without interleaving another class", () => {
  const row = data.details[0];
  const html = attendanceSummaryHtml({ ...data, details: [
    { ...row, classId: "b", className: "B", date: "2026-08-01" },
    { ...row, classId: "a", className: "A", date: "2026-09-01" },
    { ...row, classId: "a", className: "A", date: "2026-08-02" },
  ] });
  const classA = html.indexOf("<h1>A</h1>");
  const august = html.indexOf("<h3>Agosto de 2026</h3>", classA);
  const september = html.indexOf("<h3>Setembro de 2026</h3>", august);
  const classB = html.indexOf("<h1>B</h1>");
  expect(classA).toBeGreaterThan(0);
  expect(august).toBeGreaterThan(classA);
  expect(september).toBeGreaterThan(august);
  expect(classB).toBeGreaterThan(september);
});
