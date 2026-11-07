import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ScoutingVideoStudio from '../video/ScoutingVideoStudio.web';
import type { StudioProps } from '../video/types';
import type { LocalStudioSource } from '../video/local-studio-types';
import type { LiveRecordingReference, LiveReplayMedia, LiveTimelineClip, LiveTimelineRecording } from './live-scouting-contract';
import { validReplayMedia } from './live-replay-presentation';
import { useLiveVideoDraft, type LiveVideoDraftMediaInfo } from './use-live-video-draft';
import { scoutingActionFundamentals } from '../../../core/scouting';
import { markRender, measureAsync } from '../../../observability/perf';

export type LiveScoutingVideoProps=Pick<StudioProps,'org'|'userId'|'classId'|'sessionId'|'teamName'|'students'|'active'|'embedded'|'visible'|'bench'|'benchPreviewActive'|'keyboardActive'|'onReturnToLive'|'onBenchReplayChange'|'onBenchStageTarget'|'toolbarTarget'|'onLeaveGuard'|'onClose'> & {
    recordings:LiveTimelineRecording[];selectedRecordingId?:string;onSelectRecording:(recordingId:string)=>void;
    loadMedia:(reference:LiveRecordingReference,clip?:LiveTimelineClip)=>Promise<LiveReplayMedia|null>;
    revision:number;onOtherVideos:()=>void;
};
type Resource={owner:string;url:string;media:LiveReplayMedia;file:File|null};
type Pending={owner:string;clipKey:string;token:number;media:LiveReplayMedia;force:boolean};
type Metadata={url:string;durationSeconds:number;width:number;height:number};

/** Own local source lifetimes; editing, playback and layout belong to the canonical studio. */
export default function LiveScoutingVideo(props:LiveScoutingVideoProps){
    const recordings=props.recordings.filter(value=>value.analysisSessionId===props.sessionId);
    const recording=recordings.find(value=>value.recordingId===props.selectedRecordingId)??recordings[0]??null;
    const identity=JSON.stringify([props.userId,props.org,props.classId,props.sessionId,recording?.hostSessionId??'',recording?.recordingId??'']);
    return <LocalReplayStudio key={identity} {...props} recordings={recordings} recording={recording} identity={identity}/>;
}
function LocalReplayStudio(props:LiveScoutingVideoProps&{recording:LiveTimelineRecording|null;identity:string}){
    markRender('screen.scoutingLiveReplay.render.web');
    const {recording,identity:owner,recordings,onSelectRecording}=props;
    const scope=useMemo(()=>({userId:props.userId,org:props.org,classId:props.classId}),[props.userId,props.org,props.classId]);
    const [selectedRally,setSelectedRally]=useState<string|null>(()=>recording?.clips.find(value=>value.active)?.id??null);
    const clip=recording?.clips.find(value=>value.active&&value.id===selectedRally)??null;
    const clipKey=JSON.stringify([owner,selectedRally]);
    const [resource,setResource]=useState<Resource|null>(null),[metadata,setMetadata]=useState<Metadata|null>(null);
    const [loading,setLoading]=useState(false),[error,setError]=useState(''),[refreshVersion,setRefreshVersion]=useState(0);
    const alive=useRef(true),currentResource=useRef<Resource|null>(null),loadEpoch=useRef(0),playing=useRef(false),exporting=useRef(false);
    const current=useRef({owner,clipKey,recording,clip,loadMedia:props.loadMedia,visible:props.visible!==false&&props.active!==false});
    const pending=useRef<Pending|null>(null),inFlight=useRef<{key:string;token:number;again:boolean}|null>(null),handledRefresh=useRef(0);
    useLayoutEffect(()=>{current.current={owner,clipKey,recording,clip,loadMedia:props.loadMedia,visible:props.visible!==false&&props.active!==false};});
    const commit=useCallback((value:Pending)=>{
        if(!alive.current||value.owner!==current.current.owner||value.clipKey!==current.current.clipKey||value.token!==loadEpoch.current)return;
        const old=currentResource.current;
        if(!value.force&&old?.owner===value.owner&&old.media.blob===value.media.blob)return;
        try{
            const name=`go-atleta-${current.current.recording!.recordingId}.${value.media.blob.type.includes('mp4')?'mp4':'webm'}`;
            const file=typeof File==='undefined'?null:new File([value.media.blob],name,{type:value.media.blob.type});
            const next={owner:value.owner,url:URL.createObjectURL(value.media.blob),media:value.media,file};
            currentResource.current=next;setResource(next);setMetadata(null);setError('');if(old)URL.revokeObjectURL(old.url);
        }catch{setError('Não foi possível abrir o vídeo local. Tente atualizar.');}
    },[]);
    const applyPending=useCallback(()=>{if(playing.current||exporting.current)return;const value=pending.current;pending.current=null;if(value)commit(value);},[commit]);
    const clearResource=useCallback(()=>{
        pending.current=null;playing.current=false;exporting.current=false;
        const old=currentResource.current;currentResource.current=null;setResource(null);setMetadata(null);if(old)URL.revokeObjectURL(old.url);
    },[]);
    useEffect(()=>{
        alive.current=true;
        return()=>{alive.current=false;pending.current=null;inFlight.current=null;const old=currentResource.current;currentResource.current=null;if(old)URL.revokeObjectURL(old.url);};
    },[]);
    useEffect(()=>{
        if(props.visible===false||props.active===false){playing.current=false;applyPending();}
    },[props.visible,props.active,applyPending]);
    useEffect(()=>{
        const target=current.current,key=JSON.stringify([target.owner,target.clipKey,refreshVersion]);
        if(!target.visible){if(inFlight.current)inFlight.current.again=false;return;}
        if(!target.recording)return;
        if(inFlight.current?.key===key){inFlight.current.again=true;return;}
        const token=++loadEpoch.current,task={key,token,again:false};inFlight.current=task;
        let force=refreshVersion!==handledRefresh.current;handledRefresh.current=refreshVersion;
        const resetError=force||!currentResource.current;
        const valid=()=>alive.current&&inFlight.current===task&&token===loadEpoch.current&&target.owner===current.current.owner&&target.clipKey===current.current.clipKey;
        void Promise.resolve().then(()=>{if(valid()){setLoading(true);if(resetError)setError('');}});
        const run=()=>{
            task.again=false;const forceDecoder=force;force=false;
            const request=current.current,reference={hostSessionId:target.recording!.hostSessionId,recordingId:target.recording!.recordingId};
            void measureAsync('screen.scoutingLiveReplay.load.media',()=>request.loadMedia(reference,request.clip??undefined)).then(media=>{
                if(!valid())return;
                if(!media){clearResource();return;}
                if(!validReplayMedia(media))throw new Error('A prévia local está indisponível. Tente atualizar.');
                const old=currentResource.current;
                if(!forceDecoder&&old?.owner===target.owner&&old.media.offsetMs===media.offsetMs&&old.media.availableUntilMs===media.availableUntilMs&&old.media.original===media.original)return;
                const value={owner:target.owner,clipKey:target.clipKey,token,media:{...media},force:forceDecoder};
                if(playing.current||exporting.current)pending.current=value;else commit(value);
            }).catch(failure=>{if(valid()){
                if(failure instanceof Error&&failure.name==='SessionIdentityChangedError')clearResource();
                setError(failure instanceof Error?failure.message:'Não foi possível abrir o vídeo local.');
            }}).finally(()=>{if(!valid())return;setLoading(false);if(task.again&&current.current.visible){run();return;}inFlight.current=null;});
        };
        run();
    },[owner,clipKey,props.revision,props.visible,props.active,refreshVersion,commit,clearResource]);

    const visibleResource=resource?.owner===owner?resource:null;
    const actual=metadata?.url===visibleResource?.url?metadata:null;
    const offsetSeconds=(visibleResource?.media.offsetMs??0)/1000;
    const decodedEnd=actual?offsetSeconds+actual.durationSeconds:null;
    const availableUntilSeconds=visibleResource?decodedEnd!==null?visibleResource.media.original?decodedEnd:Math.min(visibleResource.media.availableUntilMs/1000,decodedEnd):visibleResource.media.availableUntilMs/1000:0;
    const mediaInfo=useMemo<LiveVideoDraftMediaInfo>(()=>({durationSeconds:decodedEnd,width:actual?.width??null,height:actual?.height??null,
        offsetMs:visibleResource?.media.offsetMs,availableUntilMs:availableUntilSeconds*1000,original:visibleResource?.media.original??false}),[decodedEnd,actual?.width,actual?.height,visibleResource?.media.offsetMs,visibleResource?.media.original,availableUntilSeconds]);
    const draft=useLiveVideoDraft(scope,props.sessionId,recording,mediaInfo);
    const rallyMetadata=useMemo(()=>{
        const clips=recording?.clips.filter(value=>value.active)??[],byContact=new Map<string,LiveTimelineClip>(),byRally=new Map<string,Set<LiveTimelineClip>>();
        for(const value of clips){byRally.set(value.id,new Set([value]));for(const mark of value.contacts)byContact.set(mark.actionId??`${value.id}:${mark.id}`,value);}
        for(const contact of draft.sourceContacts){const source=byContact.get(contact.id);if(source){const values=byRally.get(contact.rallyId)??new Set<LiveTimelineClip>();values.add(source);byRally.set(contact.rallyId,values);}}
        return Object.fromEntries((draft.doc?.rallies??[]).map(rally=>{
            const sources=[...(byRally.get(rally.id)??[])],sets=[...new Set(sources.map(value=>value.setNumber))],single=sources.length===1?sources[0]:null;
            return [rally.id,{...(sets.length===1?{setNumber:sets[0]}:{}),...(single?{scoreUs:single.scoreUs,scoreThem:single.scoreThem}:{}),fundamentals:[...new Set(sources.flatMap(value=>value.contacts.map(mark=>scoutingActionFundamentals.find(skill=>skill.id===mark.contact.fundamental)?.label??mark.contact.fundamental)))]}];
        }));
    },[recording,draft.doc?.rallies,draft.sourceContacts]);
    const selectRally=useCallback((id:string|null)=>{setSelectedRally(id);},[]);
    const playbackState=useCallback((value:boolean)=>{playing.current=value;if(!value)applyPending();},[applyPending]);
    const exportState=useCallback((value:boolean)=>{exporting.current=value;if(!value)applyPending();},[applyPending]);
    const onMetadata=useCallback((value:{durationSeconds:number;width:number;height:number})=>{
        if(!alive.current||!visibleResource||currentResource.current?.url!==visibleResource.url)return;
        if(!Number.isFinite(value.durationSeconds)||value.durationSeconds<=0||value.durationSeconds>86400||!Number.isFinite(value.width)||value.width<=0||value.width>16384||!Number.isFinite(value.height)||value.height<=0||value.height>16384)return;
        setMetadata(old=>old?.url===visibleResource.url&&old.durationSeconds===value.durationSeconds&&old.width===value.width&&old.height===value.height?old:{url:visibleResource.url,...value});
    },[visibleResource]);
    const mediaError=useCallback(()=>{if(alive.current&&visibleResource&&currentResource.current?.url===visibleResource.url)setError('Esta prévia não pôde ser reproduzida. Atualize para tentar novamente.');},[visibleResource]);
    const refresh=useCallback(()=>{if(alive.current)setRefreshVersion(value=>value+1);},[]);
    const selectRecording=useCallback((id:string)=>{if(recordings.some(value=>value.recordingId===id))onSelectRecording(id);},[recordings,onSelectRecording]);
    const localReplay:LocalStudioSource={identity:owner,draft,rallyMetadata,source:visibleResource?.url??'',blob:visibleResource?.media.blob??null,file:visibleResource?.file??null,
        offsetSeconds,availableUntilSeconds,original:visibleResource?.media.original??false,loading,error,
        message:visibleResource?visibleResource.media.original?'Vídeo original salvo no computador':'Prévia local recebida':loading?'Abrindo vídeo local…':'Aguardando o vídeo desta gravação',
        revision:props.revision+refreshVersion,selectRally,playbackState,exportState,onMetadata,mediaError,refresh,onOtherVideos:props.onOtherVideos,
        recordings:props.recordings.map(value=>({value:value.recordingId,label:`${new Date(value.updatedAt).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})} · ${value.clips.filter(clip=>clip.active).length} lances`})),recordingId:recording?.recordingId??'',selectRecording};
    return <ScoutingVideoStudio org={props.org} userId={props.userId} classId={props.classId} sessionId={props.sessionId} teamName={props.teamName} students={props.students}
        active={props.active} embedded={props.embedded} visible={props.visible} bench={props.bench} benchPreviewActive={props.benchPreviewActive} keyboardActive={props.keyboardActive} onReturnToLive={props.onReturnToLive} onBenchReplayChange={props.onBenchReplayChange} onBenchStageTarget={props.onBenchStageTarget} toolbarTarget={props.toolbarTarget} onLeaveGuard={props.onLeaveGuard} onClose={props.onClose} localReplay={localReplay}/>;
}
