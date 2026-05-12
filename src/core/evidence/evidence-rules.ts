import type { EvidenceRule } from "./types";

export const evidenceRules: EvidenceRule[] = [
  {
    id: "pre_match_reduce_density",
    label: "Reduzir densidade pre-jogo",
    type: "evidence_informed",
    domain: ["match_context", "training_load", "recovery"],
    confidence: "medium",
    appliesWhen: ["match_in_24h", "planning_mode_pre_match"],
    recommendation:
      "Em contexto pre-jogo, reduzir densidade/volume desnecessario e priorizar organizacao coletiva, comunicacao e clareza tatica.",
    rationale:
      "Sessoes proximas ao jogo devem preservar disponibilidade, reduzir fadiga residual e reforcar decisoes relevantes para o contexto competitivo.",
    limitations: [
      "Nao significa ausencia de intensidade.",
      "Pode haver estimulos moderados e tarefas representativas, desde que controlados.",
    ],
    sourceIds: ["internal_match_context_review", "pending_periodization_reference"],
    tags: ["pre_match", "load", "microcycle"],
  },
  {
    id: "post_match_recovery_bias",
    label: "Priorizar recuperacao pos-jogo",
    type: "evidence_informed",
    domain: ["recovery", "training_load", "match_context"],
    confidence: "medium",
    appliesWhen: ["recent_match", "planning_mode_post_match"],
    recommendation:
      "Apos jogo recente, considerar recuperacao ativa, revisao tecnica e reducao de densidade caso haja sinais de fadiga ou alta carga competitiva.",
    rationale:
      "O pos-jogo deve considerar fadiga, recuperacao e consolidacao dos aprendizados do jogo.",
    limitations: [
      "Nao deve impedir treino tecnico leve/moderado quando a equipe esta recuperada.",
    ],
    sourceIds: ["internal_match_context_review", "internal_training_principles_review"],
    tags: ["post_match", "recovery"],
  },
  {
    id: "youth_load_ceiling_not_low_lock",
    label: "Idade como teto de seguranca, nao bloqueio de carga",
    type: "safety_guard",
    domain: ["youth_development", "training_load", "safety"],
    confidence: "medium",
    appliesWhen: ["youth_class", "age_7_9"],
    recommendation:
      "Para criancas, usar a idade como teto de seguranca e ajuste de complexidade, nao como bloqueio automatico para carga sempre baixa.",
    rationale:
      "Atletas jovens podem realizar tarefas moderadas, ludicas, representativas e seguras. O controle deve ocorrer por volume, densidade, complexidade e recuperacao.",
    limitations: [
      "Evitar carga alta como padrao.",
      "Evitar fadiga excessiva e tarefas adultizadas.",
      "Considerar maturacao, seguranca e contexto pedagogico.",
    ],
    sourceIds: ["internal_youth_safety_review", "pending_youth_development_reference"],
    tags: ["youth", "load", "safety"],
  },
  {
    id: "small_sample_no_strong_scouting_impact",
    label: "Nao gerar impacto forte com amostra pequena",
    type: "operational_heuristic",
    domain: ["scouting", "safety"],
    confidence: "medium",
    appliesWhen: ["scouting_sample_small"],
    recommendation: "Nao gerar impacto forte de scouting com amostra pequena.",
    rationale:
      "Poucas acoes podem representar ruido, contexto momentaneo ou erro de marcacao. O sistema deve evitar conclusoes fortes sem recorrencia suficiente.",
    limitations: [
      "Pode indicar observacao preliminar, mas nao deve alterar fortemente a periodizacao.",
    ],
    sourceIds: ["internal_scouting_operational_review"],
    tags: ["scouting", "sample_size"],
  },
  {
    id: "scouting_weakness_influences_focus_not_cycle",
    label: "Scouting influencia foco, nao sequestra ciclo",
    type: "operational_heuristic",
    domain: ["scouting", "periodization"],
    confidence: "medium",
    appliesWhen: ["recent_scouting_weakness"],
    recommendation:
      "Fraquezas de scouting devem influenciar focos e tarefas da semana, sem sequestrar todo o ciclo planejado.",
    rationale:
      "O scouting deve ajustar prioridades, mas a periodizacao precisa preservar progressao, fase do ciclo e objetivo pedagogico.",
    limitations: [
      "Nao transformar toda semana em reacao a um unico jogo.",
      "Limitar a 2 ou 3 sinais dominantes.",
    ],
    sourceIds: ["internal_scouting_operational_review", "internal_training_principles_review"],
    tags: ["scouting", "periodization", "focus"],
  },
  {
    id: "manual_override_preserves_teacher_decision",
    label: "Preservar decisao manual do professor",
    type: "product_decision",
    domain: ["coach_override", "sport_pedagogy"],
    confidence: "high",
    appliesWhen: ["manual_override"],
    recommendation:
      "Quando o professor edita ou fixa um plano manualmente, o sistema deve preservar essa decisao e apresentar sinais como recomendacao, nao sobrescrever.",
    rationale:
      "O treinador e responsavel pelo contexto real da turma. O sistema deve apoiar a decisao, nao substituir a autoridade pedagogica.",
    limitations: ["Pode alertar sobre risco, mas nao deve sobrescrever automaticamente."],
    sourceIds: ["internal_training_principles_review"],
    tags: ["override", "teacher_decision"],
  },
  {
    id: "load_monitoring_signal_not_oracle",
    label: "Carga como sinal, nao oraculo",
    type: "safety_guard",
    domain: ["training_load", "safety"],
    confidence: "medium",
    appliesWhen: ["load_monitoring"],
    recommendation:
      "Indicadores de carga devem ser tratados como sinais de decisao, nao como regras absolutas.",
    rationale:
      "Carga, PSE e indicadores derivados precisam ser interpretados com contexto, historico, bem-estar, evento competitivo e observacao do professor.",
    limitations: [
      "Nao usar um unico indicador para bloquear ou prescrever treino automaticamente.",
    ],
    sourceIds: ["internal_training_principles_review", "pending_load_monitoring_reference"],
    tags: ["load", "monitoring", "safety"],
  },
];
