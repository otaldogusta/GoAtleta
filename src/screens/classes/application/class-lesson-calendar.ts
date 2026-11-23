import { calculateAdjacentClassDate } from "../../../utils/whatsapp-templates";
import { parseClassWorkspaceRouteDate } from "../class-workspace-route";
import { toLocalDateKey } from "./class-session-coverage";

export function adjacentClassLesson(
  classDays: number[], reference: Date, direction: -1 | 1,
  paused: ReadonlyMap<string, string>, makeupDates: readonly string[],
) {
  let regular = calculateAdjacentClassDate(classDays, reference, direction);
  while (regular && paused.has(toLocalDateKey(regular))) {
    regular = calculateAdjacentClassDate(classDays, regular, direction);
  }
  const referenceKey = toLocalDateKey(reference);
  let nearest = regular ? toLocalDateKey(regular) : null;
  for (const date of makeupDates) {
    if (paused.has(date)) continue;
    if (direction === 1 && date > referenceKey && (!nearest || date < nearest)) nearest = date;
    if (direction === -1 && date < referenceKey && (!nearest || date > nearest)) nearest = date;
  }
  return nearest ? parseClassWorkspaceRouteDate(nearest) : null;
}

export function resolveAttendanceEntryDate(
  reference: Date | null, explicit: boolean, classDays: number[], paused: ReadonlyMap<string, string>,
  makeupDates: readonly string[], calendarReady: boolean,
) {
  if (!reference) return null;
  const date = toLocalDateKey(reference);
  if (explicit || classDays.includes(reference.getDay()) || paused.has(date) || makeupDates.includes(date)) return reference;
  if (!calendarReady) return null;
  return adjacentClassLesson(classDays, reference, -1, paused, makeupDates);
}
