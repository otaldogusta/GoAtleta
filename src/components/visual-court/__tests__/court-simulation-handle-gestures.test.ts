import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { PanResponder, Platform, View, type PanResponderCallbacks } from "react-native";
import { configureCourtSimulation, getCourtSimulation, sampleCourtSimulation } from "../../../core/court-simulation";
import { simulationFloorPoint } from "../../../core/court-simulation-display";
import { duplicateStep, newCourtBoard } from "../../../core/visual-court-editor";
import type { CourtPoint, CourtVisualPayload } from "../../../core/visual-court";
import { CourtEditorCanvas, type CourtEditorCanvasProps } from "../CourtEditorCanvas";
import { sceneBounds, scenePoint } from "../CourtEditorScene";

jest.mock("../CourtEditorScene", () => ({ ...jest.requireActual("../CourtEditorScene"), CourtEditorScene: "CourtEditorScene" }));
jest.mock("../CourtSelectionActions", () => ({ CourtSelectionActions: () => null }));
jest.mock("../../../ui/icon-registry", () => ({ GoAtletaIcon: "GoAtletaIcon" }));

const WIDTH = 1000, HEIGHT = 600;
type Kind = "hit" | "target";

describe("2D simulation handle gestures", () => {
  const platformDescriptor = Object.getOwnPropertyDescriptor(Platform, "OS");
  let tree: TestRenderer.ReactTestRenderer | undefined;
  let responders: PanResponderCallbacks;

  const props = (landscape = false): CourtEditorCanvasProps => {
    const base = configureCourtSimulation(newCourtBoard("Ataque compartilhado"), 0, { mode: "attack", blockers: 2 });
    return {
      payload: duplicateStep(base, 0).payload, stepIndex: 0, landscape, tool: "select", selected: [],
      color: "#19c87b", dashed: true, grid: false, progress: 0, zoom: 1, pan: { x: 0, y: 0 }, half: false, plain: false,
      onSelect: jest.fn(), onMove: jest.fn(), onDraw: jest.fn(), onEditText: jest.fn(), onAddPlayer: jest.fn(), onPan: jest.fn(), onZoom: jest.fn(),
      onSimulationHandle: jest.fn(),
    };
  };
  const mount = (value: CourtEditorCanvasProps) => {
    act(() => { tree = TestRenderer.create(React.createElement(CourtEditorCanvas, value)); });
    const host = tree!.root.findAllByType(View).find(node => typeof node.props.onLayout === "function")!;
    act(() => host.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: WIDTH, height: HEIGHT } } }));
  };
  const update = (value: CourtEditorCanvasProps) => act(() => tree!.update(React.createElement(CourtEditorCanvas, value)));
  const shownPayload = (): CourtVisualPayload => tree!.root.findByType("CourtEditorScene").props.payload;
  const handle = (value: CourtEditorCanvasProps, kind: Kind): CourtPoint => {
    const frame = sampleCourtSimulation(value.payload, value.stepIndex, 0)!;
    return simulationFloorPoint(kind === "hit" ? frame.flight!.hit : frame.attackTarget!);
  };
  const pixel = (value: CourtEditorCanvasProps, point: CourtPoint): CourtPoint => {
    const base = sceneBounds(value.landscape, value.half), at = scenePoint(point, value.landscape);
    const bounds = { x: base.x + base.width * (1 - 1 / value.zoom) / 2 - value.pan.x, y: base.y + base.height * (1 - 1 / value.zoom) / 2 - value.pan.y, width: base.width / value.zoom, height: base.height / value.zoom };
    const scale = Math.min(WIDTH / bounds.width, HEIGHT / bounds.height);
    return { x: (WIDTH - bounds.width * scale) / 2 + (at.x - bounds.x) * scale, y: (HEIGHT - bounds.height * scale) / 2 + (at.y - bounds.y) * scale };
  };
  const start = (at: CourtPoint) => act(() => responders.onPanResponderGrant!({ nativeEvent: { locationX: at.x, locationY: at.y } } as never, {} as never));
  const move = (from: CourtPoint, to: CourtPoint) => act(() => responders.onPanResponderMove!({} as never, { dx: to.x - from.x, dy: to.y - from.y } as never));
  const release = (from: CourtPoint, to: CourtPoint) => act(() => responders.onPanResponderRelease!({} as never, { dx: to.x - from.x, dy: to.y - from.y } as never));
  const terminate = () => act(() => responders.onPanResponderTerminate!({} as never, {} as never));
  const expectPoint = (actual: CourtPoint, expected: CourtPoint) => {
    expect(actual.x).toBeCloseTo(expected.x, 8);
    expect(actual.y).toBeCloseTo(expected.y, 8);
  };

  beforeEach(() => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" });
    jest.spyOn(PanResponder, "create").mockImplementation(config => { responders = config; return { panHandlers: {} }; });
  });
  afterEach(() => {
    if (tree) act(() => tree!.unmount());
    tree = undefined;
    jest.restoreAllMocks();
    if (platformDescriptor) Object.defineProperty(Platform, "OS", platformDescriptor);
  });

  it.each(["hit", "target"] as const)("previews %s locally and commits the final release point once", kind => {
    const value = props(kind === "target"), snapshot = JSON.stringify(value.payload);
    const origin = handle(value, kind), from = pixel(value, origin);
    const previewPoint = { x: origin.x + .055, y: origin.y + .025 }, finalPoint = { x: origin.x + .1, y: origin.y + .045 };
    mount(value);
    start(from);
    move(from, pixel(value, previewPoint));
    expect(value.onSimulationHandle).not.toHaveBeenCalled();
    expect(value.onMove).not.toHaveBeenCalled();
    expect(value.onDraw).not.toHaveBeenCalled();
    const previewSample = sampleCourtSimulation(shownPayload(), value.stepIndex, 0)!;
    expectPoint(simulationFloorPoint(kind === "hit" ? previewSample.flight!.hit : previewSample.attackTarget!), previewPoint);
    expect(JSON.stringify(value.payload)).toBe(snapshot);
    release(from, pixel(value, finalPoint));
    expect(value.onSimulationHandle).toHaveBeenCalledTimes(1);
    const command = (value.onSimulationHandle as jest.Mock).mock.calls[0][0];
    expect(command.kind).toBe(kind);
    expectPoint(command.point, finalPoint);
    expect(shownPayload()).toBe(value.payload);
    const settings = getCourtSimulation(shownPayload(), value.stepIndex)!.attackSettings;
    expect(kind === "hit" ? settings.hitOverride : settings.targetOverride).toBeNull();
    expect(JSON.stringify(value.payload)).toBe(snapshot);
  });

  it("discards an interrupted preview without committing or moving an actor", () => {
    const value = props(), origin = handle(value, "hit"), from = pixel(value, origin);
    mount(value);
    start(from);
    move(from, pixel(value, { x: origin.x + .08, y: origin.y + .03 }));
    expect(shownPayload()).not.toBe(value.payload);
    terminate();
    expect(value.onSimulationHandle).not.toHaveBeenCalled();
    expect(value.onMove).not.toHaveBeenCalled();
    expect(shownPayload()).toBe(value.payload);
  });

  it("preserves a grab offset under zoom and pan in landscape orientation", () => {
    const value = { ...props(true), zoom: 1.7, pan: { x: 100, y: -80 } };
    const origin = handle(value, "target"), center = pixel(value, origin), offset = { x: -7, y: 5 };
    const from = { x: center.x + offset.x, y: center.y + offset.y };
    const desired = { x: origin.x + .05, y: origin.y + .04 }, destination = pixel(value, desired);
    const to = { x: destination.x + offset.x, y: destination.y + offset.y };
    mount(value);
    start(from);
    move(from, to);
    expect(value.onSimulationHandle).not.toHaveBeenCalled();
    expectPoint(simulationFloorPoint(sampleCourtSimulation(shownPayload(), value.stepIndex, 0)!.attackTarget!), desired);
    release(from, to);
    expect(value.onSimulationHandle).toHaveBeenCalledTimes(1);
    const command = (value.onSimulationHandle as jest.Mock).mock.calls[0][0];
    expect(command.kind).toBe("target");
    expectPoint(command.point, desired);
    expect(value.onMove).not.toHaveBeenCalled();
  });

  it.each(["hit", "target"] as const)("bounds an out-of-court %s drag using the same limits as 3D", kind => {
    const value = props(), snapshot = JSON.stringify(value.payload), from = pixel(value, handle(value, kind));
    const outside = kind === "hit" ? { x: 10, y: 10 } : { x: -10, y: -10 };
    const expected = simulationFloorPoint(kind === "hit" ? [4.43, 3, 4.4] : [-9, .12, -12]);
    const to = pixel(value, outside);
    mount(value);
    start(from);
    move(from, to);
    const previewSample = sampleCourtSimulation(shownPayload(), value.stepIndex, 0)!;
    expectPoint(simulationFloorPoint(kind === "hit" ? previewSample.flight!.hit : previewSample.attackTarget!), expected);
    expect(value.onSimulationHandle).not.toHaveBeenCalled();
    release(from, to);
    expect(value.onSimulationHandle).toHaveBeenCalledTimes(1);
    const command = (value.onSimulationHandle as jest.Mock).mock.calls[0][0];
    expect(command.kind).toBe(kind);
    expectPoint(command.point, expected);
    expect(value.onMove).not.toHaveBeenCalled();
    expect(JSON.stringify(value.payload)).toBe(snapshot);
  });

  it.each(["hit", "target"] as const)("does not commit a click on %s without a drag", kind => {
    const value = props(), from = pixel(value, handle(value, kind));
    mount(value);
    start(from);
    release(from, from);
    expect(value.onSimulationHandle).not.toHaveBeenCalled();
    expect(value.onMove).not.toHaveBeenCalled();
    expect(value.onDraw).not.toHaveBeenCalled();
    expect(shownPayload()).toBe(value.payload);
  });

  it.each(["payload", "step", "tool", "disabled"] as const)("cancels a pending handle when %s props become stale", reason => {
    const value = props(), origin = handle(value, "target"), from = pixel(value, origin), to = pixel(value, { x: origin.x + .08, y: origin.y + .03 });
    mount(value);
    start(from);
    move(from, to);
    const next: CourtEditorCanvasProps = reason === "payload" ? { ...value, payload: { ...value.payload, editor: { ...value.payload.editor!, title: "Outra versão" } } }
      : reason === "step" ? { ...value, stepIndex: 1 }
      : reason === "tool" ? { ...value, tool: "animate" }
      : { ...value, disabled: true };
    update(next);
    release(from, to);
    expect(value.onSimulationHandle).not.toHaveBeenCalled();
    expect(value.onMove).not.toHaveBeenCalled();
    expect(value.onDraw).not.toHaveBeenCalled();
    expect(shownPayload()).toBe(next.payload);
  });
});
