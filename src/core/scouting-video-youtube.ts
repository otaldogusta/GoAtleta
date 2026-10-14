export const youtubeIdPattern = /^[A-Za-z0-9_-]{11}$/;

/** Accept only known video URL shapes; never use user input as an iframe URL. */
export function youtubeVideoId(input: string): string {
    let url: URL;
    try { url = new URL(input.trim()); } catch { throw new Error('Informe um link válido do YouTube.'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error('Informe um link HTTPS do YouTube.');
    const host = url.hostname.toLowerCase();
    let id: string | null = null;
    if (host === 'youtu.be' && /^\/[^/]+\/?$/.test(url.pathname)) id = url.pathname.split('/')[1];
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)) {
        if (url.pathname === '/watch') id = url.searchParams.get('v');
        else id = /^\/(?:embed|shorts|live)\/([^/]+)\/?$/.exec(url.pathname)?.[1] ?? null;
    }
    if (!id || !youtubeIdPattern.test(id)) throw new Error('Informe o link de um vídeo do YouTube.');
    return id;
}

export function youtubePlayerError(code: number) {
    if (code === 100) return 'Vídeo removido, privado ou indisponível no YouTube.';
    if (code === 101 || code === 150) return 'O proprietário não permite incorporar este vídeo.';
    if (code === 153) return 'O YouTube não autorizou o player neste navegador. Tente outro navegador.';
    return 'Não foi possível reproduzir este vídeo do YouTube.';
}
