import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useVideoVisualAlignment } from '../video/use-video-visual-alignment';
import { requestLocalVideoAi } from '../../../api/scouting-video-ai';
import { compareAndPersistVideoDraft } from '../video/video-draft-storage';
import type { ScoutingRally } from '../../../core/models';
const mockStorage = new Map<string,string>();
jest.mock('../../../api/scouting-video-ai', () => ({ requestLocalVideoAi: jest.fn() }));
jest.mock('../video/video-draft-storage', () => ({
    getVideoDraft: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
    compareAndPersistVideoDraft: jest.fn(async (key: string, expected: string | null, data: string) => {
        if ((mockStorage.get(key) ?? null) !== expected) throw new Error('Outra aba alterou a revisão.');
        mockStorage.set(key,data);
    }),
}));
const media = { youtubeId: 'abcdefghijk', fingerprint: 'youtube:abcdefghijk', name: 'Video', duration: 600, width: 1920, height: 1080 };
const point = (number: number): ScoutingRally => ({ id: `p${number}`, sessionId: 'set', setNumber: 1, number, won: true, serve: 'us', rotation: null, contacts: [], createdAt: '2026-11-01T12:00:00Z', scoreUs: number, scoreThem: 0 });
const input = { points: [point(1),point(2),point(3)], anchors: [1,3].map(number => ({ sessionId: 'set', rallyId: `p${number}`, videoRallyId: `v${number}`, time: number === 1 ? 60 : 180, missing: false })), ourSide: 'far' as const, setNumber: 1, sessionId: 'set' };
beforeEach(() => {
    jest.clearAllMocks(); mockStorage.clear();
    (requestLocalVideoAi as jest.Mock).mockImplementation(async (_op, req) => ({ videoId: req.videoId, start: req.start, end: req.end, model: 'test', rallies: [{ start: req.start + 5, end: req.start + 15, winner: 'far', evidence: 'Ponto visível.' }], limitations: [] }));
});

test('opens without paid calls, then explicitly verifies only gaps and reuses saved windows', async () => {
    const view = renderHook(() => useVideoVisualAlignment('user','org','session',media));
    await act(async () => { await Promise.resolve(); });
    expect(requestLocalVideoAi).not.toHaveBeenCalled();
    await act(async () => { await view.result.current.run(input); });
    expect(requestLocalVideoAi).toHaveBeenCalledTimes(2);
    expect(view.result.current.visualRallies).toHaveLength(2);
    expect(view.result.current.visualRallies[0].winner).toBe('us');
    expect(view.result.current.processedSeconds).toBe(120);
    await act(async () => { await view.result.current.run(input); });
    expect(requestLocalVideoAi).toHaveBeenCalledTimes(2);
    expect(compareAndPersistVideoDraft).toHaveBeenCalledTimes(2);
});

test('an error preserves completed windows and can resume instead of restarting the match', async () => {
    (requestLocalVideoAi as jest.Mock).mockImplementationOnce(async (_op, req) => ({ ...req, model: 'test', rallies: [{ start: 65, end: 70, winner: 'unknown', evidence: 'Rally parcial.' }], limitations: [] })).mockRejectedValueOnce(new Error('Gemini indisponível'));
    const view = renderHook(() => useVideoVisualAlignment('user','org','session',media));
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await view.result.current.run(input); });
    expect(view.result.current.visualRallies).toHaveLength(1);
    expect(view.result.current.error).toContain('indisponível');
    expect(mockStorage.size).toBe(1);
    await act(async () => { await view.result.current.run(input); });
    expect(view.result.current.visualRallies).toHaveLength(2);
    expect(requestLocalVideoAi).toHaveBeenCalledTimes(3);
});

test('a new account never receives visual observations saved under another scope', async () => {
    const first = renderHook(() => useVideoVisualAlignment('first','org','session',media));
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await first.result.current.run(input); });
    first.unmount();
    const second = renderHook(() => useVideoVisualAlignment('second','org','session',media));
    await waitFor(() => expect(second.result.current.visualRallies).toEqual([]));
    expect(second.result.current.processedSeconds).toBe(0);
});

test('playback rerenders reuse visual evidence and a corrected side remaps it without paid calls', async () => {
    const sideKey = JSON.stringify(['set',1]), far = { [sideKey]: 'far' as const }, near = { [sideKey]: 'near' as const };
    const view = renderHook(({ sides }) => useVideoVisualAlignment('user','org','session',media,sides), { initialProps: { sides: far as Record<string,'near'|'far'> } });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await view.result.current.run(input); });
    const stable = view.result.current.visualRallies;
    view.rerender({ sides: far });
    expect(view.result.current.visualRallies).toBe(stable);
    view.rerender({ sides: near });
    expect(view.result.current.visualRallies[0].winner).toBe('them');
    expect(requestLocalVideoAi).toHaveBeenCalledTimes(2);
});

test('limits each run to eight new windows and resumes remaining footage from cache', async () => {
    const expanded = { ...input, anchors: input.anchors.map((anchor,i) => ({ ...anchor, time: i ? 590 : 0 })) };
    const view = renderHook(() => useVideoVisualAlignment('user','org','session',media));
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await view.result.current.run(expanded); });
    expect(requestLocalVideoAi).toHaveBeenCalledTimes(8);
    expect(view.result.current.message).toContain('Oito');
    expect(view.result.current.error).toBe('');
    await act(async () => { await view.result.current.run(expanded); });
    expect(requestLocalVideoAi).toHaveBeenCalledTimes(10);
    expect(view.result.current.message).toContain('concluída');
});

test('cancellation preserves finished windows without committing a late result', async () => {
    const normal = (requestLocalVideoAi as jest.Mock).getMockImplementation()!;
    (requestLocalVideoAi as jest.Mock).mockImplementationOnce(normal).mockImplementationOnce((_op,_req,signal: AbortSignal) => new Promise((_resolve,reject) => signal.addEventListener('abort',()=>reject(new Error('Cancelado')),{once:true})));
    const view = renderHook(() => useVideoVisualAlignment('user','org','session',media));
    await act(async () => { await Promise.resolve(); });
    let running!: Promise<void>;
    act(() => { running = view.result.current.run(input); });
    await waitFor(() => expect(requestLocalVideoAi).toHaveBeenCalledTimes(2));
    await act(async () => { view.result.current.cancel(); await running; });
    expect(view.result.current.visualRallies).toHaveLength(1);
    expect(compareAndPersistVideoDraft).toHaveBeenCalledTimes(1);
    expect(view.result.current.message).toContain('preservados');
    expect(view.result.current.loading).toBe(false);
});

test('unreadable visual windows remain manual gaps while other windows continue without automatic paid retries', async () => {
    (requestLocalVideoAi as jest.Mock).mockRejectedValueOnce(new Error('A conferência visual retornou observações inválidas.'));
    const view = renderHook(() => useVideoVisualAlignment('user','org','session',media));
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await view.result.current.run(input); });
    expect(requestLocalVideoAi).toHaveBeenCalledTimes(2);
    expect(view.result.current.visualRallies).toHaveLength(1);
    expect(view.result.current.failedWindows).toBe(1);
    expect(view.result.current.error).toBe('');
    expect(view.result.current.message).toContain('manualmente');
    await act(async () => { await view.result.current.run(input); });
    expect(requestLocalVideoAi).toHaveBeenCalledTimes(2);
    await act(async () => { await view.result.current.run({...input,retryFailed:true}); });
    expect(requestLocalVideoAi).toHaveBeenCalledTimes(3);
    expect(view.result.current.failedWindows).toBe(0);
    expect(view.result.current.visualRallies).toHaveLength(2);
});
