import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { videoRange, videoSkillLetters, videoTime, type BallPosition, type VideoContact, type VideoDocument, type VideoRally, type VideoSide } from '../../../core/scouting-video';
import { StudioAction } from './StudioUI.web';
import { timelineContactGroups, timelineLegendIndexes } from './timeline-contacts';
import { useTimelineScrub } from './use-timeline-scrub';
import { useTimelineMarkerDrag } from './use-timeline-marker-drag';
import { contactOutcomeSummary, contactOutcomeSymbols, contactOutcomeTone } from './video-contact-outcomes';
import type { StudioRallyMetadata, StudioRangeResolver, StudioSourceContact } from './local-studio-types';
import { videoTimelineStyles } from './video-review-styles';
import { compactUiMetrics } from '../../../theme/tokens';

type BenchEvent = { key: string; time: number } & ({ kind: 'contact'; contact: VideoContact } | { kind: 'official'; source: StudioSourceContact } | { kind: 'point'; point: VideoRally });
type Preview = { label: string; detail: string; contacts: VideoContact[]; sourceContact?: StudioSourceContact; events?: readonly BenchEvent[] };
const noSourceContacts: readonly StudioSourceContact[] = [];

function BenchTimelineMarker({ group, teams, pendingId, availableWindow, showTip, hideTip, onSeek, previewId, legend, legendWidth, drag }: {
    group: { contacts: BenchEvent[]; position: number }; teams: Record<VideoSide, string>; pendingId?: string;
    legend?: string; legendWidth: number;
    drag: ReturnType<typeof useTimelineMarkerDrag>;
    availableWindow?: readonly [number, number]; showTip: (preview: Preview, rect: DOMRect, moveFocus?: boolean) => void; hideTip: () => void; onSeek: (time: number) => void; previewId: string;
}) {
    const anchor = useRef<HTMLDivElement>(null), event = group.contacts[0], many = group.contacts.length > 1;
    const preview: Preview = many ? { label: `${group.contacts.length} marcações`, detail: `${videoTime(event.time, true)} – ${videoTime(group.contacts.at(-1)!.time, true)}`, contacts: [], events: group.contacts }
        : event.kind === 'contact' ? { label: event.contact.skill, detail: '', contacts: [event.contact] }
        : event.kind === 'official' ? { label: event.source.skill, detail: event.source.result, contacts: [], sourceContact: event.source }
        : { label: 'Ponto', detail: videoTime(event.time, true), contacts: [] };
    const unavailable = (item: BenchEvent) => item.kind === 'official' && !!availableWindow && (item.time < availableWindow[0] || item.time >= availableWindow[1]);
    const pending = group.contacts.some(item => item.kind === 'contact' && item.contact.id === pendingId);
    const interactivePreview = many || event.kind !== 'point';
    const label = many ? `${preview.label} · ${preview.detail}`
        : event.kind === 'contact' ? `${event.contact.skill} · ${videoTime(event.time, true)} · ${pending ? 'Em edição' : event.contact.outcome || 'Não avaliado'}`
        : event.kind === 'official' ? `${event.source.skill} registrado · ${videoTime(event.time, true)} · ${event.source.athlete || 'Sem atleta'} · ${event.source.result}`
        : `Ponto · ${videoTime(event.time, true)} · ${event.point.winner ? teams[event.point.winner] : 'N/D'}`;
    return <div ref={anchor} className={`${!many && event.kind === 'point' ? 'sv-point-marker' : 'sv-marker'}${many ? ' grouped' : ''}`} data-source-contact={group.contacts.every(item => item.kind === 'official') || undefined} data-event-count={group.contacts.length} data-draft={pending || undefined} style={{ left: `${group.position * 100}%` }} onPointerDown={drag.onPointerDown} onClickCapture={e=>{if(drag.consumeClick(e)){e.preventDefault();e.stopPropagation();}}} onPointerEnter={e => showTip(preview, e.currentTarget.getBoundingClientRect())} onPointerLeave={hideTip} onFocus={e => showTip(preview, e.currentTarget.getBoundingClientRect())} onBlur={hideTip} onKeyDown={e=>{if(e.key==='ArrowDown' && anchor.current){e.preventDefault();e.stopPropagation();showTip(preview,anchor.current.getBoundingClientRect(),true);}}}>
        <StudioAction label={label} hasPopup={interactivePreview ? 'dialog' : undefined} describedBy={interactivePreview ? undefined : previewId} disabled={group.contacts.every(unavailable)} iconContent={<span className={`sv-timeline-symbol${many ? ' grouped' : ''}`}><span className="sv-timeline-dot" style={{ backgroundColor: 'var(--sv-green)' }}/>{legend ? <span className="sv-timeline-marker-legend" style={{ maxWidth: legendWidth }}><span>{legend}</span>{many ? <small>+{group.contacts.length - 1}</small> : null}</span> : null}</span>} onPress={() => { const target=group.contacts.find(item=>!unavailable(item)); if(target)onSeek(target.time); }}/>
    </div>;
}

export function VideoTimeline({ doc, focus, time, tracking, teams, onSeek, onContact, onPoint, onPlay, draftContact, rangeResolver = videoRange, sourceContacts = noSourceContacts, availableWindow, bench = false, rallyMetadata }: {
    bench?: boolean;
    doc: VideoDocument; focus: string | null; time: number; tracking: BallPosition[];
    draftContact?: VideoContact | null;
    rangeResolver?: StudioRangeResolver;
    sourceContacts?: readonly StudioSourceContact[];
    availableWindow?: readonly [number, number];
    rallyMetadata?: Readonly<Record<string, StudioRallyMetadata>>;
    onContact?: (contact: VideoContact) => void;
    onPoint?: (rallyId: string, time: number) => void;
    onPlay?: () => void;
    teams: Record<VideoSide, string>;
    onFocus: (id: string | null) => void; onSeek: (time: number) => void;
}) {
    const tipContext = useMemo(() => ({ focus, contacts: doc.contacts, draftContact, sourceContacts }), [focus, doc.contacts, draftContact, sourceContacts]);
    const [tipState, setTip] = useState<(Preview & { left: number; bottom: number; maxHeight: number; width?: number; context: typeof tipContext }) | null>(null);
    const tip = tipState?.context === tipContext ? tipState : null;
    const singleTip = tip?.contacts.length === 1 && tip.label === tip.contacts[0].skill;
    const interactiveTip = !!(tip?.events?.length || tip?.sourceContact || tip?.contacts.length);
    const tipId = useId(), track = useRef<HTMLDivElement>(null);
    const tipPanel = useRef<HTMLDivElement>(null), focusOnOpen = useRef(false), restoringFocus = useRef(false), tipOrigin = useRef<HTMLElement | null>(null);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [width, setWidth] = useState(900);
    const [start, end] = rangeResolver(doc, focus), span = Math.max(.001, end - start);
    const scrub = useTimelineScrub({ time, start, end, scope: `${doc.media.fingerprint}:${focus ?? ''}`, onSeek });
    const displayTime = scrub.time;
    const previewDoc = useMemo(() => draftContact ? { ...doc, contacts: [...doc.contacts.filter(c => c.id !== draftContact.id), draftContact] } : doc, [doc, draftContact]);
    const contacts = useMemo(() => previewDoc.contacts.filter(c => c.time >= start && c.time < end).sort((a, b) => a.time - b.time), [previewDoc.contacts, start, end]);
    const visibleDraft = contacts.find(c => c.id === draftContact?.id);
    const points = useMemo(() => doc.rallies.filter(r => (!focus || r.id === focus) && r.pointTime !== undefined && r.pointTime >= start && r.pointTime < end), [doc.rallies, start, end, focus]);
    const official = useMemo(() => sourceContacts.filter(contact => contact.time !== null && (!focus || contact.rallyId === focus) && contact.time >= start && contact.time < end), [sourceContacts, focus, start, end]);
    const benchGroups = useMemo(() => {
        if (!bench) return [];
        const events: BenchEvent[] = [
            ...contacts.map(contact => ({ key: `contact-${contact.id}`, time: contact.time, kind: 'contact' as const, contact })),
            ...official.map(source => ({ key: `source-${source.id}`, time: source.time!, kind: 'official' as const, source })),
            ...(focus ? points.map(point => ({ key: `point-${point.id}`, time: point.pointTime!, kind: 'point' as const, point })) : []),
        ].sort((a, b) => a.time - b.time);
        return timelineContactGroups(events, start, end, width, compactUiMetrics.touchTarget, compactUiMetrics.touchTarget / 2);
    }, [bench, contacts, official, points, focus, start, end, width]);
    const groups = useMemo(() => {
        const savedContacts = contacts.filter(c => c.id !== draftContact?.id);
        const saved = focus ? timelineContactGroups(savedContacts, start, end, width, 24)
            : doc.rallies.flatMap(rally => {
                const [rallyStart, rallyEnd] = rangeResolver(doc, rally.id);
                const rallyContacts = savedContacts.filter(contact => contact.time >= rallyStart && contact.time < rallyEnd);
                return rallyContacts.length ? [{ contacts: rallyContacts, position: ((rallyStart + rallyEnd) / 2 - start) / span }] : [];
            });
        return visibleDraft ? [...saved, { contacts: [visibleDraft], position: (visibleDraft.time - start) / span }] : saved;
    }, [contacts, draftContact?.id, visibleDraft, start, end, span, width, focus, doc, rangeResolver]);
    const chapters = useMemo(() => {
        if (!focus) return doc.rallies.map((r, i) => { const [from, until] = rangeResolver(doc, r.id); return { id: r.id, start: from, end: until, label: `Rally ${String(i + 1).padStart(2, '0')}`, contacts: previewDoc.contacts.filter(c => c.time >= from && c.time < until).sort((a, b) => a.time - b.time) }; });
        const stages = [
            ...contacts.map(c => ({ id: c.id, start: c.time, label: c.skill as string, contacts: [c] })),
            ...official.map(c => ({ id: `source-${c.id}`, start: c.time!, label: c.skill, contacts: [] as VideoContact[] })),
            ...points.map(r => ({ id: `point-${r.id}`, start: r.pointTime!, label: 'Ponto', contacts: [] as VideoContact[] })),
        ].sort((a, b) => a.start - b.start);
        if (!stages.length || stages[0].start > start) stages.unshift({ id: 'intro', start, label: 'Início do rally', contacts: [] });
        return stages.map((stage, i) => ({ ...stage, end: stages[i + 1]?.start ?? end }));
    }, [previewDoc, contacts, points, official, focus, start, end, doc, rangeResolver]);
    const current = chapters.findLast(c => c.start <= displayTime + .001) ?? chapters[0];
    const legendWidth = Math.min(96, Math.max(56, width * .14));
    const legendIndexes = timelineLegendIndexes(benchGroups.map(group => group.position), width, legendWidth, 0, benchGroups.findLastIndex(group => group.contacts[0].time <= displayTime + .001));
    const focusIndex = doc.rallies.findIndex(rally => rally.id === focus), focusedMetadata = focus ? rallyMetadata?.[focus] : undefined;
    const contextLabel = focus ? `${focusIndex >= 0 ? `Rally ${String(focusIndex + 1).padStart(2, '0')}` : 'Rally'}${focusedMetadata?.scoreUs !== undefined && focusedMetadata.scoreThem !== undefined ? ` · ${focusedMetadata.scoreUs} × ${focusedMetadata.scoreThem}` : ''}` : 'Vídeo completo';
    const markerLegend = (event: BenchEvent) => {
        if (!focus) return chapters.find(chapter => event.time >= chapter.start && event.time < chapter.end)?.label.replace('Rally ', 'R') ?? 'R';
        if (event.kind === 'point') return 'Pt';
        const athlete = event.kind === 'official' ? event.source.athlete : event.contact.athlete;
        const skill = event.kind === 'official' ? event.source.skill : event.contact.skill;
        const shortSkill = Object.hasOwn(videoSkillLetters, skill) ? videoSkillLetters[skill as keyof typeof videoSkillLetters] : skill.slice(0, 3);
        return athlete && athlete !== 'Sem atleta' ? `${athlete.trim().split(/\s+/)[0]} · ${shortSkill}` : shortSkill;
    };
    const coverage = useMemo(() => {
        const bins = new Array<number>(180).fill(0);
        for (const p of tracking) if (p.time >= start && p.time < end) bins[Math.min(179, Math.floor((p.time - start) / span * 180))] = 1;
        for (const p of doc.corrections) if (p.time >= start && p.time < end) bins[Math.min(179, Math.floor((p.time - start) / span * 180))] = 2;
        return bins;
    }, [tracking, doc.corrections, start, end, span]);
    const keepTip = () => { if (closeTimer.current) clearTimeout(closeTimer.current); };
    const markerDrag=useTimelineMarkerDrag({start,end,scope:`${doc.media.fingerprint}:${focus??''}`,trackRef:track,onStart:scrub.onPointerDown,onChange:scrub.onChange,onEnd:scrub.onPointerUp,onCancel:scrub.onPointerCancel,beforeDrag:()=>{keepTip();setTip(null);tipOrigin.current=null;focusOnOpen.current=false;}});
    const hideTip = () => { keepTip(); closeTimer.current = setTimeout(() => { if (typeof document !== 'undefined' && tipPanel.current?.contains(document.activeElement)) return; setTip(null); tipOrigin.current = null; }, 140); };
    const showTip = (preview: Preview, rect: DOMRect, moveFocus = false) => {
        if (scrub.active || restoringFocus.current) return;
        keepTip();
        if (moveFocus && typeof document !== 'undefined') { tipOrigin.current = document.activeElement as HTMLElement | null; focusOnOpen.current = true; }
        const tipWidth = Math.min(preview.contacts.length === 1 ? 220 : 260, innerWidth - 16);
        setTip({ ...preview, context: tipContext, left: Math.max(8, Math.min(innerWidth - tipWidth - 8, rect.left + rect.width / 2 - tipWidth / 2)), bottom: innerHeight - rect.top + 8, maxHeight: Math.max(48, Math.min(240, rect.top - 16)), width: tipWidth });
    };
    useEffect(() => {
        const node = track.current;
        if (!node) return;
        setWidth(node.clientWidth);
        const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
        observer.observe(node);
        return () => observer.disconnect();
    }, []);
    useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);
    useEffect(() => { if (tip && focusOnOpen.current) { focusOnOpen.current = false; tipPanel.current?.querySelector<HTMLElement>('[role="button"]')?.focus(); } }, [tip]);
    const closeTip = () => { keepTip(); setTip(null); const origin = tipOrigin.current; tipOrigin.current = null; if (origin?.isConnected) { restoringFocus.current = true; origin.focus(); restoringFocus.current = false; } };
    const seek = (position: number) => { closeTip(); onSeek(position); };
    const editContact = (contact: VideoContact) => { closeTip(); if (onContact) onContact(contact); else onSeek(contact.time); };
    const selectEvent = (event: BenchEvent) => {
        if (event.kind === 'official' && availableWindow && (event.time < availableWindow[0] || event.time >= availableWindow[1])) return;
        if (event.kind === 'contact') editContact(event.contact);
        else if (event.kind === 'official') seek(event.time);
        else { closeTip(); if (onPoint) onPoint(event.point.id, event.time); else onSeek(event.time); }
    };
    return <div className="sv-timeline" data-soft-timeline data-bench={bench || undefined} data-scrubbing={scrub.active || undefined} onKeyDownCapture={e => {
        if (!onPlay || (e.code !== 'Space' && e.key !== ' ') || e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement)?.closest?.('.sv-floating-tip')) return;
        e.preventDefault(); e.stopPropagation();
        if (!e.repeat) onPlay();
      }} onKeyUpCapture={e => {
        if (onPlay && (e.code === 'Space' || e.key === ' ') && !e.ctrlKey && !e.metaKey && !e.altKey && !(e.target as HTMLElement)?.closest?.('.sv-floating-tip')) { e.preventDefault(); e.stopPropagation(); }
      }} onKeyDown={e => { if (e.key === 'Escape') closeTip(); }}>
      <style>{videoTimelineStyles}</style><div className="sv-tracks" role="region" aria-label={focus ? 'Timeline do rally' : 'Timeline do vídeo completo'} aria-description={bench ? contextLabel : undefined}>
        <div className="sv-seek" onPointerMove={markerDrag.onPointerMove} onPointerUp={markerDrag.onPointerUp} onPointerCancel={markerDrag.onPointerCancel} onLostPointerCapture={markerDrag.onLostPointerCapture}>
          {bench ? <><div className="sv-bench-time-rail" aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, (displayTime - start) / span * 100))}%` }}/></div><span className="sv-bench-playhead" aria-hidden="true" style={{left:`${Math.max(0,Math.min(100,(displayTime-start)/span*100))}%`}}/></> : null}
          <input aria-label="Posição no vídeo" type="range" min={start} max={end} step={.001} value={Math.max(start, Math.min(end, displayTime))} aria-valuetext={`${videoTime(displayTime, true)} · ${current?.label ?? ''}`}
            onPointerDown={e => { keepTip(); setTip(null); scrub.onPointerDown(e); }} onPointerUp={scrub.onPointerUp} onPointerCancel={scrub.onPointerCancel} onLostPointerCapture={scrub.onPointerCancel} onBlur={scrub.onPointerCancel}
            onChange={e => { keepTip(); setTip(null); scrub.onChange(Number(e.target.value)); }}/>
          <div className="sv-segments" aria-label={focus ? 'Etapas do rally' : 'Rallies do vídeo'} onClickCapture={e => {
            // Only the thin progress track seeks; its surrounding space stays inert.
            // Keyboard activation still goes to the chapter's exact start.
            if (!e.detail) return;
            const rect = e.currentTarget.getBoundingClientRect();
            if (!rect.width) return;
            e.preventDefault();
            e.stopPropagation();
            seek(start + Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * span);
          }}>{chapters.map(c => {
              const preview = { label: c.label, detail: `${videoTime(c.start)} – ${videoTime(c.end)}`, contacts: c.contacts };
              return <div key={c.id} className={`sv-chapter${current?.id === c.id ? ' current' : ''}`} style={{ left: `${(c.start - start) / span * 100}%`, width: `${(c.end - c.start) / span * 100}%`, '--chapter-progress': `${Math.max(0, Math.min(100, (displayTime - c.start) / Math.max(.001, c.end - c.start) * 100))}%` } as React.CSSProperties}
                onPointerEnter={e => showTip(preview, e.currentTarget.getBoundingClientRect())} onPointerLeave={hideTip} onFocus={e => showTip(preview, e.currentTarget.getBoundingClientRect())} onBlur={hideTip}>
                <StudioAction label={`${c.label} em ${videoTime(c.start)}`} hasPopup={c.contacts.length ? 'dialog' : undefined} describedBy={!c.contacts.length && tip?.label === c.label ? tipId : undefined} onPress={() => seek(c.start)}><span className="sv-sr-only">{c.label}</span></StudioAction>
              </div>;
          })}</div>
        <div ref={track} className="sv-contact-markers" aria-label="Contatos na timeline">{bench ? benchGroups.map((group,index) => <BenchTimelineMarker key={group.contacts[0].key} group={group} teams={teams} drag={markerDrag} legend={legendIndexes.has(index)?markerLegend(group.contacts[0]):undefined} legendWidth={legendWidth} pendingId={draftContact?.id} availableWindow={availableWindow} showTip={showTip} hideTip={hideTip} onSeek={seek} previewId={tipId}/>) : <>{groups.map(group => {
            const c = group.contacts[0], many = group.contacts.length > 1;
            const pending = c.id === draftContact?.id;
            const label = many ? `${group.contacts.length} contatos` : c.skill;
            const summary = many ? contactOutcomeSummary(group.contacts) : [];
            const tone = many ? 'neutral' : contactOutcomeTone(c);
            const flag = many ? summary[0]?.tone ?? 'neutral' : tone;
            const evaluation = pending ? 'Em edição' : many ? summary.map(s => s.label).join(' · ') : c.outcome || 'Não avaliado';
            const preview = { label, detail: many ? `${videoTime(c.time)} – ${videoTime(group.contacts.at(-1)!.time)}` : '', contacts: group.contacts };
            const markerContent = bench ? undefined : [many ? group.contacts.length : videoSkillLetters[c.skill], flag !== 'neutral' ? <span key="outcome" className="sv-outcome-symbol" data-outcome={flag} aria-hidden="true">{contactOutcomeSymbols[flag]}</span> : null, many ? <span key="colors" className="sv-marker-colors" aria-hidden="true">{group.contacts.map(contact => <i key={contact.id} data-outcome={contactOutcomeTone(contact)}/>)}</span> : null];
            return <div key={c.id} className={`sv-marker${many ? ' grouped' : ''}${!focus ? ' macro' : ''}`} data-draft={pending || undefined} data-outcome={tone} style={{ left: `clamp(12px, ${group.position * 100}%, calc(100% - 12px))` } as React.CSSProperties}
              onPointerEnter={e => showTip(preview, e.currentTarget.getBoundingClientRect())} onPointerLeave={hideTip} onFocus={e => showTip(preview, e.currentTarget.getBoundingClientRect())} onBlur={hideTip}>
              <StudioAction label={`${label} · ${videoTime(c.time, true)}${evaluation ? ` · ${evaluation}` : ''}`} hasPopup="dialog" iconContent={bench ? <span className="sv-timeline-dot" style={{backgroundColor:c.team === 'them' ? 'var(--sv-muted)' : 'var(--sv-green)'}}/> : undefined} onPress={() => editContact(c)}>{markerContent}</StudioAction>
            </div>;
        })}{official.map(contact => { const unavailable = !!availableWindow && (contact.time! < availableWindow[0] || contact.time! >= availableWindow[1]); const preview = {label:contact.skill,detail:contact.result,contacts:[] as VideoContact[],sourceContact:contact}; return <div key={`source-${contact.id}`} className={`sv-marker${focus ? '' : ' macro'}`} data-source-contact style={{left:`clamp(12px, ${(contact.time! - start) / span * 100}%, calc(100% - 12px))`}} onPointerEnter={event=>showTip(preview,event.currentTarget.getBoundingClientRect())} onPointerLeave={hideTip} onFocus={event=>showTip(preview,event.currentTarget.getBoundingClientRect())} onBlur={hideTip}><StudioAction label={`${contact.skill} registrado · ${videoTime(contact.time!,true)} · ${contact.athlete||'Sem atleta'} · ${contact.result}`} disabled={unavailable} hasPopup="dialog" iconContent={bench ? <span className="sv-timeline-dot" style={{backgroundColor:contact.time! <= displayTime ? 'var(--sv-green)' : 'var(--sv-muted)'}}/> : undefined} onPress={()=>seek(contact.time!)}>{bench ? undefined : contact.skill.charAt(0)}</StudioAction></div>; })}{(focus ? points : []).map(r => <div key={`point-${r.id}`} className={`sv-point-marker${focus ? '' : ' macro'}`} style={{ left: `clamp(12px, ${(r.pointTime! - start) / span * 100}%, calc(100% - 12px))` }}>
            <StudioAction label={`Ponto · ${videoTime(r.pointTime!, true)} · ${r.winner ? teams[r.winner] : 'N/D'}`} icon={bench ? undefined : 'flag'} iconContent={bench ? <span className="sv-timeline-dot" style={{backgroundColor:r.winner === 'us' ? 'var(--sv-green)' : 'var(--sv-muted)'}}/> : undefined} onPress={() => { setTip(null); if (onPoint) onPoint(r.id, r.pointTime!); else seek(r.pointTime!); }}/>
        </div>)}</>}</div>
        </div>
        {!bench ? <div className="sv-timeline-caption"><span>{scrub.active ? `${videoTime(displayTime, true)} · ${current?.label ?? ''}` : visibleDraft ? `${visibleDraft.skill} · ${videoTime(visibleDraft.time, true)} · Em edição` : current?.label ?? 'Vídeo completo'}</span><small>{videoTime(start)} – {videoTime(end)}</small></div> : null}
        <div className="sv-lane"><small>Bola</small><div className="sv-ball" aria-label={tracking.length || doc.corrections.length ? 'Bola: marcações e correções disponíveis' : 'Bola: sem rastreamento'}>{coverage.map((state, i) => <i key={i} className={state === 2 ? 'corrected' : state ? 'detected' : ''}/>)}</div></div>
      </div>
      {tip ? <div ref={tipPanel} id={tipId} className={`sv-floating-tip${singleTip ? ' single' : ''}`} style={{ left: tip.left, bottom: tip.bottom, maxHeight: tip.maxHeight, width: tip.width }} role={interactiveTip ? 'dialog' : 'tooltip'} aria-modal={interactiveTip ? false : undefined} aria-label={interactiveTip ? tip.label : undefined} onPointerEnter={keepTip} onPointerLeave={hideTip} onFocus={keepTip} onBlur={hideTip}>
        {!singleTip ? <div className="sv-tip-heading"><b>{tip.label}</b><small>{tip.detail}</small></div> : null}
        {tip.contacts.length > 1 ? <div className="sv-tip-summary">{contactOutcomeSummary(tip.contacts).map(s => <span key={s.tone} className="sv-outcome-label" data-outcome={s.tone}><span aria-hidden="true">{contactOutcomeSymbols[s.tone]} </span>{s.label}</span>)}</div> : null}
        {tip.events ? <ul>{tip.events.map(event => <li key={event.key}><StudioAction label={`Ir para ${event.kind === 'point' ? 'Ponto' : event.kind === 'official' ? `${event.source.skill} registrado` : event.contact.skill} em ${videoTime(event.time, true)}`} disabled={event.kind === 'official' && !!availableWindow && (event.time < availableWindow[0] || event.time >= availableWindow[1])} onPress={() => selectEvent(event)}><span className="sv-tip-contact"><b>{event.kind === 'point' ? 'Ponto' : event.kind === 'official' ? event.source.skill : event.contact.skill}</b><time>{videoTime(event.time, true)}</time><small>{event.kind === 'point' ? event.point.winner ? teams[event.point.winner] : 'Equipe não informada' : event.kind === 'official' ? `${event.source.athlete || 'Sem atleta'} · ${event.source.result}` : `${teams[event.contact.team]} · ${event.contact.athlete || 'Sem atleta'} · ${event.contact.outcome}`}</small></span></StudioAction></li>)}</ul> : tip.sourceContact ? <ul><li><StudioAction label={`Ir para ${tip.sourceContact.skill} registrado em ${videoTime(tip.sourceContact.time!,true)}`} disabled={!!availableWindow && (tip.sourceContact.time! < availableWindow[0] || tip.sourceContact.time! >= availableWindow[1])} onPress={()=>{if(!availableWindow || tip.sourceContact!.time! >= availableWindow[0] && tip.sourceContact!.time! < availableWindow[1]) seek(tip.sourceContact!.time!);}}><span className="sv-tip-contact"><b>{tip.sourceContact.skill}</b><time>{videoTime(tip.sourceContact.time!,true)}</time><small>{tip.sourceContact.athlete||'Sem atleta'}</small><small>{tip.sourceContact.result} · {tip.sourceContact.detail}</small></span></StudioAction></li></ul> : tip.contacts.length ? <ul>{tip.contacts.map(c => <li key={c.id} data-outcome={contactOutcomeTone(c)}>
          <StudioAction label={`Ir para ${c.skill} em ${videoTime(c.time, true)}`} onPress={() => editContact(c)}><span className="sv-tip-contact"><b>{c.skill}</b><time>{videoTime(c.time, true)}</time><small>{teams[c.team]}{c.athlete ? ` · ${c.athlete}` : ''}</small>{c.id === draftContact?.id ? <span className="sv-outcome-label">Em edição</span> : c.outcome ? <span className="sv-outcome-label" data-outcome={contactOutcomeTone(c)}><span aria-hidden="true">{contactOutcomeSymbols[contactOutcomeTone(c)]} </span>{c.outcome}</span> : null}</span></StudioAction>
        </li>)}</ul> : <p>{tip.label === 'Ponto' ? 'Fim do rally' : focus && contacts.length ? 'Antes do primeiro contato' : 'Sem contatos registrados'}</p>}
      </div> : null}
    </div>;
}
