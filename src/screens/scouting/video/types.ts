import type { ScoutingSession, Student } from '../../../core/models';
import type { LocalStudioSource } from './local-studio-types';
import type { GoAtletaIconName } from '../../../ui/icon-registry';
export type StudioMenuAction = {
    id: string;
    group: 'Vídeo' | 'Rallies' | 'Análise';
    label: string;
    icon: GoAtletaIconName;
    disabled?: boolean;
    onPress: () => void;
};
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
    bench?: boolean;
    benchPreviewActive?: boolean;
    keyboardActive?: boolean;
    onReturnToLive?: () => void;
    onCameraSourceTarget?: (node: HTMLElement | null) => void;
    onBenchReplayChange?: (replaying: boolean) => void;
    onBenchStageTarget?: (node: HTMLElement | null) => void;
    onMenuActionsChange?: (actions: StudioMenuAction[] | null) => void;
    toolbarTarget?: HTMLElement | null;
    localReplay?: LocalStudioSource;
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
