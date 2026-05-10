import type { MediaGenerationRequest } from "../../media-generation.types";

function quote(value: string | undefined, fallback: string): string {
  const normalized = String(value ?? "").trim();
  return normalized ? `"${normalized}"` : fallback;
}

const SAFETY_SUFFIX =
  "Nao decidir treino, nao prescrever carga, nao definir series, nao alterar progressao e nao interferir na pedagogia aprovada pelo GoAtleta.";

export function buildExerciseVideoPrompt(request: MediaGenerationRequest): string {
  return [
    `Gerar um video curto e claro de demonstracao visual do exercicio ${quote(
      request.exerciseName ?? request.exerciseKey,
      '"exercicio aprovado"',
    )}.`,
    "Mostrar execucao visual limpa, enquadramento util para professor/aluno e foco no movimento.",
    SAFETY_SUFFIX,
  ].join(" ");
}

export function buildExerciseImagePrompt(request: MediaGenerationRequest): string {
  return [
    `Gerar uma imagem de demonstracao do exercicio ${quote(
      request.exerciseName ?? request.exerciseKey,
      '"exercicio aprovado"',
    )}.`,
    "Priorizar postura clara, enquadramento objetivo e leitura facil do movimento.",
    SAFETY_SUFFIX,
  ].join(" ");
}

export function buildCoachAvatarPrompt(request: MediaGenerationRequest): string {
  return [
    `Gerar um asset visual de avatar para o professor ${quote(request.title ?? request.coachId, '"professor"')}.`,
    "Priorizar identidade visual consistente e uso institucional do app.",
    "Nao gerar treino, nao sugerir carga e nao alterar conteudo pedagógico.",
  ].join(" ");
}

export function buildMarketingCardPrompt(request: MediaGenerationRequest): string {
  return [
    `Gerar um card de marketing para a campanha ${quote(
      request.title ?? request.campaignKey,
      '"campanha"',
    )}.`,
    "Priorizar composicao limpa, leitura rapida e aplicacao em canais institucionais.",
    "Nao decidir treino, nao prescrever carga e nao alterar o planejamento aprovado.",
  ].join(" ");
}
