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

  it("exports activity descriptions as concise numbered summaries", () => {
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
              description:
                "Organização: Duplas em corredores curtos da quadra, cada dupla com 2 alvos coloridos.\nDesenvolvimento: O professor chama uma cor. Quem recebe precisa direcionar a manchete para o alvo certo e voltar para a fila curta.\nComandos do professor: Chega antes da bola; Braços juntos; Aponta para a cor\nCritério de sucesso: Acertar ou aproximar 3 bolas em 5 tentativas.\nProgressão: Trocar a cor no último momento, mantendo lançamento fácil.\nAdaptação: se estiver difícil, usar alvo maior e distância menor; se estiver fácil, aumentar um passo de distância.",
            },
            {
              name: "Mini 2x2 com alvo",
              description:
                "Organização: Mini jogos 2x2 em quadra reduzida.\nDesenvolvimento: A equipe só pontua se a primeira bola for controlada para o colega antes do envio.\nCritério de sucesso: Pontuar 2 vezes na rodada.",
            },
          ],
        },
      ],
    });

    expect(html).toContain("1. Manchete para alvo colorido");
    expect(html).toContain("2. Mini 2x2 com alvo");
    expect(html).toContain("1. Duplas em corredores curtos");
    expect(html).toContain("2. Mini jogos 2x2");
    expect(html).not.toContain("Organização:");
    expect(html).not.toContain("Desenvolvimento:");
    expect(html).not.toContain("Comandos do professor:");
    expect(html).not.toContain("Critério de sucesso:");
    expect(html).not.toContain("Progressão:");
    expect(html).not.toContain("Adaptação:");
  });
});
