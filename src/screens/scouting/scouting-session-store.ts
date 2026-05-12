import { readCache, writeCache } from "../../db/client";
import type { ScoutingSession } from "../../core/scouting-session";

const SCOUTING_SESSIONS_KEY = "scouting_sessions_v1";

let sessionsCache: ScoutingSession[] | null = null;

export type ScoutingSessionStoreKind = "memory" | "supabase";

export type ScoutingSessionStore = {
  readonly kind: ScoutingSessionStoreKind;
  save(input: ScoutingSession): Promise<ScoutingSession>;
  listByClass(classId: string): Promise<ScoutingSession[]>;
  get(id: string): Promise<ScoutingSession | null>;
  reset?(): Promise<void>;
};

const sortByDateDesc = <T extends { date: string; createdAt: string }>(items: T[]) =>
  [...items].sort((a, b) => {
    if (a.date === b.date) return b.createdAt.localeCompare(a.createdAt);
    return b.date.localeCompare(a.date);
  });

async function loadSessions() {
  if (sessionsCache) return sessionsCache;
  sessionsCache = (await readCache<ScoutingSession[]>(SCOUTING_SESSIONS_KEY)) ?? [];
  return sessionsCache;
}

export function createLocalScoutingSessionStore(): ScoutingSessionStore {
  return {
    kind: "memory",
    save: async (input) => {
      const sessions = await loadSessions();
      const next = sortByDateDesc([...sessions.filter((item) => item.id !== input.id), input]);
      sessionsCache = next;
      await writeCache(SCOUTING_SESSIONS_KEY, next);
      return input;
    },
    listByClass: async (classId) => {
      const sessions = await loadSessions();
      return sortByDateDesc(sessions.filter((item) => item.classId === classId));
    },
    get: async (id) => {
      const sessions = await loadSessions();
      return sessions.find((item) => item.id === id) ?? null;
    },
    reset: async () => {
      sessionsCache = [];
      await writeCache(SCOUTING_SESSIONS_KEY, []);
    },
  };
}

let activeScoutingSessionStore: ScoutingSessionStore = createLocalScoutingSessionStore();

export function setScoutingSessionStore(store: ScoutingSessionStore) {
  activeScoutingSessionStore = store;
}

export function getScoutingSessionStoreKind(): ScoutingSessionStoreKind {
  return activeScoutingSessionStore.kind;
}

export async function saveScoutingSessionRecord(input: ScoutingSession) {
  return activeScoutingSessionStore.save(input);
}

export async function listScoutingSessionRecords(classId: string) {
  return activeScoutingSessionStore.listByClass(classId);
}

export async function getScoutingSessionRecord(id: string) {
  return activeScoutingSessionStore.get(id);
}

export async function resetScoutingSessionStore() {
  setScoutingSessionStore(createLocalScoutingSessionStore());
  await activeScoutingSessionStore.reset?.();
}
