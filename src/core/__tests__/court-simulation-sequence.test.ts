import { buildEditable5x1ReceptionPreset, type CourtVisualPayload } from "../visual-court";
import { frameDrawings, newCourtBoard, parseEditorImport, upgradeCourtEditor, type CourtDrawing } from "../visual-court-editor";
import { configureCourtSimulation, getCourtSimulation, sampleCourtSimulation } from "../court-simulation";
import { sampleReception } from "../court-simulation/reception-motion.js";
import { sampleAttack } from "../court-simulation/attack-motion.js";
import { displayCourtDrawings, simulationFloorPoint } from "../court-simulation-display";
import { buildCourtPerspectiveFrame, worldToCourtPoint } from "../visual-court-perspective";
import {
  buildSimulatedReceptionRotationPreset,
  configureCourtRotationSequenceMode,
  getReceptionRotationStep,
  isLegacyReceptionRotationSequence,
  replaceReceptionRotationSequence,
} from "../court-simulation-sequence";

const labels = ["P1", "P6", "P5", "P4", "P3", "P2"];
const legacy = () => upgradeCourtEditor(buildEditable5x1ReceptionPreset(), "Recepção da turma");
const material = (id: string, kind: CourtDrawing["kind"] = "cone"): CourtDrawing => ({
  id, kind, points: [{ x: .23, y: .72 }], color: "#123456", size: 24, rotation: 15, locked: true,
});

describe("shared receive/attack mode across the six-rotation sequence", () => {
  it("changes all six stages together while retaining each rotation's identities, materials and individual tuning", () => {
    let source = buildSimulatedReceptionRotationPreset();
    source.editor = { ...source.editor!, folder: "ElCartel", tags: "ataque", favorite: true, lessonLink: { date: "2026-10-16", block: "principal", revision: "authored" } };
    source.actors[0] = { ...source.actors[0], label: "Levantadora", color: "#123456", number: 10 };
    source.editor.actorMeta[source.actors[0].id] = { ...source.editor.actorMeta[source.actors[0].id], locked: true, studentId: "existing-athlete" };
    for (let index = 0; index < 6; index++) {
      source = configureCourtSimulation(source, index, {
        serve: index % 2 ? "Topspin" : "Float", seam: index % 2 ? "Right" : "Left", blockers: 2,
        landingOverride: { x: index / 10, z: 6.1 + index / 10 },
        attackSettings: { passHeight: 1.8 + index / 10, setHeight: .8 + index / 10, attackArc: .03 + index / 100, blockAngle: index, blockAngles: { "2": 10 + index }, targetOverride: [index / 10, -6] },
      });
      source.editor!.drawings[source.timeline.steps[index].id].push(material(`mode-material-${index}`));
    }
    const originals = source.timeline.steps.map((_, index) => getCourtSimulation(source, index)!);
    const before = JSON.stringify(source);
    const attack = configureCourtRotationSequenceMode(source, 2, "attack");
    expect(attack.timeline.steps.map(step => step.id)).toEqual(source.timeline.steps.map(step => step.id));
    expect(attack.timeline.steps.map(step => step.label)).toEqual(labels.map(label => `${label} · Ataque`));
    expect(attack.timeline.steps.map((_, index) => getCourtSimulation(attack, index)?.mode)).toEqual(Array(6).fill("attack"));
    for (const actor of source.actors) expect(attack.actors.find(item => item.id === actor.id)).toEqual(actor);
    for (const [id, meta] of Object.entries(source.editor!.actorMeta)) expect(attack.editor!.actorMeta[id]).toEqual(meta);
    const { drawings: originalDrawings, actorMeta: originalMeta, ...originalMetadata } = source.editor!;
    const { drawings: attackDrawings, actorMeta: attackMeta, ...attackMetadata } = attack.editor!;
    expect(attackMetadata).toEqual(originalMetadata);
    for (let index = 0; index < 6; index++) {
      const changed = getCourtSimulation(attack, index)!, previous = originals[index];
      expect(changed).toMatchObject({ rotation: previous.rotation, teamActorIds: previous.teamActorIds, ballId: previous.ballId, system: previous.system, serve: previous.serve, seam: previous.seam, landingOverride: previous.landingOverride, attackSettings: previous.attackSettings, layers: previous.layers, blockers: previous.blockers });
      expect(frameDrawings(attack, index).find(item => item.id === `mode-material-${index}`)).toEqual(originalDrawings[source.timeline.steps[index].id].find(item => item.id === `mode-material-${index}`));
      expect(frameDrawings(attack, index).filter(item => item.kind === "ball")).toHaveLength(1);
    }
    const restored = configureCourtRotationSequenceMode(attack, 2, "receive");
    expect(restored.timeline.steps.map(step => step.label)).toEqual(labels.map(label => `${label} · Recepção`));
    expect(restored.timeline.steps.map(step => step.durationMs)).toEqual(Array(6).fill(4100));
    for (let index = 0; index < 6; index++) expect(getCourtSimulation(restored, index)).toEqual(originals[index]);
    expect(JSON.stringify(source)).toBe(before);
  });

  it("samples the new attack engine at the same time in all six stages and both projections", () => {
    const payload = configureCourtRotationSequenceMode(buildSimulatedReceptionRotationPreset(), 0, "attack");
    const before = JSON.stringify(payload);
    for (let index = 0; index < 6; index++) {
      const config = getCourtSimulation(payload, index)!;
      expect(config).toMatchObject({ mode: "attack", rotation: index, layers: { pass: true } });
      expect(payload.timeline.steps[index].durationMs).toBe(4400);
      for (const progress of [0, .76, 1]) {
        const actual = sampleCourtSimulation(payload, index, progress)!;
        const expected = sampleAttack(progress, { bases: actual.bases, preset: config.preset, blockers: config.blockers, layers: config.layers, ...config.attackSettings });
        expect(actual.duration).toBe(4.4);
        expect(actual.ball).toEqual(expected.ball);
        expect(actual.flight).toEqual(expected.flight);
        expect(actual.flight!.collisions.length).toBeGreaterThan(0);
        expect(actual.actors.map(({ id, slot, visible, ...actor }) => actor)).toEqual(expected.actors);
        const elevated = buildCourtPerspectiveFrame(payload, index, progress);
        const ball3D = elevated.drawings.find(item => item.id === config.ballId)!;
        const ball2D = displayCourtDrawings(payload, index, progress).find(item => item.id === config.ballId)!;
        expect(ball3D.points[0]).toEqual({ x: actual.ball[0], y: actual.ball[1], z: actual.ball[2] });
        expect(ball2D.points[0]).toEqual(worldToCourtPoint(ball3D.points[0]));
        for (const actor of actual.actors.filter(actor => actor.visible)) {
          const actor3D = elevated.actors.find(item => item.id === actor.id)!;
          expect(worldToCourtPoint(actor3D.position)).toEqual(simulationFloorPoint(actor.position));
          expect(actor3D.pose).toBe(actor.pose);
        }
      }
    }
    expect(JSON.stringify(payload)).toBe(before);
  });

  it("uses rotation identities for labels and navigation after reordering, while retaining authored labels and bases", () => {
    const source = buildSimulatedReceptionRotationPreset();
    source.timeline.steps[1].label = "Treinar recepção curta";
    source.timeline.steps = [source.timeline.steps[3], source.timeline.steps[0], source.timeline.steps[5], source.timeline.steps[1], source.timeline.steps[4], source.timeline.steps[2]];
    const attack = configureCourtRotationSequenceMode(source, 4, "attack");
    expect(attack.timeline.steps.map(step => step.label)).toEqual(["P4 · Ataque", "P1 · Ataque", "P2 · Ataque", "Treinar recepção curta", "P3 · Ataque", "P5 · Ataque"]);
    const setter = getCourtSimulation(attack, 0)!.actorIds[0];
    attack.timeline.steps[0].actorPositions[setter] = { x: .23, y: .71 };
    const before = JSON.stringify(attack);
    expect([0, 1, 2, 3, 4, 5].map(rotation => getReceptionRotationStep(attack, 0, rotation))).toEqual([1, 3, 5, 0, 4, 2]);
    expect(attack.timeline.steps[0].actorPositions[setter]).toEqual({ x: .23, y: .71 });
    expect(JSON.stringify(attack)).toBe(before);
    expect(configureCourtRotationSequenceMode(attack, 0, "attack")).toBe(attack);
    const receive = configureCourtRotationSequenceMode(attack, 0, "receive");
    expect(receive.timeline.steps.map(step => step.label)).toEqual(["P4 · Recepção", "P1 · Recepção", "P2 · Recepção", "Treinar recepção curta", "P3 · Recepção", "P5 · Recepção"]);
    expect(configureCourtRotationSequenceMode(receive, 3, "receive")).toBe(receive);
  });

  it("reuses opposing support across mode cycles and keeps only the intended participants visible", () => {
    let payload = buildSimulatedReceptionRotationPreset();
    const own = payload.actors.filter(actor => payload.editor!.actorMeta[actor.id]?.team !== "B");
    const attack = configureCourtRotationSequenceMode(payload, 0, "attack");
    const opponents = attack.actors.filter(actor => attack.editor!.actorMeta[actor.id]?.team === "B").map(actor => actor.id).sort();
    expect(opponents).toHaveLength(3);
    payload = attack;
    for (let cycle = 0; cycle < 2; cycle++) {
      payload = configureCourtRotationSequenceMode(payload, 0, "attack");
      for (let index = 0; index < 6; index++) {
        const frame = buildCourtPerspectiveFrame(payload, index, .76);
        expect(frame.actors.filter(actor => payload.editor!.actorMeta[actor.id]?.team !== "B")).toHaveLength(3);
        const config = getCourtSimulation(payload, index)!;
        expect(frame.actors.filter(actor => payload.editor!.actorMeta[actor.id]?.team !== "B").map(actor => actor.id).sort()).toEqual([config.teamActorIds![0], config.teamActorIds![3], config.teamActorIds![4]].sort());
      }
      payload = configureCourtRotationSequenceMode(payload, 0, "receive");
      for (let index = 0; index < 6; index++) {
        const frame = buildCourtPerspectiveFrame(payload, index, .55);
        expect(frame.actors).toHaveLength(7);
        expect(frame.actors.filter(actor => actor.role === "middle")).toHaveLength(1);
      }
      expect(payload.actors.filter(actor => payload.editor!.actorMeta[actor.id]?.team === "B").map(actor => actor.id).sort()).toEqual(opponents);
      expect(payload.actors.filter(actor => payload.editor!.actorMeta[actor.id]?.team !== "B")).toEqual(own);
      for (let index = 0; index < 6; index++) expect(frameDrawings(payload, index).filter(item => item.kind === "ball")).toHaveLength(1);
    }
  });

  it("keeps individual-stage editing for a free board and ignores an invalid active stage", () => {
    const source = newCourtBoard(), before = JSON.stringify(source);
    const attack = configureCourtRotationSequenceMode(source, 0, "attack");
    expect(attack.timeline.steps).toHaveLength(1);
    expect(attack.timeline.steps[0].id).toBe(source.timeline.steps[0].id);
    expect(attack.timeline.steps[0].label).toBe(source.timeline.steps[0].label);
    expect(getCourtSimulation(attack, 0)?.mode).toBe("attack");
    expect(getReceptionRotationStep(attack, 0, 1)).toBe(-1);
    expect(JSON.stringify(source)).toBe(before);
    const sequence = buildSimulatedReceptionRotationPreset();
    for (const index of [-1, 6, .5, NaN]) expect(configureCourtRotationSequenceMode(sequence, index, "attack")).toBe(sequence);
  });
});

describe("canonical six-rotation reception sequence", () => {
  it("replaces each legacy pair with one complete reception, preserving the selected rotation", () => {
    const source = legacy(), before = JSON.stringify(source);
    expect(isLegacyReceptionRotationSequence(source)).toBe(true);
    const result = replaceReceptionRotationSequence(source, 3);
    expect(result.stepIndex).toBe(1);
    expect(result.payload.timeline.steps).toHaveLength(6);
    expect(result.payload.timeline.steps.map(step => step.id)).toEqual(source.timeline.steps.filter((_, index) => index % 2 === 0).map(step => step.id));
    expect(result.payload.timeline.steps.map(step => step.label)).toEqual(labels.map(label => `${label} · Recepção`));
    expect(result.payload.timeline.steps.map(step => step.durationMs)).toEqual(Array(6).fill(4100));
    expect(result.payload.timeline.steps.map((_, index) => getCourtSimulation(result.payload, index)?.rotation)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(isLegacyReceptionRotationSequence(result.payload)).toBe(false);
    for (const step of result.payload.timeline.steps) {
      expect(step.trajectories ?? []).toHaveLength(0);
      expect(step.transitions ?? []).toHaveLength(0);
    }
    expect(JSON.stringify(source)).toBe(before);
  });

  it.each([0, 1, 2, 3, 4, 5])("samples a complete reception in rotation %i identically for the engine, 3D and 2D", rotation => {
    const payload = buildSimulatedReceptionRotationPreset();
    const config = getCourtSimulation(payload, rotation)!;
    expect(config).toMatchObject({ mode: "receive", rotation });
    const before = JSON.stringify(payload);
    const balls: number[][] = [];
    for (const progress of [0, .22, .38, .5, .64, .8, 1]) {
      const actual = sampleCourtSimulation(payload, rotation, progress)!;
      const expected = sampleReception(progress, {
        bases: actual.bases, rotation, system: config.system, serve: config.serve,
        landing: [config.landingOverride?.x ?? (config.seam === "Left" ? -1.45 : 1.4), config.landingOverride?.z ?? 6.65],
      });
      expect(actual.duration).toBe(4.1);
      expect(actual.elapsedSeconds).toBe(progress * 4.1);
      expect(actual.ball).toEqual(expected.ball);
      expect(actual.actors.map(({ id, slot, visible, ...actor }) => actor)).toEqual(expected.actors);
      const perspective = buildCourtPerspectiveFrame(payload, rotation, progress);
      const flatBall = displayCourtDrawings(payload, rotation, progress).find(drawing => drawing.id === config.ballId)!;
      const elevatedBall = perspective.drawings.find(drawing => drawing.id === config.ballId)!;
      expect(elevatedBall.points[0]).toEqual({ x: expected.ball[0], y: expected.ball[1], z: expected.ball[2] });
      expect(flatBall.points[0]).toEqual(simulationFloorPoint(expected.ball));
      expect(flatBall.points[0]).toEqual(worldToCourtPoint(elevatedBall.points[0]));
      for (const actor of actual.actors.filter(actor => actor.visible)) {
        const elevatedActor = perspective.actors.find(item => item.id === actor.id)!;
        expect(worldToCourtPoint(elevatedActor.position)).toEqual(simulationFloorPoint(actor.position));
        expect(elevatedActor.pose).toBe(actor.pose);
        expect(elevatedActor.path).toEqual([]);
      }
      balls.push(actual.ball);
    }
    expect(new Set(balls.map(ball => JSON.stringify(ball))).size).toBeGreaterThan(4);
    expect(JSON.stringify(payload)).toBe(before);
  });

  it("preserves authored actor identities, colours, metadata and both pairs' materials, with one simulation ball", () => {
    const source = legacy();
    source.actors[2] = { ...source.actors[2], label: "Ana", number: 11, color: "#123456", baseColor: "#abcdef" };
    source.editor = {
      ...source.editor!, title: "Recepção personalizada", folder: "ElCartel", tags: "passe", favorite: true,
      showActorNumbers: false, actorRepresentation: "person", hiddenLayers: ["labels"],
      lessonLink: { date: "2026-10-16", block: "principal", revision: "local" },
      actorMeta: { ...source.editor!.actorMeta, [source.actors[2].id]: { team: "A", locked: true, studentId: "existing-student" } },
    };
    source.timeline.steps.forEach((step, index) => {
      source.editor!.drawings[step.id] = [
        material(`material-${index}`),
        { ...material(`ball-${index}`, "ball"), motion: [{ x: .2, y: .7 }, { x: .8, y: .6 }] },
        material(`pair-shared-${Math.floor(index / 2)}`, "text"),
      ];
    });
    const before = JSON.stringify(source);
    const result = replaceReceptionRotationSequence(source).payload;
    for (const actor of source.actors) expect(result.actors.find(item => item.id === actor.id)).toEqual(actor);
    const { drawings: oldDrawings, actorMeta: oldActorMeta, ...oldMetadata } = source.editor!;
    const { drawings: nextDrawings, actorMeta: nextActorMeta, ...nextMetadata } = result.editor!;
    expect(nextMetadata).toEqual(oldMetadata);
    for (const [id, meta] of Object.entries(oldActorMeta)) expect(nextActorMeta[id]).toEqual(meta);
    expect(Object.keys(nextDrawings).sort()).toEqual(result.timeline.steps.map(step => step.id).sort());
    result.timeline.steps.forEach((step, rotation) => {
      const items = frameDrawings(result, rotation), config = getCourtSimulation(result, rotation)!;
      expect(items.filter(item => item.kind === "ball")).toHaveLength(1);
      expect(items.filter(item => item.kind === "ball")[0].id).toBe(config.ballId);
      expect(items.find(item => item.id === config.ballId)?.motion).toBeUndefined();
      for (const index of [rotation * 2, rotation * 2 + 1]) {
        const authored = oldDrawings[source.timeline.steps[index].id].find(item => item.id === `material-${index}`)!;
        expect(items.find(item => item.id === authored.id)).toEqual(authored);
      }
      expect(items.filter(item => item.id === `pair-shared-${rotation}`)).toHaveLength(1);
    });
    expect(JSON.stringify(source)).toBe(before);
  });

  it("keeps valid receive tuning from a partially simulated legacy pair and resets its old movement bases", () => {
    const source = configureCourtSimulation(legacy(), 3, {
      mode: "receive", rotation: 1, serve: "Topspin", seam: "Right", landingOverride: { x: 1.2, z: 6.3 },
    });
    const previous = getCourtSimulation(source, 3)!;
    const payload = replaceReceptionRotationSequence(source, 3).payload;
    expect(getCourtSimulation(payload, 1)).toMatchObject({ mode: "receive", rotation: 1, serve: "Topspin", seam: "Right", landingOverride: { x: 1.2, z: 6.3 }, ballId: previous.ballId });
    expect(getCourtSimulation(payload, 1)!.actorIds).toEqual(previous.actorIds);
    expect(payload.timeline.steps[1].durationMs).toBe(4100);
    expect(payload.timeline.steps[1].trajectories ?? []).toEqual([]);
    expect(payload.timeline.steps[1].transitions ?? []).toEqual([]);
  });

  it("keeps the tuned stage's six-player lineup when the legacy pair uses different middles", () => {
    let source = legacy();
    source.timeline.steps[0].visibleActorIds = source.actors.filter(actor => actor.id !== "c2").map(actor => actor.id);
    source = configureCourtSimulation(source, 0, { mode: "receive", rotation: 0 });
    source.timeline.steps[1].visibleActorIds = source.actors
      .filter(actor => source.editor!.actorMeta[actor.id]?.team !== "B" && actor.id !== "c1")
      .map(actor => actor.id);
    source = configureCourtSimulation(source, 1, { mode: "receive", rotation: 0 });
    const first = getCourtSimulation(source, 0)!, second = getCourtSimulation(source, 1)!;
    expect(first.teamActorIds).toHaveLength(6);
    expect(second.teamActorIds).toHaveLength(6);
    expect(first.teamActorIds).toContain("c1");
    expect(first.teamActorIds).not.toContain("c2");
    expect(second.teamActorIds).toContain("c2");
    expect(second.teamActorIds).not.toContain("c1");
    for (const step of source.timeline.steps.slice(0, 2)) {
      expect(step.visibleActorIds!.filter(id => source.editor!.actorMeta[id]?.team !== "B")).toHaveLength(6);
    }
    const before = JSON.stringify(source);
    const payload = replaceReceptionRotationSequence(source).payload;
    const converted = getCourtSimulation(payload, 0)!;
    expect(converted.teamActorIds).toEqual(first.teamActorIds);
    expect(payload.timeline.steps[0].visibleActorIds).not.toContain("c2");
    const frame = buildCourtPerspectiveFrame(payload, 0, .55);
    expect(frame.actors).toHaveLength(7);
    expect(frame.actors.filter(actor => actor.role === "middle").map(actor => actor.id)).toEqual(["c1"]);
    expect(frame.actors.some(actor => actor.id === "c2")).toBe(false);
    expect(JSON.stringify(source)).toBe(before);
  });

  it("round-trips the current sequence through the bounded editable-document importer", () => {
    const payload = buildSimulatedReceptionRotationPreset();
    const imported = parseEditorImport(JSON.stringify({ format: "goatleta-court", version: 1, payload }));
    expect(imported.timeline.steps.map(step => [step.id, step.label, step.durationMs])).toEqual(payload.timeline.steps.map(step => [step.id, step.label, step.durationMs]));
    for (let index = 0; index < 6; index++) {
      expect(getCourtSimulation(imported, index)).toEqual(getCourtSimulation(payload, index));
      for (const progress of [0, .38, .64, 1]) {
        expect(sampleCourtSimulation(imported, index, progress)).toEqual(sampleCourtSimulation(payload, index, progress));
      }
    }
  });

  it("does not replace an authored, incomplete, ambiguous or already-current board", () => {
    const full = legacy();
    const incomplete = { ...full, timeline: { steps: full.timeline.steps.slice(0, 11) } };
    const repeated = { ...full, timeline: { steps: full.timeline.steps.map((step, index) => index === 3 ? { ...step, id: full.timeline.steps[2].id } : step) } };
    const wrongRotation = { ...full, timeline: { steps: full.timeline.steps.map((step, index) => index === 3 ? { ...step, rotationIndex: 3 as const } : step) } };
    const wrongPhase = { ...full, timeline: { steps: full.timeline.steps.map((step, index) => index === 3 ? { ...step, phase: "receive_legal" as const } : step) } };
    const authored = { ...full, timeline: { steps: full.timeline.steps.map(step => ({ ...step, formationKind: "didactic_grid" as const })) } };
    for (const payload of [newCourtBoard(), incomplete, repeated, wrongRotation, wrongPhase, authored, buildSimulatedReceptionRotationPreset()]) {
      const before = JSON.stringify(payload);
      expect(isLegacyReceptionRotationSequence(payload)).toBe(false);
      const result = replaceReceptionRotationSequence(payload, 0);
      expect(result.payload).toBe(payload);
      expect(result.stepIndex).toBe(0);
      expect(JSON.stringify(payload)).toBe(before);
    }
  });

  it("resolves rotation by canonical configuration even when the six steps are reordered", () => {
    const payload = buildSimulatedReceptionRotationPreset();
    const reordered: CourtVisualPayload = { ...payload, timeline: { steps: [payload.timeline.steps[3], payload.timeline.steps[0], payload.timeline.steps[5], payload.timeline.steps[1], payload.timeline.steps[4], payload.timeline.steps[2]] } };
    expect([0, 1, 2, 3, 4, 5].map(rotation => getReceptionRotationStep(reordered, 0, rotation))).toEqual([1, 3, 5, 0, 4, 2]);
    expect(getReceptionRotationStep(reordered, 3, 1)).toBe(3);
  });

  it("navigates to an authored attack or different system without rewriting another rotation", () => {
    const mixed = configureCourtSimulation(buildSimulatedReceptionRotationPreset(), 1, { mode: "attack", system: "6-2" });
    const before = JSON.stringify(mixed);
    expect(getReceptionRotationStep(mixed, 0, 2)).toBe(2);
    expect(getReceptionRotationStep(mixed, 0, 1)).toBe(1);
    expect(getCourtSimulation(mixed, 0)).toMatchObject({ mode: "receive", rotation: 0, system: "5-1" });
    expect(getCourtSimulation(mixed, 1)).toMatchObject({ mode: "attack", rotation: 1, system: "6-2" });
    expect(JSON.stringify(mixed)).toBe(before);
  });

  it("returns the fallback sentinel outside a valid sequence of six unique rotations", () => {
    const payload = buildSimulatedReceptionRotationPreset();
    expect(getReceptionRotationStep(legacy(), 0, 1)).toBe(-1);
    expect(getReceptionRotationStep(newCourtBoard(), 0, 1)).toBe(-1);
    const incomplete = { ...payload, timeline: { steps: payload.timeline.steps.slice(0, 5) } };
    expect(getReceptionRotationStep(incomplete, 0, 5)).toBe(-1);
    const mixed = configureCourtSimulation(payload, 1, { system: "6-2" });
    expect(getReceptionRotationStep(mixed, 0, 1)).toBe(1);
    const attack = configureCourtSimulation(payload, 1, { mode: "attack" });
    expect(getReceptionRotationStep(attack, 0, 1)).toBe(1);
    for (const rotation of [-1, 6, NaN, .5]) expect(getReceptionRotationStep(payload, 0, rotation)).toBe(-1);
    expect(getReceptionRotationStep(payload, -1, 1)).toBe(-1);
    expect(getReceptionRotationStep(payload, 6, 1)).toBe(-1);
  });
});
