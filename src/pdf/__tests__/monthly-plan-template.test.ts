import { monthlyPlanHtml } from "../templates/monthly-plan";

describe("monthlyPlanHtml", () => {
  it("keeps editable cells visually blank for a clean manual sheet", () => {
    const html = monthlyPlanHtml({
      className: "Turma 10-12",
      professorName: "",
      monthLabel: "Agosto de 2026",
      generatedAt: "10/08/2026 12:00",
      totalWeeks: 1,
      totalSessions: 1,
      lessons: [
        {
          id: "blank",
          weekLabel: "",
          dateLabel: "10/08/2026",
          timeLabel: "14h às 15h",
          generalObjective: "",
          specificObjective: "",
          situationProblem: "",
          preserveEmptyFields: true,
          blocks: [
            { period: "Aquecimento", activities: "", time: "", description: "" },
            { period: "Parte principal", activities: "", time: "", description: "" },
            { period: "Volta à calma", activities: "", time: "", description: "" },
          ],
        },
      ],
    }, { editable: true });

    expect(html).not.toContain("o fundamento da aula");
    expect(html).not.toContain(">-<");
    expect(html).toContain('data-field="title"');
    expect(html).toContain('data-field="generalObjective"');
    expect(html).toContain('data-field="block-activities-Aquecimento"');
  });

  it("uses the reference lesson-sheet layout for each lesson", () => {
    const html = monthlyPlanHtml({
      className: "Turma 10-12",
      ageGroup: "10-12",
      professorName: "Professor",
      monthLabel: "Julho de 2026",
      generatedAt: "14/07/2026 14:00",
      totalWeeks: 1,
      totalSessions: 1,
      lessons: [
        {
          id: "lesson-1",
          weekLabel: "SEMANA 28",
          dateLabel: "15/07/2026",
          timeLabel: "14h às 15h",
          generalObjective: "Objetivo geral",
          specificObjective: "Conceitual: Compreender.\nAtitudinal: Cooperar.\nProcedimental: Executar.",
          situationProblem: "Situação-problema",
          blocks: [
            {
              period: "Volta à calma",
              activities: "Roda de conversa",
              time: "5 min",
              description: "Compartilhar aprendizados",
            },
          ],
        },
      ],
    });

    expect(html).toContain("size: A4 portrait");
    expect(html).toContain("#457b3c");
    expect(html).toContain("PLANO DE AULA — ESCOLINHA VÔLEI");
    expect(html).toContain("Situação-problema");
    expect(html).toContain(">Período</th>");
    expect(html).toContain(">Atividades</th>");
    expect(html).toContain(">Tempo</th>");
    expect(html).toContain(">Descrição / condução da situação-problema</th>");
    expect(html).toContain("font-size: 9.5pt");
    expect(html).toContain("margin: 15mm 8mm 8mm");
    expect(html).toContain("padding: 6px 5px");
    expect(html).toContain("width: 100%");
    expect(html).toContain(".specific-row th { height: 12mm; }");
    expect(html).toContain(".block-main td");
    expect(html).toContain("height: 18mm;");
    expect(html).toContain("font-style: italic");
    expect(html).toContain('<th class="label-cell period">Volta à calma:</th>');
    expect(html).toContain('<td colspan="3">Roda de conversa</td>');
    expect(html).toContain("<strong>Conceitual:</strong>");
    expect(html).toContain("14h às 15h");
    expect(html).not.toContain("Aula 1 de 1");
    expect(html.match(/class=\"page\"/g)).toHaveLength(1);
  });

  it("renders structured activities as independent rows for A4 pagination", () => {
    const html = monthlyPlanHtml({
      className: "Turma 10-12",
      professorName: "Professor",
      monthLabel: "Agosto de 2026",
      generatedAt: "11/08/2026 12:00",
      totalWeeks: 1,
      totalSessions: 1,
      lessons: [{
        id: "long-plan",
        weekLabel: "Semana 1",
        dateLabel: "11/08/2026",
        generalObjective: "Objetivo",
        specificObjective: "Objetivo específico",
        blocks: [{
          period: "Parte principal",
          activities: "1. Atividade um\n2. Atividade dois",
          time: "40'",
          description: "1. Descrição um\n2. Descrição dois",
          items: [
            { activity: "Atividade um", description: "Descrição um" },
            { activity: "Atividade dois", description: "Descrição dois" },
          ],
        }],
      }],
    }, { editable: true });

    expect(html).toContain('data-field="block-activity-main-0"');
    expect(html).toContain('data-field="block-activity-main-1"');
    expect(html).toContain('data-field="block-description-item-main-1"');
    expect(html.match(/class="block-row block-main/g)).toHaveLength(2);
    expect(html).toContain("block-continuation");
  });
});
