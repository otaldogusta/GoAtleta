import type { CourtSimulationActor, CourtSimulationPoint, CourtSimulationSample } from "./court-simulation-model";
import { serveMotionProgress } from "../../public/visual-court-3d/serve-motion-clock.js";

type Skill = "pass" | "passSide" | "dig" | "set" | "setBack" | "setJump" | "serve" | "serveSpin";
export type CourtSkillMotion = {
  skillMotion?: Skill;
  /** -1 is preparation, 0 is ball contact and +1 is the recovered stance. */
  skillProgress?: number;
  skillSide?: number;
  contactTarget?: { x: number; y: number; z: number };
  /** Initial world-space tangent of the set, used for the fingertip follow-through. */
  setReleaseDirection?: CourtSimulationPoint;
};

const point = ([x, y, z]: CourtSimulationPoint) => ({ x, y, z });
function atContact(sample: CourtSimulationSample, contact: number, anticipation: number, recovery: number) {
  const seconds = (sample.progress - contact) * sample.duration;
  return Math.max(-1, Math.min(1, seconds / (seconds < 0 ? anticipation : recovery)));
}

/** Bind the Blender markers to the ball events on the same scrubbable game clock. */
export function courtSkillMotion(
  sample: CourtSimulationSample, actor: Pick<CourtSimulationActor, "role" | "position" | "facing">, slot?: number,
): CourtSkillMotion | undefined {
  const receiving = sample.mode === "receive", attacking = sample.mode === "attack";
  if (receiving && actor.role === "server" && sample.serveContact != null && sample.tossStart != null && sample.serveGuide?.length && sample.tossHand) {
    const release = sample.tossStart, strike = sample.serveContact;
    const progress = serveMotionProgress(sample.progress, release, strike, sample.duration);
    const target = progress <= -.65 ? sample.ball : progress < -.40 ? sample.tossHand : sample.serveGuide[0];
    return { skillMotion: sample.config.serve === "Topspin" ? "serveSpin" : "serve", skillProgress: progress, contactTarget: point(target) };
  }
  const illustration = sample.mode === "defense" && slot === undefined;
  if (actor.role === "setter" && (slot === 0 && (attacking || receiving) || illustration) && sample.setHand) {
    const back = attacking && ["tempo-costas", "china", "fundo-1"].includes(sample.config.preset);
    const destination = attacking ? sample.setDestination ?? sample.flight?.hit : undefined;
    let setReleaseDirection: CourtSimulationPoint | undefined;
    if (destination) {
      // The set arc adds 4h·u(1−u) to the straight line from the hands to the hitter.
      const dx = destination[0] - sample.setHand[0], dz = destination[2] - sample.setHand[2];
      const dy = destination[1] - sample.setHand[1] + 4 * (sample.setArc ?? 0);
      const length = Math.hypot(dx, dy, dz);
      if (length > 0) setReleaseDirection = [dx / length, dy / length, dz / length];
    }
    return {
      skillMotion: back ? "setBack" : illustration ? "set" : "setJump",
      skillProgress: atContact(sample, sample.setContact ?? 1, .62, .52),
      contactTarget: point(sample.setHand),
      ...(setReleaseDirection && { setReleaseDirection }),
    };
  }
  if (actor.role !== "passer") return;
  if (sample.mode === "defense" && !illustration) {
    // This stage ends at the opposing spike. The defenders plant and load
    // for a possible dig; only the opponents in the lead-in play the ball.
    const untilSpike = (sample.progress - (sample.attackContact ?? 1)) * sample.duration;
    const load = Math.min(1, Math.max(0, 1 + untilSpike / .32));
    return { skillMotion: "dig", skillProgress: -1 + .52 * load };
  }
  if (!(receiving && slot === sample.receiver || attacking && slot === 4 || illustration)) return;
  const target = receiving ? sample.ballContact : sample.passHand;
  const contact = receiving ? sample.receiveContact : sample.passContact;
  if (!target || contact == null) return;
  // Resolve the side in the player's court-facing frame at contact, even while the player is still travelling.
  const [x, z] = receiving && sample.contact ? sample.contact : [actor.position[0], actor.position[2]];
  const aim = receiving && sample.setHand ? [sample.setHand[0], sample.setHand[2]] : actor.facing;
  const fx = aim[0] - x, fz = aim[1] - z;
  const lateral = ((target[0] - x) * fz - (target[2] - z) * fx) / (Math.hypot(fx, fz) || 1);
  return {
    skillMotion: Math.abs(lateral) > .28 ? "passSide" : "pass",
    skillSide: lateral < 0 ? -1 : 1, skillProgress: atContact(sample, contact, .52, .58), contactTarget: point(target),
  };
}
