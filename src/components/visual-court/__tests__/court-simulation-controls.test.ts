import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Dimensions, Platform } from "react-native";
import type { CourtSimulation } from "../../../core/court-simulation-model";
import { CourtSimulationModes, CourtSimulationSettings, CourtSimulationTransport } from "../CourtSimulationControls";

jest.mock("../../../ui/icon-registry", () => ({ GoAtletaIcon: "GoAtletaIcon" }));

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
    expect(props.onSeek).toHaveBeenCalledWith(0.501);
    expect(props.onSpeed).toHaveBeenCalledWith(1.25);
  });

  it.each([320, 393, 700, 1063])("keeps one seek slider and cycles speed with the number button at %ipx", width => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
    jest.spyOn(Dimensions, "get").mockReturnValue({ width, height: 852, scale: 1, fontScale: 1 });
    const props = { playing: false, progress: .5, speed: 1, rotation: 0, onPlay: jest.fn(), onRestart: jest.fn(), onPreviousRotation: jest.fn(), onNextRotation: jest.fn(), onSeek: jest.fn(), onSpeed: jest.fn(), onOpenSteps: jest.fn() };
    act(() => { tree = TestRenderer.create(React.createElement(CourtSimulationTransport, props)); });
    expect(tree!.root.findAllByType("input")).toHaveLength(1);
    expect(tree!.root.findByProps({ "aria-label": "Avançar ou voltar na jogada" }).props.value).toBe(.5);
    for (const [speed, next] of [[.25, .5], [.5, .75], [.75, 1], [1, 1.25], [1.25, 1.5], [1.5, 1.75], [1.75, 2], [2, .25]]) {
      act(() => tree!.update(React.createElement(CourtSimulationTransport, { ...props, speed })));
      const button = tree!.root.findByProps({ accessibilityLabel: "Velocidade da reprodução" });
      expect(button.props.accessibilityRole).toBe("button");
      expect(button.props.accessibilityValue.text).toContain("×");
      press("Velocidade da reprodução");
      expect(props.onSpeed).toHaveBeenLastCalledWith(next);
    }
    act(() => tree!.update(React.createElement(CourtSimulationTransport, { ...props, disabled: true })));
    const calls = props.onSpeed.mock.calls.length;
    press("Velocidade da reprodução");
    expect(props.onSpeed).toHaveBeenCalledTimes(calls);
    expect(props.onSeek).not.toHaveBeenCalled();
    expect(props.onPreviousRotation).not.toHaveBeenCalled();
    expect(props.onNextRotation).not.toHaveBeenCalled();
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
});
