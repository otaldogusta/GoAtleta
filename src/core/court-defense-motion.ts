import { courtActorActionPose, type CourtActorAction } from "./court-actor-actions";
import { sampleBlockerPose } from "./court-simulation/blocker-motion.js";
import type { CourtSimulationActor, CourtSimulationPoint } from "./court-simulation-model";

const phase = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const ease = (t: number) => t * t * (3 - 2 * t);
const arc = (start: CourtSimulationPoint, end: CourtSimulationPoint, progress: number, height: number): CourtSimulationPoint => [
  start[0] + (end[0] - start[0]) * progress,
  start[1] + (end[1] - start[1]) * progress + 4 * height * progress * (1 - progress),
  start[2] + (end[2] - start[2]) * progress,
];
const heading = (point: CourtSimulationPoint): [number, number] => [point[0], point[2]];
const passContact = 0, setContact = .38, attackContact = .94;

/** Stretch only the trace after contact while preserving normalized scrubbing. */
export function defensePlaybackClock(durationMs: number, speed: number) {
  const contactMs = durationMs * attackContact;
  const tailMs = Math.max(durationMs - contactMs, 400 / speed);
  return {
    elapsedAt: (progress: number) => progress <= attackContact ? progress * durationMs : contactMs + tailMs * phase(progress, attackContact, 1),
    progressAt: (elapsedMs: number) => elapsedMs <= contactMs ? Math.max(0, elapsedMs / durationMs)
      : attackContact + (1 - attackContact) * phase(elapsedMs, contactMs, contactMs + tailMs),
  };
}

type ActorMotion = Omit<CourtSimulationActor, "id" | "slot" | "visible">;
function poseAt(t: number, stages: readonly (readonly [number, string])[]) {
  let index = 0;
  while (index + 1 < stages.length && t >= stages[index + 1][0]) index++;
  return { pose: stages[index][1], previousPose: stages[Math.max(0, index - 1)][1], poseBlend: index ? ease(phase(t, stages[index][0], stages[index][0] + .025)) : 1 };
}
const passPoses = [[0, "contact"], [.045, "follow"], [.19, "ready"]] as const;
const setPoses = [[0, "ready"], [.21, "load"], [.30, "rise"], [.35, "contact"], [.41, "follow"], [.54, "ready"]] as const;
const attackPoses = [[0, "ready"], [.32, "approach"], [.72, "plant"], [.80, "draw"], [attackContact, "contact"]] as const;
export const defenseDefaultAction = (slot: number): CourtActorAction => slot === 6 ? "attack" : slot === 1 || slot === 2 ? "block" : "defend";

/** The reception and set lead into the authored contact tableau. */
export function sampleDefenseOrganization(progress: number, starts: CourtSimulationPoint[], destinations: CourtSimulationPoint[],
  actions: (CourtActorAction | undefined)[], contact: CourtSimulationPoint, duration: number, mirrored = false) {
  const t = Math.max(0, Math.min(1, progress));
  const attackSide = destinations[6][2] > 0 ? 1 : -1;
  const passer: CourtSimulationPoint = [0, 0, 6.3 * attackSide];
  const setter: CourtSimulationPoint = [0, 0, 1.05 * attackSide];
  const passHand: CourtSimulationPoint = [0, .85, 5.68 * attackSide];
  const setHand: CourtSimulationPoint = [0, 2.1, 1.02 * attackSide];
  const ball = t >= attackContact ? [...contact] as CourtSimulationPoint : t < setContact ? arc(passHand, setHand, phase(t, passContact, setContact), 1.65)
    : arc(setHand, contact, phase(t, setContact, attackContact), 1.50);
  const support: ActorMotion[] = [
    { role: "passer", position: passer, facing: heading(setter), ...poseAt(t, passPoses), jump: 0, side: true },
    { role: "setter", position: setter, facing: heading(contact), ...poseAt(t, setPoses), jump: 0, side: true },
  ];
  const actors: ActorMotion[] = destinations.map((destination, slot) => {
    const action = actions[slot] ?? defenseDefaultAction(slot);
    // The defense holds its formation through the pass and reads the set on release.
    const movement = ease(phase(t, slot === 6 ? .32 : setContact, .78));
    const start = starts[slot], position: CourtSimulationPoint = t === 1 ? [...destination] : [
      start[0] + (destination[0] - start[0]) * movement,
      destination[1] * ease(phase(t, .72, .98)),
      start[2] + (destination[2] - start[2]) * movement,
    ];
    const facing = heading(ball);
    const terminal = courtActorActionPose(action);
    if (action === "attack") {
      if (slot === 6) {
        const windup = ease(phase(t, .58, .82));
        facing[0] = facing[0] * (1 - windup);
        facing[1] = facing[1] + (-5 * attackSide - facing[1]) * windup;
      }
      const pose = poseAt(t, attackPoses);
      if (pose.pose === "approach" && t >= .345) {
        pose.previousPose = "approach";
        pose.poseBlend = phase(t, .345, .72);
      }
      return { ...terminal, ...pose, position, facing, side: false, mirror: (slot === 6) !== mirrored };
    }
    if (action === "block") {
      // Jump stays separate from the authored position Y.
      const hands = sampleBlockerPose(-.33 + .352 * phase(t, .72, attackContact));
      // The rig's local +Z points through the palms: face the net from either half.
      return { ...terminal, position, facing, ...hands, handAngle: destination[2] > 0 ? 180 : 0 };
    }
    return { ...terminal, position, facing };
  });
  return { actors, support, ball, passContact, setContact, attackContact, visible: true, duration };
}
