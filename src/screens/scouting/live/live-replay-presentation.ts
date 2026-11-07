import { getScoutingResultOptions, scoutingActionFundamentals, scoutingActionPhases } from '../../../core/scouting';
import type { LiveReplayMedia, LiveTimelineClip, LiveTimelineContact } from './live-scouting-contract';

export function liveReplayTime(milliseconds:number){
    const value=Math.max(0,Math.round(milliseconds));
    return `${String(Math.floor(value/60000)).padStart(2,'0')}:${String(Math.floor(value/1000)%60).padStart(2,'0')}.${String(value%1000).padStart(3,'0')}`;
}
export function validReplayMedia(media:LiveReplayMedia|null):media is LiveReplayMedia{
    return !!media&&media.blob instanceof Blob&&media.blob.size>0&&media.blob.type.startsWith('video/')
        &&Number.isFinite(media.offsetMs)&&media.offsetMs>=0&&Number.isFinite(media.availableUntilMs)&&media.availableUntilMs>media.offsetMs
        &&typeof media.original==='boolean'&&Number.isFinite(media.uncertaintyMs)&&media.uncertaintyMs>=0;
}
/** All public times stay on the capture clock; only the media element uses the snapshot offset. */
export function liveReplayRange(clip:LiveTimelineClip|null,media:LiveReplayMedia|null,durationSeconds:number|null){
    if(!clip||clip.startMs===null||clip.endMs===null||!Number.isFinite(clip.startMs)||!Number.isFinite(clip.endMs)
        ||clip.startMs<0||clip.endMs<=clip.startMs||!media||durationSeconds===null||!Number.isFinite(durationSeconds)||durationSeconds<=0)return null;
    const availableEnd=Math.min(media.availableUntilMs,media.offsetMs+durationSeconds*1000);
    // A final original ends the recording; post-point padding may legitimately extend beyond it.
    // Real gestures outside the decoded source are missing footage, never padding.
    const contained=(time:number|null)=>time!==null&&time>=media.offsetMs-.01&&time<=availableEnd+.01;
    const point=clip.pointStamp,pointContained=clip.kind!=='point'||!!point&&point.hostSessionId===clip.hostSessionId&&point.recordingId===clip.recordingId&&contained(point.timeMs);
    const gesturesContained=pointContained&&clip.contacts.every(mark=>contained(liveReplayContactTime(mark,clip)));
    const requiredEnd=media.original&&gesturesContained?Math.min(clip.endMs,availableEnd):clip.endMs;
    const startMs=Math.max(clip.startMs,media.offsetMs),endMs=Math.min(requiredEnd,availableEnd);
    if(endMs<=startMs)return null;
    return {startMs,endMs,complete:startMs<=clip.startMs+.01&&endMs>=requiredEnd-.01};
}
export function liveReplayContactTime(contact:LiveTimelineContact,clip:LiveTimelineClip):number|null{
    const stamp=contact.stamp;
    return stamp&&stamp.recordingId===clip.recordingId&&stamp.hostSessionId===clip.hostSessionId&&Number.isFinite(stamp.timeMs)&&stamp.timeMs>=0?stamp.timeMs:null;
}
export function liveReplayContactLabel({contact}:LiveTimelineContact){
    const skill=scoutingActionFundamentals.find(value=>value.id===contact.fundamental)?.label??contact.fundamental;
    const result=getScoutingResultOptions(contact.fundamental).find(value=>value.key===contact.resultKey)?.label??contact.resultKey;
    const phase=scoutingActionPhases.find(value=>value.id===contact.phase)?.label??contact.phase;
    return {skill,result,phase,athlete:contact.athleteName||'Atleta não informado',zone:contact.zone==null?'':`Zona ${contact.zone}`};
}
