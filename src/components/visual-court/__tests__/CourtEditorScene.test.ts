import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { newCourtBoard, type DrawingKind } from "../../../core/visual-court-editor";
import { CourtEditorScene } from "../CourtEditorScene";
import { moveCourtLayer } from "../../../core/court-layers";
import { courtHoverColor } from "../court-hover-color";

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

describe("transient court hover paint", () => {
  it.each(["arrow", "curve", "pen", "area", "text", "ball", "cone", "target", "ladder"] as DrawingKind[])("tints %s without changing its shape, source or subsequent export", kind => {
    const payload = newCourtBoard(); payload.actors = [];
    payload.editor!.drawings[payload.timeline.steps[0].id] = [{ id: "object", kind, points: [{ x: .3, y: .3 }, { x: .6, y: .2 }, { x: .7, y: .6 }], curveMode: kind === "curve" ? "through-point" : undefined, color: "#fff", size: 42, rotation: 35, text: "WHITE" }];
    const source = JSON.stringify(payload), props = { payload, stepIndex: 0, landscape: true, plain: true };
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => { tree = TestRenderer.create(React.createElement(CourtEditorScene, props)); });
    const baseline = tree.toJSON();
    const geometry = () => tree.root.findAll(node => typeof node.type === "string").map(node => ({ type: node.type, d: node.props.d, points: node.props.points, transform: node.props.transform, strokeWidth: node.props.strokeWidth }));
    const originalGeometry = geometry();
    act(() => tree.update(React.createElement(CourtEditorScene, { ...props, hoveredId: "object" })));
    const paint = tree.root.findAll(node => typeof node.type === "string").flatMap(node => [node.props.fill, node.props.stroke]);
    expect(paint).toContain(kind === "ball" ? "#b9e0ff" : courtHoverColor("#fff"));
    expect(courtHoverColor("#fff")).not.toBe("#ffffff");
    if (kind !== "ball") expect(geometry()).toEqual(originalGeometry);
    else expect(tree.root.findAllByType("Circle")).toHaveLength(2); // Fill overlay, no extra outline.
    if (kind === "text") expect(tree.root.findAllByType("SvgText")).toHaveLength(1);
    expect(JSON.stringify(payload)).toBe(source);
    act(() => tree.update(React.createElement(CourtEditorScene, props)));
    expect(tree.toJSON()).toEqual(baseline);
    let exported!: TestRenderer.ReactTestRenderer;
    act(() => { exported = TestRenderer.create(React.createElement(CourtEditorScene, props)); });
    expect(exported.toJSON()).toEqual(baseline);
    act(() => { tree.unmount(); exported.unmount(); });
  });

  it.each(["circle", "person"] as const)("preserves %s selection and labels while tinting only the hovered actor", representation => {
    const payload = newCourtBoard(); payload.actors = [
      { id: "first", role: "athlete", representation, label: "1", color: "#fff", initialPosition: { x: .3, y: .4 } },
      { id: "second", role: "athlete", representation, label: "2", color: "#fff", initialPosition: { x: .7, y: .4 } },
    ];
    payload.timeline.steps[0].actorPositions = {}; payload.timeline.steps[0].visibleActorIds = ["first", "second"];
    const props = { payload, stepIndex: 0, landscape: false, selected: ["first"] };
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => { tree = TestRenderer.create(React.createElement(CourtEditorScene, props)); });
    const halo = () => tree.root.findAll(node => typeof node.type === "string" && node.props.fill === "none" && node.props.stroke === "#fff").map(node => node.props);
    const beforeHalo = halo();
    act(() => tree.update(React.createElement(CourtEditorScene, { ...props, hoveredId: "first" })));
    expect(halo()).toEqual(beforeHalo);
    expect(tree.root.findAllByType("SvgText").map(node => node.props.children)).toEqual(["1", "2"]);
    const bodies = tree.root.findAllByType(representation === "person" ? "Path" : "Circle").filter(node => node.props.fill !== "none");
    expect(bodies.map(node => node.props.fill)).toEqual([courtHoverColor("#fff"), "#fff"]);
    act(() => tree.unmount());
  });
});

describe("mixed court layer rendering", () => {
  it("renders a marked curve through its middle with a tangent arrowhead, preserving unmarked legacy curves", () => {
    const payload = newCourtBoard(); payload.actors = [];
    const points = [{ x: .3, y: .4 }, { x: .6, y: .2 }, { x: .3, y: .1 }];
    payload.editor!.drawings[payload.timeline.steps[0].id] = [
      { id: "legacy", kind: "curve", points, color: "#123abc", size: 32, rotation: 0 },
      { id: "explicit", kind: "curve", curveMode: "through-point", points, color: "#abc123", size: 32, rotation: 0 },
    ];
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => { tree = TestRenderer.create(React.createElement(CourtEditorScene, { payload, stepIndex: 0, landscape: true, plain: true })); });
    const paths = tree.root.findAllByType("Path");
    expect(paths.find(node => node.props.stroke === "#123abc")?.props.d).toBe("M 1080 270 Q 1415 205 1620 270");
    const marked = paths.find(node => node.props.stroke === "#abc123")!.props.d as string;
    const coordinates = marked.split(/[MQ ]+/).filter(Boolean).map(Number);
    expect(coordinates).toEqual([1080, 270, 1530, 810, 1620, 270]);
    const head = tree.root.findAllByType("Polygon").find(node => node.props.fill === "#abc123")!.props.points.split(/[ ,]+/).map(Number);
    const angle = Math.atan2(270 - 810, 1620 - 1530);
    expect(head[2]).toBeCloseTo(1620 - 25 * Math.cos(angle - .5)); expect(head[3]).toBeCloseTo(270 - 25 * Math.sin(angle - .5));
    expect(tree.root.findAll(node => node.props.nativeID?.startsWith?.("court-arrow-handle-"))).toHaveLength(0);
    act(() => tree.unmount());
  });

  it("omits individual hidden actors, their authored trails and hidden drawings from the exported SVG scene", () => {
    const payload = newCourtBoard(), id = payload.actors[0].id;
    payload.editor!.actorMeta[id].hidden = true;
    payload.actors[0].label = "HIDDEN_PLAYER";
    payload.timeline.steps[0].trajectories = [{ id: "trail", actorId: id, color: "#123abc", points: [{ x: .2, y: .3 }, { x: .4, y: .5 }] }];
    payload.editor!.drawings[payload.timeline.steps[0].id] = [{ id: "note", hidden: true, kind: "text", text: "HIDDEN_NOTE", color: "#fff", points: [{ x: .5, y: .5 }], rotation: 0, size: 32 }];
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => { tree = TestRenderer.create(React.createElement(CourtEditorScene, { payload, stepIndex: 0, landscape: false, progress: .5 })); });
    expect(tree.root.findAllByType("SvgText").map(node => node.props.children)).not.toContain("HIDDEN_PLAYER");
    expect(tree.root.findAllByType("SvgText").map(node => node.props.children)).not.toContain("HIDDEN_NOTE");
    expect(tree.root.findAllByType("Path").some(node => node.props.stroke === "#123abc")).toBe(false);
    act(() => tree.unmount());
  });
  it.each([[390, 844], [1600, 980]])("paints a front text object after the player at %ix%i without moving either", (width, height) => {
    const source = newCourtBoard();
    source.actors = [{ id: "player", role: "athlete", label: "PLAYER", initialPosition: { x: .5, y: .5 } }];
    source.timeline.steps[0].actorPositions = { player: { x: .5, y: .5 } };
    source.timeline.steps[0].visibleActorIds = ["player"];
    source.editor!.drawings[source.timeline.steps[0].id] = [{ id: "note", kind: "text", text: "NOTE", points: [{ x: .5, y: .5 }], color: "#ffffff", size: 32, rotation: 0 }];
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => { tree = TestRenderer.create(React.createElement(CourtEditorScene, { payload: source, stepIndex: 0, landscape: false, plain: true, width, height })); });
    const texts = () => tree.root.findAllByType("SvgText").map(node => ({ text: node.props.children, x: node.props.x, y: node.props.y }));
    const before = texts();
    expect(before.map(value => value.text)).toEqual(["NOTE", "PLAYER"]);
    const payload = moveCourtLayer(source, 0, { kind: "drawing", id: "note" }, 1);
    act(() => tree.update(React.createElement(CourtEditorScene, { payload, stepIndex: 0, landscape: false, plain: true, width, height })));
    expect(texts()).toEqual([before[1], before[0]]);
    act(() => tree.unmount());
  });
});
