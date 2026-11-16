/** An action belongs to a stage, independently of the player's sporting role. */
export const COURT_ACTOR_ACTIONS = ["ready", "defend", "block", "attack", "set", "serve"] as const;
export type CourtActorAction = typeof COURT_ACTOR_ACTIONS[number];

export function normalizeCourtActorActions(value: unknown, ids: readonly string[]): Record<string, CourtActorAction> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const entries = ids.flatMap(id => Object.prototype.hasOwnProperty.call(raw, id) && COURT_ACTOR_ACTIONS.includes(raw[id] as CourtActorAction) ? [[id, raw[id] as CourtActorAction] as const] : []);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

/** Uses the existing 3D pose vocabulary; elevation stays a separate coordinate. */
export function courtActorActionPose(action: CourtActorAction) {
  const role = action === "defend" ? "passer" : action === "block" ? "blocker" : action === "attack" ? "attacker" : action === "serve" ? "server" : "setter";
  return { role, pose: action === "block" ? "block" : ["attack", "set", "serve"].includes(action) ? "contact" : "ready",
    jump: 0, side: action === "set", ...(action === "block" ? { crouch: 0, extension: 1, handAngle: 0 } : {}) } as const;
}
