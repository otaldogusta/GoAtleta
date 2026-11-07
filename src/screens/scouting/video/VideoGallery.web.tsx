import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoAtletaIcon } from '../../../ui/icon-registry';
import { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import { videoRange, videoTime, type VideoDocument, type VideoRally } from '../../../core/scouting-video';
import type { StudioRangeResolver, StudioRallyMetadata } from './local-studio-types';
import { StudioAction } from './StudioUI.web';
import { StudioSelect } from './StudioSelect.web';
import { videoGalleryStyles } from './video-review-styles';
import { videoThumbnail } from './video-media.web';
function ThumbnailPlaceholder() {
    return <span className="sv-thumb-unavailable" role="img" aria-label="Miniatura indisponível ou carregando"><GoAtletaIcon name="gallery" size={28} color="currentColor"/></span>;
}
export function Thumbnail({ source, time, poster, cacheKey, enabled = true }: {
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
export const VideoGallery = memo(function VideoGallery({ doc, source, focus, teams, onFocus, onPlay, onDownload, onExport, onImport, readOnly = false, localMedia = true, thumbnailSource, offsetSeconds = 0, playing = false, thumbnailScope, rangeResolver = videoRange, availableUntilSeconds = Infinity, canDownloadOriginal = true, canDownloadRally, pendingCount = 0, rallyMetadata, bench = false, onOpenTools }: {
    bench?: boolean;
    onOpenTools?: () => void;
    thumbnailScope?: string;
    playing?: boolean;
    thumbnailSource?: string; offsetSeconds?: number;
    readOnly?: boolean;
    localMedia?: boolean;
    doc: VideoDocument;
    source: string;
    rangeResolver?: StudioRangeResolver;
    availableUntilSeconds?: number;
    canDownloadOriginal?: boolean;
    canDownloadRally?: (id: string) => boolean;
    pendingCount?: number;
    rallyMetadata?:Readonly<Record<string,StudioRallyMetadata>>;
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
    const [layout,setLayout]=useState<'thumbnails'|'list'>('thumbnails');
    const filterContext=useMemo(()=>({fingerprint:doc.media.fingerprint}),[doc.media.fingerprint]);
    const [filters,setFilters]=useState({context:filterContext,set:'all',skill:'all'});
    const rows=useMemo(()=>doc.rallies.map((r,i)=>{
        const [start,end]=rangeResolver(doc,r.id),metadata=rallyMetadata?.[r.id];
        const skills=[...new Set([...(metadata?.fundamentals??[]),...doc.contacts.filter(contact=>contact.time>=start&&contact.time<end).map(contact=>contact.skill)])];
        return {r,i,start,end,metadata,skills};
    }),[doc,rangeResolver,rallyMetadata]);
    const sets=[...new Set(rows.flatMap(row=>row.metadata?.setNumber!==undefined?[row.metadata.setNumber]:[]))].sort((a,b)=>a-b);
    const skills=[...new Set(rows.flatMap(row=>row.skills))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    const currentFilters=filters.context===filterContext?filters:{set:'all',skill:'all'};
    const setFilter=sets.some(set=>String(set)===currentFilters.set)||currentFilters.set==='unset'&&rows.some(row=>row.metadata?.setNumber===undefined)?currentFilters.set:'all';
    const skillFilter=skills.includes(currentFilters.skill)?currentFilters.skill:'all';
    const setSetFilter=(value:string)=>setFilters({context:filterContext,set:value,skill:skillFilter});
    const setSkillFilter=(value:string)=>setFilters({context:filterContext,set:setFilter,skill:value});
    const visible=rows.filter(row=>(setFilter==='all'||setFilter==='unset'&&row.metadata?.setNumber===undefined||String(row.metadata?.setNumber)===setFilter)&&(skillFilter==='all'||row.skills.includes(skillFilter)));
    const resultId = useId();
    const menu = useRef<HTMLDetailsElement>(null);
    const closeMenu = () => menu.current?.removeAttribute('open');
    const chosen = selected.filter(id => doc.rallies.some(r => r.id === id));
    const poster = doc.media.youtubeId ? `https://i.ytimg.com/vi/${doc.media.youtubeId}/mqdefault.jpg` : undefined;
    return <section className="sv-gallery" data-layout={layout} data-bench={bench || undefined} aria-label="Galeria de rallies"><style>{videoGalleryStyles}</style><div className="sv-row sv-gallery-head"><h2>Rallies <span className="sv-badge">{visible.length}</span></h2>{bench ? <StudioAction label="Abrir vídeo completo" icon="video" active={focus === null} onPress={() => onFocus(null)}/> : null}<div className="sv-gallery-views" role="group" aria-label="Apresentação dos rallies"><StudioAction label={bench ? "Miniaturas em faixa" : "Miniaturas em duas colunas"} icon="dashboard" active={layout==='thumbnails'} onPress={()=>setLayout('thumbnails')}/><StudioAction label="Lista compacta" icon="list" active={layout==='list'} onPress={()=>setLayout('list')}/></div>{bench?<span className="sv-gallery-view-toggle"><StudioAction label={layout==='thumbnails'?"Trocar para lista de rallies":"Trocar para miniaturas de rallies"} icon={layout==='thumbnails'?"list":"dashboard"} onPress={()=>setLayout(layout==='thumbnails'?'list':'thumbnails')}/></span>:null}{onOpenTools ? <span className="sv-gallery-tools-trigger"><StudioAction label="Ferramentas do vídeo" icon="options" expanded={false} hasPopup="dialog" onPress={onOpenTools}/></span> : null}{!readOnly ? <details ref={menu} className="sv-menu"><summary aria-label="Opções dos rallies"><GoAtletaIcon name="ellipsisVertical" size={16} color="currentColor"/></summary><div className="sv-menu-items" onClick={e => e.currentTarget.closest('details')?.removeAttribute('open')}>{bench&&onOpenTools?<span className="sv-compact-menu-tools"><StudioAction label="Abrir ferramentas pelo menu dos rallies" icon="options" onPress={()=>{closeMenu();onOpenTools();}}>Ferramentas do vídeo</StudioAction></span>:null}{localMedia ? <StudioAction label="Selecionar rallies" onPress={() => { closeMenu(); setSelecting(!selecting); setSelected([]); }}>Selecionar rallies</StudioAction> : null}{localMedia ? <StudioAction label="Baixar vídeo completo" disabled={!canDownloadOriginal} onPress={() => { closeMenu(); onDownload(null); }}>Baixar vídeo completo</StudioAction> : null}<StudioAction label="Exportar análise" onPress={() => { closeMenu(); onExport(); }}>Exportar análise</StudioAction><StudioAction label="Importar análise" onPress={() => { closeMenu(); onImport(); }}>Importar análise</StudioAction></div></details> : null}</div>
    {sets.length||skills.length?<div className="sv-gallery-filters">{sets.length?<StudioSelect compact label="Filtrar rallies por set" value={setFilter} options={[{value:'all',label:'Todos os sets'},...sets.map(set=>({value:String(set),label:`Set ${set}`})),...(rows.some(row=>row.metadata?.setNumber===undefined)?[{value:'unset',label:'Sem set'}]:[])]} onChange={setSetFilter}/>:null}{skills.length?<StudioSelect compact label="Filtrar rallies por fundamento" value={skillFilter} options={[{value:'all',label:'Fundamentos'},...skills.map(skill=>({value:skill,label:skill}))]} onChange={setSkillFilter}/>:null}</div>:null}
    {pendingCount ? <p className="sv-section-meta" role="status">{pendingCount} {pendingCount === 1 ? 'registro aguardando referência de vídeo' : 'registros aguardando referência de vídeo'}</p> : null}
    {!readOnly && selecting ? <div className="sv-row"><small>{chosen.length} selecionados</small><StudioAction label={`Baixar selecionados (${chosen.length})`} disabled={!chosen.length || chosen.some(id => canDownloadRally?.(id) === false)} onPress={() => onDownload(chosen)}>Baixar ({chosen.length})</StudioAction><StudioAction label="Cancelar seleção" icon="close" onPress={() => setSelecting(false)}/></div> : null}
    <div className="sv-grid" onKeyDownCapture={e => {
      if (!onPlay || (e.code !== 'Space' && e.key !== ' ') || e.ctrlKey || e.metaKey || e.altKey || !(e.target as HTMLElement).closest('.sv-rally.selected .sv-rally-main')) return;
      e.preventDefault(); e.stopPropagation();
      if (!e.repeat) onPlay();
    }} onKeyUpCapture={e => {
      if (onPlay && (e.code === 'Space' || e.key === ' ') && !e.ctrlKey && !e.metaKey && !e.altKey && (e.target as HTMLElement).closest('.sv-rally.selected .sv-rally-main')) { e.preventDefault(); e.stopPropagation(); }
    }}>
      {!bench ? <div className={`sv-rally sv-full-video${focus === null ? ' selected' : ''}`}><span className="sv-rally-main"><StudioAction label="Abrir vídeo completo" active={focus === null} onPress={() => onFocus(null)}><span className="sv-rally-content">{(thumbnailSource || (localMedia && source)) && offsetSeconds <= 0 ? <Thumbnail enabled={!playing} source={thumbnailSource || source} poster={poster} time={0}/> : poster ? <img className="sv-thumb" src={poster} alt=""/> : <span className="sv-thumb"/>}<span className="sv-caption"><b>Vídeo completo</b><small>00:00 – {videoTime(doc.media.duration)}</small></span></span></StudioAction></span></div> : null}
      {visible.map(({r,i,start,end,metadata}) => <div key={r.id} className={`sv-rally${focus === r.id ? ' selected' : ''}`}><span className="sv-rally-main"><StudioAction label={`Abrir rally ${i + 1}`} describedBy={`${resultId}-${r.id}`} active={focus === r.id} onPress={() => onFocus(r.id)}><span className="sv-rally-content"><span className="sv-rally-preview"><Thumbnail cacheKey={thumbnailScope ? `goatleta:video-thumb:v2:${thumbnailScope}:${encodeURIComponent(doc.media.fingerprint)}:${offsetSeconds}:${start}` : undefined} enabled={!playing && start >= offsetSeconds && start < availableUntilSeconds} source={thumbnailSource || (localMedia ? source : '')} time={Math.max(0, start - offsetSeconds)}/><RallyResult id={`${resultId}-${r.id}`} winner={r.winner} teams={teams}/></span><span className="sv-caption"><b>Rally {String(i + 1).padStart(2, '0')}</b>{metadata?.setNumber!==undefined?<small>Set {metadata.setNumber}{metadata.scoreUs!==undefined&&metadata.scoreThem!==undefined?` · ${metadata.scoreUs} × ${metadata.scoreThem}`:''}</small>:null}<small>{videoTime(start)} – {videoTime(end)}</small></span></span></StudioAction></span>{readOnly || !localMedia ? null : selecting ? <input className="sv-checkbox" type="checkbox" aria-label={`Selecionar rally ${i + 1}`} checked={chosen.includes(r.id)} disabled={canDownloadRally?.(r.id) === false} onChange={e => setSelected(e.target.checked ? [...chosen, r.id] : chosen.filter(id => id !== r.id))}/> : <span className="sv-download"><StudioAction label={`Baixar rally ${i + 1}`} icon={bench ? undefined : "download"} iconContent={bench ? <GoAtletaIcon name="download" size={14} color="currentColor"/> : undefined} disabled={canDownloadRally?.(r.id) === false} onPress={() => onDownload([r.id])}/></span>}</div>)}{!visible.length?<p className="sv-gallery-empty" role="status">Nenhum rally neste filtro.</p>:null}</div>
  </section>;
});
