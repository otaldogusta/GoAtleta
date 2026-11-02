import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useVideoAlignmentEvidence } from '../video/use-video-alignment-evidence';
import { analysisCheckpointScope, loadAiCheckpoints } from '../video/video-analysis-checkpoints';
import type { VideoAiResult } from '../../../core/scouting-video-ai';

jest.mock('../video/video-analysis-checkpoints', () => ({
    analysisCheckpointScope: jest.fn((...parts: string[]) => JSON.stringify(parts)),
    loadAiCheckpoints: jest.fn(),
}));
const media = { fingerprint: 'youtube:abcdefghijk', youtubeId: 'abcdefghijk', duration: 60, name: 'Vídeo', width: 1920, height: 1080 };
const observed: VideoAiResult[] = [{ videoId: media.youtubeId, start: 0, end: 60, model: 'cached', rallies: [], contacts: [{ time: 20, skill: 'Ataque', side: 'far', evidence: 'Contato visível' }], limitations: [] }];

beforeEach(() => { jest.clearAllMocks(); (loadAiCheckpoints as jest.Mock).mockResolvedValue(observed); });

test('reuses scoped saved visual observations without starting new analysis', async () => {
    const view = renderHook(() => useVideoAlignmentEvidence('user', 'org', 'session', media));
    await waitFor(() => expect(view.result.current.observations).toEqual(observed));
    expect(analysisCheckpointScope).toHaveBeenCalledWith('user', 'org', 'session', media.fingerprint);
    expect(loadAiCheckpoints).toHaveBeenCalledWith(JSON.stringify(['user', 'org', 'session', media.fingerprint]), media.youtubeId, 60);
    view.rerender();
    expect(loadAiCheckpoints).toHaveBeenCalledTimes(1);
});

test('a late result from another account or game is never exposed', async () => {
    let finish!: (value: VideoAiResult[]) => void;
    (loadAiCheckpoints as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValueOnce([]);
    const view = renderHook(({ user }) => useVideoAlignmentEvidence(user, 'org', 'session', media), { initialProps: { user: 'first' } });
    view.rerender({ user: 'second' });
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    await act(async () => { finish(observed); });
    expect(view.result.current.observations).toEqual([]);
});

test('failed checkpoint reads leave manual review available and support retry', async () => {
    (loadAiCheckpoints as jest.Mock).mockRejectedValueOnce(new Error('IDB unavailable'));
    const view = renderHook(() => useVideoAlignmentEvidence('user', 'org', 'session', media));
    await waitFor(() => expect(view.result.current.error).toContain('preservados'));
    expect(view.result.current.observations).toEqual([]);
    act(() => view.result.current.retry());
    await waitFor(() => expect(view.result.current.observations).toEqual(observed));
    expect(view.result.current.error).toBe('');
});
