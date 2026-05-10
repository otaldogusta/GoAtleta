import { readCache, writeCache } from "../../db/client";
import type { ScoutingAction } from "../../core/scouting-action";

const SCOUTING_ACTIONS_KEY = "scouting_actions_v1";

let actionsCache: ScoutingAction[] | null = null;

const sortByCreatedAtDesc = <T extends { createdAt: string }>(items: T[]) =>
  [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

async function loadActions() {
  if (actionsCache) return actionsCache;
  actionsCache = (await readCache<ScoutingAction[]>(SCOUTING_ACTIONS_KEY)) ?? [];
  return actionsCache;
}

export async function saveScoutingActionRecord(input: ScoutingAction) {
  const actions = await loadActions();
  const next = sortByCreatedAtDesc([...actions.filter((item) => item.id !== input.id), input]);
  actionsCache = next;
  await writeCache(SCOUTING_ACTIONS_KEY, next);
  return input;
}

export async function listScoutingActionRecords() {
  const actions = await loadActions();
  return sortByCreatedAtDesc(actions);
}

export async function deleteScoutingActionRecord(id: string) {
  const actions = await loadActions();
  const next = actions.filter((item) => item.id !== id);
  const changed = next.length !== actions.length;
  if (!changed) return false;
  actionsCache = sortByCreatedAtDesc(next);
  await writeCache(SCOUTING_ACTIONS_KEY, actionsCache);
  return true;
}

export async function resetScoutingActionStore() {
  actionsCache = [];
  await writeCache(SCOUTING_ACTIONS_KEY, []);
}
