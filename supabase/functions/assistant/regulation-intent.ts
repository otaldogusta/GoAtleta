export type RegulationChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const strongRegulationPatterns = [
  /regulamento/,
  /fivb/,
  /fpv/,
  /paranaense/,
  /clausula/,
  /federacao/,
  /norma oficial/,
];

const regulationContextPatterns = [
  /libero/,
  /substitui/,
  /torneio/,
  /campeonato/,
  /vigente/,
  /vale\b/,
  /proximo ciclo/,
  /novo ciclo/,
];

const pedagogicalRulePatterns = [
  /regra (?:recorrente|pedagogica|da turma|para a turma)/,
  /rotina (?:recorrente|pedagogica|da turma|para a turma)/,
  /ultima aula (?:de|do) (?:cada )?mes/,
  /salv(?:ar|e|ando).{0,40}regra.{0,30}turma/,
  /memoria.{0,30}(?:turma|pedagogica)/,
  /relatorio da aula/,
];

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const latestUserPrompt = (messages: RegulationChatMessage[]) => {
  const latest =
    [...messages].reverse().find((item) => item.role === "user")?.content ?? "";
  return latest.trim();
};

export const isRegulationIntent = (messages: RegulationChatMessage[]) => {
  const prompt = normalize(latestUserPrompt(messages));
  if (!prompt) return false;
  if (pedagogicalRulePatterns.some((pattern) => pattern.test(prompt))) return false;
  if (strongRegulationPatterns.some((pattern) => pattern.test(prompt))) return true;
  const mentionsRule = /\bregras?\b/.test(prompt);
  return mentionsRule && regulationContextPatterns.some((pattern) => pattern.test(prompt));
};
