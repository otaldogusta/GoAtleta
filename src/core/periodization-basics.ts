export type VolumeLevel = "baixo" | "médio" | "alto";

export type PeriodizationModel = "iniciacao" | "formacao" | "competitivo";

export type SportProfile = "voleibol" | "futebol" | "basquete" | "funcional";

export const ageBands = ["06-08", "09-11", "12-14"] as const;

export const cycleOptions = [2, 3, 4, 5, 6, 8, 10, 12, 18] as const;

export const sessionsOptions = [
  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
] as const;

export const volumeOrder: VolumeLevel[] = ["baixo", "médio", "alto"];

export const dayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];

export const dayNumbersByLabelIndex = [1, 2, 3, 4, 5, 6, 0];

export const weekAgendaDayOrder = [0, 1, 2, 3, 4, 5, 6];

export const volumeToRatio: Record<VolumeLevel, number> = {
  baixo: 0.35,
  "médio": 0.65,
  alto: 0.9,
};

export const splitSegmentLengths = (total: number, parts: number) => {
  if (total <= 0 || parts <= 0) return [] as number[];
  const base = Math.floor(total / parts);
  let remainder = total % parts;
  const lengths: number[] = [];
  for (let i = 0; i < parts; i += 1) {
    const extra = remainder > 0 ? 1 : 0;
    remainder = Math.max(0, remainder - 1);
    lengths.push(Math.max(1, base + extra));
  }
  return lengths;
};

export const getDemandIndexForModel = (
  volume: VolumeLevel,
  model: PeriodizationModel,
  sessionsPerWeek = 2,
  sport: SportProfile = "voleibol"
) => {
  const frequencyDelta = sessionsPerWeek <= 1 ? -1 : sessionsPerWeek >= 3 ? 1 : 0;
  const sportDelta =
    sport === "funcional" ? -1 : sport === "futebol" || sport === "basquete" ? 1 : 0;
  if (model === "iniciacao") {
    const base = volume === "alto" ? 5 : volume === "médio" ? 4 : 3;
    return Math.max(2, Math.min(6, base + frequencyDelta + Math.min(0, sportDelta)));
  }
  if (model === "formacao") {
    const base = volume === "alto" ? 7 : volume === "médio" ? 6 : 4;
    return Math.max(3, Math.min(8, base + frequencyDelta + sportDelta));
  }
  const base = Math.round(volumeToRatio[volume] * 10);
  return Math.max(4, Math.min(10, base + frequencyDelta + sportDelta));
};

export const getLoadLabelForModel = (volume: VolumeLevel, model: PeriodizationModel) => {
  if (model === "iniciacao" && volume === "alto") return "Média";
  if (volume === "alto") return "Alta";
  if (volume === "médio") return "Média";
  return "Baixa";
};

const normalizeProfileText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export const resolveSportProfile = (modality: string | null | undefined): SportProfile => {
  const normalized = normalizeProfileText(String(modality ?? ""));
  if (normalized.includes("fut")) return "futebol";
  if (normalized.includes("basq")) return "basquete";
  if (normalized.includes("func")) return "funcional";
  return "voleibol";
};

export const getSportLabel = (sport: SportProfile) => {
  if (sport === "futebol") return "futebol";
  if (sport === "basquete") return "basquete";
  if (sport === "funcional") return "treinamento funcional";
  return "voleibol";
};
