import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import type { TrainingPlanPedagogy } from "../../../../core/models";
import type { AutoPlanForCycleDayResult } from "../../application/build-auto-plan-for-cycle-day";
import { useSessionPlanGeneration } from "../useSessionPlanGeneration";

const buildDecisionTrace = (): NonNullable<TrainingPlanPedagogy["decisionTrace"]> => ({
  schemaVersion: 1,
  source: {
    classId: "class_1",
    sessionDate: "2026-06-20",
    classPlanId: "plan_1",
    classPlanWeekNumber: 4,
  },
  plannedContext: {
    ageBand: "07-09",
    classLevel: 1,
    planningPhase: "base",
    weekNumber: 4,
    sessionIndexInWeek: 1,
    loadIntent: "baixo",
  },
  decision: {
    primarySkill: "passe",
    progressionDimension: "consistencia",
    pedagogicalIntent: "technical_adjustment",
    phaseIntent: "exploracao_fundamentos",
  },
  influences: {
    periodization: { used: true, technicalFocus: "Passe" },
    classContext: {
      used: true,
      goal: "Passe",
      modality: "voleibol",
      materials: ["bolas", "cones"],
      constraints: [],
    },
    scouting: { used: false, confidence: "none", sampleSize: 0 },
    history: {
      used: false,
      historicalConfidence: "none",
      recentSkills: [],
      mustAvoidRepeating: [],
    },
    reportFeedback: { used: false, signals: [] },
  },
  safeguards: {
    repetitionAdjusted: false,
    overrideAdjusted: false,
    fallbackUsed: false,
    ageSanitizerFlags: [],
    envelopeDiagnostics: [],
  },
  teacherFacingSummary: "A aula prioriza passe porque o planejamento da semana indica Passe.",
});

const buildAutoPlanResult = (
  decisionTrace: TrainingPlanPedagogy["decisionTrace"] = buildDecisionTrace(),
  options: { omitDecisionTrace?: boolean } = {}
) =>
  ({
    package: {
      input: {
        classGroup: { id: "class_1" },
      },
    },
    explanation: {},
    decisionTrace: options.omitDecisionTrace ? undefined : decisionTrace,
    readinessState: {
      classId: "class_1",
      plannedGameLevel: "L6_3x3_introdutorio",
      estimatedGameLevel: "L3_1x1_intencional",
      appliedCoreLevel: "L4_2x2_cooperativo",
      confidence: "medium",
      riskFlags: ["salto_de_complexidade"],
      recommendation: "consolidar",
      reason: ["Ponte curta."],
      teacherMessage: "Hoje use 2x2 cooperativo.",
    },
    adaptiveEnvelope: {
      periodizationTarget: "L6_3x3_introdutorio",
      appliedCoreLevel: "L4_2x2_cooperativo",
      diagnosticProbe: {
        title: "Comece por 1x1",
        description: "Observe controle.",
        decisionRule: "Avance quando estabilizar.",
      },
      planARegression: {
        level: "L3_1x1_intencional",
        intent: "1x1 com alvo",
        suggestedConstraint: "Permita quique.",
      },
      planBCore: {
        level: "L4_2x2_cooperativo",
        intent: "2x2 cooperativo",
        suggestedConstraint: "Use duplas.",
      },
      planCProgression: {
        level: "L5_2x2_decisao",
        intent: "2x2 com decisão",
        suggestedConstraint: "Zona combinada.",
      },
    },
    coachGuidance: {
      title: "Ponte 1x1 -> 2x2",
      doNow: ["Comece com 1x1 com quique e alvo."],
      avoidToday: ["Evite 3x3 livre no começo."],
      advanceIf: ["A maioria mantiver 3 trocas no 1x1."],
      simplifyIf: ["A bola cair no primeiro contato."],
    },
    strategy: {
      primarySkill: "passe",
      secondarySkill: "levantamento",
      pedagogicalDecisionSupport: {
        teacherFacingSummary: "Priorizar passe.",
        decisionRationale: "Semana de passe.",
        sessionConstraintSuggestions: [],
        capIntent: {
          conceitual: [],
          procedimental: [],
          atitudinal: [],
        },
      },
    },
  } as unknown as AutoPlanForCycleDayResult);

type HookApi = ReturnType<typeof useSessionPlanGeneration>;

const renderHook = async (params: {
  buildFreshAutoPlanResult: jest.Mock;
  persistPedagogicalPlanPackage: jest.Mock;
  onError?: jest.Mock;
}) => {
  let latest: HookApi | null = null;
  let renderer: TestRenderer.ReactTestRenderer | null = null;
  const onError = params.onError ?? jest.fn();

  function Harness() {
    latest = useSessionPlanGeneration({
      classId: "class_1",
      sessionDate: "2026-06-20",
      plan: null,
      shouldAutoGenerateFromPeriodization: false,
      isLoadingSession: false,
      isResolvingCurrentClassPlan: false,
      hasUsableCurrentClassPlan: true,
      buildFreshAutoPlanResult: params.buildFreshAutoPlanResult,
      persistPedagogicalPlanPackage: params.persistPedagogicalPlanPackage,
      toPersistedGenerationExplanation: jest.fn(() => ({ mode: "cycle_based" })),
      waitForInteractionIdle: jest.fn(() => Promise.resolve()),
      waitForNextPaint: jest.fn(() => Promise.resolve()),
      onMissingPeriodization: jest.fn(),
      onClosePlanMenu: jest.fn(),
      onError,
    });
    return null;
  }

  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Harness));
  });
  if (!latest) throw new Error("Hook did not render");
  return { latest, onError, renderer };
};

describe("useSessionPlanGeneration", () => {
  it("passes the generated decision trace into the persistence path", async () => {
    const decisionTrace = buildDecisionTrace();
    const autoPlanResult = buildAutoPlanResult(decisionTrace);
    const buildFreshAutoPlanResult = jest.fn(() => Promise.resolve(autoPlanResult));
    const persistPedagogicalPlanPackage = jest.fn(() => Promise.resolve());
    const { latest, renderer } = await renderHook({
      buildFreshAutoPlanResult,
      persistPedagogicalPlanPackage,
    });

    await act(async () => {
      await latest.handleGeneratePedagogicalPlan();
    });

    expect(persistPedagogicalPlanPackage).toHaveBeenCalledTimes(1);
    expect(persistPedagogicalPlanPackage).toHaveBeenCalledWith(
      autoPlanResult.package,
      undefined,
      expect.objectContaining({
        decisionTrace,
        readinessState: autoPlanResult.readinessState,
        adaptiveEnvelope: autoPlanResult.adaptiveEnvelope,
        coachGuidance: autoPlanResult.coachGuidance,
        targetPrimarySkill: "passe",
        targetSecondarySkill: "levantamento",
      })
    );
    await act(async () => {
      renderer?.unmount();
    });
  });

  it("does not persist an automatically generated plan when decision trace is missing", async () => {
    const buildFreshAutoPlanResult = jest.fn(() =>
      Promise.resolve(buildAutoPlanResult(undefined, { omitDecisionTrace: true }))
    );
    const persistPedagogicalPlanPackage = jest.fn(() => Promise.resolve());
    const onError = jest.fn();
    const { latest, renderer } = await renderHook({
      buildFreshAutoPlanResult,
      persistPedagogicalPlanPackage,
      onError,
    });

    await act(async () => {
      await latest.handleGeneratePedagogicalPlan();
    });

    expect(persistPedagogicalPlanPackage).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith({
      classId: "class_1",
      sessionDate: "2026-06-20",
      variationSeed: undefined,
    });
    await act(async () => {
      renderer?.unmount();
    });
  });
});
