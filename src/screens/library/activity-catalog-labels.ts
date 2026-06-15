import type {
  PedagogicalIntent,
  PhaseIntent,
  ProgressionDimension,
  VolleyballSkill,
  WeeklyLoadIntent,
} from "../../core/models";
import type {
  ActivityCatalogComplexity,
  ActivityCatalogDemand,
  ActivityCatalogEnvironment,
  ActivityCatalogFormat,
  ActivityCatalogGamePhase,
} from "../../core/volleyball/activity-catalog";
import type {
  ActivityPatternAgeStage,
  ActivityPatternStage,
} from "../../core/volleyball/activity-pattern-engine";

export const skillLabels: Record<VolleyballSkill, string> = {
  passe: "Passe",
  levantamento: "Levantamento",
  ataque: "Ataque",
  bloqueio: "Bloqueio",
  defesa: "Defesa",
  saque: "Saque",
  transicao: "Transição",
};

export const ageStageLabels: Record<ActivityPatternAgeStage, string> = {
  early: "Iniciação",
  base: "Base",
  transition: "Transição",
  formation: "Formação",
  specialization: "Especialização",
};

export const phaseLabels: Record<ActivityPatternStage, string> = {
  warmup: "Aquecimento",
  drill: "Desenvolvimento",
  game: "Jogo/aplicação",
  cooldown: "Volta à calma",
};

export const complexityLabels: Record<ActivityCatalogComplexity, string> = {
  baixa: "Baixa",
  moderada: "Moderada",
  alta: "Alta",
};

export const formatLabels: Record<ActivityCatalogFormat, string> = {
  individual: "Individual",
  dupla: "Dupla",
  trio: "Trio",
  cooperacao: "Cooperação",
  jogo_reduzido: "Jogo reduzido",
  jogo_aplicado: "Jogo aplicado",
};

export const environmentLabels: Record<ActivityCatalogEnvironment, string> = {
  quadra: "Quadra",
  casa: "Casa",
  praia: "Praia",
  qualquer: "Qualquer ambiente",
};

export const demandLabels: Record<ActivityCatalogDemand, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

export const gamePhaseLabels: Record<ActivityCatalogGamePhase, string> = {
  aquecimento_motor: "Aquecimento motor",
  recepcao: "Recepção",
  saque_recepcao: "Saque e recepção",
  rally: "Rally",
  sideout: "Sideout",
  transicao: "Transição",
  defesa_cobertura: "Defesa e cobertura",
  ataque: "Ataque",
  fechamento: "Fechamento",
};

export const pedagogicalIntentLabels: Record<PedagogicalIntent, string> = {
  decision_making: "Tomada de decisão",
  game_reading: "Leitura de jogo",
  team_organization: "Organização coletiva",
  technical_adjustment: "Ajuste técnico",
  pressure_adaptation: "Adaptação à pressão",
};

export const phaseIntentLabels: Record<PhaseIntent, string> = {
  exploracao_fundamentos: "Exploração de fundamentos",
  estabilizacao_tecnica: "Estabilização técnica",
  aceleracao_decisao: "Aceleração da decisão",
  transferencia_jogo: "Transferência para o jogo",
  pressao_competitiva: "Pressão competitiva",
};

export const progressionLabels: Record<ProgressionDimension, string> = {
  consistencia: "Consistência",
  precisao: "Precisão",
  pressao_tempo: "Pressão de tempo",
  oposicao: "Oposição",
  tomada_decisao: "Tomada de decisão",
  transferencia_jogo: "Transferência para o jogo",
};

export const loadLabels: Record<WeeklyLoadIntent, string> = {
  baixo: "Baixa carga",
  moderado: "Carga moderada",
  alto: "Alta carga",
};

export const familyLabels: Record<string, string> = {
  continuidade_tres_contatos: "Continuidade",
  troca_continua_tarefa_dupla: "Troca contínua",
  sideout_saque_recepcao: "Sideout",
  defesa_cobertura_fora_sistema: "Defesa e cobertura",
  ataque_transicao_zona_livre: "Ataque à zona livre",
  forca_preventiva_integrada: "Força preventiva",
};

const humanizeCatalogLabel = (value: string) =>
  value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export const getActivityCatalogFamilyLabel = (familyId: string, fallback: string) =>
  familyLabels[familyId] ?? (fallback || humanizeCatalogLabel(familyId));
