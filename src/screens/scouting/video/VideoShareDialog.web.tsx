import { useEffect, useRef, useState } from 'react';
import type { VideoDocument } from '../../../core/scouting-video';
import { videoShareLink, type VideoShareAudience } from '../../../core/scouting-video-sharing';
import { assertSessionIdentity, getSessionIdentity } from '../../../auth/session';
import { useAuth } from '../../../auth/auth';
import { StudioAction, StudioDialog } from './StudioUI.web';
import { GoAtletaIcon } from '../../../ui/icon-registry';
import { VideoShareAudienceMenu, VideoShareRoleMenu } from './VideoShareRoleMenu.web';
import { getVideoShare, prepareVideoShare, prepareYouTubeShare, publishVideoShare, revokeVideoShare, videoShareError, type VideoShare, type VideoShareScope } from '../../../api/scouting-video-sharing';
import { uploadSharedVideo } from '../../../api/scouting-video-upload.web';

export function VideoShareDialog({ doc, file, teams, scope, onClose, onPreview }: {
  doc: VideoDocument; file: File | null; teams: { us: string; them: string }; scope: VideoShareScope; onClose: () => void; onPreview: () => void;
}) {
  const { session } = useAuth();
  const personName = session?.user.user_metadata?.full_name || session?.user.user_metadata?.name || 'Você';
  const [audience, setAudience] = useState<VideoShareAudience>('team');
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
  const copyLink = async (url: string) => {
    try { await navigator.clipboard.writeText(url); if (alive.current) setMessage('Link copiado.'); }
    catch { if (alive.current) setError('Selecione e copie o link abaixo.'); }
  };
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
      const result = await publishVideoShare(scope, asset, doc, teams.us, audience, code);
      assertSessionIdentity(identity); task.signal.throwIfAborted();
      if (alive.current) {
        const url = videoShareLink(result.id, code, window.location.origin);
        setShare(result); setLink(url); await copyLink(url);
      }
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
  const existingLink = share && !share.revoked && !link;
  return <StudioDialog title={`Compartilhar “${teams.us} × ${teams.them}”`} onClose={() => { controller.current?.abort(); onClose(); }} className="sv-share"
    headerActions={<details className="sv-share-settings">
      <summary aria-label="Configurações de compartilhamento" title="Configurações de compartilhamento"><GoAtletaIcon name="management" size={21} color="currentColor"/></summary>
      <div className="sv-share-settings-menu">
        <StudioAction icon="view" label="Prévia de leitura" disabled={busy} onPress={onPreview}>Prévia de leitura</StudioAction>
        {share && !share.revoked ? <StudioAction label="Revogar acesso" disabled={busy} onPress={() => void revoke()}>Revogar acesso</StudioAction> : null}
      </div>
    </details>}>
    <section className="sv-share-people" aria-labelledby="sv-share-people-title">
      <h3 id="sv-share-people-title">Pessoas com acesso</h3>
      <div className="sv-share-person">
        <span className="sv-share-avatar" aria-hidden="true">{personName.slice(0, 1).toLocaleUpperCase('pt-BR')}</span>
        <div><b>{personName}{personName !== 'Você' ? ' (você)' : ''}</b><small>{session?.user.email}</small></div>
        <span className="sv-share-person-role">Pode gerenciar</span>
      </div>
    </section>
    <section className="sv-share-access" aria-labelledby="sv-share-access-title">
      <h3 id="sv-share-access-title">Acesso geral</h3>
      <div className="sv-share-access-row">
        <span className="sv-share-access-icon" aria-hidden="true"><GoAtletaIcon name={audience === 'team' ? 'members' : 'externalProvider'} size={22} color="currentColor"/></span>
        <div className="sv-share-audience">
          <VideoShareAudienceMenu value={audience} disabled={busy || loading} onChange={value => { setAudience(value); setLink(''); }}/>
          {audience === 'link' ? <small id="sv-share-audience-hint">Qualquer pessoa que receber o link pode visualizar.</small> : null}
        </div>
        <VideoShareRoleMenu disabled={busy}/>
      </div>
    </section>
    {existingLink ? <p className="sv-share-hint">Um novo link substitui o anterior.</p> : null}
    {loading ? <p role="status">Conferindo acesso…</p> : null}
    {error ? <p role="alert">{error}</p> : null}
    {busy ? <div role="status"><p>{progress !== null ? `Enviando vídeo… ${Math.round(progress * 100)}%` : 'Atualizando acesso…'}</p>{progress !== null ? <progress max="1" value={progress} aria-label="Envio do vídeo"/> : null}</div> : null}
    {message ? <p role="status">{message}</p> : null}
    {link && error ? <label className="sv-field">Link da análise<span><input aria-label="Link da análise" readOnly value={link} onFocus={e => e.target.select()}/></span></label> : null}
    <div className="sv-share-actions">
      <StudioAction icon="link" label={existingLink ? 'Gerar novo link' : 'Copiar link'} disabled={busy || loading || (!link && (!file && !doc.media.youtubeId))} onPress={() => { setError(''); void (link ? copyLink(link) : publish()); }}>{existingLink ? 'Gerar novo link' : 'Copiar link'}</StudioAction>
      {busy && progress !== null ? <StudioAction label="Cancelar envio" onPress={() => controller.current?.abort()}>Cancelar envio</StudioAction> : <StudioAction primary label="Concluído" disabled={busy} onPress={onClose}>Concluído</StudioAction>}
    </div>
  </StudioDialog>;
}
