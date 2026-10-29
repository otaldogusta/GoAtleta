import type { EventListItem, EventSport, EventType } from "../../../api/events";

export type EventDraft = { title: string; description: string; startDate: string; endDate: string; startTime: string; endTime: string; allDay: boolean; locationLabel: string; eventType: EventType; sport: EventSport; classIds: string[] };
const pad = (value: number) => String(value).padStart(2, "0");
const dateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const timeKey = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
export function initialEventDraft(date: string, event?: EventListItem): EventDraft {
  const start = event ? new Date(event.startsAt) : null;
  const end = event ? new Date(event.endsAt) : null;
  // All-day ends are exclusive in the event/calendar interval contract.
  const last = end && event?.allDay ? new Date(end.getTime() - 1) : end;
  return { title: event?.title ?? "", description: event?.description ?? "", startDate: start ? dateKey(start) : date, endDate: last ? dateKey(last) : date, startTime: start ? timeKey(start) : "09:00", endTime: end ? timeKey(end) : "10:00", allDay: event?.allDay ?? false, locationLabel: event?.locationLabel ?? "", eventType: event?.eventType ?? "treino", sport: event?.sport ?? "geral", classIds: event?.classIds ?? [] };
}
export function eventDraftInterval(draft: EventDraft) {
  const parse = (date: string, time: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
    const value = new Date(`${date}T${time}:00`);
    return Number.isNaN(value.getTime()) || dateKey(value) !== date || timeKey(value) !== time ? null : value;
  };
  const start = parse(draft.startDate, draft.allDay ? "00:00" : draft.startTime);
  const end = parse(draft.endDate, draft.allDay ? "00:00" : draft.endTime);
  if (!start || !end) return null;
  if (draft.allDay) end.setDate(end.getDate() + 1);
  return end > start ? { startsAt: start, endsAt: end } : null;
}

export function eventCalendarDates(event: EventListItem, from: Date, to: Date) {
  const start = new Date(event.startsAt), end = new Date(event.endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return [];
  const cursor = new Date(Math.max(start.getTime(), from.getTime()));
  cursor.setHours(0, 0, 0, 0);
  const last = Math.min(end.getTime() - 1, to.getTime());
  const days: string[] = [];
  while (cursor.getTime() <= last) { days.push(dateKey(cursor)); cursor.setDate(cursor.getDate() + 1); }
  return days;
}

/** Explicit Portuguese time suffix only; no inferred dates or AI parsing. */
export function quickEventDraft(draft: EventDraft): EventDraft {
  const match = draft.title.match(/\s+(?:[àa]s\s+)?(\d{1,2})(?::([0-9]{2})|h(?:([0-9]{2}))?)\s*$/i);
  const startTime = match ? `${match[1].padStart(2, "0")}:${match[2] ?? match[3] ?? "00"}` : draft.startTime;
  const title = match ? draft.title.slice(0, match.index).trim() : draft.title.trim();
  const start = new Date(`${draft.startDate}T${startTime}:00`);
  const end = new Date(start.getTime() + 60 * 60000);
  return { ...draft, title, startTime, endTime: Number.isNaN(end.getTime()) ? "" : timeKey(end), endDate: Number.isNaN(end.getTime()) ? draft.endDate : dateKey(end) };
}
