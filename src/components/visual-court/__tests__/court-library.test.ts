import { newCourtBoard } from "../../../core/visual-court-editor";
import type { CourtVisualDocument } from "../../../core/visual-court";
import { buildCourtLibraryItems, filterCourtLibraryItems } from "../court-library";

const document = (id: string, title: string, tags = ""): CourtVisualDocument => {
  const payload = newCourtBoard(title);
  payload.editor!.tags = tags;
  return { id, classId: "class_1", organizationId: "org_1", sourceKind: "free", title, payload, createdAt: "2026-10-01T10:00:00Z", updatedAt: "2026-10-02T10:00:00Z" };
};

describe("court library", () => {
  it("selects the opened version in its original group without a duplicate draft card", () => {
    const saved = document("saved_1", "Recepção original");
    const local = document("local_1", "Defesa", "sistema");
    const template = document("template_0", "Modelo");
    const draft = newCourtBoard("Recepção ajustada");
    const items = buildCourtLibraryItems([saved, local, template], [], { payload: draft, documentId: saved.id, dirty: true });
    expect(items).toHaveLength(3);
    expect(items.find(item => item.id === saved.id)).toMatchObject({ title: "Recepção ajustada", location: "team", current: true, draft: true, document: saved });
    expect(items.find(item => item.id === local.id)).toMatchObject({ location: "local", kind: "Sistema" });
    expect(items.find(item => item.id === template.id)?.location).toBe("template");
  });

  it("adds one local card only when the current board has no document yet", () => {
    const saved = document("saved_1", "Recepção original");
    const draft = newCourtBoard("Nova jogada");
    const items = buildCourtLibraryItems([saved], [], { payload: draft, documentId: null, dirty: true });
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ title: "Nova jogada", location: "local", current: true, draft: true, document: null });
  });

  it("selects a clean saved item and keeps trash out of normal results", () => {
    const saved = document("saved_1", "Saque");
    const deleted = document("local_2", "Defesa antiga");
    const items = buildCourtLibraryItems([saved, deleted], [deleted.id], { payload: saved.payload, documentId: saved.id, dirty: false });
    expect(items.find(item => item.id === saved.id)?.current).toBe(true);
    expect(filterCourtLibraryItems(items, { filter: "all", query: "", favorites: false, onlyLesson: false })).toHaveLength(1);
    expect(filterCourtLibraryItems(items, { filter: "trash", query: "", favorites: false, onlyLesson: false })[0].id).toBe(deleted.id);
  });

  it("reuses the local row while its draft is open instead of listing it twice", () => {
    const local = document("local_1", "Versão anterior");
    const edited = newCourtBoard("Versão em edição");
    const items = buildCourtLibraryItems([local], [], { payload: edited, documentId: local.id, dirty: true });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ title: "Versão em edição", location: "local", current: true, draft: true });
  });

  it("matches names, type and tags without mixing storage locations", () => {
    const local = document("local_1", "Defesa de fundo", "sistema");
    const team = document("saved_1", "Ataque", "saque");
    const items = buildCourtLibraryItems([local, team], [], { payload: local.payload, documentId: local.id, dirty: false });
    expect(filterCourtLibraryItems(items, { filter: "local", query: "SISTEMA", favorites: false, onlyLesson: false }).map(item => item.id)).toEqual([local.id]);
    expect(filterCourtLibraryItems(items, { filter: "team", query: "saque", favorites: false, onlyLesson: false }).map(item => item.id)).toEqual([team.id]);
  });

  it("hides untouched legacy starters while preserving edited and trashed versions", () => {
    const starter = { ...document("saved_starter", "Grade didática"), sourceId: "didactic_grid", createdAt: "2026-07-29T10:00:00Z", updatedAt: "2026-07-29T10:00:00Z" };
    const edited = { ...document("saved_edited", "Minha defesa"), sourceId: "defense_base_6_back" };
    const authored = document("saved_authored", "Minha jogada");
    const items = buildCourtLibraryItems([starter, edited, authored], [], { payload: authored.payload, documentId: authored.id, dirty: false });
    expect(items.map(item => item.id)).toEqual([edited.id, authored.id]);
    const trashedItems = buildCourtLibraryItems([starter], [starter.id], { payload: authored.payload, documentId: null, dirty: false });
    expect(trashedItems[0]).toMatchObject({ id: starter.id, location: "trash" });
  });
  it("groups exact legacy local copies around the opened card without deleting originals", () => {
    const original = document("local_original", "Nova jogada");
    const duplicate = { ...original, id: "local_duplicate", updatedAt: "2026-10-04T10:00:00Z" };
    const documents = [original, duplicate];
    const items = buildCourtLibraryItems(documents, [], { payload: duplicate.payload, documentId: duplicate.id, dirty: false });
    expect(items.map(item => item.id)).toEqual([duplicate.id]);
    expect(items[0].current).toBe(true);
    expect(documents).toHaveLength(2);
    const trashed = buildCourtLibraryItems(documents, [original.id, duplicate.id], { payload: duplicate.payload, documentId: duplicate.id, dirty: false });
    expect(trashed.map(item => item.id)).toEqual([original.id, duplicate.id]);
  });
  it("keeps distinct authored versions and separate storage locations", () => {
    const original = document("local_original", "Nova jogada");
    const different = { ...original, id: "local_other", payload: { ...original.payload, editor: { ...original.payload.editor!, notes: "Mudança autoral" } } };
    const saved = { ...original, id: "remote_1" };
    const items = buildCourtLibraryItems([original, different, saved], [], { payload: original.payload, documentId: original.id, dirty: false });
    expect(items.map(item => item.id)).toEqual([original.id, different.id, saved.id]);
  });
  it("does not hide the original copy when the opened copy has unsaved changes", () => {
    const original = document("local_original", "Nova jogada");
    const duplicate = { ...original, id: "local_duplicate" };
    const edited = { ...duplicate.payload, editor: { ...duplicate.payload.editor!, notes: "Alteração atual" } };
    const items = buildCourtLibraryItems([original, duplicate], [], { payload: edited, documentId: duplicate.id, dirty: true });
    expect(items.map(item => item.id)).toEqual([original.id, duplicate.id]);
    expect(items[1]).toMatchObject({ current: true, draft: true, payload: edited });
  });

});
