import { useCallback, useEffect, useRef, useState } from 'react';
import { StudioAction, StudioDialog } from '../video/StudioUI.web';
import type { LiveHostSession } from './live-storage';
import { markRender, measureAsync } from '../../../observability/perf';
import { captureLiveThumbnail } from './live-thumbnail';
import { compactUiMetrics, radius } from '../../../theme/tokens';
import { downloadVideoBlob } from '../video/video-media.web';

const time=(milliseconds:number)=>{const seconds=Math.max(0,Math.floor(milliseconds/1000));return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;};
type Source={url:string;name:string;fromComputer?:boolean};
export default function LiveRecordingReview({session,onClose,onThumbnail,loadSavedVideo,onSaveVideo,savedVideoReady,onDownloadMarkers}:{session:LiveHostSession;onClose:()=>void;onThumbnail?:(sessionId:string,recordingId:string,image:string)=>void;loadSavedVideo?:(session:LiveHostSession)=>Promise<Blob|null>;onSaveVideo?:(session:LiveHostSession,blob:Blob)=>Promise<boolean>;savedVideoReady?:boolean;onDownloadMarkers?:(session:LiveHostSession)=>void}) {
    markRender('screen.scoutingLiveReview.render.web');
    const input=useRef<HTMLInputElement|null>(null),video=useRef<HTMLVideoElement|null>(null),url=useRef<string|null>(null);
    const metadataLoad=useRef<{resolve:()=>void;reject:(failure:Error)=>void}|null>(null);
    const [source,setSource]=useState<Source|null>(null),[duration,setDuration]=useState<number|null>(null),[error,setError]=useState(''),[selected,setSelected]=useState<string|null>(null);
    const sourceBlob=useRef<Blob|null>(null),importedUrl=useRef<string|null>(null),mounted=useRef(false);
    const [checkingSaved,setCheckingSaved]=useState(!!loadSavedVideo),[localSave,setLocalSave]=useState<'idle'|'saving'|'saved'|'error'>('idle');
    const thumbnailSaved=useRef(false);
    const saveThumbnail=useCallback(()=>{
        if(!onThumbnail||!video.current||!source||duration===null||session.thumbnailDataUrl||thumbnailSaved.current)return;
        const image=captureLiveThumbnail(video.current);if(!image)return;
        thumbnailSaved.current=true;onThumbnail(session.id,session.recordingId,image);
    },[onThumbnail,source,duration,session.id,session.recordingId,session.thumbnailDataUrl]);
    useEffect(()=>{saveThumbnail();},[saveThumbnail]);
    const release=()=>{
        if(metadataLoad.current){metadataLoad.current.reject(new Error('Leitura de metadados encerrada.'));metadataLoad.current=null;}
        const node=video.current;if(node){node.pause();node.removeAttribute('src');node.load();}
        if(url.current){URL.revokeObjectURL(url.current);url.current=null;}
    };
    useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;release();};},[]);
    useEffect(()=>{
        if(!loadSavedVideo||sourceBlob.current)return;
        let active=true;
        void loadSavedVideo(session).then(blob=>{
            if(!active||!blob)return;
            const next=URL.createObjectURL(blob);url.current=next;sourceBlob.current=blob;
            setSource({url:next,name:`go-atleta-${session.recordingId}.${blob.type.includes('mp4')?'mp4':'webm'}`,fromComputer:true});setLocalSave('saved');
        }).catch(failure=>{if(active)setError(failure instanceof Error?failure.message:'Não foi possível abrir o vídeo salvo.');}).finally(()=>{if(active)setCheckingSaved(false);});
        return()=>{active=false;};
    },[loadSavedVideo,session,savedVideoReady]);
    useEffect(()=>{
        if(!source||duration===null||source.fromComputer||!onSaveVideo||!sourceBlob.current||importedUrl.current===source.url)return;
        importedUrl.current=source.url;const expected=source.url;
        // The operation belongs to this media URL. A new callback/session object
        // for the same keyed recording must not orphan its pending result.
        void Promise.resolve().then(()=>{if(mounted.current&&url.current===expected)setLocalSave('saving');});
        void onSaveVideo(session,sourceBlob.current).then(saved=>{
            if(!mounted.current||url.current!==expected)return;setLocalSave(saved?'saved':'error');
            if(!saved)setError('Não foi possível guardar o vídeo neste computador. A cópia original foi preservada.');
        }).catch(()=>{if(mounted.current&&url.current===expected){setLocalSave('error');setError('Não foi possível guardar o vídeo neste computador.');}});
    },[source,duration,onSaveVideo,session]);
    useEffect(()=>{
        if(!source||duration!==null)return;
        const timer=setTimeout(()=>{setError('Não foi possível conferir a duração. Tente reabrir o vídeo.');release();setSource(null);},15000);
        return()=>clearTimeout(timer);
    },[source,duration]);
    const choose=(file:File|undefined)=>{
        if(!file)return;
        if(!file.size||!file.name.toLowerCase().includes(session.recordingId.toLowerCase())||!/[.](mp4|webm)$/i.test(file.name)||file.type&&!file.type.startsWith('video/')){
            setError(`Escolha o vídeo desta gravação: go-atleta-${session.recordingId}.mp4 ou .webm.`);return;
        }
        release();sourceBlob.current=file.type?file:new Blob([file],{type:file.name.toLowerCase().endsWith('.mp4')?'video/mp4':'video/webm'});setLocalSave('idle');setSource(null);setDuration(null);setSelected(null);setError('');
        const next=URL.createObjectURL(file);
        void measureAsync('screen.scoutingLiveReview.load.metadata',()=>new Promise<void>((resolve,reject)=>{metadataLoad.current={resolve,reject};})).catch(()=>undefined);
        url.current=next;setSource({url:next,name:file.name});
    };
    const checkDuration=(node:HTMLVideoElement)=>{
        if(!source||url.current!==source.url)return;
        // MediaRecorder WebM may expose Infinity until the browser reads its final cluster.
        if(!Number.isFinite(node.duration))return;
        if(node.duration<=0||node.duration>86400||!node.videoWidth||!node.videoHeight||session.points.some(point=>point.timeMs<0||point.timeMs>node.duration*1000)){
            setError('A duração deste vídeo não inclui todos os pontos da gravação. Confira o arquivo exportado no celular.');release();setSource(null);setDuration(null);return;
        }
        const expected=session.ended?session.durationMs:undefined;
        if(typeof expected==='number'&&Number.isFinite(expected)&&expected>0&&Math.abs(node.duration*1000-expected)>Math.max(2000,expected*.05)){
            setError('Este arquivo parece incompleto ou de outra gravação. Confira o vídeo original no celular.');release();setSource(null);setDuration(null);return;
        }
        if(duration===null){metadataLoad.current?.resolve();metadataLoad.current=null;node.currentTime=0;setDuration(node.duration);}
    };
    const metadata=(node:HTMLVideoElement)=>{
        if(Number.isFinite(node.duration))checkDuration(node);
        else {try{node.currentTime=1e10;}catch{setError('Não foi possível ler a duração deste vídeo.');release();setSource(null);}}
    };
    const seek=(point:LiveHostSession['points'][number])=>{
        const node=video.current;if(!node||duration===null||point.timeMs>duration*1000)return;
        node.pause();node.currentTime=point.timeMs/1000;setSelected(point.id);
    };
    const hasPoints=session.points.length>0;
    const download=()=>{if(sourceBlob.current&&source)downloadVideoBlob(sourceBlob.current,source.name);};
    return <StudioDialog title="Rever gravação" className="sv-live-review" onClose={onClose} headerActions={source&&duration!==null?<StudioAction label="Baixar vídeo desta gravação" icon="download" onPress={download}>Baixar vídeo</StudioAction>:null}>
        <style>{reviewStyles}</style>
        <div className="sv-live-review-source">
            <p className="sv-section-meta" role={checkingSaved?'status':undefined}>{checkingSaved?'Abrindo vídeo…':localSave==='saved'?`Salvo neste computador${duration!==null?` · ${time(duration*1000)}`:''}`:localSave==='saving'?'Salvando neste computador…':source?'Arquivo do aparelho':'Vídeo ainda não recebido'}</p>
            <input ref={input} type="file" accept="video/mp4,video/webm,.mp4,.webm" aria-label="Vídeo exportado desta gravação ao vivo" hidden onChange={event=>{choose(event.currentTarget.files?.[0]);event.currentTarget.value='';}}/>
            {!source?.fromComputer&&!checkingSaved?<StudioAction label="Escolher vídeo desta gravação ao vivo" disabled={localSave==='saving'} onPress={()=>input.current?.click()}>{source?'Trocar arquivo':'Escolher arquivo'}</StudioAction>:null}
        </div>
        {error?<p role="alert" className="sv-alert">{error}</p>:null}
        <div className="sv-live-review-content" data-has-points={hasPoints}><section className="sv-live-review-player" aria-label="Reprodução da gravação salva">
            {source?<><video key={source.url} ref={video} src={source.url} preload="metadata" playsInline controls={duration!==null} aria-label="Vídeo local da gravação ao vivo" onLoadedData={saveThumbnail} onLoadedMetadata={event=>metadata(event.currentTarget)} onDurationChange={event=>checkDuration(event.currentTarget)} onSeeked={event=>checkDuration(event.currentTarget)} onError={()=>{setError('Este vídeo não pôde ser reproduzido. Escolha MP4 ou WebM compatível.');release();setSource(null);setDuration(null);}}/>{duration===null?<p role="status" className="sv-section-meta">Conferindo vídeo…</p>:null}</>:<div className="sv-live-review-empty"><span>{checkingSaved?'Abrindo vídeo…':'Aguardando o vídeo'}</span>{!checkingSaved?<small>Mantenha o celular conectado ou escolha o arquivo.</small>:null}</div>}
        </section><section className="sv-live-review-markers" aria-label="Pontos vinculados da gravação">
            {hasPoints?<><div className="sv-row"><h3>Pontos <small>{session.points.length}</small></h3>{onDownloadMarkers?<StudioAction label="Baixar marcações desta gravação" icon="download" onPress={()=>onDownloadMarkers(session)}/>:null}</div><ol>{session.points.map(point=><li key={point.id}><StudioAction label={`Ver ponto ${point.scoreUs} a ${point.scoreThem}, set ${point.setNumber}, em ${time(point.timeMs)}`} disabled={duration===null} active={selected===point.id} onPress={()=>seek(point)}><b>{point.scoreUs} × {point.scoreThem}</b><span>{point.won?'Nosso ponto':'Adversário'}<small>Set {point.setNumber} · {time(point.timeMs)}{point.clockMode==='estimated'?' · aprox.':''}</small></span></StudioAction></li>)}</ol></>:<p className="sv-section-meta">Sem pontos marcados nesta gravação.</p>}
        </section></div>
    </StudioDialog>;
}
const reviewStyles=`
.sv-dialog.sv-live-review{width:min(960px,calc(100vw - 24px));max-width:960px;box-sizing:border-box;overflow:auto;padding:16px}.sv-live-review-source{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px}.sv-live-review-source>p{margin:0;flex:1}.sv-live-review-source>small{color:var(--sv-muted);overflow-wrap:anywhere;min-width:0}.sv-live-review-content{display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:16px}.sv-live-review-content[data-has-points=false]{grid-template-columns:minmax(0,1fr)}.sv-live-review-player{min-width:0}.sv-live-review-player video{display:block;width:100%;height:auto;max-height:60dvh;aspect-ratio:16/9;background:#000;border-radius:${radius.internal}px;object-fit:contain}.sv-live-review-empty{aspect-ratio:16/9;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;padding:18px;box-sizing:border-box;border:1px dashed var(--sv-line);border-radius:${radius.internal}px;color:var(--sv-muted)}.sv-live-review-markers{min-width:0;display:flex;flex-direction:column}.sv-live-review-markers h3{font-size:${compactUiMetrics.bodyFontSize}px;margin:0}.sv-live-review-markers ol{list-style:none;padding:0;margin:0 0 12px;max-height:55dvh;overflow:auto}.sv-live-review-markers li{margin-bottom:6px}.sv-live-review-markers .sv-action{display:block}.sv-live-review-markers .sv-action [role=button]{justify-content:flex-start!important;text-align:left}.sv-live-review-markers .sv-action [role=button]>span{display:flex;align-items:center;gap:10px;width:100%}.sv-live-review-markers .sv-action b{min-width:42px;font-variant-numeric:tabular-nums}.sv-live-review-markers .sv-action span>span{display:grid;gap:3px}.sv-live-review-markers small{color:var(--sv-muted);font-size:11px}@media(max-width:700px){.sv-live-review-content{grid-template-columns:1fr}.sv-live-review-markers ol{max-height:230px}.sv-dialog.sv-live-review{padding:14px}}
`;
