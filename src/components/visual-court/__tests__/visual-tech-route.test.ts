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
    expect(editor!.documents.length).toBe(4);
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
    expect(editor!.loading).toBe(false); expect(editor!.documents).toHaveLength(4); expect(editor!.error).toBe("");
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
    expect(editor!.payload.editor?.title).toBe("Novo");
  });
});
