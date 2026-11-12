import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { PanResponder, Platform, View, type PanResponderCallbacks } from "react-native";
import { CourtEditorCanvas, type CourtEditorCanvasProps } from "../CourtEditorCanvas";
import { sceneBounds, scenePoint } from "../CourtEditorScene";
import { newCourtBoard } from "../../../core/visual-court-editor";
import { moveCourtLayer } from "../../../core/court-layers";

jest.mock("../CourtEditorScene", () => ({ ...jest.requireActual("../CourtEditorScene"), CourtEditorScene: "Scene" }));
jest.mock("../CourtSelectionActions", () => ({ CourtSelectionActions: () => null }));

describe("picking the visible court layer", () => {
  const platform = Object.getOwnPropertyDescriptor(Platform, "OS");
  let tree: TestRenderer.ReactTestRenderer;
  let responder: PanResponderCallbacks;
  beforeEach(() => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" });
    jest.spyOn(PanResponder, "create").mockImplementation(value => { responder = value; return { panHandlers: {} }; });
  });
  afterEach(() => {
    if (tree) act(() => tree.unmount());
    jest.restoreAllMocks();
    if (platform) Object.defineProperty(Platform, "OS", platform);
  });

  it.each([
    [false, false, [] as string[], "player", "", false],
    [false, true, [], "note", "", false],
    [true, true, [], "note", "", false],
    [false, true, ["drawings"], "player", "", false],
    [false, false, ["actors"], "note", "", false],
    [false, false, [], "note", "player", false],
    [false, true, [], "player", "note", false],
    [false, false, [], "player", "", true],
    [false, true, [], "note", "", true],
  ] as const)("uses paint order for landscape=%s and front-object=%s (hidden=%j, selected=%s, individual=%s, locked=%s)", (landscape, front, hidden, expected, individual, locked) => {
    const source = newCourtBoard();
    source.actors = [{ id: "player", role: "athlete", label: "PLAYER", initialPosition: { x: .5, y: .5 } }];
    source.timeline.steps[0].actorPositions = { player: { x: .5, y: .5 } };
    source.timeline.steps[0].visibleActorIds = ["player"];
    source.editor!.drawings[source.timeline.steps[0].id] = [{ id: "note", kind: "text", text: "NOTE", points: [{ x: .5, y: .5 }], color: "#ffffff", size: 32, rotation: 0 }];
    source.editor!.hiddenLayers = [...hidden];
    const payload = front ? moveCourtLayer(source, 0, { kind: "drawing", id: "note" }, 1) : source;
    if (individual === "player") payload.editor!.actorMeta.player = { hidden: true };
    if (individual === "note") payload.editor!.drawings[source.timeline.steps[0].id][0].hidden = true;
    if (locked && expected === "player") payload.editor!.actorMeta.player = { locked: true };
    if (locked && expected === "note") payload.editor!.drawings[source.timeline.steps[0].id][0].locked = true;
    const props: CourtEditorCanvasProps = { payload, stepIndex: 0, landscape, tool: "select", selected: [], zoom: 1, pan: { x: 0, y: 0 }, half: false, plain: false, color: "#ffffff", dashed: false, grid: false,
      onSelect: jest.fn(), onMove: jest.fn(), onDraw: jest.fn(), onEditText: jest.fn(), onAddPlayer: jest.fn(), onPan: jest.fn(), onZoom: jest.fn() };
    act(() => { tree = TestRenderer.create(React.createElement(CourtEditorCanvas, props)); });
    const width = landscape ? 844 : 390, height = landscape ? 390 : 844;
    const host = tree.root.findAllByType(View).find(node => typeof node.props.onLayout === "function")!;
    act(() => host.props.onLayout({ nativeEvent: { layout: { width, height } } }));
    const bounds = sceneBounds(landscape), point = scenePoint({ x: .5, y: .5 }, landscape), scale = Math.min(width / bounds.width, height / bounds.height);
    const x = (width - bounds.width * scale) / 2 + (point.x - bounds.x) * scale;
    const y = (height - bounds.height * scale) / 2 + (point.y - bounds.y) * scale;
    act(() => responder.onPanResponderGrant!({ nativeEvent: { locationX: x, locationY: y } } as never, {} as never));
    expect(props.onSelect).toHaveBeenLastCalledWith([expected]);
    act(() => responder.onPanResponderMove!({} as never, { dx: 12, dy: 0 } as never));
    act(() => responder.onPanResponderRelease!({} as never, { dx: 12, dy: 0 } as never));
    if (locked) expect(props.onMove).not.toHaveBeenCalled();
    else expect(props.onMove).toHaveBeenCalledWith([expected], expect.any(Object), undefined, false);
    expect(props.onDraw).not.toHaveBeenCalled();
  });
});
