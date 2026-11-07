import type { ScoutingLiveWorkspaceStatus } from './live/workspace-camera-presentation';

const clock=(value:number)=>{const seconds=Math.max(0,Math.floor(value/1000));return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;};

export function workspaceCaptureLabel(status:ScoutingLiveWorkspaceStatus|null):string {
    if(!status)return 'Não conectada';
    if(['recording','paused','finalizing'].includes(status.state))return status.label+(status.elapsedMs!==null?` ${clock(status.elapsedMs)}`:'');
    if(status.state==='copying')return status.label+(status.copyPercent!==null?` ${status.copyPercent}%`:'');
    return status.connected?'Conectada':'Não conectada';
}

export function workspaceCaptureTone(status:ScoutingLiveWorkspaceStatus|null):ScoutingLiveWorkspaceStatus['tone'] {
    if(status&&['recording','paused','finalizing','copying'].includes(status.state))return status.tone;
    return status?.connected?'success':'neutral';
}

export function workspaceVideoLabel(status:ScoutingLiveWorkspaceStatus|null):string {
    if(!status)return 'Vídeo';
    if(status.state==='recording')return 'Ao vivo';
    if(status.state==='paused')return 'Pausada';
    if(status.state==='copying')return status.copyPercent===null?'Copiando':`${status.copyPercent}%`;
    if(status.state==='saved')return 'Original salvo';
    if(status.state==='error'||status.state==='disconnected')return status.copyPercent===null?'Aviso':`${status.copyPercent}%`;
    return 'Vídeo';
}
