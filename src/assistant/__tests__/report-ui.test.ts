import { buildAssistantReportIdentity, collapseLatestStructuredProposalReply, resolveStructuredProposalReply } from "../report-ui";

describe("assistant report UI", () => {
  it("does not repeat a structured report proposal in the reply bubble", () => {
    expect(resolveStructuredProposalReply({
      rawReply: "Proposta longa repetida",
      hasReportProposal: true,
      hasClassMemoryProposal: false,
    })).toBe("Preparei o relatório. Revise a proposta abaixo antes de salvar.");
  });

  it("summarizes both structured proposals once", () => {
    expect(resolveStructuredProposalReply({
      rawReply: "Duas propostas longas repetidas",
      hasReportProposal: true,
      hasClassMemoryProposal: true,
    })).toBe("Preparei o relatório e a regra da turma. Revise as duas propostas abaixo antes de salvar.");
  });

  it("builds a stable identity per organization, class and date", () => {
    const input = {
      organizationId: "org-1",
      classId: "class/estrelas",
      sessionDate: "2026-09-19",
    };
    expect(buildAssistantReportIdentity(input)).toBe(
      buildAssistantReportIdentity(input)
    );
    expect(buildAssistantReportIdentity(input)).toBe(
      "assistant_report_org-1_class_estrelas_2026-09-19"
    );
  });

  it("collapses the latest duplicated proposal already present in the conversation", () => {
    const messages = [
      { role: "assistant", content: "Resposta anterior" },
      { role: "user", content: "Crie o relatório" },
      { role: "assistant", content: "Proposta de relatório — não salva\nConteúdo repetido" },
    ];
    expect(collapseLatestStructuredProposalReply({
      messages,
      hasReportProposal: true,
      hasClassMemoryProposal: false,
    })[2]?.content).toBe("Preparei o relatório. Revise a proposta abaixo antes de salvar.");
    expect(messages[2]?.content).toContain("Conteúdo repetido");
  });
});
