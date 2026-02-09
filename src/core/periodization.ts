import { ClassGroup } from "./models";

export function getBlockForToday(cls: ClassGroup): string {
  const goal = cls.goal.toLowerCase();
  if (goal.includes("força") && goal.includes("potência")) {
    return "Meso B/C - Forca + Potencia";
  }
  if (goal.includes("força")) {
    return "Meso B - Forca Geral";
  }
  if (goal.includes("potência") || goal.includes("agilidade")) {
    return "Meso C - Potencia/Agilidade";
  }
  return "Meso A - Fundamentos/Tecnica";
}
