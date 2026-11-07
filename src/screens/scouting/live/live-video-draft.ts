import { parseVideoDocument, type VideoDocument, type VideoHistory, type VideoMedia } from '../../../core/scouting-video';
import { scoutingActionFundamentals, scoutingActionPhases, getScoutingResultOptions } from '../../../core/scouting';
import { parseLiveCaptureStamp } from '../../../core/scouting-live';
import type { LiveHostScope } from './live-storage';
import type { LiveTimelineClip, LiveTimelineRecording } from './live-scouting-contract';
import type { StudioRallyRanges, StudioSourceContact } from '../video/local-studio-types';

export type LiveVideoDraftMediaInfo = { durationSeconds:number|null; width?:number|null; height?:number|null; offsetMs?:number; availableUntilMs?:number; original?:boolean };
export type LiveVideoDraftOwner = LiveHostScope & { analysisSessionId:string; hostSessionId:string; recordingId:string };
export type LiveVideoSnapshot = { document:VideoDocument; ranges:Record<string,[number,number]>; links:Record<string,string[]> };
type Edit = { label:string; at:string; before:LiveVideoSnapshot; after:LiveVideoSnapshot };
export type LiveVideoDraftState = { kind:'goatleta-live-video-draft'; version:1; owner:LiveVideoDraftOwner; present:LiveVideoSnapshot; past:Edit[]; future:Edit[]; knownIds:string[] };
const finite = (value:unknown):value is number => typeof value==='number'&&Number.isFinite(value);
const id = (value:unknown):value is string => typeof value==='string'&&value.length>0&&value.length<=300;
const rowId = (value:unknown):value is string => id(value)&&value.length<=120&&!['__proto__','constructor','prototype'].includes(value);
const plain = (value:unknown):value is Record<string,unknown> => !!value&&typeof value==='object'&&!Array.isArray(value);
const clone = <T,>(value:T):T => JSON.parse(JSON.stringify(value));
const ownerFields = ['userId','org','classId','analysisSessionId','hostSessionId','recordingId'] as const;
export function liveVideoDraftKey(owner:LiveVideoDraftOwner){
    if(!ownerFields.every(key=>id(owner[key])))throw new Error('Escopo do vídeo ao vivo inválido.');
    return `goatleta:scouting-live-editor:v1:${ownerFields.map(key=>encodeURIComponent(owner[key])).join(':')}`;
}
const fingerprint = (owner:LiveVideoDraftOwner)=>`live:${owner.recordingId}`;
const sortRallies = (doc:VideoDocument)=>({...doc,rallies:[...doc.rallies].sort((a,b)=>a.start-b.start)});

/** Local bounds are independent. Cloud's shared-boundary parser remains unchanged. */
export function parseLiveVideoSnapshot(value:unknown,owner:LiveVideoDraftOwner):LiveVideoSnapshot {
    const raw=value as LiveVideoSnapshot,doc=raw?.document;
    if(!plain(raw)||!doc||doc.media?.fingerprint!==fingerprint(owner)||!Array.isArray(doc.rallies)||doc.rallies.length>2000||!plain(raw.ranges)||!plain(raw.links))throw new Error('Rascunho local inválido.');
    // Validate/whitelist the canonical annotation fields without imposing shared rally boundaries.
    const clean=parseVideoDocument({...doc,rallies:[{id:'local-validation-only',start:0,winner:null,reviewed:false}]});
    const ids=new Set(clean.contacts.map(contact=>contact.id));
    const ranges:LiveVideoSnapshot['ranges']={};
    const rallies=doc.rallies.map(rally=>{
        const range=raw.ranges[rally?.id];
        if(!rally||!rowId(rally.id)||ids.has(rally.id)||!finite(rally.start)||rally.start<0||rally.start>86400||![null,'us','them'].includes(rally.winner)||typeof rally.reviewed!=='boolean'
            ||!Array.isArray(range)||range.length!==2||!range.every(finite)||range[0]<0||range[1]<=range[0]||range[1]>86401.5||Math.abs(range[0]-rally.start)>.000001
            ||rally.pointTime!==undefined&&(!finite(rally.pointTime)||rally.pointTime<range[0]||rally.pointTime>=range[1])
            ||rally.winnerContactId!==undefined&&(!rowId(rally.winnerContactId)||!clean.contacts.some(contact=>contact.id===rally.winnerContactId&&contact.time>=range[0]&&contact.time<range[1])))throw new Error('Recorte local inválido.');
        ids.add(rally.id);ranges[rally.id]=[range[0],range[1]];
        return {id:rally.id,start:rally.start,winner:rally.winner,reviewed:rally.reviewed,...(rally.pointTime!==undefined?{pointTime:rally.pointTime}:{}),...(rally.winnerContactId?{winnerContactId:rally.winnerContactId}:{})};
    });
    const entries=Object.entries(raw.links);if(entries.length>10000)throw new Error('Vínculos locais demais.');
    const links:LiveVideoSnapshot['links']={};
    for(const [source,targets] of entries){if(!rowId(source)||!Array.isArray(targets)||targets.length>2000||targets.some(target=>!rowId(target))||new Set(targets).size!==targets.length)throw new Error('Vínculo local inválido.');links[source]=[...targets];}
    return {document:sortRallies({...clean,rallies}),ranges,links};
}
export function parseLiveVideoDraft(raw:string,owner:LiveVideoDraftOwner):LiveVideoDraftState {
    liveVideoDraftKey(owner);let value:LiveVideoDraftState;
    try{value=JSON.parse(raw) as LiveVideoDraftState;}catch{throw new Error('Rascunho local inválido. O registro anterior foi preservado.');}
    if(!value||value.kind!=='goatleta-live-video-draft'||value.version!==1||!value.owner||ownerFields.some(key=>value.owner[key]!==owner[key])
        ||!Array.isArray(value.knownIds)||value.knownIds.length>10000||value.knownIds.some(key=>!id(key))||new Set(value.knownIds).size!==value.knownIds.length
        ||!Array.isArray(value.past)||value.past.length>20||!Array.isArray(value.future)||value.future.length>20)throw new Error('Este rascunho pertence a outra gravação.');
    const edit=(entry:Edit):Edit=>{
        if(!entry||typeof entry.label!=='string'||entry.label.length>120||typeof entry.at!=='string'||!Number.isFinite(Date.parse(entry.at)))throw new Error('Histórico local inválido.');
        return {label:entry.label,at:entry.at,before:parseLiveVideoSnapshot(entry.before,owner),after:parseLiveVideoSnapshot(entry.after,owner)};
    };
    return {kind:'goatleta-live-video-draft',version:1,owner:{...owner},present:parseLiveVideoSnapshot(value.present,owner),past:value.past.map(edit),future:value.future.map(edit),knownIds:[...value.knownIds]};
}
export function serializeLiveVideoDraft(state:LiveVideoDraftState):string {
    return JSON.stringify({...state,past:state.past.slice(-20),future:state.future.slice(-20)});
}
function mediaFor(owner:LiveVideoDraftOwner,recording:LiveTimelineRecording,info:LiveVideoDraftMediaInfo,prior?:VideoMedia):VideoMedia {
    const ends=recording.clips.filter(clip=>clip.active).map(clip=>clip.endMs===null?0:clip.endMs/1000);
    const measured=Math.max(finite(info.durationSeconds)&&info.durationSeconds>0?info.durationSeconds:0,finite(info.availableUntilMs)?info.availableUntilMs/1000:0);
    const duration=Math.min(86400,Math.max(.001,prior?.duration??0,measured,...ends));
    return {fingerprint:fingerprint(owner),name:'Gravação ao vivo',duration,width:finite(info.width)&&info.width>0?info.width:prior?.width??1280,height:finite(info.height)&&info.height>0?info.height:prior?.height??720};
}
function timed(clip:LiveTimelineClip,owner:LiveVideoDraftOwner){
    if(!finite(clip.startMs)||!finite(clip.endMs)||clip.startMs<0||clip.endMs<=clip.startMs||clip.endMs>86401500)return false;
    const anchor=clip.kind==='point'?clip.pointStamp:clip.contacts[0]?.stamp;if(!anchor)return false;
    try{
        const stamps=[...clip.contacts.map(mark=>mark.stamp),...(clip.pointStamp?[clip.pointStamp]:[])];
        for(const value of stamps){
            if(!value)return false;const stamp=parseLiveCaptureStamp(value);
            if(stamp.scope.userId!==owner.userId||stamp.scope.org!==owner.org||stamp.scope.classId!==owner.classId||stamp.hostSessionId!==owner.hostSessionId||stamp.recordingId!==owner.recordingId
                ||stamp.segmentId!==anchor.segmentId||stamp.epoch!==anchor.epoch||stamp.peerGeneration!==anchor.peerGeneration||stamp.timeMs<clip.startMs||stamp.timeMs>=clip.endMs)return false;
        }
        return true;
    }catch{return false;}
}
export function newLiveVideoDraft(owner:LiveVideoDraftOwner,recording:LiveTimelineRecording,info:LiveVideoDraftMediaInfo):LiveVideoDraftState {
    liveVideoDraftKey(owner);
    return reconcileLiveVideoDraft({kind:'goatleta-live-video-draft',version:1,owner:{...owner},present:{document:{version:1,media:mediaFor(owner,recording,info),rallies:[],contacts:[],corrections:[]},ranges:{},links:{}},past:[],future:[],knownIds:[]},recording,info);
}
/** Imports are receipts, never repeated replacement of the human-edited document. */
export function reconcileLiveVideoDraft(state:LiveVideoDraftState,recording:LiveTimelineRecording,info:LiveVideoDraftMediaInfo):LiveVideoDraftState {
    if(recording.analysisSessionId!==state.owner.analysisSessionId||recording.hostSessionId!==state.owner.hostSessionId||recording.recordingId!==state.owner.recordingId)throw new Error('Fonte de outra gravação.');
    if(!Array.isArray(recording.clips)||recording.clips.length>10000||new Set(recording.clips.map(clip=>clip.id)).size!==recording.clips.length||recording.clips.some(clip=>!rowId(clip.id)||clip.analysisSessionId!==state.owner.analysisSessionId||clip.hostSessionId!==state.owner.hostSessionId||clip.recordingId!==state.owner.recordingId||!Array.isArray(clip.contacts)||typeof clip.active!=='boolean'))throw new Error('Lance de outra gravação.');
    const active=recording.clips.filter(clip=>clip.active),known=new Set(state.knownIds),activeIds=new Set(active.map(clip=>clip.id));
    const fresh=active.filter(clip=>!known.has(clip.id)&&timed(clip,state.owner));
    const removed=state.knownIds.filter(key=>!activeIds.has(key));
    for(const clip of fresh){if(!rowId(clip.id))throw new Error('Identidade do lance inválida.');known.add(clip.id);}
    const media=mediaFor(state.owner,recording,info,state.present.document.media);
    const update=(snapshot:LiveVideoSnapshot):LiveVideoSnapshot=>{
        const next=clone(snapshot);next.document.media={...media};
        const activeTargets=new Set(Object.entries(next.links).filter(([source])=>activeIds.has(source)).flatMap(([,targets])=>targets));
        for(const source of removed){
            const targets=next.links[source]??[];
            // Retire only an unshared source row; a human merge may still serve an active source.
            if(!activeTargets.has(source)){
                next.document.rallies=next.document.rallies.filter(rally=>rally.id!==source);
                for(const target of targets)if(target===source)delete next.ranges[target];
            }
            delete next.links[source];
        }
        for(const clip of fresh){
            if(next.document.rallies.some(rally=>rally.id===clip.id)||next.document.contacts.some(contact=>contact.id===clip.id))throw new Error('Identidade local já utilizada.');
            next.document.rallies.push({id:clip.id,start:clip.startMs!/1000,winner:clip.kind==='point'?clip.won?'us':'them':null,reviewed:false,...(clip.pointStamp?{pointTime:clip.pointStamp.timeMs/1000}:{})});
            next.ranges[clip.id]=[clip.startMs!/1000,clip.endMs!/1000];next.links[clip.id]=[clip.id];
        }
        return parseLiveVideoSnapshot(next,state.owner);
    };
    const edit=(entry:Edit):Edit=>({...entry,before:update(entry.before),after:update(entry.after)});
    return {...state,present:update(state.present),past:state.past.map(edit),future:state.future.map(edit),knownIds:[...known]};
}
export function editLiveVideoDraft(state:LiveVideoDraftState,next:LiveVideoSnapshot,label:string):LiveVideoDraftState {
    const normalized=parseLiveVideoSnapshot(next,state.owner);
    if(JSON.stringify(state.present)===JSON.stringify(normalized))return state;
    return {...state,present:normalized,past:[...state.past.slice(-19),{label:label.slice(0,120),at:new Date().toISOString(),before:state.present,after:normalized}],future:[]};
}
export function changeLiveVideoDocument(state:LiveVideoDraftState,document:VideoDocument,label:string):LiveVideoDraftState {
    const ranges:LiveVideoSnapshot['ranges']={};
    for(let index=0;index<document.rallies.length;index++){
        const rally=document.rallies[index],prior=state.present.ranges[rally.id];
        ranges[rally.id]=prior?[rally.start,prior[1]]:[rally.start,document.rallies[index+1]?.start??document.media.duration];
    }
    return editLiveVideoDraft(state,{document,ranges,links:state.present.links},label);
}
export function undoLiveVideoDraft(state:LiveVideoDraftState,redo=false):LiveVideoDraftState {
    const source=redo?state.future:state.past,entry=source.at(-1);if(!entry)return state;
    return redo?{...state,present:entry.after,past:[...state.past,entry],future:source.slice(0,-1)}:{...state,present:entry.before,past:source.slice(0,-1),future:[...state.future,entry]};
}
export function resizeLiveVideoRally(state:LiveVideoDraftState,id:string,start:number,end:number):LiveVideoDraftState {
    const next=clone(state.present),rally=next.document.rallies.find(row=>row.id===id);
    if(!rally||!finite(start)||!finite(end)||start<0||end<=start||end>next.document.media.duration)throw new Error('Escolha um recorte dentro da gravação.');
    rally.start=start;rally.reviewed=false;next.ranges[id]=[start,end];
    return editLiveVideoDraft(state,next,'Recorte do rally ajustado');
}
export function splitLiveVideoRally(state:LiveVideoDraftState,time:number,id:string,rallyId?:string|null):LiveVideoDraftState {
    const next=clone(state.present),rally=rallyId==null?[...next.document.rallies].reverse().find(row=>time>next.ranges[row.id][0]&&time<next.ranges[row.id][1]):next.document.rallies.find(row=>row.id===rallyId);
    if(!rally||!rowId(id)||!finite(time)||time<=next.ranges[rally.id][0]||time>=next.ranges[rally.id][1])throw new Error('Escolha um instante dentro do rally.');
    const end=next.ranges[rally.id][1],point=rally.pointTime;next.ranges[rally.id]=[next.ranges[rally.id][0],time];
    rally.winner=null;delete rally.winnerContactId;delete rally.pointTime;rally.reviewed=false;
    next.document.rallies.push({id,start:time,winner:null,reviewed:false,...(point!==undefined&&point>=time?{pointTime:point}:{})});
    if(point!==undefined&&point<time)rally.pointTime=point;
    next.ranges[id]=[time,end];for(const targets of Object.values(next.links))if(targets.includes(rally.id))targets.push(id);
    return editLiveVideoDraft(state,next,'Divisão do rally');
}
export function mergeLiveVideoRally(state:LiveVideoDraftState,id:string):LiveVideoDraftState {
    const next=clone(state.present),index=next.document.rallies.findIndex(row=>row.id===id);if(index<=0)throw new Error('Este rally não tem recorte anterior.');
    const previous=next.document.rallies[index-1],range=next.ranges[id],prior=next.ranges[previous.id];
    next.ranges[previous.id]=[Math.min(prior[0],range[0]),Math.max(prior[1],range[1])];previous.start=next.ranges[previous.id][0];previous.winner=null;previous.reviewed=false;delete previous.winnerContactId;delete previous.pointTime;
    next.document.rallies.splice(index,1);delete next.ranges[id];
    for(const [source,targets] of Object.entries(next.links))next.links[source]=[...new Set(targets.map(target=>target===id?previous.id:target))];
    return editLiveVideoDraft(state,next,'União de rallies');
}
export function liveVideoHistory(state:LiveVideoDraftState):VideoHistory {
    const entry=(edit:Edit)=>({...edit,before:edit.before.document,after:edit.after.document});
    return {present:state.present.document,past:state.past.map(entry),future:state.future.map(entry)};
}
export function liveVideoSourceContacts(state:LiveVideoDraftState,recording:LiveTimelineRecording):{sourceContacts:StudioSourceContact[];pendingCount:number;ranges:StudioRallyRanges}{
    const sourceContacts:StudioSourceContact[]=[];let pendingCount=0;
    for(const clip of recording.clips.filter(row=>row.active)){
        const synchronized=timed(clip,state.owner);if(!synchronized)pendingCount++;
        for(const mark of clip.contacts){
            const contact=mark.contact,time=synchronized&&mark.stamp?mark.stamp.timeMs/1000:null;
            const targets=state.present.links[clip.id]??[clip.id];
            const rallyId=time!==null?targets.find(target=>state.present.ranges[target]&&time>=state.present.ranges[target][0]&&time<state.present.ranges[target][1])??targets[0]:targets[0];
            sourceContacts.push({id:mark.actionId??`${clip.id}:${mark.id}`,rallyId:rallyId??clip.id,time,
                skill:scoutingActionFundamentals.find(row=>row.id===contact.fundamental)?.label??contact.fundamental,
                result:getScoutingResultOptions(contact.fundamental).find(row=>row.key===contact.resultKey)?.label??contact.resultKey,
                athlete:contact.athleteName??'',detail:[scoutingActionPhases.find(row=>row.id===contact.phase)?.label??contact.phase,...(contact.zone?['Zona '+contact.zone]:[])].join(' · '),uncertaintyMs:mark.stamp?.uncertaintyMs??clip.uncertaintyMs});
        }
    }
    return {sourceContacts,pendingCount,ranges:state.present.ranges};
}
