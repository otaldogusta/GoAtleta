import type { CourtPoint, CourtVisualPayload } from "../../core/visual-court";
import { frameDrawings, limitPoint, type CourtDrawing, type DrawingKind } from "../../core/visual-court-editor";
import type { CourtTool } from "./CourtEditorCanvas";
import { getCourtSimulation } from "../../core/court-simulation";
import type { CourtWorldPoint } from "../../core/visual-court-perspective";
import type { CourtPerspectiveHandleKind } from "../../core/court-perspective-guides";

export const COURT_PERSPECTIVE_CHANNEL = "goatleta-court-3d";
export const COURT_PERSPECTIVE_VERSION = 1;

export type CourtPerspectiveShortcut = "undo" | "redo" | "delete" | "escape" | "copy" | "paste" | "select-all" | "save" | "play" | "select-tool" | "nudge-left" | "nudge-right" | "nudge-up" | "nudge-down";
export type CourtPerspectiveHandleEdit = { kind: CourtPerspectiveHandleKind; point: CourtWorldPoint; value?: number };
export type CourtPerspectiveCommand =
  | { type: "select"; ids: string[] }
  | { type: "move"; ids: string[]; delta: CourtPoint; path?: CourtPoint[]; duplicate?: boolean }
  | { type: "draw"; drawing: Omit<CourtDrawing, "id" | "locked" | "motion"> }
  | { type: "add-player"; point: CourtPoint }
  | { type: "edit-text"; id: string }
  | ({ type: "simulation-handle" } & CourtPerspectiveHandleEdit)
  | { type: "shortcut"; key: CourtPerspectiveShortcut; shift?: boolean };

export type CourtPerspectiveCommandContext = {
  token: string;
  revision: number;
  payload: CourtVisualPayload;
  stepIndex: number;
  disabled?: boolean;
  allowServeHandle?: boolean;
  tool?: CourtTool;
};

const DRAWING_KINDS: readonly DrawingKind[] = ["arrow", "curve", "pen", "area", "text", "ball", "cone", "target", "ladder"];
const MATERIAL_KINDS: readonly DrawingKind[] = ["ball", "cone", "target", "ladder"];
const SHORTCUTS: readonly CourtPerspectiveShortcut[] = ["undo", "redo", "delete", "escape", "copy", "paste", "select-all", "save", "play", "select-tool", "nudge-left", "nudge-right", "nudge-up", "nudge-down"];
const ENVELOPE_FIELDS = ["channel", "version", "type", "token", "revision"];

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
function onlyFields(value: Record<string, unknown>, fields: readonly string[]) {
  return Object.keys(value).every(key => fields.includes(key));
}
function finite(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}
function point(value: unknown, max = 2): CourtPoint | null {
  if (!record(value) || !onlyFields(value, ["x", "y"]) || !finite(value.x, -max, max) || !finite(value.y, -max, max)) return null;
  return { x: value.x, y: value.y };
}
function points(value: unknown): CourtPoint[] | null {
  if (!Array.isArray(value) || !value.length || value.length > 300) return null;
  const result: CourtPoint[] = [];
  for (const item of value) {
    const parsed = point(item);
    if (!parsed) return null;
    result.push(parsed);
  }
  return result;
}
function drawing(value: unknown, tool?: CourtTool): CourtPerspectiveCommand & { type: "draw" } | null {
  if (!record(value) || !onlyFields(value, ["kind", "points", "color", "size", "rotation", "text", "dashed"])) return null;
  if (!DRAWING_KINDS.includes(value.kind as DrawingKind)) return null;
  const kind = value.kind as DrawingKind;
  if (tool && tool !== kind && !MATERIAL_KINDS.includes(kind)) return null;
  const parsedPoints = points(value.points);
  if (!parsedPoints) return null;
  const stroke = ["arrow", "curve", "pen", "area"].includes(kind);
  if (stroke ? parsedPoints.length < (kind === "area" ? 3 : 2) : parsedPoints.length !== 1) return null;
  if (value.color !== undefined && (typeof value.color !== "string" || !/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value.color))) return null;
  if (value.size !== undefined && !finite(value.size, 12, 80)) return null;
  if (value.rotation !== undefined && !finite(value.rotation, -3600, 3600)) return null;
  if (value.dashed !== undefined && typeof value.dashed !== "boolean") return null;
  if (value.text !== undefined && (kind !== "text" || typeof value.text !== "string" || value.text.length > 200)) return null;
  return { type: "draw", drawing: {
    kind, points: parsedPoints.map(limitPoint), color: typeof value.color === "string" ? value.color : "#ffffff",
    size: typeof value.size === "number" ? value.size : 32,
    rotation: typeof value.rotation === "number" ? value.rotation % 360 : 0,
    ...(typeof value.dashed === "boolean" ? { dashed: value.dashed } : {}),
    ...(typeof value.text === "string" ? { text: value.text } : {}),
  } };
}

/** The host owns the document and history. The iframe can request only bounded operations.
 * Validate MessageEvent.origin and source against the mounted iframe before calling this.
 */
export function parseCourtPerspectiveCommand(value: unknown, context: CourtPerspectiveCommandContext): CourtPerspectiveCommand | null {
  if (!record(value) || value.channel !== COURT_PERSPECTIVE_CHANNEL || value.version !== COURT_PERSPECTIVE_VERSION
    || !context.token || value.token !== context.token || !Number.isSafeInteger(context.revision) || context.revision < 0
    || value.revision !== context.revision || !Number.isInteger(context.stepIndex) || context.stepIndex < 0) return null;
  const step = context.payload.timeline.steps[context.stepIndex];
  if (!step) return null;
  if (context.disabled && !(context.allowServeHandle && value.type === "simulation-handle" && value.kind === "serve") && !(value.type === "shortcut" && ["escape", "play"].includes(String(value.key)))) return null;
  const fields = (extras: string[]) => onlyFields(value, [...ENVELOPE_FIELDS, ...extras]);
  const hidden = context.payload.editor?.hiddenLayers ?? [];
  const currentDrawings = hidden.includes("drawings") ? [] : frameDrawings(context.payload, context.stepIndex);
  const actors = hidden.includes("actors") ? [] : context.payload.actors.filter(actor => !step.visibleActorIds || step.visibleActorIds.includes(actor.id));
  const known = new Set([...actors.map(actor => actor.id), ...currentDrawings.map(item => item.id)]);
  const ids = (): string[] | null => {
    if (!Array.isArray(value.ids) || value.ids.length > 300) return null;
    for (const id of value.ids) if (typeof id !== "string" || !known.has(id)) return null;
    if (new Set(value.ids).size !== value.ids.length) return null;
    return [...value.ids] as string[];
  };
  const locked = (id: string) => actors.some(actor => actor.id === id)
    ? !!context.payload.editor?.actorMeta[id]?.locked
    : !!currentDrawings.find(item => item.id === id)?.locked;

  if (value.type === "simulation-handle") {
    if (!fields(["kind", "point", "value"]) || hidden.includes("movements")) return null;
    const simulation = getCourtSimulation(context.payload, context.stepIndex);
    if (!simulation || !["set", "pass", "attack", "hit", "target", "serve"].includes(String(value.kind))) return null;
    const kind = value.kind as CourtPerspectiveHandleKind;
    if ((simulation.mode === "receive") !== (kind === "serve")) return null;
    if (kind === "pass" && !simulation.layers.pass || (kind === "target" || kind === "attack") && !simulation.layers.attack) return null;
    const at = value.point;
    if (!record(at) || !onlyFields(at, ["x", "y", "z"]) || !finite(at.x, -9, 9) || !finite(at.y, 0, 9) || !finite(at.z, -12, 12)) return null;
    const height = kind === "set" || kind === "pass" || kind === "attack";
    if (height ? !finite(value.value, kind === "set" ? .15 : kind === "attack" ? .03 : .4, kind === "set" ? 5 : 4) : value.value !== undefined) return null;
    return { type: "simulation-handle", kind, point: { x: at.x, y: at.y, z: at.z }, ...(height ? { value: value.value as number } : {}) };
  }

  if (value.type === "select") {
    if (!fields(["ids"])) return null;
    const selected = ids();
    return selected ? { type: "select", ids: selected } : null;
  }
  if (value.type === "move") {
    if (!fields(["ids", "delta", "path", "duplicate"]) || (context.tool && !["select", "animate"].includes(context.tool))) return null;
    const selected = ids(), delta = point(value.delta, 1.4);
    if (!selected?.length || !delta || selected.some(locked) || (value.duplicate !== undefined && typeof value.duplicate !== "boolean")) return null;
    const path = value.path === undefined ? undefined : points(value.path);
    if (path === null || (path && (path.length < 2 || context.tool !== "animate" || hidden.includes("movements")))) return null;
    if (value.duplicate && (context.tool === "animate" || path)) return null;
    return { type: "move", ids: selected, delta, ...(path ? { path } : {}), ...(value.duplicate !== undefined ? { duplicate: value.duplicate as boolean } : {}) };
  }
  if (value.type === "draw") return fields(["drawing"]) && !hidden.includes("drawings") ? drawing(value.drawing, context.tool) : null;
  if (value.type === "add-player") {
    if (!fields(["point"]) || hidden.includes("actors") || (context.tool && context.tool !== "player")) return null;
    const parsedPoint = point(value.point);
    return parsedPoint ? { type: "add-player", point: limitPoint(parsedPoint) } : null;
  }
  if (value.type === "edit-text") {
    if (!fields(["id"]) || typeof value.id !== "string") return null;
    const item = currentDrawings.find(item => item.id === value.id);
    return item?.kind === "text" && !item.locked ? { type: "edit-text", id: item.id } : null;
  }
  if (value.type === "shortcut") {
    if (!fields(["key", "shift"]) || !SHORTCUTS.includes(value.key as CourtPerspectiveShortcut) || (value.shift !== undefined && typeof value.shift !== "boolean")) return null;
    return { type: "shortcut", key: value.key as CourtPerspectiveShortcut, ...(typeof value.shift === "boolean" ? { shift: value.shift } : {}) };
  }
  return null;
}
