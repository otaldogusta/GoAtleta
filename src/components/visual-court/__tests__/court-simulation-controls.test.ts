import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Dimensions, Platform, StyleSheet, Text } from "react-native";
import type { CourtSimulation } from "../../../core/court-simulation-model";
import { CourtSimulationModes, CourtSimulationSettings, CourtSimulationTransport } from "../CourtSimulationControls";

jest.mock("../../../ui/icon-registry", () => ({ GoAtletaIcon: "GoAtletaIcon" }));
jest.mock("../../../ui/AnchoredDropdown", () => ({ AnchoredDropdown: ({ visible, children, ...props }: { visible: boolean; children: React.ReactNode }) => {
  const R = jest.requireActual<typeof import("react")>("react");
  return R.createElement("Dropdown", { ...props, visible }, visible ? children : null);
} }));

const config = (): CourtSimulation => ({
  version: 1, mode: "attack", system: "5-1", rotation: 0, serve: "Float", seam: "Left",
  preset: "4", format: "Indoor", blockers: 3, layers: { attack: true, pass: true, block: true },
  actorIds: ["setter", "block1", "block2", "attacker", "receiver", "block3", "server"], ballId: "ball",
  landingOverride: null,
  attackSettings: { hitOverride: [-3.2, 0.8], targetOverride: [2, -6], setHeight: 1.9, attackArc: .8, passHeight: 2.2, blockAngle: 5, blockAngles: { "2": 30 }, manualBlockers: [2] },
});

describe("shared court simulation controls", () => {
  let tree: TestRenderer.ReactTestRenderer | undefined;
  const platformDescriptor = Object.getOwnPropertyDescriptor(Platform, "OS");
  afterEach(() => { if (tree) act(() => tree!.unmount()); tree = undefined; jest.restoreAllMocks(); if (platformDescriptor) Object.defineProperty(Platform, "OS", platformDescriptor); });
  const press = (label: string) => act(() => tree!.root.findByProps({ accessibilityLabel: label }).props.onPress());
  const panel = async (value: CourtSimulation | null = config(), mode: "receive" | "attack" = "attack") => {
    const onChange = jest.fn();
    const props = { config: value, mode, onChange, onRestore: jest.fn(), onShare: jest.fn(), cameraView: "front" as const, onCameraView: jest.fn(), labelsVisible: true, onLabelsVisible: jest.fn() };
    await act(async () => { tree = TestRenderer.create(React.createElement(CourtSimulationSettings, props)); });
    return { props, onChange };
  };

  it("changes available modes and keeps defense unavailable", () => {
    const onChange = jest.fn();
    act(() => { tree = TestRenderer.create(React.createElement(CourtSimulationModes, { mode: "receive", onChange })); });
    press("Ataque");
    expect(onChange).toHaveBeenCalledWith("attack");
    expect(tree!.root.findByProps({ accessibilityLabel: "Defesa. Em breve" }).props.disabled).toBe(true);
    expect(tree!.root.findByProps({ accessibilityLabel: "Recepção" }).props.accessibilityState.selected).toBe(true);
  });

  it("sends canonical rotation indexes behind the Brazilian setter labels", async () => {
    const { onChange } = await panel(config(), "receive");
    press("Rodízio P6");
    expect(onChange).toHaveBeenLastCalledWith({ rotation: 1 });
    press("Rodízio P2");
    expect(onChange).toHaveBeenLastCalledWith({ rotation: 5 });
    press("Saque: Com rotação");
    expect(onChange).toHaveBeenLastCalledWith({ serve: "Topspin" });
  });

  it("preserves contact targets and manual blockers when changing individual hands", async () => {
    const value = config();
    const { onChange } = await panel(value);
    press("Mãos do bloqueio: 2");
    act(() => tree!.root.findByProps({ accessibilityLabel: "Ângulo das mãos do bloqueio" }).props.onAccessibilityAction({ nativeEvent: { actionName: "increment" } }));
    expect(onChange).toHaveBeenLastCalledWith({ attackSettings: { ...value.attackSettings, blockAngles: { "2": 31 } } });
    press("Mãos do bloqueio: Todos");
    act(() => tree!.root.findByProps({ accessibilityLabel: "Ângulo das mãos do bloqueio" }).props.onAccessibilityAction({ nativeEvent: { actionName: "increment" } }));
    expect(onChange).toHaveBeenLastCalledWith({ attackSettings: { ...value.attackSettings, blockAngle: 6, blockAngles: {} } });
  });
  it("offers attack rotation selection for a canonical sequence and keeps individual attacks compact", async () => {
    const { props, onChange } = await panel(config(), "attack");
    expect(tree!.root.findAllByProps({ accessibilityLabel: "Rodízio P1" })).toHaveLength(0);
    act(() => tree!.update(React.createElement(CourtSimulationSettings, { ...props, showRotation: true, config: { ...props.config!, rotation: 2 } })));
    expect(tree!.root.findByProps({ accessibilityLabel: "Rodízio P5" }).props.accessibilityState.checked).toBe(true);
    press("Rodízio P6");
    expect(onChange).toHaveBeenCalledWith({ rotation: 1 });
    expect(onChange).toHaveBeenCalledTimes(1);
    act(() => tree!.update(React.createElement(CourtSimulationSettings, { ...props, showRotation: true, disabled: true })));
    expect(tree!.root.findByProps({ accessibilityLabel: "Rodízio P1" }).props.disabled).toBe(true);
    act(() => tree!.update(React.createElement(CourtSimulationSettings, { ...props, showRotation: false })));
    expect(tree!.root.findAllByProps({ accessibilityLabel: "Rodízio P1" })).toHaveLength(0);
  });

  it("commits a hands drag once and cancels an interrupted gesture", async () => {
    const value = config();
    const { onChange } = await panel(value);
    const range = () => tree!.root.findByProps({ accessibilityLabel: "Ângulo das mãos do bloqueio" });
    act(() => range().props.onLayout({ nativeEvent: { layout: { width: 130 } } }));
    act(() => range().props.onResponderGrant({ nativeEvent: { locationX: 70 } }));
    act(() => range().props.onResponderMove({ nativeEvent: { locationX: 90 } }));
    act(() => range().props.onResponderMove({ nativeEvent: { locationX: 100 } }));
    expect(onChange).not.toHaveBeenCalled();
    act(() => range().props.onResponderRelease());
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith({ attackSettings: { ...value.attackSettings, blockAngle: 35, blockAngles: {} } });
    act(() => range().props.onResponderGrant({ nativeEvent: { locationX: 30 } }));
    act(() => range().props.onResponderTerminate());
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("commits one native attack curve drag while preserving contact, destination and blockers", async () => {
    const value = config();
    const { onChange } = await panel(value);
    const range = () => tree!.root.findByProps({ accessibilityLabel: "Curva do ataque" });
    expect(range().props.accessibilityValue).toMatchObject({ min: .03, max: 4, now: .8 });
    expect(range().props.accessibilityValue.text).toMatch(/m/);
    act(() => range().props.onLayout({ nativeEvent: { layout: { width: 100 } } }));
    act(() => range().props.onResponderGrant({ nativeEvent: { locationX: 40 } }));
    act(() => range().props.onResponderMove({ nativeEvent: { locationX: 60 } }));
    act(() => range().props.onResponderMove({ nativeEvent: { locationX: 75 } }));
    expect(onChange).not.toHaveBeenCalled();
    act(() => range().props.onResponderRelease());
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toEqual({ attackSettings: { ...value.attackSettings, attackArc: expect.closeTo(3.01, 5) } });
    act(() => range().props.onResponderGrant({ nativeEvent: { locationX: 30 } }));
    act(() => range().props.onResponderTerminate());
    expect(onChange).toHaveBeenCalledTimes(1);
    act(() => range().props.onAccessibilityAction({ nativeEvent: { actionName: "increment" } }));
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange.mock.calls[1][0]).toEqual({ attackSettings: { ...value.attackSettings, attackArc: expect.closeTo(.81, 5) } });
  });

  it("shows attack curvature only when the attack trajectory is enabled", async () => {
    const { props } = await panel();
    expect(tree!.root.findAllByProps({ accessibilityLabel: "Curva do ataque" }).filter(node => typeof node.type === "string")).toHaveLength(1);
    act(() => tree!.update(React.createElement(CourtSimulationSettings, { ...props, config: { ...props.config!, layers: { ...props.config!.layers, attack: false } } })));
    expect(tree!.root.findAllByProps({ accessibilityLabel: "Curva do ataque" })).toHaveLength(0);
    act(() => tree!.update(React.createElement(CourtSimulationSettings, { ...props, mode: "receive" })));
    expect(tree!.root.findAllByProps({ accessibilityLabel: "Curva do ataque" })).toHaveLength(0);
  });

  it("uses the effective sampled attack curve until the author overrides it", async () => {
    const value = config(); value.attackSettings.attackArc = null;
    const { props } = await panel(value);
    act(() => tree!.update(React.createElement(CourtSimulationSettings, { ...props, attackArcValue: .47 })));
    expect(tree!.root.findByProps({ accessibilityLabel: "Curva do ataque" }).props.accessibilityValue.now).toBe(.47);
  });

  it("commits a web attack curve once on pointer release or key release and restores its automatic value", async () => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
    const value = config();
    const { onChange, props } = await panel(value);
    const range = () => tree!.root.findByProps({ "aria-label": "Curva do ataque" });
    expect(range().props).toMatchObject({ type: "range", min: .03, max: 4, step: .01, value: .8 });
    expect(range().props["aria-valuetext"]).toMatch(/m/);
    act(() => range().props.onChange({ currentTarget: { value: "1.25" } }));
    act(() => range().props.onChange({ currentTarget: { value: "1.65" } }));
    expect(onChange).not.toHaveBeenCalled();
    act(() => range().props.onPointerUp());
    act(() => range().props.onPointerUp());
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith({ attackSettings: { ...value.attackSettings, attackArc: 1.65 } });
    act(() => range().props.onChange({ currentTarget: { value: "1.8" } }));
    expect(onChange).toHaveBeenCalledTimes(1);
    act(() => range().props.onKeyUp());
    act(() => range().props.onBlur());
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith({ attackSettings: { ...value.attackSettings, attackArc: 1.8 } });
    act(() => range().props.onChange({ currentTarget: { value: "3" } }));
    act(() => range().props.onPointerCancel());
    act(() => range().props.onPointerUp());
    expect(onChange).toHaveBeenCalledTimes(2);
    act(() => range().props.onDoubleClick());
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(onChange).toHaveBeenLastCalledWith({ attackSettings: { ...value.attackSettings, attackArc: null } });
    act(() => tree!.update(React.createElement(CourtSimulationSettings, { ...props, disabled: true })));
    expect(range().props.disabled).toBe(true);
    act(() => range().props.onChange({ currentTarget: { value: "2" } }));
    act(() => range().props.onPointerUp());
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it("discards a pending web curve when the value or availability changes", async () => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
    const { props, onChange } = await panel();
    const range = () => tree!.root.findByProps({ "aria-label": "Curva do ataque" });
    act(() => range().props.onChange({ currentTarget: { value: "2" } }));
    expect(range().props.value).toBe(2);
    act(() => tree!.update(React.createElement(CourtSimulationSettings, { ...props, disabled: true })));
    act(() => tree!.update(React.createElement(CourtSimulationSettings, props)));
    expect(range().props.value).toBe(.8);
    act(() => range().props.onPointerUp());
    expect(onChange).not.toHaveBeenCalled();
    act(() => range().props.onChange({ currentTarget: { value: "3" } }));
    const next = { ...props.config!, attackSettings: { ...props.config!.attackSettings, attackArc: 1.2 } };
    act(() => tree!.update(React.createElement(CourtSimulationSettings, { ...props, config: next })));
    expect(range().props.value).toBe(1.2);
    act(() => range().props.onBlur());
    expect(onChange).not.toHaveBeenCalled();
  });

  it("toggles only the requested simulation layer", async () => {
    const { onChange } = await panel();
    press("Camada passe");
    expect(onChange).toHaveBeenCalledWith({ layers: { attack: true, pass: false, block: true } });
    expect(tree!.root.findByProps({ accessibilityLabel: "Camada bloqueio" }).props.accessibilityState.selected).toBe(true);
  });

  it("selects presets cyclically and clears only obsolete contact settings", async () => {
    const value = config();
    const { onChange } = await panel(value);
    press("Jogada anterior");
    expect(onChange).toHaveBeenLastCalledWith({ preset: "bic", attackSettings: { ...value.attackSettings, hitOverride: null, setHeight: null, attackArc: null } });
    press("Próxima jogada");
    expect(onChange).toHaveBeenLastCalledWith({ preset: "go", attackSettings: { ...value.attackSettings, hitOverride: null, setHeight: null, attackArc: null } });
  });

  it("routes view and labels to representation callbacks without changing the document", async () => {
    const { onChange, props } = await panel();
    press("Visão: Lateral");
    press("Trajetórias: Ocultar");
    expect(props.onCameraView).toHaveBeenCalledWith("side");
    expect(props.onLabelsVisible).toHaveBeenCalledWith(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps all playback controls bound to the host and advertises both adjacent rotations", () => {
    const props = { playing: false, progress: 0.5, speed: 1, rotation: 5, onPlay: jest.fn(), onRestart: jest.fn(), onPreviousRotation: jest.fn(), onNextRotation: jest.fn(), onSeek: jest.fn(), onSpeed: jest.fn(), onOpenSteps: jest.fn() };
    act(() => { tree = TestRenderer.create(React.createElement(CourtSimulationTransport, props)); });
    press("Reproduzir jogada"); press("Voltar ao início da jogada"); press("Rotação anterior: P3"); press("Próxima rotação: P1"); press("Mostrar etapas");
    expect(props.onPlay).toHaveBeenCalledTimes(1);
    expect(props.onRestart).toHaveBeenCalledTimes(1);
    expect(props.onPreviousRotation).toHaveBeenCalledTimes(1);
    expect(props.onNextRotation).toHaveBeenCalledTimes(1);
    expect(props.onOpenSteps).toHaveBeenCalledTimes(1);
    act(() => tree!.root.findByProps({ accessibilityLabel: "Avançar ou voltar na jogada" }).props.onAccessibilityAction({ nativeEvent: { actionName: "increment" } }));
    press("Velocidade da reprodução");
    press("Velocidade: 1,5×");
    expect(props.onSeek).toHaveBeenCalledWith(0.501);
    expect(props.onSpeed).toHaveBeenCalledWith(1.5);
  });

  it.each([319, 393, 700, 978, 1063])("keeps seek independent from four speed choices and playback options at %ipx", width => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
    jest.spyOn(Dimensions, "get").mockReturnValue({ width, height: 852, scale: 1, fontScale: 1 });
    const props = { playing: false, progress: .5, speed: 1, rotation: 0, onPlay: jest.fn(), onRestart: jest.fn(), onPreviousRotation: jest.fn(), onNextRotation: jest.fn(), onSeek: jest.fn(), onSpeed: jest.fn(), onOpenSteps: jest.fn() };
    act(() => { tree = TestRenderer.create(React.createElement(CourtSimulationTransport, props)); });
    expect(tree!.root.findAllByType("input")).toHaveLength(1);
    const options = tree!.root.findByProps({ accessibilityLabel: "Rodízio e opções de reprodução" });
    const commands = tree!.root.findByProps({ accessibilityLabel: "Comandos de reprodução" });
    expect(commands.findByProps({ accessibilityLabel: "Rodízio e opções de reprodução" })).toBe(options);
    expect(commands.findByProps({ accessibilityLabel: "Reproduzir jogada" })).toBeDefined();
    expect(commands.findByProps({ accessibilityLabel: "Voltar ao início da jogada" })).toBeDefined();
    expect(commands.findByProps({ accessibilityLabel: "Velocidade da reprodução" })).toBeDefined();
    expect(options.findByProps({ accessibilityLabel: "Velocidade da reprodução" })).toBeDefined();
    expect(options.findAllByProps({ "aria-label": "Avançar ou voltar na jogada" })).toHaveLength(0);
    expect(tree!.root.findByProps({ "aria-label": "Avançar ou voltar na jogada" }).props.value).toBe(.5);
    const trigger = () => tree!.root.findByProps({ accessibilityLabel: "Velocidade da reprodução" });
    expect(StyleSheet.flatten(trigger().props.style({ hovered: false, pressed: false }))).toMatchObject({ minWidth: width <= 393 ? 44 : 48, minHeight: 32 });
    expect(StyleSheet.flatten(trigger().findByType(Text).props.style).fontSize).toBe(11);
    expect(trigger().props.accessibilityRole).toBe("button");
    expect(trigger().props.accessibilityState.expanded).toBe(false);
    for (const [value, label] of [[.5, "0,5×"], [1, "1×"], [1.5, "1,5×"], [2, "2×"]] as const) {
      act(() => tree!.update(React.createElement(CourtSimulationTransport, { ...props, speed: value })));
      press("Velocidade da reprodução");
      expect(trigger().props.accessibilityState.expanded).toBe(true);
      const popup = tree!.root.findByType("Dropdown" as never);
      expect(popup.props).toMatchObject({ surface: "none", preferredWidth: 208, maxHeight: 34 });
      expect(StyleSheet.flatten(popup.props.scrollContentStyle)).toMatchObject({ padding: 0, gap: 0 });
      expect(popup.findAllByType(Text).map(node => node.props.children)).not.toContain("Velocidade");
      const group = tree!.root.findByProps({ accessibilityLabel: "Velocidade", accessibilityRole: "radiogroup" });
      const labels = new Set(group.findAllByProps({ accessibilityRole: "radio" }).map(node => node.props.accessibilityLabel));
      expect([...labels]).toEqual(["Velocidade: 0,5×", "Velocidade: 1×", "Velocidade: 1,5×", "Velocidade: 2×"]);
      expect(group.findByProps({ accessibilityLabel: `Velocidade: ${label}` }).props.accessibilityState.checked).toBe(true);
      press(`Velocidade: ${label}`);
      expect(props.onSpeed).toHaveBeenLastCalledWith(value);
      expect(trigger().props.accessibilityState.expanded).toBe(false);
    }
    expect(props.onSeek).not.toHaveBeenCalled();
    press("Velocidade da reprodução");
    const callsBeforeDismiss = props.onSpeed.mock.calls.length;
    act(() => tree!.root.findByType("Dropdown" as never).props.onRequestClose());
    expect(trigger().props.accessibilityState.expanded).toBe(false);
    expect(props.onSpeed).toHaveBeenCalledTimes(callsBeforeDismiss);
    press("Reproduzir jogada"); press("Voltar ao início da jogada"); press("Rotação anterior: P2"); press("Próxima rotação: P6"); press("Mostrar etapas");
    for (const callback of [props.onPlay, props.onRestart, props.onPreviousRotation, props.onNextRotation, props.onOpenSteps]) expect(callback).toHaveBeenCalledTimes(1);
    press("Velocidade da reprodução");
    expect(trigger().props.accessibilityState.expanded).toBe(true);
    act(() => tree!.update(React.createElement(CourtSimulationTransport, { ...props, disabled: true })));
    expect(tree!.root.findByType("Dropdown" as never).props.visible).toBe(false);
    act(() => tree!.update(React.createElement(CourtSimulationTransport, props)));
    expect(trigger().props.accessibilityState.expanded).toBe(false);
    act(() => tree!.update(React.createElement(CourtSimulationTransport, { ...props, disabled: true })));
    const calls = props.onSpeed.mock.calls.length;
    expect(trigger().props.disabled).toBe(true);
    press("Velocidade da reprodução");
    expect(tree!.root.findByType("Dropdown" as never).props.visible).toBe(false);
    expect(props.onSpeed).toHaveBeenCalledTimes(calls);
    expect(props.onSeek).not.toHaveBeenCalled();
  });

  it("wraps the P1 neighbors correctly and hides both arrows outside rotation mode", () => {
    const props = { playing: false, progress: 0, speed: 1, rotation: 0, onPlay: jest.fn(), onRestart: jest.fn(), onPreviousRotation: jest.fn(), onNextRotation: jest.fn(), onSeek: jest.fn(), onSpeed: jest.fn(), onOpenSteps: jest.fn() };
    act(() => { tree = TestRenderer.create(React.createElement(CourtSimulationTransport, props)); });
    press("Rotação anterior: P2");
    press("Próxima rotação: P6");
    expect(props.onPreviousRotation).toHaveBeenCalledTimes(1);
    expect(props.onNextRotation).toHaveBeenCalledTimes(1);
    act(() => tree!.update(React.createElement(CourtSimulationTransport, { ...props, showRotation: false })));
    expect(tree!.root.findAll(node => node.props.accessibilityLabel === "Rotação anterior: P2" || node.props.accessibilityLabel === "Próxima rotação: P6")).toHaveLength(0);
  });

  it.each(["choice", "dismiss", "outside", "close-before-frame", "unmount-before-frame"])("manages speed-menu keyboard focus for %s", closing => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
    const names = ["document", "requestAnimationFrame", "cancelAnimationFrame"] as const;
    const descriptors = names.map(name => Object.getOwnPropertyDescriptor(globalThis, name));
    const frames = new Map<number, FrameRequestCallback>();
    let nextFrame = 0;
    const selectedRadio = { focus: jest.fn(() => { doc.activeElement = selectedRadio; }) };
    const triggerButton = { focus: jest.fn(() => { doc.activeElement = triggerButton; }) };
    const menu = { contains: (node: unknown) => node === selectedRadio, querySelector: jest.fn(() => selectedRadio) };
    const doc = { activeElement: null as unknown, getElementById: jest.fn(() => menu) };
    const cancelFrame = jest.fn((id: number) => frames.delete(id));
    Object.defineProperty(globalThis, "document", { configurable: true, value: doc });
    Object.defineProperty(globalThis, "requestAnimationFrame", { configurable: true, value: (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame; } });
    Object.defineProperty(globalThis, "cancelAnimationFrame", { configurable: true, value: cancelFrame });
    try {
      const props = { playing: false, progress: 0, speed: 1.5, rotation: 0, onPlay: jest.fn(), onRestart: jest.fn(), onPreviousRotation: jest.fn(), onNextRotation: jest.fn(), onSeek: jest.fn(), onSpeed: jest.fn(), onOpenSteps: jest.fn() };
      act(() => { tree = TestRenderer.create(React.createElement(CourtSimulationTransport, props)); });
      const popup = () => tree!.root.findByType("Dropdown" as never);
      popup().props.interactiveRefs[0].current = {
        measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => callback(200, 600, 48, 32),
        querySelector: () => triggerButton,
      };
      press("Velocidade da reprodução");
      expect(popup().props.layout).toEqual({ x: 200, y: 600, width: 48, height: 32 });
      expect(frames.size).toBe(1);
      const [frameId, frame] = [...frames][0];
      if (closing.endsWith("before-frame")) {
        if (closing === "unmount-before-frame") { act(() => tree!.unmount()); tree = undefined; }
        else act(() => popup().props.onRequestClose());
        expect(cancelFrame).toHaveBeenCalledWith(frameId);
        expect(frames.size).toBe(0);
        expect(selectedRadio.focus).not.toHaveBeenCalled();
      } else {
        const groupId = tree!.root.findByProps({ accessibilityLabel: "Velocidade", accessibilityRole: "radiogroup" }).props.nativeID;
        act(() => frame(0));
        expect(doc.getElementById).toHaveBeenCalledWith(groupId);
        expect(menu.querySelector).toHaveBeenCalledWith('[role="radio"][aria-checked="true"]');
        expect(selectedRadio.focus).toHaveBeenCalledTimes(1);
        if (closing === "outside") doc.activeElement = { focus: jest.fn() };
        if (closing === "choice") { press("Velocidade: 2×"); expect(props.onSpeed).toHaveBeenCalledWith(2); }
        else act(() => popup().props.onRequestClose());
        expect(triggerButton.focus).toHaveBeenCalledTimes(closing === "outside" ? 0 : 1);
        expect(popup().props.visible).toBe(false);
      }
    } finally {
      if (tree) act(() => tree!.unmount());
      tree = undefined;
      names.forEach((name, index) => {
        const descriptor = descriptors[index];
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
      });
    }
  });
});
