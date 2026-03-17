import { useCallback } from "react";

import { buildCompetitiveClassPlan } from "../../../core/competitive-periodization";
import type { ClassCalendarException, ClassCompetitiveProfile, ClassGroup, ClassPlan } from "../../../core/models";
import { ageBands, type PeriodizationModel, type SportProfile } from "../../../core/periodization-basics";
import { buildClassPlan } from "../../../core/periodization-generator";
import { createClassPlan, updateClassPlan } from "../../../db/seed";
import { logAction } from "../../../observability/breadcrumbs";
import { measure } from "../../../observability/perf";

export type UseSaveWeekParams = {
  selectedClass: ClassGroup | null;
  classPlans: ClassPlan[];
  editingPlanId: string | null;
  editingWeek: number;
  cycleLength: number;
  activeCycleStartDate: string;
  calendarExceptions: ClassCalendarException[];
  competitiveProfile: ClassCompetitiveProfile | null;
  isCompetitiveMode: boolean;
  editSource: "AUTO" | "MANUAL";
  ageBand: (typeof ageBands)[number];
  periodizationModel: PeriodizationModel;
  weeklySessions: number;
  sportProfile: SportProfile;
  editPhase: string;
  editTheme: string;
  editTechnicalFocus: string;
  editPhysicalFocus: string;
  editConstraints: string;
  editMvFormat: string;
  editWarmupProfile: string;
  editJumpTarget: string;
  editPSETarget: string;
  hasPlanChanges: (existing: ClassPlan | null, candidate: ClassPlan) => boolean;
  applyDraftToWeeks: (weeks: number[]) => Promise<void>;
  setEditSource: (value: "AUTO" | "MANUAL") => void;
  setIsSavingWeek: (value: boolean) => void;
  setShowWeekEditor: (value: boolean) => void;
  setEditingPlanId: (value: string | null) => void;
  setClassPlans: (updater: (prev: ClassPlan[]) => ClassPlan[]) => void;
};

export function useSaveWeek({
  selectedClass,
  classPlans,
  editingPlanId,
  editingWeek,
  cycleLength,
  activeCycleStartDate,
  calendarExceptions,
  competitiveProfile,
  isCompetitiveMode,
  editSource,
  ageBand,
  periodizationModel,
  weeklySessions,
  sportProfile,
  editPhase,
  editTheme,
  editTechnicalFocus,
  editPhysicalFocus,
  editConstraints,
  editMvFormat,
  editWarmupProfile,
  editJumpTarget,
  editPSETarget,
  hasPlanChanges,
  applyDraftToWeeks,
  setEditSource,
  setIsSavingWeek,
  setShowWeekEditor,
  setEditingPlanId,
  setClassPlans,
}: UseSaveWeekParams) {
  const handleSaveWeek = useCallback(async () => {
    if (!selectedClass) return;
    const existing = editingPlanId
      ? classPlans.find((p) => p.id === editingPlanId) ?? null
      : null;
    const autoPlan = isCompetitiveMode
      ? buildCompetitiveClassPlan({
          classId: selectedClass.id,
          weekNumber: editingWeek,
          cycleLength,
          cycleStartDate: activeCycleStartDate,
          daysOfWeek: selectedClass.daysOfWeek ?? [],
          exceptions: calendarExceptions,
          profile: {
            targetCompetition: competitiveProfile?.targetCompetition ?? "",
            tacticalSystem: competitiveProfile?.tacticalSystem ?? "",
            planningMode: competitiveProfile?.planningMode ?? "adulto-competitivo",
          },
          source: editSource,
          existingId: existing?.id,
          existingCreatedAt: existing?.createdAt,
        })
      : buildClassPlan({
          classId: selectedClass.id,
          ageBand,
          startDate: activeCycleStartDate,
          weekNumber: editingWeek,
          source: editSource,
          mvLevel: selectedClass.mvLevel,
          cycleLength,
          model: periodizationModel,
          sessionsPerWeek: weeklySessions,
          sport: sportProfile,
        });

    const nowIso = new Date().toISOString();

    const plan: ClassPlan = {
      id: editingPlanId ?? `cp_${selectedClass.id}_${Date.now()}_${editingWeek}`,
      classId: selectedClass.id,
      startDate: autoPlan.startDate,
      weekNumber: editingWeek,
      phase: editPhase.trim() || autoPlan.phase,
      theme: editTheme.trim() || autoPlan.theme,
      technicalFocus: editTechnicalFocus.trim() || editTheme.trim() || autoPlan.technicalFocus,
      physicalFocus: editPhysicalFocus.trim() || autoPlan.physicalFocus,
      constraints: editConstraints.trim(),
      mvFormat: editMvFormat.trim() || autoPlan.mvFormat,
      warmupProfile: editWarmupProfile.trim() || autoPlan.warmupProfile,
      jumpTarget: editJumpTarget.trim() || autoPlan.jumpTarget,
      rpeTarget: editPSETarget.trim() || autoPlan.rpeTarget,
      source: editSource,
      createdAt: editingPlanId
        ? classPlans.find((p) => p.id === editingPlanId)?.createdAt ?? nowIso
        : nowIso,
      updatedAt: nowIso,
    };

    const shouldPropagateForward = hasPlanChanges(existing, plan);

    if (shouldPropagateForward) {
      plan.source = "MANUAL";
      setEditSource("MANUAL");
    } else if (existing) {
      plan.source = existing.source;
    }

    setIsSavingWeek(true);

    try {
      if (editingPlanId) {
        await measure("updateClassPlan", () => updateClassPlan(plan));
        setClassPlans((prev) =>
          prev
            .map((item) => (item.id === editingPlanId ? plan : item))
            .sort((a, b) => a.weekNumber - b.weekNumber)
        );
      } else {
        await measure("createClassPlan", () => createClassPlan(plan));
        setClassPlans((prev) => [...prev, plan].sort((a, b) => a.weekNumber - b.weekNumber));
      }

      logAction("Salvar periodizacao", {
        classId: selectedClass.id,
        weekNumber: editingWeek,
        source: plan.source,
      });

      if (shouldPropagateForward) {
        const forwardWeeks = Array.from(
          { length: Math.max(0, cycleLength - editingWeek) },
          (_, idx) => editingWeek + idx + 1
        );
        await applyDraftToWeeks(forwardWeeks);
      }

      setShowWeekEditor(false);
      setEditingPlanId(null);
    } finally {
      setIsSavingWeek(false);
    }
  }, [
    activeCycleStartDate,
    ageBand,
    applyDraftToWeeks,
    calendarExceptions,
    classPlans,
    competitiveProfile,
    cycleLength,
    editConstraints,
    editJumpTarget,
    editMvFormat,
    editPSETarget,
    editPhase,
    editPhysicalFocus,
    editSource,
    editTechnicalFocus,
    editTheme,
    editWarmupProfile,
    editingPlanId,
    editingWeek,
    hasPlanChanges,
    isCompetitiveMode,
    periodizationModel,
    selectedClass,
    setClassPlans,
    setEditingPlanId,
    setEditSource,
    setIsSavingWeek,
    setShowWeekEditor,
    sportProfile,
    weeklySessions,
  ]);

  return { handleSaveWeek };
}
