import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { videoContacts, videoRange, videoRallyIndex, videoSkillLetters, videoTime, type BallPosition, type VideoContact, type VideoDocument, type VideoSide } from '../../../core/scouting-video';
import { StudioAction } from './StudioUI.web';
import { timelineContactGroups } from './timeline-contacts';
import { contactOutcomeSummary, contactOutcomeSymbols, contactOutcomeTone } from './video-contact-outcomes';

type Preview = { label: string; detail: string; contacts: VideoContact[] };

export function VideoTimeline({ doc, focus, time, tracking, teams, onFocus, onSeek, onContact, draftContact }: {
    doc: VideoDocument; focus: string | null; time: number; tracking: BallPosition[];
    draftContact?: VideoContact | null;
    onContact?: (contact: VideoContact) => void;
    teams: Record<VideoSide, string>;
    onFocus: (id: string | null) => void; onSeek: (time: number) => void;
}) {
    const tipContext = useMemo(() => ({ focus, contacts: doc.contacts, draftContact }), [focus, doc.contacts, draftContact]);
    const [tipState, setTip] = useState<(Preview & { left: number; bottom: number; maxHeight: number; width?: number; context: typeof tipContext }) | null>(null);
    const tip = tipState?.context === tipContext ? tipState : null;
    const tipId = useId(), track = useRef<HTMLDivElement>(null);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [width, setWidth] = useState(900);
    const [start, end] = videoRange(doc, focus), span = Math.max(.001, end - start);
    const previewDoc = useMemo(() => draftContact ? { ...doc, contacts: [...doc.contacts.filter(c => c.id !== draftContact.id), draftContact] } : doc, [doc, draftContact]);
    const contacts = useMemo(() => previewDoc.contacts.filter(c => c.time >= start && c.time < end).sort((a, b) => a.time - b.time), [previewDoc.contacts, start, end]);
    const visibleDraft = contacts.find(c => c.id === draftContact?.id);
    const points = useMemo(() => doc.rallies.filter(r => r.pointTime !== undefined && r.pointTime >= start && r.pointTime < end), [doc.rallies, start, end]);
    const groups = useMemo(() => {
        const saved = timelineContactGroups(contacts.filter(c => c.id !== draftContact?.id), start, end, width);
        return visibleDraft ? [...saved, { contacts: [visibleDraft], position: (visibleDraft.time - start) / span }] : saved;
    }, [contacts, draftContact?.id, visibleDraft, start, end, span, width]);
    const chapters = useMemo(() => {
        if (!focus) return doc.rallies.map((r, i) => ({ id: r.id, start: r.start, end: doc.rallies[i + 1]?.start ?? end, label: `Rally ${String(i + 1).padStart(2, '0')}`, contacts: videoContacts(previewDoc, r.id).sort((a, b) => a.time - b.time) }));
        const stages = [
            ...contacts.map(c => ({ id: c.id, start: c.time, label: c.skill as string, contacts: [c] })),
            ...points.map(r => ({ id: `point-${r.id}`, start: r.pointTime!, label: 'Ponto', contacts: [] as VideoContact[] })),
        ].sort((a, b) => a.start - b.start);
        if (!stages.length || stages[0].start > start) stages.unshift({ id: 'intro', start, label: 'Início do rally', contacts: [] });
        return stages.map((stage, i) => ({ ...stage, end: stages[i + 1]?.start ?? end }));
    }, [doc.rallies, previewDoc, contacts, points, focus, start, end]);
    const current = chapters.findLast(c => c.start <= time + .001) ?? chapters[0];
    const coverage = useMemo(() => {
        const bins = new Array<number>(180).fill(0);
        for (const p of tracking) if (p.time >= start && p.time < end) bins[Math.min(179, Math.floor((p.time - start) / span * 180))] = 1;
        for (const p of doc.corrections) if (p.time >= start && p.time < end) bins[Math.min(179, Math.floor((p.time - start) / span * 180))] = 2;
        return bins;
    }, [tracking, doc.corrections, start, end, span]);
    const keepTip = () => { if (closeTimer.current) clearTimeout(closeTimer.current); };
    const hideTip = () => { keepTip(); closeTimer.current = setTimeout(() => setTip(null), 140); };
    const showTip = (preview: Preview, rect: DOMRect) => {
        keepTip();
        const inspector = track.current?.closest('.sv[data-youtube=true]')?.querySelector('.sv-inspector')?.getBoundingClientRect();
        if (inspector) {
            setTip({ ...preview, context: tipContext, left: inspector.left + 8, bottom: innerHeight - inspector.bottom + 8, maxHeight: Math.max(80, inspector.height - 16), width: inspector.width - 16 });
            return;
        }
        setTip({ ...preview, context: tipContext, left: Math.max(8, Math.min(innerWidth - 308, rect.left + rect.width / 2 - 150)), bottom: innerHeight - rect.top + 8, maxHeight: Math.max(80, rect.top - 16) });
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
    const selectedRally = doc.rallies[videoRallyIndex(doc, time)];
    const seek = (position: number) => { keepTip(); setTip(null); onSeek(position); };
    const editContact = (contact: VideoContact) => { keepTip(); setTip(null); if (onContact) onContact(contact); else onSeek(contact.time); };
    return <div className="sv-timeline" onKeyDown={e => { if (e.key === 'Escape') setTip(null); }}>
      <div className="sv-modes"><StudioAction label="Vídeo completo" active={!focus} onPress={() => onFocus(null)}>Vídeo completo</StudioAction><StudioAction label="Rally selecionado" active={!!focus} onPress={() => onFocus(selectedRally.id)}>Rally selecionado</StudioAction><small>{focus ? `Rally ${String(doc.rallies.findIndex(r => r.id === focus) + 1).padStart(2, '0')}` : `${doc.rallies.length} rallies`}</small></div>
      <div className="sv-tracks" role="region" aria-label={focus ? 'Timeline do rally' : 'Timeline do vídeo completo'}>
        <div className="sv-seek" onClickCapture={e => {
            // Pointer clicks seek within the section; keyboard activation keeps its start.
            if (!e.detail || (e.target as HTMLElement).closest('.sv-marker, .sv-point-marker, input')) return;
            const rect = e.currentTarget.getBoundingClientRect();
            if (!rect.width) return;
            e.preventDefault();
            e.stopPropagation();
            seek(start + Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * span);
        }}>
          <input aria-label="Posição no vídeo" type="range" min={start} max={end} step={.001} value={Math.max(start, Math.min(end, time))} aria-valuetext={`${videoTime(time, true)} · ${current?.label ?? ''}`} onChange={e => seek(Number(e.target.value))}/>
          <div className="sv-segments" aria-label={focus ? 'Etapas do rally' : 'Rallies do vídeo'}>{chapters.map(c => {
              const preview = { label: c.label, detail: `${videoTime(c.start)} – ${videoTime(c.end)}`, contacts: c.contacts };
              return <div key={c.id} className={`sv-chapter${current?.id === c.id ? ' current' : ''}`} style={{ left: `${(c.start - start) / span * 100}%`, width: `${(c.end - c.start) / span * 100}%`, '--chapter-progress': `${Math.max(0, Math.min(100, (time - c.start) / Math.max(.001, c.end - c.start) * 100))}%` } as React.CSSProperties}
                onPointerEnter={e => showTip(preview, e.currentTarget.getBoundingClientRect())} onPointerLeave={hideTip} onFocus={e => showTip(preview, e.currentTarget.getBoundingClientRect())} onBlur={hideTip}>
                <StudioAction label={`${c.label} em ${videoTime(c.start)}`} describedBy={tip?.label === c.label ? tipId : undefined} onPress={() => seek(c.start)}><span className="sv-sr-only">{c.label}</span></StudioAction>
              </div>;
          })}</div>
        <div ref={track} className="sv-contact-markers" aria-label="Contatos na timeline">{groups.map(group => {
            const c = group.contacts[0], many = group.contacts.length > 1;
            const pending = c.id === draftContact?.id;
            const label = many ? `${group.contacts.length} contatos` : c.skill;
            const summary = many ? contactOutcomeSummary(group.contacts) : [];
            const tone = many ? 'neutral' : contactOutcomeTone(c);
            const flag = many ? summary[0]?.tone ?? 'neutral' : tone;
            const evaluation = pending ? 'Em edição' : many ? summary.map(s => s.label).join(' · ') : c.outcome || 'Não avaliado';
            const preview = { label, detail: many ? `${videoTime(c.time)} – ${videoTime(group.contacts.at(-1)!.time)}` : '', contacts: group.contacts };
            return <div key={c.id} className={`sv-marker${many ? ' grouped' : ''}${!focus ? ' macro' : ''}`} data-draft={pending || undefined} data-outcome={tone} style={{ left: `clamp(12px, ${group.position * 100}%, calc(100% - 12px))` } as React.CSSProperties}
              onPointerEnter={e => showTip(preview, e.currentTarget.getBoundingClientRect())} onPointerLeave={hideTip} onFocus={e => showTip(preview, e.currentTarget.getBoundingClientRect())} onBlur={hideTip}>
              <StudioAction label={`${label} · ${videoTime(c.time, true)}${evaluation ? ` · ${evaluation}` : ''}`} describedBy={tip?.contacts === group.contacts ? tipId : undefined} onPress={() => editContact(c)}>{!focus ? <span className="sv-contact-tick" data-outcome={flag} aria-hidden="true"/> : many ? group.contacts.length : videoSkillLetters[c.skill]}{flag !== 'neutral' ? <span className="sv-outcome-symbol" data-outcome={flag} aria-hidden="true">{contactOutcomeSymbols[flag]}</span> : null}{many ? <span className="sv-marker-colors" aria-hidden="true">{group.contacts.map(contact => <i key={contact.id} data-outcome={contactOutcomeTone(contact)}/>)}</span> : null}</StudioAction>
            </div>;
        })}{points.map(r => <div key={`point-${r.id}`} className="sv-point-marker" style={{ left: `clamp(12px, ${(r.pointTime! - start) / span * 100}%, calc(100% - 12px))` }}>
            <StudioAction label={`Ponto · ${videoTime(r.pointTime!, true)} · ${r.winner ? teams[r.winner] : 'N/D'}`} icon="flag" onPress={() => seek(r.pointTime!)}/>
        </div>)}</div>
        </div>
        <div className="sv-timeline-caption"><span>{visibleDraft ? `${visibleDraft.skill} · ${videoTime(visibleDraft.time, true)} · Em edição` : current?.label ?? 'Vídeo completo'}</span><small>{videoTime(start)} – {videoTime(end)}</small></div>
        <div className="sv-lane"><small>Bola</small><div className="sv-ball" aria-label={tracking.length || doc.corrections.length ? 'Bola: marcações e correções disponíveis' : 'Bola: sem rastreamento'}>{coverage.map((state, i) => <i key={i} className={state === 2 ? 'corrected' : state ? 'detected' : ''}/>)}</div></div>
      </div>
      {tip ? <div id={tipId} className="sv-floating-tip" style={{ left: tip.left, bottom: tip.bottom, maxHeight: tip.maxHeight, width: tip.width }} role="tooltip" onPointerEnter={keepTip} onPointerLeave={hideTip} onFocus={keepTip} onBlur={hideTip}>
        <div className="sv-tip-heading"><b>{tip.label}</b><small>{tip.detail}</small></div>
        {tip.contacts.length > 1 ? <div className="sv-tip-summary">{contactOutcomeSummary(tip.contacts).map(s => <span key={s.tone} className="sv-outcome-label" data-outcome={s.tone}><span aria-hidden="true">{contactOutcomeSymbols[s.tone]} </span>{s.label}</span>)}</div> : null}
        {tip.contacts.length ? <ul>{tip.contacts.map(c => <li key={c.id} data-outcome={contactOutcomeTone(c)}>
          <StudioAction label={`Ir para ${c.skill} em ${videoTime(c.time, true)}`} onPress={() => editContact(c)}><span className="sv-tip-contact"><b>{c.skill}</b><time>{videoTime(c.time, true)}</time><small>{teams[c.team]}{c.athlete ? ` · ${c.athlete}` : ''}</small><span className="sv-outcome-label" data-outcome={contactOutcomeTone(c)}><span aria-hidden="true">{contactOutcomeSymbols[contactOutcomeTone(c)]} </span>{c.outcome || 'Não avaliado'}</span></span></StudioAction>
        </li>)}</ul> : <p>{tip.label === 'Ponto' ? 'Fim do rally' : focus && contacts.length ? 'Antes do primeiro contato' : 'Sem contatos registrados'}</p>}
      </div> : null}
    </div>;
}
