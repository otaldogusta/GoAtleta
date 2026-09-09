import type { CourtVisualPayload, CourtPoint } from "./visual-court";
import { actorPoint } from "./visual-court-editor";

export function courtSide(point: CourtPoint): "A" | "B" | "Rede" {
  return Math.abs(point.y - 0.5) < 0.001 ? "Rede" : point.y > 0.5 ? "A" : "B";
}

export function courtRoster(payload: CourtVisualPayload, stepIndex: number) {
  const visible = payload.timeline.steps[stepIndex]?.visibleActorIds;
  return payload.actors.map(actor => {
    const point = actorPoint(payload, stepIndex, actor.id);
    const meta = payload.editor?.actorMeta[actor.id];
    return {
      actor, point,
      team: meta?.team ?? (courtSide(actor.initialPosition) === "B" ? "B" : "A"),
      side: courtSide(point),
      inCourt: !visible || visible.includes(actor.id),
      outside: point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1,
      studentId: meta?.studentId,
    };
  });
}
