import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Dimensions, Platform, ScrollView, StyleSheet } from "react-native";
import { Pressable } from "../../../ui/Pressable";
import { CourtWorkspaceView } from "../CourtWorkspaceView";
import { CourtLayersPanel } from "../CourtLayersPanel";
import { resolveCourtLayers } from "../../../core/court-layers";
import type { CourtEditorCanvasProps } from "../CourtEditorCanvas";
import type { CourtPerspectiveCanvasProps } from "../CourtPerspectiveCanvas.types";
import { newCourtBoard, type CourtDrawing } from "../../../core/visual-court-editor";
import { ensureCourtDefenseStep } from "../../../core/court-defense-preset";
import { configureCourtSimulation } from "../../../core/court-simulation";
import { buildSimulatedReceptionRotationPreset, configureCourtRotationSequenceMode } from "../../../core/court-simulation-sequence";
import type { useCourtEditor } from "../useCourtEditor";

jest.mock("../CourtPerspectiveCanvas", () => ({ CourtPerspectiveCanvas: "Perspective" }));
jest.mock("../CourtEditorCanvas", () => ({ CourtEditorCanvas: "Canvas" }));
jest.mock("../CourtEditorControls", () => ({ CourtActionButton: "Action", CourtToolIcon: "ToolIcon", CourtSwitchRow: "SwitchRow", CourtSizeControl: "Size", CourtRosterPicker: "Roster" }));
jest.mock("../CourtSimulationControls", () => {
  const runtime = jest.requireActual<typeof import("react")>("react");
  return {
    CourtSimulationTransport: (props: { editingControls?: React.ReactNode }) => runtime.createElement("Transport", props, props.editingControls),
    CourtSimulationModes: "Modes",
    CourtSimulationSettings: "Settings",
  };
});
jest.mock("../CourtStepGallery", () => ({ CourtStepGallery: "Gallery" }));
jest.mock("../CourtLibraryBrowser", () => ({ CourtLibraryBrowser: "Library" }));
jest.mock("../CourtEditableTitle", () => ({ CourtEditableTitle: "Title" }));
jest.mock("../CourtWorkspacePanel", () => {
  const runtime = jest.requireActual<typeof import("react")>("react");
  return { CourtWorkspacePanel: (props: { open: boolean; tab: string; tools?: React.ReactNode }) => runtime.createElement("WorkspacePanel", props, props.open && props.tab === "tools" ? props.tools : null) };
});
jest.mock("../court-export", () => ({ exportCourt: jest.fn() }));
jest.mock("../../../ui/web-portal", () => ({ createWebPortal: (children: React.ReactNode) => children }));
jest.mock("../../../ui/AnchoredDropdown", () => {
  const runtime = jest.requireActual<typeof import("react")>("react");
  return { AnchoredDropdown: ({ visible, children, ...props }: { visible: boolean; children: React.ReactNode }) => runtime.createElement("Dropdown", props, visible ? children : null) };
});
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

type Editor = ReturnType<typeof useCourtEditor>;
type WorkspaceOptions = { readOnly?: boolean; suspended?: boolean };
describe("court mobile tool flow", () => {
  const platform = Object.getOwnPropertyDescriptor(Platform, "OS");
  const dom = Object.getOwnPropertyDescriptor(globalThis, "document");
  const browserWindow = window;
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  let tree: TestRenderer.ReactTestRenderer;
  let editor: Editor;
  let render: (extra?: WorkspaceOptions) => void;
  const canvas = () => (tree.root.findAllByType("Canvas" as never)[0] ?? tree.root.findByType("Perspective" as never)).props as CourtEditorCanvasProps;
  const action = (label: string) => tree.root.findAllByType("Action" as never).find(node => node.props.label === label)!;
  const press = (label: string) => act(() => action(label).props.onPress());
  const paletteButton = (label: string) => tree.root.findAllByType(Pressable).find(node => node.props.accessibilityLabel === label)!;
  const openProperties = () => {
    const actions = canvas().selectionActions as React.ReactElement<{ children: React.ReactElement<{ onPress: () => void }>[] }>;
    act(() => actions.props.children[0].props.onPress());
  };
  const colorTrigger = () => {
    const actions = canvas().selectionActions as React.ReactElement<{ children: React.ReactElement[] }>;
    return actions.props.children[2] as React.ReactElement<{
      ref: React.RefObject<{ measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void } | null>;
      children: React.ReactElement<{ onPress: () => void; accessibilityHint?: string }>;
    }>;
  };
  const openColors = () => {
    const trigger = colorTrigger();
    // The canvas mock does not mount its overlay: supply only the trigger measurement.
    trigger.props.ref.current = { measureInWindow: callback => callback(110, 210, 44, 44) };
    act(() => trigger.props.children.props.onPress());
  };
  const useWeb = () => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
    Object.defineProperty(globalThis, "window", { configurable: true, value: { ...browserWindow, addEventListener: jest.fn(), removeEventListener: jest.fn() } });
    Object.defineProperty(window, "location", { configurable: true, value: new URL("http://localhost:8081") });
    Object.defineProperty(globalThis, "document", { configurable: true, value: { body: {}, getElementById: () => null } });
  };
  const mount = async (width = 390, state: Partial<Editor> = {}, extra: WorkspaceOptions = {}, height = 844) => {
    jest.spyOn(Dimensions, "get").mockReturnValue({ width, height, scale: 1, fontScale: 1 });
    const history: Editor["payload"][] = [];
    render = (nextExtra = extra) => tree.update(React.createElement(CourtWorkspaceView, { classId: "test-class", onBack: jest.fn(), editor, ...nextExtra }));
    editor = {
      payload: newCourtBoard(), stepIndex: 0, cls: { id: "test-class", name: "Teste" }, roster: [], documents: [], trashedIds: [],
      activeDocumentId: null, loading: false, saving: false, opening: false, departing: false, dirty: false,
      error: "", notice: "", draftError: "", autosaveStatus: "idle", autosaveError: "", canUndo: false, canRedo: false,
      setNotice: jest.fn(), setError: jest.fn(), retryAutosave: jest.fn(),
      selectStep: jest.fn((stepIndex: number) => { editor = { ...editor, stepIndex }; render(); }),
      commit: jest.fn((update: Parameters<Editor["commit"]>[0], stepIndex?: number) => {
        const next = update(editor.payload);
        if (next === editor.payload && stepIndex === undefined) return;
        history.push(editor.payload); editor = { ...editor, payload: next, stepIndex: stepIndex ?? editor.stepIndex }; render();
      }),
      undo: jest.fn(() => { const previous = history.pop(); if (previous) { editor = { ...editor, payload: previous, stepIndex: Math.min(editor.stepIndex, previous.timeline.steps.length - 1) }; render(); } }), ...state,
    } as unknown as Editor;
    await act(async () => { tree = TestRenderer.create(React.createElement(CourtWorkspaceView, { classId: "test-class", onBack: jest.fn(), editor, ...extra })); });
  };
  beforeEach(() => { Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" }); });
  afterEach(() => {
    if (tree) act(() => tree.unmount());
    if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
    if (dom) Object.defineProperty(globalThis, "document", dom);
    else Reflect.deleteProperty(globalThis, "document");
    jest.restoreAllMocks();
    if (platform) Object.defineProperty(Platform, "OS", platform);
  });

  it("changes an authored player's action without changing role, color or selection", async () => {
    await mount(); press("Adicionar jogador");
    act(() => canvas().onAddPlayer({ x: .3, y: .4 }));
    const id = canvas().selected[0], original = editor.payload.actors.find(actor => actor.id === id)!;
    openProperties();
    act(() => paletteButton("Ação: Atacar").props.onPress());
    expect(editor.payload.timeline.steps[0].actorActions?.[id]).toBe("attack");
    expect(editor.payload.actors.find(actor => actor.id === id)).toEqual(original);
    expect(canvas().selected).toEqual([id]);
    act(() => paletteButton("Ação: Automática").props.onPress());
    expect(editor.payload.timeline.steps[0].actorActions?.[id]).toBeUndefined();
  });

  it("appends defense once, returns to the untouched authored board and undoes atomically", async () => {
    await mount();
    const original = editor.payload, mode = () => tree.root.findByType("Modes" as never).props;
    act(() => mode().onChange("defense"));
    expect(editor.stepIndex).toBe(1);
    expect(editor.payload.timeline.steps[1].simulation?.mode).toBe("defense");
    const defense = editor.payload.timeline.steps[1];
    act(() => mode().onChange("receive"));
    expect(editor.stepIndex).toBe(0);
    expect(editor.payload.timeline.steps[0].actorPositions).toEqual(original.timeline.steps[0].actorPositions);
    expect(editor.payload.timeline.steps[0].simulation).toBeUndefined();
    act(() => mode().onChange("defense"));
    expect(editor.payload.timeline.steps).toHaveLength(2);
    expect(editor.payload.timeline.steps[1]).toBe(defense);
    expect(editor.commit).toHaveBeenCalledTimes(1);
    act(() => editor.undo());
    expect(editor.payload).toBe(original);
    expect(editor.stepIndex).toBe(0);
  });

  it("opens hydrated defense at contact and preserves voluntary seeking and playback", async () => {
    await mount();
    const next = ensureCourtDefenseStep(editor.payload);
    editor = { ...editor, payload: next.payload, stepIndex: next.stepIndex, activeDocumentId: "saved-defense" };
    act(() => render());
    expect(canvas().progress).toBe(1); expect(canvas().disabled).toBe(false);
    act(() => tree.root.findByType("Transport" as never).props.onSeek(.5));
    expect(canvas().progress).toBe(.5); expect(canvas().disabled).toBe(true);
    editor = { ...editor, activeDocumentId: "autosave-assigned-id" }; act(() => render());
    expect(canvas().progress).toBe(.5);
    act(() => tree.root.findByType("Transport" as never).props.onPlay());
    expect(tree.root.findByType("Transport" as never).props.playing).toBe(true);
    expect(canvas().progress).toBe(.5);
    editor = { ...editor, activeDocumentId: "autosave-persisted-id" }; act(() => render());
    expect(tree.root.findByType("Transport" as never).props.playing).toBe(true);
    expect(canvas().progress).toBe(.5);
  });

  it("only opens an existing defense in read-only mode without authoring", async () => {
    await mount(390, {}, { readOnly: true });
    const modes = () => tree.root.findByType("Modes" as never).props;
    expect(modes().defenseAvailable).toBe(false);
    act(() => modes().onChange("defense"));
    expect(editor.commit).not.toHaveBeenCalled();
    const next = ensureCourtDefenseStep(editor.payload);
    editor = { ...editor, payload: next.payload }; act(() => render({ readOnly: true }));
    expect(modes().defenseAvailable).toBe(true);
    act(() => modes().onChange("defense"));
    expect(editor.stepIndex).toBe(next.stepIndex);
    expect(editor.commit).not.toHaveBeenCalled();
  });

  it("keeps the inserted player selected when tapping Select again", async () => {
    await mount();
    press("Adicionar jogador");
    expect(canvas().tool).toBe("player");
    act(() => canvas().onAddPlayer({ x: .3, y: .4 }));
    const selected = canvas().selected;
    expect(canvas().tool).toBe("select");
    expect(selected).toHaveLength(1);
    press("Selecionar e mover");
    expect(canvas().selected).toEqual(selected);
    expect(editor.commit).toHaveBeenCalledTimes(1);
  });

  it("opens the mobile web sheet on Tools and reuses actions without committing on open or tab changes", async () => {
    useWeb();
    await mount();
    const sheet = () => tree.root.findByType("WorkspacePanel" as never).props;
    const transport = () => tree.root.findByType("Transport" as never).props;
    expect(transport().editingControls).toBeTruthy();
    act(() => transport().onOpenSteps());
    expect(sheet().tab).toBe("adjustments");
    act(() => sheet().onRequestClose());
    act(() => paletteButton("Ferramentas").props.onPress());
    expect(sheet()).toMatchObject({ open: true, tab: "tools" });
    act(() => render({ suspended: true }));
    expect(sheet().open).toBe(false);
    act(() => render());
    expect(sheet()).toMatchObject({ open: true, tab: "tools" });
    act(() => sheet().onTabChange("steps"));
    act(() => sheet().onRequestClose());
    act(() => paletteButton("Ferramentas").props.onPress());
    expect(sheet()).toMatchObject({ open: true, tab: "tools" });
    press("Bola");
    expect(sheet().open).toBe(false);
    expect(canvas().tool).toBe("ball");
    expect(editor.commit).not.toHaveBeenCalled();
  });

  it("keeps reader access to adjustments without exposing mobile editing tools", async () => {
    useWeb();
    await mount(390, {}, { readOnly: true });
    const transport = tree.root.findByType("Transport" as never).props;
    expect(transport.editingControls).toBeUndefined();
    act(() => transport.onOpenSteps());
    const panel = tree.root.findByType("WorkspacePanel" as never).props;
    expect(panel).toMatchObject({ open: true, tab: "adjustments" });
    expect(panel.tools).toBeUndefined();
  });

  it.each(["arrow", "pen", "area", "curve"] as const)("returns to selection after a completed mobile %s drawing", async kind => {
    await mount();
    press("Mais ferramentas");
    const tool = tree.root.findAllByType("Action" as never).find(node => node.props.tile && node.props.icon === ({ arrow: "courtArrow", pen: "pencil", area: "courtArea", curve: "courtCurve" }[kind]))!;
    act(() => tool.props.onPress());
    expect(canvas().tool).toBe(kind);
    expect(tree.root.findAllByProps({ accessibilityLabel: "Painel Ferramentas" })).toHaveLength(0);
    const drawing: CourtDrawing = { id: "drawn-object", kind, points: [{ x: .2, y: .3 }, { x: .5, y: .6 }], size: 32, color: "#19c87b", rotation: 0 };
    act(() => canvas().onDraw(drawing));
    expect(canvas().tool).toBe("select");
    expect(canvas().selected).toEqual([drawing.id]);
    expect(editor.commit).toHaveBeenCalledTimes(1);
  });

  it("closes the tools panel when arming text and offers cancellation without an edit", async () => {
    await mount();
    press("Mais ferramentas");
    const textTool = tree.root.findAllByType("Action" as never).find(node => node.props.tile && node.props.icon === "courtText")!;
    act(() => textTool.props.onPress());
    expect(canvas().tool).toBe("text");
    expect(tree.root.findAllByProps({ accessibilityLabel: "Painel Ferramentas" })).toHaveLength(0);
    expect(tree.root.findAllByProps({ accessibilityLabel: "Ferramenta ativa" }).length).toBeGreaterThan(0);
    press("Selecionar");
    expect(canvas().tool).toBe("select");
    expect(editor.commit).not.toHaveBeenCalled();
  });

  it("offers free and point areas, entering 2D from the 3D surface without creating a drawing", async () => {
    await mount(390, {}, { readOnly: true }); act(() => render({}));
    expect(tree.root.findAllByType("Canvas" as never)).toHaveLength(0);
    press("Mais ferramentas"); expect(action("Área livre")).toBeTruthy(); press("Área por pontos");
    expect(tree.root.findAllByType("Canvas" as never)).toHaveLength(1);
    expect(canvas()).toMatchObject({ tool: "area", areaMode: "points" });
    expect(tree.root.findAllByProps({ accessibilityLabel: "Ferramenta ativa" })).toHaveLength(0);
    expect(tree.root.findAllByProps({ accessibilityLabel: "Painel Ferramentas" })).toHaveLength(0);
    expect(editor.commit).not.toHaveBeenCalled();
    act(() => canvas().onCancelArea?.()); expect(canvas().tool).toBe("select"); expect(editor.commit).not.toHaveBeenCalled();
    press("Mais ferramentas"); press("Área livre"); expect(canvas()).toMatchObject({ tool: "area", areaMode: "free" });
  });

  it.each([[390, "free"], [390, "points"], [1329, "free"], [1329, "points"]] as const)("finishes an area at %ipx in %s mode with the selection actions available", async (width, mode) => {
    await mount(width); press("Mais ferramentas");
    act(() => action(mode === "points" ? "Área por pontos" : "Área livre").props.onAdd()); expect(editor.commit).not.toHaveBeenCalled();
    press("Mais ferramentas"); expect(tree.root.findAllByProps({ accessibilityLabel: "Painel Ferramentas" }).length).toBeGreaterThan(0);
    const drawing: CourtDrawing = { id: "point-area", kind: "area", points: [{ x: .2, y: .2 }, { x: .8, y: .2 }, { x: .5, y: .7 }], color: "#19c87b", size: 32, rotation: 0 };
    act(() => canvas().onDraw(drawing));
    expect(editor.commit).toHaveBeenCalledTimes(1); expect(canvas().tool).toBe("select"); expect(canvas().selected).toEqual([drawing.id]);
    expect(tree.root.findAllByProps({ accessibilityLabel: "Painel Ferramentas" })).toHaveLength(0);
    expect(canvas().selectionActions).toBeTruthy();
    expect(editor.payload.editor!.drawings[editor.payload.timeline.steps[0].id]).toContainEqual(drawing);
  });

  it("closes Tools when selecting an area and exposes functional color, duplicate, edit and delete actions", async () => {
    const payload = newCourtBoard(), stepId = payload.timeline.steps[0].id;
    payload.editor!.drawings[stepId] = [{ id: "existing-area", kind: "area", points: [{ x: .2, y: .2 }, { x: .8, y: .2 }, { x: .5, y: .7 }], color: "#19c87b", size: 32, rotation: 0 }];
    await mount(1329, { payload }); press("Mais ferramentas"); act(() => canvas().onSelect(["existing-area"]));
    expect(tree.root.findAllByProps({ accessibilityLabel: "Painel Ferramentas" })).toHaveLength(0); expect(editor.commit).not.toHaveBeenCalled();
    openColors(); act(() => paletteButton("Aplicar cor #ffdc53").props.onPress());
    expect(editor.payload.editor!.drawings[stepId][0].color).toBe("#ffdc53");
    const actions = () => (canvas().selectionActions as React.ReactElement<{ children: React.ReactElement<{ onPress: () => void; children?: React.ReactElement<{ onPress: () => void }> }>[] }>).props.children;
    act(() => actions()[1].props.onPress());
    expect(editor.payload.editor!.drawings[stepId]).toHaveLength(2); expect(canvas().selected).toHaveLength(1); expect(canvas().selected[0]).not.toBe("existing-area");
    openProperties(); expect(tree.root.findByType("Size" as never)).toBeTruthy(); press("Fechar painel");
    act(() => actions()[3].props.children!.props.onPress());
    expect(editor.payload.editor!.drawings[stepId].map(item => item.id)).toEqual(["existing-area"]);
    expect(editor.commit).toHaveBeenCalledTimes(3);
  });

  it.each(["locked", "hidden", "readOnly", "playing", "suspended"])("keeps area actions unavailable for %s after a selection attempt with Tools open", async state => {
    const payload = newCourtBoard(), stepId = payload.timeline.steps[0].id;
    payload.editor!.drawings[stepId] = [{ id: "protected-area", kind: "area", points: [{ x: .2, y: .2 }, { x: .8, y: .2 }, { x: .5, y: .7 }], color: "#19c87b", size: 32, rotation: 0, locked: state === "locked", hidden: state === "hidden" }];
    await mount(1329, { payload }); press("Mais ferramentas");
    if (state === "readOnly" || state === "suspended") act(() => render({ [state]: true }));
    if (state === "playing") act(() => tree.root.findByType("Transport" as never).props.onPlay());
    act(() => canvas().onSelect(["protected-area"]));
    expect(canvas().selectionActions).toBeUndefined(); expect(editor.commit).not.toHaveBeenCalled();
  });

  it("leaves animation armed and preserves its selected actor on return", async () => {
    await mount();
    const id = editor.payload.actors[0].id;
    press("Animar movimento");
    act(() => canvas().onSelect([id]));
    act(() => canvas().onMove([id], { x: .05, y: .06 }, [{ x: 0, y: 0 }, { x: .05, y: .06 }]));
    expect(canvas().tool).toBe("animate");
    press("Selecionar e mover");
    expect(canvas().selected).toEqual([id]);
  });

  it.each([[390, 844], [844, 390]])("keeps Select outside scrolling with an unscaled target at %ix%i", async (width, height) => {
    await mount(width, {}, {}, height);
    const rail = tree.root.findByProps({ accessibilityLabel: "Ferramentas da quadra" });
    expect(StyleSheet.flatten(rail.props.style).transform).toBeUndefined();
    const scroll = rail.findByType(ScrollView);
    expect(scroll.findAllByType("Action" as never).some(node => node.props.label === "Selecionar e mover")).toBe(false);
    expect(action("Selecionar e mover").props.touchTarget).toBe(true);
    expect(action("Selecionar e mover").props.tooltipScale).toBe(1);
    expect(StyleSheet.flatten(rail.props.style).top + StyleSheet.flatten(rail.props.style).maxHeight).toBeLessThan(height - 78);
  });

  it.each(["courtText", "courtCone", "courtArrow"])("closes previously open adjustments after the %s add shortcut", async icon => {
    await mount();
    const panel = () => tree.root.findByType("WorkspacePanel" as never);
    act(() => panel().props.onToggle());
    expect(panel().props.open).toBe(true);
    press("Mais ferramentas");
    const tile = tree.root.findAllByType("Action" as never).find(node => node.props.tile && node.props.icon === icon)!;
    act(() => tile.props.onAdd());
    expect(panel().props.open).toBe(false);
    expect(tree.root.findAllByProps({ accessibilityLabel: "Painel Ferramentas" })).toHaveLength(0);
  });

  it("blocks canvas edits during playback", async () => {
    await mount();
    act(() => tree.root.findByType("Transport" as never).props.onPlay());
    expect(canvas().disabled).toBe(true);
  });

  const expectRotationControls = (visible: boolean) => {
    expect(tree.root.findByType("Transport" as never).props.showRotation).toBe(visible);
    expect(tree.root.findByType("WorkspacePanel" as never).props.adjustments.props.showRotation).toBe(visible);
  };

  it("does not invent P1 or rotation controls for a free court without simulation", async () => {
    await mount(); expectRotationControls(false);
    expect(editor.payload.timeline.steps[0].simulation).toBeUndefined(); expect(editor.commit).not.toHaveBeenCalled();
    // A legacy rotationIndex alone must not arm the simulation's rotation editor.
    act(() => { editor = { ...editor, payload: { ...editor.payload, timeline: { steps: [{ ...editor.payload.timeline.steps[0], rotationIndex: 1 }] } } }; render(); });
    expectRotationControls(false); expect(editor.commit).not.toHaveBeenCalled();
  });

  it.each([["receive", true], ["attack", false]] as const)("shows individual %s rotation controls only when supported", async (mode, visible) => {
    await mount(390, { payload: configureCourtSimulation(newCourtBoard(), 0, { mode }) });
    expectRotationControls(visible); expect(editor.commit).not.toHaveBeenCalled();
  });

  it("preserves rotation controls across reception and attack in the canonical sequence", async () => {
    await mount(390, { payload: buildSimulatedReceptionRotationPreset() }); expectRotationControls(true);
    act(() => { editor = { ...editor, payload: configureCourtRotationSequenceMode(editor.payload, 0, "attack") }; render(); });
    expectRotationControls(true); expect(editor.commit).not.toHaveBeenCalled();
  });

  it("keeps Layers fixed and selects/reorders an item without closing the panel", async () => {
    await mount();
    const rail = tree.root.findByProps({ accessibilityLabel: "Ferramentas da quadra" });
    expect(rail.findByType(ScrollView).findAllByType("Action" as never).some(node => node.props.label === "Camadas")).toBe(false);
    press("Camadas");
    const layer = { kind: "actor" as const, id: editor.payload.actors[1].id };
    act(() => tree.root.findByType(CourtLayersPanel).props.onSelect(layer));
    expect(canvas().selected).toEqual([layer.id]);
    expect(canvas().tool).toBe("select");
    expect(tree.root.findByType(CourtLayersPanel)).toBeTruthy();
    expect(editor.commit).not.toHaveBeenCalled();
    act(() => tree.root.findByType(CourtLayersPanel).props.onMove(layer, 0));
    expect(editor.commit).toHaveBeenCalledTimes(1);
    const changed = (editor.commit as jest.Mock).mock.calls[0][0](editor.payload);
    expect(resolveCourtLayers(changed, 0)[0]).toEqual(layer);
    expect(canvas().selected).toEqual([layer.id]);
    expect(tree.root.findByType(CourtLayersPanel)).toBeTruthy();
    act(() => tree.root.findByType(CourtLayersPanel).props.onContentHeight(100));
    expect(StyleSheet.flatten(tree.root.findByProps({ accessibilityLabel: "Painel Camadas" }).props.style).height).toBe(178);
    act(() => tree.root.findByType(CourtLayersPanel).props.onContentHeight(1000));
    expect(StyleSheet.flatten(tree.root.findByProps({ accessibilityLabel: "Painel Camadas" }).props.style).height).toBeLessThan(720);
  });

  it("toggles visibility and lock in single undoable edits while keeping hidden rows available", async () => {
    await mount(); press("Camadas");
    const layer = { kind: "actor" as const, id: editor.payload.actors[1].id };
    const panel = () => tree.root.findByType(CourtLayersPanel);
    act(() => panel().props.onSelect(layer));
    act(() => panel().props.onSetHidden(layer, true));
    expect(editor.commit).toHaveBeenCalledTimes(1); expect(editor.payload.editor!.actorMeta[layer.id].hidden).toBe(true);
    expect(canvas().selected).toEqual([]); expect(panel().props.selected).toEqual([]);
    expect(resolveCourtLayers(editor.payload, 0)).toContainEqual(layer);
    act(() => panel().props.onSelect(layer));
    expect(panel().props.selected).toEqual([layer.id]); expect(canvas().selected).toEqual([]);
    press("Fechar painel"); expect(canvas().selectionActions).toBeUndefined();
    act(() => editor.undo()); expect(editor.payload.editor!.actorMeta[layer.id].hidden).not.toBe(true);
    press("Camadas"); act(() => panel().props.onSetLocked(layer, true));
    expect(editor.commit).toHaveBeenCalledTimes(2); expect(editor.payload.editor!.actorMeta[layer.id].locked).toBe(true);
    act(() => panel().props.onSetHidden(layer, true));
    expect(editor.payload.editor!.actorMeta[layer.id]).toMatchObject({ hidden: true, locked: true });
    act(() => panel().props.onSetHidden(layer, false)); act(() => panel().props.onSetLocked(layer, false));
    expect(editor.payload.editor!.actorMeta[layer.id]).toMatchObject({ hidden: false, locked: false });
  });

  it.each(["opening", "suspended", "readOnly", "playing"])("guards layer mutations when %s", async state => {
    await mount(); press("Camadas");
    const layer = { kind: "actor" as const, id: editor.payload.actors[0].id };
    if (state === "playing") act(() => tree.root.findByType("Transport" as never).props.onPlay());
    else act(() => { if (state === "opening") editor = { ...editor, opening: true }; render(state === "readOnly" ? { readOnly: true } : state === "suspended" ? { suspended: true } : {}); });
    const panel = tree.root.findByType(CourtLayersPanel);
    act(() => { panel.props.onSetHidden(layer, true); panel.props.onSetLocked(layer, true); panel.props.onMove(layer, 0); });
    expect(editor.commit).not.toHaveBeenCalled();
  });

  it.each(["locked", "hidden"] as const)("blocks inline edits, normal movement and duplicate drag for a %s drawing", async flag => {
    const payload = newCourtBoard(), step = payload.timeline.steps[0];
    payload.editor!.drawings[step.id] = [{ id: "protected-text", kind: "text", text: "Original", points: [{ x: .5, y: .5 }], color: "#19c87b", size: 32, rotation: 0, [flag]: true }];
    await mount(390, { payload });
    act(() => canvas().onSelect(["protected-text"]));
    expect(canvas().selectionActions).toBeUndefined();
    act(() => { canvas().onEditText("protected-text", "Alterado"); canvas().onMove(["protected-text"], { x: .1, y: .1 }); canvas().onMove(["protected-text"], { x: .1, y: .1 }, undefined, true); });
    expect(editor.commit).not.toHaveBeenCalled();
    expect(editor.payload.editor!.drawings[step.id][0].text).toBe("Original");
  });

  it("replaces editable properties with an unlock action when the selected layer becomes locked", async () => {
    await mount(); const id = editor.payload.actors[0].id;
    act(() => canvas().onSelect([id]));
    const actions = canvas().selectionActions as React.ReactElement<{ children: React.ReactElement<{ onPress: () => void }>[] }>;
    act(() => actions.props.children[0].props.onPress());
    expect(tree.root.findAllByProps({ accessibilityLabel: "Rótulo do jogador" }).length).toBeGreaterThan(0);
    act(() => { editor = { ...editor, payload: { ...editor.payload, editor: { ...editor.payload.editor!, actorMeta: { ...editor.payload.editor!.actorMeta, [id]: { ...editor.payload.editor!.actorMeta[id], locked: true } } } } }; render(); });
    expect(tree.root.findAllByProps({ accessibilityLabel: "Rótulo do jogador" })).toHaveLength(0);
    expect(action("Substituir jogador")).toBeUndefined();
    press("Desbloquear camada");
    expect(editor.commit).toHaveBeenCalledTimes(1); expect(editor.payload.editor!.actorMeta[id].locked).toBe(false);
  });

  it("applies a contextual color to every selected player in one undoable edit and keeps the selection", async () => {
    await mount();
    const ids = editor.payload.actors.slice(0, 3).map(item => item.id), before = editor.payload;
    act(() => canvas().onSelect(ids)); openColors();
    act(() => paletteButton("Aplicar cor #ffdc53").props.onPress());
    expect(editor.commit).toHaveBeenCalledTimes(1); expect(canvas().selected).toEqual(ids);
    expect(editor.payload.actors.filter(item => ids.includes(item.id)).every(item => item.color === "#ffdc53")).toBe(true);
    expect(editor.payload.actors.filter(item => !ids.includes(item.id))).toEqual(before.actors.filter(item => !ids.includes(item.id)));
    const after = editor.payload;
    openColors(); act(() => paletteButton("Aplicar cor #ffdc53").props.onPress());
    expect(editor.commit).toHaveBeenCalledTimes(1); expect(editor.payload).toBe(after);
    act(() => editor.undo()); expect(editor.payload).toBe(before); expect(canvas().selected).toEqual(ids);
  });

  it.each(["2d", "3d"])("shows the current %s fallback and stores an explicit color for an imported actor", async view => {
    const payload = newCourtBoard(), id = payload.actors[0].id;
    payload.actors[0] = { ...payload.actors[0], color: undefined, baseColor: "#4389ff" }; payload.editor!.actorMeta[id].team = "B";
    // Initialize the 3D surface through the existing viewer entry, then allow authoring.
    await mount(390, { payload }, view === "3d" ? { readOnly: true } : {});
    if (view === "3d") act(() => render({}));
    act(() => canvas().onSelect([id])); openColors();
    expect(paletteButton(`Aplicar cor ${view === "3d" ? "#4389ff" : "#19c87b"}`).props.accessibilityState.selected).toBe(true);
    act(() => paletteButton("Aplicar cor #19c87b").props.onPress());
    expect(editor.commit).toHaveBeenCalledTimes(1);
    expect(editor.payload.actors[0]).toMatchObject({ color: "#19c87b", baseColor: "#4389ff" });
  });

  it("colors a mixed selection even with a locked primary item, excluding hidden, locked and unselected objects", async () => {
    const payload = newCourtBoard(), stepId = payload.timeline.steps[0].id;
    const [locked, editable, hidden] = payload.actors;
    payload.editor!.actorMeta[locked.id].locked = true; payload.editor!.actorMeta[hidden.id].hidden = true;
    payload.editor!.drawings[stepId] = [
      { id: "cone", kind: "cone", points: [{ x: .3, y: .3 }], size: 32, color: "#19c87b", rotation: 30 },
      { id: "locked-note", kind: "text", points: [{ x: .5, y: .5 }], size: 32, color: "#4389ff", rotation: 0, locked: true },
      { id: "hidden-note", kind: "text", points: [{ x: .7, y: .7 }], size: 32, color: "#4389ff", rotation: 0, hidden: true },
      { id: "other-note", kind: "text", points: [{ x: .8, y: .8 }], size: 32, color: "#4389ff", rotation: 0 },
    ];
    await mount(390, { payload });
    act(() => canvas().onSelect([locked.id, editable.id, hidden.id, "cone", "locked-note", "hidden-note"]));
    const selectedBefore = canvas().selected; openColors(); act(() => paletteButton("Aplicar cor #ffdc53").props.onPress());
    expect(editor.commit).toHaveBeenCalledTimes(1); expect(canvas().selected).toEqual(selectedBefore);
    expect(editor.payload.actors.find(item => item.id === editable.id)?.color).toBe("#ffdc53");
    expect(editor.payload.actors.filter(item => item.id !== editable.id)).toEqual(payload.actors.filter(item => item.id !== editable.id));
    expect(editor.payload.editor!.drawings[stepId][0]).toEqual({ ...payload.editor!.drawings[stepId][0], color: "#ffdc53" });
    expect(editor.payload.editor!.drawings[stepId].slice(1)).toEqual(payload.editor!.drawings[stepId].slice(1));
  });

  it.each(["actor", "drawing", "locked-primary"])("uses the same selection palette in properties with %s first", async primary => {
    const payload = newCourtBoard(), actor = payload.actors[0], stepId = payload.timeline.steps[0].id;
    actor.color = "#19c87b";
    if (primary === "locked-primary") payload.editor!.actorMeta[actor.id].locked = true;
    payload.editor!.drawings[stepId] = [{ id: "cone", kind: "cone", points: [{ x: .5, y: .5 }], size: 32, color: "#4389ff", rotation: 30 }];
    await mount(390, { payload });
    act(() => canvas().onSelect(primary === "drawing" ? ["cone", actor.id] : [actor.id, "cone"]));
    expect(colorTrigger().props.children.props.accessibilityHint).toBe("Seleção com cores diferentes.");
    openColors();
    expect(tree.root.findAllByType(Pressable).filter(node => node.props.accessibilityLabel?.startsWith("Aplicar cor ")).every(node => node.props.accessibilityState.selected === false)).toBe(true);
    act(() => tree.root.findAllByType("Dropdown" as never).find(node => node.props.preferredWidth === 144)!.props.onRequestClose());
    openProperties();
    expect(paletteButton("Cor #19c87b").props.accessibilityState.selected).toBe(false);
    expect(paletteButton("Cor #4389ff").props.accessibilityState.selected).toBe(false);
    act(() => paletteButton("Cor #ffdc53").props.onPress());
    expect(editor.commit).toHaveBeenCalledTimes(1);
    expect(editor.payload.actors[0].color).toBe(primary === "locked-primary" ? "#19c87b" : "#ffdc53");
    expect(editor.payload.editor!.drawings[stepId][0].color).toBe("#ffdc53");
    if (primary === "locked-primary") expect(tree.root.findAllByProps({ accessibilityLabel: "Rótulo do jogador" })).toHaveLength(0);
  });

  it.each(["opening", "suspended", "readOnly", "playing", "all-locked", "group-hidden"])("does not commit a contextual color after %s disables the selection", async state => {
    await mount(); const ids = editor.payload.actors.slice(0, 2).map(item => item.id);
    act(() => canvas().onSelect(ids)); openColors();
    if (state === "playing") act(() => tree.root.findByType("Transport" as never).props.onPlay());
    else act(() => {
      if (state === "opening") editor = { ...editor, opening: true };
      if (state === "all-locked") editor = { ...editor, payload: { ...editor.payload, editor: { ...editor.payload.editor!, actorMeta: { ...editor.payload.editor!.actorMeta, ...Object.fromEntries(ids.map(id => [id, { locked: true }])) } } } };
      if (state === "group-hidden") editor = { ...editor, payload: { ...editor.payload, editor: { ...editor.payload.editor!, hiddenLayers: ["actors"] } } };
      render(state === "readOnly" ? { readOnly: true } : state === "suspended" ? { suspended: true } : {});
    });
    const before = editor.payload;
    expect(paletteButton("Aplicar cor #ffdc53").props.disabled).toBe(true);
    act(() => paletteButton("Aplicar cor #ffdc53").props.onPress());
    expect(editor.commit).not.toHaveBeenCalled(); expect(editor.payload).toBe(before);
  });

  it("preserves a 44px touch target and compact icon in the real button primitive", async () => {
    const { CourtActionButton, CourtToolIcon } = jest.requireActual<typeof import("../CourtEditorControls")>("../CourtEditorControls");
    await act(async () => { tree = TestRenderer.create(React.createElement(CourtActionButton, { label: "Selecionar", icon: "navigate", compact: true, touchTarget: true, onPress: jest.fn() })); });
    const button = tree.root.findByType(Pressable);
    const style = StyleSheet.flatten(button.props.style({ hovered: false, pressed: false }));
    expect(style).toMatchObject({ width: 44, minWidth: 44, minHeight: 44 });
    expect(tree.root.findByType(CourtToolIcon).props.size).toBe(18);
  });

  it.each([[1329, 844], [1366, 650]])("returns to selection for arrow handles on desktop at %ix%i", async (width, height) => {
    await mount(width, {}, {}, height);
    press("Desenhar seta");
    act(() => canvas().onDraw({ id: "arrow", kind: "arrow", points: [{ x: .2, y: .3 }, { x: .5, y: .6 }], size: 32, color: "#19c87b", rotation: 0 }));
    expect(canvas().tool).toBe("select");
    expect(canvas().selected).toEqual(["arrow"]);
    expect(action("Selecionar e mover").props.touchTarget).toBe(false);
  });

  it("finishes a desktop curve with Tools closed, then edits its shape in one undoable commit", async () => {
    await mount(1329); press("Mais ferramentas");
    const curve: CourtDrawing = { id: "curve", kind: "curve", points: [{ x: .2, y: .3 }, { x: .8, y: .6 }], color: "#fff", size: 32, rotation: 0 };
    act(() => canvas().onDraw(curve));
    expect(canvas().tool).toBe("select"); expect(tree.root.findAllByProps({ accessibilityLabel: "Painel Ferramentas" })).toHaveLength(0);
    (editor.commit as jest.Mock).mockClear(); const before = editor.payload;
    const shape = { kind: "curve" as const, curveMode: "through-point" as const, points: [curve.points[0], { x: .5, y: .2 }, curve.points[1]] };
    act(() => canvas().onEditArrow?.(curve.id, shape));
    expect(editor.commit).toHaveBeenCalledTimes(1); expect(canvas().selected).toEqual([curve.id]);
    expect(editor.payload.editor!.drawings[editor.payload.timeline.steps[0].id][0]).toEqual({ ...curve, ...shape });
    act(() => canvas().onEditArrow?.(curve.id, shape)); expect(editor.commit).toHaveBeenCalledTimes(1);
    act(() => editor.undo()); expect(editor.payload).toBe(before);
  });

  it("commits and undoes a ball binding, preserves it when curving and removes it when detached", async () => {
    const payload = newCourtBoard(), stepId = payload.timeline.steps[0].id;
    const arrow: CourtDrawing = { id: "arrow", kind: "arrow", points: [{ x: .2, y: .3 }, { x: .8, y: .6 }], color: "#fff", size: 32, rotation: 0 };
    const ball: CourtDrawing = { id: "ball", kind: "ball", points: [{ x: .1, y: .2 }], color: "#ff0", size: 32, rotation: 0 };
    payload.editor!.drawings[stepId] = [arrow, ball]; await mount(1329, { payload }); act(() => canvas().onSelect([arrow.id]));
    const getArrow = () => editor.payload.editor!.drawings[stepId][0];
    const shape = { kind: "arrow" as const, points: [ball.points[0], arrow.points[1]], startBallId: ball.id };
    act(() => canvas().onEditArrow?.(arrow.id, shape)); expect(editor.commit).toHaveBeenCalledTimes(1); expect(getArrow()).toMatchObject(shape);
    act(() => canvas().onEditArrow?.(arrow.id, shape)); expect(editor.commit).toHaveBeenCalledTimes(1);
    act(() => editor.undo()); expect(editor.payload).toBe(payload);
    act(() => canvas().onEditArrow?.(arrow.id, shape));
    act(() => canvas().onEditArrow?.(arrow.id, { ...shape, kind: "curve", curveMode: "through-point", points: [ball.points[0], { x: .5, y: .2 }, arrow.points[1]] }));
    expect(getArrow().startBallId).toBe(ball.id);
    act(() => canvas().onEditArrow?.(arrow.id, { kind: "arrow", points: arrow.points }));
    expect(getArrow().startBallId).toBeUndefined(); expect(getArrow().curveMode).toBeUndefined(); expect(getArrow().points).toEqual(arrow.points);
    act(() => editor.undo()); expect(getArrow().startBallId).toBe(ball.id);
    act(() => canvas().onEditArrow?.(arrow.id, { ...shape, startBallId: "missing-ball" })); expect(getArrow().startBallId).toBeUndefined();
  });

  it.each(["locked", "hidden", "readOnly", "playing", "suspended"])("protects arrow shape edits while %s", async state => {
    const payload = newCourtBoard(), stepId = payload.timeline.steps[0].id;
    payload.editor!.drawings[stepId] = [{ id: "arrow", kind: "arrow", points: [{ x: .2, y: .3 }, { x: .8, y: .6 }], color: "#fff", size: 32, rotation: 0, locked: state === "locked", hidden: state === "hidden" }];
    await mount(1329, { payload }); act(() => canvas().onSelect(["arrow"]));
    if (state === "readOnly" || state === "suspended") act(() => render({ [state]: true }));
    if (state === "playing") act(() => tree.root.findByType("Transport" as never).props.onPlay());
    act(() => canvas().onEditArrow?.("arrow", { kind: "curve", curveMode: "through-point", points: [{ x: .2, y: .3 }, { x: .5, y: .2 }, { x: .8, y: .6 }] }));
    expect(editor.commit).not.toHaveBeenCalled(); expect(editor.payload).toBe(payload);
  });

  it("changes 3D height in one undoable edit without moving the object on the floor", async () => {
    const payload = newCourtBoard(), stepId = payload.timeline.steps[0].id;
    payload.editor!.drawings[stepId] = [{ id: "ball", kind: "ball", points: [{ x: .3, y: .4 }], color: "#fff", size: 32, rotation: 0 }];
    await mount(1329, { payload }, { readOnly: true }); act(() => render({}));
    const perspective = () => tree.root.findByType("Perspective" as never).props as CourtPerspectiveCanvasProps;
    act(() => perspective().onSelect(["ball"]));
    act(() => perspective().onElevation?.("ball", 2.4));
    expect(editor.commit).toHaveBeenCalledTimes(1);
    expect(editor.payload.editor!.drawings[stepId][0]).toMatchObject({ elevation: 2.4, points: [{ x: .3, y: .4 }] });
    act(() => perspective().onElevation?.("ball", 2.4)); expect(editor.commit).toHaveBeenCalledTimes(1);
    act(() => editor.undo()); expect(editor.payload).toBe(payload);
  });

  it.each(["locked", "hidden", "readOnly", "playing", "suspended", "selection", "tool", "2d"])("protects 3D height edits while %s", async state => {
    const payload = newCourtBoard(), stepId = payload.timeline.steps[0].id;
    payload.editor!.drawings[stepId] = [{ id: "ball", kind: "ball", points: [{ x: .3, y: .4 }], color: "#fff", size: 32, rotation: 0, locked: state === "locked", hidden: state === "hidden" }];
    await mount(1329, { payload }, { readOnly: true }); act(() => render({}));
    const perspective = () => tree.root.findByType("Perspective" as never).props as CourtPerspectiveCanvasProps;
    act(() => perspective().onSelect(["ball"]));
    if (state === "readOnly" || state === "suspended") act(() => render({ [state]: true }));
    if (state === "playing") act(() => tree.root.findByType("Transport" as never).props.onPlay());
    if (state === "selection") act(() => perspective().onSelect([]));
    if (state === "tool") press("Adicionar jogador");
    if (state === "2d") { press("Mais ferramentas"); press("Área por pontos"); }
    act(() => perspective().onElevation?.("ball", 2.4));
    expect(editor.commit).not.toHaveBeenCalled(); expect(editor.payload).toBe(payload);
  });

  it.each([
    [{ saving: true, autosaveStatus: "saving" }, {}, false],
    [{ saving: true, autosaveStatus: "pending" }, {}, true],
    [{ opening: true }, {}, true],
    [{}, { suspended: true }, true],
    [{}, { readOnly: true }, true],
  ] as const)("preserves canvas guards for %j / %j", async (state, extra, disabled) => {
    await mount(390, state, extra);
    expect(canvas().disabled).toBe(disabled);
  });
});
