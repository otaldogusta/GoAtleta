import { useEffect, useRef, useState } from 'react';
import { StudioAction, StudioDialog } from '../video/StudioUI.web';
import type { LiveHostSession } from './live-storage';

const time=(milliseconds:number)=>{const seconds=Math.max(0,Math.floor(milliseconds/1000));return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;};
type Source={url:string;name:string};
export default function LiveRecordingReview({session,onClose}:{session:LiveHostSession;onClose:()=>void}) {
    const input=useRef<HTMLInputElement|null>(null),video=useRef<HTMLVideoElement|null>(null),url=useRef<string|null>(null);
    const [source,setSource]=useState<Source|null>(null),[duration,setDuration]=useState<number|null>(null),[error,setError]=useState(''),[selected,setSelected]=useState<string|null>(null);
    const release=()=>{
        const node=video.current;if(node){node.pause();node.removeAttribute('src');node.load();}
        if(url.current){URL.revokeObjectURL(url.current);url.current=null;}
    };
    useEffect(()=>()=>release(),[]);
    useEffect(()=>{
        if(!source||duration!==null)return;
        const timer=setTimeout(()=>{setError('Não foi possível conferir a duração. Baixe novamente o vídeo no celular.');release();setSource(null);},15000);
        return()=>clearTimeout(timer);
    },[source,duration]);
    const choose=(file:File|undefined)=>{
        if(!file)return;
        release();setSource(null);setDuration(null);setSelected(null);setError('');
        if(!file.size||!file.name.toLowerCase().includes(session.recordingId.toLowerCase())||!/[.](mp4|webm)$/i.test(file.name)||file.type&&!file.type.startsWith('video/')){
            setError(`Escolha o vídeo desta gravação: go-atleta-${session.recordingId}.mp4 ou .webm.`);return;
        }
        const next=URL.createObjectURL(file);url.current=next;setSource({url:next,name:file.name});
    };
    const checkDuration=(node:HTMLVideoElement)=>{
        if(!source||url.current!==source.url)return;
        // MediaRecorder WebM may expose Infinity until the browser reads its final cluster.
        if(!Number.isFinite(node.duration))return;
        if(node.duration<=0||node.duration>86400||!node.videoWidth||!node.videoHeight||session.points.some(point=>point.timeMs<0||point.timeMs>node.duration*1000)){
            setError('A duração deste vídeo não inclui todos os pontos da gravação. Confira o arquivo exportado no celular.');release();setSource(null);setDuration(null);return;
        }
        if(duration===null){node.currentTime=0;setDuration(node.duration);}
    };
    const metadata=(node:HTMLVideoElement)=>{
        if(Number.isFinite(node.duration))checkDuration(node);
        else {try{node.currentTime=1e10;}catch{setError('Não foi possível ler a duração deste vídeo.');release();setSource(null);}}
    };
    const seek=(point:LiveHostSession['points'][number])=>{
        const node=video.current;if(!node||duration===null||point.timeMs>duration*1000)return;
        node.pause();node.currentTime=point.timeMs/1000;setSelected(point.id);
    };
    return <StudioDialog title="Rever gravação ao vivo" className="sv-live-review" onClose={onClose}>
        <style>{reviewStyles}</style>
        <div className="sv-live-review-source"><p className="sv-section-meta">Escolha o vídeo baixado no celular. Os pontos já marcados abrem no tempo correspondente.</p><input ref={input} type="file" accept="video/mp4,video/webm,.mp4,.webm" aria-label="Vídeo exportado desta gravação ao vivo" hidden onChange={event=>{choose(event.currentTarget.files?.[0]);event.currentTarget.value='';}}/><StudioAction label="Escolher vídeo desta gravação ao vivo" onPress={()=>input.current?.click()}>{source?'Trocar vídeo':'Escolher vídeo do celular'}</StudioAction>{source?<small>{source.name}</small>:null}</div>
        {error?<p role="alert" className="sv-alert">{error}</p>:null}
        <div className="sv-live-review-content"><section className="sv-live-review-player" aria-label="Reprodução da gravação salva">
            {source?<><video key={source.url} ref={video} src={source.url} preload="metadata" playsInline controls={duration!==null} aria-label="Vídeo local da gravação ao vivo" onLoadedMetadata={event=>metadata(event.currentTarget)} onDurationChange={event=>checkDuration(event.currentTarget)} onSeeked={event=>checkDuration(event.currentTarget)} onError={()=>{setError('Este vídeo não pôde ser reproduzido. Escolha MP4 ou WebM compatível.');release();setSource(null);setDuration(null);}}/>{duration===null?<p role="status" className="sv-section-meta">Conferindo duração do vídeo…</p>:null}</>:<div className="sv-live-review-empty"><span>Vídeo salvo no celular</span><small>Transfira o arquivo para o notebook para rever esta gravação.</small></div>}
        </section><section className="sv-live-review-markers" aria-label="Pontos vinculados da gravação"><div className="sv-row"><h3>Pontos vinculados</h3><small>{session.points.length}</small></div>{session.points.length?<ol>{session.points.map(point=><li key={point.id}><StudioAction label={`Ver ponto ${point.scoreUs} a ${point.scoreThem}, set ${point.setNumber}, em ${time(point.timeMs)}`} disabled={duration===null} active={selected===point.id} onPress={()=>seek(point)}><b>{point.scoreUs} × {point.scoreThem}</b><span>{point.won?'Nosso ponto':'Adversário'}<small>Set {point.setNumber} · {time(point.timeMs)}{point.clockMode==='estimated'?' · aprox.':''}</small></span></StudioAction></li>)}</ol>:<p className="sv-section-meta">Nenhum ponto foi marcado nesta gravação.</p>}<small className="sv-section-meta">Os registros originais são preservados.</small></section></div>
    </StudioDialog>;
}
const reviewStyles=`
.sv-live .sv-dialog.sv-live-review{width:min(960px,calc(100vw - 24px));max-width:960px;box-sizing:border-box;overflow:auto;padding:18px}.sv-live-review-source{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px}.sv-live-review-source>p{flex-basis:100%;margin:0}.sv-live-review-source>small{color:var(--sv-muted);overflow-wrap:anywhere;min-width:0}.sv-live-review-content{display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:16px}.sv-live-review-player{min-width:0}.sv-live-review-player video{display:block;width:100%;height:auto;max-height:60dvh;aspect-ratio:16/9;background:#000;border-radius:12px;object-fit:contain}.sv-live-review-empty{aspect-ratio:16/9;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;padding:18px;box-sizing:border-box;border:1px dashed var(--sv-line);border-radius:12px;color:var(--sv-muted)}.sv-live-review-markers{min-width:0;display:flex;flex-direction:column}.sv-live-review-markers h3{font-size:13px;margin:0}.sv-live-review-markers ol{list-style:none;padding:0;margin:0 0 12px;max-height:55dvh;overflow:auto}.sv-live-review-markers li{margin-bottom:6px}.sv-live-review-markers .sv-action{display:block}.sv-live-review-markers .sv-action [role=button]{justify-content:flex-start!important;text-align:left}.sv-live-review-markers .sv-action [role=button]>span{display:flex;align-items:center;gap:10px;width:100%}.sv-live-review-markers .sv-action b{min-width:42px;font-variant-numeric:tabular-nums}.sv-live-review-markers .sv-action span>span{display:grid;gap:3px}.sv-live-review-markers small{color:var(--sv-muted);font-size:11px}@media(max-width:700px){.sv-live-review-content{grid-template-columns:1fr}.sv-live-review-markers ol{max-height:230px}.sv-live .sv-dialog.sv-live-review{padding:14px}}
`;
