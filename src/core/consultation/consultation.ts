import type {
  AvailableEquipment,
  ConsultationProgressSummary,
  CompletedExerciseLog,
  ConsultationGoal,
  OnlineConsultationProfile,
  PrescribedExercise,
  PrescribedWorkout,
  TrainingEnvironment,
  WorkoutAttentionSignal,
  WorkoutExecutionLog,
} from "./types";

const clampScale = (value: number | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.min(10, Math.round(value)));
};

const normalizeTextList = (items: string[] | undefined) =>
  (items ?? []).map((item) => item.trim()).filter(Boolean);

export function createConsultationProfile(params: {
  studentId: string;
  goal?: ConsultationGoal;
  environment?: TrainingEnvironment;
  availableEquipment?: AvailableEquipment[];
  restrictions?: string[];
  injuries?: string[];
  trainingDaysPerWeek?: number;
  preferredSessionDurationMin?: number;
  notes?: string;
}): OnlineConsultationProfile {
  const availableEquipment = params.availableEquipment?.length
    ? params.availableEquipment
    : (["peso_corporal"] as AvailableEquipment[]);

  return {
    studentId: params.studentId,
    goal: params.goal ?? "saude",
    environment: params.environment ?? "casa",
    availableEquipment,
    restrictions: normalizeTextList(params.restrictions),
    injuries: normalizeTextList(params.injuries),
    trainingDaysPerWeek: Math.max(1, Math.min(7, Math.round(params.trainingDaysPerWeek ?? 3))),
    preferredSessionDurationMin:
      typeof params.preferredSessionDurationMin === "number"
        ? Math.max(10, Math.min(180, Math.round(params.preferredSessionDurationMin)))
        : 45,
    notes: params.notes?.trim() || "",
  };
}

export function createPrescribedExercise(
  exercise: Omit<PrescribedExercise, "id"> & { id?: string },
  fallbackId: string
): PrescribedExercise {
  return {
    id: exercise.id || fallbackId,
    name: exercise.name.trim(),
    sets: exercise.sets && exercise.sets > 0 ? Math.round(exercise.sets) : undefined,
    reps: exercise.reps?.trim() || undefined,
    durationSec:
      exercise.durationSec && exercise.durationSec > 0 ? Math.round(exercise.durationSec) : undefined,
    restSec: exercise.restSec && exercise.restSec >= 0 ? Math.round(exercise.restSec) : undefined,
    load: exercise.load?.trim() || undefined,
    instructions: exercise.instructions?.trim() || undefined,
    alternatives: normalizeTextList(exercise.alternatives),
    mediaUrl: exercise.mediaUrl?.trim() || undefined,
  };
}

export function createPrescribedWorkout(params: {
  id: string;
  studentId: string;
  title: string;
  weekStartDate: string;
  dayLabel: string;
  objective: string;
  estimatedDurationMin?: number;
  exercises: PrescribedExercise[];
  coachNotes?: string;
  status?: PrescribedWorkout["status"];
}): PrescribedWorkout {
  const exercises = params.exercises
    .map((exercise, index) => createPrescribedExercise(exercise, `exercise-${index + 1}`))
    .filter((exercise) => exercise.name.length > 0);

  return {
    id: params.id,
    studentId: params.studentId,
    title: params.title.trim() || "Treino da semana",
    weekStartDate: params.weekStartDate,
    dayLabel: params.dayLabel.trim() || "Treino",
    objective: params.objective.trim() || "Manter rotina de treino com segurança.",
    estimatedDurationMin: Math.max(10, Math.min(180, Math.round(params.estimatedDurationMin ?? 45))),
    exercises,
    coachNotes: params.coachNotes?.trim() || "",
    status: params.status ?? "draft",
  };
}

export function isWorkoutValidForHome(profile: OnlineConsultationProfile, workout: PrescribedWorkout) {
  if (!workout.exercises.length) return false;
  if (profile.environment !== "casa") return true;
  if (profile.availableEquipment.includes("peso_corporal")) return true;
  return workout.exercises.every((exercise) => !exercise.load || exercise.load === "peso corporal");
}

export function createWorkoutExecutionLog(params: {
  id: string;
  workout: PrescribedWorkout;
  completedAt: string;
  perceivedExertion?: number;
  painLevel?: number;
  completedExercises?: CompletedExerciseLog[];
  studentFeedback?: string;
}): WorkoutExecutionLog {
  const completedExercises =
    params.completedExercises?.length
      ? params.completedExercises
      : params.workout.exercises.map((exercise) => ({
          exerciseId: exercise.id,
          completed: true,
        }));

  return {
    id: params.id,
    workoutId: params.workout.id,
    studentId: params.workout.studentId,
    completedAt: params.completedAt,
    perceivedExertion: clampScale(params.perceivedExertion),
    painLevel: clampScale(params.painLevel),
    completedExercises,
    studentFeedback: params.studentFeedback?.trim() || "",
    coachReviewStatus: "pending",
  };
}

export function getWorkoutAttentionSignal(log: WorkoutExecutionLog): WorkoutAttentionSignal {
  const pain = log.painLevel ?? 0;
  const pse = log.perceivedExertion ?? 0;

  if (pain >= 7) {
    return {
      tone: "danger",
      label: "Dor alta",
      description: "Revisar o treino antes da próxima sessão.",
    };
  }
  if (pain >= 4 || pse >= 8) {
    return {
      tone: "warning",
      label: "Pede atenção",
      description: "Ajustar carga, volume ou intervalo se necessário.",
    };
  }
  return {
    tone: "success",
    label: "Dentro do esperado",
    description: "Execução sem sinal crítico reportado.",
  };
}

export function markWorkoutExecutionReviewed(log: WorkoutExecutionLog): WorkoutExecutionLog {
  return { ...log, coachReviewStatus: "reviewed" };
}

export function buildWorkoutFeedbackSummary(
  workout: PrescribedWorkout,
  log: WorkoutExecutionLog
): string {
  const completed = log.completedExercises.filter((item) => item.completed).length;
  const total = Math.max(1, workout.exercises.length);
  const adherence = Math.round((completed / total) * 100);
  const pain = log.painLevel ?? 0;
  const pse = log.perceivedExertion ?? 0;
  const signal = getWorkoutAttentionSignal(log);

  return [
    `Treino realizado: ${workout.title}.`,
    `Adesão: ${adherence}% dos exercícios concluídos.`,
    `Esforço percebido: ${pse}/10. Dor reportada: ${pain}/10.`,
    log.studentFeedback ? `Comentário da aluna: ${log.studentFeedback}` : "Sem comentário adicional da aluna.",
    `Orientação para a próxima semana: ${signal.description}`,
  ].join(" ");
}

export function findNextStudentWorkout(
  workouts: PrescribedWorkout[],
  studentId: string
): PrescribedWorkout | null {
  return (
    workouts
      .filter((workout) => workout.studentId === studentId && workout.status === "published")
      .sort((a, b) => a.weekStartDate.localeCompare(b.weekStartDate))[0] ?? null
  );
}

const averageScale = (values: (number | undefined)[]) => {
  const validValues = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value)
  );
  if (!validValues.length) return null;
  return Math.round((validValues.reduce((sum, value) => sum + value, 0) / validValues.length) * 10) / 10;
};

export function buildConsultationProgressSummary(params: {
  studentId: string;
  workouts: PrescribedWorkout[];
  executionLogs: WorkoutExecutionLog[];
}): ConsultationProgressSummary {
  const studentWorkouts = params.workouts.filter((workout) => workout.studentId === params.studentId);
  const trackedWorkouts = studentWorkouts.filter((workout) =>
    workout.status === "published" || workout.status === "completed"
  );
  const studentLogs = params.executionLogs
    .filter((log) => log.studentId === params.studentId)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  const completedWorkoutIds = new Set(studentLogs.map((log) => log.workoutId));
  const workoutsCompleted = Array.from(completedWorkoutIds).filter((workoutId) =>
    trackedWorkouts.some((workout) => workout.id === workoutId)
  ).length;
  const workoutsPublished = trackedWorkouts.length;
  const adherencePercent = workoutsPublished > 0
    ? Math.round((workoutsCompleted / workoutsPublished) * 100)
    : 0;
  const recentLogs = studentLogs.slice(0, 3);
  const attentionFlags: ConsultationProgressSummary["attentionFlags"] = [];

  if (studentLogs.length < 3) attentionFlags.push("initial_history");
  if (recentLogs.some((log) => (log.painLevel ?? 0) >= 7)) attentionFlags.push("high_pain_recent");
  if (recentLogs.some((log) => (log.perceivedExertion ?? 0) >= 8)) attentionFlags.push("high_rpe_recent");
  if (workoutsPublished >= 3 && adherencePercent < 60) attentionFlags.push("low_adherence");

  return {
    studentId: params.studentId,
    workoutsPublished,
    workoutsCompleted,
    adherencePercent,
    averageRpe: averageScale(studentLogs.map((log) => log.perceivedExertion)),
    averagePain: averageScale(studentLogs.map((log) => log.painLevel)),
    lastCompletedAt: studentLogs[0]?.completedAt ?? null,
    attentionFlags,
  };
}
