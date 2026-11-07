import type { useLiveHost } from './use-live-host';
import { liveCameraSummary } from './live-camera-presentation';

export type ScoutingLiveWorkspaceStatus = {
    state:'idle'|'connecting'|'preview'|'recording'|'paused'|'finalizing'|'copying'|'saved'|'stopped'|'disconnected'|'error';
    label:string; tone:'neutral'|'success'|'warning'|'danger'; elapsedMs:number|null;
    copyPercent:number|null; receiving:boolean; connected:boolean; error:string|null; sourceLabel:string|null;
};
export type ScoutingLiveWorkspaceControlState={
    canStart:boolean;canPause:boolean;canResume:boolean;canStop:boolean;busy:boolean;hasPreview:boolean;
    pending:'start'|'pause'|'resume'|'stop'|'preparing'|'camera'|'new-recording'|null;
};
export type ScoutingLiveWorkspaceControls=ScoutingLiveWorkspaceControlState&{
    actions:{start:()=>void;pause:()=>void;resume:()=>void;stop:()=>void};
};
export function liveHasUsablePreview(live:Pick<ReturnType<typeof useLiveHost>,'connection'|'stream'|'cameraState'>):boolean{
    if(live.connection!=='connected'||!live.stream||!['preview','recording','paused','finalizing'].includes(live.cameraState??''))return false;
    if(typeof live.stream.getVideoTracks!=='function')return true;
    try{return live.stream.getVideoTracks().some(track=>track.readyState!=='ended');}catch{return false;}
}
export function workspaceCameraControlState(live:Pick<ReturnType<typeof useLiveHost>,'connection'|'recording'|'session'|'stream'|'room'|'cameraState'|'busy'|'saving'|'controlPending'|'stopPending'|'startPending'>):ScoutingLiveWorkspaceControlState{
    const terminal=!!live.session?.ended||live.recording?.state==='stopped'||live.recording?.state==='error';
    const busy=live.busy||live.saving||!!live.controlPending||live.startPending||live.stopPending||live.cameraState==='finalizing';
    const ready=!busy&&!terminal&&live.connection==='connected'&&!!live.room;
    const canPause=ready&&live.recording?.state==='recording',canResume=ready&&live.recording?.state==='paused';
    const pending:ScoutingLiveWorkspaceControlState['pending']=live.stopPending||live.cameraState==='finalizing'?'stop':live.startPending?'start'
        :live.controlPending==='pause-recording'?'pause':live.controlPending==='resume-recording'?'resume'
        :live.controlPending==='new-recording'?'new-recording':live.controlPending?'camera':live.busy?'preparing':null;
    const hasPreview=liveHasUsablePreview(live);
    return {canStart:ready&&hasPreview&&!live.recording&&!live.session&&live.cameraState==='preview',canPause,canResume,canStop:canPause||canResume,busy,hasPreview,pending};
}
export function workspaceCameraStatus(live:Pick<ReturnType<typeof useLiveHost>,'connection'|'recording'|'session'|'stamp'|'stream'|'cameraState'|'captureInfo'|'error'|'videoStatuses'|'stopPending'|'startPending'>):ScoutingLiveWorkspaceStatus {
    const current=live.session?live.videoStatuses?.[live.session.id]:undefined;
    const copy=current??(!live.session?Object.values(live.videoStatuses??{}).find(value=>value.state==='receiving'):undefined);
    const receiving=copy?.state==='receiving',connected=live.connection==='connected';
    const activeCapture=live.recording?.state==='recording'||live.recording?.state==='paused'||live.stopPending||live.cameraState==='finalizing';
    const rawElapsed=activeCapture&&connected?live.stamp?.timeMs??live.recording?.durationMs??live.session?.durationMs:null;
    const elapsedMs=typeof rawElapsed==='number'&&Number.isFinite(rawElapsed)?Math.max(0,Math.floor(rawElapsed/1000)*1000):null;
    const copyPercent=copy&&copy.totalBytes>0?Math.min(100,Math.max(0,Math.floor(copy.receivedBytes/copy.totalBytes*100))):null;
    const error=live.error||copy?.error||(live.cameraState==='error'?'A câmera informou uma falha. Confira o celular.':null);
    const base={elapsedMs,copyPercent,receiving,connected,error,sourceLabel:live.captureInfo?liveCameraSummary(live.captureInfo):null};
    const status=(state:ScoutingLiveWorkspaceStatus['state'],label:string,tone:ScoutingLiveWorkspaceStatus['tone']):ScoutingLiveWorkspaceStatus=>({...base,state,label,tone});
    if(live.connection==='disconnected')return status('disconnected','Conexão interrompida','warning');
    if(live.stopPending||live.cameraState==='finalizing')return status('finalizing','Finalizando','warning');
    if(live.cameraState==='error')return status('error','Falha na câmera','danger');
    if(live.recording?.state==='recording')return status('recording','Gravando','danger');
    if(live.recording?.state==='paused')return status('paused','Pausada','warning');
    if(live.recording?.state==='error'||live.session?.recordingState==='error')return status('error','Gravação interrompida','danger');
    if(receiving)return status('copying',connected?'Salvando vídeo':'Envio pausado','warning');
    if(error)return status('error',copy?.state==='error'?'Vídeo pendente':'Câmera com aviso','danger');
    if(current?.state==='ready')return status('saved','Original salvo','success');
    if(live.startPending)return status('connecting','Iniciando gravação','warning');
    if(live.session?.ended||live.recording?.state==='stopped')return status('stopped','Gravação encerrada','neutral');
    if(live.cameraState==='off'&&connected)return status('preview','Câmera desligada','neutral');
    if(liveHasUsablePreview(live))return status('preview','Câmera pronta','success');
    if(live.connection==='waiting'||live.connection==='connecting')return status('connecting',live.connection==='waiting'?'Aguardando celular':'Conectando câmera','neutral');
    return status('idle','Conectar câmera','neutral');
}
