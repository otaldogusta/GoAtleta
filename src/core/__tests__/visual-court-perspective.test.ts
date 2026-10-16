import { buildCourtPerspectiveFrame, courtPointToWorld, worldToCourtPoint } from "../visual-court-perspective";
import { actorPoint, changeDrawings, moveSelection, newCourtBoard, pointAlong } from "../visual-court-editor";
import { configureCourtSimulation, sampleCourtSimulation } from "../court-simulation";

describe("canonical court perspective projection", () => {
  it("hides role labels through the shared presentation layer without changing identities", () => {
    const board = newCourtBoard();
    board.actors[0].label = "Levantadora";
    board.editor!.hiddenLayers = ["labels"];
    const frame = buildCourtPerspectiveFrame(board, 0, 0);
    expect(frame.actors.every(actor => actor.label === "")).toBe(true);
    expect(frame.actors.map(actor => actor.id)).toEqual(board.actors.map(actor => actor.id));
  });
  it("maps the full regulation court and its net without a landscape transform", () => {
    expect(courtPointToWorld({ x: 0, y: 0 })).toEqual({ x: -4.5, y: 0, z: -9 });
    expect(courtPointToWorld({ x: 1, y: 1 })).toEqual({ x: 4.5, y: 0, z: 9 });
    expect(courtPointToWorld({ x: 0.5, y: 0.5 }, 2.43)).toEqual({ x: 0, y: 2.43, z: 0 });
    expect(courtPointToWorld({ x: 0.5, y: 1 / 3 }).z).toBeCloseTo(-3);
    expect(courtPointToWorld({ x: 0.5, y: 2 / 3 }).z).toBeCloseTo(3);
    for (const point of [{ x: -0.2, y: -0.15 }, { x: 0.18, y: 0.74 }, { x: 1.2, y: 1.15 }]) {
      const restored = worldToCourtPoint(courtPointToWorld(point));
      expect(restored.x).toBeCloseTo(point.x);
      expect(restored.y).toBeCloseTo(point.y);
    }
  });

  it("samples authored movements at the same equal-segment progress as 2D", () => {
    const board = newCourtBoard(), id = board.actors[0].id;
    const authored = moveSelection(board, 0, [id], { x: 0.3, y: -0.1 }, true, [{ x: 0, y: 0 }, { x: 0.02, y: 0.01 }, { x: 0.3, y: -0.1 }]);
    const path = authored.timeline.steps[0].trajectories![0].points;
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      const actor = buildCourtPerspectiveFrame(authored, 0, progress).actors.find(item => item.id === id)!;
      expect(actor.position).toEqual(courtPointToWorld(pointAlong(path, progress)));
      expect(actor.path).toEqual(path.map(point => courtPointToWorld(point)));
    }
    expect(buildCourtPerspectiveFrame(authored, 0, 0.5).actors[0].position).not.toEqual(courtPointToWorld(actorPoint(authored, 0, id)));
  });

  it("preserves identities, labels, colors and teacher changes with no mutation", () => {
    const board = newCourtBoard();
    board.actors[0].label = "Ponteira da turma";
    board.actors[0].color = "#abcdef";
    board.editor!.actorMeta[board.actors[0].id].locked = true;
    const before = JSON.stringify(board);
    const frame = buildCourtPerspectiveFrame(board, 0, 0, [board.actors[0].id, "hidden"]);
    expect(frame.actors[0]).toMatchObject({ id: board.actors[0].id, label: "Ponteira da turma", color: "#abcdef", locked: true, jump: 0 });
    expect(frame.selected).toEqual([board.actors[0].id]);
    expect(frame.actors).toHaveLength(board.actors.length);
    expect(JSON.stringify(board)).toBe(before);
  });

  it("follows a moving ball's canonical path without inventing a serve or contact", () => {
    const board = changeDrawings(newCourtBoard(), 0, [{ id: "ball", kind: "ball", points: [{ x: 0.7, y: 0.3 }], motion: [{ x: 0.2, y: 0.7 }, { x: 0.7, y: 0.3 }], color: "#ffff00", size: 32, rotation: 0 }]);
    expect(buildCourtPerspectiveFrame(board, 0, 0.5).drawings[0]).toMatchObject({
      id: "ball", kind: "ball", points: [courtPointToWorld(pointAlong([{ x: 0.2, y: 0.7 }, { x: 0.7, y: 0.3 }], 0.5), 0.12)],
      motion: [courtPointToWorld({ x: 0.2, y: 0.7 }, 0.12), courtPointToWorld({ x: 0.7, y: 0.3 }, 0.12)],
    });
    expect(buildCourtPerspectiveFrame(newCourtBoard(), 0, 0.5).drawings).toEqual([]);
  });

  it("projects every drawing type and only the active step's legacy materials", () => {
    const kinds = ["arrow", "curve", "pen", "area", "text", "ball", "cone", "target", "ladder"] as const;
    const board = changeDrawings(newCourtBoard(), 0, kinds.map((kind, index) => ({ id: `drawing-${index}`, kind, points: [{ x: 0.3, y: 0.6 }, { x: 0.8, y: 0.8 }], color: "#123456", size: 30, rotation: 40, text: "Treino", locked: true, dashed: true })));
    board.timeline.steps[0].arrows = [{ id: "legacy-arrow", from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }];
    board.markers = [{ id: "shown", type: "target", position: { x: 0.2, y: 0.7 } }, { id: "hidden", type: "cone", position: { x: 0.2, y: 0.7 } }];
    board.timeline.steps[0].markerIds = ["shown"];
    const frame = buildCourtPerspectiveFrame(board, 0, 0);
    expect(frame.drawings.map(drawing => drawing.id)).toEqual(["legacy-arrow", "shown", ...kinds.map((_, index) => `drawing-${index}`)]);
    expect(frame.drawings.slice(2).map(drawing => drawing.kind)).toEqual(kinds);
    expect(frame.drawings[2]).toMatchObject({ color: "#123456", text: "Treino", rotation: 40, size: 30, locked: true, dashed: true });
  });

  it("honors step visibility, layers, labels and movement visibility", () => {
    const source = newCourtBoard(), id = source.actors[0].id;
    const board = moveSelection(source, 0, [id], { x: 0.1, y: 0.1 }, true);
    board.timeline.steps[0].visibleActorIds = [id];
    board.editor!.showActorNumbers = false;
    board.editor!.hiddenLayers = ["movements", "court"];
    const frame = buildCourtPerspectiveFrame(board, 0, 0.5);
    expect(frame.actors).toHaveLength(1);
    expect(frame.actors[0].label).toBe("");
    expect(frame.actors[0].path).toEqual([]);
    expect(frame.court).toBe(false);
    expect(frame.net).toBe(false);
    board.editor!.hiddenLayers = ["actors", "drawings"];
    expect(buildCourtPerspectiveFrame(board, 0, 0, [id])).toMatchObject({ actors: [], drawings: [], selected: [] });
  });

  it("falls back to transitions and retains explicit team colors without assigning new actors", () => {
    const board = newCourtBoard(), actor = board.actors[6];
    delete actor.color;
    const step = board.timeline.steps[0];
    step.phase = "attack_shape";
    actor.isFrontRow = true;
    step.transitions = [{ id: "transition", actorId: actor.id, points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }] }];
    const frame = buildCourtPerspectiveFrame(board, 0, 0.5);
    expect(frame.actors[6]).toMatchObject({ color: "#4389ff", position: courtPointToWorld(pointAlong(step.transitions[0].points, 0.5)), poseRole: "blocker", pose: "ready", jump: 0 });
    expect(frame.actors).toHaveLength(board.actors.length);
    expect(frame.phase).toBe("attack_shape");
  });
});

describe("canonical simulation in the perspective frame", () => {
  it("keeps the intended attack curve editable independently of contacts, floor targets and blockers", () => {
    const preset = configureCourtSimulation(newCourtBoard(), 0, { mode: "attack", preset: "pipe" });
    const board = configureCourtSimulation(preset, 0, { attackSettings: { attackArc: 1.5 } });
    const timing = sampleCourtSimulation(board, 0, 0)!, frame = buildCourtPerspectiveFrame(board, 0, 0).simulation!;
    const intent = frame.paths.find(path => path.id === "attack-intent")!;
    const handle = frame.handles.find(handle => handle.kind === "attack")!;
    const asPoint = (p: number[]) => ({ x: p[0], y: p[1], z: p[2] });
    expect(handle.value).toBe(1.5);
    expect(handle.point).toEqual(intent.points[32]);
    expect(intent.points[0]).toEqual(asPoint(timing.flight!.hit));
    for (const axis of ["x", "y", "z"] as const) expect(intent.points[64][axis]).toBeCloseTo(asPoint(timing.attackTarget!)[axis], 9);
    expect(handle.point.y).toBeCloseTo((timing.flight!.hit[1] + timing.attackTarget![1]) / 2 + 1.5, 9);
    const disabled = configureCourtSimulation(board, 0, { layers: { attack: false } });
    const hidden = buildCourtPerspectiveFrame(disabled, 0, 0).simulation!;
    expect(hidden.handles.some(handle => handle.kind === "attack")).toBe(false);
    expect(hidden.paths.some(path => path.id === "attack-intent")).toBe(false);
    expect(hidden.handles.some(handle => handle.kind === "hit")).toBe(true);
  });

  it("projects exact sampled motion, jump, pose and hand parameters with canonical identities", () => {
    const board = configureCourtSimulation(newCourtBoard(), 0, { mode: "attack", blockers: 3, attackSettings: { blockAngle: 30 } });
    const before = JSON.stringify(board), timing = sampleCourtSimulation(board, 0, 0)!;
    for (const progress of [0, .12, timing.setContact!, timing.attackContact!, .9, 1]) {
      const sampled = sampleCourtSimulation(board, 0, progress)!;
      const frame = buildCourtPerspectiveFrame(board, 0, progress);
      for (const state of sampled.actors.filter(actor => actor.visible)) {
        const actor = frame.actors.find(item => item.id === state.id)!;
        expect(actor).toMatchObject({ position: { x: state.position[0], y: state.position[1], z: state.position[2] }, poseRole: state.role, pose: state.pose, jump: state.jump, side: state.side });
        if (state.role === "blocker") expect(actor).toMatchObject({ crouch: state.crouch, extension: state.extension, handAngle: 30 });
      }
      expect(frame.drawings.find(drawing => drawing.id === sampled.ballId)).toMatchObject({ simulated: true, points: [{ x: sampled.ball[0], y: sampled.ball[1], z: sampled.ball[2] }] });
      expect(frame.simulation?.duration).toBe(sampled.duration);
      expect(frame.simulation?.elapsedSeconds).toBe(sampled.elapsedSeconds);
    }
    expect(JSON.stringify(board)).toBe(before);
  });

  it("samples guide endpoints at the real pass, set and attack contacts and caches geometry", () => {
    const board = configureCourtSimulation(newCourtBoard(), 0, { mode: "attack", blockers: 2 });
    const timing = sampleCourtSimulation(board, 0, 0)!, first = buildCourtPerspectiveFrame(board, 0, 0).simulation!;
    const pass = first.paths.find(path => path.id === "pass")!, set = first.paths.find(path => path.id === "set")!;
    const at = (progress: number) => { const ball = sampleCourtSimulation(board, 0, progress)!.ball; return { x: ball[0], y: ball[1], z: ball[2] }; };
    expect(pass.points[0]).toEqual(at(timing.passContact!));
    expect(pass.points[pass.points.length - 1]).toEqual(at(timing.setContact!));
    expect(set.points[0]).toEqual(at(timing.setContact!));
    expect(set.points[set.points.length - 1]).toEqual(at(timing.attackContact!));
    expect(first.handles.find(handle => handle.kind === "hit")?.point).toEqual(set.points[set.points.length - 1]);
    expect(first.walls).toHaveLength(2);
    const replay = buildCourtPerspectiveFrame(board, 0, .8).simulation!;
    expect(replay.paths).toBe(first.paths);
    expect(replay.markers).toBe(first.markers);
    expect(JSON.parse(JSON.stringify(replay))).toMatchObject({ guideKey: first.guideKey, mode: "attack" });
  });

  it("keeps author-created objects while hiding only unused simulation slots", () => {
    const source = newCourtBoard();
    source.actors.push({ id: "teacher-extra", label: "Apoio", role: "athlete", initialPosition: { x: .9, y: .9 } });
    source.timeline.steps[0].visibleActorIds?.push("teacher-extra");
    const simulated = configureCourtSimulation(source, 0, { mode: "attack", blockers: 1 });
    const board = changeDrawings(simulated, 0, [
      ...(simulated.editor!.drawings[source.timeline.steps[0].id] ?? []),
      { id: "teacher-cone", kind: "cone", points: [{ x: .3, y: .9 }], color: "#ff0000", size: 30, rotation: 0 },
    ]);
    const sampled = sampleCourtSimulation(board, 0, 0)!, frame = buildCourtPerspectiveFrame(board, 0, 0);
    expect(frame.actors.find(actor => actor.id === "teacher-extra")).toBeDefined();
    expect(frame.drawings.find(drawing => drawing.id === "teacher-cone")).toBeDefined();
    for (const actor of sampled.actors.filter(item => !item.visible)) expect(frame.actors.find(item => item.id === actor.id)).toBeUndefined();
  });

  it("gates reception guides at contact and restores visibility without another simulation", () => {
    const board = configureCourtSimulation(newCourtBoard(), 0, { mode: "receive", landingOverride: { x: 2, z: 4 } });
    const start = buildCourtPerspectiveFrame(board, 0, 0).simulation!;
    expect(start.guidesVisible).toBe(true);
    expect(start.handles).toEqual([{ kind: "serve", point: { x: 2, y: .03, z: 4 } }]);
    expect(buildCourtPerspectiveFrame(board, 0, .64).simulation?.guidesVisible).toBe(false);
    const hidden = { ...board, editor: { ...board.editor!, hiddenLayers: ["movements"] } };
    expect(buildCourtPerspectiveFrame(hidden, 0, 0).simulation?.guidesVisible).toBe(false);
    expect(buildCourtPerspectiveFrame(board, 0, 0).simulation?.guidesVisible).toBe(true);
  });
});
