import type { ClassGroup } from "./models";

export const CLASS_DEVELOPMENT_LEVEL_OPTIONS = [
  { value: "MV1", label: "Iniciação" },
  { value: "MV2", label: "Intermediário" },
  { value: "MV3", label: "Rendimento" },
] as const;

export type ClassDevelopmentLevelLabel =
  (typeof CLASS_DEVELOPMENT_LEVEL_OPTIONS)[number]["label"];

export function resolveClassDevelopmentLevelLabel(
  classGroup: Pick<ClassGroup, "level" | "mvLevel">
): ClassDevelopmentLevelLabel {
  const value = String(classGroup.mvLevel ?? "")
    .trim()
    .toLocaleLowerCase("pt-BR");

  if (value === "mv3" || value.includes("avanç") || value.includes("avanc") || value.includes("rend")) {
    return "Rendimento";
  }
  if (value === "mv2" || value.includes("inter")) {
    return "Intermediário";
  }
  if (value === "mv1" || value.includes("inici")) {
    return "Iniciação";
  }

  const numericLevel = Number(classGroup.level);
  if (Number.isFinite(numericLevel) && numericLevel >= 3) return "Rendimento";
  if (Number.isFinite(numericLevel) && numericLevel === 2) return "Intermediário";
  return "Iniciação";
}
