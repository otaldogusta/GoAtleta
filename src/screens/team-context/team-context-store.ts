import { readCache, writeCache } from "../../db/client";
import type { CoachIntervention, ScoutingImpact, TeamEvent } from "../../core/team-context";

const TEAM_CONTEXT_EVENTS_KEY = "team_context_events_v1";
const TEAM_CONTEXT_INTERVENTIONS_KEY = "team_context_interventions_v1";
const TEAM_CONTEXT_SCOUTING_KEY = "team_context_scouting_v1";

let eventsCache: TeamEvent[] | null = null;
let interventionsCache: CoachIntervention[] | null = null;
let scoutingCache: ScoutingImpact[] | null = null;

const sortByDateDesc = <T extends { date: string; createdAt: string }>(items: T[]) =>
  [...items].sort((a, b) => {
    if (a.date === b.date) return b.createdAt.localeCompare(a.createdAt);
    return b.date.localeCompare(a.date);
  });

async function loadEvents() {
  if (eventsCache) return eventsCache;
  eventsCache = (await readCache<TeamEvent[]>(TEAM_CONTEXT_EVENTS_KEY)) ?? [];
  return eventsCache;
}

async function loadInterventions() {
  if (interventionsCache) return interventionsCache;
  interventionsCache =
    (await readCache<CoachIntervention[]>(TEAM_CONTEXT_INTERVENTIONS_KEY)) ?? [];
  return interventionsCache;
}

async function loadScoutingImpacts() {
  if (scoutingCache) return scoutingCache;
  scoutingCache = (await readCache<ScoutingImpact[]>(TEAM_CONTEXT_SCOUTING_KEY)) ?? [];
  return scoutingCache;
}

export async function createTeamEventRecord(input: TeamEvent) {
  const events = await loadEvents();
  const next = sortByDateDesc([...events.filter((item) => item.id !== input.id), input]);
  eventsCache = next;
  await writeCache(TEAM_CONTEXT_EVENTS_KEY, next);
  return input;
}

export async function listTeamEventRecords(classId: string) {
  const events = await loadEvents();
  return sortByDateDesc(events.filter((item) => item.classId === classId));
}

export async function createCoachInterventionRecord(input: CoachIntervention) {
  const interventions = await loadInterventions();
  const next = sortByDateDesc([
    ...interventions.filter((item) => item.id !== input.id),
    input,
  ]);
  interventionsCache = next;
  await writeCache(TEAM_CONTEXT_INTERVENTIONS_KEY, next);
  return input;
}

export async function listCoachInterventionRecords(classId: string) {
  const interventions = await loadInterventions();
  return sortByDateDesc(interventions.filter((item) => item.classId === classId));
}

export async function listScoutingImpactRecords(classId: string) {
  const impacts = await loadScoutingImpacts();
  return sortByDateDesc(impacts.filter((item) => item.classId === classId));
}

export async function createScoutingImpactRecord(input: ScoutingImpact) {
  const impacts = await loadScoutingImpacts();
  const next = sortByDateDesc([...impacts.filter((item) => item.id !== input.id), input]);
  scoutingCache = next;
  await writeCache(TEAM_CONTEXT_SCOUTING_KEY, next);
  return input;
}

export async function seedScoutingImpactRecords(records: ScoutingImpact[]) {
  scoutingCache = [...records];
  await writeCache(TEAM_CONTEXT_SCOUTING_KEY, scoutingCache);
}

export async function resetTeamContextStore() {
  eventsCache = [];
  interventionsCache = [];
  scoutingCache = [];
  await Promise.all([
    writeCache(TEAM_CONTEXT_EVENTS_KEY, []),
    writeCache(TEAM_CONTEXT_INTERVENTIONS_KEY, []),
    writeCache(TEAM_CONTEXT_SCOUTING_KEY, []),
  ]);
}
