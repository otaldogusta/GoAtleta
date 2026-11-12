import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Platform, View } from "react-native";
import { newCourtBoard, type CourtDrawing, type DrawingKind } from "../../../core/visual-court-editor";
import { moveCourtLayer } from "../../../core/court-layers";
import type { CourtPoint } from "../../../core/visual-court";
import { CourtEditorCanvas, type CourtEditorCanvasProps } from "../CourtEditorCanvas";
import { fromScenePoint, sceneBounds, scenePoint } from "../CourtEditorScene";

jest.mock("react-native", () => {
  const native = jest.requireActual<typeof import("react-native")>("react-native"), runtime = jest.requireActual<typeof import("react")>("react");
  const descriptors = Object.getOwnPropertyDescriptors(native);
  descriptors.View = { configurable: true, enumerable: true, writable: true, value: runtime.forwardRef((props: object, ref: React.Ref<unknown>) => runtime.createElement("HoverView", { ...props, ref })) };
  return Object.create(Object.getPrototypeOf(native), descriptors);
});
jest.mock("../CourtEditorScene", () => ({ ...jest.requireActual("../CourtEditorScene"), CourtEditorScene: "Scene" }));
jest.mock("../CourtSelectionActions", () => ({ CourtSelectionActions: () => null }));

const center = { x: .5, y: .5 }, width = 1000, height = 650;
const drawing = (kind: DrawingKind): CourtDrawing => ({ id: "object", kind, points: [center, { x: .7, y: .65 }], text: "NOTE", color: "#fff", size: 48, rotation: 35 });

describe("2D pointer hover", () => {
  const platform = Object.getOwnPropertyDescriptor(Platform, "OS"), previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  let tree: TestRenderer.ReactTestRenderer, props: CourtEditorCanvasProps;
  let events: Map<string, (event: any) => void>, windows: Map<string, (event: any) => void>;
  let node: { style: { cursor?: string }; dataset: { hoveredId?: string }; [key: string]: unknown };
  const renderCount = jest.fn();
  const render = () => React.createElement(React.Profiler, { id: "canvas", onRender: renderCount }, React.createElement(CourtEditorCanvas, props));
  const mount = (extra: Partial<CourtEditorCanvasProps> = {}) => {
    const payload = newCourtBoard();
    payload.actors = [{ id: "player", role: "athlete", label: "1", color: "#fff", initialPosition: center }];
    payload.timeline.steps[0].actorPositions = { player: center }; payload.timeline.steps[0].visibleActorIds = ["player"];
    props = { payload, stepIndex: 0, landscape: false, tool: "select", selected: [], color: "#fff", dashed: false, grid: false, zoom: 1, pan: { x: 0, y: 0 }, half: false, plain: false,
      onSelect: jest.fn(), onMove: jest.fn(), onDraw: jest.fn(), onEditText: jest.fn(), onAddPlayer: jest.fn(), onPan: jest.fn(), onZoom: jest.fn(), ...extra };
    node = { style: {}, dataset: {}, getBoundingClientRect: () => ({ left: 13, top: 21, width, height }), setPointerCapture: jest.fn(), addEventListener: (name: string, fn: (event: any) => void) => events.set(name, fn), removeEventListener: (name: string) => events.delete(name) };
    act(() => { tree = TestRenderer.create(render(), { createNodeMock: element => element.props.onLayout ? node : null }); });
    act(() => tree.root.findAllByType(View).find(item => item.props.onLayout)!.props.onLayout({ nativeEvent: { layout: { width, height } } }));
  };
  const update = (extra: Partial<CourtEditorCanvasProps>) => { props = { ...props, ...extra }; act(() => tree.update(render())); };
  const object = (value: CourtDrawing) => { props.payload.actors = []; props.payload.timeline.steps[0].visibleActorIds = []; props.payload.editor!.drawings[props.payload.timeline.steps[0].id] = [value]; update({ payload: { ...props.payload } }); };
  const pixel = (point: CourtPoint) => {
    const b = sceneBounds(props.landscape, props.half), at = scenePoint(point, props.landscape);
    const bounds = { x: b.x + b.width * (1 - 1 / props.zoom) / 2 - props.pan.x, y: b.y + b.height * (1 - 1 / props.zoom) / 2 - props.pan.y, width: b.width / props.zoom, height: b.height / props.zoom };
    const scale = Math.min(width / bounds.width, height / bounds.height);
    return { clientX: 13 + (width - bounds.width * scale) / 2 + (at.x - bounds.x) * scale, clientY: 21 + (height - bounds.height * scale) / 2 + (at.y - bounds.y) * scale };
  };
  const send = (name = "pointermove", point = center, extra: object = {}) => act(() => events.get(name)!({ type: name, pointerId: 1, pointerType: "mouse", button: 0, buttons: 0, ...pixel(point), preventDefault: jest.fn(), target: { closest: () => null }, ...extra }));
  const shown = () => tree.root.findByType("Scene").props.hoveredId;
  const expectHover = (id?: string, cursor = id ? "grab" : "") => { expect(shown()).toBe(id); expect(node.dataset.hoveredId).toBe(id ?? ""); expect(node.style.cursor ?? "").toBe(cursor); };
  beforeEach(() => {
    events = new Map(); windows = new Map(); renderCount.mockClear();
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
    Object.defineProperty(globalThis, "window", { configurable: true, value: { addEventListener: (name: string, fn: (event: any) => void, capture = false) => windows.set(`${name}:${capture}`, fn), removeEventListener: (name: string, _fn: unknown, capture = false) => windows.delete(`${name}:${capture}`) } });
  });
  afterEach(() => { if (tree) act(() => tree.unmount()); if (platform) Object.defineProperty(Platform, "OS", platform); if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow); else Reflect.deleteProperty(globalThis, "window"); });

  it.each(["arrow", "curve", "pen", "area", "text", "ball", "cone", "target", "ladder"] as DrawingKind[])("hovers %s with the same target as clicking, without edits", kind => {
    mount(); object(drawing(kind)); const before = JSON.stringify(props.payload);
    send(); expectHover("object"); expect(props.onSelect).not.toHaveBeenCalled();
    expect(props.onMove).not.toHaveBeenCalled(); expect(props.onDraw).not.toHaveBeenCalled(); expect(JSON.stringify(props.payload)).toBe(before);
    send("pointerdown"); expectHover(); expect(props.onSelect).toHaveBeenLastCalledWith(["object"]);
    send("pointerup");
  });

  it.each([false, true])("uses projected rotated text and actor labels under zoom/pan, landscape=%s", landscape => {
    mount({ landscape, zoom: 1.7, pan: { x: 60, y: -35 } }); send(); expectHover("player");
    object({ ...drawing("text"), text: "ROTATED_LABEL", rotation: 90 });
    const at = scenePoint(center, landscape), labelEnd = fromScenePoint({ x: at.x + 10, y: at.y + 80 }, landscape);
    send("pointermove", labelEnd, { pointerType: "pen" }); expectHover("object");
    send("pointerdown", labelEnd); expect(props.onSelect).toHaveBeenLastCalledWith(["object"]);
  });

  it("picks the visible explicit curve, not its straight chord", () => {
    mount(); object({ ...drawing("curve"), curveMode: "through-point", points: [{ x: .2, y: .6 }, { x: .5, y: .2 }, { x: .8, y: .6 }] });
    send("pointermove", { x: .5, y: .2 }); expectHover("object");
    send("pointermove", { x: .5, y: .6 }); expectHover();
  });

  it("tracks front layers, excludes hidden individuals/groups and keeps locked items selectable", () => {
    mount(); const step = props.payload.timeline.steps[0].id;
    props.payload.editor!.drawings[step] = [drawing("text")]; update({ payload: { ...props.payload } });
    send(); expectHover("player");
    update({ payload: moveCourtLayer(props.payload, 0, { kind: "drawing", id: "object" }, 1) }); expectHover();
    send(); expectHover("object"); props.payload.editor!.drawings[step][0].locked = true; update({ payload: { ...props.payload } });
    send(); expectHover("object", "pointer"); send("pointerdown"); expect(props.onSelect).toHaveBeenLastCalledWith(["object"]); send("pointerup");
    props.payload.editor!.drawings[step][0].hidden = true; update({ payload: { ...props.payload } }); send(); expectHover("player");
    props.payload.editor!.actorMeta.player = { locked: true }; update({ payload: { ...props.payload } }); send(); expectHover("player", "pointer");
    props.payload.editor!.hiddenLayers = ["actors"]; update({ payload: { ...props.payload } }); send(); expectHover();
    props.payload.editor!.drawings[step][0].hidden = false; props.payload.editor!.hiddenLayers = ["drawings"]; update({ payload: { ...props.payload } }); send(); expectHover("player", "pointer");
    props.payload.editor!.actorMeta.player.hidden = true; update({ payload: { ...props.payload } }); send(); expectHover();
  });

  it("keeps a ball reachable below its own linked arrows", () => {
    mount(); object({ ...drawing("ball"), points: [center] }); const step = props.payload.timeline.steps[0].id;
    props.payload.editor!.drawings[step].push({ ...drawing("arrow"), id: "connector", startBallId: "object" }); update({ payload: { ...props.payload } });
    send(); expectHover("object"); send("pointerdown"); expect(props.onSelect).toHaveBeenLastCalledWith(["object"]);
  });

  it("does not render per pixel within the same hit, and clears outside, on leave and blur", () => {
    mount(); send(); expectHover("player"); const count = renderCount.mock.calls.length;
    for (let i = 0; i < 8; i++) send("pointermove", { x: .5 + i * .001, y: .5 });
    expect(renderCount).toHaveBeenCalledTimes(count);
    send("pointermove", { x: 0, y: 0 }); expectHover(); send(); send("pointerleave"); expectHover();
    send(); act(() => windows.get("blur:false")!({})); expectHover();
  });

  it.each(["input", "#court-selection-actions", "#court-area-controls", "[id^=court-arrow-handle-]", "[id^=court-floor-handle-]"])("clears over overlay %s", selector => {
    mount(); send(); send("pointermove", center, { target: { closest: (query: string) => query.includes(selector) ? {} : null } }); expectHover();
  });

  it("never hovers touch/pressed pen or active movement and clears for panning/zoom", () => {
    mount(); send(); send("pointermove", center, { pointerType: "touch" }); expectHover();
    send(); send("pointermove", center, { pointerType: "pen", buttons: 1 }); expectHover();
    send(); send("pointerdown"); send("pointermove", { x: .6, y: .5 }); expectHover(); send("pointercancel");
    send(); act(() => windows.get("keydown:false")!({ code: "Space", target: { closest: () => null }, preventDefault: jest.fn() })); expectHover(undefined, "grab");
    send(); expectHover(undefined, "grab"); act(() => windows.get("keyup:false")!({ code: "Space" }));
    send(); send("wheel", center, { ctrlKey: true, deltaY: 15, deltaMode: 0 }); expectHover(); expect(props.onZoom).toHaveBeenCalledTimes(1);
  });

  it("clears during external material drag and removes hover diagnostics on unmount", () => {
    mount(); send();
    send("dragover", center, { dataTransfer: { types: ["application/x-goatleta-material", "application/x-goatleta-material-cone"] } }); expectHover();
    send(); expectHover("player"); act(() => tree.unmount()); expect(node.dataset.hoveredId).toBe(""); expect(events.size).toBe(0);
  });

  it("does not install pointer hover on native", () => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" }); mount();
    expect(events.size).toBe(0); expect(shown()).toBeUndefined(); expect(props.onSelect).not.toHaveBeenCalled();
  });

  it.each(["payload", "step", "disabled", "readOnly", "tool", "progress", "selection", "zoom"])("clears immediately on %s changes", reason => {
    mount(); send(); expectHover("player");
    if (reason === "payload") update({ payload: { ...props.payload } });
    else if (reason === "step") { props.payload.timeline.steps.push({ ...props.payload.timeline.steps[0], id: "next" }); update({ stepIndex: 1 }); }
    else if (reason === "tool") update({ tool: "pan" });
    else if (reason === "selection") update({ selected: ["player"] });
    else if (reason === "progress") update({ progress: .5 });
    else if (reason === "zoom") update({ zoom: 1.3 });
    else update({ [reason]: true });
    expectHover();
    if (["disabled", "readOnly", "tool"].includes(reason)) { send(); expectHover(); }
  });
});
