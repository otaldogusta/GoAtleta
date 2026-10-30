import * as Clipboard from "expo-clipboard";
import { assertCalendarEntryShareCurrent, buildCalendarEntryIcs, buildCalendarEntrySummary, calendarEntryFileName, isCalendarEntryShareCancelled, type CalendarEntryShareOptions, type CalendarEntryShareSnapshot } from "./share-calendar-entry-content";
export type { CalendarEntryShareOptions, CalendarEntryShareSnapshot } from "./share-calendar-entry-content";

/** Builds and dispatches the file synchronously from the explicit user gesture. */
export async function exportCalendarEntry(snapshot: CalendarEntryShareSnapshot, options?: CalendarEntryShareOptions): Promise<void> {
  assertCalendarEntryShareCurrent(options);
  if (typeof document === "undefined") throw new Error("Exportação indisponível neste navegador.");
  const content = buildCalendarEntryIcs(snapshot);
  const url = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }));
  let link: HTMLAnchorElement | undefined;
  try {
    assertCalendarEntryShareCurrent(options);
    link = document.createElement("a"); link.href = url; link.download = calendarEntryFileName(snapshot); link.rel = "noopener";
    document.body.appendChild(link); link.click();
  } finally { link?.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
export async function shareCalendarEntry(snapshot: CalendarEntryShareSnapshot, options?: CalendarEntryShareOptions): Promise<void> {
  assertCalendarEntryShareCurrent(options);
  const text = buildCalendarEntrySummary(snapshot);
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return exportCalendarEntry(snapshot, options);
  const file = new File([buildCalendarEntryIcs(snapshot)], calendarEntryFileName(snapshot), { type: "text/calendar" });
  const data = { title: snapshot.title.trim(), text };
  const canShareFiles = typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
  if (!canShareFiles && typeof navigator.canShare === "function" && !navigator.canShare(data)) return exportCalendarEntry(snapshot, options);
  try {
    assertCalendarEntryShareCurrent(options);
    // No await/import before share(): browsers require the active click gesture.
    await navigator.share(canShareFiles ? { ...data, files: [file] } : data);
  } catch (error) { if (!isCalendarEntryShareCancelled(error)) throw error; }
}
export async function copyCalendarEntry(snapshot: CalendarEntryShareSnapshot, options?: CalendarEntryShareOptions): Promise<void> {
  assertCalendarEntryShareCurrent(options);
  const copied = await Clipboard.setStringAsync(buildCalendarEntrySummary(snapshot));
  assertCalendarEntryShareCurrent(options);
  if (!copied) throw new Error("Não foi possível copiar as informações.");
}
