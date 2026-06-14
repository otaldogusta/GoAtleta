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
  transicao: "Transicao",
};

export const ageStageLabels: Record<ActivityPatternAgeStage, string> = {
  early: "Iniciacao",
  base: "Base",
  transition: "Transicao",
  formation: "Formacao",
  specialization: "Especializacao",
};

export const phaseLabels: Record<ActivityPatternStage, string> = {
  warmup: "Aquecimento",
  drill: "Desenvolvimento",
  game: "Jogo/aplicacao",
  cooldown: "Volta a calma",
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
  cooperacao: "Cooperacao",
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
  media: "Media",
  alta: "Alta",
};

export const gamePhaseLabels: Record<ActivityCatalogGamePhase, string> = {
  aquecimento_motor: "Aquecimento motor",
  recepcao: "Recepcao",
  saque_recepcao: "Saque e recepcao",
  rally: "Rally",
  sideout: "Sideout",
  transicao: "Transicao",
  defesa_cobertura: "Defesa e cobertura",
  ataque: "Ataque",
  fechamento: "Fechamento",
};

export const pedagogicalIntentLabels: Record<PedagogicalIntent, string> = {
  decision_making: "Tomada de decisao",
  game_reading: "Leitura de jogo",
  team_organization: "Organizacao coletiva",
  technical_adjustment: "Ajuste tecnico",
  pressure_adaptation: "Adaptacao a pressao",
};

export const phaseIntentLabels: Record<PhaseIntent, string> = {
  exploracao_fundamentos: "Exploracao de fundamentos",
  estabilizacao_tecnica: "Estabilizacao tecnica",
  aceleracao_decisao: "Aceleracao da decisao",
  transferencia_jogo: "Transferencia para o jogo",
  pressao_competitiva: "Pressao competitiva",
};

export const progressionLabels: Record<ProgressionDimension, string> = {
  consistencia: "Consistencia",
  precisao: "Precisao",
  pressao_tempo: "Pressao de tempo",
  oposicao: "Oposicao",
  tomada_decisao: "Tomada de decisao",
  transferencia_jogo: "Transferencia para o jogo",
};

export const loadLabels: Record<WeeklyLoadIntent, string> = {
  baixo: "Baixa carga",
  moderado: "Carga moderada",
  alto: "Alta carga",
};
