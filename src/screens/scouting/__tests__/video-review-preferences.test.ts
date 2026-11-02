import { act, renderHook, waitFor } from '@testing-library/react-native';
import { parseVideoReviewPreferences, useVideoReviewPreferences } from '../video/use-video-review-preferences';
import { compareAndPersistVideoDraft, getVideoDraft } from '../video/video-draft-storage';

const mockStorage = new Map<string, string>();
jest.mock('../video/video-draft-storage', () => ({ getVideoDraft: jest.fn(), compareAndPersistVideoDraft: jest.fn() }));
const mockRead = getVideoDraft as jest.Mock, mockWrite = compareAndPersistVideoDraft as jest.Mock;
const key = 'goatleta:scouting-video-links:v1:user:org:class:review:video';
const storedKey = `${key}:preferences:v1`, sideKey = JSON.stringify(['source', 1]);
const saved = { version: 1 as const, format: '21-23' as const, sides: { [sideKey]: 'far' as const } };
beforeEach(() => {
    jest.clearAllMocks(); mockStorage.clear();
    mockRead.mockImplementation(async (scope: string) => mockStorage.get(scope) ?? null);
    mockWrite.mockImplementation(async (scope: string, expected: string | null, value: string) => {
        if ((mockStorage.get(scope) ?? null) !== expected) throw new Error('Outdated preferences.');
        mockStorage.set(scope, value);
    });
});

test('preference parser accepts only explicit format and scoped set-side values', () => {
    expect(parseVideoReviewPreferences(saved)).toEqual(saved);
    for (const change of [{ version: 2 }, { format: '25' }, { sides: [] }, { sides: { [sideKey]: 'left' } }, { sides: { '__proto__': null, wrong: 'far' } }, { sides: { '["source",0]': 'far' } }]) {
        expect(() => parseVideoReviewPreferences({ ...saved, ...change })).toThrow('inválidas');
    }
});

test('restores scoped preferences without writing or touching the reviewed links', async () => {
    mockStorage.set(key, '99-reviewed-links'); mockStorage.set(storedKey, JSON.stringify(saved));
    const view = renderHook(() => useVideoReviewPreferences(key));
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    expect(view.result.current.format).toBe('21-23'); expect(view.result.current.sides).toEqual(saved.sides);
    expect(mockRead).toHaveBeenCalledWith(storedKey); expect(mockWrite).not.toHaveBeenCalled();
    expect(mockStorage.get(key)).toBe('99-reviewed-links');
});

test('persists format and independent sides separately and restores them on reopen', async () => {
    mockStorage.set(key, '99-reviewed-links');
    const view = renderHook(() => useVideoReviewPreferences(key));
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    await act(async () => { expect(await view.result.current.setFormat('21-23')).toBe(true); });
    await act(async () => { expect(await view.result.current.setSide(sideKey, 'far')).toBe(true); });
    const otherSet = JSON.stringify(['second-source', 2]);
    await act(async () => { await view.result.current.setSide(otherSet, 'near'); });
    expect(JSON.parse(mockStorage.get(storedKey)!)).toEqual({ version: 1, format: '21-23', sides: { [sideKey]: 'far', [otherSet]: 'near' } });
    expect(mockStorage.get(key)).toBe('99-reviewed-links');
    view.unmount();
    const reopened = renderHook(() => useVideoReviewPreferences(key));
    await waitFor(() => expect(reopened.result.current.loading).toBe(false));
    expect(reopened.result.current.sides[sideKey]).toBe('far');
    const other = renderHook(() => useVideoReviewPreferences(`${key}-other-user`));
    await waitFor(() => expect(other.result.current.loading).toBe(false));
    expect(other.result.current.format).toBe(''); expect(other.result.current.sides).toEqual({});
});

test('a failed read permits temporary manual choices without replacing unread settings', async () => {
    mockStorage.set(storedKey, JSON.stringify(saved)); mockRead.mockRejectedValueOnce(new Error('Storage unavailable.'));
    const view = renderHook(() => useVideoReviewPreferences(key));
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    await act(async () => { expect(await view.result.current.setSide(sideKey, 'near')).toBe(false); });
    expect(view.result.current.sides[sideKey]).toBe('near');
    expect(view.result.current.error).toContain('Preferências indisponíveis');
    expect(mockStorage.get(storedKey)).toBe(JSON.stringify(saved)); expect(mockWrite).not.toHaveBeenCalled();
});

test('a failed write is visible and cannot claim saved preferences', async () => {
    const view = renderHook(() => useVideoReviewPreferences(key));
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    mockWrite.mockRejectedValueOnce(new Error('Disk full.'));
    await act(async () => { expect(await view.result.current.setFormat('21-23')).toBe(false); });
    expect(view.result.current.format).toBe('21-23');
    expect(view.result.current.error).toContain('não salvas'); expect(mockStorage.has(storedKey)).toBe(false);
    await act(async () => { await view.result.current.setSide(sideKey, 'far'); });
    expect(mockWrite).toHaveBeenCalledTimes(1);
});

test('another tab changing preferences cannot be overwritten by a stale baseline', async () => {
    const view = renderHook(() => useVideoReviewPreferences(key));
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    mockStorage.set(storedKey, JSON.stringify(saved));
    await act(async () => { expect(await view.result.current.setSide(sideKey, 'near')).toBe(false); });
    expect(mockStorage.get(storedKey)).toBe(JSON.stringify(saved)); expect(view.result.current.error).toContain('não salvas');
    act(() => view.result.current.retry());
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    expect(view.result.current.error).toBe('');
    expect(view.result.current.sides[sideKey]).toBe('far');
});

test('a delayed previous-context read never exposes its sides in the next context', async () => {
    let resolveOld!: (value: string | null) => void;
    mockRead.mockImplementationOnce(() => new Promise<string | null>(resolve => { resolveOld = resolve; }));
    const view = renderHook(({ scope }) => useVideoReviewPreferences(scope), { initialProps: { scope: key } });
    view.rerender({ scope: 'other-scope' });
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    await act(async () => resolveOld(JSON.stringify(saved)));
    expect(view.result.current.format).toBe(''); expect(view.result.current.sides).toEqual({});
    expect(mockWrite).not.toHaveBeenCalled();
});

test('quick consecutive changes are serialized without losing the chosen format or side', async () => {
    const view = renderHook(() => useVideoReviewPreferences(key));
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    let first!: Promise<boolean>, second!: Promise<boolean>;
    await act(async () => { first = view.result.current.setFormat('21-23'); second = view.result.current.setSide(sideKey, 'far'); await Promise.all([first, second]); });
    expect(await first).toBe(true); expect(await second).toBe(true);
    expect(JSON.parse(mockStorage.get(storedKey)!)).toEqual(saved); expect(view.result.current.error).toBe('');
});
