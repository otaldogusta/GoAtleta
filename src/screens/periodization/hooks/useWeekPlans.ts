import { useMemo } from "react";

import {
  buildCompetitiveWeekMeta,
} from "../../../core/competitive-periodization";
import {
  type PeriodizationModel,
  type SportProfile,
  ageBands,
} from "../../../core/periodization-basics";
import { getPlannedLoads } from "../../../core/periodization-load";
import {
  basePlans,
  getJumpTarget,
  getPSETarget,
  getPhaseForWeek,
  getVolumeForModel,
  getVolumeFromTargets,
} from "../../../core/periodization-generator";
import type {
  ClassCalendarException,
  ClassGroup,
  ClassPlan,
} from "../../../core/models";
import type { WeekPlan } from "../CyclePlanTable";

// ── helpers (ported from app/periodization/index.tsx) ──────────────────────

const decodeUnicodeEscapes = (value: string) => {
  let current = value;
  for (let i = 0; i < 3; i += 1) {
    const next = current
      .replace(/\\\\u([0-9a-fA-F]{4})/g, (_, code) =>
        String.fromCharCode(parseInt(code, 16))
      )
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, code) =>
        String.fromCharCode(parseInt(code, 16))
      )
      .replace(/\\\\U([0-9a-fA-F]{8})/g, (_, code) =>
        String.fromCharCode(parseInt(code, 16))
      )
      .replace(/\\U([0-9a-fA-F]{8})/g, (_, code) =>
        String.fromCharCode(parseInt(code, 16))
      );
    if (next === current) break;
    current = next;
  }
  return current;
};

const tryJsonDecode = (value: string) => {
  try {
    const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return JSON.parse(`"${escaped}"`) as string;
  } catch {
    return value;
  }
};

const normalizeText = (value: string) => {
  if (!value) return value;
  let current = String(value);
  for (let i = 0; i < 2; i += 1) {
    current = current.replace(/\\\\u/gi, "\\u").replace(/\\\\U/gi, "\\U");
  }
  for (let i = 0; i < 3; i += 1) {
    const decoded = decodeUnicodeEscapes(tryJsonDecode(current));
    if (decoded === current) break;
    current = decoded;
  }
  if (/\\u[0-9a-fA-F]{4}/.test(current) || /\\U[0-9a-fA-F]{8}/.test(current)) {
    current = decodeUnicodeEscapes(current);
  }
  if (!/[\uFFFD?]/.test(current)) return current;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      current = decodeURIComponent(escape(current));
    } catch {
      break;
    }
    if (!/[\uFFFD?]/.test(current)) break;
  }
  return current;
};

// ── hook ─────────────────────────────────────────────────────────────────────

export type UseWeekPlansParams = {
  selectedClass: ClassGroup | null;
  ageBand: (typeof ageBands)[number];
  classPlans: ClassPlan[];
  competitivePreviewPlans: ClassPlan[];
  cycleLength: number;
  isCompetitiveMode: boolean;
  activeCycleStartDate: string;
  calendarExceptions: ClassCalendarException[];
  periodizationModel: PeriodizationModel;
  sportProfile: SportProfile;
  weeklySessions: number;
};

export function useWeekPlans(params: UseWeekPlansParams): WeekPlan[] {
  const {
    selectedClass,
    ageBand,
    classPlans,
    competitivePreviewPlans,
    cycleLength,
    isCompetitiveMode,
    activeCycleStartDate,
    calendarExceptions,
    periodizationModel,
    sportProfile,
    weeklySessions,
  } = params;

  return useMemo(() => {
    if (!selectedClass) return [];

    const base = basePlans[ageBand] ?? basePlans["09-11"];
    const sourcePlans = classPlans.length ? classPlans : competitivePreviewPlans;
    const length = sourcePlans.length || cycleLength;
    const durationMinutes = Math.max(15, Number(selectedClass.durationMinutes ?? 60));

    if (sourcePlans.length) {
      return sourcePlans.map((plan, index) => {
        const template = base[index % base.length];
        const normalizedPhase = normalizeText(plan.phase);
        const normalizedTheme = normalizeText(plan.theme);
        const normalizedConstraints = normalizeText(plan.constraints);
        const normalizedWarmup = normalizeText(plan.warmupProfile);
        const normalizedJump = normalizeText(plan.jumpTarget);
        const normalizedRpe = normalizeText(plan.rpeTarget);
        const phaseForPse = normalizedPhase || plan.phase;
        const resolvedPSETarget = normalizedRpe || getPSETarget(phaseForPse, weeklySessions, sportProfile);
        const plannedLoads = getPlannedLoads(resolvedPSETarget, durationMinutes, weeklySessions);
        const meta = isCompetitiveMode
          ? buildCompetitiveWeekMeta({
              weekNumber: plan.weekNumber,
              cycleStartDate: activeCycleStartDate,
              daysOfWeek: selectedClass.daysOfWeek,
              exceptions: calendarExceptions,
            })
          : null;

        return {
          week: plan.weekNumber,
          title: normalizedPhase,
          focus: normalizedTheme,
          volume: isCompetitiveMode
            ? getVolumeFromTargets(plan.phase, plan.rpeTarget)
            : getVolumeForModel(template.volume, periodizationModel, weeklySessions, sportProfile),
          notes: [normalizedConstraints, normalizedWarmup].filter(Boolean),
          dateRange: meta?.dateRangeLabel,
          sessionDatesLabel: meta?.sessionDatesLabel,
          jumpTarget:
            normalizedJump || getJumpTarget(selectedClass?.mvLevel ?? "", ageBand),
          PSETarget: resolvedPSETarget,
          plannedSessionLoad: plannedLoads.plannedSessionLoad,
          plannedWeeklyLoad: plannedLoads.plannedWeeklyLoad,
          source: plan.source || "AUTO",
        } as WeekPlan;
      });
    }

    const weeks: WeekPlan[] = [];

    for (let i = 0; i < length; i += 1) {
      const template = base[i % base.length];
      const phase = getPhaseForWeek(i + 1, length, periodizationModel, sportProfile);
      const pseTarget = getPSETarget(phase, weeklySessions, sportProfile);
      const plannedLoads = getPlannedLoads(pseTarget, durationMinutes, weeklySessions);
      weeks.push({
        ...template,
        week: i + 1,
        title: phase,
        volume: getVolumeForModel(template.volume, periodizationModel, weeklySessions, sportProfile),
        jumpTarget: getJumpTarget(selectedClass?.mvLevel ?? "", ageBand),
        PSETarget: pseTarget,
        plannedSessionLoad: plannedLoads.plannedSessionLoad,
        plannedWeeklyLoad: plannedLoads.plannedWeeklyLoad,
        source: "AUTO",
      });
    }

    return weeks;
  }, [
    activeCycleStartDate,
    ageBand,
    calendarExceptions,
    classPlans,
    competitivePreviewPlans,
    cycleLength,
    isCompetitiveMode,
    periodizationModel,
    sportProfile,
    selectedClass,
    weeklySessions,
  ]);
}
