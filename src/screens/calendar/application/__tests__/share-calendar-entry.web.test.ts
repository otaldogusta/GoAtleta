import * as Clipboard from "expo-clipboard";
import { copyCalendarEntry, exportCalendarEntry, shareCalendarEntry } from "../share-calendar-entry.web";
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(async () => true) }));
const snapshot = { title: "Treino", startDate: "2026-10-29", endDate: "2026-10-29", startTime: "09:00", endTime: "10:00" };
const share = jest.fn(), canShare = jest.fn(), createUrl = jest.fn(), revokeUrl = jest.fn();
const link = { href: "", download: "", rel: "", click: jest.fn(), remove: jest.fn() };
const descriptors = new Map<string, PropertyDescriptor | undefined>();
const urlDescriptors = new Map<string, PropertyDescriptor | undefined>();
beforeAll(() => {
  for (const key of ["document", "navigator", "File"]) descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  for (const key of ["createObjectURL", "revokeObjectURL"]) urlDescriptors.set(key, Object.getOwnPropertyDescriptor(URL, key));
});
beforeEach(() => {
  jest.clearAllMocks(); jest.useFakeTimers(); share.mockResolvedValue(undefined); canShare.mockReturnValue(true); createUrl.mockReturnValue("blob:ics");
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { share, canShare } });
  Object.defineProperty(globalThis, "File", { configurable: true, value: class { constructor(public parts: unknown[], public name: string, public options: { type: string }) {} } });
  Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement: () => link, body: { appendChild: jest.fn() } } });
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createUrl });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeUrl });
  jest.mocked(Clipboard.setStringAsync).mockResolvedValue(true);
});
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });
afterAll(() => {
  for (const [key, descriptor] of descriptors) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  for (const [key, descriptor] of urlDescriptors) { if (descriptor) Object.defineProperty(URL, key, descriptor); else Reflect.deleteProperty(URL, key); }
});
test("dispatches Web Share immediately from the gesture, with an ICS file and visible summary", async () => {
  const pending = shareCalendarEntry(snapshot);
  expect(share).toHaveBeenCalledTimes(1);
  const payload = share.mock.calls[0][0];
  expect(payload.title).toBe("Treino"); expect(payload.text).toContain("09:00 – 10:00");
  expect(payload.files[0].parts[0]).toContain("BEGIN:VCALENDAR");
  expect(payload.files[0].name).toMatch(/\.ics$/);
  await pending; expect(link.click).not.toHaveBeenCalled();
});
test("uses a text chooser if file sharing is unavailable", async () => {
  canShare.mockImplementation(data => !data.files);
  await shareCalendarEntry(snapshot);
  expect(share.mock.calls[0][0].files).toBeUndefined(); expect(share.mock.calls[0][0].text).toContain("Treino");
});
test("an unavailable chooser policy uses the immediate download fallback without invoking share", async () => {
  canShare.mockReturnValue(false);
  const pending = shareCalendarEntry(snapshot);
  expect(share).not.toHaveBeenCalled(); expect(link.click).toHaveBeenCalledTimes(1);
  await pending;
});
test("a cancelled chooser is silent and never starts another download", async () => {
  share.mockRejectedValueOnce(Object.assign(new Error("cancel"), { name: "AbortError" }));
  await expect(shareCalendarEntry(snapshot)).resolves.toBeUndefined();
  expect(link.click).not.toHaveBeenCalled(); expect(createUrl).not.toHaveBeenCalled();
});
test("share errors remain errors rather than silently downloading another file", async () => {
  share.mockRejectedValueOnce(new Error("Share failed"));
  await expect(shareCalendarEntry(snapshot)).rejects.toThrow("Share failed"); expect(link.click).not.toHaveBeenCalled();
});
test("without Web Share it synchronously downloads the selected entry and releases its URL", async () => {
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} });
  const pending = shareCalendarEntry(snapshot);
  expect(link.click).toHaveBeenCalledTimes(1); expect(link.download).toBe("go-atleta-treino-2026-10-29.ics");
  await pending; expect(link.remove).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(1000); expect(revokeUrl).toHaveBeenCalledWith("blob:ics");
});
test("stale context prevents share, copy and export", async () => {
  const options = { isCurrent: () => false };
  await expect(shareCalendarEntry(snapshot, options)).rejects.toThrow("mudou");
  await expect(copyCalendarEntry(snapshot, options)).rejects.toThrow("mudou");
  await expect(exportCalendarEntry(snapshot, options)).rejects.toThrow("mudou");
  expect(share).not.toHaveBeenCalled(); expect(link.click).not.toHaveBeenCalled(); expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
});
test("copy reports a rejected clipboard write and keeps the payload free of private file URLs", async () => {
  jest.mocked(Clipboard.setStringAsync).mockResolvedValueOnce(false);
  await expect(copyCalendarEntry(snapshot)).rejects.toThrow("copiar");
  expect(jest.mocked(Clipboard.setStringAsync).mock.calls[0][0]).toContain("Treino");
});
