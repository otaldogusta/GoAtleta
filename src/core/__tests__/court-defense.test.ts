import { ensureCourtDefenseStep, getCourtDefenseSideStepIndex, getCourtDefenseStepIndex } from "../court-defense-preset";
import { defensePlaybackClock } from "../court-defense-motion";
import { normalizeCourtSimulation } from "../court-simulation-model";
import { configureCourtSimulation, getCourtSimulation, sampleCourtSimulation, updateCourtSimulationHandle } from "../court-simulation";
import { buildCourtPerspectiveFrame } from "../visual-court-perspective";
import { displayCourtDrawings, simulationFloorPoint } from "../court-simulation-display";
import { resolveCourtLayers } from "../court-layers";
import { changeDrawings, copyStepSelection, courtTrajectoryHeightTargets, duplicateSelection, duplicateStep, frameDrawings, moveSelection, newCourtBoard, parseEditorImport, pasteStepSelection, setCourtActorAction, setCourtAreaVertex, setCourtSelectionElevation, setCourtTrajectoryPoint } from "../visual-court-editor";
import { DEFENSE_BLOCK_SHADOW_ID, projectCourtBlockShadow } from "../court-block-shadow";
import { parseCourtVisualPayload, serializeCourtVisualPayload, type CourtActorAction } from "../visual-court";

const setup = () => ensureCourtDefenseStep(newCourtBoard());
const expected = {
  "height-player": { x: .45021318980065, y: .6428772267877533 },
  "circle-player": { x: .9627325216959379, y: .435773218862502 },
  "board_mwe81mmb_i7sa8kdc": { x: .9030737799733927, y: .5513193038601435 },
  "board_mwe820yh_46d2dj66": { x: .8090148496426253, y: .5507544323011282 },
  "board_mwe82nib_o7hqgvly": { x: .07353581311638646, y: .7039602404746408 },
  "board_mwe82zw1_2hmbi70q": { x: .9733832125476085, y: .8260512342917896 },
  "board_mwe838z8_9ng7sqxw": { x: .2947221656019014, y: .8408940324700445 },
};

describe("authored zone-four defense", () => {
  it("appends once without replacing existing stages or actors and preserves the exact tableau", () => {
    const board = newCourtBoard(), before = JSON.stringify(board), next = ensureCourtDefenseStep(board);
    expect(next.stepIndex).toBe(board.timeline.steps.length);
    expect(next.payload.timeline.steps.slice(0, next.stepIndex)).toEqual(board.timeline.steps.map(step => ({ ...step, visibleActorIds: step.visibleActorIds ?? board.actors.map(actor => actor.id) })));
    expect(next.payload.actors.slice(0, board.actors.length)).toEqual(board.actors);
    expect(next.payload.timeline.steps[next.stepIndex].actorPositions).toEqual(expected);
    expect(next.payload.timeline.steps[next.stepIndex].actorElevations).toEqual({ "circle-player": 1.006326834602263 });
    expect(ensureCourtDefenseStep(next.payload)).toEqual(next);
    expect(ensureCourtDefenseStep(next.payload).payload).toBe(next.payload);
    expect(JSON.stringify(board)).toBe(before);
    expect(next.payload.editor!.actorMeta["circle-player"].team).toBe("B");
    expect(getCourtSimulation(next.payload, next.stepIndex)!.teamActorIds).toHaveLength(6);
  });

  it("samples organization to exact authored contact positions without shot physics", () => {
    const { payload, stepIndex } = setup(), step = payload.timeline.steps[stepIndex];
    const start = sampleCourtSimulation(payload, stepIndex, 0)!, mid = sampleCourtSimulation(payload, stepIndex, .5)!, end = sampleCourtSimulation(payload, stepIndex, 1)!;
    expect(end.mode).toBe("defense"); expect(end.visibleIds).toHaveLength(7);
    for (const actor of end.actors) {
      const destination = step.actorPositions[actor.id];
      expect(actor.position).toEqual([(destination.x - .5) * 9, step.actorElevations?.[actor.id] ?? 0, (destination.y - .5) * 18]);
      expect(actor.jump).toBe(actor.role === "blocker" ? .85 : 0);
      expect(start.actors.find(item => item.id === actor.id)!.position).not.toEqual(actor.position);
      expect(mid.actors.find(item => item.id === actor.id)!.position).not.toEqual(actor.position);
    }
    expect(end.actors.find(actor => actor.id === "circle-player")!.pose).toBe("contact");
    expect(end.actors.filter(actor => actor.role === "blocker").map(actor => actor.extension)).toEqual([1, 1]);
    expect(end.flight).toBeUndefined(); expect(end.walls).toBeUndefined();
    expect(end.ball).toEqual(end.defenseContact);
    expect(start.ball).not.toEqual(end.ball);
    const frame = buildCourtPerspectiveFrame(payload, stepIndex, 1);
    expect(frame.simulation!.paths.map(path => path.id)).toEqual(["defense-pass", "defense-set"]);
    expect(frame.simulation!.handles).toEqual([]); expect(frame.simulation!.outcome).toBe("");
    expect(frame.drawings.filter(drawing => drawing.kind === "ball")).toHaveLength(1);
    const arrows = frame.drawings.filter(drawing => drawing.startBallId);
    expect(arrows).toHaveLength(3);
    expect(arrows.every(drawing => drawing.startBallId === "anchor-ball")).toBe(true);
    expect(displayCourtDrawings(payload, stepIndex, 1).find(drawing => drawing.id === end.ballId)!.points).toEqual([simulationFloorPoint(end.ball)]);
  });

  it("keeps the authored tactical contour editable and mirrors the exit as a separate defense stage", () => {
    const { payload, stepIndex } = setup(), exit = ensureCourtDefenseStep(payload, "5");
    const shadowFor = (board: typeof payload, index: number) => frameDrawings(board, index).find(drawing => drawing.id === DEFENSE_BLOCK_SHADOW_ID)!;
    const entryShadow = shadowFor(exit.payload, stepIndex);
    const exitShadow = shadowFor(exit.payload, exit.stepIndex);
    expect(entryShadow.points).toEqual([
      { x: .7987396920842208, y: .5000048825183138 }, { x: .9097133427853547, y: .5008270813153849 },
      { x: .8946150592922364, y: 1.0028210524962413 }, { x: .17977923074105917, y: .9986404479665256 },
      { x: .4928243471889229, y: .7470001680538499 },
    ]);
    expect(exitShadow.points).toEqual(entryShadow.points.map(({ x, y }) => ({ x: 1 - x, y })));
    expect(getCourtDefenseStepIndex(exit.payload, "4")).toBe(stepIndex);
    expect(getCourtDefenseStepIndex(exit.payload, "5")).toBe(exit.stepIndex);
    expect(ensureCourtDefenseStep(exit.payload, "5").payload).toBe(exit.payload);
    expect(exit.payload.timeline.steps[stepIndex]).toEqual(payload.timeline.steps[stepIndex]);
    for (const progress of [0, .38, .58, .94, 1]) {
      const entryFrame = sampleCourtSimulation(exit.payload, stepIndex, progress)!;
      const exitFrame = sampleCourtSimulation(exit.payload, exit.stepIndex, progress)!;
      expect(exitFrame.ball[0]).toBeCloseTo(-entryFrame.ball[0]);
      expect(exitFrame.ball.slice(1)).toEqual(entryFrame.ball.slice(1));
      exitFrame.actors.forEach((actor, i) => {
        const expectedActor = entryFrame.actors[i];
        expect(actor.position[0]).toBeCloseTo(-expectedActor.position[0]);
        expect(actor.position.slice(1)).toEqual(expectedActor.position.slice(1));
        expect(actor.jump).toBe(expectedActor.jump);
        expect(actor.facing[0]).toBeCloseTo(-expectedActor.facing[0]);
      });
      expect(exitFrame.actors[6].mirror).toBe(!entryFrame.actors[6].mirror);
    }
    const edited = setCourtAreaVertex(exit.payload, exit.stepIndex, exitShadow.id, 0, { x: .28, y: .55 }, 1);
    expect(shadowFor(edited, stepIndex)).toEqual(entryShadow);
    const roundTrip = parseEditorImport(JSON.stringify({ format: "goatleta-court", version: 1, payload: edited }));
    expect(getCourtDefenseStepIndex(roundTrip, "5")).toBe(exit.stepIndex);
    expect(shadowFor(roundTrip, exit.stepIndex).points[0]).toEqual({ x: .28, y: .55 });
    expect(shadowFor(roundTrip, stepIndex).points).toEqual(entryShadow.points);
  });

  it.each([["4", 4], ["1", 4], ["5", 0]] as const)("creates independent frontal and position-one coverage for attack %s", (preset, zoneOneSlot) => {
    const legacy = ensureCourtDefenseStep(newCourtBoard(), preset);
    const front = ensureCourtDefenseStep(legacy.payload, preset, "front");
    const zone1 = ensureCourtDefenseStep(front.payload, preset, "zone1");
    expect(zone1.payload.timeline.steps[legacy.stepIndex]).toEqual(legacy.payload.timeline.steps[legacy.stepIndex]);
    const base = sampleCourtSimulation(zone1.payload, legacy.stepIndex, 1)!;
    for (const [coverage, index, slot] of [["front", front.stepIndex, 3], ["zone1", zone1.stepIndex, zoneOneSlot]] as const) {
      expect(getCourtDefenseStepIndex(zone1.payload, preset, coverage)).toBe(index);
      expect(ensureCourtDefenseStep(zone1.payload, preset, coverage).payload).toBe(zone1.payload);
      const start = sampleCourtSimulation(zone1.payload, index, 0)!;
      const set = sampleCourtSimulation(zone1.payload, index, start.setContact!)!;
      const end = sampleCourtSimulation(zone1.payload, index, 1)!;
      expect(set.actors[slot].position).toEqual(start.actors[slot].position);
      expect(end.actors[slot].position).toEqual(base.actors[0].position);
      expect(end.actors[0].position).toEqual(base.actors[slot].position);
      expect(end.ball).toEqual(base.ball);
      expect(frameDrawings(zone1.payload, index)).toEqual(frameDrawings(legacy.payload, legacy.stepIndex));
    }
    const updated = setCourtAreaVertex(zone1.payload, zone1.stepIndex, DEFENSE_BLOCK_SHADOW_ID, 0, { x: .55, y: .55 }, 1);
    const restored = parseEditorImport(JSON.stringify({ format: "goatleta-court", version: 1, payload: updated }));
    expect(getCourtDefenseStepIndex(restored, preset, "front")).toBe(front.stepIndex);
    expect(getCourtDefenseStepIndex(restored, preset, "zone1")).toBe(zone1.stepIndex);
    expect(frameDrawings(restored, front.stepIndex).find(drawing => drawing.id === DEFENSE_BLOCK_SHADOW_ID)?.points)
      .toEqual(frameDrawings(legacy.payload, legacy.stepIndex).find(drawing => drawing.id === DEFENSE_BLOCK_SHADOW_ID)?.points);
    expect(frameDrawings(restored, zone1.stepIndex).find(drawing => drawing.id === DEFENSE_BLOCK_SHADOW_ID)?.points[0]).toEqual({ x: .55, y: .55 });
  });

  it("opens another authored coverage on the requested side when the preferred one is missing", () => {
    const entry = ensureCourtDefenseStep(newCourtBoard(), "4", "front");
    const exit = ensureCourtDefenseStep(entry.payload, "5", "zone1");
    expect(getCourtDefenseStepIndex(exit.payload, "5", "front")).toBe(-1);
    expect(getCourtDefenseSideStepIndex(exit.payload, "5", "front")).toBe(exit.stepIndex);
    expect(getCourtDefenseSideStepIndex(exit.payload, "4", "front")).toBe(entry.stepIndex);
    expect(getCourtDefenseSideStepIndex(entry.payload, "5", "front")).toBe(-1);
  });

  it("builds a middle attack with central contact, independent blocking and alternatives to both sides", () => {
    const entry = ensureCourtDefenseStep(newCourtBoard(), "4", "front");
    const middle = ensureCourtDefenseStep(entry.payload, "1", "front");
    const exit = ensureCourtDefenseStep(middle.payload, "5", "front");
    expect(exit.payload.timeline.steps[entry.stepIndex]).toEqual(entry.payload.timeline.steps[entry.stepIndex]);
    const start = sampleCourtSimulation(exit.payload, middle.stepIndex, 0)!;
    const contact = sampleCourtSimulation(exit.payload, middle.stepIndex, start.attackContact!)!;
    expect(contact.config.preset).toBe("1");
    expect(Math.abs(contact.ball[0])).toBeLessThan(1);
    const setter = contact.defenseSupport!.find(actor => actor.role === "setter")!;
    expect(Math.abs(contact.actors[6].position[0] - setter.position[0])).toBeGreaterThan(.7);
    const blockers = contact.actors.filter(actor => actor.role === "blocker");
    expect(blockers).toHaveLength(2);
    expect(Math.abs(blockers[0].position[0] + blockers[1].position[0])).toBeLessThan(1);
    const frame = buildCourtPerspectiveFrame(exit.payload, middle.stepIndex, 1);
    const ends = frame.drawings.filter(drawing => drawing.startBallId).map(drawing => drawing.points.at(-1)!.x);
    expect(ends.some(x => x < -2)).toBe(true);
    expect(ends.some(x => x > 2)).toBe(true);
    expect(frame.drawings.find(drawing => drawing.id === DEFENSE_BLOCK_SHADOW_ID)!.points.some(pt => pt.x < 0)).toBe(true);
    expect(getCourtDefenseSideStepIndex(exit.payload, "1", "zone1")).toBe(middle.stepIndex);
  });

  it("keeps 3D descent guides for old areas that match the projection from the outer hands", () => {
    const { payload, stepIndex } = setup();
    const sample = sampleCourtSimulation(payload, stepIndex, 1)!;
    const [right, left] = sample.actors.filter(actor => actor.role === "blocker");
    const { points, rays } = projectCourtBlockShadow(sample.ball, sample.actors);
    const shadow = frameDrawings(payload, stepIndex).find(drawing => drawing.id === DEFENSE_BLOCK_SHADOW_ID)!;
    const projected = changeDrawings(payload, stepIndex, frameDrawings(payload, stepIndex).map(drawing => drawing === shadow ? { ...drawing, points } : drawing));
    expect(points.length).toBeGreaterThanOrEqual(3);
    expect(points.every(point => point.x >= 0 && point.x <= 1 && point.y >= .5 && point.y <= 1)).toBe(true);
    expect(rays[0][0].x).toBeCloseTo(left.position[0] - .95 * .245);
    expect(rays[1][0].x).toBeCloseTo(right.position[0] + .95 * .245);
    for (const [hand, end] of rays) {
      expect(hand.y).toBeCloseTo(2.807);
      expect(end.y).toBeLessThan(hand.y);
      expect(end.z).toBeGreaterThan(hand.z);
      const ratio = (end.z - hand.z) / (hand.z - sample.ball[2]);
      expect(end.x - hand.x).toBeCloseTo(ratio * (hand.x - sample.ball[0]));
      expect(end.y - hand.y).toBeCloseTo(ratio * (hand.y - sample.ball[1]));
    }
    const guideIds = (board: typeof payload, progress: number) =>
      buildCourtPerspectiveFrame(board, stepIndex, progress).simulation?.paths.map(path => path.id);
    expect(guideIds(projected, .5)).not.toContain("defense-shadow-ray-0");
    expect(guideIds(projected, 1)).toContain("defense-shadow-ray-0");

    const edited = setCourtAreaVertex(projected, stepIndex, shadow.id, 0, { x: .65, y: .58 }, 1);
    expect(frameDrawings(edited, stepIndex).find(drawing => drawing.id === shadow.id)?.points[0]).toEqual({ x: .65, y: .58 });
    expect(guideIds(edited, 1)).not.toContain("defense-shadow-ray-0");
    expect(ensureCourtDefenseStep(edited).payload).toBe(edited);
  });

  it("passes from six to the setter at three and starts the defensive shift on set release in both projections", () => {
    const { payload, stepIndex } = setup();
    const snapshot = JSON.stringify(payload);
    const start = sampleCourtSimulation(payload, stepIndex, 0)!;
    const beforeSet = sampleCourtSimulation(payload, stepIndex, start.setContact! - .001)!;
    const atSet = sampleCourtSimulation(payload, stepIndex, start.setContact!)!;
    const afterSet = sampleCourtSimulation(payload, stepIndex, .58)!;
    const [passer, setter] = start.defenseSupport!;
    expect(simulationFloorPoint(passer.position).x).toBe(.5);
    expect(simulationFloorPoint(passer.position).y).toBeCloseTo(.15);
    expect(simulationFloorPoint(setter.position)).toEqual({ x: .5, y: .5 - 1.05 / 18 });
    expect(start.ball[0]).toBe(passer.position[0]);
    expect(Math.abs(start.ball[2] - passer.position[2])).toBeLessThan(1);
    expect(Math.abs(atSet.ball[2] - setter.position[2])).toBeLessThan(.05);
    expect(atSet.defenseSupport![1].pose).toBe("contact");
    expect(beforeSet.actors[6].position).not.toEqual(start.actors[6].position);
    start.actors.slice(0, 6).forEach((actor, index) => {
      expect(beforeSet.actors[index].position).toEqual(actor.position);
      expect(atSet.actors[index].position).toEqual(actor.position);
      expect(afterSet.actors[index].position).not.toEqual(actor.position);
    });
    const opening = buildCourtPerspectiveFrame(payload, stepIndex, 0, ["defense-illustration-setter"]);
    const ending = buildCourtPerspectiveFrame(payload, stepIndex, 1);
    expect(opening.actors.filter(actor => actor.illustration).map(actor => actor.label)).toEqual(["P6", "L3"]);
    expect(opening.selected).toEqual([]);
    expect(opening.simulation!.paths).toEqual(ending.simulation!.paths.filter(path => !path.id.startsWith("defense-shadow-ray-")));
    expect(opening.simulation!.paths[0].points.at(-1)).toEqual(opening.simulation!.paths[1].points[0]);
    expect(opening.simulation!.paths[1].points.at(-1)).toEqual(ending.simulation!.ball);
    const facingAt = (progress: number) => sampleCourtSimulation(payload, stepIndex, progress)!.actors[6].facing;
    expect(facingAt(.93)).toEqual(facingAt(.94));
    for (const progress of [0, start.setContact!, .58, start.attackContact! - .001, start.attackContact!, 1]) {
      const frame = buildCourtPerspectiveFrame(payload, stepIndex, progress);
      const drawings = displayCourtDrawings(payload, stepIndex, progress);
      const { x, y, z } = frame.simulation!.ball;
      expect(drawings.find(drawing => drawing.id === start.ballId)!.points[0]).toEqual(simulationFloorPoint([x, y, z]));
      const expected = progress < start.attackContact! ? [] : ending.drawings.filter(drawing => drawing.startBallId);
      expect(frame.drawings.filter(drawing => drawing.startBallId)).toEqual(expected.map(drawing => ({
        ...drawing, trajectoryHandles: expect.any(Array), ...(progress === start.attackContact ? { traceProgress: 0 } : {}),
      })));
      const alternatives = drawings.filter(drawing => drawing.startBallId);
      expect(alternatives.map(drawing => drawing.id)).toEqual(expected.map(drawing => drawing.id));
      alternatives.forEach(drawing => expect(drawing.points[0]).toEqual(simulationFloorPoint(start.defenseContact!)));
    }
    expect(JSON.stringify(payload)).toBe(snapshot);
  });

  it.each(["4", "5"] as const)("reveals the same transient trajectory progress in 2D and 3D for defense preset %s", preset => {
    const { payload, stepIndex } = ensureCourtDefenseStep(newCourtBoard(), preset);
    const sample = sampleCourtSimulation(payload, stepIndex, 0)!;
    const contact = sample.attackContact!;
    const flat = (t: number) => displayCourtDrawings(payload, stepIndex, t).filter(drawing => drawing.startBallId === sample.ballId);
    const perspective = (t: number) => buildCourtPerspectiveFrame(payload, stepIndex, t).drawings.filter(drawing => drawing.startBallId === sample.ballId);
    const final = perspective(1);
    expect(final).toHaveLength(3);
    for (const start of [flat, perspective]) {
      expect(start(contact - .001)).toHaveLength(0);
      expect(start(contact).map(drawing => drawing.traceProgress)).toEqual([0, 0, 0]);
      for (const fraction of [.25, .5, .75, .25]) {
        const drawings = start(contact + (1 - contact) * fraction);
        expect(drawings.map(drawing => drawing.id)).toEqual(final.map(drawing => drawing.id));
        drawings.forEach(drawing => expect(drawing.traceProgress).toBeCloseTo(fraction, 12));
      }
      expect(start(1).every(drawing => drawing.traceProgress === undefined)).toBe(true);
    }
    expect(perspective(contact + (1 - contact) / 2).map(drawing => drawing.points)).toEqual(final.map(drawing => drawing.points));
    expect(final.every(drawing => drawing.trajectoryHandles?.length === 3)).toBe(true);
  });

  it("keeps the contact clock and resumes the extended reveal at the selected speed", () => {
    const { payload, stepIndex } = setup();
    const contact = sampleCourtSimulation(payload, stepIndex, 0)!.attackContact!;
    for (const speed of [.5, 1, 2]) {
      const duration = 2600 / speed;
      const clock = defensePlaybackClock(duration, speed);
      expect(clock.elapsedAt(.38)).toBeCloseTo(.38 * duration);
      expect(clock.elapsedAt(contact)).toBeCloseTo(contact * duration);
      expect(clock.elapsedAt(1) - clock.elapsedAt(contact)).toBeCloseTo(400 / speed);
      expect(clock.progressAt(clock.elapsedAt(.97))).toBeCloseTo(.97);
      expect(clock.progressAt(clock.elapsedAt(.97) + 100 / speed)).toBeCloseTo(.985);
      expect(clock.progressAt(clock.elapsedAt(1) + 100)).toBe(1);
    }
    const long = defensePlaybackClock(10000, 1);
    expect(long.elapsedAt(1)).toBeCloseTo(10000);
  });

  it("prepares both blockers on the floor and synchronizes their jump and hands with attack contact", () => {
    const { payload, stepIndex } = setup();
    const blockersAt = (progress: number) => sampleCourtSimulation(payload, stepIndex, progress)!.actors.filter(actor => actor.role === "blocker");
    for (const progress of [0, .5, .72, .78, .82]) {
      const blockers = blockersAt(progress);
      expect(blockers).toHaveLength(2);
      blockers.forEach(actor => { expect(actor.position[1]).toBe(0); expect(actor.jump).toBe(0); });
    }
    blockersAt(.78).forEach(actor => expect(actor.crouch).toBeGreaterThan(.2));
    blockersAt(.9).forEach(actor => { expect(actor.jump).toBeGreaterThan(0); expect(actor.jump).toBeLessThan(.85); });
    expect(sampleCourtSimulation(payload, stepIndex, .93)!.actors.find(actor => actor.role === "attacker")!.pose).toBe("draw");
    for (const progress of [.94, 1]) {
      const sample = sampleCourtSimulation(payload, stepIndex, progress)!;
      expect(sample.actors.find(actor => actor.role === "attacker")!.pose).toBe("contact");
      for (const actor of sample.actors.filter(item => item.role === "blocker")) {
        expect(actor.jump).toBe(.85); expect(actor.extension).toBe(1);
        // Both palms in blocker-rig share this local Y. Include the top tape's
        // half-thickness, not merely the net's 2.43 m center line.
        const palmsY = actor.position[1] + actor.jump + .95 * (1.43 - actor.crouch! + .12 + .51 * actor.extension!);
        expect(palmsY).toBeGreaterThan(2.43 + .065 / 2);
      }
      expect(sample.actors.filter(actor => actor.role !== "blocker").every(actor => actor.jump === 0)).toBe(true);
    }
    expect(blockersAt(0).every(actor => actor.jump === 0 && actor.extension === 0)).toBe(true);
  });

  it("keeps the jump separate from authored elevation and leaves the document, floor projection and ball unchanged", () => {
    const { payload, stepIndex } = setup(), id = payload.timeline.steps[stepIndex].simulation!.actorIds[1];
    const elevated = setCourtSelectionElevation(payload, stepIndex, [id], 1.15), before = JSON.stringify(elevated);
    const drawings = JSON.stringify(frameDrawings(elevated, stepIndex));
    for (const progress of [0, .78, .9, .94, 1]) {
      const sample = sampleCourtSimulation(elevated, stepIndex, progress)!;
      const original = sampleCourtSimulation(payload, stepIndex, progress)!;
      expect(sample.actors.map(actor => simulationFloorPoint(actor.position))).toEqual(original.actors.map(actor => simulationFloorPoint(actor.position)));
      expect(sample.ball).toEqual(original.ball);
      expect(displayCourtDrawings(elevated, stepIndex, progress)).toEqual(displayCourtDrawings(payload, stepIndex, progress));
    }
    const actor = buildCourtPerspectiveFrame(elevated, stepIndex, 1).actors.find(item => item.id === id)!;
    expect(actor.elevation).toBe(1.15); expect(actor.position.y).toBe(1.15); expect(actor.jump).toBe(.85);
    expect(actor.position.y + actor.jump).toBe(2);
    expect(JSON.stringify(elevated)).toBe(before);
    expect(JSON.stringify(frameDrawings(elevated, stepIndex))).toBe(drawings);
  });

  it("faces the blocking hands toward the net from either half without changing the saved formation", () => {
    const { payload, stepIndex } = setup();
    for (const oppositeHalf of [false, true]) {
      const board = structuredClone(payload), step = board.timeline.steps[stepIndex];
      if (oppositeHalf) for (const position of Object.values(step.actorPositions)) position.y = 1 - position.y;
      const before = JSON.stringify(board), frame = buildCourtPerspectiveFrame(board, stepIndex, 1);
      const blockers = frame.actors.filter(actor => actor.poseRole === "blocker");
      expect(blockers).toHaveLength(2);
      for (const actor of blockers) {
        expect(actor.handAngle).toBe(oppositeHalf ? 0 : 180);
        const palmsZ = actor.position.z + Math.cos(actor.handAngle! * Math.PI / 180) * .95 * .44;
        expect(Math.abs(palmsZ)).toBeLessThan(Math.abs(actor.position.z));
        expect(actor.jump).toBe(.85);
      }
      expect(JSON.stringify(board)).toBe(before);
    }
  });

  it("isolates team conflicts while preserving previous actors and remapping the complete Defense stage", () => {
    const { payload, stepIndex } = setup();
    const authored = { ...payload, timeline: { steps: payload.timeline.steps.slice(0, stepIndex) } };
    authored.editor!.actorMeta["height-player"].team = "B";
    authored.editor!.actorMeta["circle-player"].team = "A";
    const before = JSON.stringify(authored), next = ensureCourtDefenseStep(authored).payload;
    expect(next.editor!.actorMeta["height-player"].team).toBe("B");
    expect(next.editor!.actorMeta["circle-player"].team).toBe("A");
    expect(next.actors.slice(0, authored.actors.length)).toEqual(authored.actors);
    expect(JSON.stringify(authored)).toBe(before);
    expect(next.timeline.steps.slice(0, stepIndex)).toEqual(authored.timeline.steps);
    const stage = next.timeline.steps[stepIndex], ids = stage.simulation!.actorIds;
    expect(ids[0]).not.toBe("height-player"); expect(ids[6]).not.toBe("circle-player");
    expect(stage.simulation!.teamActorIds).toEqual(ids.slice(0, 6));
    expect(stage.visibleActorIds).toEqual(ids);
    expect(Object.keys(stage.actorPositions).sort()).toEqual([...ids].sort());
    expect(Object.keys(stage.simulation!.defenseSettings!.startPositions).sort()).toEqual([...ids].sort());
    expect(Object.keys(stage.actorActions!).sort()).toEqual([...ids].sort());
    expect(stage.actorPositions[ids[0]]).toEqual(expected["height-player"]);
    expect(stage.actorPositions[ids[6]]).toEqual(expected["circle-player"]);
    expect(stage.baselineActorPositions).toEqual(stage.actorPositions);
    expect(stage.actorElevations).toEqual({ [ids[6]]: 1.006326834602263 });
    ids.forEach((actorId, slot) => expect(next.editor!.actorMeta[actorId].team).toBe(slot === 6 ? "B" : "A"));
    for (const [slot, oldId] of [[0, "height-player"], [6, "circle-player"]] as const) {
      expect(next.actors.find(actor => actor.id === ids[slot])).toEqual({ ...authored.actors.find(actor => actor.id === oldId), id: ids[slot] });
    }
    expect(resolveCourtLayers(next, stepIndex).filter(ref => ref.kind === "actor").map(ref => ref.id).sort()).toEqual([...ids].sort());
    expect(sampleCourtSimulation(next, stepIndex, 1)!.actors).toHaveLength(7);
    expect(frameDrawings(next, stepIndex)).toEqual(frameDrawings(payload, stepIndex));
    expect(ensureCourtDefenseStep(next).payload).toBe(next);
  });

  it("keeps compatible actor identities and isolates hidden or locked actors with unique IDs", () => {
    const { payload, stepIndex } = setup();
    const authored = { ...payload, timeline: { steps: payload.timeline.steps.slice(0, stepIndex) } };
    expect(ensureCourtDefenseStep(authored).payload.timeline.steps[stepIndex].simulation!.actorIds).toEqual(payload.timeline.steps[stepIndex].simulation!.actorIds);
    const actor = authored.actors.find(item => item.id === "height-player")!;
    authored.actors = [...authored.actors, { ...actor, id: "defense-height-player" }];
    authored.editor!.actorMeta["height-player"] = { team: "A", hidden: true, locked: true };
    const next = ensureCourtDefenseStep(authored).payload, ids = next.timeline.steps[stepIndex].simulation!.actorIds;
    expect(ids[0]).toBe("defense-height-player-2");
    expect(next.editor!.actorMeta["height-player"]).toEqual({ team: "A", hidden: true, locked: true });
    expect(next.editor!.actorMeta[ids[0]]).toMatchObject({ team: "A", hidden: false, locked: false });
    expect(buildCourtPerspectiveFrame(next, stepIndex, 1).actors.filter(actor => !actor.illustration)).toHaveLength(7);
  });

  it("repairs the imported default-A opponent only in the appended Defense stage", () => {
    const { payload, stepIndex } = setup();
    payload.timeline.steps = payload.timeline.steps.slice(0, stepIndex);
    delete payload.editor!.actorMeta["circle-player"];
    const imported = parseEditorImport(JSON.stringify({ format: "goatleta-court", version: 1, payload }));
    expect(imported.editor!.actorMeta["circle-player"].team).toBe("A");
    const next = ensureCourtDefenseStep(imported), stage = next.payload.timeline.steps[next.stepIndex], opponent = stage.simulation!.actorIds[6];
    expect(opponent).not.toBe("circle-player");
    expect(next.payload.editor!.actorMeta[opponent].team).toBe("B");
    expect(next.payload.editor!.actorMeta["circle-player"].team).toBe("A");
    const restored = parseEditorImport(JSON.stringify({ format: "goatleta-court", version: 1, payload: next.payload }));
    expect(restored.timeline.steps[next.stepIndex].simulation!.actorIds).toEqual(stage.simulation!.actorIds);
    expect(sampleCourtSimulation(restored, next.stepIndex, 1)!.actors.find(actor => actor.id === opponent)!.position[1]).toBe(1.006326834602263);
  });

  it.each([NaN, Infinity, -1, 9, "1"])("rejects invalid authored elevation %s when sampling persisted Defense", value => {
    const { payload, stepIndex } = setup();
    payload.timeline.steps[stepIndex].actorElevations!["circle-player"] = value as number;
    frameDrawings(payload, stepIndex).find(drawing => drawing.id === "anchor-ball")!.elevation = value as number;
    const sample = sampleCourtSimulation(payload, stepIndex, 1)!;
    expect(sample.actors.find(actor => actor.id === "circle-player")!.position[1]).toBe(0);
    expect(sample.ball[1]).toBe(.12);
  });

  it("edits final authored heights and linked ball positions without detaching Defense or its alternatives", () => {
    const { payload, stepIndex } = setup();
    const initial = buildCourtPerspectiveFrame(payload, stepIndex, 0), final = buildCourtPerspectiveFrame(payload, stepIndex, 1);
    expect(initial.actors.every(actor => actor.simulated)).toBe(true);
    expect(final.actors.filter(actor => !actor.illustration).every(actor => actor.simulated === false && actor.elevation !== undefined)).toBe(true);
    expect(final.drawings.find(drawing => drawing.id === "anchor-ball")!.simulated).toBe(false);
    expect(courtTrajectoryHeightTargets(payload, stepIndex, "anchor-arrow-a", 0)[0].editable).toBe(false);
    expect(courtTrajectoryHeightTargets(payload, stepIndex, "anchor-arrow-a", 1)[0].editable).toBe(true);
    const raised = setCourtSelectionElevation(payload, stepIndex, ["circle-player"], 1.25);
    expect(sampleCourtSimulation(raised, stepIndex, 1)!.actors.find(actor => actor.id === "circle-player")!.position[1]).toBe(1.25);
    const moved = setCourtTrajectoryPoint(raised, stepIndex, "anchor-arrow-a", "start", { x: 3.5, y: 3.5, z: -1 }, false, 1);
    expect(getCourtSimulation(moved, stepIndex)!.mode).toBe("defense");
    const sampled = sampleCourtSimulation(moved, stepIndex, 1)!;
    expect(sampled.ball[0]).toBeCloseTo(3.5); expect(sampled.ball[1]).toBe(3.5); expect(sampled.ball[2]).toBeCloseTo(-1);
    const arrows = buildCourtPerspectiveFrame(moved, stepIndex, 1).drawings.filter(drawing => drawing.startBallId);
    expect(arrows).toHaveLength(3);
    for (const arrow of arrows) expect(arrow.points[0]).toEqual({ x: sampled.ball[0], y: sampled.ball[1], z: sampled.ball[2] });
  });

  it("roundtrips bounded actions, starts and authored drawings through local and shared parsers", () => {
    const { payload, stepIndex } = setup();
    for (const copy of [parseCourtVisualPayload(serializeCourtVisualPayload(payload)), parseEditorImport(JSON.stringify({ format: "goatleta-court", version: 1, payload }))]) {
      expect(copy.timeline.steps[stepIndex].actorActions).toEqual(payload.timeline.steps[stepIndex].actorActions);
      expect(copy.timeline.steps[stepIndex].simulation!.defenseSettings).toEqual(payload.timeline.steps[stepIndex].simulation!.defenseSettings);
      expect(sampleCourtSimulation(copy, stepIndex, 1)!.actors.map(actor => actor.position)).toEqual(sampleCourtSimulation(payload, stepIndex, 1)!.actors.map(actor => actor.position));
      expect(frameDrawings(copy, stepIndex).map(drawing => drawing.startBallId)).toEqual(frameDrawings(payload, stepIndex).map(drawing => drawing.startBallId));
    }
    const config = getCourtSimulation(payload, stepIndex)!;
    expect(normalizeCourtSimulation({ ...config, defenseSettings: undefined })).toBeNull();
    expect(normalizeCourtSimulation({ ...config, defenseSettings: { startPositions: { ...config.defenseSettings!.startPositions, "circle-player": { x: NaN, y: .4 } } } })).toBeNull();
    const bad = structuredClone(payload);
    bad.timeline.steps[stepIndex].actorActions = { "circle-player": "invalid" as CourtActorAction, absent: "attack", "height-player": "defend" };
    const sanitized = parseEditorImport(JSON.stringify({ format: "goatleta-court", version: 1, payload: bad }));
    expect(sanitized.timeline.steps[stepIndex].actorActions).toEqual({ "height-player": "defend" });
  });

  it.each(["ready", "defend", "block", "attack", "set", "serve"] as const)("edits action %s without changing a role or final position", action => {
    const { payload, stepIndex } = setup(), id = "height-player";
    const next = setCourtActorAction(payload, stepIndex, [id], action);
    expect(next.actors).toBe(payload.actors);
    expect(next.timeline.steps[stepIndex].actorPositions).toBe(payload.timeline.steps[stepIndex].actorPositions);
    expect(next.timeline.steps[stepIndex].actorActions![id]).toBe(action);
    expect(setCourtActorAction(next, stepIndex, [id], action)).toBe(next);
    expect(setCourtActorAction(next, stepIndex, [id], undefined).timeline.steps[stepIndex].actorActions?.[id]).toBeUndefined();
    const frame = buildCourtPerspectiveFrame(next, stepIndex, 1).actors.find(actor => actor.id === id)!;
    expect(frame.poseRole).toBe(action === "block" ? "blocker" : action === "attack" ? "attacker" : action === "defend" ? "passer" : action === "serve" ? "server" : "setter");
    expect(frame.jump).toBe(action === "block" ? .85 : 0);
  });

  it("respects protected selections and leaves Receive/Attack actions controlled by their engines", () => {
    const { payload, stepIndex } = setup();
    payload.editor!.actorMeta["height-player"].locked = true;
    expect(setCourtActorAction(payload, stepIndex, ["height-player"], "serve")).toBe(payload);
    const receive = configureCourtSimulation(payload, 0, { mode: "receive" }), config = getCourtSimulation(receive, 0)!;
    expect(setCourtActorAction(receive, 0, [config.actorIds[0]], "attack")).toBe(receive);
    expect(configureCourtSimulation(payload, stepIndex, { mode: "attack" })).toBe(payload);
    expect(updateCourtSimulationHandle(payload, stepIndex, { kind: "hit", point: { x: .5, y: .5 } })).toBe(payload);
  });

  it("keeps actions with duplication and clipboard while editing a destination preserves defensive starts", () => {
    const { payload, stepIndex } = setup(), id = "height-player";
    const changed = setCourtActorAction(payload, stepIndex, [id], "block");
    const duplicate = duplicateSelection(changed, stepIndex, [id]);
    expect(duplicate.payload.timeline.steps[stepIndex].actorActions![duplicate.selected[0]]).toBe("block");
    const copied = duplicateStep(changed, stepIndex);
    const newIndex = copied.stepIndex;
    expect(copied.payload.timeline.steps[newIndex].simulation!.defenseSettings).toEqual(changed.timeline.steps[stepIndex].simulation!.defenseSettings);
    expect(sampleCourtSimulation(copied.payload, newIndex, 1)).not.toBeNull();
    const clipboard = copyStepSelection(changed, stepIndex, [id]);
    const pasted = pasteStepSelection(changed, 0, clipboard).payload;
    expect(pasted.timeline.steps[0].actorActions![id]).toBe("block");
    const moved = moveSelection(changed, stepIndex, [id], { x: .01, y: -.02 }, false, undefined, 1);
    expect(moved.timeline.steps[stepIndex].simulation).toEqual(changed.timeline.steps[stepIndex].simulation);
    expect(moved.timeline.steps[stepIndex].actorPositions[id].x).toBeCloseTo(expected[id].x + .01);
  });
});
