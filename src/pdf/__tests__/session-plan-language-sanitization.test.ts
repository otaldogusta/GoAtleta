import { sessionPlanHtml } from "../templates/session-plan";

describe("session-plan language sanitization", () => {
  it("removes forbidden foreign terms from exported html", () => {
    const html = sessionPlanHtml({
      className: "Turma 08-10",
      dateLabel: "10/02/2026",
      title: "Toetsen e cmv niveau no tema",
      objective: "Execution quality e context reading",
      notes: "Best response com keer spelen",
      blocks: [
        {
          key: "main",
          label: "Parte principal",
          durationMinutes: 40,
          activities: [
            {
              name: "Toetsen level 1",
              description: "CMV niveau 2 com schoolvolleybal",
            },
          ],
        },
      ],
    });

    const lowered = html.toLowerCase();
    expect(lowered).not.toContain("toetsen");
    expect(lowered).not.toContain("cmv niveau");
    expect(lowered).not.toContain("execution quality");
    expect(lowered).not.toContain("context reading");
    expect(lowered).not.toContain("best response");
    expect(lowered).not.toContain("keer spelen");
    expect(lowered).not.toContain("schoolvolleybal");
  });

  it("exports saved activity descriptions without rewriting them", () => {
    const html = sessionPlanHtml({
      className: "Turma 07-09",
      dateLabel: "02/05/2026",
      title: "Recepção com alvo",
      blocks: [
        {
          key: "main",
          label: "Parte principal",
          durationMinutes: 45,
          activities: [
            {
              name: "Manchete para alvo colorido",
              description: "Descrição editada pelo professor para esta atividade.",
            },
            {
              name: "Mini 2x2 com alvo",
              description: "Outra descrição salva no modal.",
            },
          ],
        },
      ],
    });

    expect(html).toContain("1. Manchete para alvo colorido");
    expect(html).toContain("2. Mini 2x2 com alvo");
    expect(html).toContain("1. Descrição editada pelo professor para esta atividade.");
    expect(html).toContain("2. Outra descrição salva no modal.");
  });

  it("keeps resistance workout sheet descriptions compact in the same four-column PDF", () => {
    const html = sessionPlanHtml({
      className: "Turma 16+",
      dateLabel: "05/05/2026",
      title: "Treino resistido",
      blocks: [
        {
          key: "warmup",
          label: "Preparação",
          durationMinutes: 10,
          activities: [
            {
              name: "Aquecimento específico",
              description: "Antes das séries válidas: 1–2 séries leves e progressivas no primeiro exercício. Não contar como série válida.",
            },
          ],
        },
        {
          key: "main",
          label: "Treino resistido",
          durationMinutes: 45,
          activities: [
            {
              name: "Leg Press 45°",
              description: "3 séries · 8–10 reps · 75–90s. Amplitude segura e controle na descida.",
            },
          ],
        },
      ],
    });

    expect(html).toContain("<th>Período</th>");
    expect(html).toContain("<th>Atividades</th>");
    expect(html).toContain("<th>Tempo</th>");
    expect(html).toContain("<th>Descrição</th>");
    expect(html).toContain("1. Aquecimento específico");
    expect(html).toContain("1. Antes das séries válidas: 1–2 séries leves");
    expect(html).toContain("1. Leg Press 45°");
    expect(html).toContain("1. 3 séries · 8–10 reps · 75–90s");
    expect(html).not.toMatch(/Organização:|Desenvolvimento:|Comandos do professor:|Critério de sucesso:|Progressão:|Adaptação:/);
  });
});
