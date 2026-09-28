export type AssistantTrainingDraft = {
  title: string;
  tags: string[];
  warmup: string[];
  main: string[];
  cooldown: string[];
  warmupTime: string;
  mainTime: string;
  cooldownTime: string;
};

const list = (value: unknown) =>
  Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export function parseAssistantTrainingDraft(value: unknown): AssistantTrainingDraft | null {
  if (!value || typeof value !== "object") return null;
  const draft = value as Record<string, unknown>;
  const parsed: AssistantTrainingDraft = {
    title: text(draft.title) || "Planejamento sugerido",
    tags: list(draft.tags),
    warmup: list(draft.warmup),
    main: list(draft.main),
    cooldown: list(draft.cooldown),
    warmupTime: text(draft.warmupTime) || "10 minutos",
    mainTime: text(draft.mainTime),
    cooldownTime: text(draft.cooldownTime) || "5 minutos",
  };
  return parsed.warmup.length || parsed.main.length || parsed.cooldown.length ? parsed : null;
}

export function parseAssistantTrainingDraftReply(value: string) {
  try {
    return parseAssistantTrainingDraft(JSON.parse(value));
  } catch {
    return null;
  }
}
