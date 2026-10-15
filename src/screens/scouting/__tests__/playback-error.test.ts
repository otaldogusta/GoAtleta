import { playbackFailure, clearPlaybackFailure, PLAYBACK_ERROR } from '../video/playback-error';
test('intentional interruption does not report a playback failure', () => {
    expect(playbackFailure({ name: 'AbortError' })).toBeNull();
    expect(playbackFailure({ name: 'NotSupportedError' })).toBe(PLAYBACK_ERROR);
});
test('successful playback clears its old failure but preserves unrelated errors', () => {
    expect(clearPlaybackFailure(PLAYBACK_ERROR)).toBe('');
    expect(clearPlaybackFailure('Falha ao salvar')).toBe('Falha ao salvar');
});
