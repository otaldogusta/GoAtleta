import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Platform } from "react-native";
import { newCourtBoard } from "../../../core/visual-court-editor";
import { CourtStepGallery } from "../CourtStepGallery";

const mockScrollTo = jest.fn();
jest.mock("react-native", () => {
  const native = jest.requireActual<typeof import("react-native")>("react-native"), ReactRuntime = jest.requireActual<typeof import("react")>("react");
  const descriptors = Object.getOwnPropertyDescriptors(native);
  descriptors.ScrollView = { configurable: true, enumerable: true, writable: true, value: ReactRuntime.forwardRef(function GalleryScrollView(props: object, ref: React.Ref<unknown>) {
    ReactRuntime.useImperativeHandle(ref, () => ({ scrollTo: mockScrollTo }));
    return ReactRuntime.createElement("GalleryScrollView", props);
  }) };
  descriptors.View = { configurable: true, enumerable: true, writable: true, value: ReactRuntime.forwardRef(function GalleryView(props: object, ref: React.Ref<unknown>) { return ReactRuntime.createElement("GalleryView", { ...props, ref }); }) };
  return Object.create(Object.getPrototypeOf(native), descriptors);
});
jest.mock("../../../ui/icon-registry", () => ({ GoAtletaIcon: "GoAtletaIcon" }));
jest.mock("../CourtEditorScene", () => ({ CourtEditorScene: "CourtEditorScene" }));

function board() {
  const payload = newCourtBoard("Jogada autoral"), step = payload.timeline.steps[0];
  payload.timeline.steps = Array.from({ length: 5 }, (_, i) => ({ ...step, id: `step-${i}`, label: `Etapa autoral ${i + 1}`, durationMs: 1600 + i * 200 }));
  return payload;
}

describe("court step inspector gallery", () => {
  let tree: TestRenderer.ReactTestRenderer;
  const select = jest.fn(), add = jest.fn(), move = jest.fn();
  const props = (payload = board(), stepIndex = 0, disabled = false) => ({ payload, stepIndex, disabled, onSelect: select, onAdd: add, onMove: move });
  const button = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
  const press = (label: string) => act(() => button(label).props.onPress());
  beforeEach(() => { jest.clearAllMocks(); });
  afterEach(() => { if (tree) act(() => tree.unmount()); });

  it("selects an existing stage and adds through parent callbacks without mutating the document", () => {
    const value = props(), before = JSON.stringify(value.payload);
    act(() => { tree = TestRenderer.create(React.createElement(CourtStepGallery, { ...value, headerActions: React.createElement("InjectedHeaderAction") })); });
    const current = button("Etapa 1: Etapa autoral 1. Arraste para reordenar.");
    expect(current.props.accessibilityState.selected).toBe(true);
    expect(tree.root.findAllByType("InjectedHeaderAction")).toHaveLength(1);
    press("Etapa 3: Etapa autoral 3. Arraste para reordenar.");
    press("Adicionar etapa vazia ao final");
    expect(select).toHaveBeenCalledWith(2);
    expect(add).toHaveBeenCalledTimes(1);
    expect(move).not.toHaveBeenCalled();
    expect(JSON.stringify(value.payload)).toBe(before);
  });

  it("guards adjacent navigation at both boundaries and disables every edit during document operations", () => {
    const value = props();
    act(() => { tree = TestRenderer.create(React.createElement(CourtStepGallery, value)); });
    expect(button("Etapa anterior").props.disabled).toBe(true);
    press("Etapa anterior"); press("Próxima etapa");
    expect(select.mock.calls).toEqual([[1]]);
    act(() => tree.update(React.createElement(CourtStepGallery, { ...value, stepIndex: 4 })));
    expect(button("Próxima etapa").props.disabled).toBe(true);
    press("Próxima etapa"); press("Etapa anterior");
    expect(select.mock.calls).toEqual([[1], [3]]);
    act(() => tree.update(React.createElement(CourtStepGallery, { ...value, stepIndex: 2, disabled: true })));
    press("Etapa anterior"); press("Próxima etapa"); press("Etapa 4: Etapa autoral 4. Arraste para reordenar."); press("Adicionar etapa vazia ao final");
    expect(select).toHaveBeenCalledTimes(2);
    expect(add).not.toHaveBeenCalled();
  });

  it("uses hidden SVG previews rather than exposing duplicate player controls or another player", () => {
    const value = props();
    act(() => { tree = TestRenderer.create(React.createElement(CourtStepGallery, value)); });
    expect(tree.root.findAllByType("CourtEditorScene")).toHaveLength(5);
    const hidden = tree.root.findAll(node => node.type === "GalleryView" && node.props.importantForAccessibility === "no-hide-descendants");
    expect(hidden).toHaveLength(5);
    expect(hidden.every(node => node.props["aria-hidden"] && node.props.accessible === false && node.props.pointerEvents === "none")).toBe(true);
    const playback = tree.root.findAll(node => typeof node.props.accessibilityLabel === "string" && /Reproduzir|Pausar|Velocidade/.test(node.props.accessibilityLabel));
    expect(playback).toHaveLength(0);
  });

  it("reveals a newly selected row but keeps manual scrolling when the mounted tab returns", () => {
    const value = props(board(), 3);
    act(() => { tree = TestRenderer.create(React.createElement(CourtStepGallery, value)); });
    const scroll = () => tree.root.findByType("GalleryScrollView");
    act(() => scroll().props.onLayout({ nativeEvent: { layout: { height: 100 } } }));
    act(() => tree.root.findByProps({ testID: "court-step-drag-3" }).props.onLayout({ nativeEvent: { layout: { y: 200, height: 100 } } }));
    expect(mockScrollTo).toHaveBeenLastCalledWith({ y: 200, animated: false });
    act(() => scroll().props.onScroll({ nativeEvent: { contentOffset: { y: 135 } } }));
    mockScrollTo.mockClear();
    act(() => tree.update(React.createElement(CourtStepGallery, { ...value, compact: true })));
    act(() => { scroll().props.onLayout({ nativeEvent: { layout: { height: 0 } } }); scroll().props.onLayout({ nativeEvent: { layout: { height: 100 } } }); scroll().props.onContentSizeChange(); });
    expect(mockScrollTo).not.toHaveBeenCalled();
    act(() => tree.root.findByProps({ testID: "court-step-drag-0" }).props.onLayout({ nativeEvent: { layout: { y: 0, height: 100 } } }));
    act(() => tree.update(React.createElement(CourtStepGallery, { ...value, stepIndex: 0 })));
    expect(mockScrollTo).toHaveBeenLastCalledWith({ y: 0, animated: true });
  });

  it("keeps the court-step drag protocol and rejects foreign, out-of-range and disabled drops", () => {
    const descriptor = Object.getOwnPropertyDescriptor(Platform, "OS")!, nodes = new Map<string, { draggable: boolean; handlers: Map<string, (event: unknown) => void> }>();
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
    try {
      const value = props();
      act(() => { tree = TestRenderer.create(React.createElement(CourtStepGallery, value), { createNodeMock: element => {
        if (!String(element.props.testID ?? "").startsWith("court-step-drag-")) return null;
        const handlers = new Map<string, (event: unknown) => void>(), node = { draggable: false, handlers, addEventListener: (type: string, handler: (event: unknown) => void) => handlers.set(type, handler), removeEventListener: (type: string) => handlers.delete(type) };
        nodes.set(element.props.testID, node); return node;
      } }); });
      const data = new Map<string, string>(), transfer = { setData: (type: string, value: string) => data.set(type, value), getData: (type: string) => data.get(type) ?? "", effectAllowed: "", dropEffect: "" }, event = { preventDefault: jest.fn(), dataTransfer: transfer };
      const source = nodes.get("court-step-drag-0")!, target = nodes.get("court-step-drag-2")!;
      act(() => source.handlers.get("dragstart")!(event));
      expect(transfer.getData("application/x-goatleta-court-step")).toBe("0");
      act(() => target.handlers.get("drop")!(event));
      expect(move).toHaveBeenCalledWith(0, 2);
      data.clear(); act(() => target.handlers.get("drop")!(event));
      transfer.setData("application/x-goatleta-court-step", "99"); act(() => target.handlers.get("drop")!(event));
      expect(move).toHaveBeenCalledTimes(1);
      act(() => tree.update(React.createElement(CourtStepGallery, { ...value, disabled: true })));
      expect(source.draggable).toBe(false);
      expect(target.handlers.size).toBe(0);
    } finally { Object.defineProperty(Platform, "OS", descriptor); }
  });
});
