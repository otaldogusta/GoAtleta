import { act, renderHook, waitFor } from '@testing-library/react-native';
import { loadReviewSource, useVideoScoutingLinks } from '../video/use-video-scouting-links';
import { emptyScoutingVideoLinks } from '../../../core/scouting-video-links';
import { loadScoutingDetail, loadScoutingOverview, type ScoutingDetail } from '../../../db/scouting-collection';
import { compareAndPersistVideoDraft } from '../video/video-draft-storage';
const mockStorage = new Map<string, string>();
jest.mock('../../../db/scouting-collection', () => ({ loadScoutingDetail: jest.fn(), loadScoutingOverview: jest.fn() }));
jest.mock('../video/video-draft-storage', () => ({
    getVideoDraft: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
    compareAndPersistVideoDraft: jest.fn(async (key: string, expected: string | null, value: string) => {
        if ((mockStorage.get(key) ?? null) !== expected) throw new Error('Os vínculos foram atualizados em outra aba.');
        mockStorage.set(key, value);
    }),
}));
const source: ScoutingDetail = { session: { id: 'source', organizationId: 'org', classId: 'class', title: 'Set 1', date: '2026-11-01', type: 'jogo', status: 'concluido', createdAt: 'now', updatedAt: 'now' }, actions: [], captureReady: true,
    rallies: [{ id: 'p1', sessionId: 'source', setNumber: 1, number: 1, scoreUs: 1, scoreThem: 0, won: true, serve: 'us', rotation: null, contacts: [], createdAt: '2026-11-01T12:00:00Z' }] };
beforeEach(() => {
    jest.clearAllMocks(); mockStorage.clear();
    (loadScoutingOverview as jest.Mock).mockResolvedValue({ rows: [{ session: source.session }], ready: true });
    (loadScoutingDetail as jest.Mock).mockResolvedValue(source);
});
test('source reads verify organization, class and identity before exposing official points', async () => {
    for (const change of [{ organizationId: 'foreign' }, { classId: 'foreign' }, { id: 'foreign' }]) {
        (loadScoutingDetail as jest.Mock).mockResolvedValueOnce({ ...source, session: { ...source.session, ...change } });
        await expect(loadReviewSource('org', 'class', 'source')).rejects.toThrow('fora desta turma');
    }
    expect(loadScoutingDetail).toHaveBeenCalledWith('org', 'source');
});
test('linking sources and points persists only sidecar references and restores on reopening', async () => {
    const before = JSON.stringify(source);
    const first = renderHook(() => useVideoScoutingLinks('user:org:class:review:video', 'org', 'class', 'review', 600));
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    const next = { ...emptyScoutingVideoLinks(), sessionIds: ['source'], links: [{ sessionId: 'source', rallyId: 'p1', videoRallyId: 'v1', time: 20, missing: false }] };
    await act(async () => { expect(await first.result.current.save(next)).toBe(true); });
    expect(first.result.current.sources[0]).toEqual(source);
    expect(JSON.stringify(source)).toBe(before);
    first.unmount();
    const reopened = renderHook(() => useVideoScoutingLinks('user:org:class:review:video', 'org', 'class', 'review', 600));
    await waitFor(() => expect(reopened.result.current.links).toEqual(next));
    const other = renderHook(() => useVideoScoutingLinks('other-user:org:class:review:video', 'org', 'class', 'review', 600));
    await waitFor(() => expect(other.result.current.loading).toBe(false));
    expect(other.result.current.links.sessionIds).toEqual([]);
    expect(loadScoutingOverview).toHaveBeenCalledWith('org', 'class');
});
test('rejects unknown source, foreign point and failed storage without replacing the saved baseline', async () => {
    const view = renderHook(() => useVideoScoutingLinks('key', 'org', 'class', 'review', 600));
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    await act(async () => { expect(await view.result.current.save({ ...emptyScoutingVideoLinks(), sessionIds: ['foreign'] })).toBe(false); });
    expect(compareAndPersistVideoDraft).not.toHaveBeenCalled();
    await act(async () => { expect(await view.result.current.save({ version: 1, sessionIds: ['source'], links: [{ sessionId: 'source', rallyId: 'foreign-point', videoRallyId: null, time: null, missing: true }] })).toBe(false); });
    expect(compareAndPersistVideoDraft).not.toHaveBeenCalled();
    (compareAndPersistVideoDraft as jest.Mock).mockRejectedValueOnce(new Error('Storage failed'));
    await act(async () => { expect(await view.result.current.save({ ...emptyScoutingVideoLinks(), sessionIds: ['source'] })).toBe(false); });
    expect(view.result.current.links.sessionIds).toEqual([]);
    expect(view.result.current.error).toContain('Storage failed');
});

test('another tab cannot replace reviewed links and a reload recovers the newer baseline', async () => {
    const view = renderHook(() => useVideoScoutingLinks('shared-key', 'org', 'class', 'review', 600));
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    const newer = { version: 1, sessionIds: ['source'], links: [{ sessionId: 'source', rallyId: 'p1', videoRallyId: 'v1', time: 20, missing: false }] };
    mockStorage.set('shared-key', JSON.stringify(newer));
    await act(async () => { expect(await view.result.current.save({ ...emptyScoutingVideoLinks(), sessionIds: ['source'] })).toBe(false); });
    expect(JSON.parse(mockStorage.get('shared-key')!)).toEqual(newer);
    expect(view.result.current.error).toContain('outra aba');
    act(() => view.result.current.retry());
    await waitFor(() => expect(view.result.current.links).toEqual(newer));
});

test('an old callback cannot write into a new account, class or video context', async () => {
    const view = renderHook(({ key, org }) => useVideoScoutingLinks(key, org, 'class', 'review', 600), { initialProps: { key: 'first', org: 'org' } });
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    const staleSave = view.result.current.save;
    view.rerender({ key: 'second', org: 'other-org' });
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    await act(async () => { expect(await staleSave({ ...emptyScoutingVideoLinks(), sessionIds: ['source'] })).toBe(false); });
    expect(compareAndPersistVideoDraft).not.toHaveBeenCalled();
});
