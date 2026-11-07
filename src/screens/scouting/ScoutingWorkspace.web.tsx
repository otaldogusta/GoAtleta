import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type Ref } from 'react';
import { ResponsivePage } from '../../components/ui/ResponsivePage';
import { OperationalText as Text } from '../../ui/OperationalText';
import { useAppTheme } from '../../ui/app-theme';
import { useResponsiveLayout } from '../../ui/use-responsive-layout';
import { useContainerResponsiveLayout } from '../../ui/use-container-responsive-layout';
import { compactUiMetrics, radius } from '../../theme/tokens';
import { registerPendingEditsNavigation } from '../../navigation/pending-edits-navigation';
import { markRender, measureAsync } from '../../observability/perf';
import { ScoutingCollector, type ScoutingCollectorActions } from './ScoutingCollector';
import { ScoutingTabs } from './ScoutingNavigation';
import { ScoutingWorkspaceMenu } from './ScoutingWorkspaceMenu.web';
import { workspaceCaptureLabel, workspaceCaptureTone } from './workspace-status';
import { scoutingBenchStyles } from './scouting-bench-styles';
import { NewScoutingModal } from './NewScoutingModal';
import { shortDate } from './ScoutingUI';
import { liveLocalAvailable } from './live/live-api';
import { useLiveScouting } from './live/use-live-scouting';
import { StudioAction, StudioDialog } from './video/StudioUI.web';
import { StudioSelect } from './video/StudioSelect.web';
import { studioStyles } from './video/studio-styles';
import type { ScoutingWorkspaceMode, ScoutingWorkspaceProps } from './ScoutingWorkspace.types';
import type { ScoutingLiveWorkspaceStatus, ScoutingLiveWorkspaceControls } from './live/ScoutingLive.web';

const VideoStudio=lazy(()=>measureAsync('screen.scouting.workspace.load.video',()=>import('./video/ScoutingVideoStudio.web')));
const LiveCamera=lazy(()=>measureAsync('screen.scouting.workspace.load.camera',()=>import('./live/ScoutingLive.web')));
const LiveScoutingVideo=lazy(()=>measureAsync('screen.scouting.workspace.load.live-video',()=>import('./live/LiveScoutingVideo.web')));
type LeaveGuard=(next:()=>void)=>void;
type LinkedSource={id:string;title:string;date:string};
const BENCH_MIN_CONTENT_WIDTH=800;

/** A single owner for guarded navigation. Hidden tools stay mounted inside the app shell. */
export default function ScoutingWorkspace(props:ScoutingWorkspaceProps) {
    return <ScoutingWorkspaceContent key={JSON.stringify([props.userId,props.org,props.classId])} {...props}/>;
}
function ScoutingWorkspaceContent(props:ScoutingWorkspaceProps) {
    markRender('screen.scouting.workspace.render.web');
    const {colors}=useAppTheme(),layout=useResponsiveLayout();
    const {containerRef:collectorRef,measuredWidth:collectorWidth}=useContainerResponsiveLayout();
    const {containerRef:benchRef,measuredWidth:benchWidth}=useContainerResponsiveLayout();
    const splitBench=!!layout.supportsSplitView&&(benchWidth||layout.contentWidth)>=BENCH_MIN_CONTENT_WIDTH;
    const active=props.active!==false,canUseCamera=liveLocalAvailable();
    const requestedMode=props.initialMode??'video';
    const initialMode:ScoutingWorkspaceMode=requestedMode==='camera'?(canUseCamera?'register':'video'):requestedMode;
    const [mode,setMode]=useState<ScoutingWorkspaceMode>(initialMode);
    useLayoutEffect(()=>{const node=collectorRef.current as unknown as HTMLElement|null;if(node)node.inert=!splitBench&&mode!=='register';},[collectorRef,mode,splitBench]);
    const [cameraPanelOpen,setCameraPanelOpen]=useState(requestedMode==='camera'&&canUseCamera),[cameraLibraryOpen,setCameraLibraryOpen]=useState(false);
    const [cameraStatus,setCameraStatus]=useState<ScoutingLiveWorkspaceStatus|null>(null);
    const [cameraControls,setCameraControls]=useState<ScoutingLiveWorkspaceControls|null>(null);
    const [previewTarget,setPreviewTarget]=useState<HTMLElement|null>(null);
    const [cameraSourceTarget,setCameraSourceTarget]=useState<HTMLElement|null>(null);
    const [benchReplay,setBenchReplay]=useState(initialMode==='video');
    const [collectorActions,setCollectorActions]=useState<ScoutingCollectorActions|null>(null);
    const [info,setInfo]=useState<'official'|'video'|'sources'|null>(null);
    const [cameraAnchor,setCameraAnchor]=useState<HTMLDivElement|null>(null);
    const openCamera=useCallback(()=>setCameraPanelOpen(true),[]),closeCamera=useCallback(()=>setCameraPanelOpen(false),[]),closeCameraLibrary=useCallback(()=>setCameraLibraryOpen(false),[]);
    const cameraSourceChanged=useCallback((node:HTMLElement|null)=>{setCameraSourceTarget(node);if(node){setCameraPanelOpen(false);setCameraLibraryOpen(false);}},[]);
    const toggleCamera=useCallback(()=>setCameraPanelOpen(value=>!value),[]);
    const statusChanged=useCallback((status:ScoutingLiveWorkspaceStatus)=>setCameraStatus(old=>JSON.stringify(old)===JSON.stringify(status)?old:status),[]);
    const controlsChanged=useCallback((controls:ScoutingLiveWorkspaceControls|null)=>setCameraControls(controls),[]);
    const replayChanged=useCallback((replaying:boolean)=>setBenchReplay(replaying),[]);
    const initialId=props.initialSessionId??props.rows[0]?.session.id??'';
    const [videoSessionId,setVideoSessionId]=useState(initialId),[manualSessionId,setManualSessionId]=useState(initialId);
    const liveIntegration=useLiveScouting({userId:props.userId,org:props.org,classId:props.classId},manualSessionId,canUseCamera);
    const [preferLive,setPreferLive]=useState(true),[selectedRecordingId,setSelectedRecordingId]=useState('');
    const [legacyVideoVisited,setLegacyVideoVisited]=useState(false);
    const showLiveVideo=canUseCamera&&preferLive&&liveIntegration.recordings.length>0;
    const integrationBridge=liveIntegration.captureBridge;
    const [linkedSources,setLinkedSources]=useState<LinkedSource[]>([]);
    const [visited,setVisited]=useState(()=>new Set<ScoutingWorkspaceMode>([initialMode,'register','video',...(canUseCamera?['camera' as const]:[])]));
    const [creating,setCreating]=useState(false),[confirmExit,setConfirmExit]=useState(false);
    useEffect(()=>{let current=true;if(videoSessionId&&!showLiveVideo&&!liveIntegration.loading&&!legacyVideoVisited)void Promise.resolve().then(()=>{if(current)setLegacyVideoVisited(true);});return()=>{current=false;};},[videoSessionId,showLiveVideo,liveIntegration.loading,legacyVideoVisited]);
    const [toolbarTarget,setToolbarTarget]=useState<HTMLDivElement|null>(null);
    const [manualDirty,setManualDirty]=useState(false),[manualBusy,setManualBusy]=useState(false);
    const manualExplicit=useRef(false),dirtyRef=useRef(manualDirty),busyRef=useRef(manualBusy),videoIdRef=useRef(videoSessionId),liveOwnedRef=useRef(showLiveVideo);
    useLayoutEffect(()=>{dirtyRef.current=manualDirty;busyRef.current=manualBusy;videoIdRef.current=videoSessionId;liveOwnedRef.current=showLiveVideo;},[manualDirty,manualBusy,videoSessionId,showLiveVideo]);
    const captureBridge=useMemo(()=>({...integrationBridge,applied:async(...args:Parameters<typeof integrationBridge.applied>)=>{
        const result=await integrationBridge.applied(...args);manualExplicit.current=true;setPreferLive(true);return result;
    }}),[integrationBridge]);
    const manualDirtyChanged=useCallback((value:boolean)=>{dirtyRef.current=value;setManualDirty(value);},[]);
    const manualBusyChanged=useCallback((value:boolean)=>{busyRef.current=value;setManualBusy(value);},[]);
    const linkedChanged=useCallback((sources:LinkedSource[])=>{
        if(videoIdRef.current!==videoSessionId)return;
        setLinkedSources(old=>JSON.stringify(old)===JSON.stringify(sources)?old:sources);
        if(!liveOwnedRef.current&&!manualExplicit.current&&!dirtyRef.current&&!busyRef.current&&sources.length)setManualSessionId(current=>sources.some(source=>source.id===current)?current:sources[0].id);
    },[videoSessionId]);
    const root=useRef<HTMLDivElement|null>(null),videoGuard=useRef<LeaveGuard|null>(null),liveVideoGuard=useRef<LeaveGuard|null>(null),cameraGuard=useRef<LeaveGuard|null>(null);
    const pendingManual=useRef<(()=>void)|null>(null),requestNavigation=useRef<LeaveGuard>(()=>{});
    const setVideoGuard=useCallback((guard:LeaveGuard|null)=>{videoGuard.current=guard;},[]);
    const setLiveVideoGuard=useCallback((guard:LeaveGuard|null)=>{liveVideoGuard.current=guard;},[]);
    const setCameraGuard=useCallback((guard:LeaveGuard|null)=>{cameraGuard.current=guard;},[]);
    const chooseMode=(next:ScoutingWorkspaceMode)=>{if(next==='camera'){openCamera();return;}setVisited(old=>new Set([...old,next]));setMode(next);};
    const guardVideoSource=(source:'live'|'other',next:()=>void)=>{
        const guard=source==='live'?liveVideoGuard.current:videoGuard.current;
        if(!guard){next();return;}
        const previousMode=mode,previousLive=preferLive;
        chooseMode('video');setPreferLive(source==='live');
        guard(()=>{setMode(previousMode);setPreferLive(previousLive);next();});
    };
    const integratedScouting=manualSessionId?{
        recordings:liveIntegration.recordings.map(item=>({recordingId:item.recordingId,clipCount:item.clips.filter(clip=>clip.active).length})),
        onRegister:()=>chooseMode('register'),
        onReview:(recordingId:string)=>{
            const current=liveIntegration.recordings.find(item=>item.recordingId===selectedRecordingId)?.recordingId??liveIntegration.recordings[0]?.recordingId;
            const open=()=>{setSelectedRecordingId(recordingId);setPreferLive(true);setBenchReplay(true);chooseMode('video');};
            const review=()=>{if(current!==recordingId)guardVideoSource('live',open);else open();};
            if(!preferLive)guardVideoSource('other',review);else review();
        },
    }:undefined;
    // Toolbar children arrive through a portal; listen on its DOM container so
    // their dialogs open in the visible video pane, regardless of React ancestry.
    useEffect(()=>{
        if(!toolbarTarget?.addEventListener)return;
        const reveal=(event:MouseEvent)=>{if(mode!=='video'&&!(event.target as HTMLElement).closest?.('[aria-disabled="true"],[disabled]')){setVisited(old=>new Set([...old,'video' as const]));setMode('video');}};
        toolbarTarget.addEventListener('click',reveal,true);
        return()=>toolbarTarget.removeEventListener('click',reveal,true);
    },[toolbarTarget,mode]);
    const afterContentGuard=(next:()=>void)=>guardVideoSource('live',()=>guardVideoSource('other',next));
    const guardManual=(next:()=>void)=>{
        if(manualBusy)return;
        if(manualDirty){pendingManual.current=next;setConfirmExit(true);}
        else next();
    };
    const guardContent=(next:()=>void)=>guardManual(()=>afterContentGuard(next));
    const leave=(next:()=>void)=>guardContent(()=>{
        if(cameraGuard.current){setCameraPanelOpen(true);cameraGuard.current(next);}else next();
    });
    useLayoutEffect(()=>{requestNavigation.current=leave;});
    useLayoutEffect(()=>{
        if(!active||typeof document==='undefined')return;
        const node=root.current,previousFocus=document.activeElement as HTMLElement|null;
        // Hide only the overview beneath this region. The shared sidebar remains
        // interactive and reaches the same pending-edits guard as the Back action.
        const siblings=[...(node?.parentElement?.children??[])].filter(item=>item!==node).map(item=>({element:item as HTMLElement,inert:(item as HTMLElement).inert,visibility:(item as HTMLElement).style.visibility}));
        siblings.forEach(({element})=>{element.inert=true;element.style.visibility='hidden';});
        node?.querySelector<HTMLElement>('[role="button"]')?.focus();
        return()=>{siblings.forEach(({element,inert,visibility})=>{element.inert=inert;element.style.visibility=visibility;});if(node?.contains(document.activeElement))previousFocus?.focus();};
    },[active]);
    useEffect(()=>active?registerPendingEditsNavigation(next=>requestNavigation.current(next)):undefined,[active]);
    useEffect(()=>{
        if(!active||!manualDirty)return;
        const prevent=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
        window.addEventListener('beforeunload',prevent);return()=>window.removeEventListener('beforeunload',prevent);
    },[active,manualDirty]);
    const changeSession=(next:string)=>{
        if(mode==='register'){
            if(next===manualSessionId)return;
            guardManual(()=>guardVideoSource('live',()=>{manualExplicit.current=true;setManualSessionId(next);setManualDirty(false);}));return;
        }
        if(next===videoSessionId)return;
        guardContent(()=>{manualExplicit.current=false;setVideoSessionId(next);setManualSessionId(next);setLinkedSources([]);setMode('video');setManualDirty(false);setVisited(old=>new Set<ScoutingWorkspaceMode>([...[...old].filter(value=>value==='camera'),'video','register']));});
    };
    const create=()=>{if(props.canCreate!==false)guardContent(()=>setCreating(true));};
    const sessionId=mode==='register'||mode==='video'&&showLiveVideo?manualSessionId:videoSessionId;
    const sourceOptions=mode==='register'&&linkedSources.length?linkedSources:props.rows.map(row=>row.session);
    const options=sourceOptions.map(source=>({value:source.id,label:`${source.title} · ${shortDate(source.date)}`}));
    if(sessionId&&!options.some(option=>option.value===sessionId))options.unshift({value:sessionId,label:props.rows.find(row=>row.session.id===sessionId)?.session.title??'Análise selecionada'});
    const themes={
        '--sv-bg':colors.background,'--sv-panel':colors.card,'--sv-input':colors.inputBg,'--sv-text':colors.text,'--sv-muted':colors.muted,
        '--sv-line':colors.border,'--sv-green':colors.primaryBg,'--sv-primary-text':colors.primaryText,'--sv-amber':colors.warning,
        '--sw-body':`${layout.density.bodyFontSize}px`,'--sw-meta':`${layout.density.metadataFontSize}px`,'--sw-radius':`${radius.card}px`,'--sw-capture-danger':colors.dangerText,
    } as CSSProperties;
    const close=()=>leave(props.onClose);
    const officialLabel=manualBusy||collectorActions?.status==='busy'?'Salvando…':collectorActions?.status==='pending'?'Pendente':collectorActions?.status==='error'?'Confira o registro':manualDirty||collectorActions?.status==='dirty'?'Em edição':collectorActions?.status==='saved'?'Salvo':'Registro';
    const captureLabel=cameraControls?.pending==='pause'?'Pausando…':cameraControls?.pending==='resume'?'Continuando…':cameraControls?.pending==='start'?'Iniciando…':workspaceCaptureLabel(cameraStatus);
    const pausePending=cameraControls?.pending==='pause'||cameraControls?.pending==='resume';
    const stopPending=cameraControls?.pending==='stop';
    const hasPreview=!!cameraControls?.hasPreview;
    const liveMain=hasPreview&&preferLive&&!benchReplay;
    const collecting=active&&(splitBench||mode==='register');
    const returnToLive=()=>{if(hasPreview){setBenchReplay(false);setPreferLive(true);}else openCamera();};
    const collectorActionsChanged=useCallback((actions:ScoutingCollectorActions|null)=>setCollectorActions(actions),[]);
    const finishAnalysis=()=>{if(!manualBusy&&collectorActions?.canFinish)collectorActions.requestFinish();};
    const openOtherSources=()=>{setInfo(null);guardVideoSource(showLiveVideo?'live':'other',()=>{setPreferLive(false);chooseMode('video');});};
    const loading=<p className="sw-loading" role="status">Abrindo área de trabalho…</p>;
    const empty=<div className="sw-empty"><h2>Comece por uma análise</h2><p>Selecione um jogo ou treino para registrar e revisar os lances.</p>{props.canCreate!==false?<StudioAction label="Criar análise no estúdio" primary onPress={create}>Nova análise</StudioAction>:null}</div>;
    const content=<div className="sv sw sw-bench" role="region" aria-label="Estúdio de scouting">
        <style>{studioStyles}{workspaceStyles}{scoutingBenchStyles}</style>
        <header className="sw-head"><StudioAction label="Voltar à visão geral do scouting" icon="chevronBack" disabled={manualBusy} onPress={close}/>{layout.isMobile?<StudioAction label="Abrir menu de navegação" icon="align" onPress={()=>window.dispatchEvent(new CustomEvent('goatleta:toggle-sidebar'))}/>:null}<div className="sw-title"><h1>Estúdio <small>{props.teamName}</small></h1><div className="sw-context">{sessionId?<StudioSelect label={mode==='register'||showLiveVideo?'Registro do jogo':'Vídeo do jogo'} value={sessionId} options={options} onChange={value=>{if(mode==='video'&&showLiveVideo){guardManual(()=>guardVideoSource('live',()=>{manualExplicit.current=true;setManualSessionId(value);}));}else changeSession(value);}}/>:<small>Nenhuma análise selecionada</small>}</div></div>
            <div className="sw-task-nav"><ScoutingTabs value={mode} onChange={value=>chooseMode(value as ScoutingWorkspaceMode)} items={[{value:'register',label:'Registrar',id:'sw-tab-register',panelId:'sw-register-panel'},{value:'video',label:'Revisar',id:'sw-tab-video',panelId:'sw-video-panel'}]}/></div>
            <div className="sw-head-actions">{canUseCamera?<><div className="sw-capture-chip" data-tone={workspaceCaptureTone(cameraStatus)} ref={setCameraAnchor}><StudioAction label={captureLabel} expanded={cameraPanelOpen} hasPopup="dialog" onPress={toggleCamera}><span className="sw-capture-dot" aria-hidden="true"/><Text numberOfLines={1} style={{color:'inherit',fontSize:compactUiMetrics.bodyFontSize,lineHeight:compactUiMetrics.bodyLineHeight}}>{captureLabel}</Text></StudioAction></div>
                {cameraControls?.canStart?<StudioAction label="Iniciar gravação no celular" icon="video" primary disabled={cameraControls.busy} onPress={cameraControls.actions.start}>Gravar</StudioAction>:null}
                {cameraControls&&(cameraControls.canPause||cameraControls.canResume||pausePending)?<StudioAction label={cameraControls.canResume||cameraControls.pending==='resume'?'Continuar gravação no celular':'Pausar gravação no celular'} icon={cameraControls.canResume||cameraControls.pending==='resume'?'play':'pause'} disabled={cameraControls.busy} onPress={cameraControls.canResume?cameraControls.actions.resume:cameraControls.actions.pause}/>:null}
                {cameraControls&&(cameraControls.canStop||pausePending||stopPending)?<StudioAction label="Parar gravação no celular" icon="stopRecording" disabled={cameraControls.busy} onPress={cameraControls.actions.stop}/>:null}</>:null}
                <ScoutingWorkspaceMenu canCreate={props.canCreate!==false} disabled={manualBusy} onCreate={create} onFinish={finishAnalysis} canFinish={!!collectorActions?.canFinish} onSources={()=>setInfo('sources')}/>
                <div className="sw-statuses"><StudioAction label={`Registro oficial: ${officialLabel}`} icon={officialLabel==='Salvo'?'checkmark':'document'} onPress={()=>setInfo('official')}><span className="sw-status-label"><Text style={{color:'inherit',fontSize:12,lineHeight:18}}>{officialLabel}</Text></span></StudioAction><span className="sw-finish"><StudioAction label="Encerrar análise sem parar a gravação" disabled={!collectorActions?.canFinish||manualBusy} onPress={finishAnalysis}><Text style={{color:'inherit',fontSize:compactUiMetrics.bodyFontSize,lineHeight:compactUiMetrics.bodyLineHeight}}><span className="sw-finish-full">Encerrar análise</span><span className="sw-finish-short">Encerrar</span></Text></StudioAction></span></div>
            </div>
        </header>
        <div className="sw-actions" aria-label="Ações do vídeo" ref={setToolbarTarget} hidden/>
        <main className={`sw-body${canUseCamera?' sw-has-capture':''}`} data-mode={mode} data-split={splitBench} ref={benchRef as unknown as Ref<HTMLElement>}>
            <section id="sw-register-panel" role="tabpanel" aria-labelledby="sw-tab-register" className="sw-pane sw-register" aria-label="Registrar scouting" hidden={!splitBench&&mode!=='register'} ref={collectorRef as unknown as Ref<HTMLElement>} onFocusCapture={()=>{if(mode!=='register')setMode('register');}} onPointerDownCapture={()=>{if(mode!=='register')setMode('register');}}>
                {liveIntegration.replayState.state==='error'?<p role="alert" className="sv-alert">{liveIntegration.replayState.message}</p>:null}
                {visited.has('register')&&manualSessionId?<ScoutingCollector key={manualSessionId} org={props.org} userId={props.userId} sessionId={manualSessionId} teamName={props.teamName} students={props.students} presentation="embedded" bench active={collecting} keyboardActive={mode==='register'} containerWidth={collectorWidth||layout.contentWidth} captureBridge={canUseCamera?captureBridge:undefined} onDirtyChange={manualDirtyChanged} onBusyChange={manualBusyChanged} onActionsChange={collectorActionsChanged} onClose={close} onSaved={props.onSaved}/>:mode==='register'?empty:null}
            </section>
            <div className="sw-media" data-live={liveMain} data-preview={hasPreview}>
            <section id="sw-video-panel" role="tabpanel" aria-labelledby="sw-tab-video" className="sw-pane sw-video" aria-label="Revisar vídeo" onFocusCapture={()=>{if(mode!=='video')setMode('video');}} onPointerDownCapture={()=>{if(mode!=='video')setMode('video');}}>
                {canUseCamera&&liveIntegration.error?<div className="sv-alert" role="alert">{liveIntegration.error}<StudioAction label="Tentar atualizar lances locais" onPress={()=>liveIntegration.retryTimeline()}>Atualizar</StudioAction><StudioAction label="Voltar a Registrar para sincronizar o ponto" onPress={()=>chooseMode('register')}>Registrar</StudioAction></div>:null}
                <div className="sw-video-live" hidden={!showLiveVideo} ref={node=>{if(node)node.inert=!showLiveVideo;}}>
                    {visited.has('video')&&liveIntegration.recordings.length>0?<Suspense fallback={showLiveVideo?loading:null}><LiveScoutingVideo org={props.org} userId={props.userId} classId={props.classId} sessionId={manualSessionId} teamName={props.teamName} students={props.students} active={active} embedded bench benchPreviewActive={liveMain} keyboardActive={mode==='video'} onBenchStageTarget={showLiveVideo?setPreviewTarget:undefined} onBenchReplayChange={replayChanged} onReturnToLive={hasPreview?returnToLive:undefined} onLeaveGuard={setLiveVideoGuard} onClose={close} recordings={liveIntegration.recordings} selectedRecordingId={selectedRecordingId} onSelectRecording={id=>guardVideoSource('live',()=>setSelectedRecordingId(id))} loadMedia={liveIntegration.loadMedia} revision={liveIntegration.revision} visible={active&&!liveMain&&showLiveVideo} onOtherVideos={()=>guardVideoSource('live',()=>setPreferLive(false))}/></Suspense>:null}
                </div>
                <div className="sw-video-existing" hidden={showLiveVideo} ref={node=>{if(node)node.inert=showLiveVideo;}}>
                    {canUseCamera&&!showLiveVideo&&liveIntegration.recordings.length?<div className="sw-live-return"><StudioAction label="Voltar aos lances da gravação ao vivo" onPress={()=>guardVideoSource('other',()=>setPreferLive(true))}>Gravação da câmera</StudioAction></div>:null}
                    {legacyVideoVisited&&visited.has('video')&&videoSessionId?<Suspense fallback={loading}><VideoStudio key={videoSessionId} embedded bench onCameraSourceTarget={canUseCamera?cameraSourceChanged:undefined} benchPreviewActive={liveMain} keyboardActive={mode==='video'} onBenchStageTarget={!showLiveVideo?setPreviewTarget:undefined} onBenchReplayChange={replayChanged} onReturnToLive={hasPreview?returnToLive:undefined} visible={active&&!liveMain&&!showLiveVideo} active={active} org={props.org} userId={props.userId} classId={props.classId} sessionId={videoSessionId} students={props.students} teamName={props.teamName} onLeaveGuard={setVideoGuard} onLinkedSessionsChange={linkedChanged} onClose={props.onClose}/></Suspense>:!showLiveVideo?liveIntegration.loading||videoSessionId?loading:empty:null}
                </div>
            </section>
            {canUseCamera?<aside className="sw-capture" data-portaled={!!previewTarget} data-available={hasPreview} aria-label="Câmera ao vivo e gravações"><Suspense fallback={null}><LiveCamera key={JSON.stringify([props.userId,props.org,props.classId])} embedded workspace bench presentation={liveMain?'main':'pip'} previewTarget={previewTarget} visible={active} controlsOpen={active&&!cameraSourceTarget&&cameraPanelOpen} controlsTarget={active?cameraSourceTarget:null} libraryOpen={active&&cameraLibraryOpen} controlsAnchor={cameraAnchor?.querySelector<HTMLElement>('[role="button"],button')??cameraAnchor} onControlsOpen={openCamera} onControlsClose={closeCamera} onLibraryClose={closeCameraLibrary} onWorkspaceStatusChange={statusChanged} onWorkspaceControlsChange={controlsChanged} org={props.org} userId={props.userId} classId={props.classId} className={props.teamName} integratedScouting={integratedScouting} onHostApi={liveIntegration.onHostApi} onHostSnapshot={liveIntegration.onHostSnapshot} onLeaveGuard={setCameraGuard} onClose={props.onClose}/></Suspense></aside>:null}
            </div>
        </main>
        {info?<StudioDialog title={info==='official'?'Registro do scouting':info==='video'?'Vídeo no computador':'Fonte do vídeo'} onClose={()=>setInfo(null)}>{info==='official'?<p>{officialLabel==='Salvo'?'Os registros confirmados desta análise estão salvos.':officialLabel==='Confira o registro'?'Há um erro na análise ou no elenco. Confira Registrar antes de continuar.':officialLabel==='Em edição'?'Há uma jogada em edição. Confirme o ponto ou conclua a repetição para registrar.':officialLabel==='Pendente'?'Há um envio pendente. Confira Registrar antes de sair.':officialLabel==='Salvando…'?'Aguarde a confirmação do registro.':'Abra Registrar para conferir a situação da análise.'}</p>:info==='video'?<><p>{cameraStatus?.error??(cameraStatus?.receiving?`Recebendo o original no computador${cameraStatus.copyPercent!==null?`: ${cameraStatus.copyPercent}%`:''}.`:liveIntegration.replayState.state==='recording'?'A câmera continua gravando. Os trechos recebidos já permitem rever os rallies; o original é copiado ao encerrar.':cameraStatus?.label??'Conecte a câmera para gravar e rever lances neste computador.')}</p><StudioAction label="Abrir controles da câmera" icon="video" onPress={()=>{setInfo(null);openCamera();}}>Controles</StudioAction></>:<div className="sw-source-choices">{canUseCamera?<StudioAction label="Conectar câmera pelo seletor de fontes" icon="video" onPress={()=>{setInfo(null);openCamera();}}>Câmera do celular</StudioAction>:null}{canUseCamera?<StudioAction label="Abrir gravações da câmera" icon="gallery" onPress={()=>{setInfo(null);setCameraLibraryOpen(true);}}>Gravações salvas</StudioAction>:null}<StudioAction label="Abrir outros arquivos e links de vídeo" icon="attachment" onPress={openOtherSources}>Arquivos e links</StudioAction></div>}</StudioDialog>:null}
        {creating?<NewScoutingModal overlayZIndex={6101} org={props.org} classId={props.classId} mode={props.mode} onClose={()=>setCreating(false)} onCreated={id=>{setCreating(false);manualExplicit.current=true;setVideoSessionId(id);setManualSessionId(id);setLinkedSources([]);setMode('register');setVisited(old=>new Set<ScoutingWorkspaceMode>([...[...old].filter(value=>value==='camera'),'register']));props.onCreated();}}/>:null}
        {confirmExit?<StudioDialog title="Há uma jogada em edição" onClose={()=>{setConfirmExit(false);pendingManual.current=null;}}><p>Conclua o contato ou os ajustes antes de sair da análise.</p><div className="sv-wrap"><StudioAction label="Voltar à coleta em edição" primary onPress={()=>{setConfirmExit(false);pendingManual.current=null;chooseMode('register');}}>Continuar registro</StudioAction><StudioAction label="Sair sem concluir a edição da coleta" onPress={()=>{setConfirmExit(false);const next=pendingManual.current;pendingManual.current=null;next?.();}}>Sair sem concluir</StudioAction></div></StudioDialog>:null}
    </div>;
    return typeof document==='undefined'?null:<div ref={root} className="sw-page" style={themes} hidden={!active}>
        <ResponsivePage style={{height:'100%',minHeight:0,paddingVertical:layout.density.sectionGap*2}}>{content}</ResponsivePage>
    </div>;
}

const workspaceStyles=`
.sw-page{position:absolute;inset:0;z-index:1;display:flex;min-width:0;min-height:0;background:var(--sv-bg);overflow:hidden}
.sw-page[hidden],.sw .sw-pane[hidden],.sw-actions[hidden]{display:none!important}
.sv.sw{--sw-panel-width:clamp(300px,30vw,340px);position:relative;inset:auto;z-index:auto;display:flex;flex-direction:column;container:scouting-workspace/inline-size;width:100%;height:100%;min-height:0;padding:0;font-size:var(--sw-body);gap:8px}
.sw-source-choices{display:grid;gap:8px}.sw-source-choices>.sv-action{display:block}.sw-source-choices>.sv-action [role=button]{justify-content:flex-start!important}.sw-head{display:flex;align-items:center;gap:8px;flex-shrink:0;min-height:52px;padding-bottom:4px}
.sw-title{flex:1;min-width:0}.sw-title h1{font-size:${compactUiMetrics.titleFontSize}px;line-height:${compactUiMetrics.titleLineHeight}px;margin:0;display:flex;gap:8px;align-items:baseline}.sw-title h1 small{font-size:var(--sw-meta);font-weight:400;color:var(--sv-muted)}
.sw-head>.sv-action:first-child [role=button]{border-radius:50%!important}
.sw-context{display:flex;align-items:center;min-width:0;max-width:640px;min-height:32px}.sw-context>.sv-select{min-width:0;width:100%}.sw-context .sv-select [role=button]{min-width:0;min-height:32px!important;border:0!important;background:transparent!important;padding:0!important;justify-content:flex-start!important}.sw-context .sv-select [role=button]>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sw-context>small{color:var(--sv-muted);font-size:var(--sw-meta)}
.sw-head-actions{display:flex;align-items:center;gap:8px;flex:none}.sw-head-actions .sv-action [role=button]{min-height:44px!important;min-width:44px!important}
.sw-capture-chip [role=button]{background:var(--sv-panel)!important}.sw-capture-chip [role=button]>span:last-child{display:flex;align-items:center;gap:8px;font-size:12px}.sw-capture-dot{display:block;width:6px;height:6px;border-radius:50%;background:var(--sv-muted);flex:none}.sw-capture-chip[data-tone=success] .sw-capture-dot{background:var(--sv-green)}.sw-capture-chip[data-tone=warning] .sw-capture-dot{background:var(--sv-amber)}.sw-capture-chip[data-tone=danger] .sw-capture-dot{background:var(--sw-capture-danger)}
.sw-tools{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-shrink:0;min-height:44px;border-bottom:1px solid var(--sv-line)}
.sw-statuses{display:flex;align-items:center;gap:4px}.sw-statuses .sv-action [role=button]{border:0!important;min-height:44px!important;min-width:44px!important;padding:6px!important}.sw-statuses .sv-action [role=button]>span:last-child{font-size:11px}.sw-finish{border-left:1px solid var(--sv-line);padding-left:8px;margin-left:4px}.sw-finish-short{display:none}
.sw-actions{display:flex;align-items:center;gap:6px;min-width:0;flex-shrink:0;justify-content:flex-end}.sw-actions:empty{display:none}.sw-actions>.sv-embedded-toolbar{border:0!important;min-height:38px!important;padding:0!important;margin:0!important;gap:6px}
.sw-body{flex:1;min-height:0;position:relative;overflow:hidden;display:flex;flex-direction:column;gap:12px}.sw-pane{display:flex;flex:1;min-height:0;height:100%;min-width:0;overflow:hidden}.sw-register{width:100%;flex-direction:column}.sw-register>[role=region]{min-width:0}
.sw-capture{display:none;min-width:0;min-height:0}.sw-body[data-mode=register].sw-has-capture{overflow:auto}.sw-body[data-mode=register]>.sw-register{flex:none;height:auto;overflow:visible}.sw-body[data-mode=register]>.sw-capture{display:block;flex:none}
.sw-empty{flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;text-align:center;gap:12px;padding:24px;min-width:0}.sw-empty h2{font-size:16px}.sw-empty p,.sw-loading{font-size:var(--sw-body);color:var(--sv-muted)}.sw-loading{padding:24px}
.sw-video{flex-direction:column}.sw-video>.sv-alert{margin:0 0 8px}.sw-video-existing,.sw-video-live{display:flex;flex:1;min-width:0;min-height:0;flex-direction:column}.sw-video-existing[hidden],.sw-video-live[hidden]{display:none!important}.sw-live-return{padding-bottom:8px}
.sw .sv.sv-embedded{position:relative;inset:auto;z-index:auto;width:100%;height:100%;min-height:0;flex:1;box-sizing:border-box;padding:0;gap:0}
.sw>.sv-dialog{max-width:440px}.sw .sv .sv-workspace{grid-template-columns:minmax(0,1fr) var(--sw-panel-width);gap:12px;overflow:hidden;min-height:0}
@media(min-width:1024px){
 @container scouting-workspace (min-width:780px){
  .sw-body[data-mode=register].sw-has-capture{display:grid;grid-template-columns:minmax(380px,1fr) minmax(280px,.55fr);gap:16px;overflow:hidden;align-items:stretch}
  .sw-body[data-mode=register].sw-has-capture>.sw-register{height:100%;overflow:hidden}.sw-body[data-mode=register].sw-has-capture>.sw-capture{height:100%;overflow:auto}
 }
}
@media(max-width:1199px){.sw .sv .sv-workspace{grid-template-columns:minmax(0,1fr);grid-template-rows:max-content max-content;overflow:auto;align-content:start}}
@container scouting-workspace (max-width:899px){.sw .sv .sv-workspace{grid-template-columns:minmax(0,1fr);grid-template-rows:max-content max-content;overflow:auto;align-content:start}}
@media(max-width:767px){
 .sw-head{flex-wrap:wrap;min-height:44px;gap:4px}.sw-title{min-width:180px}.sw-title h1 small{display:none}.sw-context{max-width:none}.sw-head-actions{flex-basis:100%;gap:8px;padding-top:4px}.sw-capture-chip{flex:1;min-width:0}.sw-capture-chip>.sv-action{display:block}.sw-capture-chip [role=button]{justify-content:flex-start!important}
 .sw-tools{flex-wrap:nowrap;gap:4px}.sw-statuses{gap:0;margin-left:auto}.sw-status-label{display:none}.sw-statuses .sv-action [role=button]{padding:8px!important}.sw-finish{border:0;padding:0;margin:0}.sw-finish-full{display:none}.sw-finish-short{display:inline}.sw-finish [role=button]{gap:4px!important}.sw-actions{flex-wrap:wrap;justify-content:flex-start;gap:4px}
 .sw-body{overflow:auto}.sw-pane{min-height:0}.sw .sv.sv-embedded{min-height:0}.sw-capture{padding-top:4px}
}
@media(max-width:359px){.sw-finish{display:none}.sw-context{max-width:100%}}
`;
