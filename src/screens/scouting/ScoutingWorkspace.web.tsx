import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useAppTheme } from '../../ui/app-theme';
import { useResponsiveLayout } from '../../ui/use-responsive-layout';
import { compactUiMetrics, radius } from '../../theme/tokens';
import { registerPendingEditsNavigation } from '../../navigation/pending-edits-navigation';
import { markRender, measureAsync } from '../../observability/perf';
import { ScoutingCollector } from './ScoutingCollector';
import { ScoutingTabs } from './ScoutingNavigation';
import { NewScoutingModal } from './NewScoutingModal';
import { shortDate } from './ScoutingUI';
import { liveLocalAvailable } from './live/live-api';
import { StudioAction, StudioDialog } from './video/StudioUI.web';
import { StudioSelect } from './video/StudioSelect.web';
import { studioStyles } from './video/studio-styles';
import type { ScoutingWorkspaceMode, ScoutingWorkspaceProps } from './ScoutingWorkspace.types';

const VideoStudio=lazy(()=>measureAsync('screen.scouting.workspace.load.video',()=>import('./video/ScoutingVideoStudio.web')));
const LiveCamera=lazy(()=>measureAsync('screen.scouting.workspace.load.camera',()=>import('./live/ScoutingLive.web')));
type LeaveGuard=(next:()=>void)=>void;
type LinkedSource={id:string;title:string;date:string};

/** A single owner for navigation and focus. Hidden tools stay mounted. */
export default function ScoutingWorkspace(props:ScoutingWorkspaceProps) {
    markRender('screen.scouting.workspace.render.web');
    const {colors}=useAppTheme(),layout=useResponsiveLayout();
    const active=props.active!==false,canUseCamera=liveLocalAvailable();
    const initialMode=props.initialMode==='camera'&&!canUseCamera?'video':props.initialMode??'video';
    const [mode,setMode]=useState<ScoutingWorkspaceMode>(initialMode);
    const initialId=props.initialSessionId??props.rows[0]?.session.id??'';
    const [videoSessionId,setVideoSessionId]=useState(initialId),[manualSessionId,setManualSessionId]=useState(initialId);
    const [linkedSources,setLinkedSources]=useState<LinkedSource[]>([]);
    const [visited,setVisited]=useState(()=>new Set<ScoutingWorkspaceMode>([initialMode]));
    const [creating,setCreating]=useState(false),[confirmExit,setConfirmExit]=useState(false);
    const [toolbarTarget,setToolbarTarget]=useState<HTMLDivElement|null>(null);
    const [manualDirty,setManualDirty]=useState(false),[manualBusy,setManualBusy]=useState(false);
    const manualExplicit=useRef(false),dirtyRef=useRef(manualDirty),busyRef=useRef(manualBusy),videoIdRef=useRef(videoSessionId);
    useLayoutEffect(()=>{dirtyRef.current=manualDirty;busyRef.current=manualBusy;videoIdRef.current=videoSessionId;},[manualDirty,manualBusy,videoSessionId]);
    const manualDirtyChanged=useCallback((value:boolean)=>{dirtyRef.current=value;setManualDirty(value);},[]);
    const manualBusyChanged=useCallback((value:boolean)=>{busyRef.current=value;setManualBusy(value);},[]);
    const linkedChanged=useCallback((sources:LinkedSource[])=>{
        if(videoIdRef.current!==videoSessionId)return;
        setLinkedSources(old=>JSON.stringify(old)===JSON.stringify(sources)?old:sources);
        if(!manualExplicit.current&&!dirtyRef.current&&!busyRef.current&&sources.length)setManualSessionId(current=>sources.some(source=>source.id===current)?current:sources[0].id);
    },[videoSessionId]);
    const root=useRef<HTMLDivElement|null>(null),videoGuard=useRef<LeaveGuard|null>(null),cameraGuard=useRef<LeaveGuard|null>(null);
    const pendingManual=useRef<(()=>void)|null>(null),requestNavigation=useRef<LeaveGuard>(()=>{});
    const setVideoGuard=useCallback((guard:LeaveGuard|null)=>{videoGuard.current=guard;},[]);
    const setCameraGuard=useCallback((guard:LeaveGuard|null)=>{cameraGuard.current=guard;},[]);
    const chooseMode=(next:ScoutingWorkspaceMode)=>{setVisited(old=>new Set([...old,next]));setMode(next);};
    // Toolbar children arrive through a portal; listen on its DOM container so
    // their dialogs open in the visible video pane, regardless of React ancestry.
    useEffect(()=>{
        if(!toolbarTarget?.addEventListener)return;
        const reveal=(event:MouseEvent)=>{if(mode!=='video'&&!(event.target as HTMLElement).closest?.('[aria-disabled="true"],[disabled]')){setVisited(old=>new Set([...old,'video' as const]));setMode('video');}};
        toolbarTarget.addEventListener('click',reveal,true);
        return()=>toolbarTarget.removeEventListener('click',reveal,true);
    },[toolbarTarget,mode]);
    const afterContentGuard=(next:()=>void)=>{
        if(videoGuard.current){const previous=mode;setMode('video');videoGuard.current(()=>{setMode(previous);next();});}else next();
    };
    const guardManual=(next:()=>void)=>{
        if(manualBusy)return;
        if(manualDirty){pendingManual.current=next;setConfirmExit(true);}
        else next();
    };
    const guardContent=(next:()=>void)=>guardManual(()=>afterContentGuard(next));
    const leave=(next:()=>void)=>guardContent(()=>{
        if(cameraGuard.current){setMode('camera');cameraGuard.current(next);}else next();
    });
    useLayoutEffect(()=>{requestNavigation.current=leave;});
    useEffect(()=>{
        if(!active||typeof document==='undefined')return;
        const app=document.getElementById('root'),previousInert=app?.inert,previousFocus=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
        if(app)app.inert=true;
        document.body.style.overflow='hidden';
        root.current?.querySelector<HTMLElement>('[role="button"]')?.focus();
        const trap=(event:KeyboardEvent)=>{
            const node=root.current;if(event.key!=='Tab'||!node||document.querySelector('dialog[open]'))return;
            if([...document.querySelectorAll('[aria-modal="true"]')].some(modal=>modal!==node&&modal.getClientRects().length>0))return;
            const items=[...node.querySelectorAll<HTMLElement>('button,[role="button"],[role="tab"],[href],input,textarea,select,[tabindex="0"]')].filter(item=>!item.closest('[inert]')&&!item.hasAttribute('disabled')&&item.getAttribute('aria-disabled')!=='true'&&item.getClientRects().length>0);
            const first=items[0],last=items.at(-1);if(!first||!last)return;
            if(event.shiftKey&&(document.activeElement===first||!node.contains(document.activeElement))){event.preventDefault();last.focus();}
            else if(!event.shiftKey&&(document.activeElement===last||!node.contains(document.activeElement))){event.preventDefault();first.focus();}
        };
        document.addEventListener('keydown',trap,true);
        return()=>{document.removeEventListener('keydown',trap,true);if(app)app.inert=previousInert??false;document.body.style.overflow=overflow;previousFocus?.focus();};
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
            guardManual(()=>{manualExplicit.current=true;setManualSessionId(next);setManualDirty(false);});return;
        }
        if(next===videoSessionId)return;
        guardContent(()=>{manualExplicit.current=false;setVideoSessionId(next);setManualSessionId(next);setLinkedSources([]);setMode('video');setManualDirty(false);setVisited(old=>new Set<ScoutingWorkspaceMode>([...[...old].filter(value=>value==='camera'),'video']));});
    };
    const create=()=>{if(props.canCreate!==false)guardContent(()=>setCreating(true));};
    const sessionId=mode==='register'?manualSessionId:videoSessionId;
    const sourceOptions=mode==='register'&&linkedSources.length?linkedSources:props.rows.map(row=>row.session);
    const options=sourceOptions.map(source=>({value:source.id,label:`${source.title} · ${shortDate(source.date)}`}));
    if(sessionId&&!options.some(option=>option.value===sessionId))options.unshift({value:sessionId,label:props.rows.find(row=>row.session.id===sessionId)?.session.title??'Análise selecionada'});
    const themes={
        '--sv-bg':colors.background,'--sv-panel':colors.card,'--sv-input':colors.inputBg,'--sv-text':colors.text,'--sv-muted':colors.muted,
        '--sv-line':colors.border,'--sv-green':colors.primaryBg,'--sv-primary-text':colors.primaryText,'--sv-amber':colors.warning,
        '--sw-body':`${layout.density.bodyFontSize}px`,'--sw-meta':`${layout.density.metadataFontSize}px`,'--sw-radius':`${radius.card}px`,
    } as CSSProperties;
    const close=()=>leave(props.onClose);
    const loading=<p className="sw-loading" role="status">Abrindo área de trabalho…</p>;
    const empty=<div className="sw-empty"><h2>Comece por uma análise</h2><p>Selecione um jogo ou treino para registrar e revisar os lances.</p>{props.canCreate!==false?<StudioAction label="Criar análise no estúdio" primary onPress={create}>Nova análise</StudioAction>:null}</div>;
    const content=<div ref={root} className="sv sw" style={themes} role="dialog" aria-modal="true" aria-label="Estúdio de scouting" hidden={!active}>
        <style>{studioStyles}{workspaceStyles}</style>
        <header className="sw-head"><StudioAction label="Voltar à visão geral do scouting" icon="chevronBack" disabled={manualBusy} onPress={close}/><div className="sw-title"><h1>Estúdio</h1><small>{props.teamName}</small></div>
            {props.canCreate!==false?<StudioAction label="Nova análise no estúdio" icon="add" disabled={manualBusy} onPress={create}>Nova análise</StudioAction>:null}
            <div className="sw-actions" aria-label="Ações do vídeo" ref={setToolbarTarget}/>
            {!visited.has('video')?<div className="sw-video-placeholder" aria-label="Ações do vídeo"><StudioAction label="Compartilhar análise — abra o vídeo" icon="share" disabled onPress={()=>{}}/><StudioAction label="Salvar rascunho — abra o vídeo" icon="save" disabled onPress={()=>{}}/><StudioAction label="Adicionar vídeo" icon="video" onPress={()=>chooseMode('video')}/></div>:null}
        </header>
        <div className="sw-tools"><ScoutingTabs value={mode} onChange={value=>chooseMode(value as ScoutingWorkspaceMode)} items={[{value:'register',label:'Registrar'},{value:'video',label:'Vídeo'},...(canUseCamera?[{value:'camera',label:'Câmera'}]:[])]}/>
            <div className="sw-context">{mode==='camera'?<small className="sw-camera-context">Câmera do celular</small>:sessionId?<StudioSelect label={mode==='register'?'Registro do jogo':'Vídeo do jogo'} value={sessionId} options={options} onChange={changeSession}/>:<small>Nenhuma análise selecionada</small>}</div>
        </div>
        <main className="sw-body">
            <section className="sw-pane sw-register" aria-label="Registrar scouting" hidden={mode!=='register'} ref={node=>{if(node)node.inert=mode!=='register';}}>
                {visited.has('register')&&manualSessionId?<ScoutingCollector key={manualSessionId} org={props.org} userId={props.userId} sessionId={manualSessionId} students={props.students} presentation="embedded" active={active&&mode==='register'} containerWidth={layout.contentWidth} onDirtyChange={manualDirtyChanged} onBusyChange={manualBusyChanged} onClose={close} onSaved={props.onSaved}/>:mode==='register'?empty:null}
            </section>
            <section className="sw-pane" aria-label="Revisar vídeo" hidden={mode!=='video'} ref={node=>{if(node)node.inert=mode!=='video';}}>
                {visited.has('video')&&videoSessionId?<Suspense fallback={loading}><VideoStudio key={videoSessionId} embedded toolbarTarget={toolbarTarget} visible={active&&mode==='video'} active={active} org={props.org} userId={props.userId} classId={props.classId} sessionId={videoSessionId} students={props.students} teamName={props.teamName} onLeaveGuard={setVideoGuard} onLinkedSessionsChange={linkedChanged} onClose={props.onClose}/></Suspense>:mode==='video'?empty:null}
            </section>
            {canUseCamera?<section className="sw-pane" aria-label="Câmera do celular" hidden={mode!=='camera'} ref={node=>{if(node)node.inert=mode!=='camera';}}>
                {visited.has('camera')?<Suspense fallback={loading}><LiveCamera embedded visible={active&&mode==='camera'} org={props.org} userId={props.userId} classId={props.classId} className={props.teamName} onLeaveGuard={setCameraGuard} onClose={props.onClose}/></Suspense>:null}
            </section>:null}
        </main>
        {creating?<NewScoutingModal overlayZIndex={6101} org={props.org} classId={props.classId} mode={props.mode} onClose={()=>setCreating(false)} onCreated={id=>{setCreating(false);manualExplicit.current=true;setVideoSessionId(id);setManualSessionId(id);setLinkedSources([]);setMode('register');setVisited(old=>new Set<ScoutingWorkspaceMode>([...[...old].filter(value=>value==='camera'),'register']));props.onCreated();}}/>:null}
        {confirmExit?<StudioDialog title="Há uma jogada em edição" onClose={()=>{setConfirmExit(false);pendingManual.current=null;}}><p>Conclua o contato ou os ajustes antes de sair da análise.</p><div className="sv-wrap"><StudioAction label="Voltar à coleta em edição" primary onPress={()=>{setConfirmExit(false);pendingManual.current=null;chooseMode('register');}}>Continuar registro</StudioAction><StudioAction label="Sair sem concluir a edição da coleta" onPress={()=>{setConfirmExit(false);const next=pendingManual.current;pendingManual.current=null;next?.();}}>Sair sem concluir</StudioAction></div></StudioDialog>:null}
    </div>;
    return typeof document==='undefined'?null:createPortal(content,document.body);
}

const workspaceStyles=`
.sw{--sw-panel-width:clamp(300px,30vw,340px);font-size:var(--sw-body);gap:8px}
.sw[hidden],.sw .sw-pane[hidden]{display:none!important}
.sw-head{display:flex;align-items:center;gap:8px;flex-shrink:0;min-height:48px;border-bottom:1px solid var(--sv-line);padding:0 0 8px}
.sw-title{flex:1;min-width:0}.sw-title h1{font-size:${compactUiMetrics.titleFontSize}px;line-height:${compactUiMetrics.titleLineHeight}px;margin:0}
.sw-title small{font-size:var(--sw-meta);color:var(--sv-muted)}
.sw-head>.sv-action:first-child [role=button]{border-radius:50%!important}
.sw-tools{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-shrink:0;min-height:44px}
.sw-context{display:flex;align-items:center;min-width:0;width:min(440px,60%);min-height:44px}
.sw-context>.sv-select{min-width:0;width:100%}.sw-context .sv-select [role=button]{min-width:0}
.sw-context .sv-select [role=button]>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sw-context>small{color:var(--sv-muted);font-size:var(--sw-meta)}
.sw-body{flex:1;min-height:0;position:relative;overflow:hidden}.sw-pane{display:flex;min-height:0;height:100%;min-width:0;overflow:hidden}
.sw-register{width:100%}.sw-empty{flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;text-align:center;gap:12px;padding:24px;min-width:0}
.sw-empty h2{font-size:16px}.sw-empty p,.sw-loading{font-size:var(--sw-body);color:var(--sv-muted)}.sw-loading{padding:24px}
.sw .sv.sv-embedded{position:relative;inset:auto;z-index:auto;width:100%;height:100%;min-height:0;flex:1;box-sizing:border-box;padding:0;gap:0}
.sw>.sv-dialog{max-width:440px}.sw .sw-register>[role=region]{min-width:0}
.sw-actions,.sw-video-placeholder{display:flex;align-items:center;gap:6px;min-width:0}
.sw-actions:empty{display:none}.sw-actions>.sv-embedded-toolbar{border:0!important;min-height:38px!important;padding:0!important;margin:0!important;gap:6px}
.sw .sv .sv-workspace,.sw .sv-live-workspace{grid-template-columns:minmax(0,1fr) var(--sw-panel-width);gap:12px;overflow:hidden;min-height:0}
.sw .sv-live.sv-embedded>.sv-embedded-toolbar{display:none}
.sw .sv-live-main{min-height:0;gap:0}.sw .sv-live .sv-stage{min-height:180px;border-radius:10px}
.sw .sv-live-inspector{border-radius:12px;padding:12px;gap:16px}.sw .sv-live-inspector[data-connected=false]{align-self:start}
.sw .sv-live-inspector>section,.sw .sv-live-inspector>details{gap:8px}
.sw .sv-live-inspector>section+section{padding-top:16px}
.sw .sv-live h2{font-size:12px;line-height:18px}.sw .sv-live p{font-size:11px;line-height:16px}
.sw .sv-live-placeholder{gap:6px}.sw .sv-live-placeholder h2{font-size:14px}
.sw .sv-live-score{gap:16px}.sw .sv-live-score strong{font-size:24px;line-height:30px}
.sw .sv-live-recording{margin-top:10px;padding:8px 0;border:0;border-radius:0;min-height:38px;font-size:11px}
.sw .sv-live-connect-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.sw .sv-live-connect-actions>.sv-action{max-width:100%}
.sw .sv-live-certificate{margin-top:4px}.sw .sv-live-certificate summary{cursor:pointer;font-size:11px;color:var(--sv-muted)}
.sw .sv-live-certificate p{margin-top:8px}
@media(max-width:899px){
 .sw .sv .sv-workspace,.sw .sv-live-workspace{grid-template-columns:minmax(0,1fr);overflow:auto;align-content:start}
 .sw .sv-live-main{min-height:0}.sw .sv-live .sv-stage{height:auto;aspect-ratio:16/9;flex:none;min-height:180px}
 .sw .sv-live-inspector{overflow:visible}.sw .sv-live-recording{margin-bottom:10px}
}
@media(max-width:767px){
 .sw-head{min-height:44px;gap:6px}.sw-head>.sv-action:not(:first-child) [role=button]{padding:6px!important;gap:3px!important}
 .sw-head>.sv-action:not(:first-child) [role=button]>span:last-child{font-size:11px}
 .sw-title h1{font-size:14px}.sw-title small{display:none}
 .sw-tools{flex-wrap:wrap;gap:4px}.sw-context{width:100%;padding-bottom:4px}
 .sw-body{overflow:auto}.sw-pane{min-height:0}.sw-actions,.sw-video-placeholder{gap:3px}
}
`;
