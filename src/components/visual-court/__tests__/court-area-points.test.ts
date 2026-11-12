import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { PanResponder, Platform, View, type PanResponderCallbacks } from "react-native";
import { CourtEditorCanvas, type CourtEditorCanvasProps } from "../CourtEditorCanvas";
import { sceneBounds, scenePoint } from "../CourtEditorScene";
import { newCourtBoard } from "../../../core/visual-court-editor";
import type { CourtPoint } from "../../../core/visual-court";

jest.mock("react-native", () => {
  const native = jest.requireActual<typeof import("react-native")>("react-native"), runtime = jest.requireActual<typeof import("react")>("react");
  const descriptors = Object.getOwnPropertyDescriptors(native);
  descriptors.View = { configurable: true, enumerable: true, writable: true, value: runtime.forwardRef((props: object, ref: React.Ref<unknown>) => runtime.createElement("AreaView", { ...props, ref })) };
  return Object.create(Object.getPrototypeOf(native), descriptors);
});
jest.mock("../CourtEditorScene", () => ({ ...jest.requireActual("../CourtEditorScene"), CourtEditorScene: "Scene" }));
jest.mock("../CourtSelectionActions", () => ({ CourtSelectionActions: () => null }));
jest.mock("../CourtEditorControls", () => ({ CourtActionButton: "Action" }));

describe("area drawn by points", () => {
  const platform = Object.getOwnPropertyDescriptor(Platform, "OS");
  const a = { x: .2, y: .3 }, b = { x: .8, y: .3 }, c = { x: .7, y: .7 };
  const width = 390, height = 844;
  let tree: TestRenderer.ReactTestRenderer, responder: PanResponderCallbacks, props: CourtEditorCanvasProps;
  const makeProps = (extra: Partial<CourtEditorCanvasProps> = {}): CourtEditorCanvasProps => ({ payload: newCourtBoard(), stepIndex: 0, landscape: false, tool: "area", areaMode: "points", selected: [], zoom: 1, pan: { x: 0, y: 0 }, half: false, plain: false, color: "#19c87b", dashed: false, grid: false,
    onSelect: jest.fn(), onMove: jest.fn(), onDraw: jest.fn(), onEditText: jest.fn(), onAddPlayer: jest.fn(), onPan: jest.fn(), onZoom: jest.fn(), onCancelArea: jest.fn(), ...extra });
  const pixel = (point: CourtPoint) => {
    const bounds = sceneBounds(props.landscape, props.half), at = scenePoint(point, props.landscape);
    const rect = { x: bounds.x + bounds.width * (1 - 1 / props.zoom) / 2 - props.pan.x, y: bounds.y + bounds.height * (1 - 1 / props.zoom) / 2 - props.pan.y, width: bounds.width / props.zoom, height: bounds.height / props.zoom };
    const scale = Math.min(width / rect.width, height / rect.height);
    return { x: (width - rect.width * scale) / 2 + (at.x - rect.x) * scale, y: (height - rect.height * scale) / 2 + (at.y - rect.y) * scale };
  };
  const layout = () => act(() => tree.root.findAllByType(View).find(node => node.props.onLayout)!.props.onLayout({ nativeEvent: { layout: { width, height } } }));
  const mount = (extra: Partial<CourtEditorCanvasProps> = {}) => { props = makeProps(extra); act(() => { tree = TestRenderer.create(React.createElement(CourtEditorCanvas, props)); }); layout(); };
  const update = (extra: Partial<CourtEditorCanvasProps>) => act(() => { props = { ...props, ...extra }; tree.update(React.createElement(CourtEditorCanvas, props)); });
  const grant = (point: CourtPoint) => { const p = pixel(point); act(() => responder.onPanResponderGrant!({ nativeEvent: { locationX: p.x, locationY: p.y } } as never, {} as never)); };
  const release = (dx = 0, dy = 0) => act(() => responder.onPanResponderRelease!({} as never, { dx, dy } as never));
  const tap = (point: CourtPoint) => { grant(point); release(); };
  const draft = () => tree.root.findByType("Scene" as never).props.draft;
  const control = (label: string) => tree.root.findAllByType("Action" as never).find(node => node.props.label === label)!;
  const press = (label: string) => act(() => control(label).props.onPress());
  const expectPoints = (actual: CourtPoint[], expected: CourtPoint[]) => { expect(actual).toHaveLength(expected.length); expected.forEach((point, i) => { expect(actual[i].x).toBeCloseTo(point.x); expect(actual[i].y).toBeCloseTo(point.y); }); };
  beforeEach(() => { Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" }); jest.spyOn(PanResponder, "create").mockImplementation(value => { responder = value; return { panHandlers: {} }; }); });
  afterEach(() => { if (tree) act(() => tree.unmount()); jest.restoreAllMocks(); if (platform) Object.defineProperty(Platform, "OS", platform); });

  it("previews each vertex and commits exactly one canonical area when closed", () => {
    mount(); const before = JSON.stringify(props.payload); tap(a); tap(b); tap(c);
    expectPoints(draft().points, [a, b, c]); expect(props.onDraw).not.toHaveBeenCalled();
    expect(control("Fechar área").props.disabled).toBe(false);
    expect(tree.root.findByProps({ nativeID: "court-area-controls" }).props.onStartShouldSetResponder()).toBe(true);
    press("Fechar área"); press("Fechar área");
    expect(props.onDraw).toHaveBeenCalledTimes(1);
    const drawing = (props.onDraw as jest.Mock).mock.calls[0][0];
    expect(drawing).toMatchObject({ kind: "area", color: props.color, dashed: false }); expectPoints(drawing.points, [a, b, c]);
    expect(draft()).toBeUndefined(); expect(JSON.stringify(props.payload)).toBe(before);
  });

  it("requires three distinct non-collinear vertices and closes on the first vertex without duplicating it", () => {
    mount(); tap(a); tap(b); tap(a); press("Fechar área");
    expect(draft().points).toHaveLength(2); expect(props.onDraw).not.toHaveBeenCalled();
    tap({ x: .5, y: .3 }); expect(control("Fechar área").props.disabled).toBe(true); press("Fechar área");
    expect(props.onDraw).not.toHaveBeenCalled();
    press("Voltar um ponto"); tap(c); tap(a);
    expect(props.onDraw).toHaveBeenCalledTimes(1); expectPoints((props.onDraw as jest.Mock).mock.calls[0][0].points, [a, b, c]);
  });

  it("ignores dragged and canceled taps, undoes only the last point and cancels without authoring", () => {
    mount(); tap(a); grant(b); act(() => responder.onPanResponderMove!({} as never, { dx: 18, dy: 4 } as never)); release(18, 4);
    grant(b); release(18); grant(b); act(() => responder.onPanResponderTerminate!({} as never, {} as never));
    expect(draft().points).toHaveLength(1);
    press("Voltar um ponto"); expect(draft()).toBeUndefined();
    tap(a); tap(b); press("Cancelar área"); expect(draft()).toBeUndefined(); expect(props.onDraw).not.toHaveBeenCalled(); expect(props.onCancelArea).toHaveBeenCalledTimes(1);
  });

  it.each(["payload", "step", "tool", "mode", "disabled", "readOnly"])("discards pending vertices on %s changes and rejects late completion", change => {
    mount(); props.payload.timeline.steps.push({ ...props.payload.timeline.steps[0], id: "other-step" });
    tap(a); tap(b); tap(c); const finish = control("Fechar área").props.onPress; grant(a);
    update(change === "payload" ? { payload: { ...props.payload } } : change === "step" ? { stepIndex: 1 } : change === "tool" ? { tool: "select" } : change === "mode" ? { areaMode: "free" } : change === "disabled" ? { disabled: true } : { readOnly: true });
    release(); act(() => finish()); expect(props.onDraw).not.toHaveBeenCalled(); expect(draft()).toBeUndefined();
  });

  it.each([false, true])("preserves points through zoom and pan and projects later taps in landscape=%s", landscape => {
    mount({ landscape }); tap(a); update({ zoom: 1.6, pan: { x: 45, y: -30 } });
    tap(b); tap(c); press("Fechar área");
    expectPoints((props.onDraw as jest.Mock).mock.calls[0][0].points, [a, b, c]);
  });

  it("preserves the existing freehand area gesture when areaMode is omitted", () => {
    mount({ areaMode: undefined }); const start = pixel(a), middle = pixel(b), end = pixel(c); grant(a);
    act(() => responder.onPanResponderMove!({} as never, { dx: middle.x - start.x, dy: middle.y - start.y } as never));
    act(() => responder.onPanResponderMove!({} as never, { dx: end.x - start.x, dy: end.y - start.y } as never)); release(end.x - start.x, end.y - start.y);
    expect(props.onDraw).toHaveBeenCalledTimes(1); expectPoints((props.onDraw as jest.Mock).mock.calls[0][0].points, [a, b, c]);
    expect(tree.root.findAllByProps({ nativeID: "court-area-controls" })).toHaveLength(0);
  });

  it("discards a freehand gesture when switching into point mode before release", () => {
    mount({ areaMode: "free" }); grant(a);
    act(() => responder.onPanResponderMove!({} as never, { dx: 30, dy: 40 } as never));
    expect(draft()).toBeDefined(); update({ areaMode: "points" }); release(30, 40);
    expect(draft()).toBeUndefined(); expect(props.onDraw).not.toHaveBeenCalled();
  });

  it("handles web taps and capture-phase keyboard actions without turning control clicks into vertices", () => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
    const previous = Object.getOwnPropertyDescriptor(globalThis, "window"), windows = new Map<string, (event: any) => void>(), events = new Map<string, (event: any) => void>();
    Object.defineProperty(globalThis, "window", { configurable: true, value: { addEventListener: (name: string, fn: (event: any) => void, capture = false) => windows.set(`${name}:${capture}`, fn), removeEventListener: (name: string, _fn: unknown, capture = false) => windows.delete(`${name}:${capture}`) } });
    try {
      props = makeProps();
      act(() => { tree = TestRenderer.create(React.createElement(CourtEditorCanvas, props), { createNodeMock: element => element.props.onLayout ? { style: {}, getBoundingClientRect: () => ({ left: 0, top: 0, width, height }), setPointerCapture: jest.fn(), addEventListener: (name: string, fn: (event: any) => void) => events.set(name, fn), removeEventListener: (name: string) => events.delete(name) } : null }); }); layout();
      const send = (name: string, point: CourtPoint, control = false) => { const at = pixel(point); act(() => events.get(name)!({ type: name, pointerId: 1, button: 0, clientX: at.x, clientY: at.y, preventDefault: jest.fn(), target: { closest: (selector: string) => control && selector.includes("court-area-controls") ? {} : null } })); };
      const click = (point: CourtPoint) => { send("pointerdown", point); send("pointerup", point); };
      const key = (value: string) => { const event = { key: value, preventDefault: jest.fn(), stopImmediatePropagation: jest.fn(), target: { closest: () => null } }; act(() => windows.get("keydown:true")!(event)); expect(event.preventDefault).toHaveBeenCalled(); expect(event.stopImmediatePropagation).toHaveBeenCalled(); };
      click(a); click(b); key("Backspace"); expect(draft().points).toHaveLength(1);
      send("pointerdown", b, true); send("pointerup", b, true); expect(draft().points).toHaveLength(1);
      send("pointerdown", b); send("pointercancel", b); expect(draft().points).toHaveLength(1);
      click(b); click(c);
      for (const control of ["#court-area-controls", "button", "a[href]", "select", "summary", '[role="button"]', '[role="radio"]', '[role="tab"]', '[role="link"]', '[role="checkbox"]', '[role="switch"]', '[role="combobox"]', '[role="option"]', '[role="menuitem"]']) {
        const event = { key: "Enter", preventDefault: jest.fn(), stopImmediatePropagation: jest.fn(), target: { closest: (selector: string) => selector.split(",").map(part => part.trim()).includes(control) ? {} : null } };
        act(() => windows.get("keydown:true")!(event));
        expect(event.preventDefault).not.toHaveBeenCalled(); expect(event.stopImmediatePropagation).not.toHaveBeenCalled();
        expect(props.onDraw).not.toHaveBeenCalled(); expect(draft().points).toHaveLength(3);
      }
      key("Enter"); expect(props.onDraw).toHaveBeenCalledTimes(1);
      click(a); key("Escape"); expect(draft()).toBeUndefined(); expect(props.onCancelArea).toHaveBeenCalledTimes(1);
    } finally { act(() => tree.unmount()); if (previous) Object.defineProperty(globalThis, "window", previous); else delete (globalThis as { window?: unknown }).window; }
  });
});
