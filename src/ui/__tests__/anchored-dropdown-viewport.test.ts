import { readFileSync } from "fs";
import { resolve } from "path";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Animated, Dimensions, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { AnchoredDropdown } from "../AnchoredDropdown";

jest.mock("expo-router", () => ({ usePathname: () => "/court" }));
jest.mock("../app-theme", () => ({ useAppTheme: () => ({ mode: "dark", colors: { border: "#334455", card: "#112233" } }) }));
jest.mock("react-native/Libraries/Components/ScrollView/ScrollView", () => {
  const ReactRuntime = jest.requireActual<typeof import("react")>("react");
  return { __esModule: true, default: ReactRuntime.forwardRef(function MockScrollView(props: { children?: React.ReactNode }, ref: React.Ref<unknown>) { return ReactRuntime.createElement("MockScrollView", { ...props, ref }, props.children); }) };
});

const source = readFileSync(resolve(__dirname, "../AnchoredDropdown.tsx"), "utf8");

describe("anchored dropdown viewport contract", () => {
  test("clamps fixed web portals to the CSS layout viewport, including browser zoom", () => {
    expect(source).toContain("document.documentElement");
    expect(source).toContain('layoutViewport?.clientWidth || Dimensions.get("window").width');
    expect(source).toContain('layoutViewport?.clientHeight || Dimensions.get("window").height');
    expect(source).toContain("windowWidth - 16 - resolvedWidth");
    expect(source).toContain("createWebPortal(dropdown, document.body)");
  });

  test("dismisses stale anchors on resizing and removes its listeners", () => {
    expect(source).toContain('window.addEventListener("resize", handleVisibilityOrBlur)');
    expect(source).toContain('window.removeEventListener("resize", handleVisibilityOrBlur)');
    expect(source).toContain('window.visualViewport?.addEventListener("resize", handleVisibilityOrBlur)');
    expect(source).toContain('window.visualViewport?.removeEventListener("resize", handleVisibilityOrBlur)');
  });

  test("fits short lists to their content and only scrolls on real overflow by default", () => {
    expect(source).toContain("fitContent = true");
    expect(source).toContain('element.style.overflowY = fitContent ? "auto" : "scroll"');
    expect(source).toContain("height: fitContent ? undefined : resolvedMaxHeight");
    expect(source).toContain("maxHeight: resolvedMaxHeight");
  });
});

describe("opt-in dropdown visual density", () => {
  const platformDescriptor = Object.getOwnPropertyDescriptor(Platform, "OS");
  let tree: TestRenderer.ReactTestRenderer | undefined;
  const props = () => ({
    visible: true, layout: { x: 900, y: 50, width: 34, height: 34 }, container: null,
    animationStyle: {}, zIndex: 300, maxHeight: 280, nestedScrollEnabled: true,
    density: "menu" as const, preferredWidth: 220, align: "end" as const,
    children: React.createElement(Text, null, "Menu item"),
  });
  const outerStyle = () => StyleSheet.flatten(tree!.root.findByType(Animated.View).props.style);
  const scaledPanel = () => tree!.root.findAllByType(View).find(node => StyleSheet.flatten(node.props.style)?.transformOrigin === "top left")!;
  const mount = (parameters: React.ComponentProps<typeof AnchoredDropdown>) => TestRenderer.create(React.createElement(AnchoredDropdown, parameters), {
    createNodeMock: () => ({
      style: { overflowX: "", overflowY: "", scrollbarWidth: "", scrollbarColor: "", msOverflowStyle: "" },
      addEventListener: jest.fn(), removeEventListener: jest.fn(),
      scrollHeight: 100, clientHeight: 100, scrollTop: 0,
      contains: () => false, getBoundingClientRect: () => ({ top: 0, bottom: 100 }),
    }),
  });
  beforeEach(() => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
    jest.spyOn(Dimensions, "get").mockReturnValue({ width: 1063, height: 704, scale: 1, fontScale: 1 });
  });
  afterEach(() => {
    if (tree) act(() => tree!.unmount());
    tree = undefined;
    jest.restoreAllMocks();
    if (platformDescriptor) Object.defineProperty(Platform, "OS", platformDescriptor);
  });

  test("anchors an 0.8 menu with physical dimensions while scaling its contents once", () => {
    act(() => { tree = mount({ ...props(), visualScale: 0.8 }); });
    expect(outerStyle()).toMatchObject({ left: 758, top: 90.4, width: 176, minWidth: 176, height: 224 });
    expect(tree!.root.findByType(Animated.View).props.pointerEvents).toBe("box-none");
    expect(StyleSheet.flatten(scaledPanel().props.style)).toMatchObject({ width: 220, position: "absolute", transform: [{ scale: 0.8 }], transformOrigin: "top left" });
    act(() => scaledPanel().props.onLayout({ nativeEvent: { layout: { width: 220, height: 110 } } }));
    expect(outerStyle().height).toBe(88);
    expect(outerStyle().top).toBe(90.4);
  });

  test("fits a short scaled list below its trigger using its real height and clamps the right edge", () => {
    act(() => { tree = mount({ ...props(), visualScale: 0.8, layout: { x: 1040, y: 570, width: 23, height: 20 } }); });
    act(() => scaledPanel().props.onLayout({ nativeEvent: { layout: { width: 220, height: 100 } } }));
    const style = outerStyle();
    expect(style.width).toBe(176);
    expect(style.left).toBe(871);
    expect(style.height).toBe(80);
    expect(style.top).toBeCloseTo(596.4);
    expect(style.top + style.height).toBeLessThanOrEqual(680);
    const scrollStyle = StyleSheet.flatten(tree!.root.findByType(ScrollView).props.style);
    expect(scrollStyle.height).toBeUndefined();
    expect(scrollStyle.maxHeight).toBe(280);
  });

  test("preserves the default scale-one geometry and content-fit layout", () => {
    act(() => { tree = mount(props()); });
    expect(outerStyle()).toMatchObject({ left: 714, top: 92, width: 220, minWidth: 220 });
    expect(outerStyle().height).toBeUndefined();
    expect(tree!.root.findByType(Animated.View).props.pointerEvents).toBeUndefined();
    expect(tree!.root.findAllByType(View).some(node => StyleSheet.flatten(node.props.style)?.transformOrigin === "top left")).toBe(false);
    const original = outerStyle();
    act(() => tree!.update(React.createElement(AnchoredDropdown, { ...props(), visualScale: 1 })));
    expect(outerStyle()).toEqual(original);
  });

  test("allows a compact control to supply its own surface without changing the default panel", () => {
    const panelStyle = () => StyleSheet.flatten(tree!.root.findAllByType(View).find(node => StyleSheet.flatten(node.props.style)?.borderRadius === 14)!.props.style);
    act(() => { tree = mount(props()); });
    const defaultPanelStyle = panelStyle();
    act(() => tree!.update(React.createElement(AnchoredDropdown, { ...props(), surface: "none", scrollContentStyle: { padding: 0, gap: 0 } })));
    expect(panelStyle()).toMatchObject({ borderWidth: 0, backgroundColor: "transparent", shadowOpacity: 0, elevation: 0 });
    expect(StyleSheet.flatten(tree!.root.findByType(ScrollView).props.contentContainerStyle)).toMatchObject({ padding: 0, gap: 0 });
    act(() => tree!.update(React.createElement(AnchoredDropdown, props())));
    expect(panelStyle()).toEqual(defaultPanelStyle);
  });

  test("measures a reopened scaled list again instead of reusing its previous height", () => {
    const parameters = { ...props(), visualScale: 0.8 };
    act(() => { tree = mount(parameters); });
    act(() => scaledPanel().props.onLayout({ nativeEvent: { layout: { width: 220, height: 110 } } }));
    expect(outerStyle().height).toBe(88);
    act(() => tree!.update(React.createElement(AnchoredDropdown, { ...parameters, visible: false })));
    expect(tree!.toJSON()).toBeNull();
    act(() => tree!.update(React.createElement(AnchoredDropdown, parameters)));
    expect(outerStyle().height).toBe(224);
    act(() => scaledPanel().props.onLayout({ nativeEvent: { layout: { width: 220, height: 150 } } }));
    expect(outerStyle().height).toBe(120);
  });
});
