/**
 * resistance-templates.ts
 *
 * Static library of 5 base resistance training template families
 * (A–E) tailored for volleyball athletes.
 *
 * Template selection rule:
 *   resolveResistanceTemplate(goal, profile) → ResistanceTrainingPlan
 *
 * Volume (sets/reps) scales with ResistanceTrainingProfile:
 *   iniciante     → lower end
 *   intermediario → mid range
 *   avancado      → upper end
 */

import type {
    CourtGymRelationship,
    ResistanceExercisePrescription,
    ResistanceTrainingGoal,
    ResistanceTrainingPlan,
    ResistanceTrainingProfile,
    WeeklyPhysicalEmphasis,
} from "../models";

// ─── Volume scale helpers ────────────────────────────────────────────────────

type VolumeSpec = {
  sets: number;
  reps: string;
  rest: string;
};

function scale(
  profile: ResistanceTrainingProfile,
  i: VolumeSpec,
  m: VolumeSpec,
  a: VolumeSpec
): VolumeSpec {
  if (profile === "intermediario") return m;
  if (profile === "avancado") return a;
  return i;
}

// ─── Template A — Empurrar (Push) ────────────────────────────────────────────

function buildTemplateA(profile: ResistanceTrainingProfile): ResistanceExercisePrescription[] {
  return [
    {
      name: "Supino inclinado com halteres",
      category: "empurrar",
      ...scale(profile, { sets: 3, reps: "10-12", rest: "90s" }, { sets: 4, reps: "8-10", rest: "90s" }, { sets: 4, reps: "6-8", rest: "2min" }),
      cadence: "2-1-2",
      transferTarget: "força de bloqueio e amortecimento de queda",
    },
    {
      name: "Desenvolvimento com halteres",
      category: "empurrar",
      ...scale(profile, { sets: 3, reps: "10-12", rest: "90s" }, { sets: 3, reps: "8-10", rest: "90s" }, { sets: 4, reps: "8", rest: "90s" }),
      cadence: "2-0-2",
      transferTarget: "estabilidade de ombro no ataque",
    },
    {
      name: "Tríceps corda no cabo",
      category: "empurrar",
      ...scale(profile, { sets: 3, reps: "12-15", rest: "60s" }, { sets: 3, reps: "12", rest: "60s" }, { sets: 4, reps: "10-12", rest: "60s" }),
      transferTarget: "extensão final do cotovelo no ataque",
    },
    {
      name: "Elevação lateral",
      category: "preventivo",
      sets: 3,
      reps: "15",
      rest: "60s",
      notes: "Amplitude controlada, evitar compensação de trapézio",
      transferTarget: "estabilidade dinâmica do manguito rotador",
    },
  ];
}

// ─── Template B — Puxar (Pull) ────────────────────────────────────────────────

function buildTemplateB(profile: ResistanceTrainingProfile): ResistanceExercisePrescription[] {
  return [
    {
      name: "Remada curvada com barra",
      category: "puxar",
      ...scale(profile, { sets: 3, reps: "10-12", rest: "90s" }, { sets: 4, reps: "8-10", rest: "90s" }, { sets: 4, reps: "6-8", rest: "2min" }),
      cadence: "2-1-2",
      transferTarget: "força de recepção e postura em quadra",
    },
    {
      name: "Puxada frente no cabo",
      category: "puxar",
      ...scale(profile, { sets: 3, reps: "10-12", rest: "90s" }, { sets: 4, reps: "8-10", rest: "90s" }, { sets: 4, reps: "8", rest: "90s" }),
      transferTarget: "grande dorsal e estabilidade escapular",
    },
    {
      name: "Rosca direta com halteres",
      category: "puxar",
      ...scale(profile, { sets: 3, reps: "12", rest: "60s" }, { sets: 3, reps: "10", rest: "60s" }, { sets: 4, reps: "8-10", rest: "60s" }),
      transferTarget: "força de preensão na recepção de flutuante",
    },
    {
      name: "Retração escapular com elástico",
      category: "preventivo",
      sets: 3,
      reps: "15",
      rest: "60s",
      notes: "Isometria de 2s no final",
      transferTarget: "alinhamento escapular durante o ataque",
    },
  ];
}

// ─── Template C — Membros Inferiores ─────────────────────────────────────────

function buildTemplateC(profile: ResistanceTrainingProfile): ResistanceExercisePrescription[] {
  return [
    {
      name: profile === "iniciante" ? "Leg Press 45°" : "Agachamento com barra",
      category: "membros_inferiores",
      ...scale(profile, { sets: 3, reps: "12-15", rest: "2min" }, { sets: 4, reps: "8-10", rest: "2min" }, { sets: 5, reps: "5-6", rest: "3min" }),
      cadence: "3-1-2",
      transferTarget: "impulso de salto e estabilidade de aterrissagem",
    },
    {
      name: "Stiff com halteres",
      category: "membros_inferiores",
      ...scale(profile, { sets: 3, reps: "12", rest: "90s" }, { sets: 4, reps: "10", rest: "90s" }, { sets: 4, reps: "8", rest: "2min" }),
      cadence: "3-1-2",
      transferTarget: "cadeia posterior para salto e deslocamento",
    },
    {
      name: "Flexora na mesa",
      category: "membros_inferiores",
      ...scale(profile, { sets: 3, reps: "12", rest: "60s" }, { sets: 3, reps: "10", rest: "60s" }, { sets: 4, reps: "8-10", rest: "90s" }),
      transferTarget: "isquiotibiais no sprint e travada",
    },
    {
      name: "Panturrilha em pé",
      category: "membros_inferiores",
      sets: 4,
      reps: "15-20",
      rest: "45s",
      cadence: "2-1-2",
      transferTarget: "potência de propulsão no salto",
    },
  ];
}

// ─── Template D — Potência ────────────────────────────────────────────────────

function buildTemplateD(profile: ResistanceTrainingProfile): ResistanceExercisePrescription[] {
  return [
    {
      name: profile === "iniciante" ? "Salto com caixote (30cm)" : "Agachamento balístico com peso leve",
      category: "potencia",
      ...scale(profile, { sets: 4, reps: "5", rest: "2min" }, { sets: 4, reps: "4-5", rest: "2min" }, { sets: 5, reps: "4", rest: "3min" }),
      notes: "Máxima intenção de velocidade concêntrica",
      transferTarget: "RFD para salto de ataque e bloqueio",
    },
    {
      name: "Salto horizontal (salto triplo alternado)",
      category: "potencia",
      sets: 4,
      reps: "6",
      rest: "2min",
      notes: "Aterrissar com joelhos amortecidos",
      transferTarget: "potência reativa e deslocamento lateral rápido",
    },
    {
      name: "Arremesso de medicine ball acima da cabeça",
      category: "potencia",
      ...scale(profile, { sets: 3, reps: "6", rest: "90s" }, { sets: 4, reps: "6", rest: "2min" }, { sets: 4, reps: "8", rest: "2min" }),
      notes: "Explosão de quadril → tronco → braço",
      transferTarget: "cadeia cinética do ataque",
    },
    {
      name: "Prancha com movimento de ombro (pallof press)",
      category: "core",
      sets: 3,
      reps: "10",
      rest: "60s",
      transferTarget: "estabilidade de core sob produção de força",
    },
  ];
}

// ─── Template E — Preventivo / Estabilidade ──────────────────────────────────

function buildTemplateE(_profile: ResistanceTrainingProfile): ResistanceExercisePrescription[] {
  return [
    {
      name: "Rotação externa de ombro com elástico",
      category: "preventivo",
      sets: 3,
      reps: "15",
      rest: "45s",
      notes: "Cotovelo a 90°, movimento lento",
      transferTarget: "integridade do manguito rotador",
    },
    {
      name: "Abdução de quadril com faixa (clamshell)",
      category: "preventivo",
      sets: 3,
      reps: "15",
      rest: "45s",
      transferTarget: "ativação de glúteo médio, alinhamento de joelho no salto",
    },
    {
      name: "Ponte de glúteo unilateral",
      category: "preventivo",
      sets: 3,
      reps: "12",
      rest: "60s",
      cadence: "2-2-2",
      transferTarget: "força de cadeia posterior para aterrissagem",
    },
    {
      name: "Prancha frontal",
      category: "core",
      sets: 3,
      reps: "30-45s",
      rest: "45s",
      transferTarget: "estabilidade de core para postura em quadra",
    },
    {
      name: "Pássaro-cão (bird-dog)",
      category: "core",
      sets: 3,
      reps: "10 cada lado",
      rest: "45s",
      transferTarget: "controle lombopélvico no deslocamento",
    },
  ];
}

function buildReactivePowerVariant(
  profile: ResistanceTrainingProfile
): ResistanceExercisePrescription[] {
  const exercises = buildTemplateD(profile);

  return [
    {
      ...exercises[0],
      name:
        profile === "iniciante"
          ? "Drop jump assistido + salto vertical"
          : "Drop jump reativo + salto vertical",
      notes: "Contato curto no solo e resposta explosiva imediata",
      transferTarget: "reatividade de bloqueio e segundo salto",
    },
    {
      ...exercises[1],
      name: "Saltos laterais com reação ao comando",
      notes: "Responder ao estímulo visual e trocar direção sem perder rigidez",
      transferTarget: "primeiro passo lateral e ajuste rápido de bloqueio",
    },
    {
      ...exercises[2],
      name: "Arremesso rotacional de medicine ball",
      notes: "Explosão curta com troca rápida de base",
      transferTarget: "arranque para cobertura e transição ofensiva",
    },
    {
      ...exercises[3],
      name: "Prancha com toque alternado de ombro",
      transferTarget: "estabilidade de core em mudanças rápidas de direção",
    },
  ];
}

function buildSpecificEnduranceVariant(
  profile: ResistanceTrainingProfile
): ResistanceExercisePrescription[] {
  const exercises = buildTemplateA(profile);

  return [
    {
      ...exercises[0],
      name: "Desenvolvimento alternado em pé",
      rest: profile === "avancado" ? "45s" : "60s",
      notes: "Executar em circuito com transição curta entre exercícios",
      transferTarget: "sustentação de ações ofensivas repetidas ao longo do rally",
    },
    {
      ...exercises[1],
      name: "Passada reversa com halteres",
      category: "membros_inferiores",
      rest: profile === "avancado" ? "45s" : "60s",
      transferTarget: "manutenção de base defensiva e deslocamento repetido",
    },
    {
      ...exercises[2],
      name: "Remada baixa no cabo",
      category: "puxar",
      rest: "45s",
      transferTarget: "postura de recepção estável em rallies longos",
    },
    {
      ...exercises[3],
      name: "Prancha lateral com alcance",
      category: "core",
      rest: "45s",
      transferTarget: "controle de tronco sob fadiga acumulada",
    },
  ];
}

function buildRecoveryVariant(
  profile: ResistanceTrainingProfile
): ResistanceExercisePrescription[] {
  const exercises = buildTemplateE(profile);

  return exercises.map((exercise) => ({
    ...exercise,
    rest: "45s",
    notes: exercise.notes
      ? `${exercise.notes} Carga leve e foco em controle.`
      : "Carga leve e foco em controle articular.",
  }));
}

// ─── Template registry ────────────────────────────────────────────────────────

const TEMPLATE_GOAL_TO_BUILDER: Record<
  ResistanceTrainingGoal,
  (profile: ResistanceTrainingProfile) => ResistanceExercisePrescription[]
> = {
  forca_base: buildTemplateC,
  hipertrofia: buildTemplateB,
  potencia_atletica: buildTemplateD,
  resistencia_muscular: buildTemplateA,
  prevencao_lesao: buildTemplateE,
  ativacao_funcional: buildTemplateE,
};

const GOAL_LABELS: Record<ResistanceTrainingGoal, string> = {
  forca_base: "Força Base (Membros Inferiores)",
  hipertrofia: "Hipertrofia / Força Tração",
  potencia_atletica: "Potência Atlética",
  resistencia_muscular: "Resistência Muscular (Empurrar)",
  prevencao_lesao: "Prevenção e Estabilidade",
  ativacao_funcional: "Ativação Funcional",
};

const GOAL_TRANSFER: Record<ResistanceTrainingGoal, string> = {
  forca_base: "impulso de salto, deslocamento e estabilidade de aterrissagem",
  hipertrofia: "força de recepção, postura e estabilidade escapular",
  potencia_atletica: "velocidade de produção de força no ataque e bloqueio",
  resistencia_muscular: "resistência muscular local para longa duração de jogo",
  prevencao_lesao: "redução de risco de lesões de ombro, joelho e lombar",
  ativacao_funcional: "prontidão neuromuscular pré-treino de quadra",
};

const GOAL_DURATION: Record<ResistanceTrainingGoal, Record<ResistanceTrainingProfile, number>> = {
  forca_base:           { iniciante: 45, intermediario: 55, avancado: 65 },
  hipertrofia:          { iniciante: 45, intermediario: 55, avancado: 65 },
  potencia_atletica:    { iniciante: 35, intermediario: 45, avancado: 50 },
  resistencia_muscular: { iniciante: 40, intermediario: 50, avancado: 55 },
  prevencao_lesao:      { iniciante: 20, intermediario: 25, avancado: 30 },
  ativacao_funcional:   { iniciante: 15, intermediario: 20, avancado: 20 },
};

type ResistanceTemplateOptions = {
  courtGymRelationship?: CourtGymRelationship;
  weeklyPhysicalEmphasis?: WeeklyPhysicalEmphasis;
};

type ResistanceTemplateVariant = {
  idSuffix?: string;
  label?: string;
  transferTarget?: string;
  estimatedDurationMin?: number;
  buildExercises?: (
    profile: ResistanceTrainingProfile
  ) => ResistanceExercisePrescription[];
};

function resolveTemplateVariant(
  goal: ResistanceTrainingGoal,
  options: ResistanceTemplateOptions = {}
): ResistanceTemplateVariant {
  const { weeklyPhysicalEmphasis: emphasis, courtGymRelationship } = options;

  if (goal === "potencia_atletica" && emphasis === "velocidade_reatividade") {
    return {
      idSuffix: emphasis,
      label: "Potência Reativa e Velocidade",
      transferTarget:
        "primeiro passo, deslocamento lateral e reação de bloqueio",
      buildExercises: buildReactivePowerVariant,
    };
  }

  if (goal === "potencia_atletica" && courtGymRelationship === "academia_prioritaria") {
    return {
      idSuffix: courtGymRelationship,
      label: "Potência Atlética Prioritária",
      transferTarget:
        "produção máxima de força para salto, bloqueio e ações explosivas repetidas",
    };
  }

  if (goal === "resistencia_muscular" && emphasis === "resistencia_especifica") {
    return {
      idSuffix: emphasis,
      label: "Resistência Específica Integrada",
      transferTarget:
        "sustentação de ações repetidas de jogo com estabilidade técnica sob fadiga",
      estimatedDurationMin: 45,
      buildExercises: buildSpecificEnduranceVariant,
    };
  }

  if (
    goal === "forca_base" &&
    courtGymRelationship === "integrado_transferencia_direta"
  ) {
    return {
      idSuffix: courtGymRelationship,
      label: "Força Base com Transferência Direta",
      transferTarget:
        "aterrissagem estável, salto de ataque e retomada rápida para a ação seguinte de quadra",
    };
  }

  if (goal === "prevencao_lesao" && emphasis === "prevencao_recuperacao") {
    return {
      idSuffix: emphasis,
      label: "Recuperação e Prevenção",
      transferTarget:
        "redução de fadiga residual e manutenção de estabilidade de ombro, joelho e tronco",
      estimatedDurationMin: 20,
      buildExercises: buildRecoveryVariant,
    };
  }

  if (
    goal === "prevencao_lesao" &&
    courtGymRelationship === "complementar_equilibrado"
  ) {
    return {
      idSuffix: courtGymRelationship,
      label: "Estabilidade e Prevenção Complementar",
      transferTarget:
        "suporte articular e controle de carga para sustentar a semana de quadra sem interferência excessiva",
    };
  }

  return {};
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Resolves the best resistance training template for a given goal and profile.
 */
export function resolveResistanceTemplate(
  goal: ResistanceTrainingGoal,
  profile: ResistanceTrainingProfile,
  options: ResistanceTemplateOptions = {}
): ResistanceTrainingPlan {
  const builder = TEMPLATE_GOAL_TO_BUILDER[goal];
  const variant = resolveTemplateVariant(goal, options);
  const exerciseBuilder = variant.buildExercises ?? builder;
  const exercises = exerciseBuilder(profile);
  const id = variant.idSuffix
    ? `tpl_${goal}_${profile}_${variant.idSuffix}`
    : `tpl_${goal}_${profile}`;
  const estimatedDurationMinBase =
    variant.estimatedDurationMin ?? GOAL_DURATION[goal][profile];
  const estimatedDurationMin =
    goal === "potencia_atletica" &&
    options.courtGymRelationship === "academia_prioritaria" &&
    !variant.estimatedDurationMin
      ? estimatedDurationMinBase + 5
      : estimatedDurationMinBase;

  return {
    id,
    label: variant.label ?? GOAL_LABELS[goal],
    primaryGoal: goal,
    transferTarget: variant.transferTarget ?? GOAL_TRANSFER[goal],
    estimatedDurationMin,
    exercises,
  };
}

export { GOAL_LABELS, GOAL_TRANSFER };
