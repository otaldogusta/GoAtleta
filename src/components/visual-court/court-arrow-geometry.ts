import type { CourtPoint } from "../../core/visual-court";
import { limitPoint, type CourtDrawing } from "../../core/visual-court-editor";

export type CourtArrowHandleKind = "start" | "middle" | "end";
export type CourtArrowShape = Pick<CourtDrawing, "kind" | "points" | "curveMode" | "startBallId">;

/** A linked start stays on the ball; its grip gets a separate 44 px touch target. */
export function courtLinkedArrowGrip(origin: CourtPoint, toward: CourtPoint, ballRadius: number, viewport: { width: number; height: number }): CourtPoint {
  const distance = Math.max(44, ballRadius + 30), angle = Math.atan2(origin.y - toward.y, origin.x - toward.x);
  const candidates = [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, Math.PI * .75, -Math.PI * .75, Math.PI].map(turn => ({ x: origin.x + Math.cos(angle + turn) * distance, y: origin.y + Math.sin(angle + turn) * distance }));
  const inside = candidates.find(point => point.x >= 22 && point.y >= 22 && point.x <= viewport.width - 22 && point.y <= viewport.height - 22);
  if (inside) return inside;
  return candidates.map(point => ({ x: Math.max(22, Math.min(viewport.width - 22, point.x)), y: Math.max(22, Math.min(viewport.height - 22, point.y)) })).sort((a, b) => Math.hypot(b.x - origin.x, b.y - origin.y) - Math.hypot(a.x - origin.x, a.y - origin.y))[0];
}

export function straightenCourtArrow(drawing: CourtDrawing): CourtDrawing {
  if (!["arrow", "curve"].includes(drawing.kind) || drawing.points.length < 2 || (drawing.kind === "arrow" && drawing.points.length === 2 && !drawing.curveMode)) return drawing;
  const { curveMode: _curveMode, ...straight } = drawing;
  return { ...straight, kind: "arrow", points: [drawing.points[0], drawing.points[drawing.points.length - 1]] };
}

/** Points are already projected; unmarked curves retain their original scene-space bend. */
export function courtCurveControl(drawing: CourtArrowShape, points: CourtPoint[]): CourtPoint {
  const start = points[0], end = points[points.length - 1];
  return drawing.curveMode === "through-point" && points.length === 3
    ? { x: 2 * points[1].x - (start.x + end.x) / 2, y: 2 * points[1].y - (start.y + end.y) / 2 }
    : { x: (start.x + end.x) / 2 + 65, y: (start.y + end.y) / 2 - 65 };
}

const midpoint = (start: CourtPoint, control: CourtPoint, end: CourtPoint): CourtPoint => ({ x: (start.x + 2 * control.x + end.x) / 4, y: (start.y + 2 * control.y + end.y) / 4 });
function normalizedControl(drawing: CourtArrowShape, landscape: boolean): CourtPoint {
  const start = drawing.points[0], end = drawing.points[drawing.points.length - 1];
  return drawing.curveMode === "through-point" && drawing.points.length === 3
    ? { x: 2 * drawing.points[1].x - (start.x + end.x) / 2, y: 2 * drawing.points[1].y - (start.y + end.y) / 2 }
    : { x: (start.x + end.x) / 2 + (landscape ? -65 : 65) / 900, y: (start.y + end.y) / 2 - 65 / 1800 };
}

export function courtArrowHandles(drawing: CourtArrowShape, landscape: boolean) {
  const start = drawing.points[0], end = drawing.points[drawing.points.length - 1];
  if (!start || !end || drawing.points.length < 2 || !["arrow", "curve"].includes(drawing.kind)) return [];
  let middle = midpoint(start, { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }, end);
  if (drawing.kind === "curve") middle = midpoint(start, normalizedControl(drawing, landscape), end);
  else if (drawing.points.length > 2) {
    const lengths = drawing.points.slice(1).map((point, i) => Math.hypot((point.x - drawing.points[i].x) * 900, (point.y - drawing.points[i].y) * 1800));
    let remaining = lengths.reduce((sum, length) => sum + length, 0) / 2;
    for (let i = 0; i < lengths.length; i++) {
      if (remaining <= lengths[i]) { const t = remaining / (lengths[i] || 1), a = drawing.points[i], b = drawing.points[i + 1]; middle = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; break; }
      remaining -= lengths[i];
    }
  }
  return [{ kind: "start" as const, point: start, label: "Início da seta" }, { kind: "middle" as const, point: middle, label: "Meio da seta" }, { kind: "end" as const, point: end, label: "Ponta da seta" }];
}

/** The middle is an on-curve point, not the invisible quadratic control. */
export function moveCourtArrowHandle(drawing: CourtDrawing, kind: CourtArrowHandleKind, destination: CourtPoint, landscape: boolean, scale: number, straightTolerancePx = 3): CourtDrawing {
  const handles = courtArrowHandles(drawing, landscape), handle = handles.find(item => item.kind === kind);
  if (!handle) return drawing;
  const point = limitPoint(destination);
  if (Math.hypot(point.x - handle.point.x, point.y - handle.point.y) < 1e-8) return drawing;
  const start = kind === "start" ? point : handles[0].point, end = kind === "end" ? point : handles[2].point;
  if (kind === "middle") {
    const dx = (end.x - start.x) * 900, dy = (end.y - start.y) * 1800;
    const px = (point.x - start.x) * 900, py = (point.y - start.y) * 1800;
    const t = (px * dx + py * dy) / (dx * dx + dy * dy || 1);
    if (t >= 0 && t <= 1 && Math.hypot(px - t * dx, py - t * dy) * scale <= straightTolerancePx + 1e-8) {
      return straightenCourtArrow(drawing);
    }
    return { ...drawing, kind: "curve", curveMode: "through-point", points: [start, point, end] };
  }
  if (drawing.kind === "curve") return { ...drawing, curveMode: "through-point", points: [start, limitPoint(midpoint(start, normalizedControl(drawing, landscape), end)), end] };
  return { ...drawing, points: drawing.points.map((original, index) => index === (kind === "start" ? 0 : drawing.points.length - 1) ? point : original) };
}
