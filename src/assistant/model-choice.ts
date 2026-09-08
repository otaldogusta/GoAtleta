export const ASSISTANT_MODEL_CHOICES = [
  { value: "auto", label: "Automático", detail: "Escolhe conforme a pergunta" },
  { value: "gpt-5.6-luna", label: "GPT-5.6 Luna", detail: "Respostas rápidas e econômicas" },
  { value: "gpt-5.6-terra", label: "GPT-5.6 Terra", detail: "Análises mais complexas" },
  { value: "gpt-4o-mini", label: "GPT-4o mini", detail: "Modelo anterior" },
] as const;
export type AssistantModelChoice = typeof ASSISTANT_MODEL_CHOICES[number]["value"];
