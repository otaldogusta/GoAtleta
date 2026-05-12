import type { EvidenceSource } from "./types";

export const evidenceSources: EvidenceSource[] = [
  {
    id: "internal_training_principles_review",
    title: "Revisao interna: principios de treinamento e carga",
    type: "internal_review",
    notes: "Fonte interna do GoAtleta. Requer futura vinculacao a referencias bibliograficas formais.",
    reviewRequired: true,
  },
  {
    id: "internal_youth_safety_review",
    title: "Revisao interna: seguranca e progressao em jovens atletas",
    type: "internal_review",
    notes: "Fonte interna do GoAtleta. Requer futura vinculacao a referencias bibliograficas formais.",
    reviewRequired: true,
  },
  {
    id: "internal_match_context_review",
    title: "Revisao interna: contexto competitivo e microciclo",
    type: "internal_review",
    notes: "Fonte interna do GoAtleta. Requer futura vinculacao a referencias bibliograficas formais.",
    reviewRequired: true,
  },
  {
    id: "internal_scouting_operational_review",
    title: "Revisao interna: scouting como sinal operacional de treino",
    type: "internal_review",
    notes: "Fonte interna do GoAtleta. Requer futura vinculacao a referencias bibliograficas formais.",
    reviewRequired: true,
  },
  {
    id: "pending_periodization_reference",
    title: "Referencia pendente: periodizacao e microciclo em esporte coletivo",
    type: "pending_reference",
    notes: "Referencia bibliografica ainda nao revisada no projeto.",
    reviewRequired: true,
  },
  {
    id: "pending_motor_learning_reference",
    title: "Referencia pendente: aprendizagem motora e tarefas representativas",
    type: "pending_reference",
    notes: "Referencia bibliografica ainda nao revisada no projeto.",
    reviewRequired: true,
  },
  {
    id: "pending_youth_development_reference",
    title: "Referencia pendente: desenvolvimento esportivo de jovens",
    type: "pending_reference",
    notes: "Referencia bibliografica ainda nao revisada no projeto.",
    reviewRequired: true,
  },
  {
    id: "pending_load_monitoring_reference",
    title: "Referencia pendente: monitoramento de carga e resposta",
    type: "pending_reference",
    notes: "Referencia bibliografica ainda nao revisada no projeto.",
    reviewRequired: true,
  },
];
