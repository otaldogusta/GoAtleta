// ─────────────────────────────────────────────────────────────────────────────
// Resolvedor do próximo passo pedagógico da periodização
//
// Entrada: ageBand canônico + mês + sinais de histórico e overrides do professor
// Saída:   NextPedagogicalStep — objeto de domínio sem termos estrangeiros
//
// Este módulo é a fonte primária de decisão pedagógica para o gerador
// diário e semanal. Não deve conter texto exibível — apenas chaves canônicas.
// A renderização em linguagem de quadra é responsabilidade do pedagogical-renderer.ts
// ─────────────────────────────────────────────────────────────────────────────

import { PEDAGOGICAL_PROGRESSION_CATALOG } from "./pedagogical-progression-catalog";
import type {
    AgeBandKey,
    NextPedagogicalStep,
    PedagogicalProgressionStage,
} from "./pedagogical-types";

export type ResolveNextPedagogicalStepInput = {
  ageBand: AgeBandKey;
  monthIndex: number;
  recentConfirmedSkills?: string[];
  teacherOverrides?: string[];
};

// Resolve o ageBand canônico a partir do texto livre do ClassGroup
export function normalizeAgeBandKey(ageBand: string): AgeBandKey | null {
  const text = String(ageBand ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s/g, "");

  if (/06[-/]07|sub[-_]?07|sub[-_]?06/.test(text)) return "06-07";
  if (/08[-/]10|08[-/]11|07[-/]09|sub[-_]?09|sub[-_]?10|sub[-_]?11/.test(text)) return "08-10";
  if (/11[-/]12|sub[-_]?12/.test(text)) return "11-12";
  if (/13[-/]14|sub[-_]?13|sub[-_]?14/.test(text)) return "13-14";

  const nums = (text.match(/\d{1,2}/g) ?? []).map(Number).filter((n) => n >= 6 && n <= 16);
  if (!nums.length) return null;
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  if (avg <= 7.5) return "06-07";
  if (avg <= 10.5) return "08-10";
  if (avg <= 12.5) return "11-12";
  return "13-14";
}

function pickBestStage(input: ResolveNextPedagogicalStepInput): PedagogicalProgressionStage | null {
  const candidates = PEDAGOGICAL_PROGRESSION_CATALOG.filter(
    (item) => item.ageBand === input.ageBand && item.monthIndex === input.monthIndex
  );
  if (!candidates.length) {
    // Fallback: mês mais recente disponível para essa faixa
    const byAge = PEDAGOGICAL_PROGRESSION_CATALOG.filter((item) => item.ageBand === input.ageBand);
    if (!byAge.length) return null;
    const sorted = [...byAge].sort((a, b) => {
      const monthDiff = Math.abs(a.monthIndex - input.monthIndex) - Math.abs(b.monthIndex - input.monthIndex);
      if (monthDiff !== 0) return monthDiff;
      return a.sequenceIndex - b.sequenceIndex;
    });
    return sorted[0] ?? null;
  }
  return candidates.sort((a, b) => a.sequenceIndex - b.sequenceIndex)[0] ?? null;
}

export function resolveNextPedagogicalStepFromPeriodization(
  input: ResolveNextPedagogicalStepInput
): NextPedagogicalStep | null {
  const stage = pickBestStage(input);
  if (!stage) return null;

  const constraints = [
    ...stage.pedagogicalConstraints,
    ...(input.teacherOverrides ?? []).filter(Boolean),
  ];

  return {
    currentStage: stage.stageLabel,
    gameForm: stage.gameForm,
    complexityLevel: stage.complexityLevel,
    alreadyIntroduced: [...stage.alreadyIntroduced],
    alreadyPracticedContexts: [...stage.alreadyPracticedContexts],
    nextStep: [...stage.nextStep],
    pedagogicalConstraints: [...new Set(constraints)],
    blockRecommendations: {
      warmup: [...stage.blockRecommendations.warmup],
      main: [...stage.blockRecommendations.main],
      cooldown: [...stage.blockRecommendations.cooldown],
    },
    sourceTrail: [
      {
        methodology: stage.source.methodology,
        sourceLabel: stage.source.sourceLabel,
        sourceRef: stage.source.sourceRef,
      },
    ],
  };
}
