import type {
  AvailableEquipment,
  ConsultationGoal,
  OnlineConsultationProfile,
  PrescribedExercise,
  PrescribedWorkout,
  PrescribedWorkoutStatus,
  TrainingEnvironment,
  WorkoutExecutionLog,
} from "../core/consultation";
import { markWorkoutExecutionReviewed } from "../core/consultation";
import {
  deletePrescribedWorkout as deleteLocalPrescribedWorkout,
  getConsultationLocalState as getLocalConsultationState,
  markExecutionLogReviewed as markLocalExecutionLogReviewed,
  saveConsultationProfile as saveLocalConsultationProfile,
  savePrescribedWorkout as saveLocalPrescribedWorkout,
  saveWorkoutExecutionLog as saveLocalWorkoutExecutionLog,
  type ConsultationLocalState,
} from "./consultation-local";
import {
  getActiveOrganizationId,
  isAuthError,
  isMissingRelation,
  isNetworkError,
  isPermissionError,
  supabaseDelete,
  supabaseGet,
  supabasePatch,
  supabasePost,
} from "./client";

export type { ConsultationLocalState };

type ConsultationProfileRow = {
  id: string;
  organization_id: string;
  student_id: string;
  coach_id?: string | null;
  goal: string;
  environment: string;
  available_equipment?: unknown;
  restrictions?: unknown;
  injuries?: unknown;
  training_days_per_week: number;
  preferred_session_duration_min?: number | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type PrescribedWorkoutRow = {
  id: string;
  organization_id: string;
  student_id: string;
  coach_id?: string | null;
  title: string;
  week_start_date: string;
  day_label: string;
  objective: string;
  estimated_duration_min?: number | null;
  coach_notes?: string | null;
  status: string;
  published_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type PrescribedExerciseRow = {
  id: string;
  organization_id: string;
  workout_id: string;
  name: string;
  order_index: number;
  sets?: number | null;
  reps?: string | null;
  duration_sec?: number | null;
  rest_sec?: number | null;
  load?: string | null;
  instructions?: string | null;
  alternatives?: unknown;
  media_url?: string | null;
  created_at?: string | null;
};

type WorkoutExecutionLogRow = {
  id: string;
  organization_id: string;
  workout_id: string;
  student_id: string;
  completed_at: string;
  perceived_exertion?: number | null;
  pain_level?: number | null;
  student_feedback?: string | null;
  coach_review_status?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  created_at?: string | null;
};

type CompletedExerciseLogRow = {
  id: string;
  organization_id: string;
  execution_log_id: string;
  exercise_id?: string | null;
  completed: boolean;
  sets_done?: number | null;
  reps_done?: string | null;
  load_used?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

const CONSULTATION_TABLES = [
  "consultation_profiles",
  "prescribed_workouts",
  "prescribed_exercises",
  "workout_execution_logs",
  "completed_exercise_logs",
];

const isConsultationSchemaUnavailable = (error: unknown) =>
  CONSULTATION_TABLES.some((table) => isMissingRelation(error, table));

const shouldUseLocalFallback = (error: unknown) =>
  isConsultationSchemaUnavailable(error) ||
  isAuthError(error) ||
  isNetworkError(error) ||
  isPermissionError(error);

const asStringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];

const asEquipmentList = (value: unknown): AvailableEquipment[] =>
  asStringList(value) as AvailableEquipment[];

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

export const buildConsultationProfileId = (studentId: string) =>
  `consult_profile_${hashString(studentId)}`;

const buildCompletedExerciseLogId = (executionLogId: string, exerciseId: string, index: number) =>
  `cel_${hashString(`${executionLogId}|${exerciseId}|${index}`)}`;

const orgFilter = (organizationId: string) => `organization_id=eq.${encodeURIComponent(organizationId)}`;

export const buildConsultationProfilePayload = (
  profile: OnlineConsultationProfile,
  organizationId: string
) => ({
  id: buildConsultationProfileId(profile.studentId),
  organization_id: organizationId,
  student_id: profile.studentId,
  goal: profile.goal,
  environment: profile.environment,
  available_equipment: profile.availableEquipment ?? [],
  restrictions: profile.restrictions ?? [],
  injuries: profile.injuries ?? [],
  training_days_per_week: profile.trainingDaysPerWeek,
  preferred_session_duration_min: profile.preferredSessionDurationMin ?? null,
  notes: profile.notes?.trim() || null,
  updated_at: new Date().toISOString(),
});

export const mapConsultationProfileRow = (row: ConsultationProfileRow): OnlineConsultationProfile => ({
  studentId: row.student_id,
  goal: row.goal as ConsultationGoal,
  environment: row.environment as TrainingEnvironment,
  availableEquipment: asEquipmentList(row.available_equipment),
  restrictions: asStringList(row.restrictions),
  injuries: asStringList(row.injuries),
  trainingDaysPerWeek: row.training_days_per_week,
  preferredSessionDurationMin: row.preferred_session_duration_min ?? undefined,
  notes: row.notes ?? "",
});

export const buildPrescribedWorkoutPayload = (
  workout: PrescribedWorkout,
  organizationId: string
) => ({
  id: workout.id,
  organization_id: organizationId,
  student_id: workout.studentId,
  title: workout.title,
  week_start_date: workout.weekStartDate,
  day_label: workout.dayLabel,
  objective: workout.objective,
  estimated_duration_min: workout.estimatedDurationMin,
  coach_notes: workout.coachNotes?.trim() || null,
  status: workout.status,
  published_at: workout.status === "published" ? new Date().toISOString() : null,
  updated_at: new Date().toISOString(),
});

export const buildPrescribedExercisePayloads = (
  workout: PrescribedWorkout,
  organizationId: string
) =>
  workout.exercises.map((exercise, index) => ({
    id: exercise.id,
    organization_id: organizationId,
    workout_id: workout.id,
    name: exercise.name,
    order_index: index,
    sets: exercise.sets ?? null,
    reps: exercise.reps ?? null,
    duration_sec: exercise.durationSec ?? null,
    rest_sec: exercise.restSec ?? null,
    load: exercise.load ?? null,
    instructions: exercise.instructions ?? null,
    alternatives: exercise.alternatives ?? [],
    media_url: exercise.mediaUrl ?? null,
  }));

const mapPrescribedExerciseRow = (row: PrescribedExerciseRow): PrescribedExercise => ({
  id: row.id,
  name: row.name,
  sets: row.sets ?? undefined,
  reps: row.reps ?? undefined,
  durationSec: row.duration_sec ?? undefined,
  restSec: row.rest_sec ?? undefined,
  load: row.load ?? undefined,
  instructions: row.instructions ?? undefined,
  alternatives: asStringList(row.alternatives),
  mediaUrl: row.media_url ?? undefined,
});

export const mapPrescribedWorkoutRows = (
  workoutRows: PrescribedWorkoutRow[],
  exerciseRows: PrescribedExerciseRow[]
): PrescribedWorkout[] => {
  const exercisesByWorkout = new Map<string, PrescribedExerciseRow[]>();
  for (const row of exerciseRows) {
    const list = exercisesByWorkout.get(row.workout_id) ?? [];
    list.push(row);
    exercisesByWorkout.set(row.workout_id, list);
  }

  return workoutRows.map((row) => ({
    id: row.id,
    studentId: row.student_id,
    title: row.title,
    weekStartDate: row.week_start_date,
    dayLabel: row.day_label,
    objective: row.objective,
    estimatedDurationMin: row.estimated_duration_min ?? 45,
    exercises: (exercisesByWorkout.get(row.id) ?? [])
      .sort((a, b) => a.order_index - b.order_index)
      .map(mapPrescribedExerciseRow),
    coachNotes: row.coach_notes ?? "",
    status: row.status as PrescribedWorkoutStatus,
  }));
};

export const buildWorkoutExecutionPayload = (
  log: WorkoutExecutionLog,
  organizationId: string
) => ({
  id: log.id,
  organization_id: organizationId,
  workout_id: log.workoutId,
  student_id: log.studentId,
  completed_at: log.completedAt,
  perceived_exertion: log.perceivedExertion ?? null,
  pain_level: log.painLevel ?? null,
  student_feedback: log.studentFeedback?.trim() || null,
  coach_review_status: log.coachReviewStatus ?? "pending",
});

export const buildCompletedExercisePayloads = (
  log: WorkoutExecutionLog,
  organizationId: string
) =>
  log.completedExercises.map((exercise, index) => ({
    id: buildCompletedExerciseLogId(log.id, exercise.exerciseId, index),
    organization_id: organizationId,
    execution_log_id: log.id,
    exercise_id: exercise.exerciseId || null,
    completed: exercise.completed,
    sets_done: exercise.setsDone ?? null,
    reps_done: exercise.repsDone ?? null,
    load_used: exercise.loadUsed ?? null,
    notes: exercise.notes?.trim() || null,
  }));

export const mapWorkoutExecutionRows = (
  logRows: WorkoutExecutionLogRow[],
  exerciseRows: CompletedExerciseLogRow[]
): WorkoutExecutionLog[] => {
  const exercisesByLog = new Map<string, CompletedExerciseLogRow[]>();
  for (const row of exerciseRows) {
    const list = exercisesByLog.get(row.execution_log_id) ?? [];
    list.push(row);
    exercisesByLog.set(row.execution_log_id, list);
  }

  return logRows.map((row) => ({
    id: row.id,
    workoutId: row.workout_id,
    studentId: row.student_id,
    completedAt: row.completed_at,
    perceivedExertion: row.perceived_exertion ?? undefined,
    painLevel: row.pain_level ?? undefined,
    completedExercises: (exercisesByLog.get(row.id) ?? []).map((exercise) => ({
      exerciseId: exercise.exercise_id ?? "",
      completed: exercise.completed,
      setsDone: exercise.sets_done ?? undefined,
      repsDone: exercise.reps_done ?? undefined,
      loadUsed: exercise.load_used ?? undefined,
      notes: exercise.notes ?? undefined,
    })),
    studentFeedback: row.student_feedback ?? "",
    coachReviewStatus: row.coach_review_status === "reviewed" ? "reviewed" : "pending",
  }));
};

async function getOrganizationIdOrFallback() {
  const organizationId = await getActiveOrganizationId();
  return organizationId?.trim() || null;
}

export async function getConsultationLocalState(): Promise<ConsultationLocalState> {
  const organizationId = await getOrganizationIdOrFallback();
  if (!organizationId) return getLocalConsultationState();

  try {
    const filter = orgFilter(organizationId);
    const [profiles, workouts, exercises, logs, completedExercises] = await Promise.all([
      supabaseGet<ConsultationProfileRow[]>(`/consultation_profiles?${filter}&select=*&order=updated_at.desc`),
      supabaseGet<PrescribedWorkoutRow[]>(`/prescribed_workouts?${filter}&select=*&order=updated_at.desc`),
      supabaseGet<PrescribedExerciseRow[]>(`/prescribed_exercises?${filter}&select=*&order=order_index.asc`),
      supabaseGet<WorkoutExecutionLogRow[]>(`/workout_execution_logs?${filter}&select=*&order=completed_at.desc`),
      supabaseGet<CompletedExerciseLogRow[]>(`/completed_exercise_logs?${filter}&select=*`),
    ]);

    return {
      profiles: profiles.map(mapConsultationProfileRow),
      workouts: mapPrescribedWorkoutRows(workouts, exercises),
      executionLogs: mapWorkoutExecutionRows(logs, completedExercises),
    };
  } catch (error) {
    if (shouldUseLocalFallback(error)) return getLocalConsultationState();
    throw error;
  }
}

export async function saveConsultationProfile(profile: OnlineConsultationProfile) {
  const organizationId = await getOrganizationIdOrFallback();
  if (!organizationId) return saveLocalConsultationProfile(profile);

  try {
    await supabasePost(
      "/consultation_profiles?on_conflict=organization_id,student_id",
      [buildConsultationProfilePayload(profile, organizationId)],
      { Prefer: "resolution=merge-duplicates" }
    );
  } catch (error) {
    if (shouldUseLocalFallback(error)) return saveLocalConsultationProfile(profile);
    throw error;
  }
}

export async function getConsultationProfileByStudent(studentId: string) {
  const state = await getConsultationLocalState();
  return state.profiles.find((profile) => profile.studentId === studentId) ?? null;
}

export async function savePrescribedWorkout(workout: PrescribedWorkout) {
  const organizationId = await getOrganizationIdOrFallback();
  if (!organizationId) return saveLocalPrescribedWorkout(workout);

  try {
    await supabasePost(
      "/prescribed_workouts?on_conflict=id",
      [buildPrescribedWorkoutPayload(workout, organizationId)],
      { Prefer: "resolution=merge-duplicates" }
    );
    await supabaseDelete(
      `/prescribed_exercises?workout_id=eq.${encodeURIComponent(workout.id)}&${orgFilter(organizationId)}`
    );
    const exercisePayloads = buildPrescribedExercisePayloads(workout, organizationId);
    if (exercisePayloads.length) {
      await supabasePost("/prescribed_exercises", exercisePayloads, {
        Prefer: "resolution=merge-duplicates",
      });
    }
  } catch (error) {
    if (shouldUseLocalFallback(error)) return saveLocalPrescribedWorkout(workout);
    throw error;
  }
}

export async function publishWorkout(workout: PrescribedWorkout) {
  return savePrescribedWorkout({ ...workout, status: "published" });
}

export async function deletePrescribedWorkout(workoutId: string) {
  const organizationId = await getOrganizationIdOrFallback();
  if (!organizationId) return deleteLocalPrescribedWorkout(workoutId);

  try {
    await supabaseDelete(
      `/prescribed_workouts?id=eq.${encodeURIComponent(workoutId)}&${orgFilter(organizationId)}`
    );
  } catch (error) {
    if (shouldUseLocalFallback(error)) return deleteLocalPrescribedWorkout(workoutId);
    throw error;
  }
}

export async function listPublishedWorkoutsForStudent(studentId: string) {
  const state = await getConsultationLocalState();
  return state.workouts.filter(
    (workout) => workout.studentId === studentId && workout.status === "published"
  );
}

export async function saveWorkoutExecutionLog(log: WorkoutExecutionLog) {
  const organizationId = await getOrganizationIdOrFallback();
  if (!organizationId) return saveLocalWorkoutExecutionLog(log);

  try {
    await supabasePost(
      "/workout_execution_logs?on_conflict=id",
      [buildWorkoutExecutionPayload(log, organizationId)],
      { Prefer: "resolution=merge-duplicates" }
    );
    await supabaseDelete(
      `/completed_exercise_logs?execution_log_id=eq.${encodeURIComponent(log.id)}&${orgFilter(organizationId)}`
    );
    const exercisePayloads = buildCompletedExercisePayloads(log, organizationId);
    if (exercisePayloads.length) {
      await supabasePost("/completed_exercise_logs", exercisePayloads, {
        Prefer: "resolution=merge-duplicates",
      });
    }
    await supabasePatch(
      `/prescribed_workouts?id=eq.${encodeURIComponent(log.workoutId)}&${orgFilter(organizationId)}`,
      { status: "completed", updated_at: new Date().toISOString() }
    );
  } catch (error) {
    if (shouldUseLocalFallback(error)) return saveLocalWorkoutExecutionLog(log);
    throw error;
  }
}

export const submitWorkoutExecution = saveWorkoutExecutionLog;

export async function listExecutionsForCoach() {
  const state = await getConsultationLocalState();
  return state.executionLogs;
}

export async function markExecutionLogReviewed(logId: string) {
  const organizationId = await getOrganizationIdOrFallback();
  if (!organizationId) return markLocalExecutionLogReviewed(logId);

  try {
    await supabasePatch(
      `/workout_execution_logs?id=eq.${encodeURIComponent(logId)}&${orgFilter(organizationId)}`,
      {
        coach_review_status: "reviewed",
        reviewed_at: new Date().toISOString(),
      }
    );
  } catch (error) {
    if (shouldUseLocalFallback(error)) return markLocalExecutionLogReviewed(logId);
    throw error;
  }
}

export const markWorkoutExecutionLogReviewed = markWorkoutExecutionReviewed;
