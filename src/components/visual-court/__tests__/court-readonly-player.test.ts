import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Platform } from 'react-native';
import { CourtReadOnlyPlayer } from '../CourtReadOnlyPlayer';
import { CourtWorkspaceView } from '../CourtWorkspaceView';
import { newCourtBoard, duplicateStep, upgradeCourtEditor } from '../../../core/visual-court-editor';
import { buildEditable5x1ReceptionPreset } from '../../../core/visual-court';
import { publishableCourt } from '../../../core/court-sharing';
import { sampleCourtSimulation } from '../../../core/court-simulation';

jest.mock('../CourtPerspectiveCanvas', () => ({ CourtPerspectiveCanvas: 'Perspective' }));
jest.mock('../CourtEditorCanvas', () => ({ CourtEditorCanvas: 'Canvas' }));
jest.mock('../CourtEditorControls', () => ({ CourtActionButton: 'Action' }));
jest.mock('../CourtSimulationControls', () => ({ CourtSimulationTransport: 'Transport', CourtSimulationModes: 'Modes', CourtSimulationSettings: 'Settings' }));
jest.mock('../CourtStepGallery', () => ({ CourtStepGallery: 'Gallery' }));
jest.mock('../CourtLibraryBrowser', () => ({ CourtLibraryBrowser: 'Library' }));
jest.mock('../CourtEditableTitle', () => ({ CourtEditableTitle: 'Title' }));
jest.mock('../CourtWorkspacePanel', () => ({ CourtWorkspacePanel: ({ adjustments, steps, ...props }: { adjustments: React.ReactNode; steps: React.ReactNode }) => {
  const R = jest.requireActual<typeof import('react')>('react');
  return R.createElement('Panel', props, adjustments, steps);
} }));
jest.mock('../court-export', () => ({ exportCourt: jest.fn() }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../useCourtEditor', () => ({ useCourtEditor: () => { throw new Error('Readonly player must not load the private editor'); } }));

it('opens legacy shared reception with the current six animated rotations before any mode switch', async () => {
  const payload = publishableCourt(upgradeCourtEditor(buildEditable5x1ReceptionPreset(), 'Recepção publicada'));
  const original = JSON.stringify(payload);
  expect(payload.timeline.steps).toHaveLength(12);
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(React.createElement(CourtReadOnlyPlayer, { payload, onClose: () => {} })); });
  const surface = () => tree.root.findByType('Perspective' as never);
  const opened = surface().props.payload;
  expect(opened.timeline.steps).toHaveLength(6);
  expect(opened.timeline.steps.map((step: { durationMs: number }) => step.durationMs)).toEqual(
    Array.from({ length: 6 }, (_, index) => Math.round(sampleCourtSimulation(opened, index, 0)!.duration * 1000)),
  );
  const initialBases = opened.timeline.steps[0].simulation.actorIds.map((id: string) => opened.timeline.steps[0].actorPositions[id]);
  act(() => tree.root.findByType('Modes' as never).props.onChange('attack'));
  act(() => tree.root.findByType('Modes' as never).props.onChange('receive'));
  const returned = surface().props.payload;
  expect(returned.timeline.steps).toHaveLength(6);
  expect(returned.timeline.steps[0].simulation.actorIds.map((id: string) => returned.timeline.steps[0].actorPositions[id])).toEqual(initialBases);
  expect(JSON.stringify(payload)).toBe(original);
  act(() => tree.unmount());
});

it('keeps playback advancing when zooming the 3D view without a pan button or shared document changes', async () => {
  jest.useFakeTimers();
  const payload = newCourtBoard(), original = JSON.stringify(payload);
  let tree!: TestRenderer.ReactTestRenderer;
  try {
    await act(async () => { tree = TestRenderer.create(React.createElement(CourtReadOnlyPlayer, { payload, onClose: () => {} })); });
    const transport = () => tree.root.findByType('Transport' as never);
    const surface = () => tree.root.findByType('Perspective' as never);
    act(() => transport().props.onPlay());
    act(() => jest.advanceTimersByTime(64));
    const before = transport().props.progress;
    expect(tree.root.findAllByProps({ label: 'Mover a vista' })).toHaveLength(0);
    act(() => tree.root.findByProps({ label: 'Ampliar' }).props.onPress());
    expect(transport().props.playing).toBe(true);
    act(() => jest.advanceTimersByTime(96));
    expect(transport().props.progress).toBeGreaterThan(before);
    expect(surface().props.disabled).toBe(true);
    expect(surface().props.allowServeHandle).toBe(false);
    expect(JSON.stringify(payload)).toBe(original);
  } finally {
    if (tree) act(() => tree.unmount());
    jest.useRealTimers();
  }
});

it.each(['visibilitychange', 'pagehide', 'hidden-tick'] as const)('pauses at the viewed position on %s and only continues after manual Play', async event => {
  jest.useFakeTimers();
  const platform = Object.getOwnPropertyDescriptor(Platform, 'OS');
  const names = ['document', 'window'] as const;
  const descriptors = names.map(name => Object.getOwnPropertyDescriptor(globalThis, name));
  const eventHost = () => {
    const handlers = new Map<string, Set<() => void>>();
    return {
      handlers,
      addEventListener: (name: string, handler: () => void) => { if (!handlers.has(name)) handlers.set(name, new Set()); handlers.get(name)!.add(handler); },
      removeEventListener: (name: string, handler: () => void) => { handlers.get(name)?.delete(handler); },
      dispatch: (name: string) => { [...(handlers.get(name) ?? [])].forEach(handler => handler()); },
    };
  };
  const doc = { ...eventHost(), visibilityState: 'visible', getElementById: () => null };
  const win = { ...eventHost(), location: { href: 'http://localhost:8081/court/shared' }, history: { state: null, replaceState: jest.fn() } };
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: win });
  const intervals = jest.spyOn(globalThis, 'setInterval');
  const clear = jest.spyOn(globalThis, 'clearInterval');
  const payload = duplicateStep(newCourtBoard(), 0).payload, original = JSON.stringify(payload);
  let tree!: TestRenderer.ReactTestRenderer;
  try {
    await act(async () => { tree = TestRenderer.create(React.createElement(CourtReadOnlyPlayer, { payload, onClose: () => {} })); });
    const transport = () => tree.root.findByType('Transport' as never);
    const surface = () => tree.root.findByType('Perspective' as never);
    act(() => tree.root.findByType('Gallery' as never).props.onSelect(1));
    act(() => tree.root.findByType('Settings' as never).props.onCameraView('side'));
    act(() => tree.root.findByProps({ label: 'Ampliar' }).props.onPress());
    act(() => transport().props.onSpeed(1.5));
    act(() => transport().props.onSeek(.2));
    act(() => transport().props.onPlay());
    act(() => jest.advanceTimersByTime(64));
    const before = transport().props.progress;
    expect(before).toBeGreaterThan(.2);
    const call = intervals.mock.calls.findIndex(([, delay]) => delay === 32);
    const queuedTick = intervals.mock.calls[call][0] as () => void;
    const timer = intervals.mock.results[call].value;
    if (event === 'pagehide') act(() => win.dispatch('pagehide'));
    else {
      doc.visibilityState = 'hidden';
      if (event === 'visibilitychange') act(() => doc.dispatch('visibilitychange'));
      else {
        jest.setSystemTime(Date.now() + 60000);
        act(() => queuedTick());
      }
    }
    expect(transport().props.playing).toBe(false);
    expect(clear).toHaveBeenCalledWith(timer);
    act(() => { jest.advanceTimersByTime(60000); queuedTick(); });
    doc.visibilityState = 'visible';
    act(() => { doc.dispatch('visibilitychange'); win.dispatch('pageshow'); queuedTick(); });
    expect(transport().props.playing).toBe(false);
    expect(transport().props.progress).toBe(before);
    expect(transport().props.speed).toBe(1.5);
    expect(surface().props).toMatchObject({ stepIndex: 1, cameraView: 'side', zoom: 1.25 });
    expect(JSON.stringify(payload)).toBe(original);
    expect(doc.handlers.get('visibilitychange')?.size).toBe(0);
    expect(win.handlers.get('pagehide')?.size).toBe(0);
    act(() => transport().props.onPlay());
    act(() => jest.advanceTimersByTime(64));
    expect(transport().props.playing).toBe(true);
    expect(transport().props.progress).toBeGreaterThan(before);
    expect(transport().props.progress).toBeLessThan(1);
    const resumedTimer = intervals.mock.results.at(-1)!.value;
    act(() => tree.unmount());
    expect(clear).toHaveBeenCalledWith(resumedTimer);
    expect(doc.handlers.get('visibilitychange')?.size).toBe(0);
    expect(win.handlers.get('pagehide')?.size).toBe(0);
    tree = undefined as unknown as TestRenderer.ReactTestRenderer;
  } finally {
    if (tree) act(() => tree.unmount());
    names.forEach((name, index) => {
      const descriptor = descriptors[index];
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    });
    if (platform) Object.defineProperty(Platform, 'OS', platform);
    jest.restoreAllMocks();
    jest.useRealTimers();
  }
});

it('offers playback, camera, views and steps without enabling editor mutations', async () => {
  const payload = duplicateStep(newCourtBoard(), 0).payload;
  const original = JSON.stringify(payload);
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(React.createElement(CourtReadOnlyPlayer, { payload, onClose: () => {} })); });
  const surface = () => tree.root.findByType('Perspective' as never);
  const controller = tree.root.findByType(CourtWorkspaceView).props.editor;
  const mutation = jest.fn(() => payload);
  controller.commit(mutation);
  expect(mutation).not.toHaveBeenCalled();
  expect(controller.roster).toEqual([]); expect(controller.documents).toEqual([]);
  await expect(controller.save()).resolves.toBe(false);
  expect(surface().props.disabled).toBe(true);
  expect(surface().props.readOnly).toBe(true);
  expect(surface().props.allowServeHandle).toBe(true);
  act(() => { surface().props.onMove(['player'], { x: 1, y: 1 }); surface().props.onDraw({}); surface().props.onShortcut('save'); });
  expect(JSON.stringify(payload)).toBe(original);
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Salvar jogada' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Salvando jogada automaticamente' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ label: 'Adicionar jogador' })).toHaveLength(0);
  expect(tree.root.findByType('Gallery' as never).props.readOnly).toBe(true);
  act(() => tree.root.findByType('Gallery' as never).props.onSelect(1));
  expect(surface().props.stepIndex).toBe(1);
  act(() => tree.root.findByType('Settings' as never).props.onCameraView('side'));
  expect(surface().props.cameraView).toBe('side');
  act(() => tree.root.findByType('Settings' as never).props.onLabelsVisible(false));
  expect(surface().props.payload.editor.hiddenLayers).toContain('labels');
  expect(tree.root.findByType('Settings' as never).props.disabled).toBe(false);
  expect(tree.root.findByType('Settings' as never).props.exportDisabled).toBe(true);
  act(() => tree.root.findByType('Settings' as never).props.onChange({ system: '6-2', serve: 'spin', target: 'right' }));
  expect(surface().props.payload).not.toBe(payload);
  expect(surface().props.payload.timeline.steps[1].simulation.system).toBe('6-2');
  expect(JSON.stringify(payload)).toBe(original);
  act(() => tree.root.findByType('Modes' as never).props.onChange('attack'));
  expect(surface().props.payload.timeline.steps[1].simulation.mode).toBe('attack');
  act(() => tree.root.findByType('Settings' as never).props.onRestore());
  expect(surface().props.payload).toBe(payload);
  act(() => tree.root.findByType('Settings' as never).props.onChange({ mode: 'receive' }));
  const beforeServe = surface().props.payload;
  act(() => surface().props.onSimulationHandle({ kind: 'serve', point: { x: 2, y: .03, z: 6 } }));
  expect(surface().props.payload).not.toBe(beforeServe);
  const afterServe = surface().props.payload;
  act(() => surface().props.onSimulationHandle({ kind: 'hit', point: { x: 2, y: .03, z: 6 } }));
  expect(surface().props.payload).toBe(afterServe);
  expect(JSON.stringify(payload)).toBe(original);
  expect(tree.root.findByProps({ label: 'Ampliar' }).props.disabled).toBe(false);
  expect(JSON.stringify(payload)).toBe(original);
  act(() => tree.unmount());
});


it('opens adjustments from the transport list even after viewing steps', async () => {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(React.createElement(CourtReadOnlyPlayer, { payload: newCourtBoard(), onClose: () => {} })); });
  const panel = () => tree.root.findByType('Panel' as never);
  const openList = () => act(() => tree.root.findByType('Transport' as never).props.onOpenSteps());
  openList();
  expect(panel().props).toMatchObject({ open: true, tab: 'adjustments' });
  act(() => panel().props.onTabChange('steps'));
  expect(panel().props.tab).toBe('steps');
  act(() => panel().props.onRequestClose());
  expect(panel().props.open).toBe(false);
  openList();
  expect(panel().props).toMatchObject({ open: true, tab: 'adjustments' });
  act(() => tree.unmount());
});
