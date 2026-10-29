import React, { useEffect } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { AccessibilityInfo, Animated, Dimensions, Platform, StyleSheet, Text } from "react-native";
import { CourtWorkspacePanel } from "../CourtWorkspacePanel";

jest.mock("../../../ui/icon-registry", () => ({ GoAtletaIcon: "GoAtletaIcon" }));

type Props = React.ComponentProps<typeof CourtWorkspacePanel>;
type Pending = { complete: () => void; config: Animated.TimingAnimationConfig };

describe("shared court workspace panel", () => {
  const platformDescriptor = Object.getOwnPropertyDescriptor(Platform, "OS");
  let tree: TestRenderer.ReactTestRenderer | undefined;
  let pending: Pending[];
  let reducedMotion: boolean;
  const props = (): Props => ({ open: true, onToggle: jest.fn(), onRequestClose: jest.fn(), tab: "adjustments", onTabChange: jest.fn(), adjustments: React.createElement(Text, null, "Ajustes persistentes"), steps: React.createElement(Text, null, "Etapas persistentes"), library: React.createElement(Text, null, "Busca persistente"), uiScale: 0.8, top: 115.2, bottom: 70.4 });
  const mount = async (value: Props) => { await act(async () => { tree = TestRenderer.create(React.createElement(CourtWorkspacePanel, value)); }); };
  const update = (value: Props) => act(() => tree!.update(React.createElement(CourtWorkspacePanel, value)));
  const content = (label: string) => tree!.root.findByProps({ accessibilityLabel: `Conteúdo: ${label}` });

  beforeEach(() => {
    pending = [];
    reducedMotion = false;
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
    jest.spyOn(Dimensions, "get").mockReturnValue({ width: 1063, height: 704, scale: 1, fontScale: 1 });
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockImplementation(() => Promise.resolve(reducedMotion));
    jest.spyOn(AccessibilityInfo, "addEventListener").mockReturnValue({ remove: jest.fn() });
    jest.spyOn(Animated, "timing").mockImplementation((value, config) => {
      let callback: ((result: { finished: boolean }) => void) | undefined;
      pending.push({ config, complete: () => { value.setValue(config.toValue as number); callback?.({ finished: true }); } });
      return { start: next => { callback = next; }, stop: jest.fn(), reset: jest.fn() };
    });
  });
  afterEach(() => {
    if (tree) act(() => tree!.unmount());
    tree = undefined;
    jest.restoreAllMocks();
    if (platformDescriptor) Object.defineProperty(Platform, "OS", platformDescriptor);
  });

  it.each([
    ["web", 353, true],
    ["web", 1063, false],
    ["ios", 353, false],
  ])("dismisses only outside the panel on %s at %ipx (readOnly=%s)", async (platform, width, readOnly) => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: platform });
    jest.mocked(Dimensions.get).mockReturnValue({ width, height: 704, scale: 1, fontScale: 1 });
    const value = { ...props(), readOnly };
    await mount(value);
    act(() => pending.at(-1)!.complete());
    const backdrop = tree!.root.findByProps({ accessibilityLabel: "Fechar controles da jogada" });
    const panel = tree!.root.findByProps({ accessibilityLabel: "Painel da jogada" });
    const backdropStyle = StyleSheet.flatten(backdrop.props.style);
    expect(backdropStyle).toMatchObject({ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "transparent" });
    expect(backdropStyle.zIndex).toBeLessThan(StyleSheet.flatten(panel.props.style).zIndex);
    expect(backdrop.props.suppressWebHoverFeedback).toBe(true);
    expect(backdrop.findAllByProps({ accessibilityLabel: "Painel da jogada" })).toHaveLength(0);
    act(() => tree!.root.findByProps({ accessibilityLabel: "Etapas" }).props.onPress());
    expect(value.onTabChange).toHaveBeenCalledWith("steps");
    expect(value.onRequestClose).not.toHaveBeenCalled();
    act(() => backdrop.props.onPress());
    expect(value.onRequestClose).toHaveBeenCalledTimes(1);
    expect(value.onToggle).not.toHaveBeenCalled();
    update({ ...value, open: false });
    expect(tree!.root.findAllByProps({ accessibilityLabel: "Fechar controles da jogada" })).toHaveLength(0);
    expect(tree!.root.findByProps({ accessibilityLabel: "Painel da jogada" }).props.pointerEvents).toBe("none");
  });

  it("requests tab changes from the host and retains every tab's mounted content", async () => {
    const mounted = jest.fn();
    const unmounted = jest.fn();
    function Content({ id }: { id: string }) {
      useEffect(() => { mounted(id); return () => unmounted(id); }, [id]);
      return React.createElement(Text, null, id);
    }
    const value = { ...props(), adjustments: React.createElement(Content, { id: "adjustments" }), steps: React.createElement(Content, { id: "steps" }), library: React.createElement(Content, { id: "library" }) };
    await mount(value);
    act(() => tree!.root.findByProps({ accessibilityLabel: "Biblioteca" }).props.onPress());
    expect(value.onTabChange).toHaveBeenCalledWith("library");
    expect(tree!.root.findByProps({ accessibilityLabel: "Ajustes" }).props.accessibilityState.selected).toBe(true);
    expect(StyleSheet.flatten(content("Biblioteca").props.style).display).toBe("none");
    expect(content("Biblioteca").props.inert).toBe(true);
    update({ ...value, tab: "library" });
    expect(tree!.root.findByProps({ accessibilityLabel: "Biblioteca" }).props.accessibilityState.selected).toBe(true);
    expect(content("Biblioteca").props["aria-hidden"]).toBe(false);
    expect(content("Biblioteca").props.inert).toBe(false);
    expect(StyleSheet.flatten(content("Biblioteca").props.style).display).toBe("flex");
    expect(content("Ajustes").props["aria-hidden"]).toBe(true);
    expect(mounted).toHaveBeenCalledTimes(3);
    expect(unmounted).not.toHaveBeenCalled();
  });

  it("makes closing contents inert during the retained fade and keeps the toggle available", async () => {
    const value = props();
    await mount(value);
    act(() => pending.at(-1)!.complete());
    update({ ...value, open: false });
    const panel = tree!.root.findByProps({ accessibilityLabel: "Painel da jogada" });
    expect(panel.props.pointerEvents).toBe("none");
    expect(panel.props.inert).toBe(true);
    expect(content("Ajustes").props.inert).toBe(true);
    expect(pending.at(-1)!.config).toMatchObject({ toValue: 0, duration: 200 });
    act(() => tree!.root.findByProps({ accessibilityLabel: "Abrir controles" }).props.onPress());
    expect(value.onToggle).toHaveBeenCalledTimes(1);
    act(() => pending.at(-1)!.complete());
    expect(tree!.root.findAllByProps({ accessibilityLabel: "Painel da jogada" })).toHaveLength(0);
  });

  it("preserves compact dimensions and closes immediately for reduced motion", async () => {
    reducedMotion = true;
    const value = props();
    await mount(value);
    const panel = tree!.root.findByProps({ accessibilityLabel: "Painel da jogada" });
    expect(StyleSheet.flatten(panel.props.style)).toMatchObject({ width: 360, height: 600, right: 16, top: 115.2, transformOrigin: "top right" });
    expect(StyleSheet.flatten(panel.props.style).transform.at(-1)).toEqual({ scale: 0.8 });
    expect(pending).toHaveLength(0);
    update({ ...value, open: false });
    expect(tree!.root.findAllByProps({ accessibilityLabel: "Painel da jogada" })).toHaveLength(0);
  });

  it("centers the mobile grip above the tabs and keeps reopening available through the closing fade", async () => {
    jest.mocked(Dimensions.get).mockReturnValue({ width: 477, height: 704, scale: 1, fontScale: 1 });
    const value = props();
    await mount(value);
    act(() => pending.at(-1)!.complete());
    const panelStyle = StyleSheet.flatten(tree!.root.findByProps({ accessibilityLabel: "Painel da jogada" }).props.style);
    const gripStyle = () => StyleSheet.flatten(tree!.root.findByProps({ testID: "court-panel-toggle-frame" }).props.style);
    expect(panelStyle).toMatchObject({ width: 440, paddingTop: 32 });
    expect(gripStyle()).toMatchObject({ width: 48, height: 28, right: 214.5 });
    expect(gripStyle().transform[0].translateY.__getValue()).toBe(-(panelStyle.height - 32));
    expect(tree!.root.findAllByType("GoAtletaIcon")).toHaveLength(0);
    act(() => tree!.root.findByProps({ accessibilityLabel: "Recolher controles" }).props.onPress());
    expect(value.onToggle).toHaveBeenCalledTimes(1);
    update({ ...value, open: false });
    expect(tree!.root.findByProps({ accessibilityLabel: "Painel da jogada" }).props.inert).toBe(true);
    act(() => tree!.root.findByProps({ accessibilityLabel: "Abrir controles" }).props.onPress());
    expect(value.onToggle).toHaveBeenCalledTimes(2);
    act(() => pending.at(-1)!.complete());
    expect(tree!.root.findAllByProps({ accessibilityLabel: "Painel da jogada" })).toHaveLength(0);
    expect(gripStyle().transform[0].translateY.__getValue()).toBe(0);
    expect(tree!.root.findAllByProps({ accessibilityLabel: "Abrir controles" }).filter(node => typeof node.type === "string")).toHaveLength(1);
    update(value);
    act(() => pending.at(-1)!.complete());
    expect(tree!.root.findByProps({ accessibilityLabel: "Recolher controles" }).props.accessibilityState.expanded).toBe(true);
    expect(content("Ajustes").props.inert).toBe(false);
  });
});
