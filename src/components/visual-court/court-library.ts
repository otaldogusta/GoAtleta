import type { CourtVisualDocument, CourtVisualPayload } from "../../core/visual-court";

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
  return document?.sourceKind === "rotation" || /(^|[\s,;])sistema([\s,;]|$)/i.test(payload.editor?.tags || "");
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

export function filterCourtLibraryItems(
  items: CourtLibraryItem[],
  options: { filter: CourtLibraryFilter; query: string; favorites: boolean; lessonDate?: string; onlyLesson: boolean },
): CourtLibraryItem[] {
  const query = options.query.trim().toLocaleLowerCase("pt-BR");
  return items.filter(item => {
    if (options.filter === "all" ? item.location === "trash" : item.location !== options.filter) return false;
    if (options.filter !== "trash") {
      if (options.favorites && !item.favorite) return false;
      if (options.onlyLesson && item.payload.editor?.lessonLink?.date !== options.lessonDate) return false;
    }
    const searchable = `${item.title} ${item.payload.editor?.folder || ""} ${item.payload.editor?.tags || ""} ${item.kind}`;
    return searchable.toLocaleLowerCase("pt-BR").includes(query);
  });
}
