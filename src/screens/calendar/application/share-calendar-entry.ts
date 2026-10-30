import * as Clipboard from "expo-clipboard";
import { cacheDirectory, documentDirectory, EncodingType, makeDirectoryAsync, writeAsStringAsync } from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Share } from "react-native";
import { assertCalendarEntryShareCurrent, buildCalendarEntryIcs, buildCalendarEntrySummary, calendarEntryFileName, isCalendarEntryShareCancelled, type CalendarEntryShareOptions, type CalendarEntryShareSnapshot } from "./share-calendar-entry-content";
export type { CalendarEntryShareOptions, CalendarEntryShareSnapshot } from "./share-calendar-entry-content";
let exportSequence = 0;

export async function shareCalendarEntry(snapshot: CalendarEntryShareSnapshot, options?: CalendarEntryShareOptions): Promise<void> {
  assertCalendarEntryShareCurrent(options);
  try { await Share.share({ title: snapshot.title.trim(), message: buildCalendarEntrySummary(snapshot) }); }
  catch (error) { if (!isCalendarEntryShareCancelled(error)) throw error; }
}
export async function copyCalendarEntry(snapshot: CalendarEntryShareSnapshot, options?: CalendarEntryShareOptions): Promise<void> {
  assertCalendarEntryShareCurrent(options);
  const copied = await Clipboard.setStringAsync(buildCalendarEntrySummary(snapshot));
  assertCalendarEntryShareCurrent(options);
  if (!copied) throw new Error("Não foi possível copiar as informações.");
}
export async function exportCalendarEntry(snapshot: CalendarEntryShareSnapshot, options?: CalendarEntryShareOptions): Promise<void> {
  assertCalendarEntryShareCurrent(options);
  const content = buildCalendarEntryIcs(snapshot), base = cacheDirectory ?? documentDirectory;
  if (!base) throw new Error("Armazenamento indisponível para exportar agenda.");
  // Concurrent intents from different contexts must never overwrite the same shared URI.
  const directory = `${base}calendar-entry-share-${Date.now()}-${++exportSequence}/`;
  const uri = `${directory}${calendarEntryFileName(snapshot)}`;
  const available = await Sharing.isAvailableAsync();
  assertCalendarEntryShareCurrent(options);
  if (!available) throw new Error("Compartilhamento de arquivos indisponível.");
  await makeDirectoryAsync(directory, { intermediates: true });
  assertCalendarEntryShareCurrent(options);
  await writeAsStringAsync(uri, content, { encoding: EncodingType.UTF8 });
  assertCalendarEntryShareCurrent(options);
  try { await Sharing.shareAsync(uri, { dialogTitle: "Exportar compromisso", mimeType: "text/calendar", UTI: "public.calendar-event" }); }
  catch (error) { if (!isCalendarEntryShareCancelled(error)) throw error; }
}
