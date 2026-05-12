import { readCache, writeCache } from "../../db/client";
import type { ScoutingAction } from "../../core/scouting-action";

const SCOUTING_ACTIONS_KEY = "scouting_actions_v1";

let actionsCache: ScoutingAction[] | null = null;

export type ScoutingActionStoreKind = "memory" | "supabase";

export type ScoutingActionStore = {
  readonly kind: ScoutingActionStoreKind;
  save(input: ScoutingAction): Promise<ScoutingAction>;
  list(): Promise<ScoutingAction[]>;
  listBySession(scoutingSessionId: string): Promise<ScoutingAction[]>;
  listByClass(classId: string): Promise<ScoutingAction[]>;
  listByAthlete(athleteId: string): Promise<ScoutingAction[]>;
  delete(id: string): Promise<boolean>;
  reset?(): Promise<void>;
};

const sortByCreatedAtDesc = <T extends { createdAt: string }>(items: T[]) =>
  [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

async function loadActions() {
  if (actionsCache) return actionsCache;
  actionsCache = (await readCache<ScoutingAction[]>(SCOUTING_ACTIONS_KEY)) ?? [];
  return actionsCache;
}

export function createLocalScoutingActionStore(): ScoutingActionStore {
  return {
    kind: "memory",
    save: async (input) => {
      const actions = await loadActions();
      const next = sortByCreatedAtDesc([...actions.filter((item) => item.id !== input.id), input]);
      actionsCache = next;
      await writeCache(SCOUTING_ACTIONS_KEY, next);
      return input;
    },
    list: async () => {
      const actions = await loadActions();
      return sortByCreatedAtDesc(actions);
    },
    listBySession: async (scoutingSessionId) => {
      const actions = await loadActions();
      return sortByCreatedAtDesc(actions.filter((item) => item.scoutingSessionId === scoutingSessionId));
    },
    listByClass: async (classId) => {
      const actions = await loadActions();
      return sortByCreatedAtDesc(actions.filter((item) => item.classId === classId));
    },
    listByAthlete: async (athleteId) => {
      const actions = await loadActions();
      return sortByCreatedAtDesc(actions.filter((item) => item.athleteId === athleteId));
    },
    delete: async (id) => {
      const actions = await loadActions();
      const next = actions.filter((item) => item.id !== id);
      const changed = next.length !== actions.length;
      if (!changed) return false;
      actionsCache = sortByCreatedAtDesc(next);
      await writeCache(SCOUTING_ACTIONS_KEY, actionsCache);
      return true;
    },
    reset: async () => {
      actionsCache = [];
      await writeCache(SCOUTING_ACTIONS_KEY, []);
    },
  };
}

let activeScoutingActionStore: ScoutingActionStore = createLocalScoutingActionStore();

export function setScoutingActionStore(store: ScoutingActionStore) {
  activeScoutingActionStore = store;
}

export function getScoutingActionStoreKind(): ScoutingActionStoreKind {
  return activeScoutingActionStore.kind;
}

export async function saveScoutingActionRecord(input: ScoutingAction) {
  return activeScoutingActionStore.save(input);
}

export async function listScoutingActionRecords() {
  return activeScoutingActionStore.list();
}

export async function listScoutingActionRecordsBySession(scoutingSessionId: string) {
  return activeScoutingActionStore.listBySession(scoutingSessionId);
}

export async function listScoutingActionRecordsByClass(classId: string) {
  return activeScoutingActionStore.listByClass(classId);
}

export async function listScoutingActionRecordsByAthlete(athleteId: string) {
  return activeScoutingActionStore.listByAthlete(athleteId);
}

export async function deleteScoutingActionRecord(id: string) {
  return activeScoutingActionStore.delete(id);
}

export async function resetScoutingActionStore() {
  setScoutingActionStore(createLocalScoutingActionStore());
  await activeScoutingActionStore.reset?.();
}
