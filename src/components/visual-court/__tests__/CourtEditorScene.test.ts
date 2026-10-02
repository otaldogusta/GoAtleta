import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { newCourtBoard } from "../../../core/visual-court-editor";
import { CourtEditorScene } from "../CourtEditorScene";

jest.mock("react-native-svg", () => ({
  __esModule: true, default: "Svg", Circle: "Circle", G: "G", Line: "Line",
  Path: "Path", Polygon: "Polygon", Rect: "Rect", Text: "SvgText",
}));

describe("court actor display preferences", () => {
  it("hides numbers while preserving teacher labels and the authored document", () => {
    const payload = newCourtBoard();
    payload.actors = [
      { id: "student", role: "athlete", representation: "person", label: "13", number: 13, color: "#19c87b", initialPosition: { x: 0.3, y: 0.4 } },
      { id: "teacher", role: "athlete", label: "P", color: "#a855f7", initialPosition: { x: 0.7, y: 0.6 } },
    ];
    payload.timeline.steps[0].visibleActorIds = payload.actors.map(actor => actor.id);
    payload.timeline.steps[0].actorPositions = Object.fromEntries(payload.actors.map(actor => [actor.id, actor.initialPosition]));
    let tree: TestRenderer.ReactTestRenderer;
    const render = () => act(() => { tree = TestRenderer.create(React.createElement(CourtEditorScene, { payload, stepIndex: 0, landscape: true, plain: true })); });
    render();
    expect(tree!.root.findAllByType("SvgText").map(node => node.props.children)).toEqual(["13", "P"]);
    expect(tree!.root.findAllByType("Path").map(node => node.props.fill)).toContain("#19c87b");
    expect(tree!.root.findAllByType("Circle").map(node => node.props.fill)).toContain("#a855f7");
    payload.editor = { ...payload.editor!, showActorNumbers: false, actorRepresentation: "person" };
    const before = JSON.stringify(payload);
    render();
    expect(tree!.root.findAllByType("SvgText").map(node => node.props.children)).toEqual(["P"]);
    const shirtColors = tree!.root.findAllByType("Path").map(node => node.props.fill);
    expect(shirtColors).toContain("#19c87b");
    expect(shirtColors).toContain("#a855f7");
    expect(JSON.stringify(payload)).toBe(before);
  });
});
