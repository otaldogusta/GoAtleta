import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { AccessibilityInfo, Animated, PanResponder, Platform, ScrollView, StyleSheet, type PanResponderCallbacks } from "react-native";
import { CourtLayersPanel } from "../CourtLayersPanel";
import { Pressable } from "../../../ui/Pressable";
import { newCourtBoard } from "../../../core/visual-court-editor";
import { moveCourtLayer, setCourtLayerHidden, setCourtLayerLocked } from "../../../core/court-layers";

jest.mock("react-native", () => {
  const native = jest.requireActual<typeof import("react-native")>("react-native"), runtime = jest.requireActual<typeof import("react")>("react");
  const descriptors = Object.getOwnPropertyDescriptors(native);
  descriptors.View = { configurable: true, enumerable: true, writable: true, value: runtime.forwardRef((props: object, ref: React.Ref<unknown>) => runtime.createElement("LayerView", { ...props, ref })) };
  return Object.create(Object.getPrototypeOf(native), descriptors);
});

jest.mock("../CourtEditorControls", () => ({ CourtToolIcon: "ToolIcon" }));
jest.mock("../../../ui/icon-registry", () => ({ GoAtletaIcon: "GoAtletaIcon" }));
jest.mock("../../../ui/Pressable", () => {
  const runtime = jest.requireActual<typeof import("react")>("react");
  return { Pressable: runtime.forwardRef((props: object, ref: React.Ref<unknown>) => runtime.createElement("LayerPressable", { ...props, ref })) };
});

function board() {
  const payload = newCourtBoard("Camadas locais");
  payload.actors = payload.actors.slice(0, 2).map((actor, i) => ({ ...actor, id: `player-${i}`, label: String(i + 1) }));
  payload.editor!.actorMeta = { "player-0": { team: "A" }, "player-1": { team: "B" } };
  const step = payload.timeline.steps[0];
  step.visibleActorIds = payload.actors.map(actor => actor.id);
  payload.editor!.drawings[step.id] = [{ id: "ball", kind: "ball", points: [{ x: .5, y: .5 }], color: "#ffdc53", size: 32, rotation: 0 }];
  return payload;
}

describe("court layer panel", () => {
  let tree: TestRenderer.ReactTestRenderer;
  let responders: PanResponderCallbacks[];
  let motionChange: (enabled: boolean) => void;
  const platform = Object.getOwnPropertyDescriptor(Platform, "OS");
  const select = jest.fn(), move = jest.fn(), view2D = jest.fn(), setHidden = jest.fn(), setLocked = jest.fn();
  const props = (extra = {}) => ({ payload: board(), stepIndex: 0, selected: ["player-1"], onSelect: select, onMove: move, onSetHidden: setHidden, onSetLocked: setLocked, onView2D: view2D, ...extra });
  const button = (label: string) => tree.root.findAllByType(Pressable).find(node => node.props.accessibilityLabel === label)!;
  const press = (label: string) => act(() => button(label).props.onPress());
  const mount = (value = props()) => act(() => { tree = TestRenderer.create(React.createElement(CourtLayersPanel, value)); });
  const start = (index = 0) => act(() => responders[index].onPanResponderGrant!({} as never, {} as never));
  const drag = (dy: number, index = 0) => act(() => responders[index].onPanResponderMove!({} as never, { dy } as never));
  const release = (dy: number, index = 0) => act(() => responders[index].onPanResponderRelease!({} as never, { dy } as never));
  const translateY = (id: string) => {
    const style = StyleSheet.flatten(tree.root.findAllByProps({ testID: `court-layer-motion-${id}` })[0].props.style);
    const value = style.transform[0].translateY;
    return typeof value === "number" ? value : value.__getValue();
  };
  beforeEach(() => {
    jest.useFakeTimers(); jest.clearAllMocks(); responders = [];
    Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" });
    jest.spyOn(PanResponder, "create").mockImplementation(config => { responders.push(config); return { panHandlers: {} }; });
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, "addEventListener").mockImplementation((_, callback) => { motionChange = callback as (enabled: boolean) => void; return { remove: jest.fn() }; });
    // TestRenderer has no native animation driver; execute the same timing in JS.
    const timing = Animated.timing;
    jest.spyOn(Animated, "timing").mockImplementation((value, config) => timing(value, { ...config, useNativeDriver: false }));
  });
  afterEach(() => { if (tree) act(() => tree.unmount()); jest.restoreAllMocks(); jest.useRealTimers(); if (platform) Object.defineProperty(Platform, "OS", platform); });

  it("lists front to back and selects a layer without changing its document", () => {
    const value = props(), before = JSON.stringify(value.payload); mount(value);
    const rows = tree.root.findAllByType(Pressable).map(node => node.props.accessibilityLabel).filter(label => label?.startsWith("Selecionar camada"));
    expect(rows).toEqual(["Selecionar camada Jogador 2 · B", "Selecionar camada Jogador 1 · A", "Selecionar camada Bola"]);
    press("Selecionar camada Bola");
    expect(select).toHaveBeenCalledWith({ kind: "drawing", id: "ball" }); expect(move).not.toHaveBeenCalled();
    expect(JSON.stringify(value.payload)).toBe(before);
  });

  it("moves one position through the accessible actions and disables both boundaries", () => {
    const value = props(); mount(value);
    expect(button("Mover camada para frente").props.disabled).toBe(true);
    press("Mover camada para frente"); expect(move).not.toHaveBeenCalled();
    press("Mover camada para trás"); expect(move).toHaveBeenCalledWith({ kind: "actor", id: "player-1" }, 1);
    act(() => tree.update(React.createElement(CourtLayersPanel, { ...value, selected: ["ball"] })));
    expect(button("Mover camada para trás").props.disabled).toBe(true);
    press("Mover camada para trás"); expect(move).toHaveBeenCalledTimes(1);
    press("Mover camada para frente"); expect(move).toHaveBeenLastCalledWith({ kind: "drawing", id: "ball" }, 1);
  });

  it("offers independent 44px visibility and lock actions without selecting or moving the layer", () => {
    mount();
    for (const label of ["Ocultar camada Jogador 2 · B", "Bloquear camada Jogador 2 · B"]) {
      expect(StyleSheet.flatten(button(label).props.style({ hovered: false, pressed: false }))).toMatchObject({ width: 44, minWidth: 44, minHeight: 44 });
      press(label);
    }
    expect(setHidden.mock.calls).toEqual([[{ kind: "actor", id: "player-1" }, true]]);
    expect(setLocked.mock.calls).toEqual([[{ kind: "actor", id: "player-1" }, true]]);
    expect(select).not.toHaveBeenCalled(); expect(move).not.toHaveBeenCalled();
  });

  it("retains hidden locked layers and lets the user select, show or unlock them", () => {
    const layer = { kind: "drawing" as const, id: "ball" };
    const payload = setCourtLayerLocked(setCourtLayerHidden(board(), 0, layer, true), 0, layer, true);
    mount(props({ payload }));
    expect(button("Reordenar Bola").props.disabled).toBe(true);
    press("Selecionar camada Bola, bloqueada, oculta"); expect(select).toHaveBeenCalledWith(layer);
    press("Mostrar camada Bola"); press("Desbloquear camada Bola");
    expect(setHidden).toHaveBeenCalledWith(layer, false); expect(setLocked).toHaveBeenCalledWith(layer, false);
    expect(move).not.toHaveBeenCalled();
  });

  it("keeps the individual eye state separate from a hidden group", () => {
    const payload = board(); payload.editor!.hiddenLayers = ["actors"]; mount(props({ payload }));
    expect(button("Selecionar camada Jogador 2 · B, oculta")).toBeTruthy();
    expect(button("Ocultar camada Jogador 2 · B").props.accessibilityHint).toBe("O grupo Jogadores está oculto nos ajustes.");
    press("Ocultar camada Jogador 2 · B");
    expect(setHidden).toHaveBeenCalledWith({ kind: "actor", id: "player-1" }, true);
  });

  it("prevents visibility and lock changes during a drag preview", () => {
    mount(); start(); drag(96);
    for (const label of ["Ocultar camada Jogador 1 · A", "Bloquear camada Jogador 1 · A"]) {
      expect(button(label).props.disabled).toBe(true); press(label);
    }
    expect(setHidden).not.toHaveBeenCalled(); expect(setLocked).not.toHaveBeenCalled();
  });

  it("previews a native drag without committing and commits once on release", () => {
    const value = props(), before = JSON.stringify(value.payload); mount(value);
    start(); drag(96);
    expect(move).not.toHaveBeenCalled(); expect(JSON.stringify(value.payload)).toBe(before);
    release(96);
    expect(move.mock.calls).toEqual([[{ kind: "actor", id: "player-1" }, 0]]);
    release(96); expect(move).toHaveBeenCalledTimes(1);
  });

  it("follows the finger immediately and opens the destination while keeping handles mounted", () => {
    mount(); const handle = button("Reordenar Jogador 2 · B"); start(); drag(4);
    expect(translateY("actor:player-1")).toBe(0);
    expect(tree.root.findAllByProps({ testID: "court-layer-drop-target" })).toHaveLength(0);
    drag(10); expect(translateY("actor:player-1")).toBe(10);
    drag(96);
    expect(translateY("actor:player-1")).toBe(96);
    act(() => jest.advanceTimersByTime(200));
    expect(translateY("actor:player-0")).toBe(-52); expect(translateY("drawing:ball")).toBe(-52);
    expect(StyleSheet.flatten(tree.root.findAllByProps({ testID: "court-layer-drop-target" })[0].props.style)).toMatchObject({ top: 104, height: 48, borderStyle: "dashed" });
    expect(button("Reordenar Jogador 2 · B")).toBe(handle); expect(move).not.toHaveBeenCalled();
    release(96);
    expect(translateY("actor:player-1")).toBe(0); expect(translateY("actor:player-0")).toBe(0);
    expect(move).toHaveBeenCalledTimes(1);
  });

  it("opens space upwards, reverses it, and clears the preview immediately on cancel", () => {
    mount(); start(2); drag(-110, 2); act(() => jest.advanceTimersByTime(200));
    expect(translateY("drawing:ball")).toBe(-110);
    expect(translateY("actor:player-1")).toBe(52); expect(translateY("actor:player-0")).toBe(52);
    drag(-20, 2); act(() => jest.advanceTimersByTime(200));
    expect(translateY("actor:player-1")).toBe(0); expect(translateY("actor:player-0")).toBe(0);
    drag(-110, 2); act(() => responders[2].onPanResponderTerminate!({} as never, {} as never));
    expect(translateY("drawing:ball")).toBe(0); expect(translateY("actor:player-0")).toBe(0);
    expect(tree.root.findAllByProps({ testID: "court-layer-drop-target" })).toHaveLength(0); expect(move).not.toHaveBeenCalled();
  });

  it("keeps direct movement and a visible destination with reduced motion, without easing neighbors", () => {
    const timing = jest.spyOn(Animated, "timing"); mount(); act(() => motionChange(true)); start(); drag(96);
    expect(translateY("actor:player-1")).toBe(96);
    expect(translateY("actor:player-0")).toBe(-52); expect(translateY("drawing:ball")).toBe(-52);
    expect(tree.root.findAllByProps({ testID: "court-layer-drop-target" }).length).toBeGreaterThan(0);
    expect(timing).not.toHaveBeenCalled(); expect(move).not.toHaveBeenCalled();
    release(96); expect(move).toHaveBeenCalledTimes(1);
  });

  it("compensates the dragged row for scale and scrolling without persisting the preview", () => {
    mount(props({ visualScale: .8 })); start(); drag(40);
    expect(translateY("actor:player-1")).toBe(50);
    act(() => tree.root.findByType(ScrollView).props.onScroll({ nativeEvent: { contentOffset: { y: 12 } } }));
    expect(translateY("actor:player-1")).toBe(62); expect(move).not.toHaveBeenCalled();
  });

  it("does not change order for a tap or canceled native gesture", () => {
    mount(); start(); release(2); expect(move).not.toHaveBeenCalled();
    start(); drag(96); act(() => responders[0].onPanResponderTerminate!({} as never, {} as never));
    release(96); expect(move).not.toHaveBeenCalled();
  });

  it("does not autoscroll or reorder while holding a handle without moving near the list edge", () => {
    mount();
    const list = tree.root.findByType(ScrollView);
    act(() => { list.props.onLayout({ nativeEvent: { layout: { height: 90 } } }); list.props.onContentSizeChange(200, 156); });
    start(1); act(() => jest.advanceTimersByTime(500)); release(0, 1);
    expect(move).not.toHaveBeenCalled();
  });

  it("uses the new row order when a button reorder is followed by drag without another layout event", () => {
    const value = props(); mount(value);
    for (const [index, id] of ["actor:player-1", "actor:player-0", "drawing:ball"].entries()) {
      act(() => tree.root.findByProps({ testID: `court-layer-${id}` }).props.onLayout({ nativeEvent: { layout: { y: index * 50, height: 48 } } }));
    }
    const payload = moveCourtLayer(value.payload, 0, { kind: "actor", id: "player-1" }, 1);
    act(() => tree.update(React.createElement(CourtLayersPanel, { ...value, payload })));
    start(1); drag(50, 1); release(50, 1);
    expect(move.mock.calls).toEqual([[{ kind: "actor", id: "player-0" }, 1]]);
  });

  it.each(["payload", "step", "disabled"])("discards a drag when %s changes before release", change => {
    const value = props();
    value.payload.timeline.steps.push({ ...value.payload.timeline.steps[0], id: "second-step" });
    mount(value); start(); drag(96);
    act(() => tree.update(React.createElement(CourtLayersPanel, { ...value, ...(change === "payload" ? { payload: { ...value.payload } } : change === "step" ? { stepIndex: 1 } : { disabled: true }) })));
    release(96); expect(move).not.toHaveBeenCalled();
  });

  it.each([{ readOnly: true }, { disabled: true }])("prevents selection and reorder when %j", state => {
    mount(props(state));
    press("Selecionar camada Bola"); press("Mover camada para trás"); start(); drag(96); release(96);
    expect(select).not.toHaveBeenCalled(); expect(move).not.toHaveBeenCalled();
    expect(button("Reordenar Jogador 2 · B").props.disabled).toBe(true);
    press("Ocultar camada Jogador 2 · B"); press("Bloquear camada Jogador 2 · B");
    expect(setHidden).not.toHaveBeenCalled(); expect(setLocked).not.toHaveBeenCalled();
  });

  it("keeps locked layers selectable while preventing their reordering", () => {
    const value = props(); value.payload.editor!.actorMeta["player-1"].locked = true; mount(value);
    press("Selecionar camada Jogador 2 · B, bloqueada"); expect(select).toHaveBeenCalledTimes(1);
    expect(button("Reordenar Jogador 2 · B").props.disabled).toBe(true);
    expect(button("Mover camada para trás").props.disabled).toBe(true);
    start(); drag(96); release(96); press("Mover camada para trás"); expect(move).not.toHaveBeenCalled();
  });

  it("offers the 2D view in perspective without changing layer order", () => {
    mount(props({ perspective: true })); press("Ver camadas na Quadra 2D");
    expect(view2D).toHaveBeenCalledTimes(1); expect(move).not.toHaveBeenCalled();
  });

  it("captures touch pointers, commits only on up and cancels lost capture", () => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
    const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
    const windowHandlers = new Map<string, () => void>();
    Object.defineProperty(globalThis, "window", { configurable: true, value: { addEventListener: (name: string, callback: () => void) => windowHandlers.set(name, callback), removeEventListener: (name: string) => windowHandlers.delete(name) } });
    const nodes = new Map<string, { handlers: Map<string, (event: object) => void>; setPointerCapture: jest.Mock }>();
    try {
      act(() => { tree = TestRenderer.create(React.createElement(CourtLayersPanel, props()), { createNodeMock: element => {
        const id = String(element.props.testID ?? "");
        if (!id.startsWith("court-layer-handle-")) return null;
        const label = `Reordenar ${id.slice("court-layer-handle-".length)}`;
        const handlers = new Map<string, (event: object) => void>();
        const node = { handlers, setPointerCapture: jest.fn(), querySelector: () => ({ focus: jest.fn() }), addEventListener: (name: string, fn: (event: object) => void) => handlers.set(name, fn), removeEventListener: (name: string) => handlers.delete(name) };
        nodes.set(label, node); return node;
      } }); });
      const handle = nodes.get("Reordenar Jogador 2 · B")!;
      const send = (type: string, clientY: number, more = {}) => act(() => handle.handlers.get(type)!({ type, clientY, pointerId: 7, pointerType: "touch", button: 0, preventDefault: jest.fn(), stopPropagation: jest.fn(), ...more }));
      send("pointerdown", 100); send("pointermove", 196);
      expect(handle.setPointerCapture).toHaveBeenCalledWith(7); expect(move).not.toHaveBeenCalled();
      send("pointerup", 196);
      expect(move.mock.calls).toEqual([[{ kind: "actor", id: "player-1" }, 0]]);
      move.mockClear();
      send("pointerdown", 100); send("pointermove", 196); send("lostpointercapture", 196); send("pointerup", 196);
      expect(move).not.toHaveBeenCalled();
      send("pointerdown", 100); send("pointermove", 196); send("pointercancel", 196);
      expect(move).not.toHaveBeenCalled();
      send("keydown", 0, { key: "ArrowDown" });
      expect(move).toHaveBeenCalledWith({ kind: "actor", id: "player-1" }, 1);
    } finally {
      act(() => tree.unmount());
      if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor); else delete (globalThis as { window?: unknown }).window;
    }
  });
});
