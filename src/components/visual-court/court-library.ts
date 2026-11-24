import { buildSimulatedReceptionRotationPreset } from "../../core/court-simulation-sequence";
import type { CourtVisualDocument, CourtVisualPayload } from "../../core/visual-court";

export const COURT_SYSTEMS = [
  { value: "5-1", label: "5×1", id: "template_0", sourceId: "goatleta:5x1-reception" },
  { value: "4-2", label: "4×2", id: "template_4x2", sourceId: "goatleta:4x2-reception" },
  { value: "6-2", label: "6×2", id: "template_6x2", sourceId: "goatleta:6x2-reception" },
  { value: "6-0", label: "6×0", id: "template_6x0", sourceId: "goatleta:6x0-reception" },
] as const;

export function buildCourtSystemTemplates(classId = "", organizationId = ""): CourtVisualDocument[] {
  return COURT_SYSTEMS.map(({ value, label, id, sourceId }) => ({
    id, sourceId, classId, organizationId, sourceKind: "rotation", title: `${label} · Recepção`,
    payload: buildSimulatedReceptionRotationPreset(value), createdAt: "", updatedAt: "",
  }));
}

export type CourtLibraryLocation = "local" | "team" | "template" | "trash";
export type CourtLibraryFilter = "all" | CourtLibraryLocation;

export type CourtLibraryItem = {
  id: string;
  document: CourtVisualDocument | null;
  payload: CourtVisualPayload;
  title: string;
  location: CourtLibraryLocation;
  kind: "Jogada" | "Sistema";
  favorite: boolean;
  current: boolean;
  draft: boolean;
  updatedAt: string;
};

function isSystem(document: CourtVisualDocument | null, payload: CourtVisualPayload) {
  return document?.sourceKind === "rotation" || COURT_SYSTEMS.some(model => model.sourceId === document?.sourceId)
    || /(^|[\s,;])sistema([\s,;]|$)/i.test(payload.editor?.tags || "");
}

function locationFor(document: CourtVisualDocument): CourtLibraryLocation {
  return document.id.startsWith("template_") ? "template" : document.id.startsWith("local_") ? "local" : "team";
}

const legacyStarterSourceIds = new Set(["5x1_receive_3", "5x1_serving", "defense_base_6_back", "didactic_grid"]);

function isUntouchedLegacyStarter(document: CourtVisualDocument) {
  return legacyStarterSourceIds.has(document.sourceId ?? "") &&
    Boolean(document.createdAt) && document.createdAt === document.updatedAt;
}

export function buildCourtLibraryItems(
  documents: CourtVisualDocument[],
  trashedIds: string[],
  current: { payload: CourtVisualPayload; documentId: string | null; dirty: boolean },
): CourtLibraryItem[] {
  const trashed = new Set(trashedIds);
  const currentDocument = documents.find(document => document.id === current.documentId);
  const items: CourtLibraryItem[] = documents.filter(document =>
    document.id === current.documentId || trashed.has(document.id) || !isUntouchedLegacyStarter(document)
  ).map(document => {
    const isCurrent = document.id === current.documentId;
    const payload = isCurrent && current.dirty ? current.payload : document.payload;
    return {
      id: document.id,
      document,
      payload,
      title: isCurrent ? payload.editor?.title || document.title : document.title,
      location: trashed.has(document.id) ? "trash" : locationFor(document),
      kind: isSystem(document, payload) ? "Sistema" : "Jogada",
      favorite: Boolean(payload.editor?.favorite),
      current: isCurrent,
      draft: isCurrent && current.dirty,
      updatedAt: document.updatedAt,
    } satisfies CourtLibraryItem;
  });

  // A new or imported draft has no document row yet. Reuse an existing row
  // whenever one was opened so the selected card never appears duplicated.
  if (current.dirty && !currentDocument) {
    items.unshift({
      id: "current-draft",
      document: null,
      payload: current.payload,
      title: current.payload.editor?.title || "Rascunho sem nome",
      location: "local",
      kind: isSystem(null, current.payload) ? "Sistema" : "Jogada",
      favorite: Boolean(current.payload.editor?.favorite),
      current: true,
      draft: true,
      updatedAt: "",
    });
  }
  // Older versions generated an identical backup on every switch. Group only
  // exact local copies in the normal library; storage and trash retain every file.
  const localCopies = new Map<string, CourtLibraryItem>();
  const signatureFor = (item: CourtLibraryItem) => JSON.stringify([item.document?.organizationId, item.document?.classId, item.title, item.document?.sourceKind, item.payload]);
  for (const item of items) {
    if (item.location !== "local" || !item.document) continue;
    const signature = signatureFor(item);
    if (!localCopies.has(signature) || item.current) localCopies.set(signature, item);
  }
  return items.filter(item => item.location !== "local" || !item.document || localCopies.get(signatureFor(item)) === item);
}

function searchableText(text: string) {
  return text.toLocaleLowerCase("pt-BR").replace(/(\d)\s*[x×–-]\s*(?=\d)/g, "$1x");
}

export function filterCourtLibraryItems(
  items: CourtLibraryItem[],
  options: { filter: CourtLibraryFilter; query: string; favorites: boolean; lessonDate?: string; onlyLesson: boolean },
): CourtLibraryItem[] {
  const query = searchableText(options.query.trim());
  return items.filter(item => {
    if (options.filter === "all" ? item.location === "trash" : item.location !== options.filter) return false;
    if (options.filter !== "trash") {
      if (options.favorites && !item.favorite) return false;
      if (options.onlyLesson && item.payload.editor?.lessonLink?.date !== options.lessonDate) return false;
    }
    const searchable = `${item.title} ${item.payload.editor?.folder || ""} ${item.payload.editor?.tags || ""} ${item.kind}`;
    return searchableText(searchable).includes(query);
  });
}
