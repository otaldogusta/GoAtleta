import { ClassGroup, SessionPlan } from "./models";
import { getBlockForToday } from "./periodization";

export function generateSession(cls: ClassGroup): SessionPlan {
  const block = getBlockForToday(cls);

  const warmup = ["Mobilidade dinâmica", "Ativação leve", "Jogo curto"];

  const main = getMainByAgeBand(cls.ageBand);

  const cooldown = [
    "Caminhada + respiração (2min)",
    "Mobilidade leve (2min)",
    "RPE + técnica (1min)",
  ];

  return { block, warmup, main, cooldown };
}

function getMainByAgeBand(ageBand: ClassGroup["ageBand"]): string[] {
  if (ageBand === "8-9") {
    return [
      "Circuito 8 estações (25s ON / 35s OFF) x2–3",
      "Estações: agachar • empurrar • puxar • equilíbrio • zigue-zague • salto • arremesso • prancha",
      "Mini jogo técnico (15min)",
    ];
  }

  if (ageBand === "10-12") {
    return [
      "Força técnica (25min): goblet squat 2–3x8–10 • remada 2–3x8–10 • hinge 2x6–8",
      "Circuito atlético (15min): saltos 3x5 • sprint 10m 4–6x • core",
      "Jogo curto (5min)",
    ];
  }

  return [
    "Força (30min): agachar 3x6–10 • empurrar 3x6–10 • puxar 3x8–12",
    "Potência/sprint (10min): saltos 3x4–6 • sprint 10–20m 4–6x",
    "Core (5min): anti-rotação + prancha lateral",
  ];
}
