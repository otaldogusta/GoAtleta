import type { Student } from '../../core/models';
import type { ScoutingOverview } from '../../db/scouting-collection';

export type ScoutingWorkspaceMode = 'register' | 'video' | 'camera';
export type ScoutingWorkspaceProps = {
    org:string; userId:string; classId:string; teamName:string; students:Student[];
    rows:ScoutingOverview[]; initialSessionId?:string; initialMode?:ScoutingWorkspaceMode;
    active?:boolean; canCreate?:boolean; mode:'treino'|'jogo'; onClose:()=>void; onSaved:()=>void; onCreated:()=>void;
};
