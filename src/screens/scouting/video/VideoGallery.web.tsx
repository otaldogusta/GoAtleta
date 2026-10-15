import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoAtletaIcon } from '../../../ui/icon-registry';
import { memo, useEffect, useId, useRef, useState } from 'react';
import { videoTime, type VideoDocument, type VideoRally } from '../../../core/scouting-video';
import { StudioAction } from './StudioUI.web';
import { videoThumbnail } from './video-media.web';
function ThumbnailPlaceholder() {
    return <span className="sv-thumb-unavailable" role="img" aria-label="Miniatura indisponível ou carregando"><GoAtletaIcon name="gallery" size={28} color="currentColor"/></span>;
}
function Thumbnail({ source, time, poster, cacheKey, enabled = true }: {
    cacheKey?: string;
    enabled?: boolean;
    poster?: string;
    source: string;
    time: number;
}) {
    const ref = useRef<HTMLDivElement>(null), [image, setImage] = useState<{ source: string; time: number; url: string } | null>(null);
    const currentImage = image?.source === source && image.time === time ? image.url : '';
    useEffect(() => {

        let controller: AbortController | null = null;
        let loaded = false;
        const observer = new IntersectionObserver(entries => {
            const visible = entries.some(entry => entry.isIntersecting);
            if (!visible) { controller?.abort(); controller = null; return; }
            if (loaded || controller) return;
            const run = new AbortController(); controller = run;
            void (async () => {
                if (cacheKey) {
                    const cached = await AsyncStorage.getItem(cacheKey).catch(() => null);
                    if (cached?.startsWith('data:image/jpeg;base64,')) return cached;
                }
                if (!enabled || !source || run.signal.aborted) return '';
                const value = await videoThumbnail(source, time, run.signal);
                if (cacheKey && !run.signal.aborted && value.length <= 120000) {
                    await (async () => {
                        const prefix = cacheKey.slice(0, cacheKey.lastIndexOf(':') + 1);
                        const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(prefix));
                        if (keys.length >= 160 && !keys.includes(cacheKey)) await AsyncStorage.removeItem(keys[0]);
                        await AsyncStorage.setItem(cacheKey, value);
                    })().catch(() => undefined);
                }
                return value;
            })().then(value => {
                if (value && !run.signal.aborted) { loaded = true; setImage({ source, time, url: value }); }
            }).catch(() => undefined).finally(() => { if (controller === run) controller = null; });
        }, { root: ref.current?.closest?.('.sv-panel') ?? null, rootMargin: '0px', threshold: .01 });
        if (ref.current) observer.observe(ref.current);
        return () => { observer.disconnect(); controller?.abort(); };
    }, [source, time, enabled, cacheKey]);
    return <div ref={ref} className="sv-thumb">{currentImage || poster ? <img className="sv-thumb" src={currentImage || poster} alt="" title={currentImage ? 'Início do trecho' : 'Capa do vídeo'}/> : <ThumbnailPlaceholder/>}</div>;
}
function teamInitials(name: string) {
    return name.replace(/([a-z])([A-Z])/g, '$1 $2').trim().split(/\s+/).filter(Boolean)
        .slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase() || '?';
}
function RallyResult({ id, winner, teams }: {
    id: string;
    winner: VideoRally['winner'];
    teams: { us: string; them: string };
}) {
    const description = `${teams.us} × ${teams.them}. ${winner ? `Vencedor: ${teams[winner]}.` : 'Resultado não definido.'}`;
    return <span id={id} className="sv-rally-result" role="img" aria-label={description} title={description}>
      <span aria-hidden="true" className={`sv-team-dot${winner === 'us' ? ' won' : ''}`}>{teamInitials(teams.us)}</span>
      <span aria-hidden="true" className="sv-team-versus">×</span>
      <span aria-hidden="true" className={`sv-team-dot${winner === 'them' ? ' won' : ''}`}>{teamInitials(teams.them)}</span>
    </span>;
}
export const VideoGallery = memo(function VideoGallery({ doc, source, focus, teams, onFocus, onPlay, onDownload, onExport, onImport, readOnly = false, localMedia = true, thumbnailSource, offsetSeconds = 0, playing = false, thumbnailScope }: {
    thumbnailScope?: string;
    playing?: boolean;
    thumbnailSource?: string; offsetSeconds?: number;
    readOnly?: boolean;
    localMedia?: boolean;
    doc: VideoDocument;
    source: string;
    focus: string | null;
    teams: {
        us: string;
        them: string;
    };
    onFocus: (id: string | null) => void;
    onPlay?: () => void;
    onDownload: (ids: string[] | null) => void;
    onExport: () => void;
    onImport: () => void;
}) {
    const [selecting, setSelecting] = useState(false), [selected, setSelected] = useState<string[]>([]);
    const resultId = useId();
    const menu = useRef<HTMLDetailsElement>(null);
    const closeMenu = () => menu.current?.removeAttribute('open');
    const chosen = selected.filter(id => doc.rallies.some(r => r.id === id));
    const poster = doc.media.youtubeId ? `https://i.ytimg.com/vi/${doc.media.youtubeId}/mqdefault.jpg` : undefined;
    return <><div className="sv-row"><h2>Rallies do vídeo</h2>{!readOnly ? <details ref={menu} className="sv-menu"><summary aria-label="Opções dos rallies">⋮</summary><div className="sv-menu-items" onClick={e => e.currentTarget.closest('details')?.removeAttribute('open')}>{localMedia ? <StudioAction label="Selecionar rallies" onPress={() => { closeMenu(); setSelecting(!selecting); setSelected([]); }}>Selecionar rallies</StudioAction> : null}{localMedia ? <StudioAction label="Baixar vídeo completo" onPress={() => { closeMenu(); onDownload(null); }}>Baixar vídeo completo</StudioAction> : null}<StudioAction label="Exportar análise" onPress={() => { closeMenu(); onExport(); }}>Exportar análise</StudioAction><StudioAction label="Importar análise" onPress={() => { closeMenu(); onImport(); }}>Importar análise</StudioAction></div></details> : null}</div>
    {!readOnly && selecting ? <div className="sv-row"><small>{chosen.length} selecionados</small><StudioAction label={`Baixar selecionados (${chosen.length})`} disabled={!chosen.length} onPress={() => onDownload(chosen)}>Baixar ({chosen.length})</StudioAction><StudioAction label="Cancelar seleção" icon="close" onPress={() => setSelecting(false)}/></div> : null}
    <div className="sv-grid" onKeyDownCapture={e => {
      if (!onPlay || (e.code !== 'Space' && e.key !== ' ') || e.ctrlKey || e.metaKey || e.altKey || !(e.target as HTMLElement).closest('.sv-rally.selected .sv-rally-main')) return;
      e.preventDefault(); e.stopPropagation();
      if (!e.repeat) onPlay();
    }} onKeyUpCapture={e => {
      if (onPlay && (e.code === 'Space' || e.key === ' ') && !e.ctrlKey && !e.metaKey && !e.altKey && (e.target as HTMLElement).closest('.sv-rally.selected .sv-rally-main')) { e.preventDefault(); e.stopPropagation(); }
    }}>
      <div className={`sv-rally${focus === null ? ' selected' : ''}`}><span className="sv-rally-main"><StudioAction label="Abrir vídeo completo" active={focus === null} onPress={() => onFocus(null)}><span className="sv-rally-content">{(thumbnailSource || (localMedia && source)) && offsetSeconds <= 0 ? <Thumbnail enabled={!playing} source={thumbnailSource || source} poster={poster} time={0}/> : poster ? <img className="sv-thumb" src={poster} alt=""/> : <span className="sv-thumb"/>}<span className="sv-caption"><b>Vídeo completo</b><small>00:00 – {videoTime(doc.media.duration)}</small></span></span></StudioAction></span></div>
      {doc.rallies.map((r, i) => <div key={r.id} className={`sv-rally${focus === r.id ? ' selected' : ''}`}><span className="sv-rally-main"><StudioAction label={`Abrir rally ${i + 1}`} describedBy={`${resultId}-${r.id}`} active={focus === r.id} onPress={() => onFocus(r.id)}><span className="sv-rally-content"><span className="sv-rally-preview"><Thumbnail cacheKey={thumbnailScope ? `goatleta:video-thumb:v1:${thumbnailScope}:${encodeURIComponent(doc.media.fingerprint)}:${r.start}` : undefined} enabled={!playing && r.start >= offsetSeconds} source={thumbnailSource || (localMedia ? source : '')} time={Math.max(0, r.start - offsetSeconds)}/><RallyResult id={`${resultId}-${r.id}`} winner={r.winner} teams={teams}/></span><span className="sv-caption"><b>Rally {String(i + 1).padStart(2, '0')}</b><small>{videoTime(r.start)} – {videoTime(doc.rallies[i + 1]?.start ?? doc.media.duration)}</small></span></span></StudioAction></span>{readOnly || !localMedia ? null : selecting ? <input className="sv-checkbox" type="checkbox" aria-label={`Selecionar rally ${i + 1}`} checked={chosen.includes(r.id)} onChange={e => setSelected(e.target.checked ? [...chosen, r.id] : chosen.filter(id => id !== r.id))}/> : <span className="sv-download"><StudioAction label={`Baixar rally ${i + 1}`} icon="download" onPress={() => onDownload([r.id])}/></span>}</div>)}</div>
  </>;
});
