import type { CourtVisualPayload } from "./visual-court";
import { sampleCourtSimulation } from "./court-simulation";

type Point = { x: number; y: number; z: number };
export type CourtPerspectiveHandleKind = "set" | "pass" | "attack" | "hit" | "target" | "serve";
export type CourtPerspectiveHandle = { kind: CourtPerspectiveHandleKind; point: Point; value?: number };
export type CourtPerspectiveGuidePath = { id: string; points: Point[]; dashed?: boolean; color: string; opacity: number; arrow?: number };
export type CourtPerspectiveGuideMarker = { id: string; kind: "dot" | "ring" | "cross"; point: Point; color: string; contactTime?: number };
export type CourtPerspectiveSimulation = {
  guideKey: string;
  mode: "receive" | "attack";
  elapsedSeconds: number;
  duration: number;
  ballId: string;
  ball: Point;
  paths: CourtPerspectiveGuidePath[];
  markers: CourtPerspectiveGuideMarker[];
  walls: { center: Point; width: number; height: number; angle: number }[];
  handles: CourtPerspectiveHandle[];
  guidesVisible: boolean;
  outcome: string;
  blocked: boolean;
  ballSpin?: number;
};

type Sample = NonNullable<ReturnType<typeof sampleCourtSimulation>>;
type Guides = Pick<CourtPerspectiveSimulation, "guideKey" | "paths" | "markers" | "walls" | "handles" | "outcome" | "blocked">;
const cache = new WeakMap<CourtVisualPayload, Map<number, Guides>>();
const point = (value: readonly number[]): Point => ({ x: value[0], y: value[1], z: value[2] });
const BLUE = "#72b6ef", RED = "#e89095";

/** Geometry is sampled once from the canonical simulation, never by the iframe. */
function buildGuides(payload: CourtVisualPayload, index: number, timing: Sample): Guides {
  const paths: CourtPerspectiveGuidePath[] = [], markers: CourtPerspectiveGuideMarker[] = [], handles: CourtPerspectiveHandle[] = [];
  const sample = (start: number, end: number, count = 100) => Array.from({ length: count + 1 }, (_, i) => {
    const frame = sampleCourtSimulation(payload, index, start + (end - start) * i / count);
    return point(frame?.ball ?? timing.ball);
  });
  const path = (id: string, points: Point[], dashed = false, opacity = .85, color = BLUE, arrow?: number) => {
    paths.push({ id, points, dashed, opacity, color, ...(arrow !== undefined ? { arrow } : {}) });
    return points;
  };
  const marker = (id: string, kind: CourtPerspectiveGuideMarker["kind"], at: Point, color = BLUE, contactTime?: number) => {
    markers.push({ id, kind, point: at, color, ...(contactTime !== undefined ? { contactTime } : {}) });
  };
  const apex = (points: Point[]) => points.reduce((best, candidate) => candidate.y > best.y ? candidate : best, points[0]);
  if (timing.mode === "receive") {
    path("serve", timing.serveGuide?.map(point) ?? sample(timing.serveContact ?? .38, timing.receiveContact ?? .64, 90), true, .8, "#c48d8f");
    const target = timing.serveTarget;
    const landing = target ? { x: target[0], z: target[1] } : timing.config.landingOverride ?? { x: timing.config.seam === "Left" ? -1.45 : 1.4, z: 6.65 };
    handles.push({ kind: "serve", point: { x: landing.x, y: .03, z: landing.z } });
    marker("serve-target", "cross", { x: landing.x, y: .025, z: landing.z }, "#c48d8f");
  } else {
    const setContact = timing.setContact ?? 0, attackContact = timing.attackContact ?? 1;
    const set = path("set", sample(setContact, attackContact));
    marker("set-apex", "dot", apex(set));
    marker("set-origin", "ring", set[0], "#bed8f1");
    marker("hit", "ring", set[set.length - 1], "#bed8f1");
    handles.push({ kind: "set", point: apex(set), value: timing.setArc }, { kind: "hit", point: set[set.length - 1] });
    if (timing.config.layers.pass && timing.passContact != null) {
      const pass = path("pass", sample(timing.passContact, setContact), true, .65, BLUE, 72);
      handles.push({ kind: "pass", point: apex(pass), value: timing.passArc });
    }
    if (timing.config.layers.attack) {
      if (timing.attackTarget) handles.push({ kind: "target", point: point(timing.attackTarget) });
      const flight = timing.flight;
      const hitSeconds = attackContact * timing.duration;
      if (timing.attackGuide?.length && Number.isFinite(timing.attackArc)) {
        const intent = timing.attackGuide.map(point), middle = intent[Math.floor(intent.length / 2)];
        handles.push({ kind: "attack", point: middle, value: timing.attackArc });
        marker("attack-curve", "dot", middle);
        // The intended shot remains editable even if a hand or net stops it.
        // Actual contacts and rebounds are still sampled from the collision engine.
        path("attack-intent", intent, false, flight?.collisions.some(contact => contact.type !== "floor") ? .4 : .85);
      }
      if (flight) {
        const color = flight.collisions.some(collision => collision.type !== "floor") ? RED : BLUE;
        flight.segments.forEach((segment, segmentIndex) => {
          const start = attackContact + segment.start / timing.duration, end = Math.min(1, attackContact + (segment.start + segment.duration) / timing.duration);
          if (start >= 1 || end <= start) return;
          if (segmentIndex || flight.collisions.some(contact => contact.type !== "floor") || !timing.attackGuide?.length) path(segmentIndex ? `rebound-${segmentIndex}` : "attack", sample(start, end, 32), true, .8, color, 18);
        });
        if (flight.landed) marker("landing", "cross", point(flight.landing), flight.out ? "#ef858c" : "#8cbee9");
        flight.collisions.forEach((contact, contactIndex) => {
          const color = contact.type === "block" ? "#ef858c" : contact.type === "tape" ? "#f0cf8b" : "#aabed9";
          const at = point(contact.point), time = hitSeconds + contact.time;
          marker(`contact-${contactIndex}-${contact.type}`, "ring", at, color, time);
          marker(`contact-dot-${contactIndex}`, "dot", at, color);
        });
      }
      const attacker = timing.actors.find(actor => actor.slot === 3), contactActor = sampleCourtSimulation(payload, index, attackContact)?.actors.find(actor => actor.slot === 3);
      if (attacker && contactActor) path("approach", [point(timing.bases[3]), point(contactActor.position)].map(at => ({ ...at, y: .025 })), true, .35);
    }
  }
  const flight = timing.flight, labels = { block: "Mão", net: "Rede", tape: "Fita", floor: "Chão" };
  const contacts = flight?.collisions.map(contact => contact.type === "block" ? `Mão ${(contact.wallIndex ?? 0) + 1}` : labels[contact.type]) ?? [];
  const chain = contacts.slice(0, 4).join(" → ") + (contacts.length > 4 ? ` +${contacts.length - 4}` : "");
  return {
    guideKey: JSON.stringify(["serve-flight-v4", timing.config, timing.bases]), paths, markers, handles,
    walls: timing.config.layers.block ? (timing.walls ?? []).map(wall => ({ center: point(wall.center), width: wall.width, height: wall.height, angle: wall.angle })) : [],
    outcome: timing.mode === "attack" && timing.config.layers.attack ? `${chain || "Ataque livre"} · ${flight?.landed ? flight.out ? "fora" : "dentro" : "limite de contatos"}` : "",
    blocked: Boolean(flight?.collisions.some(contact => contact.type !== "floor")),
  };
}

export function buildCourtPerspectiveSimulation(payload: CourtVisualPayload, index: number, frame: Sample, showGuides: boolean): CourtPerspectiveSimulation {
  let steps = cache.get(payload);
  if (!steps) { steps = new Map(); cache.set(payload, steps); }
  let guides = steps.get(index);
  if (!guides) {
    guides = buildGuides(payload, index, sampleCourtSimulation(payload, index, 0) ?? frame);
    steps.set(index, guides);
  }
  return { ...guides, mode: frame.mode, elapsedSeconds: frame.elapsedSeconds, duration: frame.duration, ballId: frame.ballId, ball: point(frame.ball), ballSpin: frame.ballSpin, guidesVisible: showGuides && (frame.mode !== "receive" || frame.progress < (frame.receiveContact ?? .64)) };
}
