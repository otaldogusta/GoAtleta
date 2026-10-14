import { useEffect, useRef, useState } from 'react';
import type { VideoDocument } from '../../../core/scouting-video';
import { videoShareLink, type VideoShareAudience } from '../../../core/scouting-video-sharing';
import { assertSessionIdentity, getSessionIdentity } from '../../../auth/session';
import { StudioAction, StudioDialog } from './StudioUI.web';
import { getVideoShare, prepareVideoShare, prepareYouTubeShare, publishVideoShare, revokeVideoShare, videoShareError, type VideoShare, type VideoShareScope } from '../../../api/scouting-video-sharing';
import { uploadSharedVideo } from '../../../api/scouting-video-upload.web';

export function VideoShareDialog({ doc, file, teams, scope, onClose, onPreview }: {
  doc: VideoDocument; file: File | null; teams: { us: string; them: string }; scope: VideoShareScope; onClose: () => void; onPreview: () => void;
}) {
  const [audience, setAudience] = useState<VideoShareAudience>('team'), [days, setDays] = useState(7);
  const [share, setShare] = useState<VideoShare | null>(null), [link, setLink] = useState('');
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const controller = useRef<AbortController | null>(null), alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    void getVideoShare({ org: scope.org, sessionId: scope.sessionId }, doc.media.fingerprint).then(value => { if (alive.current) { setShare(value); if (value) setAudience(value.audience); } })
      .catch(failure => { if (alive.current) setError(videoShareError(failure)); })
      .finally(() => { if (alive.current) setLoading(false); });
    return () => { alive.current = false; controller.current?.abort(); };
  }, [scope.org, scope.sessionId, doc.media.fingerprint]);
  const publish = async () => {
    if ((!file && !doc.media.youtubeId) || controller.current) return;
    const task = new AbortController(), identity = getSessionIdentity(); controller.current = task;
    setBusy(true); setError(''); setMessage(''); setProgress(doc.media.youtubeId ? null : 0);
    try {
      const asset = doc.media.youtubeId ? await prepareYouTubeShare(scope, doc.media.youtubeId) : await prepareVideoShare(scope, doc, file!);
      assertSessionIdentity(identity); task.signal.throwIfAborted();
      if (!doc.media.youtubeId && file && 'objectPath' in asset) await uploadSharedVideo(file, asset as import('../../../api/scouting-video-sharing').VideoShareAsset, task.signal, value => { if (alive.current) setProgress(value); });
      assertSessionIdentity(identity); task.signal.throwIfAborted(); setProgress(null);
      const code = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
      const result = await publishVideoShare(scope, asset, doc, teams.us, audience, code, days);
      assertSessionIdentity(identity); task.signal.throwIfAborted();
      if (alive.current) { setShare(result); setLink(videoShareLink(result.id, code, window.location.origin)); setMessage('Link criado. A equipe verá esta versão da análise.'); }
    } catch (failure) {
      if (alive.current && !task.signal.aborted) setError(failure instanceof Error && /limite de hospedagem|envio|Sessão/.test(failure.message) ? failure.message : videoShareError(failure));
    } finally {
      if (controller.current === task) controller.current = null;
      if (alive.current) { setBusy(false); setProgress(null); }
    }
  };
  const revoke = async () => {
    if (!share || busy) return;
    setBusy(true); setError('');
    try { await revokeVideoShare(scope, share.id); if (alive.current) { setShare({ ...share, revoked: true }); setLink(''); setMessage('Acesso revogado.'); } }
    catch (failure) { if (alive.current) setError(videoShareError(failure)); }
    finally { if (alive.current) setBusy(false); }
  };
  const local = ['localhost','127.0.0.1'].includes(window.location.hostname);
  return <StudioDialog title="Compartilhar análise" onClose={() => { controller.current?.abort(); onClose(); }} className="sv-share">
    <p>O mesmo estúdio, com acesso somente para visualizar.</p>
    <div className="sv-share-summary"><b>{teams.us} × {teams.them}</b><small>{doc.rallies.length} rallies · {doc.contacts.length} contatos</small></div>
    <label className="sv-field">Quem pode acessar<span><select aria-label="Quem pode acessar" value={audience} disabled={busy || loading} onChange={e => { setAudience(e.target.value as VideoShareAudience); setLink(''); }}><option value="team">Equipe desta turma</option><option value="link">Qualquer pessoa com o link</option></select></span></label>
    <p className="sv-share-hint">{audience === 'team' ? 'Atletas da turma e comissão entram com sua conta do Go Atleta.' : 'Quem receber este link poderá assistir, inclusive se ele for encaminhado.'}</p>
    <div className="sv-share-options"><div className="sv-field">Permissão<span className="sv-share-permission">Visualizar</span></div>
    <label className="sv-field">Validade<span><select aria-label="Validade do link" value={days} disabled={busy || loading} onChange={e => { setDays(Number(e.target.value)); setLink(''); }}><option value={7}>7 dias</option><option value={30}>30 dias</option></select></span></label></div>
    <p className="sv-share-hint">Sem editar marcações, salvar rascunhos ou gerenciar acessos.</p>
    {share && !share.revoked ? <p className="sv-share-hint">Acesso atual até {new Date(share.expiresAt).toLocaleDateString('pt-BR')}. Um novo link desativa o anterior e publica as marcações atuais.</p> : <p className="sv-share-hint">Inclui o vídeo, as marcações e os nomes visíveis nesta versão da análise.</p>}
    {doc.media.youtubeId ? <p className="sv-share-hint">Sem envio do vídeo. O acesso à análise não impede que o link do YouTube seja repassado.</p> : null}
    {local && !error ? <p className="sv-share-hint">Publique esta versão do Go Atleta para criar um link para a equipe.</p> : null}
    {loading ? <p role="status">Conferindo acesso…</p> : null}
    {error ? <p role="alert">{error}</p> : null}
    {busy ? <div role="status"><p>{progress !== null ? `Enviando vídeo… ${Math.round(progress * 100)}%` : 'Atualizando acesso…'}</p>{progress !== null ? <progress max="1" value={progress} aria-label="Envio do vídeo"/> : null}</div> : null}
    {message ? <p role="status">{message}</p> : null}
    {link ? <label className="sv-field">Link da análise<span><input aria-label="Link da análise" readOnly value={link} onFocus={e => e.target.select()}/></span></label> : null}
    <div className="sv-wrap">
      {link ? <StudioAction primary icon="copy" label="Copiar link" onPress={() => { void navigator.clipboard.writeText(link).then(() => setMessage('Link copiado.')).catch(() => setError('Selecione e copie o link acima.')); }}>Copiar link</StudioAction> : <StudioAction primary icon="share" label={share && !share.revoked ? 'Gerar novo link' : 'Criar link'} disabled={busy || loading || (!file && !doc.media.youtubeId) || local} onPress={() => void publish()}>{share && !share.revoked ? 'Gerar novo link' : 'Criar link'}</StudioAction>}
      <StudioAction label="Prévia de leitura" disabled={busy} onPress={onPreview}>Prévia de leitura</StudioAction>
      {share && !share.revoked ? <StudioAction label="Revogar acesso" disabled={busy} onPress={() => void revoke()}>Revogar acesso</StudioAction> : null}
      {busy && progress !== null ? <StudioAction label="Cancelar envio" onPress={() => controller.current?.abort()}>Cancelar envio</StudioAction> : null}
    </div>
  </StudioDialog>;
}
