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
    CanonicalContextKey,
    CanonicalSkillKey,
    NextPedagogicalStep,
    PedagogicalProgressionStage,
} from "./pedagogical-types";

export type ResolveNextPedagogicalStepInput = {
  ageBand: AgeBandKey;
  monthIndex: number;
  recentConfirmedSkills?: string[];
  recentContexts?: string[];
  teacherOverrides?: string[];
  historicalConfidence?: number;
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
  const orderedCandidates = [...candidates].sort((a, b) => a.sequenceIndex - b.sequenceIndex);
  const normalizedOverrides = (input.teacherOverrides ?? []).join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const confirmedSkills = new Set((input.recentConfirmedSkills ?? []).map((item) => item as CanonicalSkillKey));
  const recentContexts = new Set((input.recentContexts ?? []).map((item) => item as CanonicalContextKey));
  const confidence = Number.isFinite(input.historicalConfidence) ? Math.max(0, Math.min(1, Number(input.historicalConfidence))) : 0.5;

  const holdBack = /(segurar|retomar|revisar|rever|voltar|manter simples)/.test(normalizedOverrides);
  const pushForward = /(avancar|avançar|progredir|subir|autonomia|mais desafio)/.test(normalizedOverrides);
  const hasHistorySignals = confirmedSkills.size > 0 || recentContexts.size > 0;

  if (holdBack) {
    return orderedCandidates[0] ?? null;
  }

  if (!hasHistorySignals && !pushForward) {
    return orderedCandidates[0] ?? null;
  }

  const scored = orderedCandidates.map((stage) => {
    let score = 0;
    score += stage.alreadyIntroduced.filter((item) => confirmedSkills.has(item)).length * 4;
    score += stage.alreadyPracticedContexts.filter((item) => recentContexts.has(item)).length * 2;
    score += stage.sequenceIndex * confidence;

    if (pushForward) {
      score += stage.sequenceIndex * 3;
    }

    return { stage, score };
  });

  scored.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return left.stage.sequenceIndex - right.stage.sequenceIndex;
  });

  return scored[0]?.stage ?? null;
}

export function resolveNextPedagogicalStepFromPeriodization(
  input: ResolveNextPedagogicalStepInput
): NextPedagogicalStep | null {
  const stage = pickBestStage(input);
  if (!stage) return null;

  const monthStageCount = PEDAGOGICAL_PROGRESSION_CATALOG.filter(
    (item) => item.ageBand === stage.ageBand && item.monthIndex === stage.monthIndex
  ).length;

  const constraints = [
    ...stage.pedagogicalConstraints,
    ...(input.teacherOverrides ?? []).filter(Boolean),
  ];

  const selectionReason = (input.recentConfirmedSkills?.length || input.recentContexts?.length)
    ? "stage escolhido pelo histórico recente dentro do mês"
    : "stage base do mês selecionado";

  return {
    stageId: stage.id,
    sequenceIndex: stage.sequenceIndex,
    monthStageCount,
    currentStage: stage.stageLabel,
    gameForm: stage.gameForm,
    complexityLevel: stage.complexityLevel,
    alreadyIntroduced: [...stage.alreadyIntroduced],
    alreadyPracticedContexts: [...stage.alreadyPracticedContexts],
    nextStep: [...stage.nextStep],
    pedagogicalConstraints: [...new Set(constraints)],
    blockRecommendations: {
      warmup: {
        ...stage.blockRecommendations.warmup,
        skills: [...stage.blockRecommendations.warmup.skills],
        contexts: [...stage.blockRecommendations.warmup.contexts],
      },
      main: {
        ...stage.blockRecommendations.main,
        skills: [...stage.blockRecommendations.main.skills],
        contexts: [...stage.blockRecommendations.main.contexts],
      },
      cooldown: {
        ...stage.blockRecommendations.cooldown,
        skills: [...stage.blockRecommendations.cooldown.skills],
        contexts: [...stage.blockRecommendations.cooldown.contexts],
      },
    },
    selectionReason,
    sourceTrail: [
      {
        methodology: stage.source.methodology,
        sourceLabel: stage.source.sourceLabel,
        sourceRef: stage.source.sourceRef,
      },
    ],
  };
}
