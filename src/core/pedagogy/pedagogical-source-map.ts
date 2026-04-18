// ─────────────────────────────────────────────────────────────────────────────
// Mapa de fontes metodológicas
//
// Documenta de onde cada trilha pedagógica foi extraída.
// Os dados aqui são para rastreabilidade interna — não aparecem na UI.
// ─────────────────────────────────────────────────────────────────────────────

import type { SourceMethodology } from "./pedagogical-types";

export type PedagogicalSourceEntry = {
  label: string;
  notes: string;
  ageBands?: string;
};

export const PEDAGOGICAL_SOURCE_MAP: Record<SourceMethodology, PedagogicalSourceEntry> = {
  rede_esperanca: {
    label: "Rede Esperança / escolinha",
    notes: "Microprogressão prática local por mês, base da trilha 08-10",
    ageBands: "08-10",
  },
  cmv_nederland: {
    label: "CMV Nederland (6-7, 8-10, 11-12)",
    notes:
      "Controle inicial, lançar/pegar, toque, saque, continuidade e CMV níveis iniciais até 'keer spelen'. " +
      "Nomenclatura estrangeira não deve vazar para a UI.",
    ageBands: "06-07, 08-10, 11-12",
  },
  instituto_compartilhar: {
    label: "Instituto Compartilhar — Mini 2x2, 3x3, 4x4",
    notes:
      "Mini 2x2 como início ideal da metodologia (08-10, lúdico, fundamentos). " +
      "Mini 3x3 para 11-12 com evolução dos fundamentos, cooperação e organização. " +
      "Mini 4x4 como transição para o vôlei formal (13 anos).",
    ageBands: "08-10, 11-12, 13-14",
  },
  ltad: {
    label: "LTAD / LTD — Desenvolvimento de Longo Prazo do Atleta",
    notes:
      "Princípios de periodização e desenvolvimento por fase biológica. " +
      "Orienta complexidade e carga por categoria.",
  },
  drill_library: {
    label: "Biblioteca de drills e exercícios internos",
    notes: "Drills catalogados manualmente pelo app. Fonte complementar.",
  },
};
