import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { CalendarEventAttachments } from "../CalendarEventAttachments";
import { getEventAttachmentUrl, type EventAttachment } from "../../../api/event-attachments";

let mockIdentity = { userId: "user-a", generation: 1 };
let mockReadGeneration = 1;
jest.mock("../../../auth/session", () => ({
  getSessionIdentity: () => ({ ...mockIdentity }),
  isSessionIdentityCurrent: (identity: typeof mockIdentity) => identity.userId === mockIdentity.userId && identity.generation === mockIdentity.generation,
}));
jest.mock("../../../db/client", () => ({ getReadCacheGeneration: () => mockReadGeneration }));
jest.mock("../../../api/event-attachments", () => ({ getEventAttachmentUrl: jest.fn() }));
jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: new Proxy({ info: "#93C5FD", dangerText: "#FCA5A5" }, { get: (target, key) => Reflect.get(target, key) ?? "#334455" }) }) }));
jest.mock("../../../ui/icon-registry", () => {
  const React = jest.requireActual("react"), { Text } = jest.requireActual("react-native");
  return { GoAtletaIcon: ({ name, color }: { name: string; color: string }) => React.createElement(Text, { testID: `attachment-icon-${name}`, style: { color } }, name) };
});
jest.mock("../../../ui/Pressable", () => ({ Pressable: jest.requireActual("react-native").Pressable }));
const attachment: EventAttachment = { id: "file-a", organizationId: "org-a", eventId: "event-a", name: "Regulamento.pdf", mimeType: "application/pdf", sizeBytes: 1024, objectPath: "org-a/event-a/file-a", createdBy: "user-a", createdAt: "2026-10-29", uploadedAt: "2026-10-29" };
const props = { attachments: [attachment], files: [], removedIds: [], canManage: true, disabled: false, loading: false, picking: false, error: null, progress: null,
  onPick: jest.fn(), onOpen: jest.fn(), onRemovePending: jest.fn(), onRemoveExisting: jest.fn(), onRetry: jest.fn() };
beforeEach(() => {
  jest.clearAllMocks(); mockIdentity = { userId: "user-a", generation: 1 }; mockReadGeneration = 1;
  jest.mocked(getEventAttachmentUrl).mockResolvedValue("https://fixture.example.test/preview");
});
const image = { ...attachment, id: "image-a", name: "Foto.png", mimeType: "image/png" };
const deferred = () => { let resolve!: (value: string) => void; const promise = new Promise<string>(done => { resolve = done; }); return { promise, resolve }; };

test("administrators can select files and stage removal without opening the file", () => {
  const view = render(React.createElement(CalendarEventAttachments, props));
  expect(view.getByText("Adicionar")).toHaveStyle({ color: "#93C5FD" });
  expect(view.getByText("1 item")).toBeTruthy();
  expect(view.getByTestId("attachment-icon-remove")).toHaveStyle({ color: "#FCA5A5" });
  fireEvent.press(view.getByLabelText("Adicionar anexo"));
  expect(props.onPick).toHaveBeenCalledTimes(1);
  fireEvent.press(view.getByLabelText("Abrir anexo: Regulamento.pdf"));
  expect(props.onOpen).toHaveBeenCalledWith(attachment);
  fireEvent.press(view.getByLabelText("Remover anexo: Regulamento.pdf"));
  expect(props.onRemoveExisting).toHaveBeenCalledWith("file-a");
});

test("read-only event detail exposes downloads but no management or incomplete files", () => {
  const view = render(React.createElement(CalendarEventAttachments, { ...props, canManage: false, attachments: [attachment, { ...attachment, id: "pending", name: "Imagem.png", uploadedAt: null }] }));
  expect(view.getByLabelText("Abrir anexo: Regulamento.pdf")).toBeTruthy();
  expect(view.queryByLabelText("Adicionar anexo")).toBeNull();
  expect(view.queryByLabelText("Remover anexo: Regulamento.pdf")).toBeNull();
  expect(view.queryByText("Imagem.png")).toBeNull();
});

test("incomplete uploads can be removed by administrators but never downloaded", () => {
  const pending = { ...attachment, uploadedAt: null };
  const view = render(React.createElement(CalendarEventAttachments, { ...props, attachments: [pending] }));
  expect(view.getByLabelText("Envio pendente: Regulamento.pdf")).toBeDisabled();
  expect(view.queryByLabelText("Abrir anexo: Regulamento.pdf")).toBeNull();
  fireEvent.press(view.getByLabelText("Remover anexo: Regulamento.pdf"));
  expect(props.onRemoveExisting).toHaveBeenCalledWith("file-a");
});

test("local pending files are not duplicated by a recovered upload intent and mutations block while saving", () => {
  const view = render(React.createElement(CalendarEventAttachments, { ...props, disabled: true, files: [{ id: attachment.id, uri: "blob:local", name: attachment.name, size: 1024 }], progress: "Salvando anexos: 0 de 1" }));
  expect(view.getAllByText("Regulamento.pdf")).toHaveLength(1);
  expect(view.getByLabelText("Adicionar anexo")).toBeDisabled();
  expect(view.getByLabelText("Remover anexo: Regulamento.pdf")).toBeDisabled();
  expect(view.getByText("Salvando anexos: 0 de 1")).toBeTruthy();
  expect(view.queryByLabelText("Abrir anexo: Regulamento.pdf")).toBeNull();
});

test("local images have a real thumbnail while documents expose their format and the count uses items", () => {
  const file = { id: "local-image", uri: "file:///cache/foto.png", name: "Foto.png", mimeType: "image/png", size: 2048 };
  const view = render(React.createElement(CalendarEventAttachments, { ...props, files: [file] }));
  expect(view.getByText("2 itens")).toBeTruthy();
  expect(view.getByTestId("attachment-preview-local-image").props.source).toEqual({ uri: file.uri });
  expect(view.getByText("PDF")).toBeTruthy();
  expect(getEventAttachmentUrl).not.toHaveBeenCalled();
  fireEvent.press(view.getByLabelText("Remover anexo: Foto.png"));
  expect(props.onRemovePending).toHaveBeenCalledWith(file.id);
  expect(props.onOpen).not.toHaveBeenCalled();
  fireEvent(view.getByTestId("attachment-preview-local-image"), "error", {});
  expect(view.queryByTestId("attachment-preview-local-image")).toBeNull();
  expect(view.getByText("PNG")).toBeTruthy();
});

test("saved images use signed previews and a new organization never receives the old thumbnail", async () => {
  const view = render(React.createElement(CalendarEventAttachments, { ...props, attachments: [image] }));
  await waitFor(() => expect(view.getByTestId("attachment-preview-image-a").props.source.uri).toBe("https://fixture.example.test/preview"));
  expect(getEventAttachmentUrl).toHaveBeenCalledWith({ organizationId: "org-a", eventId: "event-a", attachment: image });
  const next = deferred();
  jest.mocked(getEventAttachmentUrl).mockReturnValueOnce(next.promise);
  const other = { ...image, organizationId: "org-b", eventId: "event-b", objectPath: "org-b/event-b/image-a" };
  view.rerender(React.createElement(CalendarEventAttachments, { ...props, attachments: [other] }));
  expect(view.queryByTestId("attachment-preview-image-a")).toBeNull();
  await act(async () => next.resolve("https://fixture.example.test/new-organization"));
  expect(view.getByTestId("attachment-preview-image-a").props.source.uri).toBe("https://fixture.example.test/new-organization");
});

test("late previews from an old account or read generation cannot publish", async () => {
  const old = deferred(), fresh = deferred();
  jest.mocked(getEventAttachmentUrl).mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
  const view = render(React.createElement(CalendarEventAttachments, { ...props, attachments: [image] }));
  mockIdentity = { userId: "user-b", generation: 2 };
  view.rerender(React.createElement(CalendarEventAttachments, { ...props, attachments: [image] }));
  await act(async () => fresh.resolve("https://fixture.example.test/current-account"));
  await act(async () => old.resolve("https://fixture.example.test/old-account"));
  expect(view.getByTestId("attachment-preview-image-a").props.source.uri).toBe("https://fixture.example.test/current-account");
  const stale = deferred();
  jest.mocked(getEventAttachmentUrl).mockReturnValueOnce(stale.promise);
  mockReadGeneration += 1;
  view.rerender(React.createElement(CalendarEventAttachments, { ...props, attachments: [image] }));
  expect(view.queryByTestId("attachment-preview-image-a")).toBeNull();
  mockReadGeneration += 1;
  await act(async () => stale.resolve("https://fixture.example.test/old-generation"));
  expect(view.queryByTestId("attachment-preview-image-a")).toBeNull();
});

test("unfinished uploads never request a thumbnail and a failed image preview keeps the download action", async () => {
  const view = render(React.createElement(CalendarEventAttachments, { ...props, attachments: [{ ...image, uploadedAt: null }] }));
  expect(getEventAttachmentUrl).not.toHaveBeenCalled();
  expect(view.queryByTestId("attachment-preview-image-a")).toBeNull();
  jest.mocked(getEventAttachmentUrl).mockRejectedValueOnce(new Error("offline"));
  view.rerender(React.createElement(CalendarEventAttachments, { ...props, attachments: [image] }));
  await act(async () => {});
  expect(view.getByText("PNG")).toBeTruthy();
  fireEvent.press(view.getByLabelText("Abrir anexo: Foto.png"));
  expect(props.onOpen).toHaveBeenCalledWith(image);
});
