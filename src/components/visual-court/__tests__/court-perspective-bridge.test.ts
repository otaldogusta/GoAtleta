import type { CourtVisualPayload } from "../../../core/visual-court";
import { frameDrawings, newCourtBoard, setCourtAreaVertex } from "../../../core/visual-court-editor";
import { ensureCourtDefenseStep } from "../../../core/court-defense-preset";
import { configureCourtSimulation } from "../../../core/court-simulation";
import { parseCourtPerspectiveCommand, type CourtPerspectiveCommandContext } from "../court-perspective-bridge";

function fixture(): CourtVisualPayload {
  const base = newCourtBoard();
  return {
    ...base,
    actors: [
      { id: "setter", label: "Lv", role: "setter", initialPosition: { x: 0.7, y: 0.6 } },
      { id: "middle", label: "C", role: "middle", initialPosition: { x: 0.5, y: 0.6 } },
      { id: "other-step-player", label: "P", role: "outside", initialPosition: { x: 0.2, y: 0.7 } },
    ],
    editor: { ...base.editor!, actorMeta: {}, drawings: {
      first: [
        { id: "ball", kind: "ball", points: [{ x: 0.3, y: 0.6 }], color: "#ffffff", size: 32, rotation: 0 },
        { id: "note", kind: "text", points: [{ x: 0.2, y: 0.6 }], color: "#ffffff", text: "Passe", size: 32, rotation: 0 },
      ],
      second: [{ id: "other-step-ball", kind: "ball", points: [{ x: 0.2, y: 0.3 }], color: "#ffffff", size: 32, rotation: 0 }],
    } },
    timeline: { steps: [
      { id: "first", label: "Recepção", durationMs: 1600, visibleActorIds: ["setter", "middle"], actorPositions: { setter: { x: 0.7, y: 0.6 }, middle: { x: 0.5, y: 0.6 } } },
      { id: "second", label: "Ataque", durationMs: 1600, actorPositions: {} },
    ] },
  };
}

const envelope = (command: Record<string, unknown>) => ({ channel: "goatleta-court-3d", version: 1, token: "frame-token", revision: 4, ...command });
function parse(command: Record<string, unknown>, context: Partial<CourtPerspectiveCommandContext> = {}) {
  return parseCourtPerspectiveCommand(envelope(command), { token: "frame-token", revision: 4, payload: fixture(), stepIndex: 0, tool: "select", ...context });
}

it("commits only a valid vertex on the selected editable area and preserves the other points", () => {
  const payload = fixture();
  const area = { id: "area", kind: "area" as const, points: [{ x: .2, y: .2 }, { x: .4, y: .3 }, { x: .1, y: .5 }], color: "#ff9900", size: 32, rotation: 0, dashed: true };
  payload.editor!.drawings.first.push(area);
  const context = { payload, selected: [area.id] };
  const command = { type: "area-vertex", id: area.id, vertex: 1, point: { x: .6, y: .7 } };
  expect(parse(command, context)).toEqual(command);
  const next = setCourtAreaVertex(payload, 0, area.id, command.vertex, command.point);
  expect(frameDrawings(next, 0).at(-1)).toEqual({ ...area, points: [area.points[0], command.point, area.points[2]] });
  expect(frameDrawings(payload, 0).at(-1)).toEqual(area);
  expect(next.timeline.steps[1]).toBe(payload.timeline.steps[1]);
  expect(setCourtAreaVertex(payload, 0, area.id, 1, area.points[0])).toBe(payload);
  expect(setCourtAreaVertex(payload, 0, area.id, 1, { x: .15, y: .35 })).toBe(payload);
  for (const fields of [{ vertex: -1 }, { vertex: 3 }, { vertex: 1.5 }, { point: { x: 0, y: NaN } }, { point: { x: 0, y: 0, z: 0 } }, { revision: 3 }]) {
    expect(parse({ ...command, ...fields }, context)).toBeNull();
  }
  for (const fields of [{ disabled: true }, { selected: ["other"] }, { selected: [area.id, "ball"] }, { tool: "pan" as const }, { stepIndex: 1 }]) {
    expect(parse(command, { ...context, ...fields })).toBeNull();
  }
  const defense = ensureCourtDefenseStep(payload), shadow = { ...area, id: "shadow" };
  defense.payload.editor!.drawings[defense.payload.timeline.steps[defense.stepIndex].id].push(shadow);
  const defenseCommand = { ...command, id: shadow.id }, defenseContext = { payload: defense.payload, stepIndex: defense.stepIndex, selected: [shadow.id] };
  expect(parse(defenseCommand, { ...defenseContext, progress: .9 })).toBeNull();
  expect(parse(defenseCommand, { ...defenseContext, progress: 1 })).toEqual(defenseCommand);
  expect(setCourtAreaVertex(defense.payload, defense.stepIndex, shadow.id, 1, command.point, .9)).toBe(defense.payload);
  for (const fields of [{ locked: true }, { hidden: true }, { motion: area.points }]) {
    const guarded = { ...area, ...fields };
    payload.editor!.drawings.first[2] = guarded;
    expect(parse(command, context)).toBeNull();
    expect(setCourtAreaVertex(payload, 0, area.id, 1, command.point)).toBe(payload);
  }
});

describe("trajectory height command boundary", () => {
  const source = () => {
    const payload = fixture();
    payload.editor!.drawings.first.push({ id: "arrow", kind: "arrow", startBallId: "ball", points: [{ x: .3, y: .6 }, { x: .7, y: .2 }], color: "#ffffff", size: 32, rotation: 0 });
    return payload;
  };
  it.each(["start", "middle", "end"])("accepts only the selected visible arrow and bounded %s grip", handle => {
    const payload = source(), command = { type: "trajectory-height", id: "arrow", handle, value: 3 };
    expect(parse(command, { payload, selected: ["arrow"] })).toEqual(command);
    for (const context of [{ selected: [] }, { selected: ["ball"] }, { selected: ["arrow", "ball"] }, { tool: "animate" as const }, { disabled: true }, { revision: 5 }]) {
      expect(parse(command, { payload, selected: ["arrow"], ...context })).toBeNull();
    }
    for (const invalid of [{ value: NaN }, { value: -1 }, { value: 8.13 }, { value: "3" }, { handle: "unknown" }, { extra: true }, { id: "note" }]) {
      expect(parse({ ...command, ...invalid }, { payload, selected: ["arrow"] })).toBeNull();
    }
  });
  it("protects linked balls independently of the selected arrow", () => {
    const command = { type: "trajectory-height", id: "arrow", handle: "start", value: 3 };
    for (const fields of [{ locked: true }, { hidden: true }]) {
      const payload = source(); Object.assign(payload.editor!.drawings.first[0], fields);
      expect(parse(command, { payload, selected: ["arrow"] })).toBeNull();
      expect(parse({ ...command, handle: "middle" }, { payload, selected: ["arrow"] })).not.toBeNull();
    }
    expect(parse({ ...command, value: 0 }, { payload: source(), selected: ["arrow"] })).toBeNull();
    const hidden = source(); hidden.editor!.hiddenLayers = ["drawings"];
    expect(parse(command, { payload: hidden, selected: ["arrow"] })).toBeNull();
  });
  it.each(["start", "middle", "end"])("validates the complete XYZ point for %s with the same authoring guards", handle => {
    const payload = source(), point = { x: 1, y: 3, z: -2 }, command = { type: "trajectory-point", id: "arrow", handle, point };
    expect(parse(command, { payload, selected: ["arrow"] })).toEqual(command);
    for (const invalid of [{ ...point, x: 6.31 }, { ...point, x: -6.31 }, { ...point, z: 11.71 }, { ...point, y: 8.13 }, { ...point, y: -1 }, { ...point, x: NaN }, { ...point, y: "3" }, { x: 1, y: 2 }, { ...point, extra: 1 }, null]) {
      expect(parse({ ...command, point: invalid }, { payload, selected: ["arrow"] })).toBeNull();
    }
    for (const context of [{ selected: [] }, { selected: ["ball"] }, { selected: ["arrow", "ball"] }, { tool: "animate" as const }, { disabled: true }, { revision: 5 }]) expect(parse(command, { payload, selected: ["arrow"], ...context })).toBeNull();
    expect(parse({ ...command, extra: true }, { payload, selected: ["arrow"] })).toBeNull();
    for (const fields of [{ hidden: true }, { locked: true }]) {
      const protectedBall = source(); Object.assign(protectedBall.editor!.drawings.first[0], fields);
      expect(parse({ ...command, handle: "start" }, { payload: protectedBall, selected: ["arrow"] })).toBeNull();
    }
    expect(parse({ ...command, handle: "start", point: { ...point, y: .11 } }, { payload, selected: ["arrow"] })).toBeNull();
  });
});

describe("court perspective command boundary", () => {
  it("selects visible canonical actor/material IDs and clears selection", () => {
    expect(parse({ type: "select", ids: ["setter", "ball"] })).toEqual({ type: "select", ids: ["setter", "ball"] });
    expect(parse({ type: "select", ids: [] })).toEqual({ type: "select", ids: [] });
  });

  it.each(["foreign", "other-step-player", "other-step-ball", "__proto__"])("rejects foreign or invisible ID %s", id => {
    expect(parse({ type: "select", ids: [id] })).toBeNull();
    expect(parse({ type: "move", ids: ["setter", id], delta: { x: 0.1, y: 0.1 } })).toBeNull();
  });

  it("uses current-step visibility and never takes scene roles or positions as authority", () => {
    expect(parse({ type: "select", ids: ["other-step-player", "other-step-ball"] }, { stepIndex: 1 })).toEqual({ type: "select", ids: ["other-step-player", "other-step-ball"] });
    expect(parse({ type: "move", ids: ["setter"], delta: { x: 0.1, y: -0.1 }, role: "coach" })).toBeNull();
    expect(parse({ type: "add-player", point: { x: 0.3, y: 0.6 }, studentId: "foreign" }, { tool: "player" })).toBeNull();
  });

  it("allows selecting locked objects but rejects their movement, duplication and text editing", () => {
    const payload = fixture();
    payload.editor!.actorMeta.setter = { locked: true };
    payload.editor!.drawings.first[1].locked = true;
    expect(parse({ type: "select", ids: ["setter", "note"] }, { payload })).toEqual({ type: "select", ids: ["setter", "note"] });
    expect(parse({ type: "move", ids: ["setter"], delta: { x: 0.1, y: 0 } }, { payload })).toBeNull();
    expect(parse({ type: "move", ids: ["note"], delta: { x: 0.1, y: 0 }, duplicate: true }, { payload })).toBeNull();
    expect(parse({ type: "edit-text", id: "note" }, { payload })).toBeNull();
  });

  it.each(["actors", "drawings"])("does not edit or select hidden %s", layer => {
    const payload = fixture();
    payload.editor!.hiddenLayers = [layer];
    const id = layer === "actors" ? "setter" : "ball";
    expect(parse({ type: "select", ids: [id] }, { payload })).toBeNull();
    expect(parse({ type: "move", ids: [id], delta: { x: 0.1, y: 0 } }, { payload })).toBeNull();
    if (layer === "actors") expect(parse({ type: "add-player", point: { x: 0.2, y: 0.7 } }, { payload, tool: "player" })).toBeNull();
    else expect(parse({ type: "draw", drawing: { kind: "ball", points: [{ x: 0.2, y: 0.7 }] } }, { payload })).toBeNull();
  });

  it("rejects stale commands for individually hidden actors and drawings while preserving other layers", () => {
    const payload = fixture();
    payload.editor!.actorMeta.setter = { hidden: true };
    payload.editor!.drawings.first.find(item => item.id === "note")!.hidden = true;
    for (const id of ["setter", "note"]) {
      expect(parse({ type: "select", ids: [id] }, { payload })).toBeNull();
      expect(parse({ type: "move", ids: [id], delta: { x: .1, y: 0 }, duplicate: true }, { payload })).toBeNull();
    }
    expect(parse({ type: "edit-text", id: "note" }, { payload })).toBeNull();
    expect(parse({ type: "select", ids: ["middle", "ball"] }, { payload })).toEqual({ type: "select", ids: ["middle", "ball"] });
  });

  it("moves visible objects with copied normalized delta and optional animation path", () => {
    const delta = { x: 0.2, y: -0.1 };
    const path = [{ x: 0, y: 0 }, { x: 0.15, y: 0.05 }, delta];
    const payload = fixture(), before = JSON.stringify(payload);
    expect(parse({ type: "move", ids: ["setter", "ball"], delta, path }, { payload, tool: "animate" })).toEqual({ type: "move", ids: ["setter", "ball"], delta, path });
    expect(JSON.stringify(payload)).toBe(before);
    const result = parse({ type: "move", ids: ["middle"], delta, duplicate: true });
    expect(result).toEqual({ type: "move", ids: ["middle"], delta, duplicate: true });
    if (result?.type === "move") expect(result.delta).not.toBe(delta);
  });

  it.each(["ball", "setter"])("accepts bounded height only for the single current selection %s", id => {
    for (const value of [0, 2.4, 8]) {
      const command = { type: "elevation", id, value };
      expect(parse(command, { selected: [id] })).toEqual(command);
      expect(parse(command)).toBeNull();
      expect(parse(command, { selected: [id, "middle"] })).toBeNull();
      expect(parse(command, { selected: ["middle"] })).toBeNull();
      expect(parse(command, { selected: [id], tool: "animate" })).toBeNull();
      expect(parse(command, { selected: [id], disabled: true })).toBeNull();
      expect(parse(command, { selected: [id], revision: 5 })).toBeNull();
    }
  });

  it.each([NaN, Infinity, -.01, 8.01, "2", null, undefined])("rejects invalid height %s", value => {
    expect(parse({ type: "elevation", id: "ball", value }, { selected: ["ball"] })).toBeNull();
  });

  it("rejects height edits for unsupported, foreign, hidden, locked and simulated elements", () => {
    for (const id of ["note", "foreign", "other-step-ball", "other-step-player"]) {
      expect(parse({ type: "elevation", id, value: 2 }, { selected: [id] })).toBeNull();
    }
    expect(parse({ type: "elevation", id: "ball", value: 2, position: { x: 0, y: 0 } }, { selected: ["ball"] })).toBeNull();
    for (const id of ["ball", "setter"]) {
      for (const flag of ["hidden", "locked"] as const) {
        const payload = fixture();
        if (id === "ball") payload.editor!.drawings.first[0][flag] = true;
        else payload.editor!.actorMeta.setter = { [flag]: true };
        expect(parse({ type: "elevation", id, value: 2 }, { payload, selected: [id] })).toBeNull();
      }
      const payload = fixture(); payload.editor!.hiddenLayers = [id === "ball" ? "drawings" : "actors"];
      expect(parse({ type: "elevation", id, value: 2 }, { payload, selected: [id] })).toBeNull();
    }
    const payload = configureCourtSimulation(fixture(), 0, { mode: "attack" });
    expect(parse({ type: "elevation", id: "setter", value: 2 }, { payload, selected: ["setter"] })).toBeNull();
  });

  it.each([
    { ids: [], delta: { x: 0.1, y: 0 } },
    { ids: ["setter", "setter"], delta: { x: 0.1, y: 0 } },
    { ids: ["setter"], delta: { x: NaN, y: 0 } },
    { ids: ["setter"], delta: { x: Infinity, y: 0 } },
    { ids: ["setter"], delta: { x: 1.41, y: 0 } },
    { ids: ["setter"], delta: { x: "0.1", y: 0 } },
    { ids: ["setter"], delta: { x: 0.1, y: 0 }, duplicate: "yes" },
    { ids: ["setter"], delta: { x: 0.1, y: 0 }, path: [] },
    { ids: ["setter"], delta: { x: 0.1, y: 0 }, path: [{ x: 0, y: 0 }] },
    { ids: ["setter"], delta: { x: 0.1, y: 0 }, path: [{ x: 0, y: 0 }, { x: 2.1, y: 0 }] },
    { ids: ["setter"], delta: { x: 0.1, y: 0 }, path: Array.from({ length: 301 }, () => ({ x: 0, y: 0 })) },
  ])("rejects invalid or unbounded movement %#", command => {
    expect(parse({ type: "move", ...command }, { tool: "animate" })).toBeNull();
  });

  it("prevents paths from creating animation outside animation mode or a hidden movement layer", () => {
    const command = { type: "move", ids: ["setter"], delta: { x: 0.1, y: 0 }, path: [{ x: 0, y: 0 }, { x: 0.1, y: 0 }] };
    expect(parse(command)).toBeNull();
    expect(parse(command, { tool: "animate" })).not.toBeNull();
    const payload = fixture(); payload.editor!.hiddenLayers = ["movements"];
    expect(parse(command, { payload, tool: "animate" })).toBeNull();
    expect(parse({ ...command, duplicate: true }, { tool: "animate" })).toBeNull();
  });

  it("clamps bounded court-exterior drawing and player points using the canonical limit", () => {
    expect(parse({ type: "draw", drawing: { kind: "ball", points: [{ x: -1, y: 2 }] } })).toEqual({ type: "draw", drawing: { kind: "ball", points: [{ x: -0.2, y: 1.15 }], color: "#ffffff", size: 32, rotation: 0 } });
    expect(parse({ type: "add-player", point: { x: 2, y: -1 } }, { tool: "player" })).toEqual({ type: "add-player", point: { x: 1.2, y: -0.15 } });
    expect(parse({ type: "add-player", point: { x: 3, y: 0 } }, { tool: "player" })).toBeNull();
    expect(parse({ type: "add-player", point: { x: 0.5, y: 0.7 } })).toBeNull();
  });

  it("limits drawing creation to known kinds, the current drawing tool or a material drop", () => {
    const arrow = { kind: "arrow", points: [{ x: 0.2, y: 0.6 }, { x: 0.5, y: 0.8 }], color: "#5aF", size: 28, rotation: 720, dashed: true };
    expect(parse({ type: "draw", drawing: arrow })).toBeNull();
    expect(parse({ type: "draw", drawing: arrow }, { tool: "arrow" })).toEqual({ type: "draw", drawing: { ...arrow, rotation: 0 } });
    expect(parse({ type: "draw", drawing: { kind: "iframe", points: arrow.points } }, { tool: "arrow" })).toBeNull();
    expect(parse({ type: "draw", drawing: { ...arrow, points: [arrow.points[0]] } }, { tool: "arrow" })).toBeNull();
    expect(parse({ type: "draw", drawing: { kind: "ball", points: arrow.points } })).toBeNull();
  });

  it.each([
    { color: "url(javascript:alert(1))" }, { color: "#fffff" }, { color: "red" }, { size: Infinity }, { size: 81 },
    { rotation: NaN }, { rotation: 3601 }, { dashed: "true" }, { id: "injected" }, { locked: false },
    { ownerId: "other" }, { motion: [{ x: 0, y: 0 }] }, { points: [{ x: 0.2, y: NaN }] },
  ])("rejects unsupported drawing data %#", extra => {
    expect(parse({ type: "draw", drawing: { kind: "ball", points: [{ x: 0.2, y: 0.7 }], ...extra } })).toBeNull();
  });

  it("keeps bounded annotation text as plain text and opens existing text through the host", () => {
    const text = "<img src=x onerror=alert(1)> Passe & cobertura";
    expect(parse({ type: "draw", drawing: { kind: "text", points: [{ x: 0.2, y: 0.6 }], text } }, { tool: "text" })).toMatchObject({ type: "draw", drawing: { text } });
    expect(parse({ type: "draw", drawing: { kind: "text", points: [{ x: 0.2, y: 0.6 }], text: "x".repeat(201) } }, { tool: "text" })).toBeNull();
    expect(parse({ type: "edit-text", id: "note" })).toEqual({ type: "edit-text", id: "note" });
    expect(parse({ type: "edit-text", id: "ball" })).toBeNull();
    expect(parse({ type: "edit-text", id: "note", text: "cannot bypass the properties panel" })).toBeNull();
  });

  it.each(["undo", "redo", "delete", "escape", "copy", "paste", "select-all", "save", "play", "select-tool", "nudge-left", "nudge-right", "nudge-up", "nudge-down"])("accepts host shortcut %s", key => {
    expect(parse({ type: "shortcut", key, shift: true })).toEqual({ type: "shortcut", key, shift: true });
  });

  it("rejects arbitrary keys and new document payloads", () => {
    expect(parse({ type: "shortcut", key: "fetch" })).toBeNull();
    expect(parse({ type: "shortcut", key: "save", shift: 1 })).toBeNull();
    expect(parse({ type: "select", ids: ["setter"], payload: fixture() })).toBeNull();
    expect(parse({ type: "select", ids: Array(1) })).toBeNull();
  });

  it("rejects stale, unauthorized, malformed and disabled commands", () => {
    const context = { token: "frame-token", revision: 4, payload: fixture(), stepIndex: 0 };
    const command = envelope({ type: "select", ids: [] });
    for (const invalid of [null, [], "command", { ...command, token: "other" }, { ...command, channel: "other" }, { ...command, version: undefined }, { ...command, revision: 3 }, { ...command, revision: 4.1 }]) {
      expect(parseCourtPerspectiveCommand(invalid, context)).toBeNull();
    }
    expect(parseCourtPerspectiveCommand(command, { ...context, stepIndex: -1 })).toBeNull();
    expect(parseCourtPerspectiveCommand(command, { ...context, stepIndex: 99 })).toBeNull();
    expect(parseCourtPerspectiveCommand(command, { ...context, token: "" })).toBeNull();
    expect(parseCourtPerspectiveCommand(command, { ...context, disabled: true })).toBeNull();
    expect(parse({ type: "shortcut", key: "undo" }, { disabled: true })).toBeNull();
    expect(parse({ type: "shortcut", key: "escape" }, { disabled: true })).not.toBeNull();
    expect(parse({ type: "shortcut", key: "play" }, { disabled: true })).not.toBeNull();
  });

  it("accepts only enabled simulation handles in the current canonical step", () => {
    const payload = configureCourtSimulation(newCourtBoard(), 0, { mode: "attack", layers: { pass: true, attack: true } });
    const point = { x: -3.8, y: 3, z: .55 };
    for (const kind of ["hit", "target"] as const) expect(parse({ type: "simulation-handle", kind, point }, { payload })).toEqual({ type: "simulation-handle", kind, point });
    for (const kind of ["set", "pass"] as const) expect(parse({ type: "simulation-handle", kind, point, value: 2.5 }, { payload })).toEqual({ type: "simulation-handle", kind, point, value: 2.5 });
    expect(parse({ type: "simulation-handle", kind: "serve", point }, { payload })).toBeNull();
    expect(parse({ type: "simulation-handle", kind: "hit", point })).toBeNull();
    const receive = configureCourtSimulation(payload, 0, { mode: "receive" });
    expect(parse({ type: "simulation-handle", kind: "serve", point: { x: 0, y: .03, z: 6 } }, { payload: receive })).not.toBeNull();
    expect(parse({ type: "simulation-handle", kind: "hit", point }, { payload: receive })).toBeNull();
  });

  it("rejects malformed, stale, hidden and disabled simulation handle gestures", () => {
    const payload = configureCourtSimulation(newCourtBoard(), 0, { mode: "attack" });
    const base = { type: "simulation-handle", kind: "set", point: { x: 0, y: 4, z: 1 }, value: 2 };
    for (const extra of [{ kind: "foreign" }, { value: NaN }, { value: 5.01 }, { point: { x: 10, y: 4, z: 1 } }, { point: { x: 0, y: 4, z: Infinity } }, { point: { x: 0, y: 4, z: 1, actorId: "other" } }, { actorIds: ["foreign"] }]) expect(parse({ ...base, ...extra }, { payload })).toBeNull();
    expect(parse(base, { payload, disabled: true })).toBeNull();
    expect(parse(base, { payload, revision: 5 })).toBeNull();
    const hidden = { ...payload, editor: { ...payload.editor!, hiddenLayers: ["movements"] } };
    expect(parse(base, { payload: hidden })).toBeNull();
    const layers = configureCourtSimulation(payload, 0, { layers: { pass: false, attack: false } });
    expect(parse({ ...base, kind: "pass" }, { payload: layers })).toBeNull();
    expect(parse({ type: "simulation-handle", kind: "target", point: { x: 0, y: .12, z: -4 } }, { payload: layers })).toBeNull();
    expect(parse({ ...base, kind: "hit" }, { payload })).toBeNull();
  });

  it.each([.03, .65, 4])("accepts an attack curve of %s metres without trusting a document from the iframe", value => {
    const payload = configureCourtSimulation(newCourtBoard(), 0, { mode: "attack", layers: { attack: true } });
    const point = { x: -1.8, y: 3.4, z: -2.5 };
    const command = { type: "simulation-handle", kind: "attack", point, value };
    const before = JSON.stringify(payload);
    const parsed = parse(command, { payload });
    expect(parsed).toEqual(command);
    if (parsed?.type === "simulation-handle") expect(parsed.point).not.toBe(point);
    expect(JSON.stringify(payload)).toBe(before);
  });

  it.each([
    { value: undefined }, { value: null }, { value: "1" }, { value: NaN }, { value: Infinity },
    { value: .029 }, { value: 4.001 }, { point: undefined }, { point: { x: 0, y: 3 } },
    { point: { x: NaN, y: 3, z: -2 } }, { point: { x: 0, y: Infinity, z: -2 } },
    { point: { x: 0, y: 3, z: NaN } }, { point: { x: 0, y: 3, z: -12.01 } },
    { point: { x: 0, y: 3, z: -2, actorId: "foreign" } }, { attackSettings: { attackArc: 1 } },
  ])("rejects malformed or unbounded attack curve edits %#", extra => {
    const payload = configureCourtSimulation(newCourtBoard(), 0, { mode: "attack" });
    expect(parse({ type: "simulation-handle", kind: "attack", point: { x: 0, y: 3, z: -2 }, value: .6, ...extra }, { payload })).toBeNull();
  });

  it("allows an attack curve only for an enabled attack trajectory in the current step", () => {
    const payload = configureCourtSimulation(newCourtBoard(), 0, { mode: "attack", layers: { attack: true, pass: false } });
    const command = { type: "simulation-handle", kind: "attack", point: { x: 0, y: 3, z: -2 }, value: .6 };
    expect(parse(command, { payload })).not.toBeNull();
    expect(parse(command, { payload: configureCourtSimulation(payload, 0, { layers: { attack: false } }) })).toBeNull();
    expect(parse(command, { payload: configureCourtSimulation(payload, 0, { mode: "receive" }) })).toBeNull();
    expect(parse(command, { payload: { ...payload, editor: { ...payload.editor!, hiddenLayers: ["movements"] } } })).toBeNull();
    expect(parse(command, { payload, disabled: true })).toBeNull();
    expect(parse(command, { payload, revision: 5 })).toBeNull();
    expect(parse(command, { payload, stepIndex: 1 })).toBeNull();
  });
});
it('allows only the serve handle through an explicitly enabled disabled viewer', () => {
  const payload = configureCourtSimulation(fixture(), 0, { mode: 'receive' });
  const command = { type: 'simulation-handle', kind: 'serve', point: { x: 1, y: .03, z: 6 } };
  expect(parse(command, { payload, disabled: true })).toBeNull();
  const context = { payload, disabled: true, allowServeHandle: true };
  expect(parse(command, context)?.type).toBe('simulation-handle');
  expect(parse({ ...command, kind: 'hit' }, context)).toBeNull();
  expect(parse({ type: 'select', ids: ['setter'] }, context)).toBeNull();
  expect(parse({ type: 'shortcut', key: 'delete' }, context)).toBeNull();
  expect(parse({ ...command, revision: -1 }, context)).toBeNull();
});


describe("defense simulation command boundary", () => {
  it.each(["serve", "set", "pass", "attack", "hit", "target"])("rejects unrelated %s engine handles in defense", kind => {
    const { payload, stepIndex } = ensureCourtDefenseStep(fixture());
    const command = { type: "simulation-handle", kind, point: { x: 0, y: 2, z: 1 }, ...(["set", "pass", "attack"].includes(kind) ? { value: 2 } : {}) };
    expect(parse(command, { payload, stepIndex, progress: 1 })).toBeNull();
  });
});
