import type { ClassGroup } from "./models";

export type MVLevel = "MV1" | "MV2" | "MV3";

export type VolleyballHabilidade =
  | "Toque"
  | "Manchete"
  | "Saque por baixo"
  | "Saque por cima"
  | "Ataque"
  | "Deslocamento"
  | "Bloqueio"
  | "Prevencao de lesao";

export interface VolleyballDrill {
  id: string;
  habilidade: VolleyballHabilidade;
  mvLevel: MVLevel | "ALL";
  goals: string[];
  drill: string;
  tempoMin: number;
  carga: string;
  justificativa: string;
  referencias: string[];
}

export const volleyballDrills: VolleyballDrill[] = [
  {
    id: "toque_roda_passe_3",
    habilidade: "Toque",
    mvLevel: "MV1",
    goals: ["Fundamentos", "Voleibol"],
    drill: "Roda de passes em 3",
    tempoMin: 8,
    carga: "3 séries de 10 repetições",
    justificativa: "Aumenta contato com a bola e precisão motora",
    referencias: [
      "De Oliveira Castro et al., 2021",
      "Barba-Martin et al., 2020",
      "Menezes-Fagundes et al., 2024",
    ],
  },
  {
    id: "manchete_duplas_alvo",
    habilidade: "Manchete",
    mvLevel: "MV1",
    goals: ["Fundamentos", "Voleibol"],
    drill: "Manchete em duplas com alvo",
    tempoMin: 8,
    carga: "3 séries de 10 repetições",
    justificativa: "Melhora controle e percepção espacial",
    referencias: [
      "De Oliveira Castro et al., 2021",
      "Barba-Martin et al., 2020",
      "Menezes-Fagundes et al., 2024",
    ],
  },
  {
    id: "saque_baixo_alvos_quadra",
    habilidade: "Saque por baixo",
    mvLevel: "MV1",
    goals: ["Fundamentos", "Voleibol"],
    drill: "Saque em alvos na quadra",
    tempoMin: 6,
    carga: "2 séries de 8 repetições",
    justificativa: "Desenvolve coordenação e força inicial",
    referencias: [
      "De Oliveira Castro et al., 2021",
      "Barba-Martin et al., 2020",
      "Menezes-Fagundes et al., 2024",
    ],
  },
  {
    id: "saque_cima_alternado_zonas",
    habilidade: "Saque por cima",
    mvLevel: "MV2",
    goals: ["Fundamentos", "Voleibol"],
    drill: "Saque alternado (zonas)",
    tempoMin: 10,
    carga: "3 séries de 6 repetições",
    justificativa: "Trabalha potência e precisão",
    referencias: ["Rebelo et al., 2025", "Oliveira et al., 2023"],
  },
  {
    id: "ataque_apos_levantamento_lateral",
    habilidade: "Ataque",
    mvLevel: "MV2",
    goals: ["Fundamentos", "Voleibol"],
    drill: "Ataque após levantamento lateral",
    tempoMin: 10,
    carga: "3 séries de 8 repetições",
    justificativa: "Integração técnica e biomecânica",
    referencias: [
      "Hegi et al., 2023",
      "Rebelo et al., 2025",
      "Petancevski et al., 2022",
    ],
  },
  {
    id: "deslocamento_cones_com_bola",
    habilidade: "Deslocamento",
    mvLevel: "ALL",
    goals: ["Fundamentos", "Voleibol"],
    drill: "Circuito de cones com bola",
    tempoMin: 6,
    carga: "3 séries de 5 voltas",
    justificativa: "Melhora agilidade e controle",
    referencias: ["Yilmaz et al., 2024", "Thieschafer & Busch, 2022"],
  },
  {
    id: "bloqueio_duplas_ataque_simulado",
    habilidade: "Bloqueio",
    mvLevel: "MV2",
    goals: ["Fundamentos", "Voleibol"],
    drill: "Bloqueio em duplas com ataque simulado",
    tempoMin: 8,
    carga: "3 séries de 6 repetições",
    justificativa: "Foco em aterrissagem segura e tempo de reação",
    referencias: [
      "Hegi et al., 2023",
      "Rebelo et al., 2025",
      "Petancevski et al., 2022",
    ],
  },
  {
    id: "prevencao_aquecimento_neuromuscular",
    habilidade: "Prevencao de lesao",
    mvLevel: "ALL",
    goals: ["Fundamentos", "Voleibol"],
    drill: "Aquecimento neuromuscular (ex: saltos, equilíbrio)",
    tempoMin: 10,
    carga: "1x por sessão",
    justificativa: "Reduz risco de lesão, melhora propriocepção",
    referencias: ["Hughes et al., 2023", "Lutz et al., 2024", "Caldemeyer et al., 2020"],
  },
];

const includesGoal = (goal: string, target: string) =>
  (goal ?? "").toLowerCase().includes(target.toLowerCase());

const shouldUseVolleyball = (cls: ClassGroup) => {
  if (cls.modality === "voleibol") return true;
  if (cls.modality === "fitness") return false;
  const goal = cls.goal ?? "";
  const unit = cls.unit ?? "";

  if (includesGoal(goal, "voleibol")) return true;
  if (includesGoal(goal, "fundamentos")) {
    return includesGoal(unit, "esperanca") || includesGoal(unit, "pinhais");
  }
  return false;
};

const resolveMvLevel = (cls: ClassGroup): MVLevel => {
  if (cls.mvLevel && cls.mvLevel.trim()) return cls.mvLevel as MVLevel;
  const band = cls.ageBand;
  if (band === "06-08" || band === "08-09" || band === "08-11") return "MV1";
  if (band === "09-11" || band === "10-12" || band === "12-14") return "MV2";
  return "MV3";
};

export function pickVolleyballMain(cls: ClassGroup): string[] | null {
  if (!shouldUseVolleyball(cls)) return null;

  const mv = resolveMvLevel(cls);
  const mvForMatch = mv === "MV3" ? "MV2" : mv;
  const goal = cls.goal ?? "";

  let eligible = volleyballDrills.filter((drill) => {
    const mvOk = drill.mvLevel === "ALL" || drill.mvLevel === mvForMatch;
    const goalOk = drill.goals.some((item) => includesGoal(goal, item));
    return mvOk && goalOk;
  });

  if (eligible.length === 0) {
    eligible = volleyballDrills.filter(
      (drill) => drill.mvLevel === "ALL" || drill.mvLevel === mvForMatch
    );
  }

  if (eligible.length === 0) return null;

  const prevention =
    eligible.find((drill) => drill.habilidade === "Prevencao de lesao") ??
    volleyballDrills.find((drill) => drill.habilidade === "Prevencao de lesao");

  const techPriority =
    mvForMatch === "MV1"
      ? ["Toque", "Manchete", "Saque por baixo"]
      : ["Saque por cima", "Ataque", "Bloqueio"];

  const tech =
    eligible.find((drill) => techPriority.includes(drill.habilidade)) ??
    eligible.find((drill) =>
      [
        "Toque",
        "Manchete",
        "Saque por baixo",
        "Saque por cima",
        "Ataque",
        "Bloqueio",
      ].includes(drill.habilidade)
    );

  const movement =
    eligible.find((drill) => drill.habilidade === "Deslocamento") ??
    volleyballDrills.find((drill) => drill.habilidade === "Deslocamento");

  const main: string[] = [];

  if (prevention) {
    main.push(
      `Prevenção (${prevention.tempoMin}min): ${prevention.drill} - ${prevention.carga}`
    );
    main.push(`Justificativa: ${prevention.justificativa}`);
    main.push(`Referências: ${prevention.referencias.join("; ")}`);
  }

  if (tech) {
    main.push(
      `Técnica - ${tech.habilidade} (${tech.tempoMin}min): ${tech.drill} - ${tech.carga}`
    );
    main.push(`Justificativa: ${tech.justificativa}`);
    main.push(`Referências: ${tech.referencias.join("; ")}`);
  }

  if (movement) {
    main.push(
      `Deslocamento (${movement.tempoMin}min): ${movement.drill} - ${movement.carga}`
    );
    main.push(`Justificativa: ${movement.justificativa}`);
    main.push(`Referências: ${movement.referencias.join("; ")}`);
  }

  main.push("Mini jogo tecnico (15min): jogo reduzido com foco no fundamento do dia");

  return main;
}

