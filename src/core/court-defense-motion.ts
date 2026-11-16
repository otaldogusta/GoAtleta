import { courtActorActionPose, type CourtActorAction } from "./court-actor-actions";
import { sampleBlockerPose } from "./court-simulation/blocker-motion.js";
import type { CourtSimulationActor, CourtSimulationPoint } from "./court-simulation-model";

const phase = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const ease = (t: number) => t * t * (3 - 2 * t);
export const defenseDefaultAction = (slot: number): CourtActorAction => slot === 6 ? "attack" : slot === 1 || slot === 2 ? "block" : "defend";

/** Organization up to the authored contact tableau, without inventing a shot outcome. */
export function sampleDefenseOrganization(progress: number, starts: CourtSimulationPoint[], destinations: CourtSimulationPoint[],
  actions: (CourtActorAction | undefined)[], ball: CourtSimulationPoint, duration: number) {
  const t = Math.max(0, Math.min(1, progress));
  const actors: Omit<CourtSimulationActor, "id" | "slot" | "visible">[] = destinations.map((destination, slot) => {
    const action = actions[slot] ?? defenseDefaultAction(slot), movement = ease(phase(t, .06, .78));
    const start = starts[slot], position: CourtSimulationPoint = t === 1 ? [...destination] : [
      start[0] + (destination[0] - start[0]) * movement,
      destination[1] * ease(phase(t, .72, .98)),
      start[2] + (destination[2] - start[2]) * movement,
    ];
    const facing: [number, number] = slot === 6 ? [0, 5] : [ball[0], ball[2]];
    const terminal = courtActorActionPose(action);
    if (action === "attack") {
      const pose = t < .08 ? "ready" : t < .72 ? "approach" : t < .80 ? "plant" : t < .94 ? "draw" : "contact";
      return { ...terminal, pose, position, facing, side: false, mirror: slot === 6 };
    }
    if (action === "block") {
      // Preparation/takeoff reaches the canonical .85 m peak when the attacker
      // enters contact. Jump stays separate from the authored position Y.
      const hands = sampleBlockerPose(-.33 + .352 * phase(t, .72, .94));
      // The rig's local +Z points through the palms: face the net from either half.
      return { ...terminal, position, facing, ...hands, handAngle: destination[2] > 0 ? 180 : 0 };
    }
    return { ...terminal, position, facing };
  });
  return { actors, ball: [...ball] as CourtSimulationPoint, duration, visible: true };
}
