import type { VideoDocument } from '../../../core/scouting-video';
import type { useVideoDraft } from './use-video-draft';

/** View-only bounds; the canonical video/cloud document schema is unchanged. */
export type StudioRallyRanges = Readonly<Record<string, readonly [number, number]>>;
export type StudioSourceContact = {
    id:string; rallyId:string; time:number|null; skill:string; result:string;
    athlete:string; detail:string; uncertaintyMs:number;
};
export type LocalStudioDraft = ReturnType<typeof useVideoDraft> & {
    ranges:StudioRallyRanges;
    sourceContacts:readonly StudioSourceContact[];
    pendingCount:number;
    resizeRally:(id:string,start:number,end:number)=>void;
    splitRally:(time:number,rallyId?:string|null)=>void;
    mergeRally:(id:string)=>void;
    importLocal:(raw:string)=>Promise<boolean>;
    exportLocal:()=>string|null;
};
export type LocalStudioSource = {
    identity:string;
    draft:LocalStudioDraft;
    rallyMetadata?:Readonly<Record<string,StudioRallyMetadata>>;
    source:string;
    blob:Blob|null;
    file:File|null;
    offsetSeconds:number;
    availableUntilSeconds:number;
    original:boolean;
    loading:boolean;
    error:string;
    message:string;
    revision:number;
    selectRally:(id:string|null)=>void;
    playbackState:(playing:boolean)=>void;
    exportState:(exporting:boolean)=>void;
    onMetadata:(media:{durationSeconds:number;width:number;height:number})=>void;
    mediaError:()=>void;
    refresh:()=>void;
    onOtherVideos:()=>void;
    recordings:readonly {value:string;label:string}[];
    recordingId:string;
    selectRecording:(id:string)=>void;
};
export type StudioRangeResolver = (doc:VideoDocument,id:string|null)=>readonly [number,number];
export type StudioRallyMetadata = { setNumber?:number; scoreUs?:number; scoreThem?:number; fundamentals?:readonly string[] };
