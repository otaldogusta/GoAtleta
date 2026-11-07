import type { ScoutingContact, ScoutingRallyOutcome } from '../../../core/models';
import type { LiveCaptureStamp } from '../../../core/scouting-live';
import type { PendingScoutingCommand, ScoutingDetail } from '../../../db/scouting-collection';
import type { LiveHostScope } from './live-storage';

export type CaptureContactMark = { id: string; stamp: LiveCaptureStamp | null };
export type CaptureTimingDraft = { contacts: CaptureContactMark[]; pointStamp: LiveCaptureStamp | null; reference?: LiveRecordingReference | null };
export type CaptureAppliedEvent = {
    userId: string; org: string; sessionId: string;
    pending: PendingScoutingCommand; before: ScoutingDetail; saved: ScoutingDetail;
    timing: CaptureTimingDraft;
};
export type ScoutingCaptureBridge = {
    captureStamp: () => LiveCaptureStamp | null;
    captureReference?: () => LiveRecordingReference | null;
    applied: (event: CaptureAppliedEvent) => Promise<{ recoveredTiming?: CaptureTimingDraft } | void>;
};
export type LiveRecordingReference = { hostSessionId: string; recordingId: string };
export type LiveHostSnapshot = {
    scope: LiveHostScope; epoch: number; peerGeneration: number;
    hostSessionId: string | null; recordingId: string | null; segmentId: string | null;
    recordingState: string | null; cameraState: string | null; connection: string;
    blockedReason: string | null; ended: boolean; durationMs?: number;
    videoState: 'receiving' | 'ready' | 'error' | null;
};
export type LiveHostBridgeApi = {
    getSnapshot: () => LiveHostSnapshot;
    getCaptureStamp: () => LiveCaptureStamp | null;
    loadSavedVideo: (reference: LiveRecordingReference) => Promise<Blob | null>;
    getReplayCapture: () => { stream: MediaStream | null; stamp: LiveCaptureStamp | null; snapshot: LiveHostSnapshot; playoutDelayMs: number };
};
export type LiveReplayMedia = { blob: Blob; offsetMs: number; availableUntilMs: number; original: boolean; uncertaintyMs: number };
export type LiveTimelineContact = CaptureContactMark & { contact: ScoutingContact; actionId?: string };
export type LiveTimelineClip = LiveRecordingReference & {
    id: string; requestId: string; analysisSessionId: string; kind: 'point' | 'action';
    rallyId?: string; contacts: LiveTimelineContact[]; pointStamp: LiveCaptureStamp | null;
    startMs: number | null; endMs: number | null; uncertaintyMs: number;
    setNumber: number; scoreUs: number; scoreThem: number; won?: boolean;
    outcome?: ScoutingRallyOutcome | null; active: boolean; createdAt: string;
};
export type LiveTimelineRecording = LiveRecordingReference & {
    analysisSessionId: string; clips: LiveTimelineClip[]; updatedAt: string;
};
