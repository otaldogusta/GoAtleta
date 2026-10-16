import type { CourtPoint, CourtVisualPayload } from "./visual-court";
import { sampleCourtSimulation } from "./court-simulation";
import { buildCourtPerspectiveSimulation } from "./court-perspective-guides";
import { courtPointToWorld, worldToCourtPoint } from "./visual-court-perspective";

export type CourtFloorHandle = {
  kind: "hit" | "target";
  point: CourtPoint;
  label: string;
};

/** Gesture limits match renderer-simulation-geometry.mjs, without a hand offset. */
export function boundCourtFloorHandle(kind: "hit" | "target", point: CourtPoint): CourtPoint {
  // A malformed coordinate falls back to the court center before applying the
  // handle's domain; the other valid coordinate remains untouched.
  const world = courtPointToWorld({ x: Number.isFinite(point.x) ? point.x : .5, y: Number.isFinite(point.y) ? point.y : .5 });
  const limit = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  return worldToCourtPoint({ x: limit(world.x, kind === "hit" ? -4.43 : -9, kind === "hit" ? 4.43 : 9), z: limit(world.z, kind === "hit" ? .1 : -12, kind === "hit" ? 4.4 : -.75) });
}

/** The editable 2D footprint of the same contact and destination shown in 3D. */
export function getCourtFloorHandles(payload: CourtVisualPayload, index: number): CourtFloorHandle[] {
  if (!Number.isInteger(index) || index < 0 || payload.editor?.hiddenLayers.includes("movements")) return [];
  const sample = sampleCourtSimulation(payload, index, 0);
  if (!sample || sample.mode !== "attack") return [];
  const guides = buildCourtPerspectiveSimulation(payload, index, sample, true);
  if (!guides.guidesVisible) return [];
  // Match the 3D guide/bridge contract: the contact remains adjustable when only
  // the set is shown; the outgoing target exists only with the attack layer.
  return guides.handles.flatMap(handle => {
    if (handle.kind !== "hit" && handle.kind !== "target") return [];
    return [{ kind: handle.kind, point: worldToCourtPoint(handle.point), label: handle.kind === "hit" ? "Ponto de ataque" : "Destino da bola" }];
  });
}
