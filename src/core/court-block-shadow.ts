import type { CourtDrawing } from "./court-drawing-types";
import type { CourtSimulationActor, CourtSimulationPoint, CourtSimulationSample } from "./court-simulation-model";
import type { CourtPoint, CourtVisualPayload } from "./visual-court";

type Palm = { x: number; y: number; z: number };
type Floor = Omit<Palm, "y">;
type ShadowProjection = { points: CourtPoint[]; rays: [Palm, Palm][] };

export const DEFENSE_BLOCK_SHADOW_ID = "defense-block-shadow";
const legacyBlockShadowId = "board_mwecn3c3_goz1ka3k";

function clip(points: Floor[], axis: "x" | "z", boundary: number, sign: number): Floor[] {
  return points.flatMap((point, index) => {
    const previous = points[(index + points.length - 1) % points.length];
    const inside = (point[axis] - boundary) * sign >= 0;
    const previousInside = (previous[axis] - boundary) * sign >= 0;
    if (inside === previousInside) return inside ? [point] : [];
    const fraction = (boundary - previous[axis]) / (point[axis] - previous[axis]);
    const intersection = {
      x: previous.x + (point.x - previous.x) * fraction,
      z: previous.z + (point.z - previous.z) * fraction,
      [axis]: boundary,
    };
    return inside ? [intersection, point] : [intersection];
  });
}

/** Reveal the authored floor area from the net as the airborne block reaches up. */
export function revealCourtBlockShadow(drawings: CourtDrawing[], sample: CourtSimulationSample | null, editor: CourtVisualPayload["editor"]): CourtDrawing[] {
  if (sample?.mode !== "defense" || sample.progress === 1) return drawings;
  const defenders = sample.config.teamActorIds ?? sample.config.actorIds.slice(0, 6);
  let reach = 0;
  for (const actor of sample.actors) {
    if (actor.role === "blocker" && actor.visible && defenders.includes(actor.id) && !editor?.actorMeta[actor.id]?.hidden) {
      // Footwork also moves the body vertically. The hand extension starts at block takeoff.
      reach = Math.max(reach, actor.extension ?? 0);
    }
  }
  if (reach >= 1) return drawings;
  return drawings.flatMap(drawing => {
    if (drawing.kind !== "area" || (drawing.id !== DEFENSE_BLOCK_SHADOW_ID && drawing.id !== legacyBlockShadowId)) return [drawing];
    if (reach <= 0 || drawing.points.length < 3) return [];
    const depths = drawing.points.map(point => point.y);
    const min = Math.min(...depths), max = Math.max(...depths);
    const towardFarBaseline = Math.abs(min - .5) <= Math.abs(max - .5);
    const limit = towardFarBaseline ? min + (max - min) * reach : max - (max - min) * reach;
    const floor = drawing.points.map(({ x, y }) => ({ x, z: y }));
    const points = clip(floor, "z", limit, towardFarBaseline ? -1 : 1).map(({ x, z }) => ({ x, y: z }));
    return [{ ...drawing, points }];
  });
}

/** Downward rays from the ball through the visual palms and their floor envelope. */
export function projectCourtBlockShadow(contact: CourtSimulationPoint, blockers: CourtSimulationActor[]): ShadowProjection {
  const [ballX, ballY, ballZ] = contact;
  const side = ballZ < 0 ? 1 : -1;
  const palms: Palm[] = [];
  for (const blocker of blockers) {
    const [x, y, z] = blocker.position;
    if (blocker.role !== "blocker" || side * z <= 0) continue;
    const radians = (blocker.handAngle ?? 0) * Math.PI / 180;
    const extension = blocker.extension ?? 0;
    // Blocker rig at contact: outer palm edge, body scale, yaw and unscaled jump.
    const reach = .95 * (.04 + .40 * extension);
    const width = .95 * (.26 - .06 * extension + .045);
    const height = y + blocker.jump + .95 * (1.43 - (blocker.crouch ?? 0) + .12 + .51 * extension);
    if (height <= 0 || height >= ballY || (z + Math.cos(radians) * reach - ballZ) * side <= 0) continue;
    for (const edge of [-width, width]) {
      palms.push({
        x: x + Math.sin(radians) * reach + Math.cos(radians) * edge, y: height,
        z: z + Math.cos(radians) * reach - Math.sin(radians) * edge,
      });
    }
  }
  if (palms.length < 2) return { points: [], rays: [] };
  palms.sort((a, b) => (a.x - ballX) / Math.abs(a.z - ballZ) - (b.x - ballX) / Math.abs(b.z - ballZ));
  const left = palms[0], right = palms[palms.length - 1];
  const floor = (palm: Palm): Floor => {
    const distance = ballY / (ballY - palm.y);
    return { x: ballX + (palm.x - ballX) * distance, z: ballZ + (palm.z - ballZ) * distance };
  };
  const landings = [floor(left), floor(right)];
  let polygon: Floor[] = [left, right, landings[1], landings[0]];
  polygon = clip(polygon, "z", 0, side);
  polygon = clip(polygon, "z", 9 * side, -side);
  polygon = clip(polygon, "x", -4.5, 1);
  polygon = clip(polygon, "x", 4.5, -1);
  const palmStart = polygon.indexOf(left);
  if (palmStart > 0) polygon = [...polygon.slice(palmStart), ...polygon.slice(0, palmStart)];
  const points = polygon.map(({ x, z }) => ({ x: x / 9 + .5, y: z / 18 + .5 }));
  const rays = [left, right].flatMap((palm, index): [Palm, Palm][] => {
    const dx = landings[index].x - palm.x, dz = landings[index].z - palm.z;
    const edgeX = dx > 0 ? 4.5 : -4.5;
    const extent = Math.min(1, dx ? (edgeX - palm.x) / dx : 1, dz ? (9 * side - palm.z) / dz : 1);
    if (extent <= 0) return [];
    return [[palm, { x: palm.x + extent * dx, y: palm.y * (1 - extent), z: palm.z + extent * dz }]];
  });
  return { points, rays };
}

export const courtBlockShadow = (contact: CourtSimulationPoint, blockers: CourtSimulationActor[]) =>
  projectCourtBlockShadow(contact, blockers).points;
