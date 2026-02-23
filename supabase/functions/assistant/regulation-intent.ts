export type RegulationChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const regulationPatterns = [
  /regulamento/,
  /regra/,
  /fivb/,
  /fpv/,
  /paranaense/,
  /clausula/,
  /libero/,
  /substitui/,
  /torneio/,
  /campeonato/,
  /vigente/,
  /vale\b/,
  /proximo ciclo/,
  /novo ciclo/,
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
  return regulationPatterns.some((pattern) => pattern.test(prompt));
};
