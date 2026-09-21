export function resolveStructuredProposalReply(input: {
  rawReply: string;
  hasReportProposal: boolean;
  hasClassMemoryProposal: boolean;
}) {
  if (input.hasReportProposal && input.hasClassMemoryProposal) {
    return "Preparei o relatório e a regra da turma. Revise as duas propostas abaixo antes de salvar.";
  }
  if (input.hasReportProposal) {
    return "Preparei o relatório. Revise a proposta abaixo antes de salvar.";
  }
  if (input.hasClassMemoryProposal) {
    return "Preparei a regra da turma. Revise a proposta abaixo antes de salvar.";
  }
  return input.rawReply;
}

export function collapseLatestStructuredProposalReply<T extends { role: string; content: string }>(input: {
  messages: T[];
  hasReportProposal: boolean;
  hasClassMemoryProposal: boolean;
}) {
  if (!input.hasReportProposal && !input.hasClassMemoryProposal) return input.messages;
  const duplicateIndex = input.messages.findLastIndex((message) => {
    if (message.role !== "assistant") return false;
    const normalized = message.content.toLocaleLowerCase("pt-BR");
    return normalized.includes("proposta de relatório") || normalized.includes("proposta de regra recorrente");
  });
  if (duplicateIndex < 0) return input.messages;
  return input.messages.map((message, index) => index === duplicateIndex ? {
    ...message,
    content: resolveStructuredProposalReply({
      rawReply: message.content,
      hasReportProposal: input.hasReportProposal,
      hasClassMemoryProposal: input.hasClassMemoryProposal,
    }),
  } : message);
}

export function buildAssistantReportIdentity(input: {
  organizationId: string;
  classId: string;
  sessionDate: string;
}) {
  const scope = `${input.organizationId}_${input.classId}_${input.sessionDate}`
    .replace(/[^a-zA-Z0-9_-]+/g, "_");
  return `assistant_report_${scope}`;
}
