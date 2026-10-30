import { act, renderHook, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { getEventAttachmentUrl, listEventAttachments, removeEventAttachment, uploadEventAttachment, type EventAttachment } from "../../../api/event-attachments";
import { MAX_EVENT_ATTACHMENT_BYTES } from "../../../core/event-attachments";
import { useCalendarEventAttachments } from "../useCalendarEventAttachments";

let mockIdentity = { userId: "user-a", generation: 1 };
let mockId = 0;
jest.mock("../../../auth/session", () => ({
  getSessionIdentity: () => ({ ...mockIdentity }),
  isSessionIdentityCurrent: (identity: typeof mockIdentity) => identity.userId === mockIdentity.userId && identity.generation === mockIdentity.generation,
}));
jest.mock("../../../core/profile-request-id", () => ({ createProfileRequestId: () => `10000000-0000-4000-8000-${String(++mockId).padStart(12, "0")}` }));
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
jest.mock("../../../api/event-attachments", () => ({
  ...jest.requireActual("../../../core/event-attachments"),
  listEventAttachments: jest.fn(), uploadEventAttachment: jest.fn(), removeEventAttachment: jest.fn(), getEventAttachmentUrl: jest.fn(),
}));

type Options = Parameters<typeof useCalendarEventAttachments>[0];
const options: Options = { scope: "scope-a", organizationId: "org-a", canManage: true, busy: false, enabled: true };
const attachment = (id: string, eventId = "event-a", organizationId = "org-a"): EventAttachment => ({ id, eventId, organizationId,
  name: `${id}.pdf`, mimeType: "application/pdf", sizeBytes: 128, objectPath: `${organizationId}/${eventId}/${id}`, createdBy: "user-a", createdAt: "2026-10-29T10:00:00Z", uploadedAt: "2026-10-29T10:00:00Z" });
const selected = (names: string[], overrides: Partial<DocumentPicker.DocumentPickerAsset> = {}): DocumentPicker.DocumentPickerSuccessResult => ({ canceled: false,
  assets: names.map(name => ({ name, uri: `file:///cache/${name}`, mimeType: "application/pdf", size: 128, lastModified: 0, ...overrides })) });
const deferred = <T,>() => {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};
const mount = (extra: Partial<Options> = {}) => renderHook((props: Options) => useCalendarEventAttachments(props), { initialProps: { ...options, ...extra } });

beforeEach(() => {
  jest.clearAllMocks(); mockId = 0; mockIdentity = { userId: "user-a", generation: 1 };
  jest.mocked(listEventAttachments).mockResolvedValue([]);
  jest.mocked(removeEventAttachment).mockResolvedValue(undefined);
  jest.mocked(uploadEventAttachment).mockImplementation(async ({ file, eventId, organizationId }) => ({ ...attachment(file.id, eventId, organizationId), name: file.name }));
  jest.mocked(getEventAttachmentUrl).mockResolvedValue("https://fixture.example.test/signed");
  jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
});
afterEach(() => jest.restoreAllMocks());

test("picking is local, a cancelled picker stays clean and a double click opens it once", async () => {
  const picker = deferred<DocumentPicker.DocumentPickerResult>();
  jest.mocked(DocumentPicker.getDocumentAsync).mockReturnValue(picker.promise);
  const { result } = mount();
  const signature = result.current.signature;
  let first!: Promise<void>;
  act(() => { first = result.current.pick(); });
  expect(result.current.picking).toBe(true);
  await act(async () => result.current.pick());
  expect(DocumentPicker.getDocumentAsync).toHaveBeenCalledTimes(1);
  expect(DocumentPicker.getDocumentAsync).toHaveBeenCalledWith(expect.objectContaining({ multiple: true, copyToCacheDirectory: true, base64: false, type: expect.arrayContaining(["application/pdf", "image/jpeg"]) }));
  await act(async () => { picker.resolve({ canceled: true, assets: null }); await first; });
  expect(result.current.files).toEqual([]);
  expect(result.current.signature).toBe(signature);
  expect(result.current.hasChanges).toBe(false);
  expect(result.current.picking).toBe(false);
  expect(uploadEventAttachment).not.toHaveBeenCalled();
});

test.each([
  ["script.exe", {}, "Escolha uma imagem"],
  ["arquivo.pdf", { mimeType: "image/png" }, "não corresponde"],
  ["grande.pdf", { size: MAX_EVENT_ATTACHMENT_BYTES + 1 }, "20 MB"],
])("invalid picker metadata rejects the whole batch: %s", async (name, overrides, message) => {
  jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue(selected(["válido.pdf", name as string], overrides as Partial<DocumentPicker.DocumentPickerAsset>));
  const { result } = mount();
  await act(async () => result.current.pick());
  expect(result.current.files).toEqual([]);
  expect(result.current.error).toContain(message as string);
  expect(result.current.hasChanges).toBe(false);
  expect(uploadEventAttachment).not.toHaveBeenCalled();
});

test("loading is not dirty and the ten-file limit includes existing rows and staged removals", async () => {
  jest.mocked(listEventAttachments).mockResolvedValue(Array.from({ length: 9 }, (_, index) => attachment(`existing-${index}`)));
  jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue(selected(["a.pdf", "b.pdf"]));
  const { result } = mount({ eventId: "event-a" });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(listEventAttachments).toHaveBeenCalledWith({ organizationId: "org-a", eventId: "event-a", includePending: true });
  expect(result.current.hasChanges).toBe(false);
  await act(async () => result.current.pick());
  expect(result.current.error).toContain("10 anexos");
  expect(result.current.files).toHaveLength(0);
  act(() => result.current.removeExisting("existing-0"));
  await act(async () => result.current.pick());
  expect(result.current.files).toHaveLength(2);
  expect(result.current.removedIds).toEqual(["existing-0"]);
  expect(result.current.hasChanges).toBe(true);
  expect(removeEventAttachment).not.toHaveBeenCalled();
  expect(uploadEventAttachment).not.toHaveBeenCalled();
});

test("removing a never-uploaded pending file returns to the clean signature", async () => {
  jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue(selected(["a.pdf"]));
  const { result } = mount();
  const clean = result.current.signature;
  await act(async () => result.current.pick());
  expect(result.current.hasChanges).toBe(true);
  act(() => result.current.removePending(result.current.files[0].id));
  expect(result.current.signature).toBe(clean);
  expect(result.current.hasChanges).toBe(false);
  expect(removeEventAttachment).not.toHaveBeenCalled();
});

test("read errors remain visible and retry loads the list without making the draft dirty", async () => {
  jest.mocked(listEventAttachments).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([attachment("ready")]);
  const { result } = mount({ eventId: "event-a" });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toContain("carregar os anexos");
  await act(async () => result.current.pick());
  expect(DocumentPicker.getDocumentAsync).not.toHaveBeenCalled();
  act(() => result.current.retryLoad());
  await waitFor(() => expect(result.current.attachments).toHaveLength(1));
  expect(result.current.error).toBeNull();
  expect(result.current.hasChanges).toBe(false);
});

test("scope snapshots hide old rows on the first new render and discard a late old load", async () => {
  const old = deferred<EventAttachment[]>(), fresh = deferred<EventAttachment[]>();
  jest.mocked(listEventAttachments).mockResolvedValueOnce([attachment("old")]).mockReturnValueOnce(fresh.promise);
  const renders: { scope: string; ids: string[] }[] = [];
  const { result, rerender } = renderHook((props: Options) => {
    const value = useCalendarEventAttachments(props);
    renders.push({ scope: props.scope, ids: value.attachments.map(item => item.id) });
    return value;
  }, { initialProps: { ...options, eventId: "event-a" } });
  await waitFor(() => expect(result.current.attachments).toHaveLength(1));
  rerender({ ...options, scope: "scope-b", organizationId: "org-b", eventId: "event-b" });
  expect(renders.filter(item => item.scope === "scope-b").every(item => item.ids.length === 0)).toBe(true);
  await act(async () => fresh.resolve([attachment("new", "event-b", "org-b")]));
  expect(result.current.attachments.map(item => item.id)).toEqual(["new"]);
  jest.mocked(listEventAttachments).mockReturnValueOnce(old.promise);
  act(() => result.current.retryLoad());
  rerender({ ...options, eventId: "event-a" });
  await act(async () => old.resolve([attachment("late", "event-b", "org-b")]));
  expect(result.current.attachments.some(item => item.id === "late")).toBe(false);
});

test("a picker completed after a session change cannot stage files", async () => {
  const picker = deferred<DocumentPicker.DocumentPickerResult>();
  jest.mocked(DocumentPicker.getDocumentAsync).mockReturnValue(picker.promise);
  const { result } = mount();
  let pending!: Promise<void>;
  act(() => { pending = result.current.pick(); });
  mockIdentity = { userId: "user-b", generation: 2 };
  await act(async () => { picker.resolve(selected(["a.pdf"])); await pending; });
  expect(result.current.files).toHaveLength(0);
  expect(uploadEventAttachment).not.toHaveBeenCalled();
});

test("uploads are sequential, retain the signature and resume a partial failure using the same IDs", async () => {
  jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue(selected(["a.pdf", "b.pdf", "c.pdf"]));
  const { result } = mount();
  await act(async () => result.current.pick());
  const ids = result.current.files.map(file => file.id), signature = result.current.signature;
  const first = deferred<EventAttachment>(), second = deferred<EventAttachment>();
  jest.mocked(uploadEventAttachment).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  let saving!: Promise<void>;
  act(() => { saving = result.current.commit("event-a", () => result.current.signature === signature); });
  expect(result.current.progress).toEqual({ completed: 0, total: 3 });
  expect(uploadEventAttachment).toHaveBeenCalledTimes(1);
  await act(async () => first.resolve(attachment(ids[0])));
  expect(result.current.progress).toEqual({ completed: 1, total: 3 });
  expect(uploadEventAttachment).toHaveBeenCalledTimes(2);
  expect(result.current.signature).toBe(signature);
  await act(async () => { second.reject(new Error("offline")); await expect(saving).rejects.toThrow("offline"); });
  expect(result.current.error).toContain("salvar os anexos");
  expect(result.current.files.map(file => file.id)).toEqual(ids);
  await act(async () => result.current.commit("event-a", () => result.current.signature === signature));
  expect(jest.mocked(uploadEventAttachment).mock.calls.map(([input]) => input.file.id)).toEqual([ids[0], ids[1], ids[1], ids[2]]);
  expect(result.current.signature).toBe(signature);
  expect(result.current.progress).toEqual({ completed: 3, total: 3 });
});

test("removing an uploaded file after partial failure queues deletion before the next retry", async () => {
  jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue(selected(["a.pdf", "b.pdf"]));
  const { result } = mount();
  await act(async () => result.current.pick());
  const ids = result.current.files.map(file => file.id);
  jest.mocked(uploadEventAttachment).mockResolvedValueOnce(attachment(ids[0])).mockRejectedValueOnce(new Error("offline"));
  await act(async () => { await expect(result.current.commit("event-a", () => true)).rejects.toThrow(); });
  act(() => result.current.removePending(ids[0]));
  expect(result.current.removedIds).toEqual([ids[0]]);
  expect(removeEventAttachment).not.toHaveBeenCalled();
  await act(async () => result.current.commit("event-a", () => true));
  expect(removeEventAttachment).toHaveBeenCalledWith(expect.objectContaining({ attachment: expect.objectContaining({ id: ids[0] }) }));
  expect(jest.mocked(uploadEventAttachment).mock.calls.map(([input]) => input.file.id)).toEqual([ids[0], ids[1], ids[1]]);
  expect(result.current.files.map(file => file.id)).toEqual([ids[1]]);
});

test("a failed attempted upload can be removed even when no attachment object was returned", async () => {
  jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue(selected(["a.pdf"]));
  jest.mocked(uploadEventAttachment).mockRejectedValueOnce(new Error("prepare response lost"));
  const { result } = mount();
  await act(async () => result.current.pick());
  const id = result.current.files[0].id;
  await act(async () => { await expect(result.current.commit("event-a", () => true)).rejects.toThrow(); });
  act(() => result.current.removePending(id));
  expect(result.current.files).toHaveLength(0);
  expect(result.current.removedIds).toEqual([id]);
  await act(async () => result.current.commit("event-a", () => true));
  expect(removeEventAttachment).toHaveBeenCalledWith({ organizationId: "org-a", eventId: "event-a", attachment: { id, organizationId: "org-a", eventId: "event-a" } });
  expect(uploadEventAttachment).toHaveBeenCalledTimes(1);
});

test("a scope change during upload prevents subsequent uploads and progress from leaking", async () => {
  jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue(selected(["a.pdf", "b.pdf"]));
  const upload = deferred<EventAttachment>();
  jest.mocked(uploadEventAttachment).mockReturnValueOnce(upload.promise);
  const { result, rerender } = mount();
  await act(async () => result.current.pick());
  const id = result.current.files[0].id;
  let saving!: Promise<void>;
  act(() => { saving = result.current.commit("event-a", () => true); });
  rerender({ ...options, organizationId: "org-b", scope: "scope-b" });
  await act(async () => { upload.resolve(attachment(id)); await saving; });
  expect(uploadEventAttachment).toHaveBeenCalledTimes(1);
  expect(result.current.files).toHaveLength(0);
  expect(result.current.progress).toBeNull();
  expect(result.current.error).toBeNull();
});

test("opening uses a signed URL, blocks unfinished uploads and discards a stale signed response", async () => {
  const ready = attachment("ready"), pending = { ...attachment("pending"), uploadedAt: null };
  jest.mocked(listEventAttachments).mockResolvedValue([ready, pending]);
  const { result } = mount({ eventId: "event-a" });
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => result.current.open(pending));
  expect(Linking.openURL).not.toHaveBeenCalled();
  expect(getEventAttachmentUrl).not.toHaveBeenCalled();
  await act(async () => result.current.open(ready));
  expect(Linking.openURL).toHaveBeenCalledWith("https://fixture.example.test/signed");
  jest.mocked(Linking.openURL).mockClear();
  const url = deferred<string>();
  jest.mocked(getEventAttachmentUrl).mockReturnValueOnce(url.promise);
  let opening!: Promise<void>;
  act(() => { opening = result.current.open(ready); });
  mockIdentity = { userId: "user-b", generation: 2 };
  await act(async () => { url.resolve("https://fixture.example.test/stale"); await opening; });
  expect(Linking.openURL).not.toHaveBeenCalled();
});

test("permission and busy block local edits, while the authorized Save commit works with busy=true", async () => {
  jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue(selected(["a.pdf"]));
  const { result, rerender } = mount({ canManage: false });
  await act(async () => result.current.pick());
  expect(DocumentPicker.getDocumentAsync).not.toHaveBeenCalled();
  rerender(options);
  await act(async () => result.current.pick());
  const id = result.current.files[0].id;
  rerender({ ...options, busy: true });
  act(() => result.current.removePending(id));
  await act(async () => result.current.pick());
  expect(result.current.files).toHaveLength(1);
  await act(async () => result.current.commit("event-a", () => true));
  expect(uploadEventAttachment).toHaveBeenCalledTimes(1);
  expect(result.current.progress).toEqual({ completed: 1, total: 1 });
});
