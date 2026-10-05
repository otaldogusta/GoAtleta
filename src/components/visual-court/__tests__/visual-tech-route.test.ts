import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCourtEditor } from "../useCourtEditor";
import { moveSelection, newCourtBoard, actorPoint } from "../../../core/visual-court-editor";

const mockClass = jest.fn();
const mockStudents = jest.fn();
const mockList = jest.fn();
const mockSave = jest.fn();
let mockUser = "user_1";
jest.mock("../../../auth/auth", () => ({ useAuth: () => ({ session: mockUser ? { user: { id: mockUser } } : null }) }));
jest.mock("../../../observability/perf", () => ({ measureAsync: (_name: string, run: () => unknown) => run() }));
jest.mock("../../../db/seed", () => ({
  getClassById: (...args: unknown[]) => mockClass(...args),
  getStudentsByClass: (...args: unknown[]) => mockStudents(...args),
  listTechnicalVisualsByClass: (...args: unknown[]) => mockList(...args),
  saveTechnicalVisual: (...args: unknown[]) => mockSave(...args),
}));
jest.mock("@react-native-async-storage/async-storage", () => jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"));

// The route now delegates document operations to this controller. These tests
// exercise the actual state/history/storage boundary instead of native SVG internals.
describe("visual court workspace persistence and history", () => {
  let tree: TestRenderer.ReactTestRenderer;
  let editor: ReturnType<typeof useCourtEditor>;
  const draftKey = "goatleta:court-draft:v2:user_1:org_1:class_1";
  function Harness() { editor = useCourtEditor("class_1"); return null; }
  const mount = async () => { await act(async () => { tree = TestRenderer.create(React.createElement(Harness)); }); };
  beforeEach(async () => {
    jest.clearAllMocks(); mockUser = "user_1";
    await AsyncStorage.clear();
    mockClass.mockResolvedValue({ id: "class_1", organizationId: "org_1", name: "Turma" });
    mockStudents.mockResolvedValue([]); mockList.mockResolvedValue([]);
    mockSave.mockImplementation(async (input) => ({ ...input, id: "saved_1", createdAt: "", updatedAt: "" }));
  });
  afterEach(() => { if (tree) act(() => tree.unmount()); });

  it("loads only the authorized class scope and never seeds remote documents", async () => {
    await mount();
    expect(editor!.loading).toBe(false);
    expect(mockList).toHaveBeenCalledWith("class_1", { organizationId: "org_1", limit: 200 });
    expect(mockStudents).toHaveBeenCalledWith("class_1", { organizationId: "org_1" });
    expect(mockSave).not.toHaveBeenCalled();
    expect(editor!.documents.length).toBe(1);
    expect(editor!.dirty).toBe(false);
  });
  it("does not read documents or roster when class authorization fails", async () => {
    mockClass.mockResolvedValue(null); await mount();
    expect(mockList).not.toHaveBeenCalled(); expect(mockStudents).not.toHaveBeenCalled();
    expect(editor!.cls).toBeNull(); expect(editor!.error).toContain("indisponível");
  });
  it("persists reversible library trash in user/org/class scope without changing the open board", async () => {
    await mount();
    const before = editor!.payload;
    const id = editor!.documents[0].id;
    await act(async () => { await editor!.setDocumentTrashed(id, true); });
    expect(editor!.trashedIds).toContain(id);
    expect(editor!.payload).toBe(before);
    expect(JSON.parse((await AsyncStorage.getItem("goatleta:court-trash:v1:user_1:org_1:class_1"))!)).toContain(id);
    act(() => tree.unmount()); await mount();
    expect(editor!.trashedIds).toContain(id);
    await act(async () => { await editor!.setDocumentTrashed(id, false); });
    expect(editor!.trashedIds).not.toContain(id);
    expect(mockSave).not.toHaveBeenCalled();
  });
  it("does not read any class data without a session", async () => {
    mockUser = ""; await mount(); expect(mockClass).not.toHaveBeenCalled(); expect(editor!.error).toContain("conta");
  });
  it("recovers only this user/org/class draft", async () => {
    const payload = newCourtBoard("Meu rascunho");
    await AsyncStorage.setItem(draftKey, JSON.stringify({ payload, stepIndex: 0 }));
    await AsyncStorage.setItem(draftKey.replace("user_1", "user_2"), JSON.stringify({ payload: newCourtBoard("Outro usuário"), stepIndex: 0 }));
    await mount(); expect(editor!.payload.editor?.title).toBe("Meu rascunho"); expect(editor!.dirty).toBe(true);
  });
  it("ignores corrupt local state without losing remote library access", async () => {
    await AsyncStorage.setItem(draftKey, "bad json"); await mount();
    expect(editor!.loading).toBe(false); expect(editor!.documents).toHaveLength(1); expect(editor!.error).toBe("");
  });
  it("records a gesture once, undoes and redoes the actual positions", async () => {
    await mount(); const id = editor!.payload.actors[0].id;
    const before = actorPoint(editor!.payload, 0, id);
    act(() => editor!.commit(p => moveSelection(p, 0, [id], { x: 0.05, y: 0.04 })));
    const moved = actorPoint(editor!.payload, 0, id);
    expect(moved).not.toEqual(before); expect(editor!.canUndo).toBe(true);
    act(() => editor!.undo()); expect(actorPoint(editor!.payload, 0, id)).toEqual(before); expect(editor!.canUndo).toBe(false);
    act(() => editor!.redo()); expect(actorPoint(editor!.payload, 0, id)).toEqual(moved);
  });
  it("creates the canonical 5x1 document once and updates the same document afterwards", async () => {
    await mount(); const id = editor!.payload.actors[0].id;
    const original = editor!.payload;
    await act(async () => {
      editor!.commit(p => moveSelection(p, 0, [id], { x: 0.05, y: 0.04 }));
      await editor!.save();
    });
    expect(mockSave).toHaveBeenCalledTimes(1);
    const input = mockSave.mock.calls[0][0];
    expect(input.id).toBeUndefined(); expect(input.organizationId).toBe("org_1");
    expect(input.sourceId).toBe("goatleta:5x1-reception"); expect(input.payload).toEqual(editor!.payload);
    expect(input.payload).not.toEqual(original); expect(editor!.dirty).toBe(false);
    await act(async () => {
      editor!.commit(p => ({ ...p, editor: { ...p.editor!, title: "5×1 ajustado" } }));
      await editor!.save();
    });
    expect(mockSave).toHaveBeenCalledTimes(2);
    expect(mockSave.mock.calls[1][0].id).toBe("saved_1");
    expect(mockSave.mock.calls[1][0].sourceId).toBe("goatleta:5x1-reception");
  });
  it("prevents concurrent duplicate saves", async () => {
    await mount(); act(() => editor!.commit(p => ({ ...p, editor: { ...p.editor!, title: "Teste" } })));
    await act(async () => { await Promise.all([editor!.save(), editor!.save()]); });
    expect(mockSave).toHaveBeenCalledTimes(1);
  });
  it("allows saving an untouched model and keeps its source model", async () => {
    await mount();
    expect(editor!.dirty).toBe(false);
    expect(editor!.canSave).toBe(true);
    await act(async () => { await editor!.save(); });
    expect(editor!.activeDocumentId).toBe("saved_1");
    expect(editor!.documents.some(document => document.id === "template_0")).toBe(true);
    expect(editor!.canSave).toBe(false);
  });
  it("retains a local fallback across reload and allows synchronization without editing", async () => {
    await mount();
    mockSave.mockImplementationOnce(async input => ({ ...input, id: "local_offline", createdAt: "", updatedAt: "" }));
    await act(async () => { await editor!.save(); });
    const original = editor!.payload;
    expect(editor!.canSave).toBe(true);
    expect(editor!.notice).toContain("sincronização pendente");
    expect(JSON.parse((await AsyncStorage.getItem(draftKey))!).documentId).toBe("local_offline");
    act(() => tree.unmount()); await mount();
    expect(editor!.payload).toEqual(original);
    expect(editor!.dirty).toBe(false);
    expect(editor!.canSave).toBe(true);
    await act(async () => { await editor!.save(); });
    expect(editor!.activeDocumentId).toBe("saved_1");
    expect(await AsyncStorage.getItem(draftKey)).toBeNull();
    expect(editor!.canSave).toBe(false);
  });
  it("does not switch the open document during an outstanding save and preserves row order", async () => {
    const first = newCourtBoard("Primeira"), second = newCourtBoard("Segunda");
    mockList.mockResolvedValue([first, second].map((payload, i) => ({ id: `remote_${i}`, classId: "class_1", organizationId: "org_1", title: payload.editor!.title, payload, sourceKind: "free", createdAt: "", updatedAt: "" })));
    await mount();
    await act(async () => { await editor!.open(first, "remote_0"); });
    act(() => editor!.commit(payload => ({ ...payload, editor: { ...payload.editor!, title: "Primeira ajustada" } })));
    let resolveSave!: (value: unknown) => void;
    mockSave.mockImplementationOnce(input => new Promise(resolve => { resolveSave = value => resolve({ ...input, id: "remote_0", ...value as object }); }));
    let saving!: Promise<boolean | undefined>;
    act(() => { saving = editor!.save(); });
    await act(async () => { await editor!.open(second, "remote_1"); });
    expect(editor!.activeDocumentId).toBe("remote_0");
    await act(async () => { resolveSave({}); await saving; });
    expect(editor!.documents.slice(0, 2).map(document => document.id)).toEqual(["remote_0", "remote_1"]);
    expect(editor!.payload.editor!.title).toBe("Primeira ajustada");
  });
  it("keeps protection failures visible until local storage succeeds", async () => {
    jest.useFakeTimers();
    const write = AsyncStorage.setItem as jest.Mock;
    const originalWrite = write.getMockImplementation();
    try {
      await mount();
      write.mockRejectedValueOnce(new Error("Storage full"));
      act(() => editor!.commit(payload => ({ ...payload, editor: { ...payload.editor!, title: "Preservar" } })));
      await act(async () => { jest.advanceTimersByTime(350); });
      expect(editor!.draftError).toContain("Falha no rascunho");
      expect(editor!.dirty).toBe(true);
      await act(async () => { await editor!.preserveDraft(); });
      expect(editor!.draftError).toBe("");
      expect(JSON.parse((await AsyncStorage.getItem(draftKey))!).payload.editor.title).toBe("Preservar");
    } finally { write.mockImplementation(originalWrite); jest.useRealTimers(); }
  });
  it("keeps dirty work after a failed save and can flush it before exiting", async () => {
    await mount(); mockSave.mockRejectedValue(new Error("Sem conexão"));
    act(() => editor!.commit(p => ({ ...p, editor: { ...p.editor!, title: "Recuperável" } })));
    await act(async () => { expect(await editor!.save()).toBeFalsy(); expect(await editor!.preserveDraft()).toBe(true); });
    expect(editor!.dirty).toBe(true); expect(editor!.error).toBe("Sem conexão");
    expect(JSON.parse((await AsyncStorage.getItem(draftKey))!).payload.editor.title).toBe("Recuperável");
  });
  it("backs up unsaved work before switching documents", async () => {
    await mount(); act(() => editor!.commit(p => ({ ...p, editor: { ...p.editor!, title: "Anterior" } })));
    await act(async () => { await editor!.open(newCourtBoard("Novo")); });
    const keys = await AsyncStorage.getAllKeys();
    const backup = keys.find(k => k.startsWith(`${draftKey}:backup:`));
    expect(backup).toBeTruthy();
    expect(JSON.parse((await AsyncStorage.getItem(backup!))!).payload.editor.title).toBe("Anterior");
    expect(editor!.documents.at(-1)?.id).toMatch(/^local_/);
    expect(editor!.payload.editor?.title).toBe("Novo");
  });
  it("keeps the opened library card selected without making untouched copies or backups", async () => {
    const payload = newCourtBoard("Grade didática");
    const local = { id: "local_existing", classId: "class_1", organizationId: "org_1", title: "Grade didática", sourceKind: "free", payload, createdAt: "", updatedAt: "" };
    await AsyncStorage.setItem(`${draftKey}:backup:local_existing`, JSON.stringify(local));
    await mount();
    await act(async () => { await editor!.open(local.payload, local.id); });
    expect(editor!.activeDocumentId).toBe(local.id);
    expect(editor!.dirty).toBe(false);
    expect(editor!.documents.filter(document => document.id.startsWith("local_"))).toHaveLength(1);
    expect(JSON.parse((await AsyncStorage.getItem(draftKey))!).documentId).toBe(local.id);
    act(() => tree.unmount()); await mount();
    expect(editor!.activeDocumentId).toBe(local.id);
    expect(editor!.dirty).toBe(false);
    await act(async () => { await editor!.open(editor!.documents.find(document => document.id === "template_0")!.payload, "template_0"); });
    expect(editor!.documents.filter(document => document.id.startsWith("local_"))).toHaveLength(1);
  });
  it("updates the same local draft when switching away after edits and after reopening", async () => {
    const payload = newCourtBoard("Nova jogada");
    const local = { id: "local_existing", classId: "class_1", organizationId: "org_1", title: "Nova jogada", sourceKind: "free", payload, createdAt: "2026-10-02T10:00:00Z", updatedAt: "2026-10-02T10:00:00Z" };
    await AsyncStorage.setItem(`${draftKey}:backup:${local.id}`, JSON.stringify(local));
    await mount();
    const model = editor!.documents.find(document => document.id === "template_0")!;
    await act(async () => { await editor!.open(local.payload, local.id); });
    for (const title of ["Nova ajustada", "Nova final"]) {
      act(() => editor!.commit(value => ({ ...value, editor: { ...value.editor!, title } })));
      const current = editor!.payload;
      await act(async () => { await editor!.open(local.payload, local.id); });
      expect(editor!.payload).toBe(current);
      expect(editor!.dirty).toBe(true);
      await act(async () => { await editor!.open(model.payload, model.id); });
      const drafts = editor!.documents.filter(document => document.id.startsWith("local_"));
      expect(drafts).toHaveLength(1);
      expect(drafts[0]).toMatchObject({ id: local.id, createdAt: local.createdAt, title, payload: current });
      expect((await AsyncStorage.getAllKeys()).filter(key => key.startsWith(`${draftKey}:backup:`))).toEqual([`${draftKey}:backup:${local.id}`]);
      await act(async () => { await editor!.open(drafts[0].payload, drafts[0].id); });
    }
    act(() => tree.unmount()); await mount();
    expect(editor!.documents.filter(document => document.id.startsWith("local_"))).toHaveLength(1);
    expect(editor!.payload.editor!.title).toBe("Nova final");
    expect(mockSave).not.toHaveBeenCalled();
  });
  it("retains the local identity recovered from cache even when its library row is missing", async () => {
    const payload = newCourtBoard("Rascunho recuperado");
    await AsyncStorage.setItem(draftKey, JSON.stringify({ payload, stepIndex: 0, documentId: "local_recovered" }));
    await mount();
    expect(editor!.activeDocumentId).toBe("local_recovered");
    expect(editor!.dirty).toBe(true);
    const model = editor!.documents.find(document => document.id === "template_0")!;
    await act(async () => { await editor!.open(model.payload, model.id); });
    const drafts = editor!.documents.filter(document => document.id.startsWith("local_"));
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({ id: "local_recovered", payload });
    expect((await AsyncStorage.getAllKeys()).filter(key => key.startsWith(`${draftKey}:backup:`))).toEqual([`${draftKey}:backup:local_recovered`]);
    expect(mockSave).not.toHaveBeenCalled();
  });
  it("serializes rapid switches and recovers from a failed local write without losing the board", async () => {
    await mount();
    act(() => editor!.commit(payload => ({ ...payload, editor: { ...payload.editor!, title: "Rascunho anterior" } })));
    await act(async () => {
      const results = await Promise.all([editor!.open(newCourtBoard("Primeira")), editor!.open(newCourtBoard("Segunda"))]);
      expect(results).toEqual([true, false]);
    });
    expect(editor!.payload.editor!.title).toBe("Primeira");
    expect(editor!.documents.filter(document => document.id.startsWith("local_"))).toHaveLength(1);
    act(() => editor!.commit(payload => ({ ...payload, editor: { ...payload.editor!, title: "Primeira editada" } })));
    const before = editor!.payload;
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error("Storage full"));
    await act(async () => { await expect(editor!.open(newCourtBoard("Bloqueada"))).rejects.toThrow("Storage full"); });
    expect(editor!.payload).toBe(before);
    expect(editor!.opening).toBe(false);
    expect(mockSave).not.toHaveBeenCalled();
  });

});
