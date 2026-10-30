import { eventDraftInterval, initialEventDraft } from "./event-draft";

/** Presentation snapshot only; private attachments and signed URLs are never included. */
export type CalendarEntryShareSnapshot = {
  title: string; description?: string; location?: string;
  startDate: string; endDate: string; startTime?: string; endTime?: string; allDay?: boolean; uid?: string;
};
export type CalendarEntryShareOptions = { isCurrent?: () => boolean };

export function assertCalendarEntryShareCurrent(options?: CalendarEntryShareOptions) {
  if (options?.isCurrent && !options.isCurrent()) throw new Error("O compromisso mudou. Abra novamente.");
}
export const isCalendarEntryShareCancelled = (error: unknown) => Boolean(error && typeof error === "object" && "name" in error && error.name === "AbortError");

function interval(snapshot: CalendarEntryShareSnapshot) {
  const result = eventDraftInterval({ ...initialEventDraft(snapshot.startDate), ...snapshot,
    startTime: snapshot.startTime ?? "", endTime: snapshot.endTime ?? "", allDay: Boolean(snapshot.allDay) });
  if (!snapshot.title.trim() || !result) throw new Error("Confira as datas e os horários do compromisso.");
  return result;
}
const escapeIcs = (value: string) => value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
const utc = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const localDay = (date: Date) => `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
function fold(line: string) {
  const result: string[] = []; let part = "", bytes = 0;
  for (const char of line) {
    const code = char.codePointAt(0)!;
    const size = code < 128 ? 1 : code < 2048 ? 2 : code < 65536 ? 3 : 4;
    if (bytes + size > 75) { result.push(part); part = " "; bytes = 1; }
    part += char; bytes += size;
  }
  result.push(part);
  return result.join("\r\n");
}
function fallbackUid(snapshot: CalendarEntryShareSnapshot) {
  let hash = 2166136261;
  for (const char of JSON.stringify(snapshot)) hash = Math.imul(hash ^ char.codePointAt(0)!, 16777619) >>> 0;
  return `entry-${hash.toString(16)}@goatleta`;
}

export function buildCalendarEntryIcs(snapshot: CalendarEntryShareSnapshot, now = new Date()): string {
  const range = interval(snapshot);
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "PRODID:-//Go Atleta//Agenda//PT-BR", "BEGIN:VEVENT",
    `UID:${escapeIcs(snapshot.uid ?? fallbackUid(snapshot))}`, `DTSTAMP:${utc(now)}`,
    snapshot.allDay ? `DTSTART;VALUE=DATE:${localDay(range.startsAt)}` : `DTSTART:${utc(range.startsAt)}`,
    snapshot.allDay ? `DTEND;VALUE=DATE:${localDay(range.endsAt)}` : `DTEND:${utc(range.endsAt)}`,
    `SUMMARY:${escapeIcs(snapshot.title.trim())}`];
  if (snapshot.location?.trim()) lines.push(`LOCATION:${escapeIcs(snapshot.location.trim())}`);
  if (snapshot.description?.trim()) lines.push(`DESCRIPTION:${escapeIcs(snapshot.description.trim())}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function buildCalendarEntrySummary(snapshot: CalendarEntryShareSnapshot): string {
  interval(snapshot);
  const date = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
  return [snapshot.title.trim(), snapshot.startDate === snapshot.endDate ? date(snapshot.startDate) : `${date(snapshot.startDate)} – ${date(snapshot.endDate)}`,
    snapshot.allDay ? "Dia todo" : `${snapshot.startTime} – ${snapshot.endTime}`, snapshot.location?.trim(), snapshot.description?.trim()].filter(Boolean).join("\n");
}
export function calendarEntryFileName(snapshot: CalendarEntryShareSnapshot) {
  const title = snapshot.title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 64).toLowerCase() || "compromisso";
  return `go-atleta-${title}-${snapshot.startDate}.ics`;
}
