export const ASSISTANT_PROGRESS_LABELS = {
  preparing_context: "Entendendo o pedido",
  context_ready: "Contexto da turma preparado",
  scientific_check: "Verificando a necessidade de evidências",
  scientific_search: "Consultando referências científicas",
  scientific_cache: "Referências recuperadas do cache",
  scientific_ready: "Referências científicas selecionadas",
  scientific_fallback: "Consensus indisponível; PubMed consultado",
  scientific_quota: "Cota científica atingida; seguindo com a base disponível",
  scientific_not_needed: "Base interna suficiente para esta resposta",
  drafting_response: "Organizando a recomendação",
  writing_response: "Escrevendo a resposta",
  validating_response: "Validando fontes e ações sugeridas",
  saving_context: "Finalizando o contexto da conversa",
} as const;

export type AssistantProgressCode = keyof typeof ASSISTANT_PROGRESS_LABELS;

export const isAssistantProgressCode = (value: string): value is AssistantProgressCode =>
  Object.prototype.hasOwnProperty.call(ASSISTANT_PROGRESS_LABELS, value);

export const appendAssistantProgress = (
  current: AssistantProgressCode[],
  next: string,
): AssistantProgressCode[] => {
  if (!isAssistantProgressCode(next) || current.includes(next)) return current;
  return [...current, next];
};
