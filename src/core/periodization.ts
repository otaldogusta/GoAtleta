import { ClassGroup } from "./models";

export function getBlockForToday(cls: ClassGroup): string {
  switch (cls.goal) {
    case "Fundamentos":
      return "Meso A — Fundamentos/Técnica";
    case "Força Geral":
      return "Meso B — Força Geral";
    case "Potência/Agilidade":
      return "Meso C — Potência/Agilidade";
    case "Força+Potência":
      return "Meso B/C — Força + Potência";
    default:
      return "Meso A — Fundamentos/Técnica";
  }
}
