import { ClassGroup, SessionPlan } from "./models";
import { getBlockForToday } from "./periodization";
import { pickVolleyballMain } from "./volleyballDrills";

export function generateSession(cls: ClassGroup): SessionPlan {
  const block = getBlockForToday(cls);

  const warmup = ["Mobilidade dinamica", "Ativacao leve", "Jogo curto"];

  const main = pickVolleyballMain(cls) ?? getMainByAgeBand(cls.ageBand);

  const cooldown = [
    "Caminhada + respiracao (2min)",
    "Mobilidade leve (2min)",
    "PSE + tecnica (1min)",
  ];

  return { block, warmup, main, cooldown };
}

function getMainByAgeBand(ageBand: ClassGroup["ageBand"]): string[] {
  if (ageBand === "8-9") {
    return [
      "Circuito 8 estacoes (25s ON / 35s OFF) x2-3",
      "Estacoes: agachar - empurrar - puxar - equilibrio - zigue-zague - salto - arremesso - prancha",
      "Mini jogo tecnico (15min)",
    ];
  }

  if (ageBand === "10-12") {
    return [
      "Forca tecnica (25min): goblet squat 2-3x8-10 - remada 2-3x8-10 - hinge 2x6-8",
      "Circuito atletico (15min): saltos 3x5 - sprint 10m 4-6x - core",
      "Jogo curto (5min)",
    ];
  }

  return [
    "Forca (30min): agachar 3x6-10 - empurrar 3x6-10 - puxar 3x8-12",
    "Potencia/sprint (10min): saltos 3x4-6 - sprint 10-20m 4-6x",
    "Core (5min): anti-rotacao + prancha lateral",
  ];
}

