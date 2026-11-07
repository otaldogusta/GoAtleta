import { GoAtletaIcon } from '../../../ui/icon-registry';
import { useAppTheme } from '../../../ui/app-theme';
import { StudioAction } from '../video/StudioUI.web';
import type { LiveHostSession } from './live-storage';
import { markRender } from '../../../observability/perf';
import type { LiveVideoStatus } from './live-video-storage';

// perf-check: ignore-measure -- This list receives sessions from useLiveHost; it performs no data loads.

const dateTime=(value:string)=>new Date(value).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
const duration=(ms:number)=>{const seconds=Math.floor(ms/1000);return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;};
export type IntegratedLiveScouting={recordings:{recordingId:string;clipCount:number}[];onRegister:()=>void;onReview:(recordingId:string)=>void};

export default function LiveSavedRecordings({sessions,onReview,onDownload,onRequest,onRemove,canRemove,videoStatuses={},connected=false,integratedScouting,showHeading=true}:{
    sessions:LiveHostSession[];onReview:(session:LiveHostSession)=>void;onDownload:(session:LiveHostSession)=>void;
    onRequest:(session:LiveHostSession)=>void;onRemove:(session:LiveHostSession)=>void;canRemove:(session:LiveHostSession)=>boolean;
    videoStatuses?:Record<string,LiveVideoStatus>;connected?:boolean;integratedScouting?:IntegratedLiveScouting;showHeading?:boolean;
}) {
    markRender('screen.scoutingLiveSaved.render.web');
    const {colors}=useAppTheme();
    return <section className="sv-live-library" aria-label="Gravações salvas neste notebook">
        {showHeading?<><div className="sv-row"><h2>Gravações salvas</h2><small>{sessions.length}</small></div><p className="sv-section-meta sv-live-library-note">Salvos automaticamente neste computador</p></>:null}
        <ul className="sv-live-saved">{sessions.map(item=>{const linked=integratedScouting?.recordings.find(value=>value.recordingId===item.recordingId),copy=videoStatuses[item.id],ready=copy?.state==='ready',receiving=copy?.state==='receiving',removable=canRemove(item),partial=!!copy&&copy.receivedBytes>0&&copy.totalBytes>0;const progress=copy&&copy.totalBytes>0?Math.floor(copy.receivedBytes/copy.totalBytes*100):0;return <li key={item.id} className="sv-live-saved-item">
            <div className="sv-live-saved-open"><StudioAction label={`${linked?'Ver lances da gravação':'Rever vídeo ao vivo'} de ${new Date(item.createdAt).toLocaleString('pt-BR')}`} disabled={!linked&&!item.ended} onPress={()=>linked?integratedScouting!.onReview(item.recordingId):onReview(item)}>
                <span className="sv-live-saved-thumb">{item.thumbnailDataUrl?<><img src={item.thumbnailDataUrl} alt="" loading="lazy"/><span className="sv-live-saved-play"><GoAtletaIcon name="play" size={14} color="#fff"/></span></>:<GoAtletaIcon name="video" size={22} color={colors.muted}/>}</span>
                <span className="sv-live-saved-meta"><strong>{new Date(item.createdAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</strong><small>{new Date(item.createdAt).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}{item.durationMs!==undefined?` · ${duration(item.durationMs)}`:''} · {linked?`${linked.clipCount} ${linked.clipCount===1?'lance':'lances'}`:`${item.points.length} ${item.points.length===1?'ponto':'pontos'}`}</small><small className="sv-live-saved-source" title={copy?.error}>{!item.ended?'Não finalizada':ready?'Salvo neste computador':receiving?`Salvando no PC · ${progress}%`:copy?.state==='error'?partial?`Envio pausado · ${progress}%`:'Envio pendente · tentar novamente':'Vídeo no celular'}</small></span>
            </StudioAction></div>
            <div className="sv-live-saved-actions">{item.ended?<StudioAction label={`${ready?'Baixar vídeo':receiving?'Salvando vídeo':partial?'Continuar envio do vídeo':'Salvar vídeo no computador'} de ${dateTime(item.createdAt)}`} icon={receiving?'hourglass':partial&&!ready?'refresh':'download'} disabled={!item.ended||!ready&&!connected||receiving} onPress={()=>ready?onDownload(item):onRequest(item)}/>:null}{item.ended||removable?<StudioAction label={`Excluir registros do notebook de ${dateTime(item.createdAt)}`} icon="close" disabled={receiving||!removable} onPress={()=>onRemove(item)}/>:null}</div>
        </li>;})}</ul>
    </section>;
}
