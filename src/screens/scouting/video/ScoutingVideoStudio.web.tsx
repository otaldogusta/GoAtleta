import { ConnectedVideoSources } from './ConnectedVideoSources.web';
import { VideoRallyRange } from './VideoRallyRange.web';
import { GoAtletaIcon } from '../../../ui/icon-registry';
import { VideoCorrectionLens } from './VideoCorrectionLens.web';
import { playbackFailure, clearPlaybackFailure } from './playback-error';
import { VideoBufferStatus } from './VideoBufferStatus.web';
import { saveVideoContact } from '../../../core/scouting-video';
import { StudioPanel } from './StudioPanel.web';
import { VideoBenchInspector } from './VideoBenchInspector.web';
import { videoBenchStyles } from './video-bench-styles';
import { VideoLinkField } from './VideoLinkField.web';
import { contactChanged, videoLinkKind } from './studio-editing';
import { StudioSelect } from './StudioSelect.web';
import { useStudioInteractions } from './use-studio-interactions';
import { adjacentTimelineMark, timelineNavigationMarks } from './timeline-contacts';
import { stepPlaybackFrame } from './video-frame-step';
import { applyVideoAi } from '../../../core/scouting-video-ai';
import { useFullVideoTracking } from './use-full-video-tracking';
import { analysisCheckpointScope } from './video-analysis-checkpoints';
import { YouTubeAnalysis } from './YouTubeAnalysis.web';
import { VideoScoutingReview } from './VideoScoutingReview.web';
import { VideoInitialSide, videoInitialSideKey } from './VideoInitialSide.web';
import { DriveTrackingSetup } from './DriveTrackingSetup.web';
import { driveTrackingAvailable } from '../../../api/scouting-video-drive';
import { YouTubeTrackingPanel } from './YouTubeTrackingPanel.web';
import { localVideoAiAvailable } from '../../../api/scouting-video-ai';
import { youtubeVideoId } from '../../../core/scouting-video-youtube';
import { YouTubeVideo } from './YouTubeVideo.web';
import type { VideoPlayback } from './youtube-player.web';
import { matchesTrackingOriginal, originalPlayback } from './original-playback.web';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';

import { createPortal } from 'react-dom';
import { markRender, measureAsync } from '../../../observability/perf';

import { loadScoutingDetail } from '../../../db/scouting-collection';

import { createClientId } from '../../../core/client-id';

import { acceptVideoAnalysis, markVideoPoint, mergeVideoRally, parseVideoDocument, splitVideoRally, videoRange, videoRallyIndex, videoSkills, videoTime, type BallPosition, type VideoContact, type VideoSkill, type VideoAnalysis, type VideoMedia } from '../../../core/scouting-video';

import { useAppTheme } from '../../../ui/app-theme';

import { StudioAction, StudioDialog } from './StudioUI.web';

import { studioStyles } from './studio-styles';

import { useVideoDraft } from './use-video-draft';
import { matchingOriginalDocument } from './video-source-selection';
import { VideoSyncConflict, VideoSyncFooter, VideoSyncNotice, videoDraftNeedsSyncRetry } from './VideoSyncFeedback.web';

import { inspectVideo, downloadVideoBlob, recordVideoClip } from './video-media.web';

import { videoArchive } from './video-archive.web';

import { processScoutingVideo } from './video-processing.web';
import { VideoTimeline } from './VideoTimeline.web';

import { VideoTrackingOverlay } from './VideoTrackingOverlay.web';
import { VideoFrame } from './VideoFrame.web';

import { VideoGallery } from './VideoGallery.web';
import { VideoShareDialog } from './VideoShareDialog.web';

import { VideoContactEditor } from './VideoContactEditor.web';

import { videoStudioPermissions } from '../../../core/scouting-video-sharing';
import { registerPendingEditsNavigation } from '../../../navigation/pending-edits-navigation';
import type { AuthorizedStudioProps, StudioProps, StudioViewProps } from './types';
import type { StudioRangeResolver } from './local-studio-types';
import { localStudioMediaRange } from './local-studio-range';

function useActiveObjectUrl(file: File | null, active: boolean) {
    const owner = useMemo(() => ({ file, active }), [file, active]);
    const [resource, setResource] = useState<{ owner: typeof owner; url: string } | null>(null);
    useEffect(() => {
        if (!owner.active || !owner.file) return;
        let alive = true;
        const url = URL.createObjectURL(owner.file);
        void Promise.resolve().then(() => { if (alive) setResource({ owner, url }); });
        return () => { alive = false; URL.revokeObjectURL(url); };
    }, [owner]);
    return active && resource?.owner === owner ? resource.url : '';
}

export default function ScoutingVideoStudio(props: StudioProps) {

    markRender('screen.scouting.video.render.web');
    const scope = `${props.org}:${props.classId}:${props.sessionId}`;
    const [loaded, setLoaded] = useState<{ scope: string; session: AuthorizedStudioProps['session'] | null; error: string } | null>(null);
    const session = loaded?.scope === scope ? loaded.session : null;
    const error = loaded?.scope === scope ? loaded.error : '';

    const { colors } = useAppTheme();

    useEffect(() => { let alive = true; void measureAsync('screen.scouting.video.load.session', () => loadScoutingDetail(props.org, props.sessionId)).then(d => { if (!alive)

        return; if (d.session.id !== props.sessionId || d.session.classId !== props.classId || d.session.organizationId !== props.org)

        throw new Error('Escopo inválido'); setLoaded({ scope, session: d.session, error: '' }); }).catch(() => { if (alive)

        setLoaded({ scope, session: null, error: 'Não foi possível abrir esta análise. Confira seu acesso e tente novamente.' }); }); return () => { alive = false; }; }, [props.org, props.classId, props.sessionId, scope]);

    if (typeof document === 'undefined')

        return null;

    const content = session ? <Studio key={`${props.org}:${props.userId}:${props.sessionId}`} {...props} session={session}/> : props.active === false ? null : <div role={props.embedded ? 'region' : 'dialog'} aria-label="Abrir estúdio" style={{ position: props.embedded ? 'relative' : 'fixed', inset: props.embedded ? undefined : 0, zIndex: props.embedded ? undefined : 6100, width: '100%', height: '100%', display: 'grid', placeContent: 'center', gap: 12, background: colors.background, color: colors.text }}><p role="status">{error || 'Abrindo análise…'}</p>{props.embedded ? null : <StudioAction label="Voltar" onPress={props.onClose}>Voltar</StudioAction>}</div>;
    return props.embedded ? content : createPortal(content, document.body);

}

/** Keep the transport beside the seek axis without changing playback ownership. */
function PlaybackControlLayout({ bench, transport, tools, timeline }: { bench?: boolean; transport: ReactNode; tools: ReactNode; timeline: ReactNode }) {
    return bench ? <div className="sv-reviewbar"><div className="sv-transport">{transport}</div>{timeline}<div className="sv-playback-tools">{tools}</div></div>
        : <><div className="sv-transport">{transport}<span className="sv-spacer"/>{tools}</div>{timeline}</>;
}

export function Studio(props: StudioViewProps) {

    const studioActive = props.active !== false;
    const studioVisible = props.visible !== false;
    const keyboardActive = props.keyboardActive !== false;
    const [benchToolsOpen, setBenchToolsOpen] = useState(false), [benchReplay, setBenchReplay] = useState(false);
    const onBenchReplayChange = props.onBenchReplayChange;
    useEffect(() => { if (props.bench) onBenchReplayChange?.(benchReplay); }, [props.bench, benchReplay, onBenchReplayChange]);
    const onBenchStageTarget = props.onBenchStageTarget;
    const bindBenchStage = useCallback((node: HTMLDivElement | null) => { onBenchStageTarget?.(node); }, [onBenchStageTarget]);
    const local = props.localReplay;
    const localMode = !!local;
    const { colors } = useAppTheme(), legacyDraft = useVideoDraft(props.org, props.userId, props.sessionId, props.shared?.document, props.session.status === 'em_andamento', studioActive && !localMode);
    const draft = local?.draft ?? legacyDraft;
    const localRanges = local?.draft.ranges;
    const rangeFor = useCallback<StudioRangeResolver>((document, id) => localRanges ? id ? localRanges[id] ?? [0, 0] : [0, document.media.duration] : videoRange(document, id), [localRanges]);
    const contactsFor = (document: NonNullable<typeof draft.doc>, id: string) => { const [start, end] = rangeFor(document, id); return document.contacts.filter(contact => contact.time >= start && contact.time < end).sort((a,b) => a.time-b.time); };

    const { doc } = draft, video = useRef<HTMLVideoElement>(null), fileInput = useRef<HTMLInputElement>(null), importInput = useRef<HTMLInputElement>(null), trackInput = useRef<HTMLInputElement>(null), stage = useRef<HTMLDivElement>(null);

    const playback = useRef<VideoPlayback | null>(null), localOwner = useRef<VideoPlayback | null>(null), originalInput = useRef<HTMLInputElement>(null);
    const latestDoc = useRef(doc);
    useLayoutEffect(() => { latestDoc.current = doc; }, [doc]);
    const youtubeId = localMode ? undefined : doc?.media.youtubeId;
    const [original, setOriginal] = useState<{ youtubeId: string; media: VideoMedia; url: string; kind: 'blob' | 'drive'; file?: File; confirmedSource?: string } | null>(null), [useOriginal, setUseOriginal] = useState(false);
    const [youtubeAttempt, setYoutubeAttempt] = useState(0), [playbackRate, setPlaybackRate] = useState(1);
    const [driveBusy, setDriveBusy] = useState(false);
    const [youtubeLink, setYoutubeLink] = useState(''), [previewId, setPreviewId] = useState(''), [youtubeDuration, setYoutubeDuration] = useState(0);
    const [storedSource, setSource] = useState(props.shared?.source ?? ''), [selectedFile, setFile] = useState<File | null>(null), [localFingerprint, setLocalFingerprint] = useState(''), [time, setTime] = useState(0), [playing, setPlaying] = useState(false), [selectedFocus, setFocus] = useState<string | null>(null);
    const localSource = useActiveObjectUrl(selectedFile, studioActive);
    const originalBlobSource = useActiveObjectUrl(original?.kind === 'blob' ? original.file ?? null : null, studioActive);
    const availableOriginal = useMemo(() => original?.kind === 'blob' ? { ...original, url: originalBlobSource } : original, [original, originalBlobSource]);
    const localAttached = !!doc && doc.media.fingerprint === localFingerprint;
    const source = local ? local.source : props.shared ? storedSource : youtubeId ? `youtube:${youtubeId}` : localAttached ? localSource : '';
    const file = local ? local.file : !youtubeId && localAttached ? selectedFile : null;
    const readyOriginal = youtubeId && availableOriginal?.youtubeId === youtubeId && doc?.analysis?.source && matchesTrackingOriginal(availableOriginal.kind === 'drive' && availableOriginal.confirmedSource === doc.analysis.source.fingerprint ? { ...availableOriginal.media, fingerprint: availableOriginal.confirmedSource } : availableOriginal.media, doc.analysis.source) ? availableOriginal : null;
    const originalActive = !localMode && !!readyOriginal && useOriginal;
    const iframePlayback = !!youtubeId && !originalActive;
    const playbackSource = originalActive ? readyOriginal!.url : source;
    const nativeOffset = local ? local.offsetSeconds : originalActive ? doc!.analysis!.source!.offsetSeconds : 0;
    const availableEnd = local ? local.availableUntilSeconds : originalActive ? readyOriginal!.media.duration + nativeOffset : doc?.media.duration ?? 0;
    const clockPosition = useRef({ time: 0, playing: false, rate: 1 });
    const localResource = useRef({ identity: local?.identity, source: local?.source });
    const metadataProbe = useRef<{source:string;timer:ReturnType<typeof setTimeout>}|null>(null);
    const mediaResume = useRef<{ time: number; playing: boolean; rate: number } | null>(null);
    const bindLocalVideo = useCallback((node: HTMLVideoElement | null) => {
        if (!node && playback.current === localOwner.current && playback.current) {
            const owner = playback.current;
            mediaResume.current ??= localMode ? { ...clockPosition.current, playing: false } : { time: owner.currentTime, playing: false, rate: owner.playbackRate };
            owner.pause();
        }
        video.current = node;
        if (node) { const owned = originalPlayback(node, nativeOffset, localMode ? 7200 : 1800); localOwner.current = owned; playback.current = owned; }
        else { if (playback.current === localOwner.current) playback.current = null; localOwner.current = null; }
    }, [nativeOffset, localMode]);

    const [analysisOpen, setAnalysisOpen] = useState(false), [trackingRequested, setTrackingRequested] = useState(false), [reviewOpened, setReviewOpened] = useState(!!props.embedded && !props.shared && !localMode);
    const [panel, setPanel] = useState(true), [tab, setTab] = useState<'rallies' | 'contacts' | 'validation' | 'history' | 'processing' | 'review'>(props.embedded && !props.shared && !localMode ? 'review' : 'rallies');

    const [modal, setModal] = useState<'import' | 'camera-source' | 'contact' | 'exit' | 'download' | 'share' | 'youtube-ai' | 'youtube-tracking' | null>(null), [progress, setProgress] = useState<number | null>(null), [job, setJob] = useState(''), [error, setError] = useState('');
    const openModal = useCallback((next: Exclude<typeof modal, null>) => { setBenchToolsOpen(false); setModal(next); }, []);
    const cameraSource = useRef<HTMLDivElement | null>(null), cameraSourceTrigger = useRef<HTMLSpanElement | null>(null), restoreSourceFocus = useRef(false);
    const { onCameraSourceTarget } = props;
    const bindCameraSource = useCallback((node: HTMLDivElement | null) => { cameraSource.current = node; onCameraSourceTarget?.(node); }, [onCameraSourceTarget]);
    useLayoutEffect(() => {
        if (modal === 'camera-source') cameraSource.current?.focus();
        else if (modal === 'import' && restoreSourceFocus.current) {
            restoreSourceFocus.current = false;
            cameraSourceTrigger.current?.querySelector<HTMLElement>('button,[role="button"]')?.focus();
        }
    }, [modal]);

    const reportPlaying=local?.playbackState;
    useEffect(() => { reportPlaying?.(playing); }, [reportPlaying, playing]);
    useEffect(() => () => reportPlaying?.(false), [reportPlaying]);

    useEffect(() => { if (modal && youtubeId) playback.current?.pause(); }, [modal, youtubeId]);

    const [editor, setEditor] = useState<VideoContact | null>(null), [readOnly, setReadOnly] = useState(false), [correcting, setCorrecting] = useState(false), [trackVisible, setTrackVisible] = useState(true), [manualTracking, setManualTracking] = useState<{ source: string; analysis?: VideoAnalysis; positions: BallPosition[] } | null>(null);

    const [trimFocus, setTrimFocus] = useState<string | null>(null);
    const trimPlayback = useRef<[number, number] | null>(null);
    const [controls, setControls] = useState(true), hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null), alive = useRef(true), exporting = useRef<AbortController | null>(null), loadingFile = useRef(false);
    const activityEpoch = useRef(0), pointFrame = useRef(0);
    const pendingNavigation = useRef<{ navigate: () => void; epoch: number } | null>(null);
    const isCurrentActivity = useCallback((epoch: number) => alive.current && activityEpoch.current === epoch, []);
    function startPlayback(value:VideoPlayback) {
        reportPlaying?.(true);
        return value.play().catch(failure=>{reportPlaying?.(false);throw failure;});
    }


    const focus = selectedFocus && doc?.rallies.some(r => r.id === selectedFocus) ? selectedFocus : null;
    const playbackFocus = useRef(focus);
    useLayoutEffect(() => { playbackFocus.current = focus; }, [focus]);
    const editorId = editor?.id;
    const editorDirty = !!editor && contactChanged(editor, doc?.contacts.find(c => c.id === editor.id));
    const linkKind = videoLinkKind(youtubeLink);
    const fullTracking = useFullVideoTracking(!props.shared && !localMode && doc ? analysisCheckpointScope(props.userId, props.org, props.sessionId, doc.media.fingerprint) : null, doc);
    const { tracking, suggestedCuts } = useMemo(() => ({
        tracking: manualTracking?.source === source && manualTracking.analysis === doc?.analysis ? manualTracking.positions : fullTracking ?? doc?.analysis?.positions ?? [],
        suggestedCuts: doc?.analysis?.cuts.filter(t => !doc.rallies.some(r => Math.abs(r.start - t) < .1)) ?? [],
    }), [manualTracking, source, doc, fullTracking]);
    const [analyzing, setAnalyzing] = useState(false);
    const contactEditor = useRef<HTMLDivElement>(null), pointSection = useRef<HTMLDivElement>(null);

    useEffect(() => { if (editorId && tab === 'contacts')

        contactEditor.current?.scrollIntoView({ block: 'nearest' }); }, [editorId, tab]);

    const [automatic, setAutomatic] = useState(false), [suggestion, setSuggestion] = useState<VideoAnalysis | null>(null);
    const [trackingModel, setTrackingModel] = useState<'v2b' | 'v4c'>('v2b');
    const processing = useRef<AbortController | null>(null);
    useEffect(() => () => processing.current?.abort(), []);
    const localIdentity=local?.identity, localUrl=local?.source;
    useLayoutEffect(() => {
        const previous=localResource.current;
        localResource.current={identity:localIdentity,source:localUrl};
        if (!localIdentity) return;
        if (metadataProbe.current) { clearTimeout(metadataProbe.current.timer); metadataProbe.current=null; }
        if (previous.identity!==localIdentity || !localUrl) {
            exporting.current?.abort(); processing.current?.abort(); playback.current?.pause();
        }
        if (previous.identity!==localIdentity) {
            clockPosition.current={time:0,playing:false,rate:1};
            // A recording is a separate editing/playback scope.
            setFocus(null); setTrimFocus(null); setEditor(null); setTime(0); setPlaying(false); setTab('rallies'); setError('');
            playbackFocus.current=null; trimPlayback.current=null;
        }
        if (previous.source!==localUrl || previous.identity!==localIdentity) mediaResume.current={...clockPosition.current,playing:false};
        if (!localUrl) { clockPosition.current.playing=false;
            // Source revocation must synchronously stop the visible playback state.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setPlaying(false); }
        return () => { if (metadataProbe.current) { clearTimeout(metadataProbe.current.timer); metadataProbe.current=null; } };
    }, [localIdentity, localUrl]);

    const analyze = async () => {
      if (!doc || !file || processing.current || !canEdit || local && !local.original) return;
      const epoch = activityEpoch.current;
      const controller = new AbortController(); processing.current = controller; setAnalyzing(true);
      setError(''); setSuggestion(null); setProgress(0); playback.current?.pause();
      try {
        const result = await processScoutingVideo(file, doc.media.duration, controller.signal, (done, total, stage) => { if (alive.current && !controller.signal.aborted) { setProgress(done / total); setJob(stage); } }, { model: trackingModel });
        if (alive.current && !controller.signal.aborted) setSuggestion(result);
      } catch (failure) { if (alive.current && !controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Falha ao analisar vídeo.'); }
      finally { if (processing.current === controller) processing.current = null; if (isCurrentActivity(epoch)) { setAnalyzing(false); setJob(''); setProgress(null); } }
    };
    const [picture, setPicture] = useState({ width: 0, height: 0 });

    const themes = { '--sv-bg': colors.background, '--sv-panel': colors.card, '--sv-input': colors.inputBg, '--sv-text': colors.text, '--sv-muted': colors.muted, '--sv-line': colors.border, '--sv-green': colors.primaryBg, '--sv-primary-text': colors.primaryText, '--sv-amber': colors.warning,
      '--sv-error-solid': colors.danger, '--sv-error-bg': colors.dangerBg, '--sv-error-text': colors.dangerText,
      '--sv-warning-solid': colors.warning, '--sv-warning-bg': colors.warningBg, '--sv-warning-text': colors.warningText,
      '--sv-point-solid': colors.success, '--sv-point-bg': colors.successBg, '--sv-point-text': colors.successText,
      '--sv-positive-solid': colors.info, '--sv-positive-bg': colors.infoBg, '--sv-positive-text': colors.infoText,
    } as CSSProperties;

    const teams = useMemo(() => ({ us: props.teamName || 'Nossa equipe', them: props.session.opponent || 'Adversário' }), [props.teamName, props.session.opponent]);

    const legacyPermissions = videoStudioPermissions(!!props.shared, readOnly, props.session.status === 'em_andamento');
    const permissions = localMode ? { ...legacyPermissions, importMedia: false, manageSharing: false } : legacyPermissions;
    const canEdit = permissions.annotate && !draft.loading && !draft.conflict;
    const syncBlocked = draft.loading || !!draft.conflict;
    const canSave = !syncBlocked && !draft.saving && (draft.dirty || videoDraftNeedsSyncRetry(draft.syncStatus));
    const saveDraft = () => localMode || draft.dirty ? draft.save() : draft.retrySync();
    const sharedSource = props.shared?.source;
    useEffect(() => {
        if (!sharedSource || sharedSource === source) return;
        const node = playback.current;
        if (node) mediaResume.current = { time: node.currentTime, playing: !node.paused, rate: node.playbackRate };
        // Preserve playback before replacing an externally renewed signed media URL.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSource(sharedSource);
    }, [sharedSource, source]);

    const contactFocus = tab === 'contacts' ? trimFocus ?? focus : focus;
    const activeIndex = doc ? (contactFocus ? Math.max(0, doc.rallies.findIndex(r => r.id === contactFocus)) : localMode ? Math.max(0, doc.rallies.findLastIndex(r => { const [from, until] = rangeFor(doc,r.id); return time >= from && time < until; })) : videoRallyIndex(doc, time)) : 0;

    const active = doc?.rallies[activeIndex];

    const navigationMarks = useMemo(() => {
        if (!doc) return [];
        const [start,end]=rangeFor(doc,focus);
        const marks = local ? [...doc.rallies.filter(r=>!focus||r.id===focus).flatMap(r=>[...rangeFor(doc,r.id),r.pointTime]),...doc.contacts.map(c=>c.time),...local.draft.sourceContacts.filter(c=>!focus||c.rallyId===focus).map(c=>c.time),editor?.time].filter((value):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=start&&value<=end).sort((a,b)=>a-b) : timelineNavigationMarks(doc, focus, editor);
        return localMode || originalActive ? marks.filter(mark => mark >= nativeOffset && mark < availableEnd) : marks;
    }, [doc, focus, editor, local, localMode, originalActive, nativeOffset, availableEnd, rangeFor]);
    const previousMark = adjacentTimelineMark(navigationMarks, time, -1), nextMark = adjacentTimelineMark(navigationMarks, time, 1);
    const frameRange = doc ? rangeFor(doc, focus) : [0, 0];
    const frameStart = localMode || originalActive ? Math.max(frameRange[0], nativeOffset) : frameRange[0];
    const frameEnd = localMode || originalActive ? Math.min(frameRange[1], availableEnd) : frameRange[1];

    const showControls = useCallback(() => { setControls(true); if (hideTimer.current)

        clearTimeout(hideTimer.current); hideTimer.current = setTimeout(() => { if (playback.current && !playback.current.paused)

        setControls(false); }, 2800); }, [playback]);

    useLayoutEffect(() => {
        activityEpoch.current += 1;
        alive.current = studioActive;
        if (!studioActive) return;
        return () => {
            activityEpoch.current += 1;
            alive.current = false;
            const owner = playback.current;
            if (owner) {
                mediaResume.current = { time: owner.currentTime, playing: false, rate: owner.playbackRate };
                owner.pause();
            }
            else if (mediaResume.current) mediaResume.current = { ...mediaResume.current, playing: false };
            pendingNavigation.current = null;
            exporting.current?.abort();
            processing.current?.abort();
            exporting.current = null;
            processing.current = null;
            loadingFile.current = false;
            if (hideTimer.current) clearTimeout(hideTimer.current);
            cancelAnimationFrame(pointFrame.current);
        };
    }, [studioActive]);
    useEffect(() => {
        if (studioActive) return;
        let current = true;
        void Promise.resolve().then(() => {
            if (current) { setPlaying(false); setAnalyzing(false); setJob(''); setProgress(null); }
        });
        return () => { current = false; };
    }, [studioActive]);

    useEffect(() => {
        if (studioVisible) return;
        let current = true;
        playback.current?.pause();
        if (mediaResume.current) mediaResume.current = { ...mediaResume.current, playing: false };
        void Promise.resolve().then(() => { if (current) setPlaying(false); });
        if (hideTimer.current) clearTimeout(hideTimer.current);
        return () => { current = false; };
    }, [studioVisible]);

    useEffect(() => { if (!studioActive || props.embedded) return; const app = document.getElementById('root'), prior = app?.inert, previousFocus = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow; if (app)

        app.inert = true; document.body.style.overflow = 'hidden'; return () => { if (app)

        app.inert = prior ?? false; document.body.style.overflow = overflow; previousFocus?.focus(); exporting.current?.abort(); if (hideTimer.current)

        clearTimeout(hideTimer.current); }; }, [studioActive, props.embedded]);

    const mediaWidth = originalActive ? readyOriginal?.media.width : doc?.media.width, mediaHeight = originalActive ? readyOriginal?.media.height : doc?.media.height;
    useEffect(() => { if (!studioActive) return; const node = stage.current; if (!node || !mediaWidth || !mediaHeight)

        return; const measure = () => { const r = node.getBoundingClientRect(), scale = Math.min(r.width / mediaWidth, r.height / mediaHeight); setPicture({ width: mediaWidth * scale, height: mediaHeight * scale }); }; measure(); const observer = new ResizeObserver(measure); observer.observe(node); return () => observer.disconnect(); }, [studioActive, mediaWidth, mediaHeight, playbackSource]);

    useEffect(() => { if (!studioActive) return; const unload = (e: BeforeUnloadEvent) => { if (draft.dirty || editorDirty) {

        e.preventDefault();

        e.returnValue = '';

    } }; window.addEventListener('beforeunload', unload); return () => window.removeEventListener('beforeunload', unload); }, [studioActive, draft.dirty, editorDirty]);

    const undo = (redo = false) => { if (!canEdit)

        return; if (editor) {

        setError('Registre ou cancele o contato em edição antes de desfazer.');

        setTab('contacts');

        return;

    } draft.undo(redo); setEditor(null); };

    useEffect(() => { if (!studioActive || !studioVisible || !keyboardActive) return; const key = (e: KeyboardEvent) => { if ((e.target as HTMLElement)?.closest('input,select,textarea,[contenteditable=true]') || modal)

        return; if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && canEdit) {

        e.preventDefault();

        undo(e.shiftKey);

    } }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); });

    const seek = (position: number, pause = true, selection = playbackFocus.current) => {
        if (!doc || !Number.isFinite(position)) return;
        if (props.bench) setBenchReplay(true);
        const [from,until]=rangeFor(doc,selection), start=localMode?Math.max(from,nativeOffset):from, end=localMode?Math.min(until,availableEnd):until;
        const target=Math.max(from,Math.min(Math.max(from,until-.001),position));
        if (localMode) { clockPosition.current={time:target,playing:!pause&&playing,rate:playbackRate}; mediaResume.current={...clockPosition.current}; }
        if (pause) playback.current?.pause();
        if (playback.current && end>start && (!localMode || target>=start&&target<end)) { playback.current.currentTime=target; if (!metadataProbe.current && (!localMode || (video.current?.readyState??0)>=1)) mediaResume.current=null; }
        setTime(target); showControls();
    };

    const chooseRally = (id: string | null) => {
        setTrimFocus(null); trimPlayback.current=null; if (!doc) return;
        playback.current?.pause(); playbackFocus.current=id; setFocus(id);
        const start=rangeFor(doc,id)[0];
        if (local) { clockPosition.current={time:start,playing:false,rate:playbackRate}; mediaResume.current={...clockPosition.current}; local.selectRally(id); }
        seek(start,true,id); showControls();
    };

    const reviewPoint = (position: number, start = false) => {
        if (!doc || !Number.isFinite(position)) return;
        const target = Math.max(0, Math.min(doc.media.duration - .001, position));
        playbackFocus.current = null; setFocus(null); setTrimFocus(null); trimPlayback.current = null;
        if (!playback.current || originalActive && (target < nativeOffset || target >= nativeOffset + readyOriginal!.media.duration)) {
            playback.current?.pause(); mediaResume.current = { time: target, playing: start, rate: playbackRate };
            if (originalActive) setUseOriginal(false);
            setTime(target); setPlaying(false); showControls(); return;
        }
        seek(target, true, null);
        if (start) void startPlayback(playback.current).then(() => setError(clearPlaybackFailure)).catch(failure => { const message = playbackFailure(failure); if (message) setError(message); });
    };

    const play = () => { if (props.bench) setBenchReplay(true); const v = playback.current; if (!v || !doc)

        return; if (!v.paused) {

        v.pause();

        return;

    } const [start, end] = trimPlayback.current ?? rangeFor(doc, focus);
    const availableStart = localMode || originalActive ? Math.max(start, nativeOffset) : start;
    const playableEnd = localMode || originalActive ? Math.min(end, availableEnd) : end;
    if (playableEnd <= availableStart) { setError(localMode?'Aguardando este trecho da gravação.':'Este trecho não está no original. Reproduza pelo YouTube.'); return; }
    if (v.currentTime < availableStart || v.currentTime >= playableEnd - .05)
        v.currentTime = availableStart; void startPlayback(v).then(() => setError(clearPlaybackFailure)).catch(failure => { const message = playbackFailure(failure); if (message) setError(message); }); showControls(); };

    const stepToMark = (direction: number) => {
        const target = adjacentTimelineMark(navigationMarks, playback.current?.currentTime ?? time, direction);
        if (target !== null) seek(target);
    };

    const stepFrame = (direction: -1 | 1) => {
        if (!playback.current || !doc) return;
        const position = stepPlaybackFrame(playback.current, direction, frameStart, frameEnd);
        if (position !== null) { setTime(position); setPlaying(false); showControls(); }
    };

    useStudioInteractions({ enabled: studioActive && studioVisible && keyboardActive, modalOpen: !!modal, canDeselect: !!editor && !editorDirty,
      onDeselect: () => setEditor(null),
      onStep: direction => stepFrame(direction < 0 ? -1 : 1),
      onPlay: play,
    });

    const tick = () => { const v = playback.current; if (!v || !doc)

        return; const activeFocus = playbackFocus.current; const [, rangeEnd] = trimPlayback.current ?? rangeFor(doc, activeFocus);
        if (metadataProbe.current || localMode && mediaResume.current) return;
        const end = localMode || originalActive ? Math.min(rangeEnd, availableEnd) : rangeEnd;
        if ((activeFocus || localMode || originalActive || trimPlayback.current) && v.currentTime >= end) {

        v.pause();

        v.currentTime = Math.max(0, end - .001);

    } if (localMode) clockPosition.current={time:v.currentTime,playing:!v.paused,rate:v.playbackRate}; setTime(v.currentTime); };

    const rememberPlayback = () => {
        const node = playback.current;
        const position = node?.currentTime ?? time;
        if (node) node.pause();
        mediaResume.current = { time: position, playing: false, rate: playbackRate };
        setTime(position); setPlaying(false); setCorrecting(false);
    };
    const switchPlayer = (nextOriginal: boolean) => {
        if (nextOriginal === originalActive) return;
        rememberPlayback(); setUseOriginal(nextOriginal);
    };
    const showOriginal = (value: File, target = doc) => {
        const linked = target?.analysis?.source;
        if (!target?.media.youtubeId || !linked) return;
        rememberPlayback(); setUseOriginal(true);
        setOriginal({ youtubeId: target.media.youtubeId, media: { fingerprint: linked.fingerprint, name: linked.name, duration: linked.duration, width: linked.width, height: linked.height }, url: '', file: value, kind: 'blob' });
    };
    const showDriveOriginal = (media: VideoMedia, url: string, linked = doc?.analysis?.source) => {
        if (!canEdit || !youtubeId || !linked) return;
        rememberPlayback(); setUseOriginal(true);
        // The user attests the same edit in the setup. This binding stays in RAM;
        // it does not change the original fingerprint or persist a Drive URL.
        setOriginal({ youtubeId, media, url, kind: 'drive', confirmedSource: linked.fingerprint });
    };
    const loadOriginal = async (value: File) => {
        const linked = doc?.analysis?.source;
        if (!permissions.importMedia || syncBlocked || !youtubeId || !linked || loadingFile.current) return;
        loadingFile.current = true; setJob('Conferindo original…'); setError('');
        const epoch = activityEpoch.current;
        try {
            const media = await inspectVideo(value);
            if (!isCurrentActivity(epoch)) return;
            if (!matchesTrackingOriginal(media, linked))
                throw new Error('Escolha o mesmo arquivo original usado neste tracking.');
            showOriginal(value);
        } catch (failure) { if (isCurrentActivity(epoch)) setError((failure as Error).message); }
        finally { if (isCurrentActivity(epoch)) { loadingFile.current = false; setJob(''); } }
    };
    const restorePlayback = () => {
        const value = playback.current, resume = mediaResume.current;
        if (!value) return;
        if (!studioVisible) value.pause();
        if (!resume) return;
        value.currentTime = localMode ? Math.max(nativeOffset,Math.min(Math.max(nativeOffset,availableEnd-.001),resume.time)) : resume.time; value.playbackRate = resume.rate;
        mediaResume.current = null; setTime(value.currentTime);
        if (localMode) clockPosition.current={time:value.currentTime,playing:resume.playing&&studioVisible,rate:resume.rate};
        if (resume.playing && studioVisible) void startPlayback(value).catch(() => undefined);
    };
    const reportLocalMetadata = () => {
        const node=video.current;
        if (!local || !node || !Number.isFinite(node.duration) || node.duration<=0) return false;
        if (metadataProbe.current) { clearTimeout(metadataProbe.current.timer); metadataProbe.current=null; }
        local.onMetadata({durationSeconds:node.duration,width:node.videoWidth,height:node.videoHeight});
        restorePlayback(); tick(); return true;
    };
    const loadedMetadata = () => {
        if (!local) { restorePlayback(); tick(); return; }
        if (reportLocalMetadata()) return;
        const node=video.current; if (!node || metadataProbe.current) return;
        mediaResume.current??={...clockPosition.current,playing:false};
        const currentSource=local.source;
        const timer=setTimeout(()=>{ if (metadataProbe.current?.source!==currentSource) return; metadataProbe.current=null; restorePlayback(); },2500);
        metadataProbe.current={source:currentSource,timer};
        try { node.currentTime=1e10; } catch { clearTimeout(timer); metadataProbe.current=null; restorePlayback(); }
    };

    const loadFile = async (value: File) => {
        const epoch = activityEpoch.current;

        if (!permissions.importMedia || syncBlocked || loadingFile.current)

            return;

        loadingFile.current = true;

        setError('');

        setJob('Reconhecendo vídeo…'); setPreviewId('');

        try {

            const meta = await inspectVideo(value);

            if (!isCurrentActivity(epoch))

                return;

            const associated = matchingOriginalDocument(doc, meta);
            if (associated) {
                showOriginal(value, associated);
                setModal(null); setCorrecting(false); setSuggestion(null);
                return;
            }

            if (draft.dirty && !(await draft.save())) return;
            if (!isCurrentActivity(epoch)) return;

            await draft.open(meta);
            if (!isCurrentActivity(epoch)) return;
            await draft.save();

            if (!isCurrentActivity(epoch))

                return;

            setFile(value); setLocalFingerprint(meta.fingerprint); setPlaying(false); setCorrecting(false); setTab('rallies'); setPanel(true);

            setFocus(null);

            setTime(0); setPlaybackRate(1);

            setManualTracking(null); setSuggestion(null);

            setEditor(null);

            setJob('Vídeo reconhecido');

        }

        catch (failure) {

            if (isCurrentActivity(epoch))

                setError(failure instanceof Error ? failure.message : 'Não foi possível abrir o vídeo.');

        }

        finally {

            if (isCurrentActivity(epoch)) loadingFile.current = false;

            if (isCurrentActivity(epoch))

                setJob('');

        }

    };

    const openYouTube = async () => {
        if (!permissions.importMedia || syncBlocked || loadingFile.current || !previewId || !youtubeDuration || editor) return;
        loadingFile.current = true; setJob('Abrindo vídeo…'); setError('');
        const epoch = activityEpoch.current;
        try {
            if (draft.dirty && !(await draft.save())) return;
            if (!isCurrentActivity(epoch)) return;
            playback.current?.pause();
            await draft.open({ youtubeId: previewId, fingerprint: `youtube:${previewId}`, name: `YouTube · ${previewId}`, duration: youtubeDuration, width: 1280, height: 720 });
            if (!isCurrentActivity(epoch)) return;
            await draft.save();
            if (!isCurrentActivity(epoch)) return;
            setFile(null); setSource(`youtube:${previewId}`); setFocus(null); setTime(0); setPlaybackRate(1); setPlaying(false);
            setManualTracking(null); setSuggestion(null); setCorrecting(false); setAutomatic(false); setPreviewId(''); setModal(null); setTab('rallies'); setPanel(true);
        } catch (failure) { if (isCurrentActivity(epoch)) setError(failure instanceof Error ? failure.message : 'Não foi possível abrir o vídeo.'); }
        finally { if (isCurrentActivity(epoch)) { loadingFile.current = false; setJob(''); } }
    };

    const addContact = (skill: VideoSkill) => { if (!doc || !canEdit)

        return; playback.current?.pause(); setEditor({ id: createClientId(), time: Math.min(playback.current?.currentTime ?? time, doc.media.duration - .001), skill, team: 'us', athlete: '', studentId: null, outcome: '' }); setModal(null); setTab('contacts'); setPanel(true); if (props.bench) setBenchToolsOpen(true); };

    const openContact = (contact: VideoContact) => {
        if (props.bench) setBenchToolsOpen(true);
        if (editor && editor.id !== contact.id && editorDirty) {
            setError('Salve ou cancele o contato em edição.'); setTab('contacts'); setPanel(true); return;
        }
        playback.current?.pause(); seek(contact.time); setTab('contacts'); setPanel(true);
        if (canEdit && editor?.id !== contact.id) setEditor({ ...contact });
    };

    const saveContact = () => { if (!doc || !editor || !canEdit || !editorDirty)

        return; draft.change(localMode ? { ...doc, contacts:[...doc.contacts.filter(c=>c.id!==editor.id),{...editor}].sort((a,b)=>a.time-b.time) } : saveVideoContact(doc, editor), 'Contato · ' + editor.skill); setEditor(null); };

    const revealPoint = () => {
        if (props.bench) setBenchToolsOpen(true);
        setTab('contacts'); setPanel(true);
        cancelAnimationFrame(pointFrame.current);
        pointFrame.current = requestAnimationFrame(() => {
            const section = pointSection.current;
            const disclosure = section?.closest('details');
            if (disclosure) disclosure.open = true;
            section?.scrollIntoView({ block: 'nearest' });
        });
    };

    const markPoint = () => {
        if (!doc || !active || !canEdit || editor) return;
        playback.current?.pause();
        const position = Math.min(playback.current?.currentTime ?? time, doc.media.duration - .001);
        const rally = localMode ? active : doc.rallies[videoRallyIndex(doc, position)];
        try {
            const [start,end]=rangeFor(doc,rally.id);
            if (localMode && (position<start||position>=end)) throw new Error('Marque o ponto dentro do recorte.');
            draft.change(localMode ? {...doc,rallies:doc.rallies.map(value=>value.id===rally.id?{...value,pointTime:position}:value)} : markVideoPoint(doc, rally.id, position), 'Instante do ponto');
            setTime(position); if (focus) setFocus(rally.id); revealPoint();
        } catch (failure) { setError((failure as Error).message); }
    };

    const split = () => { if (!doc || !canEdit)

        return; try {

        if (local) { local.draft.splitRally(time,focus??active?.id); setFocus(null); return; }
        const id = createClientId();

        draft.change(splitVideoRally(doc, time, id), 'Divisão do rally');

        setFocus(id);

    }

    catch (failure) {

        setError((failure as Error).message);

    } };

    const exportAnalysis = useCallback(() => { if (doc && permissions.download) {
        const raw=local ? local.draft.exportLocal() : JSON.stringify({ ...doc, contacts: doc.contacts.map(c => ({ ...c, studentId: null })) });
        if (raw) downloadVideoBlob(new Blob([raw], { type: 'application/json' }), local?'analise-gravacao-local.json':'analise-scouting.json');
    } }, [doc, local, permissions.download]);

    const importAnalysis = async (input: File) => { if (!doc || !canEdit)

        return; const epoch = activityEpoch.current; try {

        if (input.size > 5000000)

            throw new Error('Arquivo de análise muito grande.');

        const raw=await input.text();
        if (!isCurrentActivity(epoch)) return;
        if (local) { if (await local.draft.importLocal(raw)) { setFocus(null); setEditor(null); setModal(null); } return; }
        const value = parseVideoDocument(JSON.parse(raw), doc.media);
        if (!isCurrentActivity(epoch)) return;

        draft.change({ ...value, contacts: value.contacts.map(c => ({ ...c, studentId: props.students.some(s => s.id === c.studentId) ? c.studentId : null })) }, 'Importação de análise');

        setFocus(null);

        setEditor(null);
        setModal(null);

    }

    catch (failure) {

        if (isCurrentActivity(epoch)) setError((failure as Error).message);

    } };

    const importTracking = async (input: File) => { if (!doc || !canEdit)

        return; const epoch = activityEpoch.current; try {

        if (input.size > 15000000)

            throw new Error('Arquivo de trajetória muito grande.');

        const value = JSON.parse(await input.text()) as {

            fingerprint: string;

            positions: BallPosition[];

        };
        if (!isCurrentActivity(epoch)) return;

        if (value.fingerprint !== doc.media.fingerprint || !Array.isArray(value.positions) || value.positions.length > 150000 || value.positions.some(p => !p || ![p.time, p.x, p.y].every(Number.isFinite) || p.time < 0 || p.time >= doc.media.duration || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1))

            throw new Error('Trajetória inválida ou de outro vídeo.');

        setManualTracking({ source, analysis: doc.analysis, positions: [...value.positions].sort((a, b) => a.time - b.time) });

    }

    catch (failure) {

        if (isCurrentActivity(epoch)) setError((failure as Error).message);

    } };

    const download = useCallback(async (ids: string[] | null) => {
        const epoch = activityEpoch.current;

        if (!permissions.download || !file || !doc || exporting.current || !source)

            return;

        if (!ids) {
            if (local && !local.original) return;
            downloadVideoBlob(file, file.name);

            return;

        }

        const rallies = doc.rallies.filter(r => ids.includes(r.id));

        if (!rallies.length)

            return;

        if (local && rallies.some(r=>!localStudioMediaRange(doc,r.id,local,rangeFor).complete)) { setError('Aguardando o vídeo completo destes recortes.'); return; }

        if (rallies.reduce((sum, r) => { const [s, e] = rangeFor(doc, r.id); return sum + e - s; }, 0) > 600) {

            setError('Selecione até 10 minutos de recortes por download.');

            return;

        }

        const controller = new AbortController();

        exporting.current = controller;
        local?.exportState(true);

        openModal('download');

        setProgress(0);

        setError('');

        try {

            const files = [];

            for (let i = 0; i < rallies.length; i++) {

                setJob(`Preparando rally ${i + 1} de ${rallies.length}`);

                const [from,until] = rangeFor(doc, rallies[i].id);
                const {start,end}=local?localStudioMediaRange(doc,rallies[i].id,local,rangeFor):{start:from,end:until};

                const blob = await recordVideoClip(source, start-nativeOffset, end-nativeOffset, p => { if (alive.current)

                    setProgress((i + p) / rallies.length); }, controller.signal);

                if (controller.signal.aborted)

                    return;

                files.push({ name: `rally-${String(doc.rallies.findIndex(r => r.id === rallies[i].id) + 1).padStart(2, '0')}.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`, blob });

            }

            const blob = files.length === 1 ? files[0].blob : await videoArchive(files);

            if (controller.signal.aborted || !alive.current)

                return;

            downloadVideoBlob(blob, files.length === 1 ? files[0].name : 'rallies.zip');

            setModal(null);

        }

        catch (failure) {

            if (alive.current && !controller.signal.aborted)

                setError((failure as Error).message);

        }

        finally {

            if (exporting.current === controller) exporting.current = null;
            local?.exportState(false);

            if (isCurrentActivity(epoch)) {

                setProgress(null);

                setJob('');

            }

        }

    }, [doc, file, source, permissions.download, isCurrentActivity, local, rangeFor, nativeOffset, openModal]);

    const openAnalysisImport = useCallback(() => {
        if (canEdit && !editor) importInput.current?.click();
        else setError(canEdit ? 'Registre ou cancele o contato antes de importar a análise.' : 'Esta análise está em modo de leitura.');
    }, [canEdit, editor]);

    const onClose = props.onClose;
    const finishLeave = useCallback(() => {
        if (!alive.current) return;
        const pending = pendingNavigation.current;
        if (pending && pending.epoch !== activityEpoch.current) return;
        pendingNavigation.current = null;
        if (props.embedded && pending?.navigate) { setModal(null); pending.navigate(); }
        else { onClose(); pending?.navigate(); }
    }, [onClose, props.embedded]);
    const requestLeave = useCallback((navigate?: () => void) => {
        if (!alive.current || draft.saving) return;
        playback.current?.pause();
        pendingNavigation.current = navigate ? { navigate, epoch: activityEpoch.current } : null;
        if (draft.dirty || editorDirty) openModal('exit');
        else finishLeave();
    }, [draft.dirty, draft.saving, editorDirty, finishLeave, openModal]);
    const cancelLeave = () => { pendingNavigation.current = null; setModal(null); };
    const leaveRequest = useRef(requestLeave);
    useLayoutEffect(() => { leaveRequest.current = requestLeave; }, [requestLeave]);
    const registeredLeave = useCallback((next: () => void) => leaveRequest.current(next), []);
    const { embedded, shared, onLeaveGuard } = props;
    useEffect(() => {
        if (!embedded || !onLeaveGuard || !studioActive || shared) return;
        onLeaveGuard(registeredLeave);
        return () => onLeaveGuard(null);
    }, [embedded, onLeaveGuard, studioActive, shared, registeredLeave]);
    useEffect(() => {
        if (!studioActive || props.shared || props.embedded) return;
        return registerPendingEditsNavigation(requestLeave);
    }, [studioActive, props.shared, props.embedded, requestLeave]);
    const close = () => requestLeave();

    const gallery = doc ? <VideoGallery bench={props.bench} onOpenTools={props.bench ? () => { setTab('validation'); setAnalysisOpen(true); setPanel(true); setBenchToolsOpen(true); } : undefined} rangeResolver={rangeFor} rallyMetadata={local?.rallyMetadata} availableUntilSeconds={local ? availableEnd : Infinity} canDownloadOriginal={!local || local.original} canDownloadRally={local ? id=>!!source&&localStudioMediaRange(doc,id,local,rangeFor).complete : undefined} pendingCount={local?.draft.pendingCount} thumbnailScope={!props.shared ? [props.userId, props.org, props.sessionId].map(encodeURIComponent).join(':') : undefined} playing={playing} doc={doc} source={source} thumbnailSource={!modal ? readyOriginal?.url : undefined} offsetSeconds={local ? nativeOffset : readyOriginal ? doc.analysis?.source?.offsetSeconds ?? 0 : 0} focus={focus} teams={teams} readOnly={!permissions.download} localMedia={!youtubeId} onFocus={chooseRally} onPlay={modal ? undefined : play} onDownload={download} onExport={exportAnalysis} onImport={openAnalysisImport}/> : null;

    const scoutingTab = tab === 'review' || tab === 'contacts';
    const infoTab = tab === 'validation' || tab === 'processing';
    const localToolbar = local ? <>{local.recordings.length>1 ? <StudioSelect compact label="Gravação ao vivo" value={local.recordingId} options={[...local.recordings]} onChange={id=>{ if (props.bench) setBenchToolsOpen(false); playback.current?.pause(); local.selectRecording(id); }}/> : null}<StudioAction label="Atualizar vídeo da gravação" icon="restore" disabled={local.loading} onPress={()=>{playback.current?.pause();local.refresh();}}>Atualizar</StudioAction><StudioAction label="Abrir outros vídeos" onPress={() => { if (props.bench) setBenchToolsOpen(false); local.onOtherVideos(); }}>Outros vídeos</StudioAction></> : null;
    const toolbar = <header className={`sv-head${props.embedded ? ' sv-embedded-toolbar' : ''}`}>{props.embedded ? <span className="sv-spacer"/> : <><StudioAction label="Voltar ao scouting" icon="chevronBack" onPress={close}/><div className="sv-title"><h1>Estúdio de scouting</h1><small>{`${props.session.title}${doc ? (focus ? ' · rally selecionado' : ' · vídeo completo') : ''}`}</small></div></>}{localToolbar}{permissions.manageSharing ? <StudioAction label="Compartilhar análise" icon="share" disabled={!doc || !!editor || syncBlocked} onPress={() => openModal('share')}/> : null}{readOnly && !props.shared ? <StudioAction label="Voltar à edição" onPress={() => setReadOnly(false)}>Voltar à edição</StudioAction> : null}{permissions.saveDraft ? <StudioAction label="Salvar rascunho" primary iconContent={<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2Z"/><path d="M7 3v6h10V3M7 21v-8h10v8"/></svg>} disabled={!canSave} onPress={() => { void saveDraft(); }}/> : <small>Somente leitura</small>}{permissions.importMedia ? <StudioAction label="Adicionar vídeo" disabled={!!editor || syncBlocked} onPress={() => openModal('import')} iconContent={<span className="sv-add-video-icon"><GoAtletaIcon name="video" size={21} color="currentColor"/><span className="sv-add-video-badge"><GoAtletaIcon name="add" size={13} color="currentColor"/></span></span>}/> : null}</header>;
    if (!studioActive) return null;

    return <div className={`sv${props.embedded ? ' sv-embedded' : ''}${props.bench ? ' sv-bench' : ''}`} data-youtube={!!youtubeId} data-modal-open={!!modal} style={themes} role={props.embedded ? 'region' : 'dialog'} aria-modal={props.embedded ? undefined : true} aria-label="Estúdio de scouting"><style>{studioStyles}{embeddedStyles}{props.bench ? videoBenchStyles : ''}</style>

    {props.bench ? null : props.embedded && props.toolbarTarget ? createPortal(toolbar, props.toolbarTarget) : toolbar}

    <input ref={originalInput} type="file" accept="video/*,.mp4,.webm,.mov" hidden onChange={e => { const value = e.target.files?.[0]; e.target.value = ''; if (value) void loadOriginal(value); }}/>

    <input ref={fileInput} type="file" accept="video/*,.mp4,.webm,.mov" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) {

        openModal('import');

        void loadFile(f);

    } }}/>

    <input ref={importInput} type="file" accept="application/json,.json" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f)

        void importAnalysis(f); }}/><input ref={trackInput} type="file" accept="application/json,.json" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f)

        void importTracking(f); }}/>

    <main className="sv-workspace"><section className="sv-main" aria-label="Vídeo e timeline"><div className="sv-stage" ref={stage} onPointerMove={showControls} onPointerDown={showControls}>{props.bench ? <><div className="sv-bench-stage-context">{doc && source ? <span>{focus ? `REPLAY · Rally ${String(activeIndex + 1).padStart(2, '0')}` : 'Vídeo completo'}</span> : null}{props.onReturnToLive ? <StudioAction label="Voltar ao vivo" icon="video" onPress={() => { playback.current?.pause(); setBenchReplay(false); props.onReturnToLive?.(); }}>Voltar ao vivo</StudioAction> : null}</div><div className="sv-bench-stage-target" ref={bindBenchStage}/></> : null}{source && doc && (iframePlayback || playbackSource) ? iframePlayback ? <YouTubeVideo key={youtubeId} id={youtubeId!} playback={playback} onReady={restorePlayback} onTick={tick} onState={setPlaying} onError={setError}/> : <><div className="sv-picture" onClick={e => { if (!correcting || !canEdit || !video.current || video.current.seeking || video.current.readyState < 2)

            return; const rect = e.currentTarget.getBoundingClientRect(), x = (e.clientX - rect.left - (rect.width - picture.width) / 2) / picture.width, y = (e.clientY - rect.top - (rect.height - picture.height) / 2) / picture.height; if (x < 0 || x > 1 || y < 0 || y > 1)

            return; draft.change({ ...doc, corrections: [...doc.corrections.filter(p => Math.abs(p.time - time) >= .025), { time, x, y }].sort((a, b) => a.time - b.time) }, 'Posição da bola'); setCorrecting(false); }}>

      <video key={localMode?playbackSource:undefined} ref={bindLocalVideo} src={playbackSource} crossOrigin="anonymous" playsInline preload="metadata" onTimeUpdate={tick} onSeeked={() => { if (metadataProbe.current) reportLocalMetadata(); else tick(); }} onDurationChange={() => { if (metadataProbe.current) reportLocalMetadata(); }} onPlay={() => { reportPlaying?.(true); clockPosition.current.playing=true; setPlaying(true); }} onPlaying={() => setError(clearPlaybackFailure)} onPause={() => { reportPlaying?.(false); clockPosition.current.playing=false; setPlaying(false); setControls(true); }} onLoadedMetadata={loadedMetadata} onError={() => local ? local.mediaError() : props.shared ? props.shared.onMediaError() : setError(originalActive && readyOriginal?.kind === 'drive' ? 'Falha ao reproduzir o Drive. Confira a conexão e abra o link novamente.' : 'Falha ao reproduzir o vídeo. Escolha o arquivo novamente.')}/>
      <VideoFrame video={video} source={playbackSource} width={picture.width} height={picture.height}/><VideoBufferStatus video={video} source={playbackSource}/>

      <VideoTrackingOverlay video={video} source={playbackSource} timeOffset={nativeOffset} cuts={doc.analysis?.cuts} positions={tracking} corrections={doc.corrections} rallies={doc.rallies} width={picture.width} height={picture.height} color={colors.primaryBg} correctionColor={colors.warning} visible={trackVisible}/>
{correcting && canEdit ? <VideoCorrectionLens video={video} width={picture.width} height={picture.height}/> : null}</div>{correcting ? <p style={{ position: 'absolute', bottom: 20, color: 'white', background: '#0009', padding: 8 }}>Clique na posição da bola</p> : null}</> : <div className={`sv-empty${props.bench && !local && !draft.loading ? ' sv-bench-empty' : ''}`}>{local ? <><h2>Gravação ao vivo</h2><p role="status">{local.loading ? 'Abrindo trecho…' : 'Aguardando trecho da gravação.'}</p><StudioAction label="Atualizar vídeo da gravação" disabled={local.loading} onPress={()=>{playback.current?.pause();local.refresh();}}>Atualizar</StudioAction></> : draft.loading ? <p role="status">Abrindo análise sincronizada…</p> : props.bench ? <><span className="sv-bench-empty-icon" aria-hidden="true"><GoAtletaIcon name="video" size={24} color={colors.muted}/></span><h2>Vídeo do jogo</h2><StudioAction primary label="Adicionar vídeo" icon="add" disabled={syncBlocked} onPress={() => openModal('import')}>Adicionar vídeo</StudioAction></> : <><h2>Seu jogo começa aqui</h2><p>Adicione um vídeo para analisar cada rally.</p><StudioAction primary label="Adicionar vídeo" icon="add" disabled={syncBlocked} onPress={() => openModal('import')}>Adicionar vídeo</StudioAction></>}</div>}</div>

      {doc && source ? <div className={`sv-player${controls || youtubeId ? '' : ' hidden-controls'}`} inert={props.bench && props.benchPreviewActive ? true : undefined} aria-hidden={props.bench && props.benchPreviewActive ? true : undefined}><PlaybackControlLayout bench={props.bench}
        transport={<><StudioAction label="Marcação anterior" icon="playBack" disabled={previousMark === null} onPress={() => stepToMark(-1)}/><StudioAction label="Voltar um quadro (aproximado: 1/30 s)" icon="frameBack" disabled={frameEnd <= frameStart || time <= frameStart + .001} onPress={() => stepFrame(-1)}/><StudioAction label={playing ? 'Pausar vídeo' : 'Reproduzir vídeo'} primary icon={playing ? 'pause' : 'play'} onPress={play}/><StudioAction label="Avançar um quadro (aproximado: 1/30 s)" icon="frameForward" disabled={frameEnd <= frameStart || time >= frameEnd - .001} onPress={() => stepFrame(1)}/><StudioAction label="Próxima marcação" icon="playForward" disabled={nextMark === null} onPress={() => stepToMark(1)}/><time title={videoTime(time, true)}>{videoTime(time, !props.bench)}{props.bench && doc ? ` / ${videoTime(rangeFor(doc,focus)[1])}` : ''}</time></>}
        tools={<>{!iframePlayback && (tracking.length > 0 || doc.corrections.length > 0) ? <StudioAction label={trackVisible ? "Ocultar rastreio no vídeo" : "Mostrar rastreio no vídeo"} icon="view" active={trackVisible} onPress={() => setTrackVisible(value => !value)}/> : null}{canEdit && !props.bench ? <StudioAction label="Marcar contato" disabled={!!editor} icon="add" onPress={() => { playback.current?.pause(); openModal('contact'); }}/> : null}{canEdit && !props.bench ? <StudioAction label="Marcar ponto" icon="flag" disabled={!!editor} onPress={markPoint}/> : null}<StudioSelect compact label="Velocidade de reprodução" value={String(playbackRate)} options={[.25, .5, 1, 1.5, 2].map(n => ({ value: String(n), label: `${n}×` }))} onChange={value => { setPlaybackRate(Number(value)); clockPosition.current.rate=Number(value); if (playback.current) playback.current.playbackRate = Number(value); }}/>{props.bench && permissions.download ? <StudioAction label={focus ? 'Baixar rally selecionado' : 'Baixar vídeo completo'} icon="download" disabled={!source || !!local && !(focus ? localStudioMediaRange(doc,focus,local,rangeFor).complete : local.original)} onPress={() => { void download(focus ? [focus] : null); }}/> : null}{props.bench ? <StudioAction label="Vídeo em tela cheia" icon="expand" onPress={() => { void stage.current?.requestFullscreen?.().catch(() => setError('Não foi possível abrir a tela cheia.')); }}/> : null}</>}
        timeline={<VideoTimeline bench={props.bench} rallyMetadata={local?.rallyMetadata} rangeResolver={rangeFor} sourceContacts={local?.draft.sourceContacts} availableWindow={local ? [nativeOffset,availableEnd] : undefined} doc={doc} draftContact={editor} teams={teams} time={time} focus={focus} tracking={tracking} onFocus={chooseRally} onContact={openContact} onPlay={modal ? undefined : play} onPoint={(id, position) => { if (focus) setFocus(id); seek(position); revealPoint(); }} onSeek={position => seek(position, false)}/>}
      /></div> : null}</section>{props.bench ? gallery : null}

      <VideoBenchInspector bench={props.bench} open={benchToolsOpen} onClose={() => setBenchToolsOpen(false)} toolbar={toolbar}><aside className={`sv-inspector${panel ? '' : ' closed'}`}><nav className="sv-tabs sv-tabs-review" aria-label="Painel da análise">{(['rallies', 'review', 'validation'] as const).map(value => <StudioAction key={value} label={value === 'rallies' ? 'Rallies' : value === 'review' ? 'Scouting' : 'Informações'} active={value === 'review' ? scoutingTab : value === 'validation' ? infoTab : tab === value} onPress={() => { setTab(value === 'review' && props.shared ? 'contacts' : value); setPanel(true); if (value === 'validation') setAnalysisOpen(true); if (value === 'review') setReviewOpened(true); }}>{value === 'rallies' ? <>Recortes <span className="sv-badge">{doc?.rallies.length}</span></> : value === 'review' ? 'Scouting' : 'Informações'}</StudioAction>)}<StudioAction label={panel ? 'Recolher painel' : 'Expandir painel'} icon={panel ? 'chevronDown' : 'chevronUp'} onPress={() => setPanel(!panel)}/></nav>

      <StudioPanel key={doc?.media.fingerprint ?? 'empty'} tab={tab}>
    <div hidden={!infoTab}>
    {analysisOpen && doc && youtubeId && canEdit ? <YouTubeAnalysis key={youtubeId} doc={doc} trackingRequested={trackingRequested} onSeek={seek} onReview={() => { setTab('rallies'); setPanel(true); }} scope={analysisCheckpointScope(props.userId, props.org, props.sessionId, doc.media.fingerprint)} onCuts={result => { const current = latestDoc.current; if (!current || current.media.youtubeId !== result.videoId) return; const next = applyVideoAi(current, [{ ...result, contacts: [] }], 'us', createClientId); latestDoc.current = next; draft.change(next, 'Recortes automáticos para revisão'); }} onTracking={(next, originalFile) => { const current = latestDoc.current; if (!current || current.media.fingerprint !== next.media.fingerprint) return; const merged = { ...current, analysis: next.analysis }; latestDoc.current = merged; draft.change(merged, 'Tracking associado ao YouTube'); if (originalFile) showOriginal(originalFile, merged); }} onApply={next => { draft.change(next, 'Sugestões do YouTube aceitas'); setModal(null); setTab('validation'); setPanel(true); }}/> : null}
    </div>
    {doc && scoutingTab && !props.shared ? <div className="sv-scouting-modes"><StudioAction label="Ver scouting registrado no jogo" active={tab === 'review'} onPress={() => { setReviewOpened(true); setTab('review'); }}>Pontos do jogo</StudioAction><StudioAction label="Ver contatos anotados no vídeo" active={tab === 'contacts'} onPress={() => setTab('contacts')}>Contatos do vídeo</StudioAction></div> : null}
    {local && doc && tab==='review' ? <div className="sv-contact-list">{local.draft.sourceContacts.filter(c=>!focus||c.rallyId===focus).map(c=><div key={c.id} className="sv-contact"><StudioAction label={`${c.skill} · ${c.athlete||'Sem atleta'} · ${c.result} · ${c.time===null?'Sem tempo de vídeo':videoTime(c.time,true)}`} disabled={c.time===null} onPress={()=>{ if(c.time!==null){ chooseRally(c.rallyId); seek(c.time,true,c.rallyId); } }}><span><b>{c.skill}</b><span className="sv-contact-detail">{c.athlete||'Sem atleta'} · {c.result}{c.detail ? ` · ${c.detail}` : ''}</span></span><time>{c.time===null?'Aguardando':videoTime(c.time,true)}</time></StudioAction></div>)}{!local.draft.sourceContacts.length ? <p className="sv-contact-empty">Os contatos de Registrar aparecem aqui.</p> : null}</div> : null}
    {reviewOpened && doc && !props.shared && !localMode ? <div hidden={tab !== 'review'}><VideoScoutingReview key={JSON.stringify([props.userId, props.org, props.classId, props.sessionId, doc.media.fingerprint])} user={props.userId} org={props.org} classId={props.classId} sessionId={props.sessionId} date={props.session.date} opponent={props.session.opponent} doc={doc} time={time} focus={focus} onSeek={position => reviewPoint(position)} onPlay={position => reviewPoint(position, true)} onSourcesChange={props.onLinkedSessionsChange} disabled={!canEdit}/></div> : null}

        {!doc && !localMode ? <p className="sv-section-meta">Adicione um vídeo para visualizar {tab === 'rallies' ? 'os rallies' : tab === 'contacts' ? 'os contatos' : 'as informações'}.</p> : null}

        {!props.shared && draft.conflict ? <VideoSyncConflict saving={draft.saving} writable={permissions.annotate} onResolve={draft.resolveConflict}/> : null}
        {local?.error ? <div className="sv-alert" role="alert">{local.error}</div> : local?.message && !props.bench ? <p className="sv-section-meta" role="status">{local.message}</p> : null}
        {error ? <div className="sv-alert" role="alert">{error}<StudioAction label="Fechar aviso" icon="close" onPress={() => setError('')}/></div> : draft.error ? draft.syncErrorCode === 'server-rejected' || draft.syncErrorCode === 'invalid' ? <VideoSyncNotice code={draft.syncErrorCode} error={draft.error} dirty={draft.dirty} saving={draft.saving} firstStart={doc?.rallies[0]?.start} onRetry={permissions.annotate ? draft.retrySync : undefined} onExport={doc && permissions.download ? exportAnalysis : undefined}/> : <div className="sv-alert" role="alert">{draft.error}<StudioAction label="Fechar aviso" icon="close" onPress={() => draft.setError('')}/></div> : null}

        {!props.bench && tab === 'rallies' ? gallery : null}

        {doc && active && tab === 'contacts' ? <>
          <div className="sv-row"><h2>Contatos · Rally {String(activeIndex + 1).padStart(2, '0')}</h2>{canEdit ? <StudioAction label="Novo contato" disabled={!!editor} icon="add" onPress={() => { playback.current?.pause(); openModal('contact'); }}/> : null}</div>
          <p className="sv-section-meta">{videoTime(rangeFor(doc, active.id)[0])} – {videoTime(rangeFor(doc, active.id)[1])} · {contactsFor(doc, active.id).length} contatos</p>
          {canEdit ? <VideoRallyRange rangeResolver={rangeFor} onResize={local ? (start,end)=>local.draft.resizeRally(active.id,start,end) : undefined} availableUntilSeconds={local ? availableEnd : Infinity} time={time} onConnect={() => openModal('import')} thumbnailScope={!props.shared ? [props.userId, props.org, props.sessionId].map(encodeURIComponent).join(':') : undefined} onPlayRange={(start, end) => { const v = playback.current; if (!v) return; if (!v.paused && trimPlayback.current) { v.pause(); return; } setTrimFocus(active.id); trimPlayback.current = [start, end]; setFocus(null); v.pause(); if(localMode && (start<nativeOffset||start>=availableEnd)){setError('Aguardando este trecho da gravação.');return;} seek(start,true,null); void startPlayback(v).catch(failure => { const message = playbackFailure(failure); if (message) setError(message); }); }} source={readyOriginal?.url ?? (!youtubeId ? source : '')} offset={local ? nativeOffset : readyOriginal ? doc.analysis?.source?.offsetSeconds ?? 0 : 0} playing={playing} onPreview={position => { trimPlayback.current = null; setTrimFocus(active.id); setFocus(null); seek(position,true,null); }} key={`${active.id}:${rangeFor(doc, active.id).join(':')}`} doc={doc} id={active.id} disabled={!!editor} onApply={next => { trimPlayback.current = null; playback.current?.pause(); draft.change(next, 'Recorte do rally ajustado'); }}/> : null}
          {editor && canEdit ? <div ref={contactEditor} className="sv-contact-editor"><VideoContactEditor changed={editorDirty} onCancel={() => setEditor(null)} contact={editor} students={props.students} teams={teams} onChange={setEditor} onSave={saveContact} onTime={() => setEditor({ ...editor, time: Math.min(time, doc.media.duration - .001) })} onDelete={doc.contacts.some(c => c.id === editor.id) ? () => { draft.change(localMode ? {...doc,contacts:doc.contacts.filter(c=>c.id!==editor.id),rallies:doc.rallies.map(r=>r.winnerContactId===editor.id?{...r,winnerContactId:undefined}:r)} : saveVideoContact(doc, null, editor.id), 'Contato excluído'); setEditor(null); } : undefined}/></div> : null}
          <div className="sv-contact-list">{contactsFor(doc, active.id).map(c => <div key={c.id} className="sv-contact"><StudioAction active={editor?.id === c.id} label={`${c.skill} ${videoTime(c.time, true)}`} onPress={() => openContact(c)}><span><b>{c.skill}</b><span className="sv-contact-detail">{c.athlete || teams[c.team]} · {c.outcome || 'Não avaliado'}</span></span><time>{videoTime(c.time, true)}</time></StudioAction></div>)}</div>
          {!contactsFor(doc, active.id).length ? <p className="sv-contact-empty"><small>Nenhum contato neste rally.</small></p> : null}
          <details className="sv-disclosure"><summary>Ponto e recorte do rally</summary><div ref={pointSection}><h3>Ponto do rally</h3><div className="sv-point-teams">{(['us', null, 'them'] as const).map(winner => <StudioAction key={winner ?? 'none'} label={winner ? teams[winner] : 'Não definido'} active={active.winner === winner} disabled={!canEdit} onPress={() => draft.change({ ...doc, rallies: doc.rallies.map(r => r.id === active.id ? { ...r, winner, winnerContactId: undefined } : r) }, 'Ponto do rally')}>{winner ? teams[winner] : 'N/D'}</StudioAction>)}</div><div className="sv-point-time">{active.pointTime !== undefined ? <><StudioAction label={`Ir para o ponto em ${videoTime(active.pointTime, true)}`} icon="flag" onPress={() => seek(active.pointTime!)}>Ponto · {videoTime(active.pointTime, true)}</StudioAction>{canEdit ? <><StudioAction label="Usar instante atual para o ponto" icon="time" disabled={!!editor} onPress={markPoint}/><StudioAction label="Remover marca do ponto" icon="close" disabled={!!editor} onPress={() => draft.change(localMode ? {...doc,rallies:doc.rallies.map(r=>r.id===active.id?{...r,pointTime:undefined}:r)} : markVideoPoint(doc, active.id, null), 'Marca do ponto removida')}/></> : null}</> : canEdit ? <StudioAction label="Marcar ponto aqui" icon="flag" disabled={!!editor} onPress={markPoint}>Marcar ponto aqui</StudioAction> : null}</div></div>{canEdit ? <details className="sv-crop-settings"><summary>Ajustar recorte do rally</summary><div className="sv-wrap sv-crop-actions"><StudioAction label="Iniciar rally aqui" onPress={split}>Iniciar rally aqui</StudioAction><StudioAction label="Unir ao anterior" disabled={activeIndex === 0} onPress={() => { try {

        if (local) local.draft.mergeRally(active.id); else draft.change(mergeVideoRally(doc, active.id), 'União de rallies');

        setFocus(null);

    }

    catch (failure) {

        setError((failure as Error).message);

    } }}>Unir ao anterior</StudioAction></div></details> : null}</details>
        </> : null}

        {doc && infoTab ? <>
          <details className="sv-disclosure sv-video-details"><summary>Vídeo e equipe</summary><div className="sv-row"><h2>Dados do vídeo</h2>{!props.shared ? <StudioAction label="Histórico de alterações" icon="time" onPress={() => setTab('history')}/> : null}</div>
          <dl className="sv-facts"><div><dt>Duração</dt><dd>{videoTime(doc.media.duration)}</dd></div><div><dt>Reprodução</dt><dd>{youtubeId ? <select className="sv-source-select" aria-label="Fonte da reprodução" value={originalActive ? 'original' : 'youtube'} onChange={event => { if (event.target.value === 'youtube') switchPlayer(false); else if (readyOriginal) switchPlayer(true); else openModal('import'); }}><option value="youtube">YouTube</option><option value="original" disabled={!readyOriginal && !permissions.importMedia}>{readyOriginal?.kind === 'drive' ? 'Google Drive' : 'Original com trajetória'}</option></select> : 'Arquivo'}</dd></div><div><dt>Marcações</dt><dd>{doc.rallies.length} rallies · {doc.contacts.length} contatos</dd></div></dl>
          {!props.shared ? <VideoInitialSide key={JSON.stringify([props.userId, props.org, props.sessionId, doc.media.fingerprint])} scope={videoInitialSideKey(props.userId, props.org, props.sessionId, doc.media.fingerprint)} disabled={!canEdit}/> : null}
          </details>
          <details className="sv-disclosure"><summary>Revisar trajetória da bola <small>{tracking.length.toLocaleString('pt-BR')} posições</small></summary>
            {doc && (tracking.length > 0 || doc.corrections.length > 0) ? <YouTubeTrackingPanel doc={doc.analysis && fullTracking ? { ...doc, analysis: { ...doc.analysis, positions: fullTracking } } : doc} time={time} youtube={iframePlayback} correcting={canEdit && correcting && iframePlayback} onCorrect={canEdit ? (x, y) => {
          draft.change({ ...doc, corrections: [...doc.corrections.filter(p => Math.abs(p.time - time) >= .025), { time: Math.min(time, doc.media.duration - .001), x, y }].sort((a, b) => a.time - b.time) }, 'Posição da bola'); setCorrecting(false);
      } : undefined}/> : null}
            <p className="sv-section-meta">Estimativa revisável · {doc.corrections.length} correções manuais</p>
            <div className="sv-wrap">{canEdit && tracking.length > 0 ? <StudioAction label="Corrigir posição da bola" icon="crosshair" active={correcting} onPress={() => { if (correcting) { setCorrecting(false); return; } if (iframePlayback && !readyOriginal) { openModal('import'); return; } playback.current?.pause(); if (iframePlayback) switchPlayer(true); setCorrecting(true); }}>Corrigir</StudioAction> : null}{youtubeId && canEdit ? <StudioAction label="Configurar tracking da bola" disabled={!!editor} onPress={() => { setAnalysisOpen(true); setTrackingRequested(true); setTab('validation'); setPanel(true); }}>Configurar</StudioAction> : null}{canEdit && !youtubeId ? <StudioAction label="Importar trajetória" onPress={() => trackInput.current?.click()}>Importar</StudioAction> : null}</div>
          </details>
          {suggestedCuts.length ? <details className="sv-disclosure"><summary>Cortes sugeridos <small>{suggestedCuts.length}</small></summary><ul className="sv-cut-list">{suggestedCuts.map(t => <li key={t}><StudioAction label={`Ver corte ${videoTime(t)}`} onPress={() => { chooseRally(null); if (playback.current) { playback.current.pause(); playback.current.currentTime = t; setTime(t); } }}><time>{videoTime(t)}</time></StudioAction>{canEdit ? <StudioAction label={`Criar rally em ${videoTime(t)}`} disabled={!canEdit || !!editor} icon="add" onPress={() => { try { draft.change(splitVideoRally(doc, t, createClientId()), 'Corte sugerido aceito'); } catch (failure) { setError((failure as Error).message); } }}>Criar rally</StudioAction> : null}</li>)}</ul></details> : null}
          {canEdit && youtubeId && localVideoAiAvailable() && !analysisOpen ? <details className="sv-disclosure"><summary>Análise automática</summary><StudioAction label="Análise automática pelo link" onPress={() => { setAnalysisOpen(true); setTab('validation'); setPanel(true); }}>Revisar rallies e contatos</StudioAction></details> : null}
        </> : null}

        {tab === 'history' ? <><div className="sv-row"><h2>Histórico desta edição</h2><StudioAction label="Desfazer" icon="restore" disabled={!canEdit || !draft.history?.past.length} onPress={() => undo()}/><StudioAction label="Refazer" icon="redo" disabled={!canEdit || !draft.history?.future.length} onPress={() => undo(true)}/></div>{draft.history?.past.slice().reverse().map((h, i) => <div key={i} className="sv-history"><b>{h.label}</b><small>{new Date(h.at).toLocaleTimeString('pt-BR')}</small></div>)}</> : null}

      </StudioPanel><footer className="sv-footer">{local ? <small>{draft.saving?'Salvando…':draft.dirty?'Alterações neste computador':'Salvo neste computador'}</small> : props.shared ? <small>Somente leitura</small> : readOnly ? <small>Prévia de leitura</small> : <VideoSyncFooter status={draft.syncStatus} dirty={draft.dirty} saving={draft.saving}/>}</footer></aside></VideoBenchInspector>{props.bench && !benchToolsOpen && (local?.error || error || draft.error || draft.conflict) ? <div className="sv-alert" role="alert">{local?.error || error || draft.error || 'Confira o conflito da edição antes de continuar.'}<StudioAction label="Abrir aviso nas ferramentas do vídeo" onPress={() => { setTab('validation'); setAnalysisOpen(true); setPanel(true); setBenchToolsOpen(true); }}>Ver aviso</StudioAction></div> : null}{props.bench && local ? <small className="sv-bench-local-state" role="status">{local.error || draft.error ? 'Confira o aviso nas ferramentas do vídeo' : local.original ? 'Vídeo original no computador' : local.message}</small> : null}

    </main>

    {(modal === 'import' || modal === 'camera-source') && permissions.importMedia && !syncBlocked ? <StudioDialog className="sv-import sv-source-dialog" title={modal === 'camera-source' ? 'Conectar câmera' : 'Adicionar vídeo'} headerActions={modal === 'camera-source' ? <StudioAction label="Voltar para fontes de vídeo" icon="chevronBack" onPress={() => { restoreSourceFocus.current = true; setModal('import'); }}>Voltar</StudioAction> : undefined} onClose={() => { if (!loadingFile.current && !processing.current) { setPreviewId(''); setModal(null); } }}>
      {modal === 'camera-source' ? <div ref={bindCameraSource} className="sv-source-camera" role="region" aria-label="Conexão da câmera" tabIndex={-1}/> : <>
      <VideoLinkField value={youtubeLink} disabled={!!job || driveBusy} valid={!!youtubeDuration} error={!!error} onChange={value => { setYoutubeLink(value); setPreviewId(''); setYoutubeDuration(0); setError(''); }} onVerify={() => { try { if (linkKind !== 'youtube') throw new Error('Use um link do YouTube ou Google Drive.'); const id = youtubeVideoId(youtubeLink); playback.current?.pause(); setYoutubeDuration(0); setYoutubeAttempt(n => n + 1); setPreviewId(id); setError(''); } catch (failure) { setError((failure as Error).message); } }}/>
      <ConnectedVideoSources youtubeId={youtubeId} originalName={readyOriginal?.media.name} onRemove={kind => {
        if (!doc) return;
        playback.current?.pause(); setPlaying(false); setUseOriginal(false); setOriginal(null);
        if (kind === 'youtube') {
          const { youtubeId: removedId, ...media } = doc.media;
          void removedId;
          const analysis = doc.analysis ? { ...doc.analysis, source: undefined } : undefined;
          draft.change({ ...doc, media, analysis }, 'Link do YouTube removido'); setSource(''); setFile(null); setYoutubeLink(''); setPreviewId('');
        }
      }}/>
      {linkKind ? <p className="sv-source-kind">{linkKind === 'drive' ? 'Google Drive' : 'YouTube'}</p> : null}
      {linkKind === 'drive' ? doc && youtubeId && canEdit && driveTrackingAvailable() ? <DriveTrackingSetup embedded inputLink={youtubeLink} onBusyChange={setDriveBusy} doc={doc} scope={{ userId: props.userId, org: props.org, classId: props.classId, sessionId: props.sessionId, targetFingerprint: doc.media.fingerprint }} onClose={() => setModal(null)} onPlayback={(media, url) => { showDriveOriginal(media, url); setModal(null); }} onApply={(analysis, media, url) => { draft.change({ ...doc, analysis }, 'Tracking do Drive associado ao YouTube'); showDriveOriginal(media, url, analysis.source); setModal(null); }}/>
        : <p className="sv-section-meta">Abra o vídeo do YouTube para associar este original do Drive.</p> : <>
        {previewId ? <><YouTubeVideo key={`${previewId}:${youtubeAttempt}`} id={previewId} onMetadata={duration => { if (duration > 86400) setError('Escolha um vídeo de até 24 horas.'); else setYoutubeDuration(duration); }} onError={message => { setYoutubeDuration(0); setError(message); }}/><StudioAction label="Usar vídeo do YouTube" primary disabled={!youtubeDuration || !!job} onPress={() => { void openYouTube(); }}>Usar vídeo</StudioAction><small>Links não listados podem ser repassados fora do Go Atleta.</small></> : null}
      </>}
      {job ? <p role="status">{job}</p> : null}{error ? <p className="sv-alert" role="alert">{error}</p> : null}
      <div className={`sv-source-file${props.onCameraSourceTarget ? ' sv-source-options' : ''}`}>{!props.onCameraSourceTarget ? <span>ou</span> : null}<StudioAction label="Escolher arquivo de vídeo" icon="add" disabled={!!job || driveBusy} onPress={() => fileInput.current?.click()}>Escolher arquivo</StudioAction>{props.onCameraSourceTarget ? <span ref={cameraSourceTrigger} className="sv-source-camera-trigger"><StudioAction label="Conectar câmera" icon="video" disabled={!!job || driveBusy} onPress={() => {
        if (!props.onCameraSourceTarget || !permissions.importMedia || syncBlocked || job || driveBusy || loadingFile.current || processing.current) return;
        setPreviewId(''); setModal('camera-source');
      }}>Conectar câmera</StudioAction></span> : null}</div>
      {doc && linkKind !== 'drive' ? <details className="sv-disclosure"><summary>Vídeo atual e ferramentas</summary><p className="sv-media-meta">{doc.media.name}<span>{videoTime(doc.media.duration)} · {doc.rallies.length} rallies · {doc.contacts.length} contatos</span></p>
        {!youtubeId ? <div className="sv-wrap"><StudioAction label="Automático" active={automatic} disabled={!!job || !canEdit} onPress={() => setAutomatic(true)}>Análise automática</StudioAction><StudioAction label="Manual" active={!automatic} disabled={!!job} onPress={() => { setAutomatic(false); setSuggestion(null); }}>Manual</StudioAction></div> : null}
              {automatic && doc && !youtubeId ? <>
        <p><small>Sugestões experimentais para revisão. Até 30 minutos; mantenha esta aba aberta.</small></p>
        <label className="sv-field">Modelo de tracking<span><select aria-label="Modelo de tracking" value={trackingModel} disabled={!!job || !!suggestion} onChange={e => setTrackingModel(e.target.value === 'v4c' ? 'v4c' : 'v2b')}><option value="v2b">VballNet GridV2b · recomendado</option><option value="v4c">VballNet V4c · comparar</option></select></span></label>
        {job && analyzing ? <><progress value={progress ?? 0} max={1} aria-label="Progresso da análise"/><StudioAction label="Cancelar análise" onPress={() => processing.current?.abort()}>Cancelar análise</StudioAction></> : null}
        {!job && !suggestion ? <StudioAction label="Analisar vídeo" primary disabled={!canEdit} onPress={() => { void analyze(); }}>Analisar vídeo</StudioAction> : null}
        {suggestion && !job ? <div><p role="status">Análise pronta · {suggestion.positions.length} posições da bola · {suggestion.cuts.length} cortes sugeridos</p><StudioAction label="Usar sugestões" primary disabled={!canEdit} onPress={() => { draft.change(acceptVideoAnalysis(doc, suggestion), 'Análise automática'); setSuggestion(null); setModal(null); setTab('validation'); setPanel(true); }}>Usar sugestões</StudioAction></div> : null}
      </> : null}

        <StudioAction label="Importar análise processada" disabled={driveBusy} onPress={() => importInput.current?.click()}>Importar análise</StudioAction>
      </details> : null}</>}
    </StudioDialog> : null}




    {modal === 'contact' ? <StudioDialog title="Qual foi o contato?" onClose={() => setModal(null)}><small>{videoTime(time, true)}</small><div className="sv-skills">{videoSkills.map(skill => <StudioAction key={skill} label={skill} onPress={() => addContact(skill)}>{skill}</StudioAction>)}</div></StudioDialog> : null}

    {modal === 'exit' ? <StudioDialog title="Salvar antes de sair?" onClose={cancelLeave}><p>{editorDirty ? 'Há um contato em edição. Volte e registre o contato antes de salvar.' : 'Salve as alterações antes de sair.'}</p><div className="sv-wrap"><StudioAction label="Continuar editando" onPress={cancelLeave}>Continuar editando</StudioAction><StudioAction label="Sair sem salvar" onPress={finishLeave}>Sair sem salvar</StudioAction><StudioAction label="Salvar e sair" primary disabled={editorDirty || draft.saving} onPress={() => { const epoch = activityEpoch.current; void draft.save().then(ok => { if (ok && isCurrentActivity(epoch))

        finishLeave(); }); }}>Salvar e sair</StudioAction></div>{draft.error ? <p role="alert">{draft.error}</p> : null}</StudioDialog> : null}

    {modal === 'download' ? <StudioDialog title="Preparando download" onClose={() => { exporting.current?.abort(); setModal(null); }}><p role="status">{job}</p>{progress !== null ? <progress value={progress} max={1} aria-label="Progresso da exportação"/> : null}<p><small>Recortes preparados em tempo real, sem sobreposição da bola.</small></p>{error ? <p role="alert">{error}</p> : null}</StudioDialog> : null}

    {modal === 'share' && doc && permissions.manageSharing ? <VideoShareDialog doc={doc} file={file} teams={teams} scope={{ org: props.org, sessionId: props.sessionId }} onClose={() => setModal(null)} onPreview={() => { setReadOnly(!readOnly); setEditor(null); setModal(null); }}/> : null}

  </div>;

}
const embeddedStyles = `.sv.sv-embedded{position:relative;inset:auto;z-index:auto;width:100%;height:100%;flex:1;min-height:0;padding:0}.sv .sv-head.sv-embedded-toolbar{min-height:38px;padding:0;margin:0;gap:6px;border:0}`;
