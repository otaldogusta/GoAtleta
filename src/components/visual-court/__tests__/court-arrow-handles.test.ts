import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { PanResponder, Platform, View, type PanResponderCallbacks } from "react-native";
import { newCourtBoard, frameDrawings, type CourtDrawing } from "../../../core/visual-court-editor";
import type { CourtPoint } from "../../../core/visual-court";
import { CourtEditorCanvas, type CourtEditorCanvasProps } from "../CourtEditorCanvas";
import { sceneBounds, scenePoint } from "../CourtEditorScene";
import { courtArrowHandles, courtCurveControl, courtLinkedArrowGrip, moveCourtArrowHandle, straightenCourtArrow, type CourtArrowHandleKind } from "../court-arrow-geometry";

jest.mock("react-native", () => {
  const native = jest.requireActual<typeof import("react-native")>("react-native"), runtime = jest.requireActual<typeof import("react")>("react");
  const descriptors = Object.getOwnPropertyDescriptors(native);
  descriptors.View = { configurable: true, enumerable: true, writable: true, value: runtime.forwardRef((props: object, ref: React.Ref<unknown>) => runtime.createElement("ArrowView", { ...props, ref })) };
  return Object.create(Object.getPrototypeOf(native), descriptors);
});
jest.mock("../CourtEditorScene", () => ({ ...jest.requireActual("../CourtEditorScene"), CourtEditorScene: "Scene" }));
jest.mock("../CourtSelectionActions", () => ({ CourtSelectionActions: () => null }));
jest.mock("../CourtEditorControls", () => ({ ...jest.requireActual("../CourtEditorControls"), CourtToolIcon: "ToolIcon" }));

const a = { x: .2, y: .35 }, b = { x: .8, y: .65 }, width = 1000, height = 600;
const drawing = (): CourtDrawing => ({ id: "arrow", kind: "arrow", points: [a, b], color: "#fff", dashed: true, size: 32, rotation: 0 });
const expectPoint = (actual: CourtPoint, expected: CourtPoint) => { expect(actual.x).toBeCloseTo(expected.x, 8); expect(actual.y).toBeCloseTo(expected.y, 8); };

describe("authored arrow handle gestures", () => {
  const platform = Object.getOwnPropertyDescriptor(Platform, "OS");
  let tree: TestRenderer.ReactTestRenderer, responder: PanResponderCallbacks, props: CourtEditorCanvasProps;
  const makeProps = (extra: Partial<CourtEditorCanvasProps> = {}): CourtEditorCanvasProps => {
    const payload = newCourtBoard(); payload.actors = []; payload.timeline.steps[0].visibleActorIds = [];
    payload.editor!.drawings[payload.timeline.steps[0].id] = [drawing()];
    return { payload, stepIndex: 0, landscape: false, tool: "select", selected: ["arrow"], color: "#fff", dashed: true, grid: false, zoom: 1, pan: { x: 0, y: 0 }, half: false, plain: false,
      onSelect: jest.fn(), onMove: jest.fn(), onDraw: jest.fn(), onEditArrow: jest.fn(), onEditText: jest.fn(), onAddPlayer: jest.fn(), onPan: jest.fn(), onZoom: jest.fn(), ...extra };
  };
  const layout = () => act(() => tree.root.findAllByType(View).find(node => node.props.onLayout)!.props.onLayout({ nativeEvent: { layout: { width, height } } }));
  const mount = (extra: Partial<CourtEditorCanvasProps> = {}) => { props = makeProps(extra); act(() => { tree = TestRenderer.create(React.createElement(CourtEditorCanvas, props)); }); layout(); };
  const update = (extra: Partial<CourtEditorCanvasProps>) => { props = { ...props, ...extra }; act(() => tree.update(React.createElement(CourtEditorCanvas, props))); };
  const shown = () => frameDrawings(tree.root.findByType("Scene").props.payload, props.stepIndex)[0];
  const pixel = (point: CourtPoint) => {
    const base = sceneBounds(props.landscape, props.half), at = scenePoint(point, props.landscape);
    const bounds = { x: base.x + base.width * (1 - 1 / props.zoom) / 2 - props.pan.x, y: base.y + base.height * (1 - 1 / props.zoom) / 2 - props.pan.y, width: base.width / props.zoom, height: base.height / props.zoom };
    const scale = Math.min(width / bounds.width, height / bounds.height);
    return { x: (width - bounds.width * scale) / 2 + (at.x - bounds.x) * scale, y: (height - bounds.height * scale) / 2 + (at.y - bounds.y) * scale };
  };
  const handle = (kind: CourtArrowHandleKind) => courtArrowHandles(frameDrawings(props.payload, props.stepIndex)[0], props.landscape).find(item => item.kind === kind)!.point;
  const grip = (kind: CourtArrowHandleKind) => { const { left, top } = tree.root.findByProps({ nativeID: `court-arrow-handle-${kind}` }).props.style; return { x: left + 22, y: top + 22 }; };
  const start = (at: CourtPoint) => act(() => responder.onPanResponderGrant!({ nativeEvent: { locationX: at.x, locationY: at.y } } as never, {} as never));
  const move = (from: CourtPoint, to: CourtPoint) => act(() => responder.onPanResponderMove!({} as never, { dx: to.x - from.x, dy: to.y - from.y } as never));
  const release = (from: CourtPoint, to: CourtPoint) => act(() => responder.onPanResponderRelease!({} as never, { dx: to.x - from.x, dy: to.y - from.y } as never));
  const bend = (legacy = false) => {
    const arrow = frameDrawings(props.payload, 0)[0]; arrow.kind = "curve"; arrow.points = [{ x: .1, y: .3 }, { x: .6, y: .2 }, { x: .9, y: .7 }];
    if (!legacy) arrow.curveMode = "through-point";
    update({ payload: { ...props.payload } });
  };
  const tap = (at: CourtPoint) => { start(at); release(at, at); };
  const addBall = (extra: Partial<CourtDrawing> = {}) => {
    const ball: CourtDrawing = { id: "ball", kind: "ball", points: [{ x: .65, y: .25 }], color: "#ff0", size: 32, rotation: 0, ...extra };
    props.payload.editor!.drawings[props.payload.timeline.steps[0].id].push(ball); update({ payload: { ...props.payload } }); return ball;
  };
  beforeEach(() => { Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" }); jest.spyOn(PanResponder, "create").mockImplementation(value => { responder = value; return { panHandlers: {} }; }); });
  afterEach(() => { if (tree) act(() => tree.unmount()); jest.restoreAllMocks(); if (platform) Object.defineProperty(Platform, "OS", platform); });

  it.each(["start", "middle", "end"] as const)("previews %s without moving the selection and commits the release once", kind => {
    mount(); const snapshot = JSON.stringify(props.payload), original = handle(kind), from = pixel(original), next = { x: original.x + .09, y: original.y - .08 }, final = { x: original.x + .13, y: original.y - .1 };
    expect(tree.root.findByProps({ nativeID: `court-arrow-handle-${kind}` }).props.style).toMatchObject({ width: 44, height: 44 });
    start(from); move(from, pixel(next));
    expectPoint(courtArrowHandles(shown(), false).find(item => item.kind === kind)!.point, next);
    expect(props.onEditArrow).not.toHaveBeenCalled(); expect(props.onSelect).not.toHaveBeenCalled(); expect(props.onMove).not.toHaveBeenCalled(); expect(props.onDraw).not.toHaveBeenCalled();
    release(from, pixel(final)); expect(props.onEditArrow).toHaveBeenCalledTimes(1);
    const [id, shape] = (props.onEditArrow as jest.Mock).mock.calls[0]; expect(id).toBe("arrow");
    expectPoint(courtArrowHandles(shape, false).find(item => item.kind === kind)!.point, final);
    expectPoint(shape.points[0], kind === "start" ? final : a); expectPoint(shape.points[shape.points.length - 1], kind === "end" ? final : b);
    expect(JSON.stringify(props.payload)).toBe(snapshot); expect(shown()).toEqual(drawing());
    if (kind === "middle") expect(shape).toMatchObject({ kind: "curve", curveMode: "through-point" });
  });

  it.each([false, true])("keeps the grab offset correct with zoom, pan and landscape=%s", landscape => {
    mount({ landscape, zoom: 1.6, pan: { x: 60, y: -35 } });
    const origin = handle("middle"), center = pixel(origin), offset = { x: 8, y: -6 }, from = { x: center.x + offset.x, y: center.y + offset.y }, desired = { x: origin.x + .1, y: origin.y - .1 }, target = pixel(desired), to = { x: target.x + offset.x, y: target.y + offset.y };
    start(from); move(from, to); release(from, to);
    expectPoint((props.onEditArrow as jest.Mock).mock.calls[0][1].points[1], desired);
  });

  it.each([false, true])("snaps only the start to a visible ball within 22 pixels with zoom and landscape=%s", landscape => {
    mount({ landscape, zoom: 1.6, pan: { x: 60, y: -35 } }); const ball = addBall({ locked: true });
    const from = pixel(handle("start")), center = pixel(ball.points[0]), to = { x: center.x + 12, y: center.y };
    const snapshot = JSON.stringify(props.payload); start(from); move(from, to);
    expectPoint(shown().points[0], ball.points[0]); expect(shown().startBallId).toBe(ball.id);
    expect(tree.root.findAllByType(View).filter(node => node.props.testID === "court-arrow-ball-snap")).toHaveLength(1);
    expect(props.onEditArrow).not.toHaveBeenCalled(); release(from, to);
    expect(props.onEditArrow).toHaveBeenCalledTimes(1); const shape = (props.onEditArrow as jest.Mock).mock.calls[0][1];
    expect(shape.startBallId).toBe(ball.id); expectPoint(shape.points[0], ball.points[0]); expectPoint(shape.points[1], b);
    expect(JSON.stringify(props.payload)).toBe(snapshot); expect(props.onMove).not.toHaveBeenCalled();
  });

  it("detaches the start away from its ball and leaves the other end fixed", () => {
    mount(); const ball = addBall({ points: [a] }); frameDrawings(props.payload, 0)[0].startBallId = ball.id; update({ payload: { ...props.payload } });
    expect(tree.root.findByProps({ nativeID: "court-arrow-handle-start" }).props.accessibilityHint).toContain("Ligado à bola");
    const origin = pixel(a), from = grip("start"), target = { x: .45, y: .1 }, at = pixel(target), to = { x: from.x + at.x - origin.x, y: from.y + at.y - origin.y };
    expect(Math.hypot(from.x - origin.x, from.y - origin.y)).toBeGreaterThanOrEqual(44 - 1e-8);
    start(from); move(from, to);
    expect(shown().startBallId).toBeUndefined(); expect(tree.root.findAllByProps({ testID: "court-arrow-ball-snap" })).toHaveLength(0);
    expectPoint(grip("start"), to); // The separate grip follows the finger without jumping to the ball center.
    release(from, to); const shape = (props.onEditArrow as jest.Mock).mock.calls[0][1];
    expect(shape.startBallId).toBeUndefined(); expectPoint(shape.points[0], target); expectPoint(shape.points[1], b);
  });

  it.each([false, true])("drags the ball and every linked start directly while its arrow is selected, landscape=%s", landscape => {
    mount({ landscape, zoom: 1.6, pan: { x: 30, y: -15 } }); const ball = addBall({ points: [a] }), stepId = props.payload.timeline.steps[0].id;
    const arrow = frameDrawings(props.payload, 0)[0]; arrow.startBallId = ball.id;
    props.payload.editor!.drawings[stepId].push({ ...arrow, id: "second", points: [a, { x: .5, y: .8 }], locked: true });
    props.payload.editor!.layerOrder = { [stepId]: [ball.id, arrow.id, "second"].map(id => ({ kind: "drawing", id })) };
    update({ payload: { ...props.payload } }); const from = pixel(a), destination = { x: a.x + .12, y: a.y + .07 }, to = pixel(destination);
    start(from); expect(props.onSelect).toHaveBeenCalledWith([ball.id]); move(from, to);
    const preview = frameDrawings(tree.root.findByType("Scene").props.payload, 0);
    for (const id of [ball.id, arrow.id, "second"]) expectPoint(preview.find(d => d.id === id)!.points[0], destination);
    expect(preview.find(d => d.id === arrow.id)!.startBallId).toBe(ball.id); expect(props.onEditArrow).not.toHaveBeenCalled();
    release(from, to); expect(props.onMove).toHaveBeenCalledTimes(1); expect((props.onMove as jest.Mock).mock.calls[0][0]).toEqual([ball.id]); expect(props.onEditArrow).not.toHaveBeenCalled();
  });

  it("keeps unrelated upper layers ahead of the ball and respects a locked ball", () => {
    mount(); const ball = addBall({ points: [a] }), stepId = props.payload.timeline.steps[0].id, arrow = frameDrawings(props.payload, 0)[0]; arrow.startBallId = ball.id;
    const cone: CourtDrawing = { ...ball, id: "cone", kind: "cone" }; props.payload.editor!.drawings[stepId].push(cone);
    props.payload.editor!.layerOrder = { [stepId]: [ball.id, arrow.id, cone.id].map(id => ({ kind: "drawing", id })) }; update({ payload: { ...props.payload } });
    const from = pixel(a); tap(from); expect(props.onSelect).toHaveBeenLastCalledWith([cone.id]);
    cone.hidden = true; ball.locked = true; update({ payload: { ...props.payload } });
    start(from); move(from, { x: from.x + 70, y: from.y + 20 }); release(from, { x: from.x + 70, y: from.y + 20 });
    expect(props.onSelect).toHaveBeenLastCalledWith([ball.id]); expect(props.onMove).not.toHaveBeenCalled(); expect(props.onEditArrow).not.toHaveBeenCalled();
  });

  it("grabs the ball at its paused animation position without dropping the link", () => {
    mount({ progress: 1 }); const current = { x: .55, y: .2 }, ball = addBall({ points: [a], motion: [a, current] });
    frameDrawings(props.payload, 0)[0].startBallId = ball.id; update({ payload: { ...props.payload } });
    const from = pixel(current), destination = { x: .7, y: .3 }, to = pixel(destination); start(from); move(from, to);
    expect(props.onSelect).toHaveBeenCalledWith([ball.id]); expectPoint(shown().points[0], destination); expect(shown().startBallId).toBe(ball.id);
    release(from, to); expect(props.onMove).toHaveBeenCalledTimes(1); expect(props.onEditArrow).not.toHaveBeenCalled();
  });

  it("cancels the offset grip preview while preserving its binding", () => {
    mount(); const ball = addBall({ points: [a] }); frameDrawings(props.payload, 0)[0].startBallId = ball.id; update({ payload: { ...props.payload } });
    const from = grip("start"); start(from); move(from, { x: from.x + 70, y: from.y - 50 });
    act(() => responder.onPanResponderTerminate!({} as never, {} as never));
    expect(shown().startBallId).toBe(ball.id); expectPoint(grip("start"), from); expect(props.onEditArrow).not.toHaveBeenCalled(); expect(props.onMove).not.toHaveBeenCalled();
  });

  it("preserves the binding when moving the middle/end and when straightening", () => {
    mount(); const ball = addBall({ points: [a] }); frameDrawings(props.payload, 0)[0].startBallId = ball.id; update({ payload: { ...props.payload } });
    for (const kind of ["middle", "end"] as const) { const origin = handle(kind), from = pixel(origin), to = pixel({ x: origin.x + .1, y: origin.y - .1 }); start(from); move(from, to); release(from, to); }
    expect((props.onEditArrow as jest.Mock).mock.calls.every(([, shape]) => shape.startBallId === ball.id)).toBe(true);
    bend(); ball.points = [frameDrawings(props.payload, 0)[0].points[0]]; update({ payload: { ...props.payload } }); const from = pixel(handle("middle")); tap(from); tap(from);
    expect((props.onEditArrow as jest.Mock).mock.lastCall[1]).toMatchObject({ kind: "arrow", startBallId: ball.id });
  });

  it("ignores hidden balls and outside tolerance, and cancels an attachment without committing", () => {
    mount(); const ball = addBall({ hidden: true }), from = pixel(a), center = pixel(ball.points[0]);
    start(from); move(from, center); release(from, center); expect((props.onEditArrow as jest.Mock).mock.lastCall[1].startBallId).toBeUndefined();
    ball.hidden = false; update({ payload: { ...props.payload } }); (props.onEditArrow as jest.Mock).mockClear();
    const outside = { x: center.x + 23, y: center.y }; start(from); move(from, outside); release(from, outside);
    expect((props.onEditArrow as jest.Mock).mock.lastCall[1].startBallId).toBeUndefined(); (props.onEditArrow as jest.Mock).mockClear();
    start(from); move(from, center); act(() => responder.onPanResponderTerminate!({} as never, {} as never));
    expect(props.onEditArrow).not.toHaveBeenCalled(); expect(shown().startBallId).toBeUndefined();
  });

  it.each(["arrow", "curve"] as const)("starts a new %s at the ball center and persists the binding once", tool => {
    mount({ tool, selected: [] }); const ball = addBall(), center = pixel(ball.points[0]), from = { x: center.x - 10, y: center.y }, to = pixel(b);
    start(from); move(from, to); expect(props.onDraw).not.toHaveBeenCalled(); release(from, to);
    expect(props.onDraw).toHaveBeenCalledTimes(1); const created = (props.onDraw as jest.Mock).mock.calls[0][0];
    expect(created).toMatchObject({ kind: tool, startBallId: ball.id }); expectPoint(created.points[0], ball.points[0]); expectPoint(created.points[1], b);
  });

  it.each(["payload", "tool", "readOnly", "disabled"])("cancels a newly linked arrow after %s changes", reason => {
    mount({ tool: "arrow", selected: [] }); const ball = addBall(), from = pixel(ball.points[0]), to = pixel(b); start(from); move(from, to);
    update(reason === "payload" ? { payload: { ...props.payload } } : reason === "tool" ? { tool: "select" } : { [reason]: true }); release(from, to);
    expect(props.onDraw).not.toHaveBeenCalled(); expect(tree.root.findAllByProps({ testID: "court-arrow-ball-snap" })).toHaveLength(0);
  });

  it("shows and edits the linked start at the sampled ball even when the ball is hidden", () => {
    mount({ progress: 1 }); const ball = addBall({ points: [a], motion: [a, { x: .4, y: .2 }], hidden: true });
    frameDrawings(props.payload, 0)[0].startBallId = ball.id; update({ payload: { ...props.payload } });
    const at = pixel(ball.motion![1]), node = tree.root.findByProps({ nativeID: "court-arrow-handle-start" });
    expect(node.props.style.left).toBeCloseTo(at.x - 22); expect(node.props.style.top).toBeCloseTo(at.y - 22);
    start(at); move(at, pixel({ x: .7, y: .1 })); release(at, pixel({ x: .7, y: .1 }));
    expectPoint((props.onEditArrow as jest.Mock).mock.lastCall[1].points[0], { x: .7, y: .1 });
  });

  it("ignores taps, cancels preview and bounds the visible middle before preview and commit", () => {
    mount(); const from = pixel(handle("middle")); start(from); release(from, from); expect(props.onEditArrow).not.toHaveBeenCalled();
    start(from); move(from, pixel({ x: 5, y: -5 })); expectPoint(shown().points[1], { x: 1.2, y: -.15 });
    act(() => responder.onPanResponderTerminate!({} as never, {} as never)); expect(shown()).toEqual(drawing()); expect(props.onEditArrow).not.toHaveBeenCalled();
    start(from); move(from, pixel({ x: 5, y: -5 })); release(from, pixel({ x: 5, y: -5 })); expectPoint((props.onEditArrow as jest.Mock).mock.calls[0][1].points[1], { x: 1.2, y: -.15 });
  });

  it.each(["payload", "step", "tool", "selection", "disabled", "readOnly", "locked", "hidden"])("discards the pending gesture when %s changes", reason => {
    mount(); const from = pixel(handle("middle")), to = pixel({ x: .65, y: .3 });
    props.payload.timeline.steps.push({ ...props.payload.timeline.steps[0], id: "other" });
    start(from); move(from, to);
    if (reason === "locked" || reason === "hidden") { frameDrawings(props.payload, 0)[0][reason] = true; update({ payload: { ...props.payload } }); }
    else update(reason === "payload" ? { payload: { ...props.payload } } : reason === "step" ? { stepIndex: 1 } : reason === "tool" ? { tool: "pan" } : reason === "selection" ? { selected: [] } : { [reason]: true });
    release(from, to); expect(props.onEditArrow).not.toHaveBeenCalled(); expect(props.onMove).not.toHaveBeenCalled();
    expect(tree.root.findByType("Scene").props.payload).toBe(props.payload);
  });

  it("offers handles only for one editable authored arrow, never for simulation trails or other drawings", () => {
    mount(); expect(tree.root.findAll(node => typeof node.props.nativeID === "string" && node.props.nativeID.startsWith("court-arrow-handle-")).length).toBeGreaterThan(0);
    const absent = () => expect(tree.root.findAll(node => typeof node.props.nativeID === "string" && node.props.nativeID.startsWith("court-arrow-handle-"))).toHaveLength(0);
    update({ selected: ["arrow", "other"] }); absent(); update({ selected: ["trail"] }); absent();
    update({ selected: ["arrow"], payload: { ...props.payload, editor: { ...props.payload.editor!, hiddenLayers: ["drawings"] } } }); absent();
    frameDrawings(props.payload, 0)[0].kind = "pen"; update({ payload: { ...props.payload, editor: { ...props.payload.editor!, hiddenLayers: [] } } }); absent();
  });

  it("picks the authored curve on its visible middle rather than the old implicit arc", () => {
    mount({ selected: [] }); const curve = frameDrawings(props.payload, 0)[0]; curve.kind = "curve"; curve.curveMode = "through-point"; curve.points = [a, { x: .5, y: .12 }, b]; update({ payload: { ...props.payload } });
    const from = pixel(curve.points[1]); start(from); release(from, from); expect(props.onSelect).toHaveBeenCalledWith(["arrow"]);
  });

  it.each([false, true])("straightens two middle taps once, preserving current endpoints for legacy=%s", legacy => {
    let now = 1000; jest.spyOn(Date, "now").mockImplementation(() => now);
    mount(); bend(legacy); const from = pixel(handle("middle")), current = shown(), snapshot = JSON.stringify(props.payload);
    tap(from); expect(props.onEditArrow).not.toHaveBeenCalled(); now += 120; tap(from);
    expect(props.onEditArrow).toHaveBeenCalledTimes(1);
    expect(props.onEditArrow).toHaveBeenCalledWith("arrow", { kind: "arrow", points: [current.points[0], current.points[current.points.length - 1]] });
    expect(JSON.stringify(props.payload)).toBe(snapshot); expect(props.onSelect).not.toHaveBeenCalled(); expect(props.onMove).not.toHaveBeenCalled();
  });

  it("limits tap timing, distance and duration and ignores straight arrows and endpoint double taps", () => {
    let now = 1000; jest.spyOn(Date, "now").mockImplementation(() => now);
    mount(); let from = pixel(handle("middle")); tap(from); tap(from); expect(props.onEditArrow).not.toHaveBeenCalled();
    bend(); from = pixel(handle("middle")); tap(from); now += 351; tap(from); expect(props.onEditArrow).not.toHaveBeenCalled();
    start(from); now += 351; release(from, from); tap(from); expect(props.onEditArrow).not.toHaveBeenCalled();
    for (const kind of ["start", "end"] as const) { const at = pixel(handle(kind)); tap(at); tap(at); }
    expect(props.onEditArrow).not.toHaveBeenCalled();
    const left = { x: from.x - 15, y: from.y }, right = { x: from.x + 15, y: from.y }; tap(left); tap(right); expect(props.onEditArrow).not.toHaveBeenCalled();
  });

  it.each(["drag", "cancel", "payload", "step", "selection", "locked", "hidden", "readOnly", "disabled", "tool"])("clears the first tap after %s before accepting another tap", reason => {
    jest.spyOn(Date, "now").mockReturnValue(1000); mount(); bend(); const from = pixel(handle("middle")); tap(from);
    if (reason === "drag") { start(from); move(from, { x: from.x + 10, y: from.y }); release(from, from); }
    else if (reason === "cancel") { start(from); act(() => responder.onPanResponderTerminate!({} as never, {} as never)); }
    else if (reason === "payload") update({ payload: { ...props.payload } });
    else if (reason === "step") { props.payload.timeline.steps.push({ ...props.payload.timeline.steps[0], id: "other" }); update({ stepIndex: 1 }); update({ stepIndex: 0 }); }
    else if (reason === "selection") { update({ selected: [] }); update({ selected: ["arrow"] }); }
    else if (reason === "locked" || reason === "hidden") { frameDrawings(props.payload, 0)[0][reason] = true; update({ payload: { ...props.payload } }); frameDrawings(props.payload, 0)[0][reason] = false; update({ payload: { ...props.payload } }); }
    else if (reason === "tool") { update({ tool: "pan" }); update({ tool: "select" }); }
    else { update({ [reason]: true }); update({ [reason]: false }); }
    tap(from); expect(props.onEditArrow).not.toHaveBeenCalled();
  });

  it("supports captured web pointer cancellation and keyboard movement before workspace shortcuts", () => {
    let now = 1000; jest.spyOn(Date, "now").mockImplementation(() => now);
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
    const previous = Object.getOwnPropertyDescriptor(globalThis, "window"), windows = new Map<string, (event: any) => void>(), events = new Map<string, (event: any) => void>();
    Object.defineProperty(globalThis, "window", { configurable: true, value: { addEventListener: (name: string, fn: (event: any) => void, capture = false) => windows.set(`${name}:${capture}`, fn), removeEventListener: (name: string, _fn: unknown, capture = false) => windows.delete(`${name}:${capture}`) } });
    try {
      props = makeProps(); const focus = jest.fn();
      act(() => { tree = TestRenderer.create(React.createElement(CourtEditorCanvas, props), { createNodeMock: element => element.props.onLayout ? { style: {}, getBoundingClientRect: () => ({ left: 0, top: 0, width, height }), setPointerCapture: jest.fn(), addEventListener: (name: string, fn: (event: any) => void) => events.set(name, fn), removeEventListener: (name: string) => events.delete(name) } : null }); }); layout();
      const target = { closest: (selector: string) => selector.includes("court-arrow-handle-") ? { id: "court-arrow-handle-middle", focus } : null };
      const send = (name: string, at: CourtPoint) => act(() => events.get(name)!({ type: name, pointerId: 1, button: 0, clientX: at.x, clientY: at.y, preventDefault: jest.fn(), target }));
      const from = pixel(handle("middle")), to = pixel({ x: .6, y: .3 });
      for (const cancel of ["pointercancel", "lostpointercapture"]) { send("pointerdown", from); send("pointermove", to); send(cancel, to); expect(shown()).toEqual(drawing()); }
      send("pointerdown", from); send("pointermove", to);
      const escape = { key: "Escape", target, preventDefault: jest.fn(), stopImmediatePropagation: jest.fn() }; act(() => windows.get("keydown:true")!(escape)); send("pointerup", to);
      expect(shown()).toEqual(drawing()); expect(props.onEditArrow).not.toHaveBeenCalled(); expect(escape.stopImmediatePropagation).toHaveBeenCalled();
      const key = { key: "ArrowUp", shiftKey: false, target, preventDefault: jest.fn(), stopImmediatePropagation: jest.fn() }; act(() => windows.get("keydown:true")!(key));
      expect(key.preventDefault).toHaveBeenCalled(); expect(key.stopImmediatePropagation).toHaveBeenCalled(); expect(props.onEditArrow).toHaveBeenCalledTimes(1); expect(props.onMove).not.toHaveBeenCalled(); expect(focus).toHaveBeenCalled();
      expect((props.onEditArrow as jest.Mock).mock.calls[0][1].kind).toBe("curve");
      (props.onEditArrow as jest.Mock).mockClear(); bend();
      const middle = pixel(handle("middle"));
      props.payload.editor!.drawings[props.payload.timeline.steps[0].id].push({ id: "text", kind: "text", text: "Nota", points: [handle("middle")], size: 32, color: "#fff", rotation: 0 }); update({ payload: { ...props.payload } });
      // Pointer capture retargets mouseup/dblclick to the canvas host.
      for (let i = 0; i < 2; i++) { send("pointerdown", middle); send("pointerup", middle); }
      const double = { clientX: middle.x, clientY: middle.y, target: { closest: () => null }, preventDefault: jest.fn() };
      act(() => events.get("dblclick")!(double));
      expect(props.onEditArrow).toHaveBeenCalledTimes(1); expect((props.onEditArrow as jest.Mock).mock.calls[0][1].kind).toBe("arrow"); expect(double.preventDefault).toHaveBeenCalled();
      expect(tree.root.findAllByProps({ accessibilityLabel: "Texto da anotação" })).toHaveLength(0);
      (props.onEditArrow as jest.Mock).mockClear();
      const enter = { key: "Enter", target, preventDefault: jest.fn(), stopImmediatePropagation: jest.fn() };
      act(() => windows.get("keydown:true")!(enter)); expect(props.onEditArrow).toHaveBeenCalledTimes(1); expect(enter.stopImmediatePropagation).toHaveBeenCalled();
      for (const id of ["court-arrow-handle-start", "court-arrow-handle-end", "tools-button"]) {
        const external = { key: "Enter", target: { closest: (selector: string) => id.startsWith("court-arrow-handle-") && selector.includes("court-arrow-handle-") ? { id } : null }, preventDefault: jest.fn(), stopImmediatePropagation: jest.fn() };
        act(() => windows.get("keydown:true")!(external)); expect(external.preventDefault).not.toHaveBeenCalled();
      }
      const ball = addBall({ points: [frameDrawings(props.payload, 0)[0].points[0]] }); frameDrawings(props.payload, 0)[0].startBallId = ball.id; update({ payload: { ...props.payload } });
      act(() => windows.get("keydown:true")!(enter)); expect((props.onEditArrow as jest.Mock).mock.lastCall[1].startBallId).toBe(ball.id);
      const startKey = { ...key, target: { closest: () => ({ id: "court-arrow-handle-start" }) } };
      act(() => windows.get("keydown:true")!(startKey)); expect((props.onEditArrow as jest.Mock).mock.lastCall[1].startBallId).toBeUndefined();
      now += 351; update({ selected: [] });
      act(() => events.get("dblclick")!({ clientX: middle.x, clientY: middle.y, target: { closest: () => null }, preventDefault: jest.fn() }));
      expect(tree.root.findAllByProps({ accessibilityLabel: "Texto da anotação" }).length).toBeGreaterThan(0);
    } finally { act(() => tree.unmount()); if (previous) Object.defineProperty(globalThis, "window", previous); else delete (globalThis as { window?: unknown }).window; }
  });
});

describe("arrow geometry compatibility", () => {
  it.each([{ x: 195, y: 422 }, { x: 2, y: 2 }, { x: 388, y: 2 }, { x: 2, y: 842 }, { x: 388, y: 842 }])("keeps the linked start grip reachable and separate near $x/$y", origin => {
    const grip = courtLinkedArrowGrip(origin, { x: 195, y: 300 }, 14, { width: 390, height: 844 });
    expect(grip.x).toBeGreaterThanOrEqual(22); expect(grip.x).toBeLessThanOrEqual(368); expect(grip.y).toBeGreaterThanOrEqual(22); expect(grip.y).toBeLessThanOrEqual(822);
    expect(Math.hypot(grip.x - origin.x, grip.y - origin.y)).toBeGreaterThanOrEqual(44 - 1e-8);
  });
  it("resets only the curve shape and returns the same object for an already straight arrow", () => {
    const straight = drawing(), curve = { ...straight, kind: "curve" as const, curveMode: "through-point" as const, points: [a, { x: .5, y: .1 }, b] };
    expect(straightenCourtArrow(straight)).toBe(straight);
    expect(straightenCourtArrow(curve)).toEqual(straight);
    expect(straightenCourtArrow({ ...curve, kind: "pen" })).toEqual({ ...curve, kind: "pen" });
  });
  it.each([false, true])("preserves legacy curves while materializing a moved endpoint in landscape=%s", landscape => {
    const legacy: CourtDrawing = { ...drawing(), kind: "curve", points: [a, { x: .7, y: .1 }, b] };
    const control = courtCurveControl(legacy, legacy.points.map(point => scenePoint(point, landscape)));
    const edited = moveCourtArrowHandle(legacy, "start", { x: .1, y: .3 }, landscape, 1);
    expect(edited.curveMode).toBe("through-point"); expectPoint(courtCurveControl(edited, edited.points.map(point => scenePoint(point, landscape))), control); expectPoint(edited.points[2], b);
    expect(legacy.points[1]).toEqual({ x: .7, y: .1 }); expect(legacy.curveMode).toBeUndefined();
  });
  it("turns a bent middle back into a straight arrow within the pixel tolerance and removes the flag", () => {
    const curve = moveCourtArrowHandle(drawing(), "middle", { x: .6, y: .3 }, false, .3);
    const straight = moveCourtArrowHandle(curve, "middle", { x: .5, y: .501 }, false, .3);
    expect(straight).toMatchObject({ id: "arrow", kind: "arrow", points: [a, b], color: "#fff", dashed: true }); expect(straight).not.toHaveProperty("curveMode");
    expect(moveCourtArrowHandle(drawing(), "start", a, false, 1)).toEqual(drawing());
  });
  it("preserves polyline interior points on endpoint edits", () => {
    const polyline = { ...drawing(), points: [a, { x: .3, y: .1 }, b] }, next = moveCourtArrowHandle(polyline, "end", { x: .9, y: .7 }, false, 1);
    expect(next.kind).toBe("arrow"); expect(next.points[1]).toBe(polyline.points[1]); expect(next.curveMode).toBeUndefined();
  });
});
