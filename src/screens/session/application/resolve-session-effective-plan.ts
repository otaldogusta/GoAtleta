import type {
  ClassGroup,
  ClassPlan,
  DailyLessonPlan,
  SessionEnvironment,
  TrainingPlan,
} from "../../../core/models";
import { convertDailyLessonPlanToTrainingPlan } from "./convert-daily-lesson-plan-to-training-plan";

export type SessionEffectivePlanSource =
  | "training_plan"
  | "daily_lesson_plan"
  | "generated_fallback"
  | "none";

export type SessionPlanConflict = {
  kind:
    | "environment_mismatch"
    | "daily_plan_newer"
    | "training_plan_newer"
    | "missing_training_plan"
    | "stale_training_plan";
  dailyLessonPlanId?: string;
  trainingPlanId?: string;
  dailyEnvironment?: SessionEnvironment;
  trainingEnvironment?: SessionEnvironment;
};

export type SessionEffectivePlanResult = {
  plan: TrainingPlan | null;
  source: SessionEffectivePlanSource;
  conflict: SessionPlanConflict | null;
};

export const CLEARED_DAILY_LESSON_PLAN_MODEL_VERSION = "manual-plan-cleared";

const normalizeEnvironment = (value: string | null | undefined): SessionEnvironment | null => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "quadra" || normalized === "academia" || normalized === "mista" || normalized === "preventiva") {
    return normalized;
  }
  return null;
};

const inferTrainingPlanEnvironment = (plan: TrainingPlan | null): SessionEnvironment | null => {
  if (!plan) return null;
  const text = [
    plan.title,
    ...(plan.tags ?? []),
    ...(plan.warmup ?? []),
    ...(plan.main ?? []),
    ...(plan.cooldown ?? []),
  ]
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (text.includes("academia") || text.includes("resistido")) return "academia";
  if (text.includes("mista") || text.includes("transferencia")) return "mista";
  if (text.includes("quadra")) return "quadra";
  return null;
};

const toTimestamp = (value: string | undefined) => {
  const time = Date.parse(value ?? "");
  return Number.isFinite(time) ? time : 0;
};

export async function resolveSessionEffectivePlan(input: {
  classGroup: ClassGroup;
  sessionDate: string;
  weekdayId: number;
  currentTrainingPlan: TrainingPlan | null;
  currentClassPlan: ClassPlan | null;
  currentDailyLessonPlan: DailyLessonPlan | null;
  studentsCount: number;
}): Promise<SessionEffectivePlanResult> {
  const {
    classGroup,
    sessionDate,
    weekdayId,
    currentTrainingPlan,
    currentClassPlan,
    currentDailyLessonPlan,
    studentsCount,
  } = input;

  if (currentDailyLessonPlan) {
    if (
      currentDailyLessonPlan.generationModelVersion ===
      CLEARED_DAILY_LESSON_PLAN_MODEL_VERSION
    ) {
      return {
        plan: null,
        source: "none",
        conflict: null,
      };
    }

    const dailyEnvironment = normalizeEnvironment(currentDailyLessonPlan.sessionEnvironment) ?? "quadra";
    const trainingEnvironment = inferTrainingPlanEnvironment(currentTrainingPlan);
    const dailyUpdatedAt = toTimestamp(
      currentDailyLessonPlan.lastManualEditedAt || currentDailyLessonPlan.updatedAt
    );
    const trainingUpdatedAt = toTimestamp(currentTrainingPlan?.finalizedAt || currentTrainingPlan?.createdAt);
    const convertedPlan = convertDailyLessonPlanToTrainingPlan({
      dailyPlan: currentDailyLessonPlan,
      classPlan: currentClassPlan,
      classGroup,
      studentsCount,
      sessionDate,
      weekdayId,
    });

    let conflict: SessionPlanConflict | null = currentTrainingPlan
      ? null
      : {
          kind: "missing_training_plan",
          dailyLessonPlanId: currentDailyLessonPlan.id,
          dailyEnvironment,
        };

    if (
      currentTrainingPlan &&
      trainingEnvironment &&
      dailyEnvironment !== trainingEnvironment
    ) {
      conflict = {
        kind: "environment_mismatch",
        dailyLessonPlanId: currentDailyLessonPlan.id,
        trainingPlanId: currentTrainingPlan.id,
        dailyEnvironment,
        trainingEnvironment,
      };
    } else if (currentTrainingPlan && dailyUpdatedAt > trainingUpdatedAt) {
      conflict = {
        kind: "daily_plan_newer",
        dailyLessonPlanId: currentDailyLessonPlan.id,
        trainingPlanId: currentTrainingPlan.id,
        dailyEnvironment,
        trainingEnvironment: trainingEnvironment ?? undefined,
      };
    }

    return {
      plan: convertedPlan,
      source: "daily_lesson_plan",
      conflict,
    };
  }

  if (currentTrainingPlan) {
    return {
      plan: currentTrainingPlan,
      source: currentTrainingPlan.origin === "auto" ? "generated_fallback" : "training_plan",
      conflict: null,
    };
  }

  return {
    plan: null,
    source: "none",
    conflict: null,
  };
}
