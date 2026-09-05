import AsyncStorage from "@react-native-async-storage/async-storage";

import type { TrainingPlan } from "../../../core/models";

export type TrainingPlanWorkspaceDraft = {
  version: 1;
  savedAt: string;
  lessonDate: string;
  plan: TrainingPlan;
};

type TrainingPlanWorkspaceDraftScope = {
  userId: string | null | undefined;
  organizationId: string | null | undefined;
};

const WORKSPACE_DRAFT_PREFIX = "@goatleta/training-plan-workspace-draft/v1";
const WORKSPACE_LIBRARY_SUFFIX = "library";

// Storage writes and deletion must keep the order in which the user requested them.
const draftOperations = new Map<string, Promise<unknown>>();
const runDraftOperation = <T>(key: string, operation: () => Promise<T>): Promise<T> => {
  const previous = draftOperations.get(key);
  const current = previous ? previous.catch(() => undefined).then(operation) : operation();
  draftOperations.set(key, current);
  const release = () => {
    if (draftOperations.get(key) === current) draftOperations.delete(key);
  };
  void current.then(release, release);
  return current;
};

const sanitizeSegment = (value: string) => encodeURIComponent(value.trim());

export const buildTrainingPlanWorkspaceDraftKey = ({
  userId,
  organizationId,
}: TrainingPlanWorkspaceDraftScope): string | null => {
  const safeUserId = String(userId ?? "").trim();
  if (!safeUserId) return null;
  return [
    WORKSPACE_DRAFT_PREFIX,
    sanitizeSegment(safeUserId),
    sanitizeSegment(String(organizationId ?? "legacy")),
  ].join("/");
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

export const parseTrainingPlanWorkspaceDraft = (
  raw: string | null
): TrainingPlanWorkspaceDraft | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<TrainingPlanWorkspaceDraft>;
    const plan = parsed.plan as Partial<TrainingPlan> | undefined;
    if (
      parsed.version !== 1 ||
      typeof parsed.savedAt !== "string" ||
      typeof parsed.lessonDate !== "string" ||
      !plan ||
      typeof plan.id !== "string" ||
      typeof plan.classId !== "string" ||
      typeof plan.title !== "string" ||
      !isStringArray(plan.tags) ||
      !isStringArray(plan.warmup) ||
      !isStringArray(plan.main) ||
      !isStringArray(plan.cooldown) ||
      typeof plan.warmupTime !== "string" ||
      typeof plan.mainTime !== "string" ||
      typeof plan.cooldownTime !== "string" ||
      typeof plan.createdAt !== "string"
    ) {
      return null;
    }
    return parsed as TrainingPlanWorkspaceDraft;
  } catch {
    return null;
  }
};

export const loadTrainingPlanWorkspaceDraft = async (
  key: string | null
): Promise<TrainingPlanWorkspaceDraft | null> => {
  if (!key) return null;
  return runDraftOperation(key, async () =>
    parseTrainingPlanWorkspaceDraft(await AsyncStorage.getItem(key)));
};

export const saveTrainingPlanWorkspaceDraft = async (
  key: string | null,
  plan: TrainingPlan,
  lessonDate: string
): Promise<TrainingPlanWorkspaceDraft | null> => {
  if (!key) return null;
  const draft: TrainingPlanWorkspaceDraft = {
    version: 1,
    savedAt: new Date().toISOString(),
    lessonDate,
    plan,
  };
  await runDraftOperation(key, () => AsyncStorage.setItem(key, JSON.stringify(draft)));
  return draft;
};

export const clearTrainingPlanWorkspaceDraft = async (
  key: string | null
): Promise<void> => {
  if (!key) return;
  await runDraftOperation(key, () => AsyncStorage.removeItem(key));
};

const isValidWorkspacePlan = (plan: Partial<TrainingPlan> | null | undefined): plan is TrainingPlan =>
  Boolean(
    plan &&
    typeof plan.id === "string" &&
    typeof plan.classId === "string" &&
    typeof plan.title === "string" &&
    isStringArray(plan.tags) &&
    isStringArray(plan.warmup) &&
    isStringArray(plan.main) &&
    isStringArray(plan.cooldown) &&
    typeof plan.warmupTime === "string" &&
    typeof plan.mainTime === "string" &&
    typeof plan.cooldownTime === "string" &&
    typeof plan.createdAt === "string"
  );

const workspaceLibraryKey = (key: string | null) => key ? `${key}/${WORKSPACE_LIBRARY_SUFFIX}` : null;

export const loadTrainingPlanWorkspaceLibrary = async (
  key: string | null
): Promise<TrainingPlan[]> => {
  const libraryKey = workspaceLibraryKey(key);
  if (!libraryKey) return [];
  try {
    const raw = await AsyncStorage.getItem(libraryKey);
    const parsed = raw ? JSON.parse(raw) as { version?: number; plans?: Partial<TrainingPlan>[] } : null;
    if (parsed?.version !== 1 || !Array.isArray(parsed.plans)) return [];
    return parsed.plans.filter(isValidWorkspacePlan).filter((plan) => !plan.classId);
  } catch {
    return [];
  }
};

export const upsertTrainingPlanWorkspaceLibrary = async (
  key: string | null,
  plans: TrainingPlan[]
): Promise<TrainingPlan[]> => {
  const libraryKey = workspaceLibraryKey(key);
  if (!libraryKey) return [];
  const current = await loadTrainingPlanWorkspaceLibrary(key);
  const incoming = plans.filter((plan) => !plan.classId);
  const incomingIds = new Set(incoming.map((plan) => plan.id));
  const merged = [...incoming, ...current.filter((plan) => !incomingIds.has(plan.id))];
  await AsyncStorage.setItem(libraryKey, JSON.stringify({
    version: 1,
    savedAt: new Date().toISOString(),
    plans: merged,
  }));
  return merged;
};

export const removeTrainingPlanWorkspaceLibraryItem = async (
  key: string | null,
  planId: string
): Promise<TrainingPlan[]> => {
  const libraryKey = workspaceLibraryKey(key);
  if (!libraryKey) return [];
  const next = (await loadTrainingPlanWorkspaceLibrary(key)).filter((plan) => plan.id !== planId);
  if (next.length) {
    await AsyncStorage.setItem(libraryKey, JSON.stringify({
      version: 1,
      savedAt: new Date().toISOString(),
      plans: next,
    }));
  } else {
    await AsyncStorage.removeItem(libraryKey);
  }
  return next;
};
