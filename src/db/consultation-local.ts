import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  OnlineConsultationProfile,
  PrescribedWorkout,
  WorkoutExecutionLog,
} from "../core/consultation";
import { markWorkoutExecutionReviewed } from "../core/consultation";
import { assertConsultationContext, type ConsultationContext } from "./consultation-context";

// v1 has no verifiable owner. Leave it intact; never infer ownership from the active account.
const STORAGE_PREFIX = "goatleta_consultation_v2";
const mutationTails = new Map<string, Promise<void>>();
const storageKey = (context: ConsultationContext) =>
  `${STORAGE_PREFIX}:${encodeURIComponent(context.identity.userId)}:${encodeURIComponent(context.organizationId)}`;

export type ConsultationLocalState = {
  profiles: OnlineConsultationProfile[];
  workouts: PrescribedWorkout[];
  executionLogs: WorkoutExecutionLog[];
};

const emptyState = (): ConsultationLocalState => ({
  profiles: [],
  workouts: [],
  executionLogs: [],
});

export async function getConsultationLocalState(context: ConsultationContext): Promise<ConsultationLocalState> {
  await assertConsultationContext(context);
  const raw = await AsyncStorage.getItem(storageKey(context));
  await assertConsultationContext(context);
  if (!raw) return emptyState();
  let parsed: {
    version?: number;
    userId?: string;
    organizationId?: string;
    state?: ConsultationLocalState;
  };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Os dados locais da consultoria precisam de revisão. O original foi preservado.");
  }
  if (!parsed || parsed.version !== 2 || parsed.userId !== context.identity.userId ||
      parsed.organizationId !== context.organizationId || !parsed.state ||
      !Array.isArray(parsed.state.profiles) || !Array.isArray(parsed.state.workouts) ||
      !Array.isArray(parsed.state.executionLogs)) {
    throw new Error("Os dados locais da consultoria precisam de revisão. O original foi preservado.");
  }
  return parsed.state;
}

async function mutateLocalState(
  context: ConsultationContext,
  update: (state: ConsultationLocalState) => ConsultationLocalState,
) {
  await assertConsultationContext(context);
  const key = storageKey(context);
  const previous = mutationTails.get(key) ?? Promise.resolve();
  const operation = previous.then(async () => {
    const state = await getConsultationLocalState(context);
    const next = update(state);
    await assertConsultationContext(context);
    await AsyncStorage.setItem(key, JSON.stringify({
      version: 2, userId: context.identity.userId, organizationId: context.organizationId, state: next,
    }));
    // A write already submitted stays under its original owner; never report it to a new one.
    await assertConsultationContext(context);
  });
  const tail = operation.catch(() => {});
  mutationTails.set(key, tail);
  try {
    await operation;
  } finally {
    if (mutationTails.get(key) === tail) mutationTails.delete(key);
  }
}

export async function saveConsultationProfile(profile: OnlineConsultationProfile, context: ConsultationContext) {
  await mutateLocalState(context, (state) => ({
    ...state,
    profiles: [profile, ...state.profiles.filter((item) => item.studentId !== profile.studentId)],
  }));
}

export async function savePrescribedWorkout(workout: PrescribedWorkout, context: ConsultationContext) {
  await mutateLocalState(context, (state) => ({
    ...state,
    workouts: [workout, ...state.workouts.filter((item) => item.id !== workout.id)],
  }));
}

export async function deletePrescribedWorkout(workoutId: string, context: ConsultationContext) {
  await mutateLocalState(context, (state) => ({
    ...state,
    workouts: state.workouts.filter((item) => item.id !== workoutId),
    executionLogs: state.executionLogs.filter((item) => item.workoutId !== workoutId),
  }));
}

export async function saveWorkoutExecutionLog(log: WorkoutExecutionLog, context: ConsultationContext) {
  await mutateLocalState(context, (state) => ({
    ...state,
    workouts: state.workouts.map((workout) =>
      workout.id === log.workoutId ? { ...workout, status: "completed" } : workout
    ),
    executionLogs: [log, ...state.executionLogs.filter((item) => item.id !== log.id)],
  }));
}

export async function markExecutionLogReviewed(logId: string, context: ConsultationContext) {
  await mutateLocalState(context, (state) => ({
    ...state,
    executionLogs: state.executionLogs.map((log) =>
      log.id === logId ? markWorkoutExecutionReviewed(log) : log
    ),
  }));
}
