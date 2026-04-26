import { useCallback, useEffect, useRef, useState } from "react";

import type {
  TrainingPlan,
  TrainingPlanPedagogy,
  TrainingPlanPlanningBasis,
  VolleyballSkill,
} from "../../../core/models";
import type { PedagogicalPlanPackage } from "../../../core/pedagogical-planning";
import type { AutoPlanForCycleDayResult } from "../application/build-auto-plan-for-cycle-day";

type PersistGeneratedPlanOptions = {
  successMessage?: string;
  generationExplanation?: TrainingPlanPedagogy["generationExplanation"];
  targetPrimarySkill?: VolleyballSkill;
  targetSecondarySkill?: VolleyballSkill;
};

type UseSessionPlanGenerationParams = {
  classId?: string | null;
  sessionDate: string;
  plan: TrainingPlan | null;
  shouldAutoGenerateFromPeriodization: boolean;
  isLoadingSession: boolean;
  isResolvingCurrentClassPlan: boolean;
  hasUsableCurrentClassPlan: boolean;
  buildFreshAutoPlanResult: (
    variationSeed?: number,
    planningBasis?: TrainingPlanPlanningBasis
  ) => Promise<AutoPlanForCycleDayResult | null>;
  persistPedagogicalPlanPackage: (
    packageToSave: PedagogicalPlanPackage,
    editedDraft: undefined,
    options?: PersistGeneratedPlanOptions
  ) => Promise<void>;
  toPersistedGenerationExplanation: (
    explanation: AutoPlanForCycleDayResult["explanation"],
    planningBasis: TrainingPlanPlanningBasis
  ) => TrainingPlanPedagogy["generationExplanation"];
  waitForInteractionIdle: () => Promise<void>;
  waitForNextPaint: () => Promise<void>;
  onMissingPeriodization: () => void;
  onClosePlanMenu: () => void;
  onError: (params: { classId: string; sessionDate: string; variationSeed?: number }) => void;
};

type PlanGenerationPhase = "idle" | "generating" | "saving" | "settling";

export function useSessionPlanGeneration({
  classId,
  sessionDate,
  plan,
  shouldAutoGenerateFromPeriodization,
  isLoadingSession,
  isResolvingCurrentClassPlan,
  hasUsableCurrentClassPlan,
  buildFreshAutoPlanResult,
  persistPedagogicalPlanPackage,
  toPersistedGenerationExplanation,
  waitForInteractionIdle,
  waitForNextPaint,
  onMissingPeriodization,
  onClosePlanMenu,
  onError,
}: UseSessionPlanGenerationParams) {
  const periodizationAutoGenerateKeyRef = useRef<string | null>(null);
  const [pedagogicalPlanPackage, setPedagogicalPlanPackage] =
    useState<PedagogicalPlanPackage | null>(null);
  const [planGenerationPhase, setPlanGenerationPhase] =
    useState<PlanGenerationPhase>("idle");

  const isGeneratingPedagogicalPlan = planGenerationPhase === "generating";
  const isSavingPedagogicalPlan =
    planGenerationPhase === "saving" || planGenerationPhase === "settling";
  const isPlanGenerationBusy = planGenerationPhase !== "idle";

  useEffect(() => {
    periodizationAutoGenerateKeyRef.current = null;
  }, [classId, sessionDate, shouldAutoGenerateFromPeriodization]);

  const buildFreshPedagogicalPackage = useCallback(
    async (
      variationSeed?: number,
      planningBasis: TrainingPlanPlanningBasis = "cycle_based"
    ) => {
      const autoPlanResult = await buildFreshAutoPlanResult(variationSeed, planningBasis);
      return autoPlanResult?.package ?? null;
    },
    [buildFreshAutoPlanResult]
  );

  const generatePedagogicalPlanAndSave = useCallback(
    async (
      variationSeed?: number,
      planningBasis: TrainingPlanPlanningBasis = "cycle_based"
    ) => {
      if (!classId) return;
      onClosePlanMenu();
      setPlanGenerationPhase("generating");
      try {
        await waitForInteractionIdle();
        const autoPlanResult = await buildFreshAutoPlanResult(variationSeed, planningBasis);
        if (!autoPlanResult) return;
        setPedagogicalPlanPackage(autoPlanResult.package);
        setPlanGenerationPhase("saving");
        const successMessage = plan && variationSeed ? "Nova variação aplicada." : undefined;
        await persistPedagogicalPlanPackage(autoPlanResult.package, undefined, {
          successMessage,
          generationExplanation: toPersistedGenerationExplanation(
            autoPlanResult.explanation,
            planningBasis
          ),
          targetPrimarySkill: autoPlanResult.strategy.primarySkill,
          targetSecondarySkill: autoPlanResult.strategy.secondarySkill,
        });
        setPlanGenerationPhase("settling");
        await waitForInteractionIdle();
        await waitForNextPaint();
      } catch {
        onError({ classId, sessionDate, variationSeed });
      } finally {
        setPlanGenerationPhase("idle");
      }
    },
    [
      buildFreshAutoPlanResult,
      classId,
      onClosePlanMenu,
      onError,
      persistPedagogicalPlanPackage,
      plan,
      sessionDate,
      toPersistedGenerationExplanation,
      waitForInteractionIdle,
      waitForNextPaint,
    ]
  );

  const handleGeneratePedagogicalPlan = useCallback(() => {
    if (!isResolvingCurrentClassPlan && !hasUsableCurrentClassPlan) {
      onMissingPeriodization();
      return;
    }
    void generatePedagogicalPlanAndSave(undefined, "cycle_based");
  }, [
    generatePedagogicalPlanAndSave,
    hasUsableCurrentClassPlan,
    isResolvingCurrentClassPlan,
    onMissingPeriodization,
  ]);

  useEffect(() => {
    if (!shouldAutoGenerateFromPeriodization) return;
    if (!classId || isLoadingSession || isResolvingCurrentClassPlan) return;
    if (!hasUsableCurrentClassPlan) return;
    if (plan || isPlanGenerationBusy) return;

    const generationKey = `${classId}:${sessionDate}`;
    if (periodizationAutoGenerateKeyRef.current === generationKey) return;
    periodizationAutoGenerateKeyRef.current = generationKey;

    void generatePedagogicalPlanAndSave(undefined, "cycle_based");
  }, [
    classId,
    generatePedagogicalPlanAndSave,
    hasUsableCurrentClassPlan,
    isLoadingSession,
    isPlanGenerationBusy,
    isResolvingCurrentClassPlan,
    plan,
    sessionDate,
    shouldAutoGenerateFromPeriodization,
  ]);

  return {
    pedagogicalPlanPackage,
    setPedagogicalPlanPackage,
    planGenerationPhase,
    isGeneratingPedagogicalPlan,
    isSavingPedagogicalPlan,
    isPlanGenerationBusy,
    buildFreshPedagogicalPackage,
    generatePedagogicalPlanAndSave,
    handleGeneratePedagogicalPlan,
  };
}
