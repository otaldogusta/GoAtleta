import { useCallback, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useWindowDimensions, type View } from 'react-native';
import { markRender, measureAsync } from '../../../observability/perf';
import { brandPalette, compactUiMetrics, radius, typography } from '../../../theme/tokens';
import { useResponsiveLayout } from '../../../ui/use-responsive-layout';
import { StudioAction } from '../video/StudioUI.web';
import type { useLiveHost } from './use-live-host';
import LiveCameraConnection from './LiveCameraConnection.web';
import LiveSavedRecordings, { type IntegratedLiveScouting } from './LiveSavedRecordings.web';
import LiveWorkspacePanel from './LiveWorkspacePanel.web';
import { liveCameraDetails } from './live-camera-presentation';
import { workspaceCameraControlState, workspaceCameraStatus, type ScoutingLiveWorkspaceControls, type ScoutingLiveWorkspaceStatus } from './workspace-camera-presentation';
import type { LiveHostSession } from './live-storage';

export type LiveWorkspaceCameraProps={live:ReturnType<typeof useLiveHost>;qr:string;theme:CSSProperties;visible:boolean;bench?:boolean;presentation?:'main'|'pip';previewTarget?:HTMLElement|null;attachPreview:(node:HTMLVideoElement|null)=>void;copy:()=>Promise<boolean>;integratedScouting?:IntegratedLiveScouting;controlsOpen?:boolean;libraryOpen?:boolean;controlsAnchor?:HTMLElement|null;controlsTarget?:HTMLElement|null;onControlsOpen?:()=>void;onControlsClose?:()=>void;onLibraryClose?:()=>void;onWorkspaceStatusChange?:(status:ScoutingLiveWorkspaceStatus)=>void;onWorkspaceControlsChange?:(controls:ScoutingLiveWorkspaceControls|null)=>void;onReview:(session:LiveHostSession)=>void;onRemove:(session:LiveHostSession)=>void};
const clock=(ms:number|null)=>ms===null?'--:--':`${String(Math.floor(ms/60000)).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}`;
export default function LiveWorkspaceCamera(props:LiveWorkspaceCameraProps){
    markRender('screen.scoutingLiveWorkspaceCamera.render.web');
    const {live,attachPreview,onControlsClose,onLibraryClose,onWorkspaceControlsChange}=props,layout=useResponsiveLayout(),{width:viewportWidth}=useWindowDimensions(),status=workspaceCameraStatus(live);
    const controlState=workspaceCameraControlState(live),{canStart,canPause,canResume,canStop,busy:commandsBusy,hasPreview,pending}=controlState;
    const commandHost=useRef<{live:ReturnType<typeof useLiveHost>;state:ReturnType<typeof workspaceCameraControlState>}|null>(null);
    useLayoutEffect(()=>{commandHost.current={live,state:controlState};});
    useLayoutEffect(()=>()=>{commandHost.current=null;},[]);
    const invoke=useCallback((kind:'start'|'pause'|'resume'|'stop')=>{
        const current=commandHost.current;if(!current)return;
        if(kind==='start'&&current.state.canStart)current.live.startRecording();
        else if(kind==='pause'&&current.state.canPause)current.live.cameraCommand('pause-recording');
        else if(kind==='resume'&&current.state.canResume)current.live.cameraCommand('resume-recording');
        else if(kind==='stop'&&current.state.canStop)current.live.stopRecording();
    },[]);
    const actions=useMemo(()=>({start:()=>invoke('start'),pause:()=>invoke('pause'),resume:()=>invoke('resume'),stop:()=>invoke('stop')}),[invoke]);
    const controls=useMemo<ScoutingLiveWorkspaceControls>(()=>({canStart,canPause,canResume,canStop,busy:commandsBusy,hasPreview,pending,actions}),[canStart,canPause,canResume,canStop,commandsBusy,hasPreview,pending,actions]);
    useLayoutEffect(()=>{onWorkspaceControlsChange?.(controls);},[onWorkspaceControlsChange,controls]);
    useLayoutEffect(()=>()=>onWorkspaceControlsChange?.(null),[onWorkspaceControlsChange]);
    const published=useRef<{callback:LiveWorkspaceCameraProps['onWorkspaceStatusChange'];value:string}|null>(null),helpRoot=useRef<View|null>(null),helpDismiss=useRef<(()=>void)|null>(null);
    const helpRefs=useMemo(()=>[helpRoot],[]);
    const [localOpen,setLocalOpen]=useState(false),[previewOpen,setPreviewOpen]=useState(false),[previewTrigger,setPreviewTrigger]=useState<HTMLSpanElement|null>(null);
    const controlsOpen=props.controlsOpen??localOpen;
    const openControls=()=>{if(props.onControlsOpen)props.onControlsOpen();else setLocalOpen(true);};
    const closeControls=useCallback(()=>{setLocalOpen(false);onControlsClose?.();},[onControlsClose]);
    const closeLibrary=useCallback(()=>onLibraryClose?.(),[onLibraryClose]);
    const helpElement=useCallback((node:HTMLElement|null,close?:()=>void)=>{helpRoot.current=node as unknown as View|null;helpDismiss.current=node&&close?close:null;},[]);
    const dismissHelp=useCallback(()=>helpDismiss.current?.(),[]);
    useLayoutEffect(()=>{const callback=props.onWorkspaceStatusChange;if(!callback)return;const value=JSON.stringify(status);if(published.current?.callback===callback&&published.current.value===value)return;published.current={callback,value};callback(status);});
    const terminal=!!live.session?.ended||live.recording?.state==='stopped'||live.recording?.state==='error';
    const capturing=live.recording?.state==='recording'||live.recording?.state==='paused';
    const busy=live.busy||live.saving||!!live.controlPending||live.startPending||live.stopPending||live.cameraState==='finalizing';
    const interrupted=live.connection==='disconnected',capturePending=!!live.session&&!terminal||capturing&&!terminal;
    const currentCopy=live.session?live.videoStatuses?.[live.session.id]:undefined;
    const remoteReady=status.connected&&!!live.room;
    const savedDuration=live.session?.durationMs??live.recording?.durationMs;
    const sourceQuality=live.captureInfo?liveCameraDetails(live.captureInfo).replace('Full HD','1080p').replace(/\bHD\b/,'720p').replace('quadros/s','fps'):'';
    const sources=live.history.some(session=>session.id===live.session?.id)?live.history:live.session?[live.session,...live.history]:live.history;
    const integrated=props.integratedScouting?{...props.integratedScouting,onReview:(id:string)=>{closeLibrary();props.integratedScouting!.onReview(id);}}:undefined;
    const panelActions=<div className="lwc-actions">
        {!live.room?<StudioAction label="Conectar câmera ao vivo" primary icon="video" disabled={busy||capturePending} onPress={()=>{void measureAsync('screen.scoutingLiveWorkspaceCamera.load.room',()=>live.start());}}>{live.busy?'Preparando conexão…':props.controlsTarget?'Gerar QR code':'Conectar câmera'}</StudioAction>:null}
        {remoteReady&&live.session?.ended&&live.session.recordingState==='stopped'?<StudioAction label="Nova gravação ao vivo" primary icon="video" disabled={!live.canNewRecording} onPress={()=>{void live.newRecording();}}>{live.controlPending==='new-recording'?'Preparando câmera…':'Nova gravação'}</StudioAction>:null}
        {remoteReady&&!terminal&&!live.recording&&!live.session&&live.cameraState==='preview'?<StudioAction label="Iniciar gravação no celular" primary icon="video" disabled={!canStart} onPress={actions.start}>{live.startPending?'Iniciando…':'Iniciar gravação'}</StudioAction>:null}
        {remoteReady&&!terminal&&capturing?<><StudioAction label={live.recording?.state==='paused'?'Continuar gravação no celular':'Pausar gravação no celular'} primary disabled={live.recording?.state==='paused'?!canResume:!canPause} onPress={live.recording?.state==='paused'?actions.resume:actions.pause}>{live.controlPending==='pause-recording'?'Pausando…':live.controlPending==='resume-recording'?'Continuando…':live.recording?.state==='paused'?'Continuar gravação':'Pausar gravação'}</StudioAction><StudioAction label="Parar gravação no celular" icon="stopRecording" disabled={!canStop} onPress={actions.stop}>{live.stopPending?'Finalizando…':'Encerrar gravação'}</StudioAction></>:null}
        {remoteReady&&['off','preview'].includes(live.cameraState??'')&&!capturing?<StudioAction label={live.cameraState==='off'?'Ligar câmera do celular':'Desligar câmera do celular'} disabled={busy} onPress={()=>live.cameraCommand(live.cameraState==='off'?'camera-on':'camera-off')}>{live.controlPending==='camera-on'?'Ligando câmera…':live.controlPending==='camera-off'?'Desligando câmera…':live.cameraState==='off'?'Ligar câmera':'Desligar câmera'}</StudioAction>:null}
    </div>;
    const retryPreview=()=>{const node=previewTrigger?.closest('details')?.querySelector('video');if(node)void node.play().catch(()=>undefined);};
    const preview=<details className={`lwc-preview${props.bench?' lwc-bench':''}${props.bench&&props.previewTarget?' lwc-target-preview':''}`} data-presentation={props.presentation??'main'} hidden={props.bench&&!hasPreview} style={props.theme} open={props.bench||viewportWidth>=1024||previewOpen} onToggle={event=>{if(!props.bench&&viewportWidth<1024)setPreviewOpen(event.currentTarget.open);}}><summary>Câmera ao vivo <small>{status.label}</small></summary>
            <div className="lwc-preview-content"><header><h2>Câmera ao vivo</h2><span data-tone={status.tone}>{status.label}{status.elapsedMs!==null?` · ${clock(status.elapsedMs)}`:''}</span></header>
                <div className="lwc-picture">{live.stream?<video ref={attachPreview} autoPlay={props.visible&&hasPreview} playsInline muted aria-label="Prévia da câmera do celular"/>:<div className="lwc-preview-empty"><span>{live.cameraState==='off'?'Câmera desligada':live.room?'Aguardando o celular':'Sem câmera conectada'}</span></div>}{hasPreview&&live.previewPlaybackBlocked?<div className="lwc-preview-empty"><StudioAction label="Iniciar prévia" primary icon="play" onPress={retryPreview}>Iniciar prévia</StudioAction></div>:null}{props.bench?<span className="lwc-live-badge" data-tone={status.tone}>{hasPreview?'Ao vivo':status.label}</span>:null}</div>
                <footer><small>{status.receiving?status.copyPercent===null?'Original chegando':`Original chegando · ${status.copyPercent}%`:status.sourceLabel??'Câmera do celular'}</small><span ref={setPreviewTrigger}><StudioAction label="Abrir controles da câmera" onPress={openControls}>Controles</StudioAction></span></footer>
            </div>
        </details>;
    return <div className="lwc-camera" style={props.theme}><style>{workspaceCameraStyles}</style>
        {props.previewTarget?createPortal(preview,props.previewTarget):preview}
        <LiveWorkspacePanel open={!!props.controlsTarget||controlsOpen} contentTarget={props.controlsTarget} title="Câmera" kind="controls" anchor={props.controlsAnchor??previewTrigger} onClose={closeControls} theme={props.theme} interactiveRefs={helpRefs} onNestedDismiss={dismissHelp}>
            {!props.controlsTarget||status.state!=='idle'?<div className="lwc-capture-summary"><strong>{status.label}</strong>{status.elapsedMs!==null?<time>{clock(status.elapsedMs)}</time>:null}</div>:null}
            {status.sourceLabel&&status.connected?<small className="lwc-source">{status.sourceLabel}{sourceQuality?` · ${sourceQuality}`:''}</small>:null}
            {status.error?<p role="alert" className="sv-alert">{status.error}</p>:null}
            {interrupted?<p className="lwc-reconnect">No celular, toque em <strong>Reconectar</strong> na mesma aba.</p>:null}
            {panelActions}
            {currentCopy&&live.session?.ended?<section className={`lwc-copy${currentCopy.state==='ready'?' lwc-copy-saved':''}`} aria-label="Vídeo no computador">{currentCopy.state==='ready'?<><div><strong>Vídeo salvo</strong><small>{typeof savedDuration==='number'?`${clock(savedDuration)} · `:''}Neste computador</small></div><StudioAction label="Baixar vídeo desta gravação ao vivo" icon="download" onPress={()=>{void live.downloadSavedVideo(live.session!);}}/></>:<><p>{currentCopy.state==='receiving'?status.copyPercent===null?status.connected?'Salvando no computador':'Envio pausado':`${status.connected?'Salvando no computador':'Envio pausado'} · ${status.copyPercent}%`:'Envio pendente'}</p>{currentCopy.state==='receiving'?<progress max={100} value={status.copyPercent??undefined} aria-label="Salvando vídeo no computador"/>:<StudioAction label="Continuar envio desta gravação" disabled={!status.connected} onPress={()=>live.requestSavedVideo(live.session!)}>Continuar envio</StudioAction>}</>}</section>:null}
            <LiveCameraConnection inline hasRoom={!!live.room} qr={props.qr} localCameraUrl={live.room?.localCameraUrl} cameraReady={!!live.config?.cameraReady} connected={status.connected} capturePending={capturePending} interrupted={interrupted} checking={live.checkingConfig} checkResult={live.error?undefined:live.serviceCheck} checkDisabled={live.busy} onCheck={()=>{void live.refreshConfig();}} onCopy={props.copy} onPopoverElement={helpElement} portalToBodyOnWeb={!layout.isMobile&&!props.controlsTarget}/>
        </LiveWorkspacePanel>
        <LiveWorkspacePanel open={!!props.libraryOpen} title="Gravações salvas" kind="library" onClose={closeLibrary} theme={props.theme}>
            {live.error?<p role="alert" className="sv-alert">{live.error}</p>:null}
            {sources.length?<LiveSavedRecordings showHeading={false} integratedScouting={integrated} sessions={sources} onReview={item=>{closeLibrary();props.onReview(item);}} onDownload={item=>{void live.downloadSavedVideo(item);}} onRequest={live.requestSavedVideo} onRemove={item=>{closeLibrary();props.onRemove(item);}} canRemove={live.canDeleteSession} videoStatuses={live.videoStatuses} connected={status.connected}/>:<p className="sv-section-meta">Nenhuma gravação neste computador.</p>}
            {live.deleted?<div><p className="sv-section-meta">Gravação na lixeira do computador</p><StudioAction label="Restaurar registros excluídos do notebook" disabled={live.saving||live.busy} onPress={()=>{void live.restoreDeleted();}}>Restaurar</StudioAction></div>:null}
        </LiveWorkspacePanel>
    </div>;
}
const workspaceCameraStyles=`
.lwc-camera{min-width:0;color:var(--sv-text);font-family:${typography.body.fontFamily};font-size:${compactUiMetrics.bodyFontSize}px}.lwc-preview{background:var(--sv-panel);border:1px solid var(--sv-line);border-radius:${radius.card}px;overflow:hidden}.lwc-preview>summary{min-height:${compactUiMetrics.touchTarget}px;cursor:pointer;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:8px;font-weight:600}.lwc-preview>summary small{font-weight:400;color:var(--sv-muted)}.lwc-preview-content>header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px}.lwc-preview h2{font-size:${compactUiMetrics.bodyFontSize}px;font-weight:600;margin:0}.lwc-preview header>span{font-size:${compactUiMetrics.metadataFontSize}px;color:var(--sv-muted)}.lwc-picture{position:relative;aspect-ratio:16/9;max-height:240px;background:#050b12;overflow:hidden}.lwc-picture video{display:block;width:100%;height:100%;object-fit:contain}.lwc-preview-empty{position:absolute;inset:0;display:grid;place-content:center;color:var(--sv-muted);font-size:${compactUiMetrics.metadataFontSize}px}.lwc-preview-interrupted{position:absolute;inset:auto 8px 8px;padding:6px 8px;border-radius:${radius.internal}px;background:var(--sv-panel);font-size:${compactUiMetrics.metadataFontSize}px}.lwc-preview footer{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 8px 4px 12px}.lwc-preview footer small{color:var(--sv-muted);font-size:${compactUiMetrics.metadataFontSize}px}.lwc-capture-summary{display:flex;align-items:center;justify-content:space-between;gap:12px}.lwc-capture-summary strong{font-size:${compactUiMetrics.bodyFontSize}px;font-weight:600}.lwc-capture-summary time{font:600 18px ${typography.mono.fontFamily};font-variant-numeric:tabular-nums}.lwc-source{font-size:${compactUiMetrics.metadataFontSize}px;color:var(--sv-muted)}.lwc-actions{display:flex;flex-wrap:wrap;gap:8px}.lwc-copy{display:grid;gap:8px}.lwc-copy progress{width:100%;accent-color:var(--sv-green);height:6px}.lwc-copy p{font-size:${compactUiMetrics.metadataFontSize}px;color:var(--sv-muted)}
@media(min-width:1024px){.lwc-preview>summary{display:none}}
.lwc-bench{font-family:${typography.body.fontFamily};color:var(--sv-text);font-size:${compactUiMetrics.bodyFontSize}px;box-sizing:border-box}.lwc-bench>summary,.lwc-bench .lwc-preview-content>header,.lwc-bench .lwc-preview-content>footer{display:none}.lwc-bench .lwc-preview-content{height:100%}.lwc-bench .lwc-picture{max-height:none;aspect-ratio:16/9}.lwc-bench .lwc-picture video{position:absolute;inset:0}.lwc-live-badge{position:absolute;top:8px;left:8px;display:inline-flex;align-items:center;gap:6px;max-width:calc(100% - 16px);padding:4px 8px;border-radius:${radius.internal}px;background:var(--sv-panel);color:var(--sv-text);font-size:${compactUiMetrics.metadataFontSize}px;line-height:${compactUiMetrics.metadataLineHeight}px;pointer-events:none}.lwc-live-badge::before{content:'';width:6px;height:6px;flex:none;border-radius:50%;background:${brandPalette.danger}}.lwc-live-badge[data-tone=warning]::before{background:var(--sv-amber)}.lwc-live-badge[data-tone=neutral]::before{background:var(--sv-muted)}
.lwc-preview[hidden]{display:none!important;pointer-events:none}.lwc-actions:empty{display:none}
.lwc-target-preview>.lwc-preview-content{position:absolute;inset:0}
.lwc-reconnect{font-size:${compactUiMetrics.metadataFontSize}px;line-height:${compactUiMetrics.metadataLineHeight}px;color:var(--sv-muted)}.lwc-copy-saved{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:12px;border-top:1px solid var(--sv-line)}.lwc-copy-saved>div{display:grid;gap:2px;min-width:0}.lwc-copy-saved strong{font-size:${compactUiMetrics.bodyFontSize}px;font-weight:600}.lwc-copy-saved small{font-size:${compactUiMetrics.metadataFontSize}px;color:var(--sv-muted)}
.lwc-target-preview{position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:0;pointer-events:auto}.lwc-target-preview .lwc-picture{height:100%;aspect-ratio:auto}.lwc-target-preview[data-presentation=pip]{position:absolute;inset:auto 12px 12px auto;width:clamp(120px,22%,190px);height:auto;aspect-ratio:16/9;border:1px solid var(--sv-line);border-radius:${radius.internal}px;pointer-events:auto;overflow:hidden}.lwc-target-preview[data-presentation=pip] .lwc-picture{height:100%;aspect-ratio:16/9}.lwc-target-preview[data-presentation=pip] .lwc-live-badge{top:4px;left:4px;padding:2px 6px;max-width:calc(100% - 8px)}
`;
