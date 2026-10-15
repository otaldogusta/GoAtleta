import { useRef, useState } from 'react';
import { resizeVideoRally, videoRange, type VideoDocument } from '../../../core/scouting-video';
import { Thumbnail } from './VideoGallery.web';
import { StudioAction } from './StudioUI.web';

export function VideoRallyRange({ doc, id, disabled, onApply, source, offset = 0, playing, onPreview, onPlayRange, time, onConnect, thumbnailScope }: { time: number; onConnect: () => void; thumbnailScope?: string; onPlayRange: (start: number, end: number) => void; source: string; offset?: number; playing: boolean; onPreview: (time: number) => void; doc: VideoDocument; id: string; disabled: boolean; onApply: (next: VideoDocument) => void }) {
    const [from, to] = videoRange(doc, id);
    const [start, setStart] = useState(from.toFixed(3)), [end, setEnd] = useState(to.toFixed(3));
    const [error, setError] = useState('');
    const [scrub, setScrub] = useState<number | null>(null);
    const lastSeek = useRef(0);
    const strip = useRef<HTMLDivElement>(null);
    const drag = useRef<{ edge: 'start' | 'end'; x: number; time: number; value: number; width: number } | null>(null);
    const index = doc.rallies.findIndex(r => r.id === id);
    const lower = index > 0 ? doc.rallies[index - 1].start + .001 : 0;
    const upper = index + 2 < doc.rallies.length ? doc.rallies[index + 2].start - .001 : doc.media.duration;
    const span = upper - lower;
    const left = Math.max(0, Math.min(100, (Number(start) - lower) / span * 100));
    const right = Math.max(0, Math.min(100, (Number(end) - lower) / span * 100));
    const move = (edge: 'start' | 'end', value: number) => {
        const next = edge === 'start' ? Math.max(lower, Math.min(Number(end) - .001, value)) : Math.min(upper, Math.max(Number(start) + .001, value));
        (edge === 'start' ? setStart : setEnd)(next.toFixed(3)); setError(''); return next;
    };
    const valid = !!start.trim() && !!end.trim() && Number.isFinite(Number(start)) && Number.isFinite(Number(end)) && Number(start) >= lower && Number(end) <= upper && Number(start) < Number(end);
    const scrubTo = (x: number, final = false) => {
        const bounds = strip.current!.getBoundingClientRect();
        const next = Math.max(lower, Math.min(upper, lower + (x - bounds.left) / bounds.width * span));
        setScrub(final ? null : next);
        if (final || performance.now() - lastSeek.current > 120) { lastSeek.current = performance.now(); onPreview(next); }
    };
    const cursor = Math.max(0, Math.min(100, ((scrub ?? time) - lower) / span * 100));
    const preview = () => { if (!disabled && valid) onPlayRange(Number(start), Number(end)); };
    return <div className="sv-rally-range" onKeyDownCapture={e => { if (e.code !== 'Space' || e.repeat || e.ctrlKey || e.altKey || e.metaKey) return; e.preventDefault(); e.stopPropagation(); preview(); }} onKeyUpCapture={e => { if (e.code === 'Space') { e.preventDefault(); e.stopPropagation(); } }}>
      <style>{`.sv-trim-needle{position:absolute;top:-8px;width:22px;height:16px;transform:translateX(-50%);z-index:3;cursor:ew-resize;touch-action:none;outline:none}.sv-trim-needle:before{content:"";position:absolute;left:10px;top:5px;width:2px;height:67px;pointer-events:none;background:white;box-shadow:0 0 2px #000}.sv-trim-needle:after{content:"";position:absolute;left:5px;top:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid white}.sv-trim-needle:focus-visible{outline:1px solid white;border-radius:4px}.sv-trim-connect .sv-action>[role=button]{padding:2px 0!important;min-height:22px!important;text-decoration:underline;background:transparent!important;border:0!important}`+`.sv .sv-rally-range .sv-field{margin:4px 0;gap:4px;font-size:10px;min-width:0}.sv .sv-rally-range .sv-field>span{min-height:30px;height:30px;padding:0 8px;border-radius:6px}.sv .sv-rally-range .sv-field input{min-height:28px;height:28px;font:12px ui-monospace,monospace;font-variant-numeric:tabular-nums}.sv .sv-rally-range>small{display:block;font-size:10px;margin:4px 0}.sv .sv-rally-range .sv-action>[role=button]{min-height:30px;padding:4px 10px!important;font-size:11px}.sv-trim{position:relative;height:70px;margin:8px 12px 8px;touch-action:none;user-select:none}.sv-trim-frames{display:flex;height:64px;overflow:hidden;border-radius:5px;background:var(--sv-bg);pointer-events:none}.sv-trim-frames>div{flex:1;min-width:0;height:64px}.sv-trim-frames img{height:64px!important;object-fit:cover;pointer-events:none}.sv-trim-selection{position:absolute;top:0;height:64px;box-sizing:border-box;border-top:2px solid #32d583;border-bottom:2px solid #32d583;pointer-events:none}.sv-trim-handle{position:absolute;top:-4px;transform:translateX(-50%);width:24px;height:72px;display:flex;align-items:center;justify-content:center;cursor:ew-resize;touch-action:none;outline:none;z-index:2}.sv-trim-handle:before{content:'';width:10px;height:64px;border-radius:3px;background:#32d583;box-shadow:0 1px 4px #0007}.sv-trim-handle:after{content:'';position:absolute;width:2px;height:18px;border-radius:1px;background:#073b2c}.sv-trim-handle:focus-visible:before{outline:2px solid white;outline-offset:2px}.sv-trim-handle[aria-disabled=true]{cursor:default;opacity:.5}.sv-trim-ruler{height:4px;margin-top:4px;background:repeating-linear-gradient(90deg,var(--sv-muted,#8394ab) 0 1px,transparent 1px 10%);opacity:.35}`}</style>
      <div ref={strip} className="sv-trim" aria-label="Recorte visual do rally">
        <div className="sv-trim-frames">{Array.from({ length: 6 }, (_, i) => <Thumbnail key={i} source={source} cacheKey={thumbnailScope ? `goatleta:video-trim:v1:${thumbnailScope}:${doc.media.fingerprint}:${(lower + (i + .5) / 6 * span).toFixed(3)}` : undefined} time={Math.max(0, lower + (i + .5) / 6 * span - offset)} enabled={!playing && lower + (i + .5) / 6 * span >= offset}/>)}</div>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, height: 64, pointerEvents: 'none', background: `linear-gradient(to right, #0008 ${left}%, transparent ${left}%, transparent ${right}%, #0008 ${right}%)` }}/>
        <div className="sv-trim-selection" style={{ left: `${left}%`, width: `${Math.max(0, right - left)}%` }}/>
        {(['start', 'end'] as const).map(edge => {
            const locked = disabled || (edge === 'start' ? index === 0 : index === doc.rallies.length - 1);
            const value = Number(edge === 'start' ? start : end);
            return <div key={edge} role="slider" tabIndex={locked ? -1 : 0} aria-disabled={locked} aria-label={edge === 'start' ? 'Arrastar início do recorte' : 'Arrastar fim do recorte'} aria-valuemin={lower} aria-valuemax={upper} aria-valuenow={value} aria-valuetext={`${value.toFixed(3)} segundos`} className="sv-trim-handle" style={{ left: `${edge === 'start' ? left : right}%` }}
              onPointerDown={e => { if (locked || e.button !== 0) return; e.preventDefault(); e.currentTarget.focus(); e.currentTarget.setPointerCapture(e.pointerId); drag.current = { edge, x: e.clientX, time: value, value, width: strip.current!.getBoundingClientRect().width }; }}
              onPointerMove={e => { const current = drag.current; if (!current || current.edge !== edge) return; current.value = move(edge, current.time + (e.clientX - current.x) / current.width * span); }}
              onPointerUp={e => { const current = drag.current; if (!current) return; drag.current = null; e.currentTarget.releasePointerCapture(e.pointerId); onPreview(current.value); }}
              onPointerCancel={() => { const current = drag.current; if (current) move(current.edge, current.time); drag.current = null; }}
              onKeyDown={e => { if (locked || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return; e.preventDefault(); const next = e.key === 'Home' ? lower : e.key === 'End' ? upper : value + (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 1 : .1); onPreview(move(edge, next)); }}/>;
        })}
        <div className="sv-trim-needle" role="slider" aria-label="Posição de reprodução do recorte" aria-valuemin={lower} aria-valuemax={upper} aria-valuenow={scrub ?? time} tabIndex={0} style={{ left: `${cursor}%` }}
          onPointerDown={e => { if (disabled || e.button !== 0) return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); scrubTo(e.clientX); }}
          onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) scrubTo(e.clientX); }}
          onPointerUp={e => { if (!e.currentTarget.hasPointerCapture(e.pointerId)) return; e.currentTarget.releasePointerCapture(e.pointerId); scrubTo(e.clientX, true); }}
          onPointerCancel={() => setScrub(null)}
          onKeyDown={e => { if (disabled || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return; e.preventDefault(); onPreview(Math.max(lower, Math.min(upper, time + (e.key === 'ArrowLeft' ? -.1 : .1)))); }}/>
        <div className="sv-trim-ruler" aria-hidden="true"/>
      </div>
      {!source ? <div className="sv-trim-connect"><StudioAction label="Conectar vídeo para carregar miniaturas" onPress={onConnect}>Conectar vídeo para ver miniaturas</StudioAction></div> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
        <label className="sv-field">Início (s)<span><input aria-label="Início do rally em segundos" type="number" step="0.001" min="0" disabled={disabled || index === 0} value={start} onChange={e => { setStart(e.target.value); setError(''); }}/></span></label>
        <label className="sv-field">Fim (s)<span><input aria-label="Fim do rally em segundos" type="number" step="0.001" min="0" disabled={disabled || index === doc.rallies.length - 1} value={end} onChange={e => { setEnd(e.target.value); setError(''); }}/></span></label>
      </div>
      {error ? <p role="alert">{error}</p> : null}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4, flexWrap: 'wrap', marginTop: 4, marginBottom: 8 }}><StudioAction label={playing ? 'Pausar trecho' : 'Ver trecho selecionado'} disabled={disabled || !valid} onPress={preview}>{playing ? 'Pausar' : 'Ver trecho'}</StudioAction><StudioAction label="Resetar recorte" disabled={disabled || (Number(start) === from && Number(end) === to)} onPress={() => { setStart(from.toFixed(3)); setEnd(to.toFixed(3)); setError(''); onPreview(from); }}>Resetar</StudioAction><StudioAction label="Aplicar recorte do rally" disabled={disabled || !start.trim() || !end.trim() || (Number(start) === from && Number(end) === to)} onPress={() => {
          try { onApply(resizeVideoRally(doc, id, Number(start), Number(end))); setError(''); }
          catch (failure) { setError((failure as Error).message); }
      }}>Aplicar recorte</StudioAction></div>
    </div>;
}
