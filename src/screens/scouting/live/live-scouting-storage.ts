import type { ScoutingContact } from '../../../core/models';
import { parseLiveCaptureStamp, type LiveCaptureStamp } from '../../../core/scouting-live';
import { scoutingActionFundamentals, scoutingActionPhases } from '../../../core/scouting';
import { parseScoutingRallyOutcome, validateRallyContacts, validateScoutingRally } from '../../../core/scouting-rallies';
import type { PendingScoutingCommand } from '../../../db/scouting-collection';
import { createLiveDatabaseConnection } from './live-idb-connection';
import type { LiveHostScope } from './live-storage';
import type { CaptureAppliedEvent, CaptureTimingDraft, LiveRecordingReference, LiveTimelineClip, LiveTimelineRecording } from './live-scouting-contract';

type Receipt = { id: string; intent: string; recoveredTiming?: CaptureTimingDraft };
export type LiveScoutingTimeline = { version: 1; scope: LiveHostScope; analysisSessionId: string; revision: number; clips: LiveTimelineClip[]; receipts: Receipt[] };
const STORE='timelines', MAX=10000;
const connection=createLiveDatabaseConnection('goatleta-scouting-live-timelines-v1',db=>{if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE);});
const id=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=300;
const same=(a:LiveHostScope,b:LiveHostScope)=>a.userId===b.userId&&a.org===b.org&&a.classId===b.classId;
const captureId=(value:unknown):value is string=>typeof value==='string'&&/^[-\w]{1,128}$/.test(value);
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
function contact(value:unknown):ScoutingContact{
    const c=value as ScoutingContact;
    if(!object(c)||!scoutingActionFundamentals.some(f=>f.id===c.fundamental)||typeof c.resultKey!=='string'||!scoutingActionPhases.some(p=>p.id===c.phase)
        ||c.studentId!=null&&!id(c.studentId)||c.athleteName!=null&&(typeof c.athleteName!=='string'||c.athleteName.length>300)
        ||validateRallyContacts([c]))throw new Error('Contato inválido na sincronização.');
    return {fundamental:c.fundamental,phase:c.phase,resultKey:c.resultKey,...(c.studentId!==undefined?{studentId:c.studentId}:{}),
        ...(c.athleteName!==undefined?{athleteName:c.athleteName}:{}),...(c.zone!==undefined?{zone:c.zone}:{})};
}
function reference(value:unknown):LiveRecordingReference|null{
    if(value===null)return null;
    const r=value as LiveRecordingReference;if(!r||!id(r.hostSessionId)||!captureId(r.recordingId))throw new Error('Referência de gravação inválida.');
    return {hostSessionId:r.hostSessionId,recordingId:r.recordingId};
}
function stamp(value:unknown,scope:LiveHostScope){
    if(value===null)return null;const parsed=parseLiveCaptureStamp(value);
    if(!same(parsed.scope,scope))throw new Error('Relógio de outra instituição.');return parsed;
}
function timing(value:unknown,scope:LiveHostScope):CaptureTimingDraft{
    const t=value as CaptureTimingDraft;
    if(!t||!Array.isArray(t.contacts)||t.contacts.length>100)throw new Error('Tempos dos contatos inválidos.');
    const ids=new Set<string>();
    const contacts=t.contacts.map(mark=>{if(!mark||!captureId(mark.id)||ids.has(mark.id))throw new Error('Contato duplicado ou inválido.');ids.add(mark.id);return {id:mark.id,stamp:stamp(mark.stamp,scope)};});
    return {contacts,pointStamp:stamp(t.pointStamp,scope),...(t.reference!==undefined?{reference:reference(t.reference)}:{})};
}
function pending(value:unknown):PendingScoutingCommand{
    const p=value as PendingScoutingCommand,c=p?.command,payload=c?.payload;
    if(!p||typeof p.requestId!=='string'||!/^[-\w]{8,100}$/.test(p.requestId)||!Number.isSafeInteger(p.revision)||p.revision<0||!c||!object(payload))throw new Error('Evento de sincronização inválido.');
    if(c.name==='point'||c.name==='action'){
        if(!Array.isArray(c.payload.contacts)||c.payload.contacts.length>100)throw new Error('Sequência de contatos inválida.');
        const contacts=c.payload.contacts.map(contact);
        if(c.name==='action'){if(contacts.length!==1)throw new Error('A ação confirmada precisa de um contato.');return {requestId:p.requestId,revision:p.revision,command:{name:'action',payload:{contacts}}};}
        const outcome=c.payload.outcome===undefined?undefined:parseScoutingRallyOutcome(c.payload.outcome);
        if(!['us','them'].includes(c.payload.winner)||validateScoutingRally(contacts,c.payload.winner,outcome))throw new Error('Resultado do ponto inválido.');
        return {requestId:p.requestId,revision:p.revision,command:{name:'point',payload:{contacts,winner:c.payload.winner,...(outcome!==undefined?{outcome}:{})}}};
    }
    if(c.name==='reopen_point'){if(!id(c.payload.rallyId))throw new Error('Ponto inválido.');return {requestId:p.requestId,revision:p.revision,command:{name:c.name,payload:{rallyId:c.payload.rallyId}}};}
    if(c.name==='undo_action'){if(!id(c.payload.actionId))throw new Error('Ação inválida.');return {requestId:p.requestId,revision:p.revision,command:{name:c.name,payload:{actionId:c.payload.actionId}}};}
    if(c.name==='start_set'){
        const s=c.payload;
        if(!Number.isSafeInteger(s.setNumber)||s.setNumber<1||s.setNumber>99||![s.scoreUs,s.scoreThem].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=999)||!['us','them'].includes(s.serve)||s.rotation!==null&&(!Number.isSafeInteger(s.rotation)||s.rotation<1||s.rotation>6))throw new Error('Set inválido.');
        return {requestId:p.requestId,revision:p.revision,command:{name:c.name,payload:{setNumber:s.setNumber,scoreUs:s.scoreUs,scoreThem:s.scoreThem,serve:s.serve,rotation:s.rotation}}};
    }
    if((c.name==='complete'||c.name==='discard_draft')&&Object.keys(c.payload).length===0)return {requestId:p.requestId,revision:p.revision,command:{name:c.name,payload:{}}};
    throw new Error('Comando de sincronização inválido.');
}
function sourceMatches(a:LiveCaptureStamp,b:LiveCaptureStamp){return a.hostSessionId===b.hostSessionId&&a.recordingId===b.recordingId&&a.segmentId===b.segmentId&&a.epoch===b.epoch&&a.peerGeneration===b.peerGeneration;}
function gestureRange(kind:'point'|'action',marks:CaptureTimingDraft['contacts'],point:LiveCaptureStamp|null){
    const anchor=kind==='point'?point:marks[0]?.stamp;if(!anchor||marks.some(mark=>!mark.stamp||!sourceMatches(mark.stamp,anchor)))return null;
    const times=marks.map(mark=>mark.stamp!.timeMs);
    if(times.some((time,index)=>index>0&&time<times[index-1])||kind==='point'&&times.some(time=>time>anchor.timeMs))return null;
    return {startMs:Math.max(0,(times.length?times[0]:anchor.timeMs-8000)-2000),endMs:Math.max(anchor.timeMs,...times)+1500};
}
const contactIntent=(value:ScoutingContact)=>{const c=contact(value);return JSON.stringify([c.fundamental,c.phase,c.resultKey,c.studentId??null,c.athleteName??null,c.zone??null]);};
const equalContact=(a:ScoutingContact,b:ScoutingContact)=>contactIntent(a)===contactIntent(b);
export function liveScoutingTimelineKey(scope:LiveHostScope,analysisSessionId:string){
    if(![scope.userId,scope.org,scope.classId,analysisSessionId].every(id))throw new Error('Escopo da sincronização incompleto.');
    return JSON.stringify([scope.userId,scope.org,scope.classId,analysisSessionId]);
}
const empty=(scope:LiveHostScope,analysisSessionId:string):LiveScoutingTimeline=>({version:1,scope:{...scope},analysisSessionId,revision:0,clips:[],receipts:[]});
export function parseLiveScoutingTimeline(value:unknown,scope:LiveHostScope,analysisSessionId:string):LiveScoutingTimeline{
    liveScoutingTimelineKey(scope,analysisSessionId);const v=value as LiveScoutingTimeline;
    if(!v||v.version!==1||!v.scope||!same(v.scope,scope)||v.analysisSessionId!==analysisSessionId||!Number.isSafeInteger(v.revision)||v.revision<0
        ||!Array.isArray(v.clips)||v.clips.length>MAX||!Array.isArray(v.receipts)||v.receipts.length>MAX)throw new Error('Linha do tempo inválida para esta análise.');
    const clips=v.clips.map(c=>{
        if(!c||![c.id,c.requestId,c.hostSessionId].every(id)||!captureId(c.recordingId)||c.id!==`capture_${c.requestId}`||c.analysisSessionId!==analysisSessionId||!['point','action'].includes(c.kind)||typeof c.active!=='boolean'
            ||!Array.isArray(c.contacts)||c.contacts.length>100||validateRallyContacts(c.contacts.map(mark=>mark.contact))
            ||!Number.isFinite(Date.parse(c.createdAt))||!Number.isSafeInteger(c.setNumber)||c.setNumber<1||c.setNumber>99
            ||![c.scoreUs,c.scoreThem].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=2000)
            ||c.won!==undefined&&typeof c.won!=='boolean'||!Number.isFinite(c.uncertaintyMs)||c.uncertaintyMs<0||c.uncertaintyMs>60000
            ||(c.startMs===null)!==(c.endMs===null)||c.startMs!==null&&(!Number.isFinite(c.startMs)||!Number.isFinite(c.endMs)||c.startMs<0||c.endMs!<=c.startMs||c.endMs!>7201500))throw new Error('Lance sincronizado inválido.');
        if(c.kind==='point'&&(c.rallyId!==`sr_${c.requestId}`||typeof c.won!=='boolean')||c.kind==='action'&&(c.rallyId!==undefined||c.won!==undefined||c.outcome!=null))throw new Error('Identidade oficial do lance inválida.');
        const checkStamp=(raw:unknown)=>{const parsed=stamp(raw,scope);if(parsed&&(parsed.recordingId!==c.recordingId||parsed.hostSessionId!==c.hostSessionId))throw new Error('Tempo de outra gravação.');return parsed;};
        if(new Set(c.contacts.map(mark=>mark.id)).size!==c.contacts.length)throw new Error('Contato duplicado no lance.');
        const contacts=c.contacts.map(mark=>{
            if(!captureId(mark.id)||typeof mark.actionId!=='string'||!mark.actionId.startsWith(`sa_${c.requestId}_`)||!/^\d+$/.test(mark.actionId.slice(`sa_${c.requestId}_`.length)))throw new Error('Contato inválido.');
            return {id:mark.id,contact:contact(mark.contact),stamp:checkStamp(mark.stamp),actionId:mark.actionId};
        });
        const pointStamp=checkStamp(c.pointStamp),range=gestureRange(c.kind,contacts,pointStamp);
        if(c.kind==='action'&&pointStamp!==null)throw new Error('A ação não tem desfecho de ponto.');
        if(c.startMs!==null&&(!range||Math.abs(range.startMs-c.startMs)>.001||Math.abs(range.endMs-c.endMs!)>.001))throw new Error('Recorte sem referência de tempo íntegra.');
        const outcome=c.outcome===undefined?undefined:parseScoutingRallyOutcome(c.outcome);
        if(c.kind==='point'&&validateScoutingRally(contacts.map(mark=>mark.contact),c.won?'us':'them',outcome))throw new Error('Desfecho do lance inválido.');
        return {id:c.id,requestId:c.requestId,hostSessionId:c.hostSessionId,recordingId:c.recordingId,analysisSessionId,kind:c.kind,active:c.active,
            contacts,pointStamp,startMs:c.startMs,endMs:c.endMs,uncertaintyMs:c.uncertaintyMs,setNumber:c.setNumber,scoreUs:c.scoreUs,scoreThem:c.scoreThem,createdAt:c.createdAt,
            ...(c.rallyId!==undefined?{rallyId:c.rallyId}:{}),...(c.won!==undefined?{won:c.won}:{}),...(outcome!==undefined?{outcome}:{})};
    });
    if(new Set(clips.map(c=>c.id)).size!==clips.length||new Set(v.receipts.map(r=>r.id)).size!==v.receipts.length
        ||v.receipts.some(r=>!id(r.id)||typeof r.intent!=='string'||r.intent.length>200000))throw new Error('Eventos duplicados na sincronização.');
    const receipts=v.receipts.map(r=>{
        let decoded:{pending:PendingScoutingCommand;timing:CaptureTimingDraft};try{decoded=JSON.parse(r.intent);}catch{throw new Error('Recibo de sincronização inválido.');}
        const request=pending(decoded?.pending),times=timing(decoded?.timing,scope);
        if(request.requestId!==r.id||('contacts' in request.command.payload?request.command.payload.contacts.length:0)!==times.contacts.length)throw new Error('Recibo de outro evento.');
        const recovered=r.recoveredTiming===undefined?undefined:timing(r.recoveredTiming,scope);
        if(recovered&&request.command.name!=='reopen_point')throw new Error('Recuperação de outro evento.');
        if(recovered?.reference&&[...recovered.contacts.map(mark=>mark.stamp),recovered.pointStamp].some(s=>s&&(s.recordingId!==recovered.reference!.recordingId||s.hostSessionId!==recovered.reference!.hostSessionId)))throw new Error('Recuperação de outra gravação.');
        return {id:r.id,intent:JSON.stringify({pending:request,timing:times}),...(recovered?{recoveredTiming:recovered}:{})};
    });
    return {version:1,scope:{...scope},analysisSessionId,revision:v.revision,clips,receipts};
}

async function transaction<T>(scope:LiveHostScope,analysisSessionId:string,write:boolean,run:(current:LiveScoutingTimeline)=>{next?:LiveScoutingTimeline;result:T}):Promise<T>{
    const key=liveScoutingTimelineKey(scope,analysisSessionId),tx=await connection.transaction(STORE,write?'readwrite':'readonly');
    return new Promise((resolve,reject)=>{
        let result:T,failure:unknown,done=false;
        const timer=setTimeout(()=>{failure=new Error('Tempo esgotado ao salvar a sincronização.');try{tx.abort();}catch{/* The operation may already have been interrupted by the browser. */}finish(failure);},10000);
        const finish=(error?:unknown)=>{if(done)return;done=true;clearTimeout(timer);if(error)reject(error);else resolve(result);};
        const fail=(error:unknown)=>{failure=error;try{tx.abort();}catch{finish(error);}};
        tx.oncomplete=()=>finish();tx.onabort=()=>finish(failure??new Error('Não foi possível guardar os lances neste computador.'));tx.onerror=()=>{failure=tx.error;};
        const store=tx.objectStore(STORE),read=store.get(key);read.onerror=()=>fail(read.error);
        read.onsuccess=()=>{try{
            const current=read.result===undefined?empty(scope,analysisSessionId):parseLiveScoutingTimeline(read.result,scope,analysisSessionId);
            const value=run(current);result=value.result;
            if(value.next){const clean=parseLiveScoutingTimeline(value.next,scope,analysisSessionId);const request=store.put(clean,key);request.onerror=()=>fail(request.error);}
        }catch(error){fail(error);}};
    });
}
export const loadLiveScoutingTimeline=(scope:LiveHostScope,analysisSessionId:string)=>transaction(scope,analysisSessionId,false,current=>({result:current}));

/** Every timestamp belongs to the original gesture, never the RPC response time. */
function buildClip(scope:LiveHostScope,event:CaptureAppliedEvent):LiveTimelineClip|null{
    const {pending,saved,timing,sessionId}=event,command=pending.command;
    if(command.name!=='point'&&command.name!=='action')return null;
    const first=timing.contacts.find(mark=>mark.stamp)?.stamp??timing.pointStamp;
    const reference=first??timing.reference;if(!reference)return null;
    const stamps=[...timing.contacts.map(mark=>mark.stamp),timing.pointStamp].filter(stamp=>stamp!==null);
    for(const stamp of stamps){const parsed=parseLiveCaptureStamp(stamp);if(!same(parsed.scope,scope))throw new Error('Relógio de outra instituição.');}
    const rally=command.name==='point'?saved.rallies.find(r=>r.id===`sr_${pending.requestId}`):null;
    if(command.name==='point'&&!rally)throw new Error('O ponto confirmado ainda não está disponível para sincronizar.');
    const contacts=command.payload.contacts;
    if(contacts.length!==timing.contacts.length)throw new Error('A sequência de contatos mudou antes da sincronização.');
    if(rally&&(rally.sessionId!==sessionId||rally.won!==(command.name==='point'&&command.payload.winner==='us')||rally.contacts.length!==contacts.length||rally.contacts.some((c,index)=>!equalContact(c,contacts[index]))
        ||JSON.stringify(rally.outcome??null)!==JSON.stringify(command.name==='point'?command.payload.outcome??null:null)))throw new Error('O ponto confirmado difere do evento original.');
    contacts.forEach((c,index)=>{
        const action=saved.actions.find(a=>a.id===`sa_${pending.requestId}_${index}`);
        if(!action||action.sessionId!==sessionId||action.organizationId!==scope.org||action.classId!==scope.classId||!equalContact(action,c)
            ||(action.rallyId??null)!==(rally?.id??null)||rally&&action.contactIndex!==index)throw new Error('O contato confirmado ainda não está disponível para sincronizar.');
    });
    const range=gestureRange(command.name,timing.contacts,timing.pointStamp);
    const state=saved.session.matchState;
    return {id:`capture_${pending.requestId}`,requestId:pending.requestId,analysisSessionId:sessionId,kind:command.name,hostSessionId:reference.hostSessionId,recordingId:reference.recordingId,
        ...(rally?{rallyId:rally.id}:{}),contacts:contacts.map((contact,index)=>({...timing.contacts[index],stamp:timing.contacts[index].stamp?.recordingId===reference.recordingId&&timing.contacts[index].stamp?.hostSessionId===reference.hostSessionId?timing.contacts[index].stamp:null,contact:{...contact},actionId:`sa_${pending.requestId}_${index}`})),
        pointStamp:timing.pointStamp?.recordingId===reference.recordingId&&timing.pointStamp?.hostSessionId===reference.hostSessionId?timing.pointStamp:null,startMs:range?.startMs??null,endMs:range?.endMs??null,uncertaintyMs:Math.max(0,...stamps.map(stamp=>stamp.uncertaintyMs)),
        setNumber:rally?.setNumber??state?.setNumber??1,scoreUs:rally?.scoreUs??state?.scoreUs??0,scoreThem:rally?.scoreThem??state?.scoreThem??0,
        ...(rally?{won:rally.won,outcome:rally.outcome??null}:{}),active:true,createdAt:rally?.createdAt??saved.session.updatedAt};
}
export function projectLiveScoutingEvent(current:LiveScoutingTimeline,event:CaptureAppliedEvent):{next:LiveScoutingTimeline;recoveredTiming?:CaptureTimingDraft}{
    const {scope,analysisSessionId}=current;
    if(!event?.before?.session||!event.saved?.session||event.userId!==scope.userId||event.org!==scope.org||event.sessionId!==analysisSessionId
        ||[event.before.session,event.saved.session].some(s=>s.id!==analysisSessionId||s.organizationId!==scope.org||s.classId!==scope.classId))throw new Error('Análise de outra turma ou instituição.');
    event={...event,pending:pending(event.pending),timing:timing(event.timing,scope)};
    if(event.pending.command.name==='action'&&event.timing.pointStamp!==null)throw new Error('A ação não tem desfecho de ponto.');
    if(('contacts' in event.pending.command.payload?event.pending.command.payload.contacts.length:0)!==event.timing.contacts.length)throw new Error('A sequência de contatos mudou antes da sincronização.');
    const intent=JSON.stringify({pending:event.pending,timing:event.timing}),receipt=current.receipts.find(r=>r.id===event.pending.requestId);
    if(receipt){if(receipt.intent!==intent)throw new Error('Este evento já foi sincronizado com outros tempos.');return {next:current,...(receipt.recoveredTiming?{recoveredTiming:timing(receipt.recoveredTiming,scope)}:{})};}
    let clips=current.clips.slice(),recoveredTiming:CaptureTimingDraft|undefined;
    const command=event.pending.command;
    if(command.name==='point'||command.name==='action'){const clip=buildClip(scope,event);if(clip)clips.push(clip);}
    else if(command.name==='reopen_point'){
        if(!event.before.rallies.some(r=>r.id===command.payload.rallyId)||event.saved.rallies.some(r=>r.id===command.payload.rallyId))throw new Error('A reabertura do ponto ainda não foi confirmada.');
        const prior=clips.find(c=>c.active&&c.rallyId===command.payload.rallyId);
        if(prior)recoveredTiming={contacts:prior.contacts.map(({id,stamp})=>({id,stamp})),pointStamp:prior.pointStamp,reference:{hostSessionId:prior.hostSessionId,recordingId:prior.recordingId}};
        clips=clips.map(c=>c.rallyId===command.payload.rallyId?{...c,active:false}:c);
    }else if(command.name==='undo_action'){
        if(!event.before.actions.some(a=>a.id===command.payload.actionId&&!a.rallyId)||event.saved.actions.some(a=>a.id===command.payload.actionId))throw new Error('A exclusão da ação ainda não foi confirmada.');
        clips=clips.map(c=>{if(c.kind!=='action'||!c.active||!c.contacts.some(mark=>mark.actionId===command.payload.actionId))return c;const contacts=c.contacts.filter(mark=>mark.actionId!==command.payload.actionId);return {...c,contacts,startMs:null,endMs:null,active:contacts.length>0};});
    }
    const next={...current,revision:current.revision+1,clips,receipts:[...current.receipts,{id:event.pending.requestId,intent,...(recoveredTiming?{recoveredTiming}:{})}]};
    return {next:parseLiveScoutingTimeline(next,scope,analysisSessionId),...(recoveredTiming?{recoveredTiming}:{})};
}
export async function applyLiveScoutingEvent(scope:LiveHostScope,event:CaptureAppliedEvent){
    return transaction(scope,event.sessionId,true,current=>{const projected=projectLiveScoutingEvent(current,event);return {next:projected.next,result:{timeline:projected.next,...(projected.recoveredTiming?{recoveredTiming:projected.recoveredTiming}:{})}};});
}
export function timelineRecordings(timeline:LiveScoutingTimeline):LiveTimelineRecording[]{
    const groups=new Map<string,LiveTimelineRecording>();
    for(const clip of timeline.clips.filter(c=>c.active)){
        let group=groups.get(clip.recordingId);if(!group){group={analysisSessionId:timeline.analysisSessionId,hostSessionId:clip.hostSessionId,recordingId:clip.recordingId,clips:[],updatedAt:clip.createdAt};groups.set(clip.recordingId,group);}
        group.clips.push(clip);if(clip.createdAt>group.updatedAt)group.updatedAt=clip.createdAt;
    }
    return [...groups.values()].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
}
