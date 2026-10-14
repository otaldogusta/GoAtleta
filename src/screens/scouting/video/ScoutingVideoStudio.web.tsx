import { contactChanged, videoLinkKind } from './studio-editing';
import { YouTubeAnalysis } from './YouTubeAnalysis.web';
import { YouTubeTrackingSetup } from './YouTubeTrackingSetup.web';
import { DriveTrackingSetup } from './DriveTrackingSetup.web';
import { driveTrackingAvailable } from '../../../api/scouting-video-drive';
import { YouTubeTrackingPanel } from './YouTubeTrackingPanel.web';
import { localVideoAiAvailable } from '../../../api/scouting-video-ai';
import { youtubeVideoId } from '../../../core/scouting-video-youtube';
import { YouTubeVideo } from './YouTubeVideo.web';
import type { VideoPlayback } from './youtube-player.web';
import { matchesTrackingOriginal, originalPlayback } from './original-playback.web';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import { createPortal } from 'react-dom';
import { markRender, measureAsync } from '../../../observability/perf';

import { loadScoutingDetail } from '../../../db/scouting-collection';

import { createClientId } from '../../../core/client-id';

import { acceptVideoAnalysis, markVideoPoint, mergeVideoRally, parseVideoDocument, splitVideoRally, videoContacts, videoRange, videoRallyIndex, videoSkills, videoTime, type BallPosition, type VideoContact, type VideoSkill, type VideoAnalysis, type VideoMedia } from '../../../core/scouting-video';

import { useAppTheme } from '../../../ui/app-theme';

import { StudioAction, StudioDialog } from './StudioUI.web';

import { studioStyles } from './studio-styles';

import { useVideoDraft } from './use-video-draft';

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
import type { AuthorizedStudioProps, StudioProps, StudioViewProps } from './types';

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

    return createPortal(session ? <Studio key={`${props.org}:${props.userId}:${props.sessionId}`} {...props} session={session}/> : <div role="dialog" aria-label="Abrir estúdio" style={{ position: 'fixed', inset: 0, zIndex: 6100, display: 'grid', placeContent: 'center', gap: 12, background: colors.background, color: colors.text }}><p role="status">{error || 'Abrindo análise…'}</p><StudioAction label="Voltar" onPress={props.onClose}>Voltar</StudioAction></div>, document.body);

}

export function Studio(props: StudioViewProps) {

    const { colors } = useAppTheme(), draft = useVideoDraft(props.org, props.userId, props.sessionId, props.shared?.document);

    const { doc } = draft, video = useRef<HTMLVideoElement>(null), fileInput = useRef<HTMLInputElement>(null), importInput = useRef<HTMLInputElement>(null), trackInput = useRef<HTMLInputElement>(null), stage = useRef<HTMLDivElement>(null);

    const playback = useRef<VideoPlayback | null>(null), localOwner = useRef<VideoPlayback | null>(null), originalInput = useRef<HTMLInputElement>(null);
    const youtubeId = doc?.media.youtubeId;
    const [original, setOriginal] = useState<{ youtubeId: string; media: VideoMedia; url: string; kind: 'blob' | 'drive'; confirmedSource?: string } | null>(null), [useOriginal, setUseOriginal] = useState(false);
    const [youtubeAttempt, setYoutubeAttempt] = useState(0), [playbackRate, setPlaybackRate] = useState(1);
    const [driveBusy, setDriveBusy] = useState(false);
    const [youtubeLink, setYoutubeLink] = useState(''), [previewId, setPreviewId] = useState(''), [youtubeDuration, setYoutubeDuration] = useState(0);
    const [source, setSource] = useState(props.shared?.source ?? ''), [file, setFile] = useState<File | null>(null), [time, setTime] = useState(0), [playing, setPlaying] = useState(false), [selectedFocus, setFocus] = useState<string | null>(null);
    const readyOriginal = youtubeId && original?.youtubeId === youtubeId && doc?.analysis?.source && matchesTrackingOriginal(original.kind === 'drive' && original.confirmedSource === doc.analysis.source.fingerprint ? { ...original.media, fingerprint: original.confirmedSource } : original.media, doc.analysis.source) ? original : null;
    const originalActive = !!readyOriginal && useOriginal;
    const iframePlayback = !!youtubeId && !originalActive;
    const playbackSource = originalActive ? readyOriginal!.url : source;
    const nativeOffset = originalActive ? doc!.analysis!.source!.offsetSeconds : 0;
    const bindLocalVideo = useCallback((node: HTMLVideoElement | null) => {
        video.current = node;
        if (node) { const owned = originalPlayback(node, nativeOffset); localOwner.current = owned; playback.current = owned; }
        else { if (playback.current === localOwner.current) playback.current = null; localOwner.current = null; }
    }, [nativeOffset]);
    useEffect(() => () => { if (original?.kind === 'blob') URL.revokeObjectURL(original.url); }, [original]);

    const [header, setHeader] = useState(true), [panel, setPanel] = useState(true), [tab, setTab] = useState<'rallies' | 'contacts' | 'validation' | 'history'>('rallies');

    const [modal, setModal] = useState<'import' | 'contact' | 'exit' | 'download' | 'share' | 'youtube-ai' | 'youtube-tracking' | null>(null), [progress, setProgress] = useState<number | null>(null), [job, setJob] = useState(''), [error, setError] = useState('');

    useEffect(() => { if (modal && youtubeId) playback.current?.pause(); }, [modal, youtubeId]);

    const [editor, setEditor] = useState<VideoContact | null>(null), [readOnly, setReadOnly] = useState(false), [trackVisible, setTrackVisible] = useState(true), [correcting, setCorrecting] = useState(false), [manualTracking, setManualTracking] = useState<{ source: string; analysis?: VideoAnalysis; positions: BallPosition[] } | null>(null);

    const [controls, setControls] = useState(true), hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null), alive = useRef(true), exporting = useRef<AbortController | null>(null), loadingFile = useRef(false);

    const focus = selectedFocus && doc?.rallies.some(r => r.id === selectedFocus) ? selectedFocus : null;
    const editorId = editor?.id;
    const editorDirty = !!editor && contactChanged(editor, doc?.contacts.find(c => c.id === editor.id));
    const linkKind = videoLinkKind(youtubeLink);
    const { tracking, suggestedCuts } = useMemo(() => ({
        tracking: manualTracking?.source === source && manualTracking.analysis === doc?.analysis ? manualTracking.positions : doc?.analysis?.positions ?? [],
        suggestedCuts: doc?.analysis?.cuts.filter(t => !doc.rallies.some(r => Math.abs(r.start - t) < .1)) ?? [],
    }), [manualTracking, source, doc]);
    const [analyzing, setAnalyzing] = useState(false);
    const contactEditor = useRef<HTMLDivElement>(null), pointSection = useRef<HTMLDivElement>(null);

    useEffect(() => { if (editorId && tab === 'contacts')

        contactEditor.current?.scrollIntoView({ block: 'nearest' }); }, [editorId, tab]);

    const [automatic, setAutomatic] = useState(false), [suggestion, setSuggestion] = useState<VideoAnalysis | null>(null);
    const [trackingModel, setTrackingModel] = useState<'v2b' | 'v4c'>('v2b');
    const processing = useRef<AbortController | null>(null);
    useEffect(() => () => processing.current?.abort(), []);
    const analyze = async () => {
      if (!doc || !file || processing.current || !canEdit) return;
      const controller = new AbortController(); processing.current = controller; setAnalyzing(true);
      setError(''); setSuggestion(null); setProgress(0); playback.current?.pause();
      try {
        const result = await processScoutingVideo(file, doc.media.duration, controller.signal, (done, total, stage) => { if (alive.current && !controller.signal.aborted) { setProgress(done / total); setJob(stage); } }, { model: trackingModel });
        if (alive.current && !controller.signal.aborted) setSuggestion(result);
      } catch (failure) { if (alive.current && !controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Falha ao analisar vídeo.'); }
      finally { processing.current = null; if (alive.current) { setAnalyzing(false); setJob(''); setProgress(null); } }
    };
    const [picture, setPicture] = useState({ width: 0, height: 0 });

    const themes = { '--sv-bg': colors.background, '--sv-panel': colors.card, '--sv-input': colors.inputBg, '--sv-text': colors.text, '--sv-muted': colors.muted, '--sv-line': colors.border, '--sv-green': colors.primaryBg, '--sv-amber': colors.warning,
      '--sv-error-solid': colors.danger, '--sv-error-bg': colors.dangerBg, '--sv-error-text': colors.dangerText,
      '--sv-warning-solid': colors.warning, '--sv-warning-bg': colors.warningBg, '--sv-warning-text': colors.warningText,
      '--sv-point-solid': colors.success, '--sv-point-bg': colors.successBg, '--sv-point-text': colors.successText,
      '--sv-positive-solid': colors.info, '--sv-positive-bg': colors.infoBg, '--sv-positive-text': colors.infoText,
    } as CSSProperties;

    const teams = useMemo(() => ({ us: props.teamName || 'Nossa equipe', them: props.session.opponent || 'Adversário' }), [props.teamName, props.session.opponent]);

    const permissions = videoStudioPermissions(!!props.shared, readOnly, props.session.status === 'em_andamento');
    const canEdit = permissions.annotate;
    const mediaResume = useRef<{ time: number; playing: boolean; rate: number } | null>(null);
    const sharedSource = props.shared?.source;
    useEffect(() => {
        if (!sharedSource || sharedSource === source) return;
        const node = playback.current;
        if (node) mediaResume.current = { time: node.currentTime, playing: !node.paused, rate: node.playbackRate };
        // Preserve playback before replacing an externally renewed signed media URL.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSource(sharedSource);
    }, [sharedSource, source]);

    const activeIndex = doc ? (focus ? Math.max(0, doc.rallies.findIndex(r => r.id === focus)) : videoRallyIndex(doc, time)) : 0;

    const active = doc?.rallies[activeIndex];

    const showControls = useCallback(() => { setControls(true); if (hideTimer.current)

        clearTimeout(hideTimer.current); hideTimer.current = setTimeout(() => { if (playback.current && !playback.current.paused)

        setControls(false); }, 2800); }, [playback]);

    useEffect(() => { const app = document.getElementById('root'), prior = app?.inert, previousFocus = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow; if (app)

        app.inert = true; document.body.style.overflow = 'hidden'; alive.current = true; return () => { alive.current = false; if (app)

        app.inert = prior ?? false; document.body.style.overflow = overflow; previousFocus?.focus(); exporting.current?.abort(); if (hideTimer.current)

        clearTimeout(hideTimer.current); }; }, []);

    useEffect(() => () => { if (source)

        URL.revokeObjectURL(source); }, [source]);

    const mediaWidth = originalActive ? readyOriginal?.media.width : doc?.media.width, mediaHeight = originalActive ? readyOriginal?.media.height : doc?.media.height;
    useEffect(() => { const node = stage.current; if (!node || !mediaWidth || !mediaHeight)

        return; const measure = () => { const r = node.getBoundingClientRect(), scale = Math.min(r.width / mediaWidth, r.height / mediaHeight); setPicture({ width: mediaWidth * scale, height: mediaHeight * scale }); }; measure(); const observer = new ResizeObserver(measure); observer.observe(node); return () => observer.disconnect(); }, [mediaWidth, mediaHeight, playbackSource]);

    useEffect(() => { const unload = (e: BeforeUnloadEvent) => { if (draft.dirty || editorDirty) {

        e.preventDefault();

        e.returnValue = '';

    } }; window.addEventListener('beforeunload', unload); return () => window.removeEventListener('beforeunload', unload); }, [draft.dirty, editorDirty]);

    const undo = (redo = false) => { if (!canEdit)

        return; if (editor) {

        setError('Registre ou cancele o contato em edição antes de desfazer.');

        setTab('contacts');

        return;

    } draft.undo(redo); setEditor(null); };

    useEffect(() => { const key = (e: KeyboardEvent) => { if ((e.target as HTMLElement)?.closest('input,select,textarea,[contenteditable=true]') || modal)

        return; if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && canEdit) {

        e.preventDefault();

        undo(e.shiftKey);

    } }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); });

    const seek = (position: number, pause = true) => { if (!playback.current || !doc)

        return; const [start, end] = videoRange(doc, focus); if (pause) playback.current.pause(); playback.current.currentTime = Math.max(start, Math.min(end - .001, position)); setTime(playback.current.currentTime); showControls(); };

    const chooseRally = useCallback((id: string | null) => { if (!doc)

        return; setFocus(id); if (id && playback.current) {

        playback.current.pause();

        playback.current.currentTime = videoRange(doc, id)[0];

        setTime(playback.current.currentTime);

    } showControls(); }, [doc, showControls, playback]);

    const play = () => { const v = playback.current; if (!v || !doc)

        return; if (!v.paused) {

        v.pause();

        return;

    } const [start, end] = videoRange(doc, focus);
    const availableStart = originalActive ? Math.max(start, nativeOffset) : start;
    const availableEnd = originalActive ? Math.min(end, readyOriginal!.media.duration + nativeOffset) : end;
    if (availableEnd <= availableStart) { setError('Este trecho não está no original. Reproduza pelo YouTube.'); return; }
    if (v.currentTime < availableStart || v.currentTime >= availableEnd - .05)
        v.currentTime = availableStart; void v.play().catch(() => setError('Não foi possível reproduzir o vídeo.')); showControls(); };

    const tick = () => { const v = playback.current; if (!v || !doc)

        return; const [, rangeEnd] = videoRange(doc, focus);
        const end = originalActive ? Math.min(rangeEnd, readyOriginal!.media.duration + nativeOffset) : rangeEnd;
        if ((focus || originalActive) && v.currentTime >= end) {

        v.pause();

        v.currentTime = Math.max(0, end - .001);

    } setTime(v.currentTime); };

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
        setOriginal({ youtubeId: target.media.youtubeId, media: { fingerprint: linked.fingerprint, name: linked.name, duration: linked.duration, width: linked.width, height: linked.height }, url: URL.createObjectURL(value), kind: 'blob' });
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
        if (!permissions.importMedia || !youtubeId || !linked || loadingFile.current) return;
        loadingFile.current = true; setJob('Conferindo original…'); setError('');
        try {
            const media = await inspectVideo(value);
            if (!alive.current) return;
            if (!matchesTrackingOriginal(media, linked))
                throw new Error('Escolha o mesmo arquivo original usado neste tracking.');
            showOriginal(value);
        } catch (failure) { if (alive.current) setError((failure as Error).message); }
        finally { loadingFile.current = false; if (alive.current) setJob(''); }
    };
    const restorePlayback = () => {
        const value = playback.current, resume = mediaResume.current;
        if (!value || !resume) return;
        value.currentTime = resume.time; value.playbackRate = resume.rate;
        mediaResume.current = null; setTime(value.currentTime);
        if (resume.playing) void value.play().catch(() => undefined);
    };

    const loadFile = async (value: File) => {

        if (!permissions.importMedia || loadingFile.current)

            return;

        loadingFile.current = true;

        setError('');

        setJob('Reconhecendo vídeo…'); setPreviewId('');

        try {

            if (draft.dirty && !(await draft.save()))

                return;

            const meta = await inspectVideo(value);

            if (!alive.current)

                return;

            await draft.open(meta);

            if (!alive.current)

                return;

            setFile(value); setPlaying(false); setCorrecting(false); setTab('rallies'); setPanel(true);

            setSource(URL.createObjectURL(value));

            setFocus(null);

            setTime(0); setPlaybackRate(1);

            setManualTracking(null); setSuggestion(null);

            setEditor(null);

            setJob('Vídeo reconhecido');

        }

        catch (failure) {

            if (alive.current)

                setError(failure instanceof Error ? failure.message : 'Não foi possível abrir o vídeo.');

        }

        finally {

            loadingFile.current = false;

            if (alive.current)

                setJob('');

        }

    };

    const openYouTube = async () => {
        if (!permissions.importMedia || loadingFile.current || !previewId || !youtubeDuration || editor) return;
        loadingFile.current = true; setJob('Abrindo vídeo…'); setError('');
        try {
            if (draft.dirty && !(await draft.save())) return;
            playback.current?.pause();
            await draft.open({ youtubeId: previewId, fingerprint: `youtube:${previewId}`, name: `YouTube · ${previewId}`, duration: youtubeDuration, width: 1280, height: 720 });
            if (!alive.current) return;
            setFile(null); setSource(`youtube:${previewId}`); setFocus(null); setTime(0); setPlaybackRate(1); setPlaying(false);
            setManualTracking(null); setSuggestion(null); setCorrecting(false); setAutomatic(false); setPreviewId(''); setModal(null); setTab('rallies'); setPanel(true);
        } catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : 'Não foi possível abrir o vídeo.'); }
        finally { loadingFile.current = false; if (alive.current) setJob(''); }
    };

    const addContact = (skill: VideoSkill) => { if (!doc || !canEdit)

        return; playback.current?.pause(); setEditor({ id: createClientId(), time: Math.min(playback.current?.currentTime ?? time, doc.media.duration - .001), skill, team: 'us', athlete: '', studentId: null, outcome: '' }); setModal(null); setTab('contacts'); setPanel(true);  };

    const openContact = (contact: VideoContact) => {
        if (editor && editor.id !== contact.id && editorDirty) {
            setError('Salve ou cancele o contato em edição.'); setTab('contacts'); setPanel(true); return;
        }
        playback.current?.pause(); seek(contact.time); setTab('contacts'); setPanel(true);
        if (canEdit && editor?.id !== contact.id) setEditor({ ...contact });
    };

    const saveContact = () => { if (!doc || !editor || !canEdit || !editorDirty)

        return; draft.change({ ...doc, contacts: [...doc.contacts.filter(c => c.id !== editor.id), editor].sort((a, b) => a.time - b.time) }, 'Contato · ' + editor.skill); setEditor(null); };

    const markPoint = () => {
        if (!doc || !active || !canEdit || editor) return;
        playback.current?.pause();
        const position = Math.min(playback.current?.currentTime ?? time, doc.media.duration - .001);
        const rally = doc.rallies[videoRallyIndex(doc, position)];
        try {
            draft.change(markVideoPoint(doc, rally.id, position), 'Instante do ponto');
            setTime(position); setTab('contacts'); setPanel(true);
            requestAnimationFrame(() => pointSection.current?.scrollIntoView({ block: 'nearest' }));
        } catch (failure) { setError((failure as Error).message); }
    };

    const split = () => { if (!doc || !canEdit)

        return; try {

        const id = createClientId();

        draft.change(splitVideoRally(doc, time, id), 'Divisão do rally');

        setFocus(id);

    }

    catch (failure) {

        setError((failure as Error).message);

    } };

    const exportAnalysis = useCallback(() => { if (doc && permissions.download)

        downloadVideoBlob(new Blob([JSON.stringify({ ...doc, contacts: doc.contacts.map(c => ({ ...c, studentId: null })) })], { type: 'application/json' }), 'analise-scouting.json'); }, [doc, permissions.download]);

    const importAnalysis = async (input: File) => { if (!doc || !canEdit)

        return; try {

        if (input.size > 5000000)

            throw new Error('Arquivo de análise muito grande.');

        const value = parseVideoDocument(JSON.parse(await input.text()), doc.media);

        draft.change({ ...value, contacts: value.contacts.map(c => ({ ...c, studentId: props.students.some(s => s.id === c.studentId) ? c.studentId : null })) }, 'Importação de análise');

        setFocus(null);

        setEditor(null);
        setModal(null);

    }

    catch (failure) {

        setError((failure as Error).message);

    } };

    const importTracking = async (input: File) => { if (!doc || !canEdit)

        return; try {

        if (input.size > 15000000)

            throw new Error('Arquivo de trajetória muito grande.');

        const value = JSON.parse(await input.text()) as {

            fingerprint: string;

            positions: BallPosition[];

        };

        if (value.fingerprint !== doc.media.fingerprint || !Array.isArray(value.positions) || value.positions.length > 150000 || value.positions.some(p => !p || ![p.time, p.x, p.y].every(Number.isFinite) || p.time < 0 || p.time >= doc.media.duration || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1))

            throw new Error('Trajetória inválida ou de outro vídeo.');

        setManualTracking({ source, analysis: doc.analysis, positions: [...value.positions].sort((a, b) => a.time - b.time) });

    }

    catch (failure) {

        setError((failure as Error).message);

    } };

    const download = useCallback(async (ids: string[] | null) => {

        if (!permissions.download || !file || !doc || exporting.current)

            return;

        if (!ids) {

            downloadVideoBlob(file, file.name);

            return;

        }

        const rallies = doc.rallies.filter(r => ids.includes(r.id));

        if (!rallies.length)

            return;

        if (rallies.reduce((sum, r) => { const [s, e] = videoRange(doc, r.id); return sum + e - s; }, 0) > 600) {

            setError('Selecione até 10 minutos de recortes por download.');

            return;

        }

        const controller = new AbortController();

        exporting.current = controller;

        setModal('download');

        setProgress(0);

        setError('');

        try {

            const files = [];

            for (let i = 0; i < rallies.length; i++) {

                setJob(`Preparando rally ${i + 1} de ${rallies.length}`);

                const [start, end] = videoRange(doc, rallies[i].id);

                const blob = await recordVideoClip(source, start, end, p => { if (alive.current)

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

            exporting.current = null;

            if (alive.current) {

                setProgress(null);

                setJob('');

            }

        }

    }, [doc, file, source, permissions.download]);

    const openAnalysisImport = useCallback(() => {
        if (canEdit && !editor) importInput.current?.click();
        else setError(canEdit ? 'Registre ou cancele o contato antes de importar a análise.' : 'Esta análise está em modo de leitura.');
    }, [canEdit, editor]);

    const close = () => { playback.current?.pause(); if (draft.dirty || editorDirty)

        setModal('exit');

    else

        props.onClose(); };

    return <div className="sv" data-youtube={!!youtubeId} data-modal-open={!!modal} data-header-open={header} style={themes} role="dialog" aria-modal="true" aria-label="Estúdio de scouting"><style>{studioStyles}</style>

    <header className={`sv-head${header ? '' : ' collapsed'}`}><StudioAction label="Voltar ao scouting" icon="chevronBack" onPress={close}/><div className="sv-title"><h1>Estúdio de scouting</h1><small>{`${props.session.title}${doc ? (focus ? ' · rally selecionado' : ' · vídeo completo') : ''}`}</small></div>{permissions.manageSharing ? <StudioAction label="Compartilhar análise" icon="share" disabled={!doc || !!editor} onPress={() => setModal('share')}><span className="sv-head-label">Compartilhar</span></StudioAction> : null}{permissions.importMedia ? <StudioAction label="Adicionar vídeo" disabled={!!editor} icon="add" onPress={() => setModal('import')}><span className="sv-add-video-label">Vídeo</span></StudioAction> : null}{readOnly && !props.shared ? <StudioAction label="Voltar à edição" onPress={() => setReadOnly(false)}>Voltar à edição</StudioAction> : null}{canEdit ? <StudioAction label="Salvar rascunho" primary icon="save" disabled={!draft.dirty || draft.saving} onPress={() => { void draft.save(); }}><span className="sv-head-label">{draft.saving ? 'Salvando…' : 'Salvar rascunho'}</span></StudioAction> : <small>Somente leitura</small>}<StudioAction label={header ? 'Recolher cabeçalho' : 'Expandir cabeçalho'} icon={header ? 'chevronUp' : 'chevronDown'} onPress={() => setHeader(!header)}/></header>

    <input ref={originalInput} type="file" accept="video/*,.mp4,.webm,.mov" hidden onChange={e => { const value = e.target.files?.[0]; e.target.value = ''; if (value) void loadOriginal(value); }}/>

    <input ref={fileInput} type="file" accept="video/*,.mp4,.webm,.mov" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) {

        setModal('import');

        void loadFile(f);

    } }}/>

    <input ref={importInput} type="file" accept="application/json,.json" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f)

        void importAnalysis(f); }}/><input ref={trackInput} type="file" accept="application/json,.json" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f)

        void importTracking(f); }}/>

    <main className="sv-workspace"><section className="sv-main" aria-label="Vídeo e timeline"><div className="sv-stage" ref={stage} onPointerMove={showControls} onPointerDown={showControls}>{source && doc ? iframePlayback ? <YouTubeVideo key={youtubeId} id={youtubeId!} playback={playback} onReady={restorePlayback} onTick={tick} onState={setPlaying} onError={setError}/> : <><div className="sv-picture" onClick={e => { if (!correcting || !canEdit)

            return; const rect = e.currentTarget.getBoundingClientRect(), x = (e.clientX - rect.left - (rect.width - picture.width) / 2) / picture.width, y = (e.clientY - rect.top - (rect.height - picture.height) / 2) / picture.height; if (x < 0 || x > 1 || y < 0 || y > 1)

            return; draft.change({ ...doc, corrections: [...doc.corrections.filter(p => Math.abs(p.time - time) >= .025), { time, x, y }].sort((a, b) => a.time - b.time) }, 'Posição da bola'); setCorrecting(false); }}>

      <video ref={bindLocalVideo} src={playbackSource} crossOrigin="anonymous" playsInline preload="metadata" onTimeUpdate={tick} onSeeked={tick} onPlay={() => setPlaying(true)} onPause={() => { setPlaying(false); setControls(true); }} onLoadedMetadata={() => { restorePlayback(); tick(); }} onError={() => props.shared ? props.shared.onMediaError() : setError(originalActive && readyOriginal?.kind === 'drive' ? 'Falha ao reproduzir o Drive. Confira a conexão e abra o link novamente.' : 'Falha ao reproduzir o vídeo. Escolha o arquivo novamente.')}/>
      <VideoFrame video={video} source={playbackSource} width={picture.width} height={picture.height}/>

      <VideoTrackingOverlay video={video} source={playbackSource} timeOffset={nativeOffset} cuts={doc.analysis?.cuts} positions={tracking} corrections={doc.corrections} rallies={doc.rallies} width={picture.width} height={picture.height} color={colors.primaryBg} correctionColor={colors.warning} visible={trackVisible}/>
</div>{correcting ? <p style={{ position: 'absolute', bottom: 20, color: 'white', background: '#0009', padding: 8 }}>Clique na posição da bola</p> : null}</> : <div className="sv-empty"><h2>Seu jogo começa aqui</h2><p>Adicione um vídeo para analisar cada rally.</p><StudioAction primary label="Adicionar vídeo" icon="add" onPress={() => setModal('import')}>Adicionar vídeo</StudioAction></div>}</div>

      {doc && source ? <div className={`sv-player${controls || youtubeId ? '' : ' hidden-controls'}`}><div className="sv-transport"><StudioAction label={iframePlayback ? 'Voltar 1 segundo' : 'Voltar 0,033 segundo'} icon="skipBack" onPress={() => seek((playback.current?.currentTime ?? time) - (iframePlayback ? 1 : 1 / 30))}/><StudioAction label={playing ? 'Pausar vídeo' : 'Reproduzir vídeo'} primary icon={playing ? 'pause' : 'play'} onPress={play}/><StudioAction label={iframePlayback ? 'Avançar 1 segundo' : 'Avançar 0,033 segundo'} icon="skipForward" onPress={() => seek((playback.current?.currentTime ?? time) + (iframePlayback ? 1 : 1 / 30))}/><time>{videoTime(time, true)}</time><span className="sv-spacer"/>{canEdit ? <StudioAction label="Marcar contato" disabled={!!editor} icon="add" onPress={() => { playback.current?.pause(); setModal('contact'); }}/> : null}{canEdit ? <StudioAction label="Marcar ponto" icon="flag" disabled={!!editor} onPress={markPoint}/> : null}<select aria-label="Velocidade de reprodução" value={playbackRate} onChange={e => { setPlaybackRate(Number(e.target.value)); if (playback.current)

        playback.current.playbackRate = Number(e.target.value); }}>{[.25, .5, 1, 1.5, 2].map(n => <option key={n} value={n}>{n}×</option>)}</select></div><VideoTimeline doc={doc} draftContact={editor} teams={teams} time={time} focus={focus} tracking={tracking} onFocus={chooseRally} onContact={openContact} onSeek={position => seek(position, false)}/></div> : null}</section>

      <aside className={`sv-inspector${panel ? '' : ' closed'}`} hidden={!doc}><nav className="sv-tabs" aria-label="Painel da análise">{(['rallies', 'contacts', 'validation'] as const).map(value => <StudioAction key={value} label={value === 'rallies' ? 'Rallies' : value === 'contacts' ? 'Contatos' : 'Informações'} active={tab === value} onPress={() => { setTab(value); setPanel(true); }}>{value === 'rallies' ? <>Rallies <span className="sv-badge">{doc?.rallies.length}</span></> : value === 'contacts' ? 'Contatos' : 'Informações'}</StudioAction>)}<StudioAction label={panel ? 'Recolher painel' : 'Expandir painel'} icon={panel ? 'chevronDown' : 'chevronUp'} onPress={() => setPanel(!panel)}/></nav>

      <section className="sv-panel">

        {error || draft.error ? <div className="sv-alert" role="alert">{error || draft.error}<StudioAction label="Fechar aviso" icon="close" onPress={() => { setError(''); draft.setError(''); }}/></div> : null}

        {doc && tab === 'rallies' ? <VideoGallery doc={doc} source={source} thumbnailSource={!modal ? readyOriginal?.url : undefined} offsetSeconds={readyOriginal ? doc.analysis?.source?.offsetSeconds ?? 0 : 0} focus={focus ?? active?.id ?? null} teams={teams} readOnly={!permissions.download} localMedia={!youtubeId} onFocus={chooseRally} onDownload={download} onExport={exportAnalysis} onImport={openAnalysisImport}/> : null}

        {doc && active && tab === 'contacts' ? <>
          <div className="sv-row"><h2>Contatos · Rally {String(activeIndex + 1).padStart(2, '0')}</h2>{canEdit ? <StudioAction label="Novo contato" disabled={!!editor} icon="add" onPress={() => { playback.current?.pause(); setModal('contact'); }}/> : null}</div>
          <p className="sv-section-meta">{videoTime(videoRange(doc, active.id)[0])} – {videoTime(videoRange(doc, active.id)[1])} · {videoContacts(doc, active.id).length} contatos</p>
          {editor && canEdit ? <div ref={contactEditor} className="sv-contact-editor"><VideoContactEditor changed={editorDirty} onCancel={() => setEditor(null)} contact={editor} students={props.students} teams={teams} onChange={setEditor} onSave={saveContact} onTime={() => setEditor({ ...editor, time: Math.min(time, doc.media.duration - .001) })} onDelete={doc.contacts.some(c => c.id === editor.id) ? () => { draft.change({ ...doc, contacts: doc.contacts.filter(c => c.id !== editor.id) }, 'Contato excluído'); setEditor(null); } : undefined}/></div> : null}
          <div className="sv-contact-list">{videoContacts(doc, active.id).map(c => <div key={c.id} className="sv-contact"><StudioAction active={editor?.id === c.id} label={`${c.skill} ${videoTime(c.time, true)}`} onPress={() => openContact(c)}><span><b>{c.skill}</b><span className="sv-contact-detail">{c.athlete || teams[c.team]} · {c.outcome || 'Não avaliado'}</span></span><time>{videoTime(c.time, true)}</time></StudioAction></div>)}</div>
          {!videoContacts(doc, active.id).length ? <p className="sv-contact-empty"><small>Nenhum contato neste rally.</small></p> : null}
          <details className="sv-disclosure"><summary>Ponto e recorte do rally</summary><div ref={pointSection}><h3>Ponto do rally</h3><div className="sv-point-teams">{(['us', null, 'them'] as const).map(winner => <StudioAction key={winner ?? 'none'} label={winner ? teams[winner] : 'Não definido'} active={active.winner === winner} disabled={!canEdit} onPress={() => draft.change({ ...doc, rallies: doc.rallies.map(r => r.id === active.id ? { ...r, winner } : r) }, 'Ponto do rally')}>{winner ? teams[winner] : 'N/D'}</StudioAction>)}</div><div className="sv-point-time">{active.pointTime !== undefined ? <><StudioAction label={`Ir para o ponto em ${videoTime(active.pointTime, true)}`} icon="flag" onPress={() => seek(active.pointTime!)}>Ponto · {videoTime(active.pointTime, true)}</StudioAction>{canEdit ? <><StudioAction label="Usar instante atual para o ponto" icon="time" disabled={!!editor} onPress={markPoint}/><StudioAction label="Remover marca do ponto" icon="close" disabled={!!editor} onPress={() => draft.change(markVideoPoint(doc, active.id, null), 'Marca do ponto removida')}/></> : null}</> : canEdit ? <StudioAction label="Marcar ponto aqui" icon="flag" disabled={!!editor} onPress={markPoint}>Marcar ponto aqui</StudioAction> : null}</div></div>{canEdit ? <details className="sv-crop-settings"><summary>Ajustar recorte do rally</summary><div className="sv-wrap sv-crop-actions"><StudioAction label="Iniciar rally aqui" onPress={split}>Iniciar rally aqui</StudioAction><StudioAction label="Unir ao anterior" disabled={activeIndex === 0} onPress={() => { try {

        draft.change(mergeVideoRally(doc, active.id), 'União de rallies');

        setFocus(null);

    }

    catch (failure) {

        setError((failure as Error).message);

    } }}>Unir ao anterior</StudioAction></div></details> : null}</details>
        </> : null}

        {doc && tab === 'validation' ? <>
          <div className="sv-row"><h2>Informações do vídeo</h2>{!props.shared ? <StudioAction label="Histórico de alterações" icon="time" onPress={() => setTab('history')}/> : null}</div>
          <dl className="sv-facts"><div><dt>Duração</dt><dd>{videoTime(doc.media.duration)}</dd></div><div><dt>Reprodução</dt><dd>{youtubeId ? <select className="sv-source-select" aria-label="Fonte da reprodução" value={originalActive ? 'original' : 'youtube'} onChange={event => { if (event.target.value === 'youtube') switchPlayer(false); else if (readyOriginal) switchPlayer(true); else setModal('import'); }}><option value="youtube">YouTube</option><option value="original" disabled={!readyOriginal && !permissions.importMedia}>{readyOriginal?.kind === 'drive' ? 'Google Drive' : 'Original com trajetória'}</option></select> : 'Arquivo'}</dd></div><div><dt>Marcações</dt><dd>{doc.rallies.length} rallies · {doc.contacts.length} contatos</dd></div></dl>
          <details className="sv-disclosure" open><summary>Trajetória da bola <small>{tracking.length.toLocaleString('pt-BR')} posições</small></summary>
            {doc && iframePlayback && trackVisible && (tracking.length > 0 || doc.corrections.length > 0) ? <YouTubeTrackingPanel doc={doc} time={time} correcting={canEdit && correcting} onCorrect={canEdit ? (x, y) => {
          draft.change({ ...doc, corrections: [...doc.corrections.filter(p => Math.abs(p.time - time) >= .025), { time: Math.min(time, doc.media.duration - .001), x, y }].sort((a, b) => a.time - b.time) }, 'Posição da bola'); setCorrecting(false);
      } : undefined}/> : null}
            <p className="sv-section-meta">Estimativa revisável · {doc.corrections.length} correções manuais</p>
            <div className="sv-wrap"><StudioAction label="Mostrar trajetória" icon="view" active={trackVisible} onPress={() => setTrackVisible(!trackVisible)}>Mostrar</StudioAction>{canEdit && tracking.length > 0 ? <StudioAction label="Corrigir posição da bola" icon="crosshair" active={correcting} onPress={() => { playback.current?.pause(); setCorrecting(!correcting); }}>Corrigir</StudioAction> : null}{youtubeId && canEdit ? <StudioAction label="Configurar tracking da bola" disabled={!!editor} onPress={() => setModal('youtube-tracking')}>Configurar</StudioAction> : null}{canEdit && !youtubeId ? <StudioAction label="Importar trajetória" onPress={() => trackInput.current?.click()}>Importar</StudioAction> : null}</div>
          </details>
          {suggestedCuts.length ? <details className="sv-disclosure"><summary>Cortes sugeridos <small>{suggestedCuts.length}</small></summary><ul className="sv-cut-list">{suggestedCuts.map(t => <li key={t}><StudioAction label={`Ver corte ${videoTime(t)}`} onPress={() => { chooseRally(null); if (playback.current) { playback.current.pause(); playback.current.currentTime = t; setTime(t); } }}><time>{videoTime(t)}</time></StudioAction><StudioAction label={`Criar rally em ${videoTime(t)}`} disabled={!canEdit || !!editor} icon="add" onPress={() => { try { draft.change(splitVideoRally(doc, t, createClientId()), 'Corte sugerido aceito'); } catch (failure) { setError((failure as Error).message); } }}>Criar rally</StudioAction></li>)}</ul></details> : null}
          {canEdit && youtubeId && localVideoAiAvailable() ? <details className="sv-disclosure"><summary>Análise automática</summary><StudioAction label="Análise automática pelo link" onPress={() => setModal('youtube-ai')}>Revisar rallies e contatos</StudioAction></details> : null}
        </> : null}

        {tab === 'history' ? <><div className="sv-row"><h2>Histórico desta edição</h2><StudioAction label="Desfazer" icon="restore" disabled={!canEdit || !draft.history?.past.length} onPress={() => undo()}/><StudioAction label="Refazer" icon="redo" disabled={!canEdit || !draft.history?.future.length} onPress={() => undo(true)}/></div>{draft.history?.past.slice().reverse().map((h, i) => <div key={i} className="sv-history"><b>{h.label}</b><small>{new Date(h.at).toLocaleTimeString('pt-BR')}</small></div>)}</> : null}

      </section><footer className="sv-footer"><small>{props.shared ? 'Somente leitura' : readOnly ? 'Prévia de leitura' : draft.dirty ? 'Alterações não salvas' : 'Rascunho neste aparelho'}</small></footer></aside>

    </main>

    {modal === 'import' && permissions.importMedia ? <StudioDialog className="sv-import sv-source-dialog" title="Adicionar vídeo" onClose={() => { if (!loadingFile.current && !processing.current) { setPreviewId(''); setModal(null); } }}>
      <label className="sv-field">Link do vídeo <span><input aria-label="Link do vídeo" type="url" value={youtubeLink} placeholder="YouTube ou Google Drive" disabled={!!job || driveBusy} onChange={e => { setYoutubeLink(e.target.value); setPreviewId(''); setYoutubeDuration(0); setError(''); }}/></span></label>
      {linkKind ? <p className="sv-source-kind">{linkKind === 'drive' ? 'Google Drive' : 'YouTube'}</p> : null}
      {linkKind === 'drive' ? doc && youtubeId && canEdit && driveTrackingAvailable() ? <DriveTrackingSetup embedded inputLink={youtubeLink} onBusyChange={setDriveBusy} doc={doc} scope={{ userId: props.userId, org: props.org, classId: props.classId, sessionId: props.sessionId, targetFingerprint: doc.media.fingerprint }} onClose={() => setModal(null)} onPlayback={(media, url) => { showDriveOriginal(media, url); setModal(null); setTrackVisible(true); }} onApply={(analysis, media, url) => { draft.change({ ...doc, analysis }, 'Tracking do Drive associado ao YouTube'); showDriveOriginal(media, url, analysis.source); setModal(null); setTrackVisible(true); }}/>
        : <p className="sv-section-meta">Abra o vídeo do YouTube para associar este original do Drive.</p> : <>
        <StudioAction label="Verificar link do YouTube" primary disabled={!youtubeLink.trim() || !!job} onPress={() => { try { if (linkKind !== 'youtube') throw new Error('Use um link do YouTube ou Google Drive.'); const id = youtubeVideoId(youtubeLink); playback.current?.pause(); setYoutubeDuration(0); setYoutubeAttempt(n => n + 1); setPreviewId(id); setError(''); } catch (failure) { setError((failure as Error).message); } }}>Continuar</StudioAction>
        {previewId ? <><YouTubeVideo key={`${previewId}:${youtubeAttempt}`} id={previewId} onMetadata={duration => { if (duration > 86400) setError('Escolha um vídeo de até 24 horas.'); else setYoutubeDuration(duration); }} onError={message => { setYoutubeDuration(0); setError(message); }}/><StudioAction label="Usar vídeo do YouTube" primary disabled={!youtubeDuration || !!job} onPress={() => { void openYouTube(); }}>Usar vídeo</StudioAction><small>Links não listados podem ser repassados fora do Go Atleta.</small></> : null}
      </>}
      {job ? <p role="status">{job}</p> : null}{error ? <p className="sv-alert" role="alert">{error}</p> : null}
      <div className="sv-source-file"><span>ou</span><StudioAction label="Escolher arquivo de vídeo" icon="add" disabled={!!job || driveBusy} onPress={() => fileInput.current?.click()}>Escolher arquivo</StudioAction></div>
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
      </details> : null}
    </StudioDialog> : null}

    {modal === 'youtube-tracking' && doc && youtubeId && canEdit ? <YouTubeTrackingSetup key={youtubeId} doc={doc} onDrive={driveTrackingAvailable() ? () => setModal('import') : undefined} onClose={() => setModal(null)} onApply={(next, originalFile) => { draft.change(next, 'Tracking associado ao YouTube'); if (originalFile) showOriginal(originalFile, next); else switchPlayer(false); setModal(null); setTrackVisible(true); setTab('validation'); setPanel(true); }}/> : null}


    {modal === 'youtube-ai' && doc && youtubeId && canEdit ? <YouTubeAnalysis key={youtubeId} doc={doc} onClose={() => setModal('import')} onApply={next => { draft.change(next, 'Sugestões do YouTube aceitas'); setModal(null); setTab('validation'); setPanel(true); }}/> : null}

    {modal === 'contact' ? <StudioDialog title="Qual foi o contato?" onClose={() => setModal(null)}><small>{videoTime(time, true)}</small><div className="sv-skills">{videoSkills.map(skill => <StudioAction key={skill} label={skill} onPress={() => addContact(skill)}>{skill}</StudioAction>)}</div></StudioDialog> : null}

    {modal === 'exit' ? <StudioDialog title="Salvar antes de sair?" onClose={() => setModal(null)}><p>{editorDirty ? 'Há um contato em edição. Volte e registre o contato antes de salvar.' : 'As alterações ainda não foram salvas neste aparelho.'}</p><div className="sv-wrap"><StudioAction label="Continuar editando" onPress={() => setModal(null)}>Continuar editando</StudioAction><StudioAction label="Sair sem salvar" onPress={props.onClose}>Sair sem salvar</StudioAction><StudioAction label="Salvar e sair" primary disabled={editorDirty || draft.saving} onPress={() => { void draft.save().then(ok => { if (ok)

        props.onClose(); }); }}>Salvar e sair</StudioAction></div>{draft.error ? <p role="alert">{draft.error}</p> : null}</StudioDialog> : null}

    {modal === 'download' ? <StudioDialog title="Preparando download" onClose={() => { exporting.current?.abort(); setModal(null); }}><p role="status">{job}</p>{progress !== null ? <progress value={progress} max={1} aria-label="Progresso da exportação"/> : null}<p><small>Recortes preparados em tempo real, sem sobreposição da bola.</small></p>{error ? <p role="alert">{error}</p> : null}</StudioDialog> : null}

    {modal === 'share' && doc && permissions.manageSharing ? <VideoShareDialog doc={doc} file={file} teams={teams} scope={{ org: props.org, sessionId: props.sessionId }} onClose={() => setModal(null)} onPreview={() => { setReadOnly(!readOnly); setEditor(null); setModal(null); }}/> : null}

  </div>;

}
