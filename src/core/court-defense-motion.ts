import { courtActorActionPose, type CourtActorAction } from "./court-actor-actions";
import { sampleBlockerPose } from "./court-simulation/blocker-motion.js";
import { attackClipTiming, secondsFromTakeoffToHit } from "./court-simulation/attack-clip-timing.js";
import { attackApproachProgress, CAPTURED_APPROACH_METRES } from "./court-simulation/attack-approach.js";
import { blockClosingSchedule, closeBlock } from "./court-simulation/attack-motion.js";
import { courtFootwork } from "./court-simulation/court-footwork.js";
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
const setArc = 1.50;

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
export function defenseDefaultAction(slot: number, preset: string): CourtActorAction {
  if (slot === 6) return "attack";
  const closesFromWing = slot === 1 && preset !== "1";
  return slot === 2 || closesFromWing ? "block" : "defend";
}

/** The reception and set lead into the authored contact tableau. */
export function sampleDefenseOrganization(progress: number, starts: CourtSimulationPoint[], destinations: CourtSimulationPoint[],
  actions: CourtActorAction[], contact: CourtSimulationPoint, duration: number, attackHands: ("right" | "left" | undefined)[] = []) {
  const t = Math.max(0, Math.min(1, progress));
  const attackSide = destinations[6][2] > 0 ? 1 : -1;
  const passer: CourtSimulationPoint = [0, 0, 6.3 * attackSide];
  const setter: CourtSimulationPoint = [0, 0, 1.05 * attackSide];
  const passHand: CourtSimulationPoint = [0, .85, 5.68 * attackSide];
  const setHand: CourtSimulationPoint = [0, 2.1, 1.02 * attackSide];
  const ballAtArrival = arc(setHand, contact, phase(.78, setContact, attackContact), setArc);
  const ball = t >= attackContact ? [...contact] as CourtSimulationPoint : t < setContact ? arc(passHand, setHand, phase(t, passContact, setContact), 1.65)
    : arc(setHand, contact, phase(t, setContact, attackContact), setArc);
  const support: ActorMotion[] = [
    { role: "passer", position: passer, facing: heading(setter), ...poseAt(t, passPoses), jump: 0, side: true },
    { role: "setter", position: setter, facing: heading(contact), ...poseAt(t, setPoses), jump: 0, side: true },
  ];
  const actors: ActorMotion[] = destinations.map((destination, slot) => {
    const action = actions[slot];
    // The defense holds its formation through the pass and reads the set on release.
    const movementStart = slot === 6 ? .32 : setContact;
    const stridePhase = phase(t, movementStart, .78);
    const movement = ease(stridePhase);
    const start = starts[slot], position: CourtSimulationPoint = t === 1 ? [...destination] : [
      start[0] + (destination[0] - start[0]) * movement,
      destination[1] * ease(phase(t, .72, .98)),
      start[2] + (destination[2] - start[2]) * movement,
    ];
    const facing = heading(ball);
    const terminal = courtActorActionPose(action);
    if (action === "attack") {
      let capture;
      if (slot === 6) {
        const impactSeconds = attackContact * duration;
        const approachSeconds = .32 * duration;
        const jumpWindow = secondsFromTakeoffToHit(setContact, attackContact, contact[1] - setHand[1], setArc, duration);
        // Short authored stages still need a visible run-up before the jump.
        const takeoff = impactSeconds - Math.min(jumpWindow, (impactSeconds - approachSeconds) * .42);
        const elapsed = Math.min(t * duration, impactSeconds);
        const dx = destination[0] - start[0], dz = destination[2] - start[2];
        const distance = Math.hypot(dx, dz);
        const captureMetres = CAPTURED_APPROACH_METRES * .9;
        const surplus = Math.max(0, distance - captureMetres);
        const extraSteps = ease(phase(surplus, .25, .65));
        const leadDistance = surplus * extraSteps;
        const leadFraction = distance > 0 ? leadDistance / distance : 0;
        const captureStart = approachSeconds + (takeoff - approachSeconds) * leadFraction;
        const timing = attackClipTiming(elapsed, captureStart, takeoff, impactSeconds, impactSeconds + .44, .22);
        const approach = attackApproachProgress(timing.attackFrame);
        const lead = leadDistance > 0 ? ease(phase(elapsed, approachSeconds, captureStart)) : 0;
        const travel = leadFraction * lead + (1 - leadFraction) * approach;
        const attackStrideScale = (distance - leadDistance) / captureMetres;
        position[0] = travel === 1 ? destination[0] : start[0] + dx * travel;
        position[2] = travel === 1 ? destination[2] : start[2] + dz * travel;
        const runYaw = distance ? Math.atan2(dx, dz) : attackSide * Math.PI;
        const hitYaw = attackSide > 0 ? Math.PI : 0;
        const turn = hitYaw - runYaw;
        const yaw = runYaw + Math.atan2(Math.sin(turn), Math.cos(turn)) * ease(phase(timing.attackFrame, 117, 130));
        facing[0] = position[0] + Math.sin(yaw);
        facing[1] = position[2] + Math.cos(yaw);
        const leadPath = (u: number) => [start[0] + dx * leadFraction * u, start[2] + dz * leadFraction * u];
        const gait = leadDistance > 0 ? courtFootwork(leadPath, lead) : {};
        const attackLeadIn = gait.feet ? ease(phase(Math.min(lead, 1 - lead), 0, Math.min(.35, .50 / surplus))) * extraSteps : 0;
        capture = { ...timing, attackStrideScale, attackLeadIn, feet: gait.feet, feetWeight: gait.feetWeight };
        const rise = phase(elapsed, takeoff, impactSeconds);
        position[1] = destination[1] * (1 - (1 - rise) ** 2);
      }
      const pose = poseAt(t, attackPoses);
      if (pose.pose === "approach" && t >= .345) {
        pose.previousPose = "approach";
        pose.poseBlend = phase(t, .345, .72);
      }
      return { ...terminal, ...pose, ...capture, position, facing, side: false, mirror: attackHands[slot] === "left" };
    }
    const floorPath = (u: number) => [start[0] + (destination[0] - start[0]) * u, start[2] + (destination[2] - start[2]) * u];
    const travelSeconds = (.78 - movementStart) * duration;
    if (action === "block") {
      // Jump stays separate from the authored position Y.
      const hands = sampleBlockerPose(-.33 + .352 * phase(t, .72, attackContact));
      // The rig's local +Z points through the palms: face the net from either half.
      const netDirection = destination[2] > 0 ? -1 : 1;
      const [midX, midZ] = floorPath(.5);
      const closeX = destination[0] - start[0], closeZ = destination[2] - start[2];
      const netYaw = netDirection < 0 ? Math.PI : 0;
      const lateralClose = Math.abs(closeX) >= Math.abs(closeZ);
      if (lateralClose && Math.abs(closeX) > .15) {
        // The shared clip faces +Z. Rotate its full frame on the near side.
        const local = (point: CourtSimulationPoint): CourtSimulationPoint => [point[0] * netDirection, 0, point[2] * netDirection];
        const gait: Partial<ActorMotion> = {};
        const seconds = 1 / duration;
        const takeoff = attackContact - .154 * seconds;
        const origin = local(start), end = local(destination);
        const { read, plant } = blockClosingSchedule(Math.abs(closeX), setContact, takeoff, seconds, true);
        // Fit the designated closing clip into the Defense transition. The
        // authored back court remains still until the pass reaches the setter.
        const sample = t < .78 ? read + (plant - read) * phase(t, setContact, .78)
          : Math.min(attackContact - 1e-9, plant + (attackContact - plant) * phase(t, .78, attackContact));
        closeBlock(sample, gait, origin, end, setContact, takeoff, seconds, true);
        const point = gait.position ?? local(start);
        const progress = phase(point[0], origin[0], end[0]);
        const depth = progress === 1 ? destination[2] : start[2] + closeZ * progress;
        const blockPosition: CourtSimulationPoint = [point[0] * netDirection, position[1], depth];
        const blockFeet: CourtSimulationActor["feet"] = gait.feet?.map(([x, lift, z, yaw], index) => [
          x * netDirection, lift, start[2] + closeZ * phase(x - (index === 0 ? .17 : -.17), origin[0], end[0]) + (z - origin[2]) * netDirection, yaw + netYaw,
        ]) as CourtSimulationActor["feet"];
        return {
          ...terminal, ...hands, ...gait, position: blockPosition, feet: blockFeet,
          facing: gait.facing ? [gait.facing[0] * netDirection, gait.facing[1] * netDirection] : facing,
          handAngle: netYaw * 180 / Math.PI, jump: hands.jump + (gait.jump ?? 0),
        };
      }
      const gait = courtFootwork(floorPath, movement, {
        shuffle: true, facing: [midX, midZ + netDirection], travelSeconds, stridePhase, holdRunStance: true,
        startYaw: lateralClose ? netYaw : undefined, endYaw: netYaw,
        ...(lateralClose ? {
          route: { length: Math.hypot(closeX, closeZ), headingAt: () => netYaw, speed: Math.hypot(closeX, closeZ) / travelSeconds, running: false },
        } : {}),
      });
      // The blocking clip numbers its feet from the opposite side of the net.
      const feet: CourtSimulationActor["feet"] = gait.feet && [gait.feet[1], gait.feet[0]];
      return {
        ...terminal, position, facing, ...hands, ...gait, feet, handAngle: netDirection < 0 ? 180 : 0,
        jump: hands.jump + (gait.jump ?? 0),
      };
    }
    const ballAtStart = movementStart === setContact ? setHand : arc(passHand, setHand, phase(movementStart, passContact, setContact), 1.65);
    const feet = position[1] === 0 ? courtFootwork(
      floorPath, movement, { shuffle: true, facing: heading(contact), travelSeconds, stridePhase, holdRunStance: true,
        startYaw: Math.atan2(ballAtStart[0] - start[0], ballAtStart[2] - start[2]),
        endYaw: Math.atan2(ballAtArrival[0] - destination[0], ballAtArrival[2] - destination[2]) },
    ) : {};
    // Keep the same upper-body ready pose as P6 while the defenders
    // reposition. The foot anchors still drive the steps.
    if (action === "defend") {
      return { ...terminal, position, facing, feet: feet.feet, feetWeight: feet.feetWeight };
    }
    return { ...terminal, position, facing, ...feet };
  });
  return { actors, support, ball, passHand, setHand, setDestination: contact, setArc, passContact, setContact, attackContact, visible: true, duration };
}
