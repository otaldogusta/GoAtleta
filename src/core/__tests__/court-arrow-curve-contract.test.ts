import { publishableCourt } from "../court-sharing";
import { parseCourtVisualPayload, serializeCourtVisualPayload } from "../visual-court";
import { changeDrawings, copyStepSelection, duplicateSelection, duplicateStep, frameDrawings, moveSelection, newCourtBoard, parseEditorImport, pasteStepSelection, type CourtDrawing } from "../visual-court-editor";
import { buildCourtPerspectiveFrame, courtPointToWorld } from "../visual-court-perspective";

const curve = (): CourtDrawing => ({
  id: "editable-curve", kind: "curve", curveMode: "through-point",
  points: [{ x: .2, y: .3 }, { x: .6, y: .2 }, { x: .8, y: .7 }],
  color: "#4389ff", dashed: true, size: 32, rotation: 0,
});
const boardWith = (drawing = curve()) => changeDrawings(newCourtBoard(), 0, [drawing]);
const imported = (drawing: CourtDrawing) => parseEditorImport(JSON.stringify({ format: "goatleta-court", version: 1, payload: boardWith(drawing) }));

describe("authored arrow curve contract", () => {
  it("retains the explicit midpoint through editable import, ordinary save and public sanitization", () => {
    const source = boardWith(), original = JSON.stringify(source);
    for (const restored of [imported(curve()), parseCourtVisualPayload(serializeCourtVisualPayload(source)), publishableCourt(source)]) {
      expect(frameDrawings(restored, 0)[0]).toMatchObject(curve());
    }
    expect(JSON.stringify(source)).toBe(original);
  });

  it.each([2, 3])("does not reinterpret an unmarked legacy curve with %i points", length => {
    const drawing = curve(); delete drawing.curveMode; drawing.points = drawing.points.slice(0, length);
    expect(frameDrawings(imported(drawing), 0)[0]).toMatchObject({ kind: "curve", points: drawing.points });
    expect(frameDrawings(imported(drawing), 0)[0].curveMode).toBeUndefined();
    expect(buildCourtPerspectiveFrame(boardWith(drawing), 0, 0).drawings[0].curveMode).toBeUndefined();
  });

  it.each([
    { kind: "arrow", curveMode: "through-point", points: curve().points },
    { kind: "curve", curveMode: "unknown", points: curve().points },
    { kind: "curve", curveMode: "through-point", points: curve().points.slice(0, 2) },
    { kind: "curve", curveMode: "through-point", points: [...curve().points, { x: .9, y: .8 }] },
  ])("drops malformed curve mode at import and perspective boundaries: %j", fields => {
    const drawing = { ...curve(), ...fields } as CourtDrawing;
    expect(frameDrawings(imported(drawing), 0)[0].curveMode).toBeUndefined();
    expect(frameDrawings(publishableCourt(boardWith(drawing)), 0)[0].curveMode).toBeUndefined();
    expect(buildCourtPerspectiveFrame(boardWith(drawing), 0, 0).drawings[0].curveMode).toBeUndefined();
  });

  it("keeps the flag when moving, duplicating and copying a curve, without mutating its source", () => {
    const source = boardWith(), original = JSON.stringify(source), offset = { x: .05, y: .04 };
    const translated = curve().points.map(point => ({ x: point.x + offset.x, y: point.y + offset.y }));
    expect(frameDrawings(moveSelection(source, 0, [curve().id], offset), 0)[0]).toMatchObject({ curveMode: "through-point", points: translated });
    const duplicated = duplicateSelection(source, 0, [curve().id], offset);
    expect(frameDrawings(duplicated.payload, 0).find(drawing => drawing.id === duplicated.selected[0])).toMatchObject({ curveMode: "through-point", points: translated });
    const step = duplicateStep(source, 0);
    expect(frameDrawings(step.payload, step.stepIndex)[0]).toMatchObject({ curveMode: "through-point", points: curve().points });
    const pasted = pasteStepSelection(source, 0, copyStepSelection(source, 0, [curve().id]));
    expect(frameDrawings(pasted.payload, 0).find(drawing => drawing.id === pasted.selected[0])).toMatchObject({ curveMode: "through-point", points: curve().points });
    expect(JSON.stringify(source)).toBe(original);
  });

  it("sends the exact three authored points at one ground height to 3D", () => {
    const projected = buildCourtPerspectiveFrame(boardWith(), 0, 0).drawings[0];
    expect(projected).toMatchObject({ curveMode: "through-point", kind: "curve", points: curve().points.map(point => courtPointToWorld(point, .025)) });
  });
});
