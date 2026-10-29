import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import SharedCourtScreen from '../SharedCourtScreen.web';
import { readSharedCourt } from '../../../api/court-sharing';
import { newCourtBoard } from '../../../core/visual-court-editor';
import type { CourtVisualPayload } from '../../../core/visual-court';

const mockRouter = { replace: jest.fn() };
const mockPlayerMounted = jest.fn(), mockPlayerUnmounted = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('react-dom', () => ({ createPortal: (children: React.ReactNode) => children }));
jest.mock('../../../api/court-sharing', () => ({ readSharedCourt: jest.fn() }));
jest.mock('../../../ui/app-theme', () => ({ useAppTheme: () => ({ colors: { background: '#111', text: '#eee', muted: '#aaa' } }) }));
jest.mock('../CourtEditorControls', () => ({ CourtActionButton: 'Action' }));
jest.mock('../CourtReadOnlyPlayer', () => ({ CourtReadOnlyPlayer: (props: object) => {
  const R = jest.requireActual<typeof import('react')>('react');
  const [viewState, onChangeView] = R.useState({ step: 0, camera: 'front', progress: 0, speed: 1 });
  R.useEffect(() => { mockPlayerMounted(); return () => mockPlayerUnmounted(); }, []);
  return R.createElement('court-viewer', { ...props, viewState, onChangeView });
} }));

const id = '20000000-0000-0000-0000-000000000001', code = 'a'.repeat(64);
const nextId = '20000000-0000-0000-0000-000000000002';
const descriptors = Object.fromEntries(['window', 'document'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
let tree: TestRenderer.ReactTestRenderer | undefined;
let payload: CourtVisualPayload;
let fakeDocument: { body: object; visibilityState: 'visible' | 'hidden'; addEventListener: (name: string, callback: () => void) => void; removeEventListener: (name: string, callback: () => void) => void };
let windowEvents: ReturnType<typeof events>, documentEvents: ReturnType<typeof events>;

function events() {
  const listeners = new Map<string, Set<() => void>>();
  return {
    addEventListener: (name: string, callback: () => void) => { const set = listeners.get(name) ?? new Set(); set.add(callback); listeners.set(name, set); },
    removeEventListener: (name: string, callback: () => void) => { const set = listeners.get(name); set?.delete(callback); if (!set?.size) listeners.delete(name); },
    emit: (name: string) => { for (const callback of [...(listeners.get(name) ?? [])]) callback(); },
    count: () => listeners.size,
  };
}
function deferred() {
  let resolve!: (value: CourtVisualPayload) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<CourtVisualPayload>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
const flush = () => act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); });
const mount = async () => { await act(async () => { tree = TestRenderer.create(React.createElement(SharedCourtScreen)); }); await flush(); };
const viewers = () => tree!.root.findAllByType('court-viewer' as never);
const action = (label: string) => tree!.root.findByProps({ label });
const visibility = async (state: 'visible' | 'hidden') => {
  act(() => { fakeDocument.visibilityState = state; documentEvents.emit('visibilitychange'); }); await flush();
};

beforeEach(() => {
  jest.clearAllMocks(); jest.useFakeTimers(); payload = newCourtBoard();
  windowEvents = events(); documentEvents = events();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { ...windowEvents, location: { hash: `#id=${id}&code=${code}` } } });
  fakeDocument = { ...documentEvents, body: {}, visibilityState: 'visible' };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: fakeDocument });
  jest.mocked(readSharedCourt).mockReset().mockResolvedValue(payload);
});
afterEach(() => {
  act(() => tree?.unmount()); tree = undefined; jest.restoreAllMocks(); jest.useRealTimers();
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
  }
});

it('keeps the same mounted player, document and view after a temporary resume failure and successful revalidation', async () => {
  await mount();
  const viewState = { step: 4, camera: 'side', progress: .37, speed: 1.5 };
  act(() => viewers()[0].props.onChangeView(viewState));
  jest.mocked(readSharedCourt).mockRejectedValueOnce(new Error('SERVICE_UNAVAILABLE'));
  await visibility('hidden'); await visibility('visible');
  expect(viewers()[0].props.payload).toBe(payload);
  expect(viewers()[0].props.viewState).toEqual(viewState);
  expect(mockPlayerMounted).toHaveBeenCalledTimes(1); expect(mockPlayerUnmounted).not.toHaveBeenCalled();
  jest.mocked(readSharedCourt).mockResolvedValueOnce(newCourtBoard());
  act(() => windowEvents.emit('online')); await flush();
  expect(viewers()[0].props.payload).toBe(payload);
  expect(viewers()[0].props.viewState).toEqual(viewState);
  expect(readSharedCourt).toHaveBeenCalledTimes(3);
});

it('aborts hidden reads and ignores their late completion without releasing the newer foreground request', async () => {
  await mount();
  const old = deferred(), fresh = deferred();
  jest.mocked(readSharedCourt).mockImplementationOnce(() => old.promise).mockImplementationOnce(() => fresh.promise);
  act(() => windowEvents.emit('online')); await flush();
  const oldSignal = jest.mocked(readSharedCourt).mock.calls[1][2];
  await visibility('hidden'); expect(oldSignal.aborted).toBe(true);
  act(() => jest.advanceTimersByTime(120000)); await flush(); expect(readSharedCourt).toHaveBeenCalledTimes(2);
  await visibility('visible'); expect(readSharedCourt).toHaveBeenCalledTimes(3);
  await act(async () => old.resolve(newCourtBoard()));
  act(() => { windowEvents.emit('online'); windowEvents.emit('pageshow'); }); await flush();
  expect(readSharedCourt).toHaveBeenCalledTimes(3);
  await act(async () => fresh.resolve(newCourtBoard()));
  expect(viewers()[0].props.payload).toBe(payload); expect(mockPlayerUnmounted).not.toHaveBeenCalled();
});

it('pauses on pagehide and resumes on pageshow without polling or reading while hidden', async () => {
  fakeDocument.visibilityState = 'hidden'; await mount(); expect(readSharedCourt).not.toHaveBeenCalled();
  act(() => windowEvents.emit('pageshow')); await flush(); expect(readSharedCourt).not.toHaveBeenCalled();
  await visibility('visible'); expect(readSharedCourt).toHaveBeenCalledTimes(1);
  act(() => { windowEvents.emit('pagehide'); windowEvents.emit('online'); jest.advanceTimersByTime(120000); }); await flush();
  expect(readSharedCourt).toHaveBeenCalledTimes(1);
  act(() => windowEvents.emit('pageshow')); await flush(); expect(readSharedCourt).toHaveBeenCalledTimes(2);
  expect(viewers()[0].props.payload).toBe(payload);
});

it('removes the player on definitive revocation and stops revalidating that access', async () => {
  await mount();
  jest.mocked(readSharedCourt).mockRejectedValueOnce(new Error('LINK_UNAVAILABLE'));
  act(() => windowEvents.emit('online')); await flush();
  expect(viewers()).toHaveLength(0); expect(JSON.stringify(tree!.toJSON())).toContain('Este link foi revogado ou não é válido.');
  act(() => { jest.advanceTimersByTime(120000); windowEvents.emit('online'); windowEvents.emit('pageshow'); }); await flush();
  expect(readSharedCourt).toHaveBeenCalledTimes(2); expect(mockPlayerUnmounted).toHaveBeenCalledTimes(1);
});

it('clears the previous share on hash changes and cannot restore it from a stale response', async () => {
  await mount();
  const old = deferred(), fresh = deferred(), next = newCourtBoard();
  jest.mocked(readSharedCourt).mockImplementationOnce(() => old.promise).mockImplementationOnce(() => fresh.promise);
  act(() => windowEvents.emit('online')); await flush();
  const signal = jest.mocked(readSharedCourt).mock.calls[1][2];
  act(() => { window.location.hash = `#id=${nextId}&code=${'b'.repeat(64)}`; windowEvents.emit('hashchange'); }); await flush();
  expect(signal.aborted).toBe(true); expect(viewers()).toHaveLength(0);
  expect(readSharedCourt).toHaveBeenLastCalledWith(nextId, 'b'.repeat(64), expect.any(AbortSignal));
  await act(async () => fresh.resolve(next));
  await act(async () => old.reject(new Error('LINK_UNAVAILABLE')));
  expect(viewers()[0].props.payload).toBe(next); expect(mockPlayerMounted).toHaveBeenCalledTimes(2);
});

it('ends an initial request timeout with a retry action even if the old read ignores abort', async () => {
  const old = deferred(); jest.mocked(readSharedCourt).mockImplementationOnce(() => old.promise);
  await mount(); const signal = jest.mocked(readSharedCourt).mock.calls[0][2];
  act(() => jest.advanceTimersByTime(20000)); await flush();
  expect(signal.aborted).toBe(true); expect(viewers()).toHaveLength(0);
  expect(JSON.stringify(tree!.toJSON())).toContain('Não foi possível abrir a jogada. Tente novamente.');
  act(() => action('Tentar novamente').props.onPress()); await flush();
  expect(viewers()[0].props.payload).toBe(payload);
  await act(async () => old.resolve(newCourtBoard())); expect(viewers()[0].props.payload).toBe(payload);
});

it('retains a mounted player after a revalidation timeout and can retry immediately when back online', async () => {
  await mount(); const pending = deferred();
  jest.mocked(readSharedCourt).mockImplementationOnce(() => pending.promise);
  act(() => windowEvents.emit('online')); await flush();
  act(() => jest.advanceTimersByTime(20000)); await flush();
  expect(viewers()[0].props.payload).toBe(payload); expect(mockPlayerUnmounted).not.toHaveBeenCalled();
  act(() => windowEvents.emit('online')); await flush();
  expect(readSharedCourt).toHaveBeenCalledTimes(3);
  await act(async () => pending.reject(new Error('SERVICE_UNAVAILABLE')));
  expect(viewers()[0].props.payload).toBe(payload);
});

it('aborts on unmount and removes lifecycle listeners and pending timers', async () => {
  const scheduled = jest.spyOn(globalThis, 'setTimeout'), cleared = jest.spyOn(globalThis, 'clearTimeout');
  const pending = deferred(); jest.mocked(readSharedCourt).mockImplementationOnce(() => pending.promise);
  await mount(); const signal = jest.mocked(readSharedCourt).mock.calls[0][2];
  const deadline = scheduled.mock.results[scheduled.mock.calls.findIndex(call => call[1] === 20000)].value;
  act(() => { tree!.unmount(); tree = undefined; });
  expect(signal.aborted).toBe(true); expect(documentEvents.count()).toBe(0); expect(windowEvents.count()).toBe(0);
  expect(cleared).toHaveBeenCalledWith(deadline);
  act(() => jest.advanceTimersByTime(120000)); await flush(); expect(readSharedCourt).toHaveBeenCalledTimes(1);
  await act(async () => pending.resolve(payload)); expect(mockPlayerMounted).not.toHaveBeenCalled();
});
