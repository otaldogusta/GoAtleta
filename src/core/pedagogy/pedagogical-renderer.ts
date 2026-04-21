// ─────────────────────────────────────────────────────────────────────────────
// Renderizador pedagógico
//
// Converte NextPedagogicalStep (chaves canônicas) em texto legível
// em português brasileiro, para uso no objetivo da aula, no título
// da semana e em labels de bloco.
//
// Nunca chame este arquivo diretamente do catálogo ou do resolvedor —
// ele é exclusivamente a camada de linguagem.
// ─────────────────────────────────────────────────────────────────────────────

import type { NextPedagogicalStep } from "./pedagogical-types";
import {
    getDisplayLabelForContext,
    getDisplayLabelForGameForm,
    getDisplayLabelForIntensity,
    getDisplayLabelForOrganization,
    getDisplayLabelForSkill,
    getDisplayLabelForTaskStyle,
} from "./volleyball-language-lexicon";

const joinPtBr = (items: string[]) => {
  if (!items.length) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} e ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
};

// Objetivo da aula em uma frase curta no estilo de quadra
export function renderPedagogicalObjective(step: NextPedagogicalStep): string {
  const [first, second] = step.nextStep;

  if (!first) {
    return "Desenvolver a continuidade do jogo de forma adequada à fase da turma.";
  }

  const firstLabel = getDisplayLabelForSkill(first);
  const secondLabel = second ? getDisplayLabelForSkill(second) : null;

  if (secondLabel) {
    return `Avançar em ${firstLabel} e ${secondLabel}, respeitando a fase atual da turma e o jogo reduzido proposto.`;
  }

  return `Avançar em ${firstLabel}, respeitando a fase atual da turma e o jogo reduzido proposto.`;
}

// Forma de jogo exibível (ex.: "Mini 2x2")
export function renderGameFormLabel(step: NextPedagogicalStep): string {
  return getDisplayLabelForGameForm(step.gameForm);
}

// Foco principal da etapa como texto curto para o professor
export function renderStageFocusSummary(step: NextPedagogicalStep): string {
  const gameLabel = getDisplayLabelForGameForm(step.gameForm);
  const stageText = step.currentStage.replace(/_/g, " ");
  return `${stageText} · ${gameLabel}`;
}

// Lista de skills já introduzidas em linguagem de quadra
export function renderAlreadyIntroducedList(step: NextPedagogicalStep): string[] {
  return step.alreadyIntroduced.map((key) => getDisplayLabelForSkill(key));
}

// Próximo passo em linguagem de quadra (primeiros 2 itens)
export function renderNextStepList(step: NextPedagogicalStep): string[] {
  return step.nextStep.slice(0, 2).map((key) => getDisplayLabelForSkill(key));
}

export function renderBlockRecommendationSummary(
  step: NextPedagogicalStep,
  section: "warmup" | "main" | "cooldown"
): string {
  const block = step.blockRecommendations[section];
  const skills = joinPtBr(block.skills.slice(0, 3).map((key) => getDisplayLabelForSkill(key)));
  const contexts = joinPtBr(block.contexts.slice(0, 2).map((key) => getDisplayLabelForContext(key)));
  const organization = getDisplayLabelForOrganization(block.organization);
  const taskStyle = getDisplayLabelForTaskStyle(block.taskStyle);
  const intensity = getDisplayLabelForIntensity(block.intensity);

  if (section === "cooldown") {
    return `${taskStyle} em ${organization}, com intensidade ${intensity}.`;
  }

  const skillPart = skills || "fundamentos da etapa";
  const contextPart = contexts ? `em ${contexts}` : "";
  return `${taskStyle} em ${organization}, trabalhando ${skillPart} ${contextPart}`.replace(/\s+/g, " ").trim() + ".";
}
