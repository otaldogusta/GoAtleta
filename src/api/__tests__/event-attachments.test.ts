import { EventAttachmentsUnavailableError, ensureEventAttachmentsAvailable, getEventAttachmentUrl, listEventAttachments, removeEventAttachment, uploadEventAttachment, type EventAttachment, type EventAttachmentFile } from "../event-attachments";

let mockIdentity = { userId: "user-a", generation: 1 };
let mockOrg: string | null = "org-a", mockGeneration = 1;
const mockToken = jest.fn(), mockRest = jest.fn();
const mockFileInfo = jest.fn(), mockReadFile = jest.fn();
jest.mock("expo-file-system/legacy", () => ({ getInfoAsync: (...args: unknown[]) => mockFileInfo(...args), readAsStringAsync: (...args: unknown[]) => mockReadFile(...args), EncodingType: { Base64: "base64" } }));
jest.mock("../../auth/session", () => ({
  getSessionIdentity: () => ({ ...mockIdentity }),
  assertSessionIdentity: (value: typeof mockIdentity) => { if (value.userId !== mockIdentity.userId || value.generation !== mockIdentity.generation) throw new Error("Session changed"); },
  getValidAccessToken: () => mockToken(),
  SessionIdentityChangedError: class extends Error { constructor() { super("Session changed"); } },
}));
jest.mock("../../db/client", () => ({ getActiveOrganizationId: async () => mockOrg, getReadCacheGeneration: () => mockGeneration }));
jest.mock("../config", () => ({ SUPABASE_URL: "https://project.supabase.co", SUPABASE_ANON_KEY: "anon" }));
jest.mock("../rest", () => ({ supabaseRestRequest: async (path: string, options: { assertContextCurrent?: () => void }) => { options.assertContextCurrent?.(); const result = await mockRest(path, options); options.assertContextCurrent?.(); return result; } }));
const id = "00000000-0000-4000-8000-000000000001";
const scope = { organizationId: "org-a", eventId: "event-a" };
const body = { size: 8, type: "application/pdf" } as Blob;
const file: EventAttachmentFile = { id, uri: "file:///cache/sample.pdf", name: "sample.pdf", mimeType: "application/pdf", size: 8, file: body };
const row = (extra: object = {}) => ({ id, organization_id: "org-a", event_id: "event-a", file_name: "sample.pdf", mime_type: "application/pdf", size_bytes: 8, object_path: `org-a/event-a/${id}`, created_by: "user-a", created_at: "2026-10-29T00:00:00Z", uploaded_at: "2026-10-29T00:00:00Z", deleted_at: null, ...extra });
const attachment: EventAttachment = { id, ...scope, name: "sample.pdf", mimeType: "application/pdf", sizeBytes: 8, objectPath: `org-a/event-a/${id}`, createdBy: "user-a", createdAt: "2026-10-29T00:00:00Z", uploadedAt: "2026-10-29T00:00:00Z" };
const response = (status = 200, result: unknown = {}) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(result), json: async () => result }) as Response;
const originalFetch = global.fetch;
const mockFetch = jest.fn();

beforeEach(() => {
  jest.resetAllMocks();
  mockIdentity = { userId: "user-a", generation: 1 }; mockOrg = "org-a"; mockGeneration = 1;
  mockToken.mockResolvedValue("token-a"); global.fetch = mockFetch;
  mockFetch.mockResolvedValue(response());
  mockFileInfo.mockResolvedValue({ exists: true, isDirectory: false, size: 8 });
  mockReadFile.mockResolvedValue("QUJDREVGR0g=");
});
afterAll(() => { global.fetch = originalFetch; });

test("lists only completed active attachments in the explicit event and organization", async () => {
  mockRest.mockResolvedValue([row()]);
  await expect(listEventAttachments(scope)).resolves.toEqual([attachment]);
  expect(mockRest.mock.calls[0][0]).toContain("organization_id=eq.org-a&event_id=eq.event-a&uploaded_at=not.is.null&deleted_at=is.null");
  expect(mockRest.mock.calls[0][0]).toContain("limit=11");
});

test("preflight checks capabilities and a bounded metadata read before any mutation", async () => {
  mockRest.mockResolvedValueOnce({ version: 1, bucket: "event-attachments", maxFiles: 10, maxFileBytes: 20971520 }).mockResolvedValueOnce([]);
  await expect(ensureEventAttachmentsAvailable(scope)).resolves.toBeUndefined();
  expect(mockRest.mock.calls.map(call => call[0])).toEqual(["/rpc/get_event_attachment_capabilities", "/event_attachments?select=id&organization_id=eq.org-a&limit=1"]);
  expect(mockFetch).not.toHaveBeenCalled();
});

test("missing activation is a concise error while a denial does not masquerade as missing schema", async () => {
  mockRest.mockRejectedValueOnce(new Error('{"code":"PGRST202","message":"get_event_attachment_capabilities missing"}'));
  await expect(ensureEventAttachmentsAvailable(scope)).rejects.toBeInstanceOf(EventAttachmentsUnavailableError);
  mockRest.mockRejectedValueOnce(new Error('{"code":"42501","message":"permission denied for event_attachments"}'));
  await expect(listEventAttachments(scope)).rejects.toThrow("Você não tem permissão");
});

test("prepare, immutable upload and finalize use the same stable client ID", async () => {
  const order: string[] = [];
  mockRest.mockImplementation(async path => { order.push(path); return path.includes("prepare") ? row({ uploaded_at: null }) : row(); });
  mockFetch.mockImplementation(async () => { order.push("storage"); return response(); });
  await expect(uploadEventAttachment({ ...scope, file })).resolves.toEqual(attachment);
  expect(order).toEqual(["/rpc/prepare_event_attachment", "storage", "/rpc/finalize_event_attachment"]);
  expect(mockRest.mock.calls[0][1].body).toMatchObject({ p_id: id, p_file_name: "sample.pdf", p_size_bytes: 8 });
  expect(mockRest.mock.calls[1][1].body.p_id).toBe(id);
  expect(mockFetch).toHaveBeenCalledWith(`https://project.supabase.co/storage/v1/object/event-attachments/org-a/event-a/${id}`, expect.objectContaining({ method: "POST", body, headers: { apikey: "anon", Authorization: "Bearer token-a", "Content-Type": "application/pdf" } }));
});

test("a lost upload response is retried by finalizing the existing object, without overwrite", async () => {
  mockRest.mockResolvedValueOnce(row({ uploaded_at: null })).mockResolvedValueOnce(row());
  mockFetch.mockResolvedValueOnce(response(409));
  await expect(uploadEventAttachment({ ...scope, file })).resolves.toEqual(attachment);
  expect(mockRest.mock.calls[1][0]).toBe("/rpc/finalize_event_attachment");
  expect(mockFetch.mock.calls[0][1].headers["x-upsert"]).toBeUndefined();
  mockRest.mockClear(); mockFetch.mockClear(); mockRest.mockResolvedValue(row());
  await expect(uploadEventAttachment({ ...scope, file })).resolves.toEqual(attachment);
  expect(mockRest).toHaveBeenCalledTimes(1); expect(mockFetch).not.toHaveBeenCalled();
});

test("legacy 400 duplicate uploads finalize the existing object while generic 400 errors stop", async () => {
  mockRest.mockResolvedValueOnce(row({ uploaded_at: null })).mockResolvedValueOnce(row());
  mockFetch.mockResolvedValueOnce(response(400, { error: "Duplicate", message: "The resource already exists" }));
  await expect(uploadEventAttachment({ ...scope, file })).resolves.toEqual(attachment);
  expect(mockRest.mock.calls[1][0]).toBe("/rpc/finalize_event_attachment");
  mockRest.mockClear(); mockFetch.mockClear();
  mockRest.mockResolvedValueOnce(row({ uploaded_at: null }));
  mockFetch.mockResolvedValueOnce(response(400, { error: "InvalidMimeType", message: "mime type is not supported" }));
  await expect(uploadEventAttachment({ ...scope, file })).rejects.toThrow("Não foi possível enviar");
  expect(mockRest).toHaveBeenCalledTimes(1);
});

test("the actual selected bytes are checked before metadata or Storage writes", async () => {
  await expect(uploadEventAttachment({ ...scope, file: { ...file, size: undefined, file: { size: 20971521, type: "application/pdf" } as Blob } })).rejects.toThrow("20 MB");
  expect(mockRest).not.toHaveBeenCalled(); expect(mockFetch).not.toHaveBeenCalled();
});

test("generic picker MIME is normalized by extension, but a Storage denial remains a denial", async () => {
  mockRest.mockResolvedValueOnce(row({ uploaded_at: null })).mockResolvedValueOnce(row());
  await expect(uploadEventAttachment({ ...scope, file: { ...file, mimeType: "application/octet-stream", file: { size: 8, type: "application/octet-stream; charset=binary" } as Blob } })).resolves.toEqual(attachment);
  expect(mockFetch.mock.calls[0][1].headers["Content-Type"]).toBe("application/pdf");
  mockFetch.mockResolvedValue(response(403, { message: "Bucket not found" }));
  await expect(getEventAttachmentUrl({ ...scope, attachment })).rejects.toThrow("Você não tem permissão");
});

test("native picker cache files are read with FileSystem and sent as bytes, without fetching file URIs", async () => {
  mockRest.mockResolvedValueOnce(row({ uploaded_at: null })).mockResolvedValueOnce(row());
  await expect(uploadEventAttachment({ ...scope, file: { ...file, file: undefined } })).resolves.toEqual(attachment);
  expect(mockFileInfo).toHaveBeenCalledWith(file.uri);
  expect(mockReadFile).toHaveBeenCalledWith(file.uri, { encoding: "base64" });
  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(mockFetch.mock.calls[0][0]).toContain("/storage/v1/object/event-attachments/");
  expect(Array.from(new Uint8Array(mockFetch.mock.calls[0][1].body))).toEqual([65, 66, 67, 68, 69, 70, 71, 72]);
});

test("native oversize is rejected before reading all bytes and a context switch during reading prevents writes", async () => {
  mockFileInfo.mockResolvedValueOnce({ exists: true, isDirectory: false, size: 20971521 });
  await expect(uploadEventAttachment({ ...scope, file: { ...file, file: undefined } })).rejects.toThrow("20 MB");
  expect(mockReadFile).not.toHaveBeenCalled(); expect(mockRest).not.toHaveBeenCalled();
  mockReadFile.mockImplementationOnce(async () => { mockOrg = "org-b"; mockGeneration += 1; return "QUJDREVGR0g="; });
  await expect(uploadEventAttachment({ ...scope, file: { ...file, file: undefined } })).rejects.toThrow("Session changed");
  expect(mockRest).not.toHaveBeenCalled(); expect(mockFetch).not.toHaveBeenCalled();
});

test("switching organization while acquiring the token stops before any request", async () => {
  mockToken.mockImplementationOnce(async () => { mockOrg = "org-b"; mockGeneration += 1; return "token-b"; });
  await expect(uploadEventAttachment({ ...scope, file })).rejects.toThrow("Session changed");
  expect(mockRest).not.toHaveBeenCalled(); expect(mockFetch).not.toHaveBeenCalled();
});

test("switching account during prepare never starts Storage upload or cleanup with the new account", async () => {
  mockRest.mockImplementationOnce(async () => { mockIdentity = { userId: "user-b", generation: 2 }; return row({ uploaded_at: null }); });
  await expect(uploadEventAttachment({ ...scope, file })).rejects.toThrow();
  expect(mockFetch).not.toHaveBeenCalled(); expect(mockToken).toHaveBeenCalledTimes(1);
});

test("switching organization during upload skips finalize and all cleanup writes", async () => {
  mockRest.mockResolvedValueOnce(row({ uploaded_at: null }));
  mockFetch.mockImplementationOnce(async () => { mockOrg = "org-b"; mockGeneration += 1; return response(); });
  await expect(uploadEventAttachment({ ...scope, file })).rejects.toThrow("Session changed");
  expect(mockRest).toHaveBeenCalledTimes(1); expect(mockFetch).toHaveBeenCalledTimes(1); expect(mockToken).toHaveBeenCalledTimes(1);
});

test("removal tombstones metadata first and retries a missing Storage object idempotently", async () => {
  mockRest.mockResolvedValue(row({ deleted_at: "2026-10-29T01:00:00Z" }));
  mockFetch.mockResolvedValue(response(404));
  await expect(removeEventAttachment({ ...scope, attachment })).resolves.toBeUndefined();
  expect(mockRest.mock.calls[0][0]).toBe("/rpc/remove_event_attachment");
  expect(mockFetch.mock.calls[0][1]).toMatchObject({ method: "DELETE", headers: { apikey: "anon", Authorization: "Bearer token-a" } });
});

test("admin recovery can list pending intents but pending files never receive a download grant", async () => {
  mockRest.mockResolvedValue([row({ uploaded_at: null })]);
  await expect(listEventAttachments({ ...scope, includePending: true })).resolves.toEqual([{ ...attachment, uploadedAt: null }]);
  expect(mockRest.mock.calls[0][0]).not.toContain("uploaded_at=not.is.null");
  await expect(getEventAttachmentUrl({ ...scope, attachment: { ...attachment, uploadedAt: null } })).rejects.toThrow("Não foi possível abrir");
  expect(mockFetch).not.toHaveBeenCalled();
  mockRest.mockResolvedValue(null);
  await expect(removeEventAttachment({ ...scope, attachment: { id, ...scope } })).resolves.toBeUndefined();
  expect(mockFetch).not.toHaveBeenCalled();
});

test("a stale removal response does not delete an object using another context", async () => {
  mockRest.mockImplementationOnce(async () => { mockOrg = "org-b"; mockGeneration += 1; return row({ deleted_at: "2026-10-29T01:00:00Z" }); });
  await expect(removeEventAttachment({ ...scope, attachment })).rejects.toThrow("Session changed");
  expect(mockFetch).not.toHaveBeenCalled();
});

test("signed download URLs are short lived, origin/path checked and force a download filename", async () => {
  mockFetch.mockResolvedValue(response(200, { signedURL: `/object/sign/event-attachments/org-a/event-a/${id}?token=fixture` }));
  const url = await getEventAttachmentUrl({ ...scope, attachment });
  expect(url).toBe(`https://project.supabase.co/storage/v1/object/sign/event-attachments/org-a/event-a/${id}?token=fixture&download=sample.pdf`);
  expect(mockFetch.mock.calls[0][1].body).toBe('{"expiresIn":60}');
  mockFetch.mockResolvedValue(response(200, { signedURL: "https://external.invalid/file" }));
  await expect(getEventAttachmentUrl({ ...scope, attachment })).rejects.toThrow("Não foi possível abrir");
});

test("a session change during URL parsing never returns a private grant", async () => {
  mockFetch.mockResolvedValue({ ...response(), json: async () => { mockIdentity = { userId: "user-b", generation: 2 }; return { signedURL: `/object/sign/event-attachments/org-a/event-a/${id}?token=fixture` }; } });
  await expect(getEventAttachmentUrl({ ...scope, attachment })).rejects.toThrow();
});

test("unexpected pending rows and foreign object paths are not exposed", async () => {
  mockRest.mockResolvedValueOnce([row({ uploaded_at: null })]);
  await expect(listEventAttachments(scope)).rejects.toThrow("Não foi possível carregar");
  mockRest.mockResolvedValueOnce(row({ uploaded_at: null, object_path: "org-b/event-a/other" }));
  await expect(uploadEventAttachment({ ...scope, file })).rejects.toThrow("Não foi possível enviar");
  expect(mockFetch).not.toHaveBeenCalled();
});
