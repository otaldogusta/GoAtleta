import {
  parsePedagogicalGoogleDoc,
  reconcilePedagogicalDocument,
  type AppPlanningSnapshot,
} from "..";

const anonymizedPlan = `
PLANO DE AULA — ESCOLINHA VÔLEI
Turma: Primeiros Saques (8–11 anos, misto)
MÊS: JULHO/2026
Data: 02/07/2026
Horário: 14h às 15h
Objetivo geral: Diagnosticar a recepção direta sem segurar a bola.
Objetivo específico: Conceitual: Diferenciar segurar e tocar. Atitudinal: Persistir diante do erro. Procedimental: Receber com toque ou manchete.
Situação-problema: Como devolver a bola sem segurar?
Data: 07/07/2026
Horário: 14h às 15h
Objetivo geral: Aplicar recepção direta no 1x1.
Objetivo específico: Conceitual: Reconhecer o primeiro contato. Atitudinal: Tentar novamente. Procedimental: Controlar a recepção.
Situação-problema: O que muda no corpo para receber?
Data: 09/07/2026
Horário: 14h às 15h
Objetivo geral: Consolidar a recepção direta no 1x1.
Objetivo específico: Conceitual: Reconhecer a força. Atitudinal: Persistir. Procedimental: Receber sem segurar.
Situação-problema: Como controlar a primeira bola?
Data: 14/07/2026
Horário: 14h às 15h
Objetivo geral: Sustentar trocas no 1x1.
Objetivo específico: Conceitual: Controlar força. Atitudinal: Cooperar. Procedimental: Sustentar contatos.
Situação-problema: Como aumentar as trocas?
Data: 16/07/2026
Horário: 14h às 15h
Objetivo geral: Ampliar continuidade.
Objetivo específico: Conceitual: Identificar espaço. Atitudinal: Comunicar. Procedimental: Deslocar e receber.
Situação-problema: Onde se posicionar?
Data: 21/07/2026
Horário: 14h às 15h
Objetivo geral: Introduzir mini 2x2.
Objetivo específico: Conceitual: Entender dupla. Atitudinal: Cooperar. Procedimental: Jogar 2x2.
Situação-problema: Como dividir o espaço?
Data: 23/07/2026
Horário: 14h às 15h
Objetivo geral: Consolidar mini 2x2.
Objetivo específico: Conceitual: Decidir. Atitudinal: Comunicar. Procedimental: Sustentar jogo.
Situação-problema: Quem recebe cada bola?
Data: 28/07/2026
Horário: 14h às 15h
Objetivo geral: Integrar fundamentos.
Objetivo específico: Conceitual: Reconhecer evolução. Atitudinal: Valorizar tentativa. Procedimental: Jogar sem segurar.
Situação-problema: O que evoluiu?
Data: 30/07/2026
Horário: 14h às 15h
Objetivo geral: Avaliar o mês.
Objetivo específico: Conceitual: Autoavaliar. Atitudinal: Respeitar o processo. Procedimental: Jogar mini 2x2.
Situação-problema: O que ainda precisa melhorar?
`;

const anonymizedReportWithRepeatedCells = `
RELATÓRIO ESCOLINHA DE VÔLEI
MÊS: JULHO/2026
Data: 09/07/2026
Conclusão: Apenas dois participantes executaram a recepção direta adequadamente. A maioria apresentou dificuldade de controle e compreensão. Foi necessário adaptar a atividade.
Número de Participantes: 14:00 - 15:00 - Turma 8-11 (Misto): 14
Data: 09/07/2026
Conclusão: Apenas dois participantes executaram a recepção direta adequadamente. A maioria apresentou dificuldade de controle e compreensão. Foi necessário adaptar a atividade.
Número de Participantes: 14:00 - 15:00 - Turma 8-11 (Misto): 14
`;

describe("document intelligence July pilot", () => {
  it("extracts nine lessons without personal data", () => {
    const interpretation = parsePedagogicalGoogleDoc({
      sourceDocumentId: "planning-july",
      title: "Planejamento Julho",
      text: anonymizedPlan,
    });

    expect(interpretation.documentType).toBe("monthly_plan");
    expect(interpretation.className.value).toContain("Primeiros Saques");
    expect(interpretation.period.value).toBe("JULHO/2026");
    expect(interpretation.lessons).toHaveLength(9);
    expect(interpretation.lessons[0].dimensions).toEqual({
      conceptual: "Diferenciar segurar e tocar.",
      attitudinal: "Persistir diante do erro.",
      procedural: "Receber com toque ou manchete.",
    });
  });

  it("deduplicates repeated report blocks", () => {
    const interpretation = parsePedagogicalGoogleDoc({
      sourceDocumentId: "report-july",
      title: "Relatório Julho",
      text: anonymizedReportWithRepeatedCells,
    });

    expect(interpretation.documentType).toBe("monthly_report");
    expect(interpretation.reports).toHaveLength(1);
    expect(interpretation.duplicateBlocksIgnored).toBe(1);
  });

  it("keeps completed evidence and conditions the 2x2 progression", () => {
    const interpretation = parsePedagogicalGoogleDoc({
      sourceDocumentId: "planning-july",
      title: "Planejamento Julho",
      text: anonymizedPlan,
    });
    const snapshot: AppPlanningSnapshot = {
      version: "planning-v3",
      organizationId: "org-pilot",
      classId: "class-8-11",
      period: "2026-07",
      currentFocus: "Recepção direta sem segurar",
      progression: "1x1 para mini 2x2 em 21/07",
      plannedSessionDates: ["2026-07-02", "2026-07-07", "2026-07-09"],
      completedReports: [
        { date: "2026-07-02", conclusion: "Sessão realizada" },
        { date: "2026-07-07", conclusion: "Sessão realizada" },
        {
          date: "2026-07-09",
          conclusion: "Baixa prontidão na recepção direta",
          successfulDirectReceptionCount: 2,
        },
      ],
    };

    const items = reconcilePedagogicalDocument({ interpretation, snapshot });
    expect(items.filter((entry) => entry.category === "complement")).toHaveLength(6);
    expect(items.find((entry) => entry.id === "adjust-2x2-readiness")).toMatchObject({
      category: "adjust",
      recommendation: "apply",
      proposedValue: "Mini 2x2 condicionado a nova evidência de prontidão.",
    });
    expect(items.some((entry) => entry.targetType === "report" && entry.recommendation === "apply")).toBe(false);
  });
});
