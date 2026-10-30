import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { Share } from "react-native";
import { copyCalendarEntry, exportCalendarEntry, shareCalendarEntry } from "../share-calendar-entry";
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(async () => true) }));
jest.mock("expo-sharing", () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => undefined) }));
jest.mock("expo-file-system/legacy", () => ({ cacheDirectory: "file:///cache/", documentDirectory: "file:///docs/", EncodingType: { UTF8: "utf8" }, makeDirectoryAsync: jest.fn(async () => undefined), writeAsStringAsync: jest.fn(async () => undefined) }));
const snapshot = { title: "Treino", startDate: "2026-10-29", endDate: "2026-10-29", startTime: "09:00", endTime: "10:00" };
afterEach(() => jest.restoreAllMocks());
beforeEach(() => { jest.clearAllMocks(); jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true); jest.mocked(FileSystem.writeAsStringAsync).mockResolvedValue(undefined); });
test("native share opens the system chooser with the displayed summary", async () => {
  const share = jest.spyOn(Share, "share").mockResolvedValue({ action: Share.dismissedAction });
  await shareCalendarEntry(snapshot);
  expect(share).toHaveBeenCalledWith({ title: "Treino", message: expect.stringContaining("09:00 – 10:00") });
});
test("native calendar export writes only one ICS and then opens the file chooser", async () => {
  await exportCalendarEntry(snapshot);
  const uri = jest.mocked(FileSystem.writeAsStringAsync).mock.calls[0][0];
  expect(uri).toMatch(/^file:\/\/\/cache\/calendar-entry-share-\d+-\d+\/go-atleta-treino-2026-10-29\.ics$/);
  expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(uri, expect.stringContaining("BEGIN:VCALENDAR"), { encoding: "utf8" });
  expect(Sharing.shareAsync).toHaveBeenCalledWith(uri, expect.objectContaining({ mimeType: "text/calendar" }));
});
test("same-name export intents use separate temporary paths", async () => {
  await Promise.all([exportCalendarEntry(snapshot), exportCalendarEntry(snapshot)]);
  const paths = jest.mocked(FileSystem.writeAsStringAsync).mock.calls.map(call => call[0]);
  expect(new Set(paths).size).toBe(2);
});
test("a context change during writing prevents handing the file to another app", async () => {
  let current = true;
  jest.mocked(FileSystem.writeAsStringAsync).mockImplementationOnce(async () => { current = false; });
  await expect(exportCalendarEntry(snapshot, { isCurrent: () => current })).rejects.toThrow("mudou");
  expect(Sharing.shareAsync).not.toHaveBeenCalled();
});
test("stale copy and unavailable native file sharing do not pretend to succeed", async () => {
  await expect(copyCalendarEntry(snapshot, { isCurrent: () => false })).rejects.toThrow("mudou");
  expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
  jest.mocked(Sharing.isAvailableAsync).mockResolvedValueOnce(false);
  await expect(exportCalendarEntry(snapshot)).rejects.toThrow("indisponível");
  expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
});
