import type { ClassPlan } from "../models";
import type { ScoutingAction, ScoutingActionSkill } from "../scouting-action";
import type { CoachIntervention, ScoutingImpact, TeamEvent } from "../team-context";
import type { GoldenScenario } from "./types";

const now = "2026-05-10T12:00:00.000Z";

const makeAction = (params: {
  id: string;
  classId?: string;
  sessionId?: string;
  skill: ScoutingActionSkill;
  score: 0 | 1 | 2 | 3;
  athleteName?: string;
  actionType?: string;
}): ScoutingAction => {
  const qualityByScore: Record<0 | 1 | 2 | 3, ScoutingAction["quality"]> = {
    0: "error",
    1: "low",
    2: "medium",
    3: "high",
  };
  return {
    id: params.id,
    scoutingSessionId: params.sessionId ?? "scouting_session_1",
    classId: params.classId ?? "class_el_cartel",
    athleteName: params.athleteName,
    skill: params.skill,
    actionType: params.actionType ?? params.skill,
    quality: qualityByScore[params.score],
    score: params.score,
    source: "coach",
    createdAt: now,
  };
};

const makeEvent = (params: Partial<TeamEvent> & Pick<TeamEvent, "id" | "classId" | "type" | "date" | "title">): TeamEvent => ({
  importance: "medium",
  createdAt: now,
  ...params,
});

const makeIntervention = (
  params: Partial<CoachIntervention> & Pick<CoachIntervention, "id" | "classId" | "date" | "type" | "summary">,
): CoachIntervention => ({
  tags: [],
  createdAt: now,
  ...params,
});

const makeImpact = (
  params: Partial<ScoutingImpact> & Pick<ScoutingImpact, "id" | "classId" | "date">,
): ScoutingImpact => ({
  eventId: params.id,
  strengths: [],
  weaknesses: [],
  tacticalNotes: [],
  recommendedFocus: [],
  loadImpact: "maintain",
  createdAt: now,
  ...params,
});

const makeBasePlan = (params: Partial<ClassPlan>): Partial<ClassPlan> => params;

export const goldenScenarios: GoldenScenario[] = [
  {
    id: "el_cartel_post_friendly_reception_coverage",
    label: "El Cartel pós-amistoso: recepção e cobertura",
    description:
      "Amistoso recente com recorrência de recepção sob pressão e cobertura pós-ataque.",
    classContext: {
      classId: "class_el_cartel",
      label: "El Cartel Feminino",
      ageBand: "adult",
      referenceDate: "2026-05-10",
      weekStartDate: "2026-05-11",
    },
    events: [
      makeEvent({
        id: "event_friendly_1",
        classId: "class_el_cartel",
        title: "Amistoso El Cartel",
        type: "friendly",
        date: "2026-05-09",
      }),
    ],
    scoutingActions: [
      ...Array.from({ length: 4 }, (_, index) =>
        makeAction({ id: `receive_low_${index}`, skill: "receive", score: index === 0 ? 0 : 1 }),
      ),
      ...Array.from({ length: 4 }, (_, index) =>
        makeAction({ id: `coverage_low_${index}`, skill: "coverage", score: index === 0 ? 0 : 1 }),
      ),
    ],
    scoutingImpacts: [
      makeImpact({
        id: "impact_post_friendly_1",
        classId: "class_el_cartel",
        date: "2026-05-10",
        weaknesses: ["recepção sob pressão", "cobertura pós-ataque"],
        recommendedFocus: ["recepção sob pressão", "cobertura pós-ataque"],
        tacticalNotes: [
          "Recepção apresentou recorrência de ações C/erro.",
          "Cobertura apareceu como ponto de atenção em transição.",
        ],
        loadImpact: "maintain",
      }),
    ],
    expected: {
      expectedFocusIncludes: ["recepção contextualizada", "cobertura pós-ataque"],
      maxLoadBias: "maintain",
      expectedEvidenceRuleIds: [
        "scouting_weakness_influences_focus_not_cycle",
        "load_monitoring_signal_not_oracle",
      ],
    },
  },
  {
    id: "el_cartel_pre_match_tactical_intervention",
    label: "El Cartel pré-amistoso com intervenção tática",
    description: "Amistoso amanhã mais intervenção do professor sobre cobertura, comunicação e transição.",
    classContext: {
      classId: "class_el_cartel",
      label: "El Cartel Feminino",
      ageBand: "adult",
      referenceDate: "2026-05-08",
      weekStartDate: "2026-05-08",
    },
    events: [
      makeEvent({
        id: "event_friendly_tomorrow",
        classId: "class_el_cartel",
        title: "Amistoso Vôlei Feminino",
        type: "friendly",
        date: "2026-05-09",
      }),
    ],
    interventions: [
      makeIntervention({
        id: "intervention_tactical_1",
        classId: "class_el_cartel",
        date: "2026-05-08",
        type: "tactical",
        summary: "Ajustes de cobertura, comunicação e transição",
        tags: ["cobertura", "comunicação", "transição"],
      }),
    ],
    expected: {
      planningMode: "pre_match",
      recommendedLoadBias: "reduce",
      expectedFocusIncludes: ["organização coletiva", "comunicação"],
      expectedAvoidIncludes: ["fadiga excessiva", "carga alta"],
      expectedEvidenceRuleIds: ["pre_match_reduce_density"],
    },
  },
  {
    id: "youth_7_9_not_low_lock",
    label: "Turma 07-09: teto de segurança sem travar carga baixa",
    description: "Turma 07-09 em semana de desenvolvimento, sem evento competitivo.",
    classContext: {
      classId: "class_youth_7_9",
      label: "Turma 07-09",
      ageBand: "07-09",
      youth: true,
      referenceDate: "2026-05-11",
      weekStartDate: "2026-05-11",
    },
    baseWeekPlan: makeBasePlan({
      rpeTarget: "4-5",
      constraints: "Carga moderada controlada · pausas planejadas",
      technicalFocus: "Progressão moderada com jogos reduzidos",
      specificObjective: "Desafio motor seguro e tomada de decisão",
    }),
    expected: {
      recommendedLoadBias: "maintain",
      expectedFocusIncludes: ["progressão moderada"],
      shouldAllowModerateLoad: true,
      shouldNotInclude: ["carga alta"],
      expectedEvidenceRuleIds: ["youth_load_ceiling_not_low_lock"],
    },
  },
  {
    id: "small_sample_scouting_no_strong_impact",
    label: "Scouting com amostra pequena",
    description: "Poucas ações negativas isoladas não devem gerar impacto forte.",
    classContext: {
      classId: "class_el_cartel",
      label: "El Cartel Feminino",
      referenceDate: "2026-05-10",
      weekStartDate: "2026-05-11",
    },
    scoutingActions: [
      makeAction({ id: "small_1", skill: "receive", score: 0 }),
      makeAction({ id: "small_2", skill: "coverage", score: 1 }),
      makeAction({ id: "small_3", skill: "serve", score: 0 }),
    ],
    expected: {
      maxLoadBias: "maintain",
      expectedEvidenceRuleIds: ["small_sample_no_strong_scouting_impact"],
      shouldNotInclude: ["recepção contextualizada", "cobertura pós-ataque"],
    },
  },
  {
    id: "manual_override_preserved_with_scouting",
    label: "Plano manual preservado com scouting recente",
    description: "Scouting recente com fraqueza clara não deve sobrescrever plano manual.",
    classContext: {
      classId: "class_el_cartel",
      label: "El Cartel Feminino",
      referenceDate: "2026-05-10",
      weekStartDate: "2026-05-11",
    },
    manualOverride: true,
    scoutingImpacts: [
      makeImpact({
        id: "impact_manual_1",
        classId: "class_el_cartel",
        date: "2026-05-10",
        weaknesses: ["recepção sob pressão"],
        recommendedFocus: ["recepção sob pressão"],
        tacticalNotes: ["Recepção apresentou recorrência de ações C/erro."],
        loadImpact: "maintain",
      }),
    ],
    baseWeekPlan: makeBasePlan({
      technicalFocus: "Foco manual do professor",
      specificObjective: "Objetivo manual mantido",
      source: "MANUAL",
      manualOverrideMaskJson: JSON.stringify(["technicalFocus", "specificObjective"]),
    }),
    expected: {
      shouldPreserveManualOverride: true,
      expectedFocusIncludes: ["foco manual do professor"],
      expectedEvidenceRuleIds: [
        "manual_override_preserves_teacher_decision",
        "scouting_weakness_influences_focus_not_cycle",
      ],
    },
  },
];
