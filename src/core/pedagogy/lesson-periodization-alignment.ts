import type { ClassPlan, DailyLessonPlan } from "../models";
import type { NextPedagogicalStep, PlanningAlignmentCheck } from "./pedagogical-types";
import { FORBIDDEN_UI_TERMS } from "./volleyball-language-lexicon";

// Re-export so existing imports don't break
export type { PlanningAlignmentCheck };

type PhaseBucket = "exploracao" | "fundamentos" | "aplicacao" | "consolidacao" | "indefinida";
type LoadBucket = "baixa" | "media" | "alta" | "indefinida";
type LessonKind = "introducao" | "pratica_guiada" | "aplicacao" | "revisao" | "mini_jogo";

export type CheckLessonAlignmentWithPeriodizationInput = {
  weeklyPlan: Pick<ClassPlan, "phase" | "theme" | "technicalFocus" | "rpeTarget" | "pedagogicalRule" | "id">;
  sessionDate: string;
  dailyLessonPlan: Pick<DailyLessonPlan, "title" | "warmup" | "mainPart" | "cooldown" | "observations"> & {
    lessonKind?: LessonKind;
  };
  ageBand?: string;
  recentHistory?: Array<Pick<DailyLessonPlan, "date" | "weeklyPlanId" | "generationContextSnapshotJson">>;
  activeCycle?: {
    startDate?: string;
    endDate?: string;
  } | null;
  nextPedagogicalStep?: NextPedagogicalStep | null;
};

const STOP_WORDS = new Set([
  "da",
  "de",
  "do",
  "das",
  "dos",
  "com",
  "para",
  "por",
  "uma",
  "um",
  "que",
  "e",
  "na",
  "no",
  "nas",
  "nos",
  "sobre",
  "entre",
  "aula",
  "semana",
]);

const ADVANCED_TACTICAL_TERMS = [
  "leitura de jogo",
  "leitura do contexto",
  "tomada de decisao",
  "tomada de decisão",
  "sistema tat",
  "sistema tatico",
  "sistema tático",
  "estrateg",
  "contra ataque",
  "contra-ataque",
  "pressao",
  "pressão",
];

const HIGH_INTENSITY_TERMS = [
  "alta intensidade",
  "pressao",
  "pressão",
  "oposicao",
  "oposição",
  "maximo",
  "máximo",
  "competitivo",
  "densidade",
  "sequencia rigida",
  "sequência rígida",
];

const YOUNG_ABSTRACT_TERMS = [
  "leitura do contexto",
  "melhor resposta",
  "resposta ideal",
  "otimizar",
  "estrateg",
  "contexto motor",
  "tomada de decisao",
  "tomada de decisão",
  "execucao imediata",
  "execução imediata",
  "sistema",
  "tatico",
  "tático",
];

const normalizeForCheck = (value: string): string =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const normalizeIsoDate = (value: string | undefined): string => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (isIsoDate(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.slice(0, 10);
  return "";
};

const extractKindsFromRecentHistory = (
  items: Array<Pick<DailyLessonPlan, "date" | "weeklyPlanId" | "generationContextSnapshotJson">> | undefined,
  currentDate: string,
  currentWeekId: string
): LessonKind[] => {
  if (!items?.length) return [];

  return [...items]
    .filter((item) => item.weeklyPlanId !== currentWeekId || item.date !== currentDate)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 4)
    .map((item) => {
      const raw = String(item.generationContextSnapshotJson ?? "");
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as { dailyDecision?: { lessonKind?: string } };
        const kind = parsed?.dailyDecision?.lessonKind;
        if (
          kind === "introducao" ||
          kind === "pratica_guiada" ||
          kind === "aplicacao" ||
          kind === "revisao" ||
          kind === "mini_jogo"
        ) {
          return kind;
        }
        return null;
      } catch {
        return null;
      }
    })
    .filter((item): item is LessonKind => Boolean(item));
};

const resolvePhaseBucket = (weeklyPlan: CheckLessonAlignmentWithPeriodizationInput["weeklyPlan"]): PhaseBucket => {
  const text = normalizeForCheck(
    [weeklyPlan.phase, weeklyPlan.theme, weeklyPlan.pedagogicalRule].filter(Boolean).join(" ")
  );

  if (/(explor|adapt|inic|primeiro contato)/.test(text)) return "exploracao";
  if (/(fundament|base)/.test(text)) return "fundamentos";
  if (/(aplic|transfer|jogo reduzido|mini jogo|mini-jogo)/.test(text)) return "aplicacao";
  if (/(consolid|revis|fixa|estabil)/.test(text)) return "consolidacao";
  return "indefinida";
};

const parseRpeValue = (rpeTarget: string | undefined): number | null => {
  const text = String(rpeTarget ?? "").trim();
  if (!text) return null;

  const values = (text.match(/\d+(?:[\.,]\d+)?/g) ?? [])
    .map((item) => Number(item.replace(",", ".")))
    .filter((item) => Number.isFinite(item));

  if (!values.length) return null;
  const sum = values.reduce((acc, item) => acc + item, 0);
  return sum / values.length;
};

const resolveLoadBucket = (rpeTarget: string | undefined): LoadBucket => {
  const value = parseRpeValue(rpeTarget);
  if (value === null) return "indefinida";
  if (value <= 4) return "baixa";
  if (value <= 6) return "media";
  return "alta";
};

const isYoungAgeBand = (ageBand: string | undefined): boolean => {
  const text = normalizeForCheck(ageBand ?? "");
  if (!text) return false;

  if (/(sub\s*-?\s*0?9|0?7\s*[-/]\s*0?9)/.test(text)) return true;

  const nums = (text.match(/\d{1,2}/g) ?? [])
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));

  return nums.some((item) => item >= 7 && item <= 9);
};

const hasAnyTerm = (text: string, terms: string[]) => {
  const normalized = normalizeForCheck(text);
  return terms.some((term) => normalized.includes(normalizeForCheck(term)));
};

const words = (text: string) =>
  normalizeForCheck(text)
    .split(/[^a-z0-9]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 4 && !STOP_WORDS.has(item));

const overlapCount = (left: string[], right: string[]) => {
  const rightSet = new Set(right);
  return left.filter((item) => rightSet.has(item)).length;
};

const averageWordsPerSentence = (text: string): number => {
  const sentences = String(text ?? "")
    .split(/[.!?]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (!sentences.length) return 0;

  const totalWords = sentences
    .map((sentenceText) => sentenceText.split(/\s+/).filter(Boolean).length)
    .reduce((acc, value) => acc + value, 0);

  return totalWords / sentences.length;
};

export const checkLessonAlignmentWithPeriodization = (
  input: CheckLessonAlignmentWithPeriodizationInput
): PlanningAlignmentCheck => {
  const notes: string[] = [];

  const cycleStart = normalizeIsoDate(input.activeCycle?.startDate);
  const cycleEnd = normalizeIsoDate(input.activeCycle?.endDate);
  const sessionDate = normalizeIsoDate(input.sessionDate);

  const cycleWindowAligned =
    !cycleStart || !cycleEnd || !sessionDate || (sessionDate >= cycleStart && sessionDate <= cycleEnd);
  if (!cycleWindowAligned) {
    notes.push("A data da aula ficou fora da janela ativa do ciclo.");
  }

  const phaseBucket = resolvePhaseBucket(input.weeklyPlan);
  const fullLessonText = [
    input.dailyLessonPlan.title,
    input.dailyLessonPlan.warmup,
    input.dailyLessonPlan.mainPart,
    input.dailyLessonPlan.cooldown,
    input.dailyLessonPlan.observations,
  ]
    .filter(Boolean)
    .join(" ");

  const expectedKindsByPhase: Record<Exclude<PhaseBucket, "indefinida">, LessonKind[]> = {
    exploracao: ["introducao", "pratica_guiada", "revisao"],
    fundamentos: ["introducao", "pratica_guiada", "revisao"],
    aplicacao: ["aplicacao", "mini_jogo"],
    consolidacao: ["revisao", "aplicacao", "mini_jogo"],
  };

  let phaseAligned = true;
  if (phaseBucket !== "indefinida" && input.dailyLessonPlan.lessonKind) {
    phaseAligned = expectedKindsByPhase[phaseBucket].includes(input.dailyLessonPlan.lessonKind);
    if (!phaseAligned) {
      notes.push(`A fase da semana sugere ${expectedKindsByPhase[phaseBucket].join("/")}, mas a aula saiu em ${input.dailyLessonPlan.lessonKind}.`);
    }
  }

  const phaseHasAdvancedJargon =
    (phaseBucket === "exploracao" || phaseBucket === "fundamentos") &&
    hasAnyTerm(fullLessonText, ADVANCED_TACTICAL_TERMS);
  if (phaseHasAdvancedJargon) {
    phaseAligned = false;
    notes.push("A fase inicial/fundamentos recebeu linguagem tática avançada.");
  }

  const hasForbiddenUiTerm = hasAnyTerm(fullLessonText, FORBIDDEN_UI_TERMS);
  if (hasForbiddenUiTerm) {
    phaseAligned = false;
    notes.push("A aula contém termos proibidos para exibição (origem metodológica estrangeira). Use linguagem operacional de vôlei em PT-BR.");
  }

  const weeklyFocusSource = [input.weeklyPlan.technicalFocus, input.weeklyPlan.theme]
    .filter(Boolean)
    .join(" ");
  const weeklyFocusAligned =
    !weeklyFocusSource.trim() || overlapCount(words(weeklyFocusSource), words(fullLessonText)) >= 1;
  if (!weeklyFocusAligned) {
    notes.push("O foco técnico da semana não apareceu de forma concreta no texto da aula.");
  }

  const loadBucket = resolveLoadBucket(input.weeklyPlan.rpeTarget);
  const hasHighLoadMarkers = hasAnyTerm(fullLessonText, HIGH_INTENSITY_TERMS);
  const loadAligned =
    loadBucket === "indefinida"
      ? true
      : loadBucket === "baixa"
        ? !hasHighLoadMarkers && input.dailyLessonPlan.lessonKind !== "aplicacao"
        : loadBucket === "media"
          ? true
          : hasHighLoadMarkers || input.dailyLessonPlan.lessonKind === "aplicacao" || input.dailyLessonPlan.lessonKind === "mini_jogo";

  if (!loadAligned) {
    notes.push("A exigência da aula não combina com a carga/PSE da semana.");
  }

  const youngAgeBand = isYoungAgeBand(input.ageBand);
  const hasYoungAbstractTerms = youngAgeBand && hasAnyTerm(fullLessonText, YOUNG_ABSTRACT_TERMS);
  const hasOverComplexSentences = youngAgeBand && averageWordsPerSentence(fullLessonText) > 18;
  const ageBandAligned = !youngAgeBand || (!hasYoungAbstractTerms && !hasOverComplexSentences);

  if (!ageBandAligned) {
    notes.push("Para 07-09, a linguagem ficou abstrata ou com frases longas demais.");
  }

  const recentKinds = extractKindsFromRecentHistory(
    input.recentHistory,
    sessionDate,
    input.weeklyPlan.id
  );
  const repeatsSameKindTooMuch =
    Boolean(input.dailyLessonPlan.lessonKind) &&
    recentKinds.length >= 2 &&
    recentKinds[0] === input.dailyLessonPlan.lessonKind &&
    recentKinds[1] === input.dailyLessonPlan.lessonKind;
  const historyAligned = !repeatsSameKindTooMuch;

  if (!historyAligned) {
    notes.push("A aula repetiu o mesmo tipo das últimas sessões e perdeu progressão histórica.");
  }

  // Dimensão extra: coerência com o próximo passo pedagógico do catálogo
  let pedagogicalStepAligned = true;
  if (input.nextPedagogicalStep) {
    const nextStepText = input.nextPedagogicalStep.nextStep
      .map((key) => key.split("_").join(" "))
      .join(" ");
    const hasStepOverlap = nextStepText
      .split(" ")
      .filter((w) => w.length >= 4)
      .some((word) => normalizeForCheck(fullLessonText).includes(word));
    if (!hasStepOverlap && input.nextPedagogicalStep.nextStep.length > 0) {
      pedagogicalStepAligned = false;
      notes.push("A aula não reflete claramente o próximo passo pedagógico esperado para a etapa da turma.");
    }
  }

  const scoreItems = [
    phaseAligned,
    weeklyFocusAligned,
    loadAligned,
    ageBandAligned,
    historyAligned,
    pedagogicalStepAligned,
  ];
  const score = scoreItems.filter(Boolean).length;
  const classification: PlanningAlignmentCheck["classification"] =
    score <= 2 ? "baixo" : score <= 4 ? "parcial" : score === 5 ? "bom" : "forte";

  return {
    cycleWindowAligned,
    phaseAligned,
    weeklyFocusAligned,
    loadAligned,
    ageBandAligned,
    historyAligned,
    score,
    classification,
    notes,
  };
};
