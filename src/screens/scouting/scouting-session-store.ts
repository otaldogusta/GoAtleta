import { readCache, writeCache } from "../../db/client";
import type { ScoutingSession } from "../../core/scouting-session";

const SCOUTING_SESSIONS_KEY = "scouting_sessions_v1";

let sessionsCache: ScoutingSession[] | null = null;

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

export async function saveScoutingSessionRecord(input: ScoutingSession) {
  const sessions = await loadSessions();
  const next = sortByDateDesc([...sessions.filter((item) => item.id !== input.id), input]);
  sessionsCache = next;
  await writeCache(SCOUTING_SESSIONS_KEY, next);
  return input;
}

export async function listScoutingSessionRecords(classId: string) {
  const sessions = await loadSessions();
  return sortByDateDesc(sessions.filter((item) => item.classId === classId));
}

export async function getScoutingSessionRecord(id: string) {
  const sessions = await loadSessions();
  return sessions.find((item) => item.id === id) ?? null;
}

export async function resetScoutingSessionStore() {
  sessionsCache = [];
  await writeCache(SCOUTING_SESSIONS_KEY, []);
}
