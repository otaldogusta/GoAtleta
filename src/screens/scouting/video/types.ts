import type { ScoutingSession, Student } from '../../../core/models';
export type StudioProps = {
    org: string;
    userId: string;
    classId: string;
    sessionId: string;
    teamName: string;
    students: Student[];
    active?: boolean;
    onClose: () => void;
};
export type AuthorizedStudioProps = StudioProps & {
    session: ScoutingSession;
};
export type StudioViewProps = StudioProps & {
    session: Pick<ScoutingSession, 'title' | 'opponent' | 'status'>;
    shared?: { document: import('../../../core/scouting-video').VideoDocument; source: string; onMediaError: () => void };
};
