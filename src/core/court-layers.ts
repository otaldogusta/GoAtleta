import type { CourtVisualPayload } from "./visual-court";

export type CourtLayerRef = { kind: "actor" | "drawing"; id: string };
export const courtLayerKey = (ref: CourtLayerRef) => `${ref.kind}:${ref.id}`;

function availableLayers(payload: CourtVisualPayload, stepIndex: number): CourtLayerRef[] {
  const step = payload.timeline.steps[stepIndex];
  if (!step) return [];
  const visible = step.visibleActorIds ? new Set(step.visibleActorIds) : null;
  return [
    ...(payload.editor?.drawings[step.id] ?? []).map(drawing => ({ kind: "drawing" as const, id: drawing.id })),
    ...payload.actors.filter(actor => !visible || visible.has(actor.id)).map(actor => ({ kind: "actor" as const, id: actor.id })),
  ];
}

function normalizeOrder(available: CourtLayerRef[], raw: unknown): CourtLayerRef[] {
  const remaining = new Map(available.map(ref => [courtLayerKey(ref), ref]));
  const ordered: CourtLayerRef[] = [];
  // An imported document has at most 100 actors and 200 drawings per step.
  for (const value of (Array.isArray(raw) ? raw.slice(0, 300) : [])) {
    if (!value || (value.kind !== "actor" && value.kind !== "drawing") || typeof value.id !== "string") continue;
    const key = courtLayerKey(value);
    const ref = remaining.get(key);
    if (!ref) continue;
    ordered.push(ref);
    remaining.delete(key);
  }
  return [...ordered, ...remaining.values()];
}

/** Authoring order, from back to front. Legacy documents keep drawings below actors. */
export function resolveCourtLayers(payload: CourtVisualPayload, stepIndex: number): CourtLayerRef[] {
  const step = payload.timeline.steps[stepIndex];
  return normalizeOrder(availableLayers(payload, stepIndex), step && payload.editor?.layerOrder?.[step.id]);
}

function setCourtLayerFlag(payload: CourtVisualPayload, stepIndex: number, ref: CourtLayerRef, flag: "hidden" | "locked", value: boolean): CourtVisualPayload {
  const step = payload.timeline.steps[stepIndex], editor = payload.editor;
  if (!step || !editor || typeof value !== "boolean" || !availableLayers(payload, stepIndex).some(item => courtLayerKey(item) === courtLayerKey(ref))) return payload;
  if (ref.kind === "actor") {
    const meta = editor.actorMeta[ref.id];
    if (Boolean(meta?.[flag]) === value) return payload;
    return { ...payload, editor: { ...editor, actorMeta: { ...editor.actorMeta, [ref.id]: { ...meta, [flag]: value } } } };
  }
  const drawings = editor.drawings[step.id], drawing = drawings.find(item => item.id === ref.id)!;
  if (Boolean(drawing[flag]) === value) return payload;
  return { ...payload, editor: { ...editor, drawings: { ...editor.drawings, [step.id]: drawings.map(item => item.id === ref.id ? { ...item, [flag]: value } : item) } } };
}

/** Presentation only: keep the object, its geometry and simulation available for showing again. */
export const setCourtLayerHidden = (payload: CourtVisualPayload, stepIndex: number, ref: CourtLayerRef, hidden: boolean) => setCourtLayerFlag(payload, stepIndex, ref, "hidden", hidden);
/** Locking never prevents using the layer controls to unlock or change visibility. */
export const setCourtLayerLocked = (payload: CourtVisualPayload, stepIndex: number, ref: CourtLayerRef, locked: boolean) => setCourtLayerFlag(payload, stepIndex, ref, "locked", locked);

/** Import whitelist: only existing steps and typed, bounded object references survive. */
export function normalizeCourtLayerOrder(payload: CourtVisualPayload, raw: unknown): Record<string, CourtLayerRef[]> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const source = raw as Record<string, unknown>;
  const entries = payload.timeline.steps.flatMap((step, index) => Array.isArray(source[step.id])
    ? [[step.id, normalizeOrder(availableLayers(payload, index), source[step.id])]] : []);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export function moveCourtLayer(payload: CourtVisualPayload, stepIndex: number, ref: CourtLayerRef, destinationIndex: number): CourtVisualPayload {
  const step = payload.timeline.steps[stepIndex];
  if (!step || !payload.editor || !Number.isInteger(destinationIndex)) return payload;
  const locked = ref.kind === "actor" ? payload.editor.actorMeta[ref.id]?.locked : payload.editor.drawings[step.id]?.find(drawing => drawing.id === ref.id)?.locked;
  if (locked) return payload;
  const order = resolveCourtLayers(payload, stepIndex);
  const from = order.findIndex(item => courtLayerKey(item) === courtLayerKey(ref));
  if (from < 0 || destinationIndex < 0 || destinationIndex >= order.length || from === destinationIndex) return payload;
  const [moving] = order.splice(from, 1);
  order.splice(destinationIndex, 0, moving);
  return { ...payload, editor: { ...payload.editor, layerOrder: { ...payload.editor.layerOrder, [step.id]: order } } };
}

/** Newly inserted/copied objects appear above the prior stack, without changing identities. */
export function bringCourtLayersToFront(payload: CourtVisualPayload, stepIndex: number, refs: CourtLayerRef[]): CourtVisualPayload {
  const step = payload.timeline.steps[stepIndex];
  if (!step || !payload.editor || !refs.length) return payload;
  const order = resolveCourtLayers(payload, stepIndex);
  const keys = new Set(refs.map(courtLayerKey));
  const available = new Map(order.map(ref => [courtLayerKey(ref), ref]));
  const front = refs.flatMap(ref => {
    const key = courtLayerKey(ref), existing = available.get(key);
    available.delete(key);
    return existing ? [existing] : [];
  });
  if (!front.length) return payload;
  return { ...payload, editor: { ...payload.editor, layerOrder: { ...payload.editor.layerOrder, [step.id]: [...order.filter(ref => !keys.has(courtLayerKey(ref))), ...front] } } };
}
