import type { CourtPoint } from "../../core/visual-court";

// Preserve the existing annotation face while sharing its metrics with SVG,
// the inline editor and selection. This never changes the stored drawing.
export const COURT_TEXT_FONT = "Times New Roman";
let context: CanvasRenderingContext2D | null | undefined;
export function measureCourtText(text: string, size: number) {
  if (context === undefined && typeof document !== "undefined") context = document.createElement("canvas").getContext("2d");
  if (context) {
    context.font = `600 ${size}px "${COURT_TEXT_FONT}"`;
    return context.measureText(text).width;
  }
  return Array.from(text).reduce((width, character) => width + (/^[ilI.,' ]$/.test(character) ? 0.28 : /^[MW@]$/.test(character) ? 0.9 : 0.53) * size, 0);
}

export function hitCourtText(point: CourtPoint, anchor: CourtPoint, text: string, size: number, rotation: number, tolerance: number) {
  const radians = rotation * Math.PI / 180;
  const dx = point.x - anchor.x, dy = point.y - anchor.y;
  const x = dx * Math.cos(radians) + dy * Math.sin(radians);
  const y = -dx * Math.sin(radians) + dy * Math.cos(radians);
  return Math.abs(x) <= measureCourtText(text, size) / 2 + tolerance && y >= -size - tolerance && y <= size * 0.25 + tolerance;
}
