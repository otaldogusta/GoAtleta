import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { assertSessionIdentity, getSessionIdentity } from '../../../auth/session';
import { createClientId } from '../../../core/client-id';
import type { VideoDocument, VideoMedia } from '../../../core/scouting-video';
import type { LocalStudioDraft } from '../video/local-studio-types';
import { getVideoDraft, persistVideoDraft } from '../video/video-draft-storage';
import type { LiveHostScope } from './live-storage';
import type { LiveTimelineRecording } from './live-scouting-contract';
import { changeLiveVideoDocument, editLiveVideoDraft, liveVideoDraftKey, liveVideoHistory, liveVideoSourceContacts, mergeLiveVideoRally, newLiveVideoDraft, parseLiveVideoDraft, reconcileLiveVideoDraft, resizeLiveVideoRally, serializeLiveVideoDraft, splitLiveVideoRally, undoLiveVideoDraft, type LiveVideoDraftMediaInfo, type LiveVideoDraftOwner, type LiveVideoDraftState } from './live-video-draft';
export type { LiveVideoDraftMediaInfo } from './live-video-draft';

type Context={key:string;token:object;alive:boolean;state:LiveVideoDraftState|null;saved:string;error:string;loading:boolean;task:Promise<boolean>|null;blocked:boolean};
const empty=(key:string,token:object={}):Context=>({key,token,alive:true,state:null,saved:'',error:'',loading:!!key,task:null,blocked:false});
const LOCAL_ERROR='Não foi possível salvar neste computador. Mantenha o estúdio aberto e tente novamente.';

/** This hook has no cloud API dependency. Its storage namespace is never scanned by the legacy editor. */
export function useLiveVideoDraft(scope:LiveHostScope,analysisSessionId:string,recording:LiveTimelineRecording|null,mediaInfo:LiveVideoDraftMediaInfo):LocalStudioDraft {
    const hostSessionId=recording?.hostSessionId,recordingId=recording?.recordingId;
    const owner=useMemo<LiveVideoDraftOwner|null>(()=>hostSessionId&&recordingId?{userId:scope.userId,org:scope.org,classId:scope.classId,analysisSessionId,hostSessionId,recordingId}:null,[scope.userId,scope.org,scope.classId,analysisSessionId,hostSessionId,recordingId]);
    const key=owner?liveVideoDraftKey(owner):'',token=useMemo(()=>({key}),[key]),context=useRef<Context>(empty(key,token));
    const inputs=useRef({recording,mediaInfo});useLayoutEffect(()=>{inputs.current={recording,mediaInfo};},[recording,mediaInfo]);
    const [view,setView]=useState<Context>(()=>empty(key,token));
    const current=useCallback((ctx:Context)=>ctx.alive&&context.current===ctx&&ctx.key===key,[key]);
    const auth=useCallback(()=>{const identity=getSessionIdentity();assertSessionIdentity(identity);if(identity.userId!==scope.userId)throw new Error('A conta mudou. Abra o estúdio novamente.');return identity;},[scope.userId]);
    const publish=useCallback((ctx:Context)=>{if(current(ctx))setView({...ctx});},[current]);
    useLayoutEffect(()=>{const ctx=empty(key,token);context.current=ctx;return()=>{ctx.alive=false;};},[key,token]);
    useEffect(()=>{
        const ctx=context.current;if(!owner||!key)return;let alive=true;
        void(async()=>{try{
            const identity=auth(),raw=await getVideoDraft(key);assertSessionIdentity(identity);if(!alive||!current(ctx))return;
            const latest=inputs.current;
            if(!latest.recording)return;
            const saved=raw?parseLiveVideoDraft(raw,owner):null;
            ctx.state=saved?reconcileLiveVideoDraft(saved,latest.recording,latest.mediaInfo):newLiveVideoDraft(owner,latest.recording,latest.mediaInfo);ctx.saved=saved?serializeLiveVideoDraft(saved):'';
        }catch(error){if(current(ctx)){ctx.error=error instanceof Error?error.message:'Não foi possível abrir o rascunho local.';ctx.blocked=true;}}
        finally{if(alive&&current(ctx)){ctx.loading=false;publish(ctx);}}})();
        return()=>{alive=false;};
        // Source snapshots change without opening/replacing this owned document.
    },[key,owner,auth,current,publish]);
    useEffect(()=>{
        const ctx=context.current;if(!ctx.state||ctx.loading||ctx.blocked||!recording||!current(ctx))return;
        try{auth();const next=reconcileLiveVideoDraft(ctx.state,recording,mediaInfo);if(serializeLiveVideoDraft(next)!==serializeLiveVideoDraft(ctx.state)){ctx.state=next;publish(ctx);}}
        catch(error){ctx.error=error instanceof Error?error.message:'Não foi possível atualizar os lances locais.';publish(ctx);}
    },[recording,mediaInfo,current,publish,auth]);
    const save=useCallback(async():Promise<boolean>=>{
        const ctx=context.current;if(!current(ctx)||!ctx.state||ctx.loading||ctx.blocked)return false;if(ctx.task)return ctx.task;
        const work=async()=>{try{
            const identity=auth(),state=ctx.state!,raw=serializeLiveVideoDraft(state);
            if(!current(ctx))return false;await persistVideoDraft(ctx.key,raw);assertSessionIdentity(identity);
            if(!current(ctx))return false;ctx.saved=raw;ctx.error='';publish(ctx);return true;
        }catch{if(current(ctx)){ctx.error=LOCAL_ERROR;publish(ctx);}return false;}};
        const task=work();ctx.task=task;publish(ctx);
        try{return await task;}finally{if(ctx.task===task){ctx.task=null;publish(ctx);}}
    },[auth,current,publish]);
    const changeState=useCallback((mutate:(state:LiveVideoDraftState)=>LiveVideoDraftState)=>{
        const ctx=context.current;if(!ctx.state||ctx.loading||ctx.blocked||!current(ctx))return;
        try{auth();ctx.state=mutate(ctx.state);ctx.error='';publish(ctx);}catch(error){ctx.error=error instanceof Error?error.message:'Não foi possível editar o recorte.';publish(ctx);}
    },[auth,current,publish]);
    const change=useCallback((document:VideoDocument,label:string)=>changeState(state=>changeLiveVideoDocument(state,document,label)),[changeState]);
    const undo=useCallback((redo=false)=>changeState(state=>undoLiveVideoDraft(state,redo)),[changeState]);
    const resizeRally=useCallback((id:string,start:number,end:number)=>changeState(state=>resizeLiveVideoRally(state,id,start,end)),[changeState]);
    const splitRally=useCallback((time:number,rallyId?:string|null)=>changeState(state=>splitLiveVideoRally(state,time,createClientId(),rallyId)),[changeState]);
    const mergeRally=useCallback((id:string)=>changeState(state=>mergeLiveVideoRally(state,id)),[changeState]);
    const setError=useCallback((error:string)=>{const ctx=context.current;if(current(ctx)){ctx.error=error;publish(ctx);}},[current,publish]);
    const open=useCallback(async(media:VideoMedia)=>{const ctx=context.current;if(!ctx.state||!current(ctx))return;auth();if(media.fingerprint!==ctx.state.present.document.media.fingerprint)throw new Error('Este vídeo pertence a outra gravação.');},[auth,current]);
    const exportLocal=useCallback(()=>{const ctx=context.current;try{auth();return current(ctx)&&ctx.state?serializeLiveVideoDraft(ctx.state):null;}catch{return null;}},[auth,current]);
    const importLocal=useCallback(async(raw:string)=>{
        const ctx=context.current;if(!owner||!ctx.state||ctx.loading||ctx.blocked||!current(ctx))return false;
        try{auth();const incoming=parseLiveVideoDraft(raw,owner);if(ctx.task)await ctx.task;auth();if(!current(ctx)||!ctx.state)return false;
            // Import is one undoable edit; receipts include both versions so later DVR ticks cannot resurrect deleted rows.
            const next=editLiveVideoDraft({...ctx.state,knownIds:[...new Set([...ctx.state.knownIds,...incoming.knownIds])]},incoming.present,'Importação do rascunho local');
            ctx.state=next;ctx.error='';publish(ctx);return await save();
        }catch(error){if(current(ctx)){ctx.error=error instanceof Error?error.message:'Não foi possível importar o rascunho local.';publish(ctx);}return false;}
    },[auth,current,owner,publish,save]);
    const visible=view.key===key&&view.token===token?view:empty(key,token),state=visible.state;
    const raw=state?serializeLiveVideoDraft(state):'',dirty=!!state&&raw!==visible.saved;
    useEffect(()=>{if(!dirty||visible.loading||visible.task||visible.error)return;const timer=setTimeout(()=>{void save();},500);return()=>clearTimeout(timer);},[dirty,visible.loading,visible.task,visible.error,raw,save]);
    const presentation=useMemo(()=>state&&recording?liveVideoSourceContacts(state,recording):{ranges:{},sourceContacts:[],pendingCount:0},[state,recording]);
    const resolveConflict=useCallback(async()=>false,[]);
    return {history:state?liveVideoHistory(state):null,doc:state?.present.document??null,open,change,undo,save,retrySync:save,resolveConflict,
        saving:!!visible.task,loading:visible.loading,syncStatus:visible.error?'error':dirty?'pending':'synced',conflict:null,error:visible.error,syncErrorCode:null,setError,dirty,
        ...presentation,resizeRally,splitRally,mergeRally,importLocal,exportLocal};
}
