import { useMemo } from "react";

import { toCompetitiveClassPlans } from "../../../core/competitive-periodization";
import type {
  ClassCalendarException,
  ClassCompetitiveProfile,
  ClassGroup,
  ClassPlan,
} from "../../../core/models";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UseCompetitivePreviewPlansParams = {
  selectedClass: ClassGroup | null;
  isCompetitiveMode: boolean;
  cycleLength: number;
  activeCycleStartDate: string;
  calendarExceptions: ClassCalendarException[];
  competitiveProfile: ClassCompetitiveProfile | null;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCompetitivePreviewPlans(
  params: UseCompetitivePreviewPlansParams
): ClassPlan[] {
  const {
    selectedClass,
    isCompetitiveMode,
    cycleLength,
    activeCycleStartDate,
    calendarExceptions,
    competitiveProfile,
  } = params;

  return useMemo(() => {
    if (!selectedClass || !isCompetitiveMode) return [];
    return toCompetitiveClassPlans({
      classId: selectedClass.id,
      cycleLength,
      cycleStartDate: activeCycleStartDate,
      daysOfWeek: selectedClass.daysOfWeek,
      exceptions: calendarExceptions,
      profile: {
        planningMode: "adulto-competitivo",
        targetCompetition: competitiveProfile?.targetCompetition ?? "",
        tacticalSystem: competitiveProfile?.tacticalSystem ?? "5x1",
      },
    });
  }, [
    activeCycleStartDate,
    calendarExceptions,
    competitiveProfile?.targetCompetition,
    competitiveProfile?.tacticalSystem,
    cycleLength,
    isCompetitiveMode,
    selectedClass,
  ]);
}
