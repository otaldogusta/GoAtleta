import type { ScoutingSession, Student } from '../../../core/models';
export type LinkedScoutingSession = { id: string; title: string; date: string };
export type StudioProps = {
    org: string;
    userId: string;
    classId: string;
    sessionId: string;
    teamName: string;
    students: Student[];
    active?: boolean;
    embedded?: boolean;
    visible?: boolean;
    toolbarTarget?: HTMLElement | null;
    onLinkedSessionsChange?: (sources: LinkedScoutingSession[]) => void;
    onLeaveGuard?: (request: ((next: () => void) => void) | null) => void;
    onClose: () => void;
};
export type AuthorizedStudioProps = StudioProps & {
    session: ScoutingSession;
};
export type StudioViewProps = StudioProps & {
    session: Pick<ScoutingSession, 'title' | 'opponent' | 'status'> & { date?: string };
    shared?: { document: import('../../../core/scouting-video').VideoDocument; source: string; onMediaError: () => void };
};
