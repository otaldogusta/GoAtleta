export type ClassModality =
  | "voleibol"
  | "voleibol_areia"
  | "futsal"
  | "futebol"
  | "basquete"
  | "fitness";

type ModalityOption = {
  value: ClassModality;
  label: string;
};

const MODALITY_OPTIONS: ModalityOption[] = [
  { value: "voleibol", label: "Vôlei de quadra" },
  { value: "voleibol_areia", label: "Vôlei de areia" },
  { value: "futsal", label: "Futsal" },
  { value: "futebol", label: "Futebol" },
  { value: "basquete", label: "Basquete" },
  { value: "fitness", label: "Fitness" },
];

const MODALITY_ORDER: Record<ClassModality, number> = {
  voleibol: 0,
  voleibol_areia: 1,
  futsal: 2,
  futebol: 3,
  basquete: 4,
  fitness: 5,
};

const MODALITY_KEYWORDS: Record<ClassModality, string[]> = {
  voleibol: ["volei", "voleibol", "volleyball"],
  voleibol_areia: ["volei de areia", "voleibol de areia", "beach volleyball"],
  futsal: ["futsal"],
  futebol: ["futebol", "football", "soccer"],
  basquete: ["basquete", "basketball"],
  fitness: ["fitness", "funcional", "academia", "musculacao"],
};

const normalizeText = (value: string | null | undefined) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const toTitleCase = (value: string) =>
  value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");

export const CLASS_MODALITY_OPTIONS = MODALITY_OPTIONS;

export const getClassModalityLabel = (value: string | null | undefined) => {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  const match = MODALITY_OPTIONS.find((item) => item.value === normalized);
  if (match) return match.label;
  return toTitleCase(String(value ?? "").trim());
};

export const getClassModalityOrder = (value: string | null | undefined) => {
  const normalized = normalizeText(value);
  return (MODALITY_ORDER as Record<string, number>)[normalized] ?? 999;
};

export const resolveClassModality = (value: string | null | undefined): ClassModality | null => {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const match = MODALITY_OPTIONS.find((item) => item.value === normalized);
  if (match) return match.value;
  if (
    (normalized.includes("areia") || normalized.includes("beach")) &&
    (normalized.includes("volei") || normalized.includes("voleibol") || normalized.includes("volleyball"))
  ) {
    return "voleibol_areia";
  }
  for (const option of MODALITY_OPTIONS) {
    if (MODALITY_KEYWORDS[option.value].some((keyword) => normalized.includes(keyword))) {
      return option.value;
    }
  }
  return null;
};

export const isVolleyballClassModality = (value: string | null | undefined) => {
  const modality = resolveClassModality(value);
  return modality === "voleibol" || modality === "voleibol_areia";
};

export const matchesClassModalityText = (
  text: string | null | undefined,
  modality: ClassModality | null | undefined
) => {
  const normalizedText = normalizeText(text);
  if (!normalizedText || !modality) return false;
  const keywords = MODALITY_KEYWORDS[modality] ?? [];
  return keywords.some((keyword) => normalizedText.includes(keyword));
};
