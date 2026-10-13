import { memo, useEffect, useRef, useState } from 'react';
import { videoTime, type VideoDocument } from '../../../core/scouting-video';
import { StudioAction } from './StudioUI.web';
import { videoThumbnail } from './video-media.web';
function Thumbnail({ source, time }: {
    source: string;
    time: number;
}) {
    const ref = useRef<HTMLDivElement>(null), [image, setImage] = useState('');
    useEffect(() => {
        const controller = new AbortController();
        let requested = false;
        const observer = new IntersectionObserver(entries => { if (!requested && entries.some(e => e.isIntersecting)) {
            requested = true;
            void videoThumbnail(source, time, controller.signal).then(setImage).catch(() => undefined);
        } });
        if (ref.current)
            observer.observe(ref.current);
        return () => { observer.disconnect(); controller.abort(); };
    }, [source, time]);
    return <div ref={ref} className="sv-thumb">{image ? <img className="sv-thumb" src={image} alt=""/> : null}</div>;
}
export const VideoGallery = memo(function VideoGallery({ doc, source, focus, teams, onFocus, onDownload, onExport, onImport, readOnly = false }: {
    readOnly?: boolean;
    doc: VideoDocument;
    source: string;
    focus: string | null;
    teams: {
        us: string;
        them: string;
    };
    onFocus: (id: string | null) => void;
    onDownload: (ids: string[] | null) => void;
    onExport: () => void;
    onImport: () => void;
}) {
    const [selecting, setSelecting] = useState(false), [selected, setSelected] = useState<string[]>([]);
    const menu = useRef<HTMLDetailsElement>(null);
    const closeMenu = () => menu.current?.removeAttribute('open');
    const chosen = selected.filter(id => doc.rallies.some(r => r.id === id));
    return <><div className="sv-row"><h2>Rallies do vídeo</h2>{!readOnly ? <details ref={menu} className="sv-menu"><summary aria-label="Opções dos rallies">⋮</summary><div className="sv-menu-items" onClick={e => e.currentTarget.closest('details')?.removeAttribute('open')}><StudioAction label="Selecionar rallies" onPress={() => { closeMenu(); setSelecting(!selecting); setSelected([]); }}>Selecionar rallies</StudioAction><StudioAction label="Baixar vídeo completo" onPress={() => { closeMenu(); onDownload(null); }}>Baixar vídeo completo</StudioAction><StudioAction label="Exportar análise" onPress={() => { closeMenu(); onExport(); }}>Exportar análise</StudioAction><StudioAction label="Importar análise" onPress={() => { closeMenu(); onImport(); }}>Importar análise</StudioAction></div></details> : null}</div>
    {!readOnly && selecting ? <div className="sv-row"><small>{chosen.length} selecionados</small><StudioAction label={`Baixar selecionados (${chosen.length})`} disabled={!chosen.length} onPress={() => onDownload(chosen)}>Baixar ({chosen.length})</StudioAction><StudioAction label="Cancelar seleção" icon="close" onPress={() => setSelecting(false)}/></div> : null}
    <div className="sv-grid">{doc.rallies.map((r, i) => <div key={r.id} className={`sv-rally${focus === r.id ? ' selected' : ''}`}><span className="sv-rally-main"><StudioAction label={`Abrir rally ${i + 1}`} onPress={() => onFocus(r.id)}><Thumbnail source={source} time={r.start}/><span className="sv-caption"><b>Rally {String(i + 1).padStart(2, '0')}</b><small>{videoTime(r.start)} – {videoTime(doc.rallies[i + 1]?.start ?? doc.media.duration)}</small><span className="sv-winner">{r.winner ? `Ponto: ${teams[r.winner]}` : 'Sem resultado'}</span></span></StudioAction></span>{readOnly ? null : selecting ? <input className="sv-checkbox" type="checkbox" aria-label={`Selecionar rally ${i + 1}`} checked={chosen.includes(r.id)} onChange={e => setSelected(e.target.checked ? [...chosen, r.id] : chosen.filter(id => id !== r.id))}/> : <span className="sv-download"><StudioAction label={`Baixar rally ${i + 1}`} icon="download" onPress={() => onDownload([r.id])}/></span>}</div>)}</div>
  </>;
});
