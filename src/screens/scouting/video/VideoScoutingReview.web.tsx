import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getScoutingResultOptions, scoutingActionFundamentals } from '../../../core/scouting';
import { scoutingRallyOutcomeLabel } from '../../../core/scouting-rallies';
import { pointLinkKey, savePointVideoLink, scoutingVideoLinksKey, suggestPointVideoTime } from '../../../core/scouting-video-links';
import { videoTime, type VideoDocument } from '../../../core/scouting-video';
import { acceptScoutingVideoSuggestions, buildScoutingVideoAlignment, type ScoutingVideoAlignmentSuggestion } from '../../../core/scouting-video-alignment';
import { localVideoAiAvailable } from '../../../api/scouting-video-ai';
import { useVideoScoutingLinks } from './use-video-scouting-links';
import { useVideoAlignmentEvidence } from './use-video-alignment-evidence';
import { useVideoVisualAlignment } from './use-video-visual-alignment';
import { useVideoReviewPreferences } from './use-video-review-preferences';
import { StudioAction } from './StudioUI.web';
import type { LinkedScoutingSession } from './types';

const normalized = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function VideoScoutingReview({ user, org, classId, sessionId, opponent, date, doc, time, focus, onSeek, onPlay, disabled, onSourcesChange }: {
    user: string; org: string; classId: string; sessionId: string; opponent?: string | null; date?: string;
    doc: VideoDocument; time: number; focus: string | null; onSeek: (time: number) => void; disabled: boolean;
    onPlay?: (time: number) => void;
    onSourcesChange?: (sources: LinkedScoutingSession[]) => void;
}) {
    const key = scoutingVideoLinksKey(user, org, classId, sessionId, doc.media.fingerprint);
    const review = useVideoScoutingLinks(key, org, classId, sessionId, doc.media.duration);
    const evidence = useVideoAlignmentEvidence(user, org, sessionId, doc.media);
    const preferences = useVideoReviewPreferences(key);
    const visual = useVideoVisualAlignment(user, org, sessionId, doc.media, preferences.sides);
    const canAnalyzeVideo = localVideoAiAvailable();
    const sourcesObserver = useRef(onSourcesChange);
    useLayoutEffect(() => { sourcesObserver.current = onSourcesChange; }, [onSourcesChange]);
    const observingSources = !!onSourcesChange;
    const linkedSourcesSignature = useMemo(() => JSON.stringify(review.sources.map(({session}) => ({id:session.id,title:session.title,date:session.date}))), [review.sources]);
    useEffect(() => {
        if (!observingSources || review.loading || review.error) return;
        sourcesObserver.current?.(JSON.parse(linkedSourcesSignature) as LinkedScoutingSession[]);
    }, [linkedSourcesSignature, review.loading, review.error, observingSources]);
    const [selected, setSelected] = useState<string[]>([]), [sourceId, setSourceId] = useState(''), [pointId, setPointId] = useState(''), [localError, setLocalError] = useState('');
    const [message, setMessage] = useState(''), [settingsOpen, setSettingsOpen] = useState(false), [associating, setAssociating] = useState(false);
    const format = preferences.format;
    const regulation = useMemo(() => format === '21-23' ? { pointsToWin: 21, cap: 23 } : undefined, [format]);
    useEffect(() => { setSelected(review.links.sessionIds); }, [review.links.sessionIds]);
    const suggestions = useMemo(() => review.available.filter(s => {
        const rival = normalized(opponent ?? '');
        return rival.length >= 4 && !!date && s.date === date && (normalized(s.opponent ?? '') === rival || normalized(s.title).includes(rival));
    }), [review.available, opponent, date]);
    const orderedSources = useMemo(() => [...review.sources].sort((a,b) => (a.rallies[0]?.setNumber ?? 0)-(b.rallies[0]?.setNumber ?? 0) || a.session.createdAt.localeCompare(b.session.createdAt)), [review.sources]);
    const allPoints = useMemo(() => orderedSources.flatMap(s => s.rallies), [orderedSources]);
    const alignmentVideo = useMemo(() => ({ media: doc.media, rallies: doc.rallies, contacts: doc.contacts }), [doc.media, doc.rallies, doc.contacts]);
    const alignment = useMemo(() => {
        if (review.loading || review.error || evidence.loading || evidence.error || preferences.loading) return { result: null, error: '' };
        try { return { result: buildScoutingVideoAlignment({ video: alignmentVideo, points: allPoints, links: review.links, observations: evidence.observations, visualRallies: visual.visualRallies, regulation }), error: '' }; }
        catch (failure) { return { result: null, error: failure instanceof Error ? failure.message : 'Não foi possível cruzar os registros com o vídeo.' }; }
    }, [alignmentVideo, allPoints, review.links, review.loading, review.error, evidence.observations, evidence.loading, evidence.error, visual.visualRallies, regulation, preferences.loading]);
    const confident = alignment.result?.suggestions.filter(s => s.confidence === 'high') ?? [];
    const toReview = alignment.result?.suggestions.filter(s => s.confidence === 'review') ?? [];
    const preserved = review.links.links.filter(l => !l.missing).length;
    const missingTotal = review.links.links.filter(l => l.missing).length;
    const pendingTotal = allPoints.filter(p => !review.links.links.some(l => l.sessionId === p.sessionId && l.rallyId === p.id)).length;
    const synchronizationStatus = visual.loading ? 'Em andamento' : evidence.loading ? 'Carregando…' : evidence.error || visual.error || alignment.error || preferences.error ? 'Atenção' : pendingTotal ? `${pendingTotal} pendentes` : 'Tudo associado';
    const source = orderedSources.find(s => s.session.id === sourceId) ?? orderedSources[0];
    const points = source?.rallies.slice().sort((a,b) => a.setNumber-b.setNumber || a.number-b.number) ?? [];
    const point = points.find(p => p.id === pointId) ?? points[0];
    const setNumber = point?.setNumber ?? points[0]?.setNumber ?? 1;
    const sideKey = JSON.stringify([source?.session.id, setNumber]);
    const ourSide = preferences.sides[sideKey] ?? '';
    const link = point ? review.links.links.find(l => l.sessionId === point.sessionId && l.rallyId === point.id) : undefined;
    const selectedRally = focus ? doc.rallies.find(r => r.id === focus) : doc.rallies.findLast(r => r.start <= time);
    const sameVideoLinks = selectedRally ? review.links.links.filter(l => l.videoRallyId === selectedRally.id) : [];
    const suggestion = point && !link ? suggestPointVideoTime(point, points, review.links, doc.media.duration) : null;
    const pointSuggestions = point && !link ? alignment.result?.suggestions.filter(s => s.sessionId === point.sessionId && s.rallyId === point.id) ?? [] : [];
    const unresolved = point && !link ? alignment.result?.unresolved.find(s => s.sessionId === point.sessionId && s.rallyId === point.id) : undefined;
    const linkedIndex = link ? doc.rallies.findIndex(r => r.id === link.videoRallyId) : -1;
    const stale = link && !link.missing && (linkedIndex < 0 || link.time! < doc.rallies[linkedIndex].start || link.time! >= (doc.rallies[linkedIndex + 1]?.start ?? doc.media.duration));
    const busy = review.loading || review.saving || associating || disabled;
    const alignmentBusy = busy || evidence.loading || !!evidence.error || visual.loading || preferences.loading;
    const acceptSuggestions = async (items: ScoutingVideoAlignmentSuggestion[]) => {
        if (alignmentBusy || !items.length) return;
        setAssociating(true); setLocalError(''); setMessage('');
        try {
            const next = acceptScoutingVideoSuggestions(review.links, doc, allPoints, items, evidence.observations, visual.visualRallies, regulation);
            if (await review.save(next)) setMessage(items.length === 1 ? 'Sugestão associada. Vínculos anteriores preservados.' : `${items.length} sugestões associadas. Vínculos anteriores preservados.`);
        } catch (failure) { setLocalError(failure instanceof Error ? failure.message : 'Não foi possível associar as sugestões.'); }
        finally { setAssociating(false); }
    };
    const openSuggestion = (item: ScoutingVideoAlignmentSuggestion) => {
        setSourceId(item.sessionId); setPointId(item.rallyId); setMessage(''); onSeek(item.time);
    };
    const save = async (missing: boolean) => {
        if (!point || busy) return;
        try {
            setLocalError(''); setMessage('');
            const next = savePointVideoLink(review.links, point, doc, missing ? null : time);
            if (await review.save(next)) setMessage(missing ? 'Ponto marcado sem imagem. Registro original preservado.' : 'Ponto vinculado ao vídeo neste aparelho.');
        } catch (failure) { setLocalError((failure as Error).message); }
    };
    const choosePoint = (id: string) => {
        setPointId(id); setMessage('');
        const match = review.links.links.find(l => l.sessionId === source?.session.id && l.rallyId === id);
        if (match?.time != null && !match.missing) onSeek(match.time);
    };
    const pointIndex = point ? points.indexOf(point) : -1;
    const sourceLinks = review.links.links.filter(l => points.some(p => p.id === l.rallyId && p.sessionId === l.sessionId));
    const associated = sourceLinks.filter(l => !l.missing).length, missing = sourceLinks.filter(l => l.missing).length;
    const pending = points.filter(p => !sourceLinks.some(l => l.rallyId === p.id && l.sessionId === p.sessionId));
    const nextPending = pending.find(p => points.indexOf(p) > pointIndex) ?? pending[0];
    const runVisual = (retryFailed = false) => {
        if (!canAnalyzeVideo || busy || visual.loading || preferences.loading || !ourSide || !source || !pending.length) return;
        void visual.run({ ourSide, points: allPoints, anchors: review.links.links, setNumber, sessionId: source.session.id, regulation, retryFailed });
    };
    return <section className="sv-scouting-review" aria-label="Scouting registrado durante o jogo">
        <div className="sv-row sv-review-heading"><span className="sv-section-meta">{review.sources.length ? `${review.sources.reduce((n,s) => n+s.rallies.length,0)} registros do jogo` : 'Registros feitos durante o jogo'}</span><StudioAction label={settingsOpen ? 'Fechar seleção de análises' : 'Escolher análises dos sets'} icon="management" active={settingsOpen} onPress={() => setSettingsOpen(value => !value)}/></div>
        {review.loading ? <p role="status">Carregando registros…</p> : null}
        {review.error || localError ? <p className="sv-alert" role="alert">{review.error || localError}</p> : null}
        {review.error ? <StudioAction label="Recarregar registros do scouting" onPress={review.retry}>Tentar novamente</StudioAction> : null}
        {!review.links.sessionIds.length || settingsOpen ? <div className="sv-review-settings">
          <h3>Quais sets você registrou?</h3>
          {suggestions.length ? <StudioAction label="Selecionar análises sugeridas deste jogo" disabled={busy} onPress={() => setSelected(suggestions.map(s => s.id))}>Selecionar {suggestions.length} deste jogo</StudioAction> : null}
          <div className="sv-scouting-sources">{review.available.map(s => <label key={s.id}><input type="checkbox" aria-label={`Vincular ${s.title}`} checked={selected.includes(s.id)} disabled={busy} onChange={event => setSelected(ids => event.target.checked ? [...ids, s.id] : ids.filter(id => id !== s.id))}/><span>{s.title}<small>{s.date} · {s.status === 'concluido' ? 'Concluída' : 'Em andamento'}</small></span></label>)}</div>
          <StudioAction label="Salvar análises vinculadas ao vídeo" primary disabled={busy || JSON.stringify([...selected].sort()) === JSON.stringify([...review.links.sessionIds].sort())} onPress={() => { setMessage(''); void review.save({ ...review.links, sessionIds: selected, links: review.links.links.filter(l => selected.includes(l.sessionId)) }).then(saved => { if (saved) { setMessage('Sets adicionados. Registros originais preservados.'); setSettingsOpen(false); } }); }}>Usar {selected.length} análises</StudioAction>
          <p className="sv-section-meta">Associações salvas neste aparelho. Os registros do jogo não são alterados.</p>
        </div> : null}
        {review.sources.length ? <>
          <div className="sv-review-sets" aria-label="Sets registrados">{orderedSources.map(s => <StudioAction key={s.session.id} label={`Revisar ${s.rallies.length ? `set ${s.rallies[0].setNumber}` : s.session.title}`} active={source?.session.id === s.session.id} onPress={() => { setSourceId(s.session.id); setPointId(''); setMessage(''); }}>{s.rallies.length ? `Set ${s.rallies[0].setNumber}` : s.session.title}</StudioAction>)}</div>
          <div className="sv-review-progress"><small>{associated} com vídeo{missing ? ` · ${missing} sem imagem` : ''} · {pending.length} {pending.length === 1 ? 'pendente' : 'pendentes'}</small><StudioAction label="Próximo ponto sem vínculo no vídeo" disabled={busy || !nextPending} onPress={() => { if (nextPending) choosePoint(nextPending.id); }}>Próximo pendente</StudioAction></div>
          {sameVideoLinks.length && (sameVideoLinks[0].rallyId !== point?.id || sameVideoLinks[0].sessionId !== point?.sessionId) ? <StudioAction label="Abrir registro associado ao recorte atual" onPress={() => { setSourceId(sameVideoLinks[0].sessionId); setPointId(sameVideoLinks[0].rallyId); }}>Ver registro deste recorte</StudioAction> : null}
          {point ? <>
            <div className="sv-review-point-nav"><StudioAction label="Ponto registrado anterior" icon="chevronBack" disabled={pointIndex <= 0} onPress={() => choosePoint(points[pointIndex-1].id)}/><label className="sv-field"><span><select aria-label="Ponto registrado" value={point.id} onChange={e => choosePoint(e.target.value)}>{points.map((p,i) => <option key={p.id} value={p.id}>Registro {i+1} de {points.length} · {p.scoreUs} × {p.scoreThem}</option>)}</select></span></label><StudioAction label="Próximo ponto registrado" icon="chevronForward" disabled={pointIndex >= points.length-1} onPress={() => choosePoint(points[pointIndex+1].id)}/></div>
            <div className="sv-review-score" aria-label={`Placar registrado: nós ${point.scoreUs}, adversário ${point.scoreThem}`}><div><small>Nosso time</small><strong>{point.scoreUs}</strong></div><span>×</span><div><small>Adversário</small><strong>{point.scoreThem}</strong></div></div>
            {point.outcome ? <p className="sv-review-winner">{scoutingRallyOutcomeLabel(point.outcome)}</p> : null}
            <section className="sv-review-video"><div className="sv-row"><h3>Vídeo deste ponto</h3><small>{link?.missing ? 'Sem imagem' : stale ? 'Conferir recorte' : link ? videoTime(link.time!) : 'Não associado'}</small></div>
              {link?.time != null ? <StudioAction label="Ver ponto vinculado no vídeo" primary onPress={() => (onPlay ?? onSeek)(link.time!)}>Assistir lance · {videoTime(link.time)}</StudioAction> : null}
              {pointSuggestions.map(candidate => <div key={candidate.videoRallyId} className="sv-scouting-suggestion">
                <div className="sv-row"><strong>{candidate.confidence === 'high' ? 'Maior confiança' : 'Conferir'}</strong><time>{videoTime(candidate.time)}</time></div>
                <ul>{candidate.reasons.map((reason, i) => <li key={i}>{reason}</li>)}</ul>
                <div className="sv-wrap"><StudioAction label={`Assistir sugestão em ${videoTime(candidate.time)}`} disabled={busy} onPress={() => (onPlay ?? onSeek)(candidate.time)}>Assistir</StudioAction><StudioAction label={`Confirmar sugestão em ${videoTime(candidate.time)}`} primary={pointSuggestions.length === 1} disabled={alignmentBusy} onPress={() => { void acceptSuggestions([candidate]); }}>Confirmar associação</StudioAction></div>
              </div>)}
              {!link || stale ? <>{unresolved ? <p className="sv-section-meta">{unresolved.reason}</p> : !pointSuggestions.length ? <p className="sv-section-meta">Encontre o lance no vídeo e associe o instante.</p> : null}{suggestion !== null && !pointSuggestions.length ? <StudioAction label="Ver sugestão de correspondência" onPress={() => onSeek(suggestion)}>Estimativa pelo horário · {videoTime(suggestion)}</StudioAction> : null}<StudioAction label="Vincular ponto ao instante atual do vídeo" primary={!pointSuggestions.length} disabled={busy || !selectedRally} onPress={() => { void save(false); }}>Associar em {videoTime(time)}</StudioAction></> : null}
              {link?.missing ? <p className="sv-section-meta">Este lance não aparece na gravação.</p> : null}
              <details className="sv-disclosure"><summary>{link ? 'Alterar associação' : 'Outras opções'}</summary>{link && !stale ? <><StudioAction label="Vincular ponto ao instante atual do vídeo" disabled={busy || !selectedRally} onPress={() => { void save(false); }}>Usar instante {videoTime(time)}</StudioAction><StudioAction label="Remover vínculo deste ponto" disabled={busy} onPress={() => { setMessage(''); void review.save({ ...review.links, links: review.links.links.filter(l => pointLinkKey(l.sessionId, l.rallyId) !== pointLinkKey(point.sessionId, point.id)) }); }}>Remover associação</StudioAction></> : null}<StudioAction label="Marcar ponto sem imagem no vídeo" disabled={busy} onPress={() => { void save(true); }}>Lance não aparece no vídeo</StudioAction></details>
            </section>
            <section className="sv-review-contacts"><h3>Contatos</h3>{point.contacts.length ? <ul className="sv-scouting-contacts">{point.contacts.map((contact,i) => <li key={i}><b>{contact.athleteName || 'Sem atleta'}</b><span>{contact.resultKey === 'freeball_devolvida' ? 'Bola de graça' : scoutingActionFundamentals.find(f => f.id === contact.fundamental)?.label ?? contact.fundamental}<em>{contact.resultKey === 'freeball_devolvida' ? 'Devolvida' : getScoutingResultOptions(contact.fundamental).find(r => r.key === contact.resultKey)?.label ?? contact.resultKey}</em></span></li>)}</ul> : <p className="sv-section-meta">{point.outcome ? 'Sem contatos registrados' : 'Somente placar registrado'}</p>}</section>
          </> : <p className="sv-section-meta">Este set não tem registros por jogada.</p>}
          <details className="sv-disclosure sv-review-sync" aria-label="Sincronização e conferência"><summary><span>Sincronização e conferência</span><small>{synchronizationStatus}</small></summary>
          <section className="sv-review-alignment" aria-label="Sincronização com o vídeo">
            <div className="sv-row"><h3>Sincronização com o vídeo</h3><small>{preserved} vínculos preservados{missingTotal ? ` · ${missingTotal} sem imagem` : ''}</small></div>
            {evidence.loading ? <p className="sv-section-meta" role="status">Carregando observações do vídeo…</p> : null}
            {evidence.error ? <><p className="sv-alert" role="alert">{evidence.error}</p><StudioAction label="Recarregar observações do vídeo" disabled={busy} onPress={evidence.retry}>Tentar novamente</StudioAction></> : null}
            {alignment.error ? <p className="sv-alert" role="alert">{alignment.error}</p> : alignment.result ? <>
              <p className="sv-section-meta">{confident.length} com maior confiança · {toReview.length} para conferir{alignment.result.unresolved.length ? ` · ${alignment.result.unresolved.length} sem correspondência` : ''}</p>
              {confident.length ? <StudioAction label="Associar sugestões confiáveis" primary disabled={alignmentBusy} onPress={() => { void acceptSuggestions(confident); }}>{associating ? 'Associando…' : `Associar ${confident.length} sugestões`}</StudioAction> : null}
              {toReview.length ? <StudioAction label="Conferir próxima sugestão de sincronização" disabled={busy} onPress={() => openSuggestion(toReview[0])}>Conferir sugestões</StudioAction> : null}
              {!confident.length && !toReview.length ? <p className="sv-section-meta">{alignment.result.unresolved.length ? 'Os registros pendentes precisam de conferência no vídeo.' : 'Todos os registros têm uma associação ou indicação de imagem ausente.'}</p> : null}
            </> : null}
          </section>
          {doc.media.youtubeId && (pending.length || visual.loading || visual.error) ? <section className="sv-review-visual" aria-label="Conferência visual"><h3>Conferir trechos com vídeo</h3>
            <label className="sv-field">Formato do jogo<span><select aria-label="Formato do jogo" value={format} disabled={busy || visual.loading || preferences.loading} onChange={event => { void preferences.setFormat(event.target.value as '' | '21-23'); }}><option value="">Formato padrão</option><option value="21-23">Sets de 21, limite 23</option></select></span></label>
            <label className="sv-field">Nossa equipe neste trecho<span><select aria-label="Nossa equipe neste trecho" value={ourSide} disabled={busy || visual.loading || preferences.loading} onChange={event => { void preferences.setSide(sideKey, event.target.value as '' | 'near' | 'far'); }}><option value="">Selecione o lado</option><option value="near">Perto da câmera</option><option value="far">Fundo da quadra</option></select></span></label>
            {preferences.error ? <><p className="sv-alert" role="alert">{preferences.error}</p><StudioAction label="Recarregar preferências da revisão" disabled={busy || visual.loading} onPress={preferences.retry}>Recarregar preferências</StudioAction></> : null}
            {canAnalyzeVideo ? <p className="sv-section-meta">Revisa até 8 trechos de um minuto. Usa IA e reaproveita os trechos salvos.</p> : null}
            {visual.error ? <p className="sv-alert" role="alert">{visual.error}</p> : null}
            {visual.message ? <p role="status" className="sv-section-meta">{visual.message}</p> : null}
            {visual.loading ? <div className="sv-review-visual-progress"><p role="status">Conferindo vídeo · {videoTime(visual.processedSeconds)} processados</p><StudioAction label="Cancelar conferência visual" onPress={visual.cancel}>Cancelar</StudioAction></div> : canAnalyzeVideo ? <><StudioAction label="Analisar pendências deste set" disabled={busy || preferences.loading || !ourSide || !pending.length} onPress={() => runVisual()}>Analisar pendências deste set</StudioAction>{visual.failedWindows ? <StudioAction label="Reanalisar trechos sem leitura" disabled={busy || preferences.loading || !ourSide} onPress={() => runVisual(true)}>Reanalisar trechos sem leitura</StudioAction> : null}</> : null}
            {!visual.loading && visual.processedSeconds > 0 ? <p className="sv-section-meta">{videoTime(visual.processedSeconds)} conferidos.</p> : null}
          </section> : null}
          </details>
        </> : null}
        {message ? <p role="status" className="sv-section-meta">{message}</p> : null}
    </section>;
}
