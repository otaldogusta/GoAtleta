export const PLAYBACK_ERROR = 'Não foi possível reproduzir o vídeo.';
/** pause/load can intentionally cancel a pending play promise. */
export function playbackFailure(error: unknown): string | null {
    return error && typeof error === 'object' && 'name' in error && error.name === 'AbortError' ? null : PLAYBACK_ERROR;
}
export function clearPlaybackFailure(error: string): string {
    return error === PLAYBACK_ERROR ? '' : error;
}
