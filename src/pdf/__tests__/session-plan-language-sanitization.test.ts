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

  it("renders coupled activity details from the same activity object", () => {
    const html = sessionPlanHtml({
      className: "Turma 07-09",
      dateLabel: "13/06/2026",
      title: "Passe",
      blocks: [
        {
          key: "main",
          label: "Parte principal",
          durationMinutes: 40,
          activities: [
            {
              name: "Passe para alvo em duplas",
              description: "Descricao antiga que nao deve ser a unica fonte.",
              organization: "Duplas a 3 metros com cone como alvo.",
              execution: "Um aluno lanca e o outro responde de manchete.",
              coachFocus: "Base baixa e plataforma firme.",
              successCriteria: "3 acertos em 6 tentativas.",
              adaptation: "Aproximar ou afastar a dupla.",
              primarySkill: "passe",
            },
            {
              name: "Manchete com ajuste de pés",
              description: "vwv_skill_primary_01 Exploração guiada referência técnica.",
              organization: "Três filas curtas atrás da linha de fundo e alvo na posição 3.",
              execution: "O aluno ajusta os pés, chama a bola e faz a manchete para o alvo.",
              coachFocus: "Chegar atrás da bola antes de juntar os braços.",
              successCriteria: "2 passes seguidos chegam na zona combinada.",
              adaptation: "Lançar no corpo para facilitar ou variar profundidade para dificultar.",
              primarySkill: "passe",
            },
          ],
        },
      ],
    });

    expect(html).toContain("Passe para alvo em duplas");
    expect(html).toContain("Manchete com ajuste de pés");
    expect(html).toContain("Organização: Duplas a 3 metros com cone como alvo.");
    expect(html).toContain("Execução: Um aluno lanca e o outro responde de manchete.");
    expect(html).toContain("Foco do professor: Base baixa e manchete firme.");
    expect(html).toContain("Critério de sucesso: 3 acertos em 6 tentativas.");
    expect(html).toContain("Adaptação: Aproximar ou afastar a dupla.");
    expect(html).toContain("Organização: Três filas curtas atrás da linha de fundo e alvo na posição 3.");
    expect(html).toContain("Execução: O aluno ajusta os pés, chama a bola e faz a manchete para o alvo.");
    expect(html).not.toContain("vwv_");
    expect(html).not.toContain("Exploração guiada");
    expect(html).not.toContain("referência técnica");
  });
});
