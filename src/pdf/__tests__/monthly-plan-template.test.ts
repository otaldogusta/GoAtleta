import { monthlyPlanHtml } from "../templates/monthly-plan";

describe("monthlyPlanHtml", () => {
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
    expect(html).toContain("font-style: italic");
    expect(html).toContain('<th class="label-cell period">Volta à calma:</th>');
    expect(html).toContain('<td colspan="3">Roda de conversa</td>');
    expect(html).toContain("<strong>Conceitual:</strong>");
    expect(html).toContain("14h às 15h");
    expect(html).not.toContain("Aula 1 de 1");
    expect(html.match(/class=\"page\"/g)).toHaveLength(1);
  });
});
