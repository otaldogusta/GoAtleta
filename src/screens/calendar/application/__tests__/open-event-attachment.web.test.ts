import { openEventAttachment } from "../open-event-attachment.web";

jest.mock("../../../../api/config", () => ({ SUPABASE_URL: "https://project.supabase.co" }));
const url = "https://project.supabase.co/storage/v1/object/sign/event-attachments/org/event/file?token=fixture";
const blob = { size: 128, type: "application/pdf" } as Blob;
const mockFetch = jest.fn(), mockCreateUrl = jest.fn(), mockRevokeUrl = jest.fn();
const link = { href: "", download: "", style: { display: "" }, click: jest.fn(), remove: jest.fn() };
const appendChild = jest.fn(), createElement = jest.fn();
const originalFetch = global.fetch;
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
const originalCreateUrl = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
const originalRevokeUrl = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");

beforeEach(() => {
  jest.resetAllMocks(); jest.useFakeTimers();
  global.fetch = mockFetch;
  mockFetch.mockResolvedValue({ ok: true, blob: async () => blob });
  mockCreateUrl.mockReturnValue("blob:local-download");
  createElement.mockReturnValue(link);
  Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement, body: { appendChild } } });
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: mockCreateUrl });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: mockRevokeUrl });
});
afterEach(() => {
  jest.clearAllTimers(); jest.useRealTimers(); global.fetch = originalFetch;
  if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument); else Reflect.deleteProperty(globalThis, "document");
  if (originalCreateUrl) Object.defineProperty(URL, "createObjectURL", originalCreateUrl); else Reflect.deleteProperty(URL, "createObjectURL");
  if (originalRevokeUrl) Object.defineProperty(URL, "revokeObjectURL", originalRevokeUrl); else Reflect.deleteProperty(URL, "revokeObjectURL");
});

test("downloads signed bytes with a filename instead of opening an asynchronous popup, then cleans up", async () => {
  await openEventAttachment({ url, name: "material.pdf", isCurrent: () => true });
  expect(mockFetch).toHaveBeenCalledWith(url, { credentials: "omit", redirect: "error" });
  expect(mockCreateUrl).toHaveBeenCalledWith(blob);
  expect(link.href).toBe("blob:local-download"); expect(link.download).toBe("material.pdf");
  expect(appendChild).toHaveBeenCalledWith(link); expect(link.click).toHaveBeenCalledTimes(1); expect(link.remove).toHaveBeenCalledTimes(1);
  expect(mockRevokeUrl).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1000);
  expect(mockRevokeUrl).toHaveBeenCalledWith("blob:local-download");
});

test("a stale operation cannot start a request", async () => {
  await expect(openEventAttachment({ url, name: "material.pdf", isCurrent: () => false })).rejects.toThrow("contexto");
  expect(mockFetch).not.toHaveBeenCalled(); expect(link.click).not.toHaveBeenCalled();
});

test("a context change while receiving the response stops before reading or exposing bytes", async () => {
  let current = true; const readBlob = jest.fn(async () => blob);
  mockFetch.mockImplementationOnce(async () => { current = false; return { ok: true, blob: readBlob }; });
  await expect(openEventAttachment({ url, name: "material.pdf", isCurrent: () => current })).rejects.toThrow("contexto");
  expect(readBlob).not.toHaveBeenCalled(); expect(mockCreateUrl).not.toHaveBeenCalled();
});

test("a context change during Blob parsing prevents the download", async () => {
  let current = true;
  mockFetch.mockResolvedValueOnce({ ok: true, blob: async () => { current = false; return blob; } });
  await expect(openEventAttachment({ url, name: "material.pdf", isCurrent: () => current })).rejects.toThrow("contexto");
  expect(mockCreateUrl).not.toHaveBeenCalled(); expect(link.click).not.toHaveBeenCalled();
});

test("a stale operation after creating an object URL revokes it without clicking", async () => {
  let current = true;
  mockCreateUrl.mockImplementationOnce(() => { current = false; return "blob:stale"; });
  await expect(openEventAttachment({ url, name: "material.pdf", isCurrent: () => current })).rejects.toThrow("contexto");
  expect(link.click).not.toHaveBeenCalled(); expect(mockRevokeUrl).toHaveBeenCalledWith("blob:stale");
});

test.each([
  "https://external.invalid/storage/v1/object/sign/event-attachments/org/event/file?token=fixture",
  "https://project.supabase.co/storage/v1/object/public/event-attachments/org/event/file?token=fixture",
  "https://project.supabase.co/storage/v1/object/sign/event-attachments/org/event%2Fother/file?token=fixture",
  "https://user:pass@project.supabase.co/storage/v1/object/sign/event-attachments/org/event/file?token=fixture",
  "https://project.supabase.co/storage/v1/object/sign/event-attachments/org/event/file",
])("rejects a foreign or malformed signed destination before sending its token: %s", async target => {
  await expect(openEventAttachment({ url: target, name: "material.pdf", isCurrent: () => true })).rejects.toThrow("endereço");
  expect(mockFetch).not.toHaveBeenCalled();
});

test("a local picker Blob can be downloaded before saving without contacting any server", async () => {
  await openEventAttachment({ url: "blob:selected", name: "material.pdf", localFile: { uri: "blob:selected", file: blob }, isCurrent: () => true });
  expect(mockFetch).not.toHaveBeenCalled(); expect(link.click).toHaveBeenCalledTimes(1);
});

test("local picker metadata cannot authorize an arbitrary HTTP destination", async () => {
  await expect(openEventAttachment({ url, name: "material.pdf", localFile: { uri: url }, isCurrent: () => true })).rejects.toThrow("endereço");
  expect(mockFetch).not.toHaveBeenCalled();
});

test("a failed click removes the temporary anchor and immediately revokes its URL", async () => {
  link.click.mockImplementationOnce(() => { throw new Error("click failed"); });
  await expect(openEventAttachment({ url, name: "material.pdf", isCurrent: () => true })).rejects.toThrow("click failed");
  expect(link.remove).toHaveBeenCalledTimes(1); expect(mockRevokeUrl).toHaveBeenCalledWith("blob:local-download");
});
