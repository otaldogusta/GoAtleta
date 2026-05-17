import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  OnlineConsultationProfile,
  PrescribedWorkout,
  WorkoutExecutionLog,
} from "../core/consultation";
import { markWorkoutExecutionReviewed } from "../core/consultation";

const STORAGE_KEY = "goatleta_consultation_v1";

export type ConsultationLocalState = {
  profiles: OnlineConsultationProfile[];
  workouts: PrescribedWorkout[];
  executionLogs: WorkoutExecutionLog[];
};

const EMPTY_STATE: ConsultationLocalState = {
  profiles: [],
  workouts: [],
  executionLogs: [],
};

export async function getConsultationLocalState(): Promise<ConsultationLocalState> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return EMPTY_STATE;
  try {
    const parsed = JSON.parse(raw) as Partial<ConsultationLocalState>;
    return {
      profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
      workouts: Array.isArray(parsed.workouts) ? parsed.workouts : [],
      executionLogs: Array.isArray(parsed.executionLogs) ? parsed.executionLogs : [],
    };
  } catch {
    return EMPTY_STATE;
  }
}

async function writeConsultationLocalState(state: ConsultationLocalState) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export async function saveConsultationProfile(profile: OnlineConsultationProfile) {
  const state = await getConsultationLocalState();
  await writeConsultationLocalState({
    ...state,
    profiles: [profile, ...state.profiles.filter((item) => item.studentId !== profile.studentId)],
  });
}

export async function savePrescribedWorkout(workout: PrescribedWorkout) {
  const state = await getConsultationLocalState();
  await writeConsultationLocalState({
    ...state,
    workouts: [workout, ...state.workouts.filter((item) => item.id !== workout.id)],
  });
}

export async function saveWorkoutExecutionLog(log: WorkoutExecutionLog) {
  const state = await getConsultationLocalState();
  await writeConsultationLocalState({
    ...state,
    workouts: state.workouts.map((workout) =>
      workout.id === log.workoutId ? { ...workout, status: "completed" } : workout
    ),
    executionLogs: [log, ...state.executionLogs.filter((item) => item.id !== log.id)],
  });
}

export async function markExecutionLogReviewed(logId: string) {
  const state = await getConsultationLocalState();
  await writeConsultationLocalState({
    ...state,
    executionLogs: state.executionLogs.map((log) =>
      log.id === logId ? markWorkoutExecutionReviewed(log) : log
    ),
  });
}
