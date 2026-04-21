import { renderGameFormLabel, renderNextStepList } from "./pedagogical-renderer";
import type { AgeBandKey, ComplexityLevel, NextPedagogicalStep } from "./pedagogical-types";
import { resolveNextPedagogicalStepFromPeriodization } from "./resolve-next-pedagogical-step-from-periodization";

export type PedagogicalQuarterKey = "Q1" | "Q2" | "Q3" | "Q4";

export type PedagogicalQuarterlyIndicator = {
  quarter: PedagogicalQuarterKey;
  monthIndex: number;
  gameForm: NextPedagogicalStep["gameForm"];
  gameFormLabel: string;
  complexityLevel: ComplexityLevel;
  stageLabel: string;
  focusSkills: string[];
  pedagogicalFocus: string;
  closingType: "exploracao" | "consolidacao" | "aplicacao" | "fechamento";
  driftRisks: string[];
};

export const PEDAGOGICAL_QUARTER_MONTH_INDEX: Record<PedagogicalQuarterKey, number> = {
  Q1: 1,
  Q2: 5,
  Q3: 9,
  Q4: 12,
};

const detectClosingType = (step: NextPedagogicalStep): PedagogicalQuarterlyIndicator["closingType"] => {
  const text = [step.currentStage, ...step.pedagogicalConstraints].join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (/(fech|encerr|revis|integr)/.test(text)) return "fechamento";
  if (/(aplic|transi|cobertura|jogo)/.test(text)) return "aplicacao";
  if (/(consolid|continuidade|estabilidade|autonomia)/.test(text)) return "consolidacao";
  return "exploracao";
};

const detectDriftRisks = (ageBand: AgeBandKey, step: NextPedagogicalStep): string[] => {
  const risks: string[] = [];
  const mergedText = [step.currentStage, ...step.pedagogicalConstraints].join(" ").toLowerCase();

  if (step.gameForm === "formal_6x6") {
    risks.push("salto_para_formal_6x6");
  }

  if (ageBand === "08-10" && step.nextStep.some((item) => item === "attack_arm_intro" || item === "block_marking_intro")) {
    risks.push("complexidade_alta_precoce_08_10");
  }

  if (ageBand === "11-12" && /adult/.test(mergedText)) {
    risks.push("linguagem_adulta_precoce_11_12");
  }

  if (ageBand === "13-14" && step.gameForm !== "mini_4x4") {
    risks.push("perda_da_ponte_funcional_13_14");
  }

  return risks;
};

const buildQuarterIndicator = (ageBand: AgeBandKey, quarter: PedagogicalQuarterKey): PedagogicalQuarterlyIndicator | null => {
  const monthIndex = PEDAGOGICAL_QUARTER_MONTH_INDEX[quarter];
  const step = resolveNextPedagogicalStepFromPeriodization({ ageBand, monthIndex });
  if (!step) return null;

  return {
    quarter,
    monthIndex,
    gameForm: step.gameForm,
    gameFormLabel: renderGameFormLabel(step),
    complexityLevel: step.complexityLevel,
    stageLabel: step.currentStage,
    focusSkills: renderNextStepList(step),
    pedagogicalFocus: step.selectionReason,
    closingType: detectClosingType(step),
    driftRisks: detectDriftRisks(ageBand, step),
  };
};

export const buildPedagogicalQuarterlyMatrix = (ageBand: AgeBandKey): PedagogicalQuarterlyIndicator[] => {
  const rows = (Object.keys(PEDAGOGICAL_QUARTER_MONTH_INDEX) as PedagogicalQuarterKey[])
    .map((quarter) => buildQuarterIndicator(ageBand, quarter))
    .filter((item): item is PedagogicalQuarterlyIndicator => Boolean(item));

  return rows;
};
