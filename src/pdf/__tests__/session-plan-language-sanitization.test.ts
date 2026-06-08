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

  it("renders operational activity text without internal coaching fields", () => {
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
    expect(html).toContain(
      "Passe para alvo em duplas<br/>Duplas a 3 metros com cone como alvo. Um aluno lanca e o outro responde de manchete."
    );
    expect(html).toContain(
      "Manchete com ajuste de pés<br/>Três filas curtas atrás da linha de fundo e alvo na posição 3. O aluno ajusta os pés, chama a bola e faz a manchete para o alvo."
    );
    expect(html).not.toContain("Foco do professor:");
    expect(html).not.toContain("Meta:");
    expect(html).not.toContain("Critério de sucesso:");
    expect(html).not.toContain("Adaptação:");
    expect(html).not.toContain("Base baixa e manchete firme.");
    expect(html).not.toContain("3 acertos em 6 tentativas.");
    expect(html).not.toContain("Aproximar ou afastar a dupla.");
    expect(html).not.toContain("vwv_");
    expect(html).not.toContain("Exploração guiada");
    expect(html).not.toContain("referência técnica");
  });

  it("keeps practical scoring and game rules when they are part of execution", () => {
    const html = sessionPlanHtml({
      className: "Turma 10-12",
      dateLabel: "13/06/2026",
      title: "Passe",
      blocks: [
        {
          key: "main",
          label: "Parte principal",
          durationMinutes: 40,
          activities: [
            {
              name: "Mini jogo com ponto extra por passe bom",
              description: "",
              organization: "Em quadra reduzida, separar equipes 3x3 ou 4x4.",
              execution:
                "A bola entra por lançamento ou saque adaptado. A equipe ganha ponto extra quando o primeiro contato chega jogável na zona marcada.",
              coachFocus: "Não deve aparecer no PDF.",
              successCriteria: "Não deve aparecer no PDF.",
              adaptation: "Não deve aparecer no PDF.",
              primarySkill: "passe",
            },
          ],
        },
      ],
    });

    expect(html).toContain("quadra reduzida");
    expect(html).toContain("lançamento");
    expect(html).toContain("ponto extra");
    expect(html).not.toContain("Não deve aparecer no PDF");
    expect(html).not.toContain("Foco do professor");
    expect(html).not.toContain("Meta:");
    expect(html).not.toContain("Adaptação:");
  });

  it.each([
    {
      title: "Turma 07-09 · Passe",
      ageGroup: "07-09",
    },
    {
      title: "Turma 10-12 · Passe",
      ageGroup: "10-12",
    },
  ])("renders polished passe objectives for $title", ({ title, ageGroup }) => {
    const html = sessionPlanHtml({
      className: title,
      ageGroup,
      dateLabel: "13/06/2026",
      title,
      blocks: [],
    });

    expect(html).toContain(
      "Objetivo geral:</strong> Desenvolver o controle do passe/manchete em situações simples de jogo."
    );
    expect(html).toContain(
      "Objetivo específico:</strong> Ajustar base, deslocamento e direção da bola para enviar o passe a uma zona-alvo."
    );
    expect(html).not.toContain("os fundamentos de turma");
    expect(html).not.toContain("execucao");
    expect(html).not.toContain("decisao");
  });
});
