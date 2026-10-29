import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCourtEditor } from "../useCourtEditor";
import { newCourtBoard } from "../../../core/visual-court-editor";
import { SupabaseRequestTimeoutError } from "../../../db/client";

const mockSave = jest.fn();
const mockClass = jest.fn();
jest.mock("../../../auth/auth", () => ({ useAuth: () => ({ session: { user: { id: "user_1" } } }) }));
jest.mock("../../../observability/perf", () => ({ measureAsync: (_name: string, run: () => unknown) => run() }));
jest.mock("../../../db/seed", () => ({
  buildTechnicalVisualId: ({ organizationId, classId, title }: { organizationId: string; classId: string; title: string }) => `tv_${organizationId}_${classId}_${title}`,
  getClassById: (...args: unknown[]) => mockClass(...args),
  getStudentsByClass: async () => [], listTechnicalVisualsByClass: async () => [],
  saveTechnicalVisual: (...args: unknown[]) => mockSave(...args),
}));
jest.mock("@react-native-async-storage/async-storage", () => jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"));

// Exercise writes and durable snapshots through the real editor boundary.
describe("court automatic saving", () => {
  let tree: TestRenderer.ReactTestRenderer | undefined;
  let editor: ReturnType<typeof useCourtEditor>;
  const key = "goatleta:court-draft:v2:user_1:org_class_1:class_1";
  function Harness({ classId = "class_1", paused = false }: { classId?: string; paused?: boolean }) {
    editor = useCourtEditor(classId, { autosavePaused: paused }); return null;
  }
  const mount = async (props = {}) => { await act(async () => { tree = TestRenderer.create(React.createElement(Harness, props)); }); };
  const advance = async (ms: number) => act(async () => { jest.advanceTimersByTime(ms); });
  const rename = (title: string) => act(() => editor.commit(payload => ({ ...payload, editor: { ...payload.editor!, title } })));
  beforeEach(async () => {
    jest.useFakeTimers(); jest.clearAllMocks(); await AsyncStorage.clear();
    mockClass.mockImplementation(async (id: string) => ({ id, organizationId: `org_${id}`, name: "Turma" }));
    mockSave.mockImplementation(async input => ({ ...input, id: input.id ?? "saved_1", createdAt: "", updatedAt: "" }));
  });
  afterEach(() => { if (tree) act(() => tree!.unmount()); tree = undefined; jest.useRealTimers(); });

  it("never creates a document for bootstrap, step selection, or a no-op edit", async () => {
    await mount(); await advance(5000);
    act(() => editor.selectStep(3)); act(() => editor.commit(payload => payload));
    await advance(5000);
    expect(mockSave).not.toHaveBeenCalled(); expect(editor.autosaveStatus).toBe("idle");
  });
  it("keeps a recovered dirty draft local until the person edits or retries", async () => {
    const payload = newCourtBoard("Recuperado");
    await AsyncStorage.setItem(key, JSON.stringify({ payload, stepIndex: 0, documentId: "remote_recovered", unsaved: true }));
    await mount(); await advance(5000);
    expect(mockSave).not.toHaveBeenCalled(); expect(editor.autosaveStatus).toBe("local");
    act(() => editor.retryAutosave()); await advance(800);
    expect(mockSave).toHaveBeenCalledTimes(1); expect(mockSave.mock.calls[0][0]).toMatchObject({ id: "remote_recovered", payload });
  });
  it("coalesces edits into one scoped write after the last change without a success toast", async () => {
    await mount(); rename("Antes"); await advance(400); rename("Final"); await advance(799);
    expect(mockSave).not.toHaveBeenCalled(); expect(editor.autosaveStatus).toBe("pending");
    await advance(1);
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave.mock.calls[0]).toEqual([expect.objectContaining({ classId: "class_1", organizationId: "org_class_1", title: "Final", payload: editor.payload }), { requireRemote: true }]);
    expect(editor.dirty).toBe(false); expect(editor.autosaveStatus).toBe("saved"); expect(editor.notice).toBe("");
    act(() => editor.selectStep(2)); await advance(4000); expect(mockSave).toHaveBeenCalledTimes(1);
  });
  it("does not save a template when the edit is undone before the debounce", async () => {
    await mount(); rename("Transitória"); await advance(400); act(() => editor.undo()); await advance(2000);
    expect(editor.dirty).toBe(false); expect(editor.autosaveStatus).toBe("idle"); expect(mockSave).not.toHaveBeenCalled();
  });
  it.each([undefined, "local_existing"])("never marks an unchanged local document (%s) remotely saved after undo", async documentId => {
    await mount();
    await act(async () => { await editor.open(newCourtBoard("Somente local"), documentId); });
    const identity = editor.activeDocumentId;
    expect(identity).toMatch(/^local_/); expect(editor.autosaveStatus).toBe("local");
    rename("Transitória"); await advance(400); act(() => editor.undo()); await advance(2000);
    expect(editor.dirty).toBe(false); expect(editor.autosaveStatus).toBe("local"); expect(mockSave).not.toHaveBeenCalled();
    expect(JSON.parse((await AsyncStorage.getItem(key))!)).toMatchObject({ documentId: identity, unsaved: false });
  });
  it.each(["new", "imported"])("gives two %s boards with the same title distinct durable remote destinations", async kind => {
    await mount();
    const original = newCourtBoard("Mesmo título");
    await act(async () => { await editor.open(original); });
    const firstLocalId = editor.activeDocumentId;
    expect(JSON.parse((await AsyncStorage.getItem(key))!).documentId).toBe(firstLocalId);
    act(() => editor.commit(payload => ({ ...payload, editor: { ...payload.editor!, favorite: true } })));
    await advance(800);
    const second = kind === "imported" ? JSON.parse(JSON.stringify(original)) : newCourtBoard("Mesmo título");
    await act(async () => { await editor.open(second); });
    expect(editor.activeDocumentId).not.toBe(firstLocalId);
    act(() => editor.commit(payload => ({ ...payload, editor: { ...payload.editor!, favorite: true } })));
    await advance(800);
    expect(mockSave).toHaveBeenCalledTimes(2);
    const [first, next] = mockSave.mock.calls.map(([input]) => input);
    expect(first).toMatchObject({ title: "Mesmo título", classId: "class_1", organizationId: "org_class_1" });
    expect(next).toMatchObject({ title: "Mesmo título", classId: "class_1", organizationId: "org_class_1" });
    expect(next.id).not.toBe(first.id); expect(next.sourceId).not.toBe(first.sourceId);
  });
  it("recovers a new board's same destination after timeout, hook recreation and rename", async () => {
    mockSave.mockRejectedValueOnce(new SupabaseRequestTimeoutError());
    await mount(); await act(async () => { await editor.open(newCourtBoard("Antes do envio")); });
    const localId = editor.activeDocumentId;
    rename("Enviada"); await advance(800);
    const first = mockSave.mock.calls[0][0];
    expect(JSON.parse((await AsyncStorage.getItem(key))!)).toMatchObject({ documentId: localId, unsaved: true });
    act(() => tree!.unmount()); tree = undefined;
    await mount();
    expect(editor.activeDocumentId).toBe(localId); expect(editor.autosaveStatus).toBe("local");
    rename("Após reabrir"); await advance(800);
    expect(mockSave).toHaveBeenCalledTimes(2);
    expect(mockSave.mock.calls[1][0]).toMatchObject({ id: first.id, sourceId: first.sourceId, title: "Após reabrir" });
    expect(editor.autosaveStatus).toBe("saved");
  });
  it.each([null, undefined])("migrates an unidentified legacy draft (%s) without reusing the canonical template", async documentId => {
    await AsyncStorage.setItem(key, JSON.stringify({ payload: newCourtBoard("Importada antiga"), stepIndex: 0, documentId, unsaved: true }));
    await mount();
    const identity = editor.activeDocumentId;
    expect(identity).toMatch(/^local_draft_/);
    expect(JSON.parse((await AsyncStorage.getItem(key))!).documentId).toBe(identity);
    act(() => tree!.unmount()); tree = undefined;
    await mount(); expect(editor.activeDocumentId).toBe(identity);
    act(() => editor.retryAutosave()); await advance(800);
    expect(mockSave.mock.calls[0][0]).toMatchObject({ id: `tv_org_class_1_class_1_document:${identity}`, sourceId: identity });
    expect(mockSave.mock.calls[0][0].sourceId).not.toBe("goatleta:5x1-reception");
  });
  it("keeps the canonical template destination after an uncertain write and reload with a renamed title", async () => {
    mockSave.mockRejectedValueOnce(new SupabaseRequestTimeoutError());
    await mount(); rename("Nome autoral"); await advance(800);
    const first = mockSave.mock.calls[0][0];
    expect(first.id).toBe("tv_org_class_1_class_1_5×1 · Recepção"); expect(first.sourceId).toBe("goatleta:5x1-reception");
    act(() => tree!.unmount()); tree = undefined;
    await mount(); rename("Outro nome"); await advance(800);
    expect(mockSave.mock.calls[1][0]).toMatchObject({ id: first.id, sourceId: first.sourceId, title: "Outro nome" });
  });
  it("scopes the destination of a legacy local ID to its authorized class", async () => {
    await mount(); await act(async () => { await editor.open(newCourtBoard("Mesmo preset"), "local_shared_preset"); });
    rename("Primeira turma"); await advance(800);
    const first = mockSave.mock.calls[0][0];
    await act(async () => tree!.update(React.createElement(Harness, { classId: "class_2" })));
    await act(async () => { await editor.open(newCourtBoard("Mesmo preset"), "local_shared_preset"); });
    rename("Segunda turma"); await advance(800);
    expect(mockSave.mock.calls[1][0]).toMatchObject({ classId: "class_2", organizationId: "org_class_2", sourceId: "local_shared_preset" });
    expect(mockSave.mock.calls[1][0].id).not.toBe(first.id);
  });
  it("serializes a change made during the request and updates the same created document", async () => {
    let finish!: () => void;
    mockSave.mockImplementationOnce(input => new Promise(resolve => { finish = () => resolve({ ...input, createdAt: "", updatedAt: "" }); }));
    await mount(); rename("Primeira"); await advance(800);
    expect(editor.autosaveStatus).toBe("saving"); rename("Mais recente"); await advance(1600);
    expect(editor.autosaveStatus).toBe("saving"); expect(mockSave).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    expect(editor.dirty).toBe(true); expect(editor.autosaveStatus).toBe("pending");
    await advance(800);
    expect(mockSave).toHaveBeenCalledTimes(2);
    expect(mockSave.mock.calls[1][0]).toMatchObject({ id: mockSave.mock.calls[0][0].id, title: "Mais recente" });
    expect(editor.payload.editor!.title).toBe("Mais recente"); expect(editor.dirty).toBe(false); expect(editor.autosaveStatus).toBe("saved");
  });
  it("keeps a durable local draft after failure and retries the original destination even after rename", async () => {
    mockSave.mockRejectedValueOnce(new Error("Sem conexão"));
    await mount(); rename("Destino original"); await advance(800);
    const destination = mockSave.mock.calls[0][0].id;
    expect(editor.autosaveStatus).toBe("error"); expect(editor.error).toBe(""); expect(editor.autosaveError).toBe("Sem conexão");
    expect(JSON.parse((await AsyncStorage.getItem(key))!).payload.editor.title).toBe("Destino original");
    await advance(30000); expect(mockSave).toHaveBeenCalledTimes(1);
    rename("Novo nome"); await advance(800);
    expect(mockSave.mock.calls[1][0]).toMatchObject({ id: destination, title: "Novo nome" });
    expect(editor.autosaveStatus).toBe("saved"); expect(editor.dirty).toBe(false);
  });
  it("keeps an undo dirty after an uncertain write and retries the displayed baseline", async () => {
    let fail!: () => void;
    mockSave.mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = () => reject(new Error("Tempo esgotado após envio")); }));
    await mount();
    const baseline = newCourtBoard("A");
    await act(async () => { await editor.open(baseline, "remote_existing"); });
    rename("B"); await advance(800); act(() => editor.undo());
    expect(editor.dirty).toBe(false);
    await act(async () => fail());
    expect(editor.dirty).toBe(true); expect(editor.autosaveStatus).toBe("error");
    await advance(300);
    expect(JSON.parse((await AsyncStorage.getItem(key))!)).toMatchObject({ unsaved: true, payload: baseline });
    act(() => editor.retryAutosave()); await advance(800);
    expect(mockSave).toHaveBeenCalledTimes(2);
    expect(mockSave.mock.calls[1][0]).toMatchObject({ id: "remote_existing", payload: baseline });
    expect(editor.dirty).toBe(false); expect(editor.autosaveStatus).toBe("saved");
  });
  it("pauses the timer while the sharing preview is open and resumes without losing edits", async () => {
    await mount(); rename("Pausada"); await advance(400);
    await act(async () => tree!.update(React.createElement(Harness, { paused: true })));
    await advance(5000); expect(mockSave).not.toHaveBeenCalled();
    await act(async () => tree!.update(React.createElement(Harness, { paused: false })));
    await advance(800); expect(mockSave).toHaveBeenCalledTimes(1);
  });
  it("cancels a hidden page timer and resumes once after returning", async () => {
    const names = ["window", "document"] as const;
    const descriptors = names.map(name => Object.getOwnPropertyDescriptor(globalThis, name));
    const listeners = new Map<string, Set<() => void>>(); let hidden = false;
    const addEventListener = (type: string, listener: () => void) => { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type)!.add(listener); };
    const removeEventListener = (type: string, listener: () => void) => { listeners.get(type)?.delete(listener); };
    Object.defineProperty(globalThis, "window", { configurable: true, value: { addEventListener, removeEventListener } });
    Object.defineProperty(globalThis, "document", { configurable: true, value: { get hidden() { return hidden; }, addEventListener, removeEventListener } });
    try {
      await mount(); rename("Retomada"); await advance(400);
      act(() => { hidden = true; listeners.get("visibilitychange")?.forEach(fn => fn()); });
      await advance(5000); expect(mockSave).not.toHaveBeenCalled();
      act(() => { hidden = false; listeners.get("visibilitychange")?.forEach(fn => fn()); listeners.get("online")?.forEach(fn => fn()); });
      await advance(800); expect(mockSave).toHaveBeenCalledTimes(1);
    } finally {
      if (tree) act(() => tree!.unmount()); tree = undefined;
      names.forEach((name, index) => { if (descriptors[index]) Object.defineProperty(globalThis, name, descriptors[index]!); else Reflect.deleteProperty(globalThis, name); });
    }
  });
  it("ignores an old context response and never clears the new context's active save", async () => {
    const finish: (() => void)[] = [];
    mockSave.mockImplementation(input => new Promise(resolve => { finish.push(() => resolve({ ...input, createdAt: "", updatedAt: "" })); }));
    await mount(); rename("Turma anterior"); await advance(800);
    await act(async () => tree!.update(React.createElement(Harness, { classId: "class_2" })));
    rename("Turma atual"); await advance(800);
    expect(mockSave).toHaveBeenCalledTimes(2);
    await act(async () => finish[0]());
    expect(editor.saving).toBe(true); expect(editor.cls?.id).toBe("class_2"); expect(editor.payload.editor!.title).toBe("Turma atual");
    expect(editor.documents.every(doc => doc.classId === "class_2")).toBe(true);
    await act(async () => finish[1]());
    expect(editor.activeDocumentId).toBe(mockSave.mock.calls[1][0].id); expect(editor.autosaveStatus).toBe("saved");
  });
  it("writes the latest edit after a delayed saved-draft cleanup instead of erasing it", async () => {
    const remove = AsyncStorage.removeItem as jest.Mock;
    const originalRemove = remove.getMockImplementation();
    let finish!: () => void;
    remove.mockImplementationOnce((draftKey: string) => new Promise<void>(resolve => { finish = () => { void originalRemove!(draftKey).then(resolve); }; }));
    try {
      await mount(); rename("Salva"); await advance(300); await advance(500);
      expect(mockSave).toHaveBeenCalledTimes(1); expect(editor.saving).toBe(true);
      rename("Mais recente"); await advance(300);
      // Cleanup owns the queue, so the next draft is not allowed to overtake it.
      expect(JSON.parse((await AsyncStorage.getItem(key))!).payload.editor.title).toBe("Salva");
      await act(async () => finish());
      const stored = JSON.parse((await AsyncStorage.getItem(key))!);
      expect(stored).toMatchObject({ documentId: editor.activeDocumentId, unsaved: true });
      expect(stored.payload.editor.title).toBe("Mais recente");
      expect(editor.dirty).toBe(true);
    } finally { remove.mockImplementation(originalRemove); }
  });
  it.each(["timeout", "network"])("automatically retries one transient %s once after a short backoff", async kind => {
    const failure = kind === "timeout" ? new SupabaseRequestTimeoutError() : new TypeError("Failed to fetch");
    mockSave.mockRejectedValueOnce(failure);
    await mount(); rename("Recuperação automática"); await advance(800);
    expect(mockSave).toHaveBeenCalledTimes(1); expect(editor.autosaveStatus).toBe("pending"); expect(editor.autosaveError).toBe("");
    const destination = mockSave.mock.calls[0][0].id;
    await advance(1499); expect(mockSave).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(mockSave).toHaveBeenCalledTimes(2); expect(mockSave.mock.calls[1][0].id).toBe(destination);
    expect(editor.autosaveStatus).toBe("saved"); expect(editor.dirty).toBe(false);
  });
  it("stops after two transient failures and keeps the last failure and draft available for retry", async () => {
    mockSave.mockRejectedValue(new SupabaseRequestTimeoutError());
    await mount(); rename("Preservada após duas falhas"); await advance(300); await advance(500);
    expect(editor.autosaveStatus).toBe("pending"); await advance(1500);
    expect(mockSave).toHaveBeenCalledTimes(2); expect(editor.autosaveStatus).toBe("error");
    expect(editor.autosaveError).toBe(new SupabaseRequestTimeoutError().message); expect(editor.dirty).toBe(true);
    expect(JSON.parse((await AsyncStorage.getItem(key))!).payload.editor.title).toBe("Preservada após duas falhas");
    await advance(60000); expect(mockSave).toHaveBeenCalledTimes(2);
    act(() => editor.retryAutosave()); await advance(800); expect(mockSave).toHaveBeenCalledTimes(3);
    await advance(1500); expect(mockSave).toHaveBeenCalledTimes(4);
    await advance(60000); expect(mockSave).toHaveBeenCalledTimes(4);
  });
  it.each([401, 403, 422])("never automatically retries an authorization or validation rejection (%i)", async status => {
    mockSave.mockRejectedValue(Object.assign(new Error(`Supabase POST failed ${status} Rejected`), { status }));
    await mount(); rename("Sem repetição indevida"); await advance(800);
    expect(editor.autosaveStatus).toBe("error"); expect(editor.autosaveError).toContain(String(status));
    await advance(60000); expect(mockSave).toHaveBeenCalledTimes(1);
  });
  it.each(["preview", "unmount", "context"])("cancels a retry backoff when entering %s", async mode => {
    mockSave.mockRejectedValueOnce(new SupabaseRequestTimeoutError());
    await mount(); rename("Antes da pausa"); await advance(800); await advance(300);
    if (mode === "unmount") { act(() => tree!.unmount()); tree = undefined; }
    else await act(async () => tree!.update(React.createElement(Harness, mode === "preview" ? { paused: true } : { classId: "class_2" })));
    await advance(5000); expect(mockSave).toHaveBeenCalledTimes(1);
    if (mode === "preview") {
      await act(async () => tree!.update(React.createElement(Harness, { paused: false })));
      await advance(1499); expect(mockSave).toHaveBeenCalledTimes(1);
      await advance(1); expect(mockSave).toHaveBeenCalledTimes(2); expect(editor.autosaveStatus).toBe("saved");
    }
  });
  it("cancels hidden backoff and coalesces an edit into the latest snapshot at the same destination", async () => {
    const names = ["window", "document"] as const;
    const descriptors = names.map(name => Object.getOwnPropertyDescriptor(globalThis, name));
    const listeners = new Map<string, Set<() => void>>(); let hidden = false;
    const addEventListener = (type: string, listener: () => void) => { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type)!.add(listener); };
    const removeEventListener = (type: string, listener: () => void) => { listeners.get(type)?.delete(listener); };
    Object.defineProperty(globalThis, "window", { configurable: true, value: { addEventListener, removeEventListener } });
    Object.defineProperty(globalThis, "document", { configurable: true, value: { get hidden() { return hidden; }, addEventListener, removeEventListener } });
    mockSave.mockRejectedValueOnce(new SupabaseRequestTimeoutError());
    try {
      await mount(); rename("Antes do bloqueio"); await advance(800);
      const destination = mockSave.mock.calls[0][0].id;
      act(() => { hidden = true; listeners.get("visibilitychange")?.forEach(fn => fn()); });
      rename("Última versão"); await advance(5000); expect(mockSave).toHaveBeenCalledTimes(1);
      act(() => { hidden = false; listeners.get("visibilitychange")?.forEach(fn => fn()); });
      await advance(800);
      expect(mockSave).toHaveBeenCalledTimes(2); expect(mockSave.mock.calls[1][0]).toMatchObject({ id: destination, title: "Última versão" });
      expect(editor.autosaveStatus).toBe("saved");
    } finally {
      if (tree) act(() => tree!.unmount()); tree = undefined;
      names.forEach((name, index) => { if (descriptors[index]) Object.defineProperty(globalThis, name, descriptors[index]!); else Reflect.deleteProperty(globalThis, name); });
    }
  });
  it("cancels an outstanding timer when unmounted", async () => {
    await mount(); rename("Sem envio"); await advance(400); act(() => tree!.unmount()); tree = undefined;
    await advance(5000); expect(mockSave).not.toHaveBeenCalled();
  });
});
