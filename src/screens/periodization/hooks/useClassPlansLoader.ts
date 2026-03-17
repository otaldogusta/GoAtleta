import { useEffect } from "react";

import { cycleOptions } from "../../../core/periodization-basics";
import { validateAcwrLimits } from "../../../core/periodization-generator";
import type { ClassGroup, ClassPlan } from "../../../core/models";
import { getClassPlansByClass, getSessionLogsByRange } from "../../../db/seed";
import { measureAsync } from "../../../observability/perf";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UseClassPlansLoaderParams = {
  selectedClassId: string;
  selectedClass: ClassGroup | null;
  acwrLimits: { high: string; low: string };
  setClassPlans: (plans: ClassPlan[]) => void;
  setCycleLength: (length: (typeof cycleOptions)[number]) => void;
  setAcwrRatio: (ratio: number | null) => void;
  setAcwrMessage: (message: string) => void;
  setPainAlert: (alert: string) => void;
  setPainAlertDates: (dates: string[]) => void;
};

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

const parseIsoDate = (value: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const formatDisplayDate = (value: string | null) => {
  if (!value) return "";
  const parsed = parseIsoDate(value);
  if (!parsed) return value;
  return parsed.toLocaleDateString("pt-BR");
};

// ---------------------------------------------------------------------------
// Hook: load class plans (effect 1 of 2)
// ---------------------------------------------------------------------------

function useClassPlansEffect(params: UseClassPlansLoaderParams) {
  const { selectedClassId, setClassPlans, setCycleLength } = params;

  useEffect(() => {
    let alive = true;

    if (!selectedClassId) {
      setClassPlans([]);
      return;
    }

    (async () => {
      const plans = await measureAsync(
        "screen.periodization.load.classPlans",
        () => getClassPlansByClass(selectedClassId),
        { screen: "periodization", classId: selectedClassId }
      );

      if (!alive) return;

      setClassPlans(plans);

      if (plans.length && cycleOptions.includes(plans.length as (typeof cycleOptions)[number])) {
        setCycleLength(plans.length as (typeof cycleOptions)[number]);
      }
    })();

    return () => {
      alive = false;
    };

  }, [selectedClassId]); // eslint-disable-line react-hooks/exhaustive-deps
}

// ---------------------------------------------------------------------------
// Hook: compute ACWR data (effect 2 of 2)
// ---------------------------------------------------------------------------

function useAcwrLoaderEffect(params: UseClassPlansLoaderParams) {
  const {
    selectedClassId,
    selectedClass,
    acwrLimits,
    setAcwrRatio,
    setAcwrMessage,
    setPainAlert,
    setPainAlertDates,
  } = params;

  useEffect(() => {
    let alive = true;

    if (!selectedClassId || !selectedClass) {
      setAcwrRatio(null);
      setAcwrMessage("");
      setPainAlert("");
      setPainAlertDates([]);
      return;
    }

    (async () => {
      const end = new Date();

      const start = new Date();

      start.setDate(end.getDate() - 28);

      const logs = await measureAsync(
        "screen.periodization.load.sessionLogs",
        () => getSessionLogsByRange(start.toISOString(), end.toISOString()),
        { screen: "periodization", classId: selectedClassId }
      );

      if (!alive) return;

      const classLogs = logs.filter((log) => log.classId === selectedClassId);

      const duration = selectedClass.durationMinutes ?? 60;

      const validation = validateAcwrLimits(acwrLimits);

      if (!validation.ok) {
        setAcwrRatio(null);
        setAcwrMessage("");
        return;
      }

      const { highValue: highLimit, lowValue: lowLimit } = validation;

      const weekKeyForDate = (value: string) => {
        const parsed = new Date(value);

        if (Number.isNaN(parsed.getTime())) return null;

        parsed.setHours(0, 0, 0, 0);

        const day = parsed.getDay();

        const diff = day === 0 ? -6 : 1 - day;

        parsed.setDate(parsed.getDate() + diff);

        return parsed.toISOString().slice(0, 10);
      };

      const acuteStart = new Date();

      acuteStart.setDate(end.getDate() - 7);

      const acuteLoad = classLogs
        .filter((log) => new Date(log.createdAt) >= acuteStart)
        .reduce((sum, log) => sum + log.PSE * duration, 0);

      const weeklyTotals: Record<string, number> = {};

      classLogs.forEach((log) => {
        const key = weekKeyForDate(log.createdAt);

        if (!key) return;

        weeklyTotals[key] = (weeklyTotals[key] ?? 0) + log.PSE * duration;
      });

      const weeklyLoads = Object.values(weeklyTotals);

      const chronicLoad = weeklyLoads.length
        ? weeklyLoads.reduce((sum, value) => sum + value, 0) / weeklyLoads.length
        : 0;

      if (chronicLoad > 0) {
        const ratio = Number((acuteLoad / chronicLoad).toFixed(2));

        const acuteLabel = Math.round(acuteLoad);

        const chronicLabel = Math.round(chronicLoad);

        setAcwrRatio(ratio);

        if (ratio > highLimit) {
          setAcwrMessage(
            `Carga subiu acima de ${highLimit}. (7d ${acuteLabel} / 28d ${chronicLabel})`
          );
        } else if (ratio < lowLimit) {
          setAcwrMessage(
            `Carga abaixo de ${lowLimit}. (7d ${acuteLabel} / 28d ${chronicLabel})`
          );
        } else {
          setAcwrMessage(
            `Carga dentro do esperado. (7d ${acuteLabel} / 28d ${chronicLabel})`
          );
        }
      } else {
        setAcwrRatio(null);
        setAcwrMessage("");
      }

      const painLogs = classLogs
        .filter((log) => typeof log.painScore === "number")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 3);

      const painHits = painLogs.filter((log) => (log.painScore ?? 0) >= 2);

      if (painHits.length >= 3) {
        setPainAlert("Dor nível 2+ por 3 registros. Considere avaliar com profissional.");
        setPainAlertDates(painHits.map((log) => formatDisplayDate(log.createdAt)));
      } else {
        setPainAlert("");
        setPainAlertDates([]);
      }
    })();

    return () => {
      alive = false;
    };

  }, [acwrLimits.high, acwrLimits.low, selectedClassId, selectedClass]); // eslint-disable-line react-hooks/exhaustive-deps
}

// ---------------------------------------------------------------------------
// Public composite hook
// ---------------------------------------------------------------------------

export function useClassPlansLoader(params: UseClassPlansLoaderParams): void {
  useClassPlansEffect(params);
  useAcwrLoaderEffect(params);
}
