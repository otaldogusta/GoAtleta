import { configureCourtSimulation, getCourtSimulation, resetCourtSimulation, sampleCourtSimulation, updateCourtSimulationHandle } from "../court-simulation";
import { normalizeCourtSimulation } from "../court-simulation-model";
import { resolveAttackFlight, sampleAttackFlight } from "../court-simulation/attack-physics.js";
import { indoorContactProfile } from "../court-simulation/attack-calibration.js";
import { buildEditable5x1ReceptionPreset, parseCourtVisualPayload, serializeCourtVisualPayload } from "../visual-court";
import { upgradeCourtEditor } from "../visual-court-editor";

const gravity = 9.81;
const near = (actual: readonly number[], expected: readonly number[], precision = 8) => {
  actual.forEach((value, index) => expect(value).toBeCloseTo(expected[index], precision));
};
const board = () => configureCourtSimulation(upgradeCourtEditor(buildEditable5x1ReceptionPreset(), "Ataque"), 0, { mode: "attack" });

describe("canonical outgoing attack arc", () => {
  it("keeps the exact calibrated legacy launch when the setting is missing or null", () => {
    const hit = [-3.77, 3, .55], target = [2.38, .12, -4.95];
    const flight = resolveAttackFlight({ hit, target, profile: indoorContactProfile });
    const travel = Math.max(.16, Math.min(1.8, Math.hypot(target[0] - hit[0], target[2] - hit[2]) / indoorContactProfile.speed));
    expect(flight.segments[0].velocity).toEqual([
      (target[0] - hit[0]) / travel,
      (target[1] - hit[1] + .5 * gravity * travel * travel) / travel,
      (target[2] - hit[2]) / travel,
    ]);
    expect(resolveAttackFlight({ hit, target, profile: indoorContactProfile, attackArc: null })).toEqual(flight);
    expect(flight.attackArc).toBe(gravity * travel * travel / 8);
    near(flight.attackGuide[32], [(hit[0] + target[0]) / 2, (hit[1] + target[1]) / 2 + flight.attackArc, (hit[2] + target[2]) / 2]);
  });

  it.each([.03, .5, 2, 4])("solves a %sm midpoint arc under gravity with fixed endpoints", attackArc => {
    const hit = [1.2, 3, .55], target = [-2.4, .12, -7.2];
    const flight = resolveAttackFlight({ hit, target, attackArc });
    const travel = Math.sqrt(8 * attackArc / gravity);
    expect(flight.collisions).toHaveLength(0);
    expect(flight.attackArc).toBe(attackArc);
    expect(flight.attackGuide).toHaveLength(65);
    expect(flight.duration).toBeCloseTo(travel, 10);
    near(flight.attackGuide[0], hit);
    near(flight.attackGuide[64], target);
    near(flight.attackGuide[32], [(hit[0] + target[0]) / 2, (hit[1] + target[1]) / 2 + attackArc, (hit[2] + target[2]) / 2]);
    near(sampleAttackFlight(flight, .5), flight.attackGuide[32]);
    near(sampleAttackFlight(flight, 1), target);
    near(flight.landing, target);
    expect(flight.segments[0].velocity[1]).toBeCloseTo((target[1] - hit[1]) / travel + gravity * travel / 2, 10);
  });

  it.each([
    { type: "net", hit: [0, 2, .65], net: true, walls: [] },
    { type: "tape", hit: [0, 2.66, .65], net: true, walls: [] },
    { type: "block", hit: [0, 3, .65], net: false, walls: [{ center: [0, 2.85, -.25], width: .86, height: .85 }] },
  ])("retains $type collision responses while separating the editable intention", fixture => {
    const target = [0, .12, -6.5], attackArc = .03;
    const flight = resolveAttackFlight({ ...fixture, target, attackArc });
    expect(flight.collision?.type).toBe(fixture.type);
    expect(flight.collisions.length).toBeGreaterThan(0);
    near(flight.attackGuide[64], target);
    near(sampleAttackFlight(flight, flight.collision!.time / flight.duration), flight.collision!.point);
    const incoming = flight.segments[0], outgoing = flight.segments[1];
    expect(outgoing.start).toBeCloseTo(incoming.start + incoming.duration, 10);
    near(outgoing.origin, flight.collision!.point);
    near(outgoing.velocity, flight.collision!.outgoingVelocity);
    expect(flight.landing.every(Number.isFinite)).toBe(true);
    expect(Math.hypot(...flight.landing.map((value: number, i: number) => value - target[i]))).toBeGreaterThan(.1);
  });

  it("recalculates a block interception from the arc without moving the contact, target or hands", () => {
    const settings = { hit: [0, 3, .65], target: [0, .12, -6.5], walls: [{ center: [0, 2.85, -.25], width: .86, height: .85 }] };
    const before = JSON.stringify(settings);
    const low = resolveAttackFlight({ ...settings, attackArc: .03 });
    const high = resolveAttackFlight({ ...settings, attackArc: 2 });
    expect(low.collision?.type).toBe("block");
    expect(high.collision).toBeNull();
    expect(high.hit).toEqual(low.hit);
    expect(high.target).toEqual(low.target);
    near(high.landing, settings.target);
    expect(JSON.stringify(settings)).toBe(before);
  });

  it("updates only the arc as a canonical command and exposes its exact guide", () => {
    const original = configureCourtSimulation(board(), 0, { attackSettings: { hitOverride: [-2.3, 1.2], targetOverride: [3, -8], setHeight: 2.4, blockAngles: { "2": 25 }, manualBlockers: [1, 2] } });
    const before = JSON.stringify(original), config = getCourtSimulation(original, 0)!;
    const next = updateCourtSimulationHandle(original, 0, { kind: "attack", value: 1.6 });
    expect(getCourtSimulation(next, 0)).toEqual({ ...config, attackSettings: { ...config.attackSettings, attackArc: 1.6 } });
    expect(next.actors).toEqual(original.actors);
    expect(next.timeline.steps[0].actorPositions).toEqual(original.timeline.steps[0].actorPositions);
    expect(next.timeline.steps[0].baselineActorPositions).toEqual(original.timeline.steps[0].baselineActorPositions);
    expect(next.timeline.steps.slice(1)).toEqual(original.timeline.steps.slice(1));
    const oldFrame = sampleCourtSimulation(original, 0, 0)!, frame = sampleCourtSimulation(next, 0, 0)!;
    expect(frame.flight!.hit).toEqual(oldFrame.flight!.hit);
    expect(frame.attackTarget).toEqual(oldFrame.attackTarget);
    expect(frame.walls).toEqual(oldFrame.walls);
    expect(frame.setArc).toBe(oldFrame.setArc);
    expect(frame.attackArc).toBe(1.6);
    expect(frame.attackGuide).toEqual(frame.flight!.attackGuide);
    near(frame.attackGuide![32], [(frame.flight!.hit[0] + frame.attackTarget![0]) / 2, (frame.flight!.hit[1] + frame.attackTarget![1]) / 2 + 1.6, (frame.flight!.hit[2] + frame.attackTarget![2]) / 2]);
    expect(updateCourtSimulationHandle(next, 0, { kind: "attack", value: NaN })).toBe(next);
    expect(JSON.stringify(original)).toBe(before);
    const receive = configureCourtSimulation(original, 0, { mode: "receive" });
    expect(updateCourtSimulationHandle(receive, 0, { kind: "attack", value: 2 })).toBe(receive);
  });

  it.each([
    [undefined, null], [null, null], [NaN, null], [Infinity, null], ["2", null], [-1, .03], [0, .03], [.6, .6], [10, 4],
  ])("normalizes imported arc %s to %s", (attackArc, expected) => {
    const config = getCourtSimulation(board(), 0)!;
    expect(normalizeCourtSimulation({ ...config, attackSettings: { ...config.attackSettings, attackArc } })!.attackSettings.attackArc).toBe(expected);
  });

  it("round trips explicit arcs and reads legacy documents without changing their launch", () => {
    const explicit = updateCourtSimulationHandle(board(), 0, { kind: "attack", value: 1.25 });
    const restored = parseCourtVisualPayload(serializeCourtVisualPayload(explicit));
    expect(getCourtSimulation(restored, 0)!.attackSettings.attackArc).toBe(1.25);
    expect(sampleCourtSimulation(restored, 0, .8)!.ball).toEqual(sampleCourtSimulation(explicit, 0, .8)!.ball);
    const legacy = board();
    delete legacy.timeline.steps[0].simulation!.attackSettings.attackArc;
    const parsedLegacy = parseCourtVisualPayload(serializeCourtVisualPayload(legacy));
    expect(getCourtSimulation(parsedLegacy, 0)!.attackSettings.attackArc).toBeNull();
    expect(sampleCourtSimulation(parsedLegacy, 0, .8)!.ball).toEqual(sampleCourtSimulation(legacy, 0, .8)!.ball);
  });

  it("restores the legacy arc when resetting or choosing another preset", () => {
    const changed = updateCourtSimulationHandle(board(), 0, { kind: "attack", value: 3 });
    for (const next of [resetCourtSimulation(changed, 0), configureCourtSimulation(changed, 0, { preset: "5" })]) {
      expect(getCourtSimulation(next, 0)!.attackSettings.attackArc).toBeNull();
      const flight = sampleCourtSimulation(next, 0, 0)!.flight!;
      const travel = Math.max(.16, Math.min(1.8, Math.hypot(flight.target[0] - flight.hit[0], flight.target[2] - flight.hit[2]) / indoorContactProfile.speed));
      expect(flight.attackArc).toBe(gravity * travel * travel / 8);
    }
  });
});
