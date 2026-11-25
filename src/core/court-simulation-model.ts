import { normalizeAttackSettings, SIX_ZERO_ATTACK_PRESETS } from "./court-simulation/attack-settings.js";
import { attackPresets } from "./court-simulation/attack-motion.js";
import { normalizeReceiveTarget } from "./court-simulation/reception-target.js";

export type CourtSimulationPoint = [number, number, number];
type CourtSimulationFoot = [x: number, lift: number, z: number, yaw: number];
export type CourtDefenseCoverage = "front" | "zone1";
export type CourtSimulationDefenseSettings = {
  startPositions: Record<string, { x: number; y: number }>;
  coverage?: CourtDefenseCoverage;
};
export type CourtSimulationAttackSettings = {
  targetOverride: [number, number] | null;
  hitOverride: [number, number] | null;
  setHeight: number | null;
  /** Midpoint metres above the hit/target chord; absent/null preserves legacy launch. */
  attackArc?: number | null;
  passHeight: number;
  blockAngle: number;
  blockAngles: Record<string, number>;
  manualBlockers: number[];
};
export type CourtSimulation = {
  version: 1;
  mode: "receive" | "attack" | "defense";
  system: "5-1" | "4-2" | "6-2" | "6-0";
  rotation: number;
  serve: "Float" | "Topspin";
  seam: "Left" | "Right";
  preset: string;
  format: "Indoor" | "9-man";
  layers: { attack: boolean; pass: boolean; block: boolean };
  blockers: 1 | 2 | 3;
  landingOverride: { x: number; z: number } | null;
  attackSettings: CourtSimulationAttackSettings;
  defenseSettings?: CourtSimulationDefenseSettings;
  actorIds: string[];
  /** Own six-player identity order survives mode-specific visibility filters. */
  teamActorIds?: string[];
  ballId: string;
};
export type CourtSimulationPatch = Partial<Omit<CourtSimulation, "version" | "actorIds" | "teamActorIds" | "ballId" | "attackSettings" | "layers">> & {
  layers?: Partial<CourtSimulation["layers"]>;
  attackSettings?: Partial<CourtSimulationAttackSettings>;
};
export type CourtSimulationActor = {
  id: string;
  slot: number;
  position: CourtSimulationPoint;
  facing: [number, number];
  role: "setter" | "passer" | "attacker" | "server" | "blocker";
  pose: string;
  jump: number;
  side: boolean;
  visible: boolean;
  previousPose?: string;
  previousSide?: boolean;
  poseBlend?: number;
  contactWeight?: number;
  attackFrame?: number;
  /** Running cycle in steps [0, 2). At 0 the right shoe lands; at 1 the left lands. */
  runCycle?: number;
  /** Running intensity from the current floor speed, from rest (0) to full drive (1). */
  runDrive?: number;
  /** Weight of the split stance at the start of the next hitting approach. */
  attackReadiness?: number;
  attackReadyLeft?: boolean;
  plantedStance?: boolean;
  travelMotion?: { kind: "walk" | "shuffle"; phase: number; direction: 1 | -1 };
  attackStrideScale?: number;
  attackLeadIn?: number;
  attackSlide?: boolean;
  attackTakeoffDepth?: number;
  blockFrame?: number;
  blockMirror?: boolean;
  /** Left and right sole centres, with lift above the floor and yaw in radians. */
  feet?: [CourtSimulationFoot, CourtSimulationFoot];
  feetWeight?: number;
  mirror?: boolean;
  crouch?: number;
  extension?: number;
  handAngle?: number;
};
export type CourtSimulationCollision = {
  type: "block" | "net" | "tape" | "floor";
  point: CourtSimulationPoint;
  time: number;
  surfacePoint?: CourtSimulationPoint;
  normal?: CourtSimulationPoint;
  incomingVelocity?: CourtSimulationPoint;
  outgoingVelocity?: CourtSimulationPoint;
  wallIndex?: number;
  edge?: boolean;
};
export type CourtSimulationFlight = {
  hit: CourtSimulationPoint;
  target: CourtSimulationPoint;
  collision: CourtSimulationCollision | null;
  collisions: CourtSimulationCollision[];
  landing: CourtSimulationPoint;
  landingTime: number | null;
  endPoint: CourtSimulationPoint;
  out: boolean | null;
  outcome: string;
  status: string;
  landed: boolean;
  terminationReason: string;
  duration: number;
  segments: { origin: CourtSimulationPoint; velocity: CourtSimulationPoint; duration: number; start: number }[];
  guidePoints: CourtSimulationPoint[][];
  attackArc: number;
  attackGuide: CourtSimulationPoint[];
};
export type CourtSimulationWall = {
  center: CourtSimulationPoint;
  width: number;
  height: number;
  angle: number;
  activeFrom: number;
  activeUntil: number;
  motion: { start: number; end: number; center: CourtSimulationPoint; velocity: CourtSimulationPoint }[];
};
export type CourtSimulationSample = {
  config: CourtSimulation;
  bases: CourtSimulationPoint[];
  actors: CourtSimulationActor[];
  ball: CourtSimulationPoint;
  ballId: string;
  visibleIds: string[];
  visible: boolean;
  duration: number;
  mode: CourtSimulation["mode"];
  elapsedSeconds: number;
  progress: number;
  flight?: CourtSimulationFlight | null;
  walls?: CourtSimulationWall[];
  setContact?: number;
  attackContact?: number;
  passContact?: number | null;
  passHand?: CourtSimulationPoint | null;
  setHand?: CourtSimulationPoint;
  setDestination?: CourtSimulationPoint;
  tossHand?: CourtSimulationPoint;
  setArc?: number;
  passArc?: number;
  attackArc?: number;
  attackGuide?: CourtSimulationPoint[];
  attackTarget?: CourtSimulationPoint;
  backRowApproach?: [CourtSimulationPoint, CourtSimulationPoint];
  handSide?: number;
  receiver?: number;
  contact?: [number, number];
  ballContact?: CourtSimulationPoint;
  tossStart?: number;
  serveContact?: number;
  receiveContact?: number;
  serveGuide?: CourtSimulationPoint[];
  serveTarget?: [number, number];
  ballSpin?: number;
  defenseContact?: CourtSimulationPoint;
  defenseSupport?: Omit<CourtSimulationActor, "id" | "slot" | "visible">[];
};

const presets = attackPresets.map(preset => preset.name);
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** The document stores only bounded configuration and canonical references. */
export function normalizeCourtSimulation(value: unknown, actorIds?: readonly string[], drawingIds?: readonly string[]): CourtSimulation | null {
  if (!object(value) || value.version !== 1 || !["receive", "attack", "defense"].includes(String(value.mode))) return null;
  const sixZeroAttack = value.system === "6-0" && value.mode === "attack";
  const expectedActors = sixZeroAttack ? 9 : 7;
  if (!Array.isArray(value.actorIds) || value.actorIds.length !== expectedActors || value.actorIds.some(id => typeof id !== "string" || !id || id.length > 120)
    || new Set(value.actorIds).size !== expectedActors || typeof value.ballId !== "string" || !value.ballId || value.ballId.length > 120) return null;
  const references = value.actorIds as string[];
  if (actorIds && references.some(id => !actorIds.includes(id))) return null;
  if (value.teamActorIds !== undefined && (!Array.isArray(value.teamActorIds) || value.teamActorIds.length !== 6
    || value.teamActorIds.some(id => typeof id !== "string" || !id || id.length > 120)
    || new Set(value.teamActorIds).size !== 6 || actorIds && value.teamActorIds.some(id => !actorIds.includes(id)))) return null;
  if (value.system === "6-0") {
    const ownSlots = sixZeroAttack ? [0, 3, 4, 6, 7, 8] : [0, 1, 2, 3, 4, 5];
    const team = value.teamActorIds;
    if (!Array.isArray(team) || ownSlots.some(slot => !team.includes(references[slot]))) return null;
  }
  if (drawingIds && !drawingIds.includes(value.ballId)) return null;
  let defenseSettings: CourtSimulationDefenseSettings | undefined;
  if (value.mode === "defense") {
    if (!object(value.defenseSettings) || !object(value.defenseSettings.startPositions)) return null;
    const starts = value.defenseSettings.startPositions;
    const valid = (p: unknown): p is { x: number; y: number } => object(p) && typeof p.x === "number" && Number.isFinite(p.x) && p.x >= -.2 && p.x <= 1.2
      && typeof p.y === "number" && Number.isFinite(p.y) && p.y >= -.15 && p.y <= 1.15;
    if (references.some(id => !Object.prototype.hasOwnProperty.call(starts, id) || !valid(starts[id]))) return null;
    defenseSettings = { startPositions: Object.fromEntries(references.map(id => { const p = starts[id] as { x: number; y: number }; return [id, { x: p.x, y: p.y }]; })) };
    const coverage = value.defenseSettings.coverage;
    if (coverage === "front" || coverage === "zone1") defenseSettings.coverage = coverage;
  }
  const layers = object(value.layers) ? value.layers : {};
  const rotation = typeof value.rotation === "number" && Number.isFinite(value.rotation) ? Math.max(0, Math.min(5, Math.floor(value.rotation))) : 0;
  return {
    version: 1, mode: value.mode as CourtSimulation["mode"],
    system: value.system === "4-2" || value.system === "6-2" || value.system === "6-0" ? value.system : "5-1", rotation,
    serve: value.serve === "Topspin" ? "Topspin" : "Float",
    seam: value.seam === "Right" ? "Right" : "Left",
    preset: (sixZeroAttack ? SIX_ZERO_ATTACK_PRESETS : presets).includes(String(value.preset)) ? String(value.preset) : "4",
    format: value.format === "9-man" ? "9-man" : "Indoor",
    layers: { attack: layers.attack === true, pass: layers.pass === true, block: layers.block === true },
    blockers: Math.max(1, Math.min(3, Math.floor(Number(value.blockers) || 1))) as 1 | 2 | 3,
    landingOverride: normalizeReceiveTarget(value.landingOverride) as CourtSimulation["landingOverride"],
    attackSettings: normalizeAttackSettings(value.attackSettings) as CourtSimulationAttackSettings,
    ...(defenseSettings ? { defenseSettings } : {}),
    actorIds: [...references], ...(Array.isArray(value.teamActorIds) ? { teamActorIds: [...value.teamActorIds] as string[] } : {}), ballId: value.ballId,
  };
}
