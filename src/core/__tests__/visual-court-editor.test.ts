import { buildRotation5x1Preset, normalizeCourtPayload, parseCourtVisualPayload, serializeCourtVisualPayload } from "../visual-court";
import { addBlankStep, actorPoint, changeDrawings, continueStepFromEnd, copyStepSelection, deleteSelection, duplicateSelection, duplicateStep, frameDrawings, moveSelection, newCourtBoard, parseEditorImport, pasteStepSelection, pointAlong, motionTrail, snapCourtPoint, resetStepAnimation, removeStep, reorderStep, reorderStepToIndex, upgradeCourtEditor } from "../visual-court-editor";

describe("court editor document commands", () => {
  it("snaps both axes to the same half-metre spacing", () => {
    const snapped = snapCourtPoint({ x: 0.14, y: 0.14 });
    expect(snapped.x * 9).toBe(1.5);
    expect(snapped.y * 18).toBe(2.5);
    expect(snapCourtPoint(snapped)).toEqual(snapped);
    expect(snapCourtPoint({ x: 0, y: 0.5 })).toEqual({ x: 0, y: 0.5 });
  });
  it("includes the libero in every rotation reset and repairs older restored boards", () => {
    const p = upgradeCourtEditor(buildRotation5x1Preset(), "Rotation");
    for (let i = 0; i < p.timeline.steps.length; i++) {
      const step = p.timeline.steps[i];
      expect(step.legalPositions?.lib).toBeDefined();
      expect(resetStepAnimation(p, i).timeline.steps[i].actorPositions.lib).toEqual(step.legalPositions!.lib);
    }
    const step = p.timeline.steps[0];
    const expected = step.legalPositions!.lib;
    const hidden = ["c1", "c2"].find(id => !step.visibleActorIds!.includes(id))!;
    step.legalPositions = { ...step.legalPositions, [hidden]: expected };
    delete step.legalPositions.lib;
    step.actorPositions = { ...step.legalPositions, lib: { x: 0.1, y: 0.6 } };
    step.trajectories = []; step.transitions = undefined;
    const repaired = upgradeCourtEditor(p, "Rotation");
    expect(repaired.timeline.steps[0].actorPositions.lib).toEqual(expected);
  });
  it("restores each rotation's legal formation when clearing animation", () => {
    const p = upgradeCourtEditor(buildRotation5x1Preset(), "Rotation");
    p.timeline.steps.forEach((step, index) => {
      const id = p.actors[0].id;
      const moved = moveSelection(p, index, [id], { x: 0.1, y: 0.1 }, true);
      const reset = resetStepAnimation(moved, index).timeline.steps[index];
      expect(reset.trajectories).toEqual([]);
      expect(reset.actorPositions).toMatchObject(step.legalPositions ?? step.baselineActorPositions ?? step.actorPositions);
    });
  });
  it("grows the arrow behind the player with clearance and follows the curve", () => {
    const points = [{ x: 0, y: 0 }, { x: 0.2, y: 0 }, { x: 0.2, y: 0.2 }];
    expect(motionTrail(points, 0, 55)).toEqual([]);
    const half = motionTrail(points, 0.5, 55);
    expect(half[half.length - 1].x).toBeCloseTo(0.2 - 55 / 900);
    expect(half[half.length - 1].y).toBe(0);
    const end = motionTrail(points, 1, 55);
    expect(end[1]).toEqual(points[1]);
    expect(end[end.length - 1].y).toBeCloseTo(0.2 - 55 / 1800);
  });
  it("keeps a curved gesture as the playback path", () => {
    const p = newCourtBoard(); const id = p.actors[0].id;
    const start = actorPoint(p, 0, id);
    const path = [{ x: 0, y: 0 }, { x: 0.1, y: -0.1 }, { x: 0.2, y: 0 }];
    const moved = moveSelection(p, 0, [id], path[2], true, path);
    expect(moved.timeline.steps[0].trajectories![0].points).toEqual(path.map(pt => ({ x: start.x + pt.x, y: start.y + pt.y })));
  });
  it("removes automatic preset targets while retaining authored targets", () => {
    const p = newCourtBoard();
    p.markers = [{ id: "receive-target", type: "target", position: { x: 0.5, y: 0.5 } }, { id: "my-target", type: "target", position: { x: 0.6, y: 0.6 } }];
    const next = upgradeCourtEditor(p, "Board");
    expect(frameDrawings(next, 0)).toHaveLength(1);
    expect(frameDrawings(next, 0)[0].id).toContain("my-target");
  });
  it("makes legacy targets in version 1 drafts editable without changing coordinates", () => {
    const p = newCourtBoard();
    p.markers = [{ id: "old-target", type: "target", position: { x: 0.64, y: 0.56 }, color: "#19c87b" }];
    const upgraded = upgradeCourtEditor(p, "Draft");
    const target = frameDrawings(upgraded, 0)[0];
    expect(target.kind).toBe("target");
    expect(target.points[0]).toEqual(p.markers[0].position);
    expect(upgraded.markers).toEqual([]);
    expect(upgradeCourtEditor(upgraded, "Draft")).toBe(upgraded);
    const moved = moveSelection(upgraded, 0, [target.id], { x: 0.1, y: 0 });
    expect(frameDrawings(moved, 0)[0].points[0].x).toBeCloseTo(0.74);
    expect(frameDrawings(deleteSelection(upgraded, 0, [target.id]), 0)).toEqual([]);
  });
  it("round trips through the actual database serializer without losing the editor or custom labels", () => {
    const p = newCourtBoard("Minha jogada");
    p.actors[0].id = "p1"; p.actors[0].label = "Novo rótulo";
    p.editor!.drawings[p.timeline.steps[0].id] = [{ id: "ball", kind: "ball", points: [{ x: 0.3, y: 0.2 }], motion: [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.2 }], size: 32, rotation: 0, color: "#ffffff" }];
    const restored = parseCourtVisualPayload(serializeCourtVisualPayload(p));
    expect(restored.editor).toEqual(p.editor);
    expect(restored.actors[0].label).toBe("Novo rótulo");
  });
  it("upgrades legacy coordinates once without mutating the source", () => {
    const source = buildRotation5x1Preset(); const snapshot = JSON.stringify(source);
    const p = upgradeCourtEditor(source, "Recepção");
    expect(JSON.stringify(source)).toBe(snapshot);
    expect(p.editor?.coordinates).toBe("regulation");
    expect(upgradeCourtEditor(p, "Ignored")).toBe(p);
    expect(normalizeCourtPayload(p).editor).toEqual(p.editor);
    expect(p.timeline.steps.length).toBe(source.timeline.steps.length);
  });
  it("repairs legacy reception labels and phases without changing authored paths", () => {
    const p = upgradeCourtEditor(buildRotation5x1Preset(), "Recepção");
    const first = p.timeline.steps[0];
    const second = p.timeline.steps[1];
    first.label = "P1 - antes do saque · cópia";
    second.label = "P1 - antes do saque · cópia";
    second.phase = "receive_legal";
    const authoredPath = [
      { x: 0.2, y: 0.7 },
      { x: 0.3, y: 0.62 },
      { x: 0.4, y: 0.58 },
    ];
    second.trajectories = [{ id: "author-path", actorId: "p1", points: authoredPath }];

    const repaired = upgradeCourtEditor(p, "Recepção");

    expect(repaired.timeline.steps[0].label).toBe("P1 · Organização da recepção");
    expect(repaired.timeline.steps[1].label).toBe("P1 · Após o saque");
    expect(repaired.timeline.steps[1].phase).toBe("receive_release");
    expect(repaired.timeline.steps[1].baselineActorPositions).toEqual(
      repaired.timeline.steps[0].actorPositions
    );
    expect(repaired.timeline.steps[1].trajectories?.[0].points).toEqual(authoredPath);
  });
  it("starts with two independent teams and twelve actors", () => {
    const p = newCourtBoard();
    expect(p.actors).toHaveLength(12);
    expect(p.actors.filter(a => p.editor?.actorMeta[a.id].team === "B")).toHaveLength(6);
    expect(new Set(p.actors.map(a => a.id)).size).toBe(12);
  });
  it("moves static positions without producing an animation", () => {
    const p = newCourtBoard(), id = p.actors[0].id;
    const next = moveSelection(p, 0, [id], { x: 0.1, y: 0 }, false);
    expect(actorPoint(next, 0, id).x).toBeCloseTo(actorPoint(p, 0, id).x + 0.1);
    expect(next.timeline.steps[0].trajectories).toHaveLength(0);
    expect(next.timeline.steps[0].baselineActorPositions?.[id]).toEqual(actorPoint(next, 0, id));
  });
  it("starts a replacement trajectory at the actor current final position", () => {
    const p = newCourtBoard(), id = p.actors[0].id;
    const first = moveSelection(p, 0, [id], { x: 0.1, y: 0 }, true);
    const next = moveSelection(first, 0, [id], { x: 0.1, y: 0.02 }, true);
    expect(next.timeline.steps[0].trajectories).toHaveLength(1);
    expect(next.timeline.steps[0].trajectories?.[0].points[0]).toEqual(actorPoint(first, 0, id));
    expect(next.timeline.steps[0].trajectories?.[0].points[1]).toEqual(actorPoint(next, 0, id));
    expect(pointAlong(next.timeline.steps[0].trajectories![0].points, 1)).toEqual(actorPoint(next, 0, id));
  });
  it("replaces only the moved actor trajectory and keeps the other paths", () => {
    const p = newCourtBoard(), firstId = p.actors[0].id, secondId = p.actors[1].id;
    const firstMove = moveSelection(p, 0, [firstId], { x: 0.08, y: 0.01 }, true);
    const secondMove = moveSelection(firstMove, 0, [secondId], { x: -0.05, y: 0.04 }, true);
    const replaced = moveSelection(secondMove, 0, [firstId], { x: 0.03, y: -0.02 }, true);
    const firstTrajectory = replaced.timeline.steps[0].trajectories?.find(item => item.actorId === firstId);
    const secondTrajectory = replaced.timeline.steps[0].trajectories?.find(item => item.actorId === secondId);
    expect(firstTrajectory?.points[0]).toEqual(actorPoint(secondMove, 0, firstId));
    expect(firstTrajectory?.points[1]).toEqual(actorPoint(replaced, 0, firstId));
    expect(secondTrajectory).toEqual(secondMove.timeline.steps[0].trajectories?.find(item => item.actorId === secondId));
  });
  it("never moves or deletes a locked actor", () => {
    const p = newCourtBoard(), id = p.actors[0].id;
    p.editor!.actorMeta[id].locked = true;
    const moved = moveSelection(p, 0, [id], { x: 100, y: -100 }, false);
    expect(actorPoint(moved, 0, id)).toEqual(actorPoint(p, 0, id));
    expect(deleteSelection(moved, 0, [id]).timeline.steps[0].visibleActorIds).toContain(id);
  });
  it("duplicates and removes actors only in the active step", () => {
    const p = duplicateStep(newCourtBoard(), 0).payload;
    const result = duplicateSelection(p, 1, [p.actors[0].id]);
    const id = result.selected[0];
    expect(result.payload.timeline.steps[0].visibleActorIds).not.toContain(id);
    expect(result.payload.timeline.steps[1].visibleActorIds).toContain(id);
    const deleted = deleteSelection(result.payload, 1, [id]);
    expect(deleted.timeline.steps[1].visibleActorIds).not.toContain(id);
    expect(deleted.actors.some(a => a.id === id)).toBe(true); // available on bench
  });
  it("preserves drawings when duplicating and reordering steps", () => {
    let p = newCourtBoard();
    p = changeDrawings(p, 0, [{ id: "cone", kind: "cone", points: [{ x: 0.5, y: 0.5 }], size: 30, rotation: 45, color: "#ffdc53" }]);
    const result = duplicateStep(p, 0);
    expect(frameDrawings(result.payload, 1)[0].id).not.toBe("cone");
    expect(frameDrawings(result.payload, 1)[0].rotation).toBe(45);
    const reordered = reorderStep(result.payload, 1, -1);
    expect(reordered.payload.timeline.steps[0].id).toBe(result.payload.timeline.steps[1].id);
    expect(frameDrawings(reordered.payload, 0)).toEqual(frameDrawings(result.payload, 1));
    expect(removeStep(reordered.payload, 0).payload.timeline.steps).toHaveLength(1);
    expect(removeStep(p, 0).payload.timeline.steps).toHaveLength(1);
  });
  it("continues from the visible end state without replaying the previous movement", () => {
    let p = newCourtBoard();
    const actorId = p.actors[0].id;
    p = moveSelection(p, 0, [actorId], { x: 0.12, y: -0.08 }, true);
    p = changeDrawings(p, 0, [{ id: "ball", kind: "ball", points: [{ x: 0.5, y: 0.5 }], motion: [{ x: 0.2, y: 0.4 }, { x: 0.6, y: 0.3 }], size: 28, rotation: 0, color: "#ffffff" }]);
    const result = continueStepFromEnd(p, 0);
    const continued = result.payload.timeline.steps[1];
    expect(continued.actorPositions[actorId]).toEqual(p.timeline.steps[0].actorPositions[actorId]);
    expect(continued.baselineActorPositions?.[actorId]).toEqual(continued.actorPositions[actorId]);
    expect(continued.trajectories).toEqual([]);
    expect(frameDrawings(result.payload, 1)[0].points).toEqual([{ x: 0.6, y: 0.3 }]);
    expect(frameDrawings(result.payload, 1)[0].motion).toBeUndefined();
  });
  it("adds a genuinely blank court and can move a step to any position", () => {
    const p = duplicateStep(duplicateStep(newCourtBoard(), 0).payload, 1).payload;
    const blank = addBlankStep(p, 1);
    expect(blank.payload.timeline.steps[2].visibleActorIds).toEqual([]);
    expect(blank.payload.timeline.steps[2].actorPositions).toEqual({});
    expect(frameDrawings(blank.payload, 2)).toEqual([]);
    const moved = reorderStepToIndex(blank.payload, 2, 0);
    expect(moved.payload.timeline.steps[0].id).toBe(blank.payload.timeline.steps[2].id);
    expect(moved.stepIndex).toBe(0);
  });
  it("copies selected court content into another step without creating duplicate athletes", () => {
    let p = newCourtBoard();
    const actorId = p.actors[0].id;
    p = changeDrawings(p, 0, [{ id: "cone", kind: "cone", points: [{ x: 0.4, y: 0.5 }], size: 24, rotation: 0, color: "#ffdc53" }]);
    const clipboard = copyStepSelection(p, 0, [actorId, "cone"]);
    const blank = addBlankStep(p, 0);
    const pasted = pasteStepSelection(blank.payload, 1, clipboard);
    expect(pasted.payload.actors).toHaveLength(p.actors.length);
    expect(pasted.payload.timeline.steps[1].visibleActorIds).toContain(actorId);
    expect(pasted.payload.timeline.steps[1].actorPositions[actorId]).toEqual(actorPoint(p, 0, actorId));
    expect(frameDrawings(pasted.payload, 1)).toHaveLength(1);
    expect(frameDrawings(pasted.payload, 1)[0].id).not.toBe("cone");
  });
  it("round-trips a bounded editable document and strips account links", () => {
    const p = newCourtBoard(); p.editor!.actorMeta[p.actors[0].id].studentId = "private-student";
    const imported = parseEditorImport(JSON.stringify({ format: "goatleta-court", version: 1, organizationId: "other-org", payload: p }));
    expect(imported.actors).toHaveLength(12);
    expect(imported.editor!.actorMeta[p.actors[6].id].team).toBe("B");
    expect(JSON.stringify(imported)).not.toContain("private-student");
    expect(JSON.stringify(imported)).not.toContain("other-org");
  });
  it("animates a ball from its first point and static movement clears its path", () => {
    let p = changeDrawings(newCourtBoard(), 0, [{ id: "ball", kind: "ball", points: [{ x: 0.4, y: 0.6 }], size: 32, rotation: 0, color: "#ffffff" }]);
    p = moveSelection(p, 0, ["ball"], { x: 0.1, y: 0 }, true);
    p = moveSelection(p, 0, ["ball"], { x: 0.1, y: 0 }, true);
    expect(frameDrawings(p, 0)[0].motion).toEqual([{ x: 0.4, y: 0.6 }, { x: 0.6, y: 0.6 }]);
    const imported = parseEditorImport(JSON.stringify({ format: "goatleta-court", version: 1, payload: p }));
    expect(frameDrawings(imported, 0)[0].motion).toEqual(frameDrawings(p, 0)[0].motion);
    expect(frameDrawings(moveSelection(p, 0, ["ball"], { x: 0, y: 0.1 }, false), 0)[0].motion).toBeUndefined();
  });
  it("rejects unknown versions, invalid coordinates and oversized imports", () => {
    expect(() => parseEditorImport('{"format":"other"}')).toThrow();
    expect(() => parseEditorImport(" ".repeat(2_000_001))).toThrow();
    const p = newCourtBoard(); p.actors[0].initialPosition.x = Infinity;
    expect(() => parseEditorImport(JSON.stringify({ format: "goatleta-court", version: 1, payload: p }))).toThrow();
  });
});
