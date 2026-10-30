import { MAX_EVENT_ATTACHMENT_BYTES } from "../../core/event-attachments";
import { readEventAttachmentDownloadBlob, readEventAttachmentFile } from "../event-attachment-file.web";

jest.mock("../config", () => ({ SUPABASE_URL: "https://project.supabase.co" }));

const file = { uri: "blob:https://localhost/fixture", name: "material.pdf", mimeType: "application/pdf" };
const originalFetch = global.fetch;
const mockFetch = jest.fn();
beforeEach(() => { jest.resetAllMocks(); global.fetch = mockFetch; });
afterAll(() => { global.fetch = originalFetch; });

test("web picker files retain their Blob without native I/O or a second request", async () => {
  const blob = { size: 12, type: "application/pdf" } as Blob;
  await expect(readEventAttachmentFile({ ...file, file: blob }, jest.fn())).resolves.toEqual({ body: blob, size: 12, type: "application/pdf" });
  expect(mockFetch).not.toHaveBeenCalled();
});

test("local Blob URLs are read with context checks before and after body decoding", async () => {
  const blob = { size: 12, type: "application/pdf" } as Blob, assertCurrent = jest.fn(async () => {});
  mockFetch.mockResolvedValue({ ok: true, blob: async () => blob });
  await expect(readEventAttachmentFile(file, assertCurrent)).resolves.toEqual({ body: blob, size: 12, type: "application/pdf" });
  expect(assertCurrent).toHaveBeenCalledTimes(2);
  expect(mockFetch).toHaveBeenCalledWith(file.uri);
});

test("a changed identity while reading local bytes rejects instead of returning data", async () => {
  const assertCurrent = jest.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("Session changed"));
  mockFetch.mockResolvedValue({ ok: true, blob: async () => ({ size: 12, type: "application/pdf" }) });
  await expect(readEventAttachmentFile(file, assertCurrent)).rejects.toThrow("Session changed");
});

test("a picker URI cannot redirect the attachment reader to an arbitrary remote origin", async () => {
  await expect(readEventAttachmentFile({ ...file, uri: "https://external.invalid/private" }, jest.fn())).rejects.toThrow("Arquivo local inválido");
  expect(mockFetch).not.toHaveBeenCalled();
});

const signedUrl = "https://project.supabase.co/storage/v1/object/sign/event-attachments/org/event/file?token=fixture";

test("signed downloads return validated bytes through the API adapter and preserve context checks", async () => {
  const blob = { size: MAX_EVENT_ATTACHMENT_BYTES, type: "application/pdf" } as Blob;
  const assertCurrent = jest.fn();
  mockFetch.mockResolvedValue({ ok: true, blob: async () => blob });
  await expect(readEventAttachmentDownloadBlob({ url: signedUrl, name: "material.pdf" }, assertCurrent)).resolves.toBe(blob);
  expect(mockFetch).toHaveBeenCalledWith(signedUrl, { credentials: "omit", redirect: "error" });
  expect(assertCurrent).toHaveBeenCalledTimes(3);
});

test.each([0, MAX_EVENT_ATTACHMENT_BYTES + 1])("download size %i cannot reach the browser download", async size => {
  mockFetch.mockResolvedValue({ ok: true, blob: async () => ({ size }) });
  await expect(readEventAttachmentDownloadBlob({ url: signedUrl, name: "material.pdf" }, jest.fn())).rejects.toThrow("limite de 20 MB");
});

test("invalid download filenames reject before any request", async () => {
  await expect(readEventAttachmentDownloadBlob({ url: signedUrl, name: "../material.pdf" }, jest.fn())).rejects.toThrow("nome do anexo");
  expect(mockFetch).not.toHaveBeenCalled();
});

test("failed signed responses do not read or return the response body", async () => {
  const readBlob = jest.fn();
  mockFetch.mockResolvedValue({ ok: false, blob: readBlob });
  await expect(readEventAttachmentDownloadBlob({ url: signedUrl, name: "material.pdf" }, jest.fn())).rejects.toThrow("Não foi possível baixar");
  expect(readBlob).not.toHaveBeenCalled();
});
