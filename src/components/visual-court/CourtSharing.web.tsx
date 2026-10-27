import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../auth/auth';
import { assertSessionIdentity, getSessionIdentity, subscribeSession } from '../../auth/session';
import { courtShareError, getCourtShare, publishCourtShare, revokeCourtShare, type CourtShare } from '../../api/court-sharing';
import { courtShareLink, parseCourtShareHash } from '../../core/court-sharing';
import { useAppTheme } from '../../ui/app-theme';
import { GoAtletaIcon } from '../../ui/icon-registry';
import { typography } from '../../theme/tokens';
import { StudioAction, StudioDialog } from '../../screens/scouting/video/StudioUI.web';
import { VideoShareRoleMenu } from '../../screens/scouting/video/VideoShareRoleMenu.web';
import { studioStyles } from '../../screens/scouting/video/studio-styles';
import { CourtReadOnlyPlayer } from './CourtReadOnlyPlayer';
import type { CourtSharingProps } from './CourtSharing.types';

export function CourtSharing({ payload, scope, onClose }: CourtSharingProps) {
  const { org, classId, key } = scope;
  const { session } = useAuth(), { colors } = useAppTheme();
  const personName = String(session?.user.user_metadata?.full_name || session?.user.user_metadata?.name || 'Você');
  const [share, setShare] = useState<CourtShare | null>(null), [link, setLink] = useState('');
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [preview, setPreview] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const alive = useRef(true), pending = useRef(false);
  useEffect(() => {
    alive.current = true;
    const identity = getSessionIdentity();
    const unsubscribe = subscribeSession(() => { try { assertSessionIdentity(identity); } catch { alive.current = false; onClose(); } });
    void getCourtShare({ org, classId, key }).then(value => { assertSessionIdentity(identity); if (alive.current) setShare(value); })
      .catch(failure => { if (alive.current) setError(courtShareError(failure)); })
      .finally(() => { if (alive.current) setLoading(false); });
    return () => { alive.current = false; unsubscribe(); };
  }, [org, classId, key, onClose]);
  const copy = async (url: string) => {
    try {
      const access = parseCourtShareHash(new URL(url).hash);
      if (!access) throw new Error('Link inválido.');
      const publicUrl = courtShareLink(access.id, access.code);
      if (alive.current) setLink(publicUrl);
      await navigator.clipboard.writeText(publicUrl); if (alive.current) setMessage('Link copiado.');
    }
    catch { if (alive.current) setError('Selecione e copie o link abaixo.'); }
  };
  const run = async (revoke: boolean) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(''); setMessage('');
    const identity = getSessionIdentity();
    try {
      if (revoke && share) {
        await revokeCourtShare(scope, share.id); assertSessionIdentity(identity);
        if (alive.current) { setShare({ ...share, revoked: true }); setLink(''); setMessage('Acesso revogado.'); }
      } else {
        const code = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
        const result = await publishCourtShare(scope, payload, code); assertSessionIdentity(identity);
        if (alive.current) { const url = courtShareLink(result.id, code); setShare(result); setLink(url); await copy(url); }
      }
    } catch (failure) { if (alive.current) setError(courtShareError(failure)); }
    finally { pending.current = false; if (alive.current) setBusy(false); }
  };
  if (typeof document === 'undefined') return null;
  const existing = share && !share.revoked && !link;
  return createPortal(<div style={{ fontFamily: typography.body.fontFamily, fontSize: 14, '--sv-bg': colors.background, '--sv-panel': colors.card, '--sv-input': colors.inputBg, '--sv-text': colors.text, '--sv-muted': colors.muted, '--sv-line': colors.border, '--sv-green': colors.primaryBg } as CSSProperties}>
    <style>{studioStyles}</style>
    {preview ? <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex' }}><CourtReadOnlyPlayer payload={payload} onClose={() => setPreview(false)} /></div> :
      <StudioDialog title={`Compartilhar “${payload.editor?.title || 'Jogada'}”`} onClose={onClose} className="sv-share"
        headerActions={<details className="sv-share-settings"><summary aria-label="Configurações de compartilhamento"><GoAtletaIcon name="management" size={21} color="currentColor" /></summary>
          <div className="sv-share-settings-menu"><StudioAction icon="view" label="Prévia de leitura" disabled={busy} onPress={() => setPreview(true)}>Prévia de leitura</StudioAction>
            {share && !share.revoked ? <StudioAction label="Revogar acesso" disabled={busy} onPress={() => void run(true)}>Revogar acesso</StudioAction> : null}</div></details>}>
        <section className="sv-share-people"><h3>Pessoas com acesso</h3><div className="sv-share-person"><span className="sv-share-avatar" aria-hidden="true">{personName.slice(0, 1).toLocaleUpperCase('pt-BR')}</span><div><b>{personName}</b><small>{session?.user.email}</small></div><span className="sv-share-person-role">Pode gerenciar</span></div></section>
        <section className="sv-share-access"><h3>Acesso geral</h3><div className="sv-share-access-row"><span className="sv-share-access-icon"><GoAtletaIcon name="externalProvider" size={22} color="currentColor" /></span><div className="sv-share-audience"><b>Qualquer pessoa com o link</b><small>Pode visualizar e reproduzir a jogada.</small></div><VideoShareRoleMenu disabled /></div></section>
        <p className="sv-share-hint">Compartilha uma cópia atual, incluindo rótulos e notas visíveis.</p>
        {existing ? <p className="sv-share-hint">Um novo link substitui o anterior.</p> : null}
        {loading || busy ? <p role="status">{busy ? 'Atualizando acesso…' : 'Conferindo acesso…'}</p> : null}
        {error ? <p role="alert">{error}</p> : null}{message ? <p role="status">{message}</p> : null}
        {link ? <label className="sv-field">Link da jogada<span><input aria-label="Link da jogada" readOnly value={link} onFocus={event => event.target.select()} /></span></label> : null}
        <div className="sv-share-actions"><StudioAction icon="link" label={existing ? 'Gerar novo link' : 'Copiar link'} disabled={busy || loading} onPress={() => { setError(''); void (link ? copy(link) : run(false)); }}>{existing ? 'Gerar novo link' : 'Copiar link'}</StudioAction><StudioAction primary label="Concluído" disabled={busy} onPress={onClose}>Concluído</StudioAction></div>
      </StudioDialog>}
  </div>, document.body);
}
