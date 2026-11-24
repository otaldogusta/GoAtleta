import fs from "node:fs";
import path from "node:path";
import { configureCourtSimulation, getCourtSimulation, resetCourtSimulation, sampleCourtSimulation, updateCourtSimulationHandle } from "../court-simulation";
import { normalizeCourtSimulation } from "../court-simulation-model";
import { buildCourtPerspectiveSimulation } from "../court-perspective-guides";
import { attackPresets, sampleAttack } from "../court-simulation/attack-motion.js";
import { sampleReception } from "../court-simulation/reception-motion.js";
import { buildEditable5x1ReceptionPreset, parseCourtVisualPayload, serializeCourtVisualPayload } from "../visual-court";
import { actorPoint, continueStepFromEnd, deleteSelection, duplicateStep, frameDrawings, moveSelection, newCourtBoard, parseEditorImport, upgradeCourtEditor } from "../visual-court-editor";

const receiveBoard = () => upgradeCourtEditor(buildEditable5x1ReceptionPreset(), "Recepção da turma");
const attackBoard = () => configureCourtSimulation(receiveBoard(), 0, { mode: "attack" });

it("sends a fast set to the opposite running along zone one", () => {
  const board = configureCourtSimulation(attackBoard(), 0, { preset: "fundo-1" });
  const timing = sampleCourtSimulation(board, 0, 0)!;
  const [start, takeoff] = timing.backRowApproach!;
  expect(timing.actors[3].id).toBe(timing.config.teamActorIds![1]);
  expect(start[0]).toBeGreaterThan(3);
  expect(Math.abs(start[0] - takeoff[0])).toBeLessThan(.2);
  expect(takeoff[2]).toBeGreaterThan(3);
  expect((timing.attackContact! - timing.setContact!) * timing.duration).toBeCloseTo(.83);
  const hit = sampleCourtSimulation(board, 0, timing.attackContact!)!;
  expect(hit.actors[3].position[2]).toBeLessThan(3);
  expect(hit.actors[3].jump).toBeGreaterThan(.6);
});

it("restores the adjusted China run-up at the three-meter line and the exit sideline", () => {
  const board = configureCourtSimulation(attackBoard(), 0, { preset: "china" });
  const edited = updateCourtSimulationHandle(board, 0, { kind: "approach-end", point: { x: .7, y: .6 } });
  const restored = resetCourtSimulation(edited, 0);
  const frame = sampleCourtSimulation(restored, 0, 0)!;
  const { handles } = buildCourtPerspectiveSimulation(restored, 0, frame, true);
  const start = handles.find(handle => handle.kind === "approach-start")!.point;
  const end = handles.find(handle => handle.kind === "approach-end")!.point;
  expect(start.x).toBeCloseTo(.72);
  expect(start.z).toBeCloseTo(3.03);
  expect(end.x).toBeCloseTo(4.378);
  expect(end.z).toBeCloseTo(.935);
});

it("round trips the new attacks with the actual middle or opposite bound to the strike", () => {
  const original = attackBoard();
  const team = getCourtSimulation(original, 0)!.teamActorIds!;
  let board = original;
  for (const preset of ["tempo-costas", "metro", "china", "fundo-1", "4"]) {
    board = configureCourtSimulation(board, 0, { preset });
    const config = getCourtSimulation(board, 0)!;
    const hitter = team[preset === "4" ? 3 : preset === "fundo-1" ? 1 : 2];
    expect(config.actorIds[3]).toBe(hitter);
    expect(new Set(config.actorIds).size).toBe(config.actorIds.length);
    expect(config.teamActorIds).toEqual(team);
    expect(board.timeline.steps[0].visibleActorIds).toContain(hitter);
    const reopened = parseCourtVisualPayload(serializeCourtVisualPayload(board))!;
    expect(getCourtSimulation(reopened, 0)).toEqual(config);
  }
});

it("edits the run-up endpoints independently and keeps the strike registered to the ball", () => {
  const board = attackBoard();
  const point = { x: -.19, y: .9 };
  const start = updateCourtSimulationHandle(board, 0, { kind: "approach-start", point });
  expect(sampleCourtSimulation(start, 0, 0)!.actors[3].position[2]).toBeCloseTo(7.2);
  expect(sampleCourtSimulation(start, 0, 0)!.bases[3][0]).toBeCloseTo(-6.21);
  const end = updateCourtSimulationHandle(start, 0, { kind: "approach-end", point: { x: 1.3, y: .6 } });
  const timing = sampleCourtSimulation(end, 0, 0)!;
  const impact = sampleCourtSimulation(end, 0, timing.attackContact!)!;
  expect(impact.actors[3].position[0]).toBeCloseTo(6.25);
  expect(impact.actors[3].position[2]).toBeCloseTo(1.8);
  expect(impact.ball[0]).toBeCloseTo(6.38);
  expect(timing.bases[3]).toEqual(sampleCourtSimulation(start, 0, 0)!.bases[3]);
});
const point = (x: number, z: number) => ({ x: x / 9 + .5, y: z / 18 + .5 });
it("keeps the back-row takeoff handle behind the attack line", () => {
  const board = configureCourtSimulation(attackBoard(), 0, { preset: "pipe" });
  const edited = updateCourtSimulationHandle(board, 0, { kind: "approach-end", point: point(.2, 2.7) });
  const timing = sampleCourtSimulation(edited, 0, 0)!;
  expect(timing.backRowApproach![1][2]).toBeCloseTo(3.45);
  const hit = sampleCourtSimulation(edited, 0, timing.attackContact!)!;
  expect(hit.actors[3].position[2]).toBeCloseTo(1.55);
});
const near = (actual: number[], expected: number[], tolerance = 1e-8) => expect(Math.hypot(...actual.map((value, index) => value - expected[index]))).toBeLessThan(tolerance);

describe("shared canonical volleyball simulation", () => {
  it("keeps unchanged mockup engines exact while attack extensions retain behavioral parity", () => {
    // Attack curve editing extends motion/physics/settings in the shared engine.
    // The extended formation engine is compared by rotation against the same frozen reference.
    for (const name of ["attack-calibration", "reception-target"]) {
      const original = fs.readFileSync(path.join(__dirname, "fixtures/court-reference", `${name}.mjs`), "utf8").replace(/\.mjs/g, ".js").replace(/\r\n/g, "\n");
      const actual = fs.readFileSync(path.join(__dirname, "../court-simulation", `${name}.js`), "utf8").replace(/\r\n/g, "\n");
      expect(actual).toBe(original);
    }
  });

  it("does not enable a second state just because a board has actors", () => {
    const board = newCourtBoard(), before = JSON.stringify(board);
    expect(sampleCourtSimulation(board, 0, .5)).toBeNull();
    expect(JSON.stringify(board)).toBe(before);
  });

  it("preserves canonical player identities and adds opposing support actors without converting teammates", () => {
    const board = receiveBoard(), before = JSON.stringify(board), ownIds = board.actors.map(actor => actor.id);
    const next = configureCourtSimulation(board, 0, { mode: "attack", blockers: 3 });
    const config = getCourtSimulation(next, 0)!;
    expect(config.actorIds).toHaveLength(7);
    expect(new Set(config.actorIds).size).toBe(7);
    for (const id of ownIds) expect(next.actors.find(actor => actor.id === id)).toEqual(board.actors.find(actor => actor.id === id));
    for (const slot of [1, 2, 5]) {
      expect(next.editor!.actorMeta[config.actorIds[slot]].team).toBe("B");
      expect(ownIds).not.toContain(config.actorIds[slot]);
    }
    expect(next.editor!.actorMeta[config.actorIds[0]]?.team).not.toBe("B");
    expect(JSON.stringify(board)).toBe(before);
  });

  it("reuses existing opposing actors and never duplicates support entities on settings changes", () => {
    const board = newCourtBoard();
    const next = configureCourtSimulation(board, 0, { mode: "attack" });
    expect(next.actors).toHaveLength(board.actors.length);
    const changed = configureCourtSimulation(next, 0, { mode: "attack", blockers: 3, attackSettings: { blockAngle: 30 } });
    expect(changed.actors).toEqual(next.actors);
    expect(frameDrawings(changed, 0)).toHaveLength(1);
  });

  it("keeps only three own simulation participants and restores all six for reception", () => {
    const attack = attackBoard(), frame = sampleCourtSimulation(attack, 0, 0)!;
    expect(frame.visibleIds).toHaveLength(4);
    expect(frame.actors.filter(actor => actor.visible && actor.role !== "blocker")).toHaveLength(3);
    const receive = configureCourtSimulation(attack, 0, { mode: "receive" });
    expect(sampleCourtSimulation(receive, 0, 0)!.visibleIds).toHaveLength(7);
    expect(getCourtSimulation(receive, 0)!.actorIds.slice(0, 6).every(id => receive.editor!.actorMeta[id]?.team !== "B")).toBe(true);
  });

  it("hides the previous attack blockers when switching to reception on older boards", () => {
    const attack = configureCourtSimulation(receiveBoard(), 0, { mode: "attack", blockers: 3 });
    const ids = getCourtSimulation(attack, 0)!.actorIds;
    for (const slot of [1, 2, 5]) delete attack.editor!.actorMeta[ids[slot]].simulationSupport;
    const receive = configureCourtSimulation(attack, 0, { mode: "receive" });
    const server = getCourtSimulation(receive, 0)!.actorIds[6];
    for (const slot of [1, 2, 5]) {
      expect(receive.actors.some(actor => actor.id === ids[slot])).toBe(true);
      expect(receive.timeline.steps[0].visibleActorIds!.includes(ids[slot])).toBe(ids[slot] === server);
    }
  });

  it("preserves the initial active C2 and P2 identities through attack and reception filters", () => {
    const board = receiveBoard();
    const middles = board.actors.filter(actor => actor.role === "middle");
    expect(middles).toHaveLength(2);
    const hidden = middles[0], active = middles[1];
    board.timeline.steps[0].visibleActorIds = board.actors.filter(actor => actor.id !== hidden.id).map(actor => actor.id);
    const receive = configureCourtSimulation(board, 0, { mode: "receive" });
    const team = getCourtSimulation(receive, 0)!.teamActorIds!;
    expect(team[2]).toBe(active.id);
    const originalActors = JSON.stringify(board.actors);
    const attack = configureCourtSimulation(receive, 0, { mode: "attack" });
    expect(attack.timeline.steps[0].visibleActorIds).not.toContain(active.id);
    expect(attack.timeline.steps[0].visibleActorIds).not.toContain(team[5]);
    const restored = configureCourtSimulation(attack, 0, { mode: "receive" });
    expect(getCourtSimulation(restored, 0)!.actorIds.slice(0, 6)).toEqual(team);
    expect(getCourtSimulation(restored, 0)!.teamActorIds).toEqual(team);
    expect(restored.timeline.steps[0].visibleActorIds).toContain(active.id);
    expect(restored.timeline.steps[0].visibleActorIds).toContain(team[5]);
    expect(restored.timeline.steps[0].visibleActorIds).not.toContain(hidden.id);
    expect(JSON.stringify(restored.actors.filter(actor => board.actors.some(original => original.id === actor.id)))).toBe(originalActors);
    const imported = parseEditorImport(JSON.stringify({ format: "goatleta-court", version: 1, payload: restored }));
    expect(getCourtSimulation(imported, 0)!.teamActorIds).toEqual(team);
  });

  it.each([0, 1, 2, 3, 4, 5])("uses exact reception sampling in rotation %i", rotation => {
    const board = configureCourtSimulation(receiveBoard(), 0, { mode: "receive", rotation, serve: "Topspin", seam: "Right" });
    for (const progress of [0, .38, .55, .64, .8, 1]) {
      const actual = sampleCourtSimulation(board, 0, progress)!;
      const expected = sampleReception(progress, { bases: actual.bases, rotation, serve: "Topspin", system: "5-1", landing: [1.4, 6.65] });
      expect(actual.ball).toEqual(expected.ball);
      expect(actual.actors.map(({ id, slot, visible, ...actor }) => actor)).toEqual(expected.actors);
      expect(actual.duration).toBeGreaterThan(3);
      expect(actual.duration).toBeLessThan(5);
      expect(board.timeline.steps[0].durationMs).toBe(Math.round(actual.duration * 1000));
    }
  });

  it.each(attackPresets.map((preset: { name: string }) => preset.name))("uses exact poses, contacts and flight for attack preset %s", preset => {
    for (const blockers of [1, 2, 3] as const) {
      const board = configureCourtSimulation(receiveBoard(), 0, { mode: "attack", preset, blockers, attackSettings: { blockAngles: { "2": 30 } } });
      for (const progress of [0, .118, .4, .64, .76, .9, 1]) {
        const actual = sampleCourtSimulation(board, 0, progress)!, config = actual.config;
        const expected = sampleAttack(progress, { bases: actual.bases, preset, blockers, layers: config.layers, ...config.attackSettings });
        expect(actual.ball).toEqual(expected.ball);
        expect(actual.actors.map(({ id, slot, visible, ...actor }) => actor)).toEqual(expected.actors);
        expect(actual.flight).toEqual(expected.flight);
        expect(board.timeline.steps[0].durationMs).toBe(Math.round(actual.duration * 1000));
      }
    }
  });

  it("uses canonical bases as the sole position source and preserves custom unrelated actors/drawings", () => {
    const board = attackBoard(), config = getCourtSimulation(board, 0)!;
    const setter = config.actorIds[0];
    board.timeline.steps[0].actorPositions[setter] = point(-1, 1);
    const frame = sampleCourtSimulation(board, 0, .4)!;
    near(frame.bases[0], [-1, 0, 1]);
    expect("positions" in config).toBe(false);
    const next = configureCourtSimulation(board, 0, { mode: "attack", attackSettings: { targetOverride: [3, -8] } });
    expect(actorPoint(next, 0, setter)).toEqual(point(-1, 1));
  });

  it("places the paused attacker on the selected attack's side and depth without replacing players or other steps", () => {
    const left = attackBoard(), before = JSON.stringify(left);
    const config = getCourtSimulation(left, 0)!;
    const right = configureCourtSimulation(left, 0, { preset: "5" });
    const middle = configureCourtSimulation(right, 0, { preset: "31" });
    const back = configureCourtSimulation(middle, 0, { preset: "pipe" });
    const leftStart = sampleCourtSimulation(left, 0, 0)!.actors[3].position;
    const rightStart = sampleCourtSimulation(right, 0, 0)!.actors[3].position;
    const middleStart = sampleCourtSimulation(middle, 0, 0)!.actors[3].position;
    const backStart = sampleCourtSimulation(back, 0, 0)!.actors[3].position;
    near(leftStart, [-4.2, 0, 3]);
    near(rightStart, [4.2, 0, 3]);
    const rightFast = configureCourtSimulation(left, 0, { preset: "red" });
    near(sampleCourtSimulation(rightFast, 0, 0)!.actors[3].position, [4.2, 0, 3]);
    expect(middleStart[0]).toBeGreaterThan(leftStart[0]);
    expect(middleStart[0]).toBeLessThan(0);
    expect(backStart[0]).toBe(0);
    expect(backStart[2]).toBeGreaterThan(leftStart[2]);
    for (const board of [right, middle, back]) {
      const expected = [...config.actorIds];
      if (board === middle) expected[3] = config.teamActorIds![2];
      expect(getCourtSimulation(board, 0)!.actorIds).toEqual(expected);
      expect(getCourtSimulation(board, 0)!.ballId).toBe(config.ballId);
      expect(board.actors).toEqual(left.actors);
      expect(board.timeline.steps.slice(1)).toEqual(left.timeline.steps.slice(1));
      expect(board.timeline.steps[0].baselineActorPositions).toEqual(board.timeline.steps[0].actorPositions);
    }
    expect(JSON.stringify(left)).toBe(before);
    const dragged = moveSelection(back, 0, [config.actorIds[3]], { x: .1, y: .02 });
    const settings = configureCourtSimulation(dragged, 0, { attackSettings: { blockAngle: 20 } });
    expect(actorPoint(settings, 0, config.actorIds[3])).toEqual(actorPoint(dragged, 0, config.actorIds[3]));
  });

  it("moves the contact without moving the block and uses hand offsets only once", () => {
    const before = attackBoard(), config = getCourtSimulation(before, 0)!;
    const next = updateCourtSimulationHandle(before, 0, { kind: "hit", point: point(-2, 1.1) });
    const edited = sampleCourtSimulation(next, 0, 0)!;
    near(edited.flight!.hit, [-2, 3, 1.1]);
    for (const slot of [1, 2, 5]) expect(actorPoint(next, 0, config.actorIds[slot])).toEqual(actorPoint(before, 0, config.actorIds[slot]));
    expect(edited.walls).toEqual(sampleCourtSimulation(before, 0, 0)!.walls);
  });

  it("supports independent serve, pass/set height and attack target edits", () => {
    let board = configureCourtSimulation(receiveBoard(), 0, { mode: "receive" });
    board = updateCourtSimulationHandle(board, 0, { kind: "serve", point: point(2.5, 7) });
    expect(getCourtSimulation(board, 0)!.landingOverride!.x).toBeCloseTo(2.5);
    expect(getCourtSimulation(board, 0)!.landingOverride!.z).toBeCloseTo(7);
    board = configureCourtSimulation(board, 0, { mode: "attack" });
    board = updateCourtSimulationHandle(board, 0, { kind: "pass", value: 3 });
    board = updateCourtSimulationHandle(board, 0, { kind: "set", value: 2.4 });
    board = updateCourtSimulationHandle(board, 0, { kind: "target", point: point(6, -10) });
    const frame = sampleCourtSimulation(board, 0, 0)!;
    expect(frame.passArc).toBe(3);
    expect(frame.setArc).toBe(2.4);
    near(frame.attackTarget!, [6, .12, -10]);
  });

  it("restores the current formation and contact defaults as one document command", () => {
    const original = configureCourtSimulation(receiveBoard(), 0, { mode: "attack", preset: "5", blockers: 2 });
    let changed = updateCourtSimulationHandle(original, 0, { kind: "hit", point: point(-2, 2) });
    changed = configureCourtSimulation(changed, 0, { attackSettings: { blockAngle: 30, manualBlockers: [1] } });
    changed.timeline.steps[0].actorPositions[getCourtSimulation(changed, 0)!.actorIds[0]] = point(-2, 3);
    const restored = resetCourtSimulation(changed, 0);
    expect(getCourtSimulation(restored, 0)).toMatchObject({ mode: "attack", preset: "5", blockers: 2, attackSettings: { hitOverride: null, blockAngle: 0, manualBlockers: [] } });
    expect(restored.timeline.steps[0].actorPositions).toEqual(original.timeline.steps[0].actorPositions);
  });

  it.each([[-2, "net"], [-4.25, "tape"]] as const)("continues the exact %s collision and physical replay duration", (target, type) => {
    const board = configureCourtSimulation(receiveBoard(), 0, { mode: "attack", layers: { attack: true, block: false, pass: false }, attackSettings: { hitOverride: [0, 1.5], targetOverride: [0, target] } });
    const initial = sampleCourtSimulation(board, 0, 0)!, collision = initial.flight!.collisions[0];
    expect(collision.type).toBe(type);
    expect(initial.duration).toBeGreaterThanOrEqual(2.8);
    const time = initial.attackContact! + collision.time / initial.duration;
    near(sampleCourtSimulation(board, 0, time)!.ball, collision.point);
    expect(board.timeline.steps[0].durationMs).toBe(Math.round(initial.duration * 1000));
  });

  it("keeps successive hand contacts and reverse scrubbing continuous", () => {
    let board = configureCourtSimulation(receiveBoard(), 0, { mode: "attack", blockers: 2, attackSettings: { hitOverride: [-.02, .75], targetOverride: [.11, -6.5], manualBlockers: [1, 2] } });
    const config = getCourtSimulation(board, 0)!;
    board.timeline.steps[0].actorPositions[config.actorIds[1]] = point(-.43, -.25);
    board.timeline.steps[0].actorPositions[config.actorIds[2]] = point(.45, -.45);
    board = configureCourtSimulation(board, 0, {});
    const start = sampleCourtSimulation(board, 0, 0)!;
    expect(start.flight!.collisions.filter(event => event.type !== "floor").slice(0, 2).map(event => [event.type, event.wallIndex])).toEqual([["block", 0], ["block", 1]]);
    for (const event of start.flight!.collisions) {
      const time = start.attackContact! + event.time / start.duration;
      if (time > 1) continue;
      near(sampleCourtSimulation(board, 0, time)!.ball, event.point);
      near(sampleCourtSimulation(board, 0, time - 1e-7)!.ball, sampleCourtSimulation(board, 0, time + 1e-7)!.ball, 1e-4);
    }
    const earlier = sampleCourtSimulation(board, 0, .8);
    sampleCourtSimulation(board, 0, 1);
    expect(sampleCourtSimulation(board, 0, .8)).toEqual(earlier);
  });

  it("round trips simulation and team bindings through DB and validated editable import", () => {
    const board = configureCourtSimulation(receiveBoard(), 0, { mode: "attack", blockers: 3, preset: "pipe", attackSettings: { blockAngles: { "2": 25 } } });
    const db = parseCourtVisualPayload(serializeCourtVisualPayload(board));
    expect(db.timeline.steps[0].simulation).toEqual(board.timeline.steps[0].simulation);
    const imported = parseEditorImport(JSON.stringify({ format: "goatleta-court", version: 1, payload: db }));
    expect(imported.timeline.steps[0].simulation).toEqual(board.timeline.steps[0].simulation);
    expect(sampleCourtSimulation(imported, 0, .76)!.ball).toEqual(sampleCourtSimulation(db, 0, .76)!.ball);
    for (const id of getCourtSimulation(imported, 0)!.actorIds) expect(imported.editor!.actorMeta[id]?.team).toBe(db.editor!.actorMeta[id]?.team ?? "A");
  });

  it("remaps the canonical ball reference when duplicating or continuing a step", () => {
    const board = attackBoard(), ball = getCourtSimulation(board, 0)!.ballId;
    for (const result of [duplicateStep(board, 0), continueStepFromEnd(board, 0)]) {
      const config = getCourtSimulation(result.payload, result.stepIndex)!;
      expect(config).not.toBeNull();
      expect(config.ballId).not.toBe(ball);
      expect(frameDrawings(result.payload, result.stepIndex).some(drawing => drawing.id === config.ballId)).toBe(true);
      expect(sampleCourtSimulation(result.payload, result.stepIndex, .76)!.ball).toEqual(sampleCourtSimulation(board, 0, .76)!.ball);
    }
  });

  it("disables simulation when an active binding is removed but preserves locked objects", () => {
    const board = attackBoard(), config = getCourtSimulation(board, 0)!;
    expect(getCourtSimulation(deleteSelection(board, 0, [config.actorIds[3]]), 0)).toBeNull();
    expect(getCourtSimulation(deleteSelection(board, 0, [config.ballId]), 0)).toBeNull();
    board.editor!.actorMeta[config.actorIds[3]] = { locked: true };
    expect(getCourtSimulation(deleteSelection(board, 0, [config.actorIds[3]]), 0)).not.toBeNull();
    expect(getCourtSimulation(moveSelection(board, 0, [config.actorIds[3]], { x: .1, y: 0 }, true), 0)).not.toBeNull();
  });

  it("uses sampled drag anchors, marks moved blockers manual, and detaches explicit authored animation", () => {
    const board = attackBoard(), config = getCourtSimulation(board, 0)!, before = sampleCourtSimulation(board, 0, .7)!;
    const moved = moveSelection(board, 0, [config.actorIds[1]], { x: .1, y: .02 }, false, undefined, .7);
    expect(actorPoint(moved, 0, config.actorIds[1]).x).toBeCloseTo(before.actors[1].position[0] / 9 + .6);
    expect(getCourtSimulation(moved, 0)!.attackSettings.manualBlockers).toContain(1);
    const authored = moveSelection(board, 0, [config.actorIds[3]], { x: .1, y: 0 }, true, undefined, .7);
    expect(getCourtSimulation(authored, 0)).toBeNull();
    expect(authored.timeline.steps[0].trajectories?.find(item => item.actorId === config.actorIds[3])?.points[0].x).toBeCloseTo(before.actors[3].position[0] / 9 + .5);
  });

  it("rejects missing, duplicate and foreign references on import and normalizes bounded controls", () => {
    const board = attackBoard(), config = getCourtSimulation(board, 0)!;
    expect(normalizeCourtSimulation({ ...config, actorIds: ["missing", ...config.actorIds.slice(1)] }, board.actors.map(actor => actor.id))).toBeNull();
    expect(normalizeCourtSimulation({ ...config, actorIds: Array(7).fill(config.actorIds[0]) })).toBeNull();
    expect(normalizeCourtSimulation({ ...config, attackSettings: { blockAngle: 900, passHeight: -8 } })!.attackSettings).toMatchObject({ blockAngle: 65, passHeight: .4 });
    board.timeline.steps[0].simulation!.ballId = "foreign";
    expect(() => parseEditorImport(JSON.stringify({ format: "goatleta-court", version: 1, payload: board }))).toThrow("Simulação");
  });
});
