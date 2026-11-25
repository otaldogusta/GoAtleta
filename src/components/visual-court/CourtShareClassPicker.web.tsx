import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { canManageCourtShareClass, listCourtShareClasses, type CourtShareClass, type CourtShareScope } from '../../api/court-sharing';
import { useAuth } from '../../auth/auth';
import { getSessionIdentity, isSessionIdentityCurrent } from '../../auth/session';
import { getReadCacheGeneration } from '../../db/client';
import { useOptionalOrganization } from '../../providers/organization-context';
import { StudioAction, StudioDialog } from '../../screens/scouting/video/StudioUI.web';
import { studioStyles } from '../../screens/scouting/video/studio-styles';
import { typography } from '../../theme/tokens';
import { useAppTheme } from '../../ui/app-theme';
import { courtSharingStyles } from './court-sharing-styles';

export type CourtShareClassPickerProps = {
  onSelect: (target: Pick<CourtShareScope, 'org' | 'classId'>) => void;
  onClose: () => void;
  onDownload: () => void;
};

function DownloadAction({ onDownload }: Pick<CourtShareClassPickerProps, 'onDownload'>) {
  return <StudioAction label="Baixar jogada" icon="download" onPress={onDownload}>Baixar jogada</StudioAction>;
}

function ClassChoices({ org, onSelect, onDownload, onRetry }: Omit<CourtShareClassPickerProps, 'onClose'> & { org: string; onRetry: () => void }) {
  const [classes, setClasses] = useState<CourtShareClass[] | null>(null);
  const [classId, setClassId] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const mounted = useRef(false);
  const pending = useRef(false);
  // The parent remounts this selection when the account or organization changes.
  const [assertCurrent] = useState(() => {
    const identity = getSessionIdentity(), generation = getReadCacheGeneration();
    return () => {
      if (!mounted.current || !isSessionIdentityCurrent(identity) || getReadCacheGeneration() !== generation) {
        throw new Error('A sessão ou a organização mudou.');
      }
    };
  });
  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    let active = true;
    void listCourtShareClasses(org, assertCurrent).then(rows => {
      assertCurrent();
      if (active) setClasses(rows);
    }).catch(() => {
      if (active) setError('Não foi possível carregar as turmas.');
    });
    return () => { active = false; };
  }, [org, assertCurrent]);

  const select = async () => {
    if (pending.current || !classes?.some(row => row.id === classId)) return;
    pending.current = true;
    setChecking(true);
    setError('');
    const target = { org, classId };
    try {
      assertCurrent();
      const allowed = await canManageCourtShareClass(target, assertCurrent);
      assertCurrent();
      if (allowed) onSelect(target);
      else {
        setClasses(rows => rows?.filter(row => row.id !== classId) ?? []);
        setClassId('');
        setError('Você não tem permissão para compartilhar nesta turma.');
      }
    } catch {
      if (mounted.current) setError('Não foi possível verificar o acesso à turma.');
    } finally {
      pending.current = false;
      if (mounted.current) setChecking(false);
    }
  };

  return <>
    {classes?.length ? <label className="sv-field">Turma<span>
      <select value={classId} disabled={checking} onChange={event => { setClassId(event.target.value); setError(''); }}>
        <option value="">Selecione uma turma</option>
        {classes.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
      </select>
    </span></label> : null}
    {error ? <p role="alert">{error}</p> : !classes ? <p role="status">Carregando turmas…</p> :
      !classes.length ? <p role="status">Nenhuma turma disponível nesta organização.</p> : null}
    <div className="sv-share-actions">
      {error || classes?.length === 0 ? <DownloadAction onDownload={onDownload} /> : null}
      {error && !classes ? <StudioAction label="Tentar novamente" onPress={onRetry}>Tentar novamente</StudioAction> : null}
      {classes?.length ? <StudioAction primary label="Continuar" disabled={!classId || checking} onPress={() => void select()}>
        {checking ? 'Verificando…' : 'Continuar'}
      </StudioAction> : null}
    </div>
  </>;
}

export function CourtShareClassPicker({ onSelect, onClose, onDownload }: CourtShareClassPickerProps) {
  const { session, loading } = useAuth();
  const organization = useOptionalOrganization();
  const { colors } = useAppTheme();
  const [attempt, setAttempt] = useState(0);
  const identity = getSessionIdentity();
  const signedIn = Boolean(identity.userId && identity.userId === session?.user.id);
  const org = organization?.activeOrganization?.id;
  if (typeof document === 'undefined') return null;
  return createPortal(<div style={{
    fontFamily: typography.body.fontFamily, fontSize: 14, '--sv-bg': colors.background, '--sv-panel': colors.card,
    '--sv-input': colors.inputBg, '--sv-text': colors.text, '--sv-muted': colors.muted, '--sv-line': colors.border, '--sv-green': colors.primaryBg,
  } as CSSProperties}>
    <style>{studioStyles}{courtSharingStyles}</style>
    <StudioDialog title="Compartilhar jogada" onClose={onClose} className="sv-share sv-court-share">
      {loading || organization?.isLoading ? <p role="status">Conferindo acesso…</p> :
        signedIn && org && org === organization?.activeOrganizationId
          ? <ClassChoices key={JSON.stringify([identity.userId, identity.generation, org, attempt])} org={org} onSelect={onSelect} onDownload={onDownload} onRetry={() => setAttempt(value => value + 1)} />
          : <>
            <p role="status">{signedIn ? 'Selecione uma organização para gerar um link.' : 'Entre no Go Atleta e escolha uma turma para gerar um link.'} Você pode baixar a jogada como arquivo.</p>
            <div className="sv-share-actions"><DownloadAction onDownload={onDownload} /></div>
          </>}
    </StudioDialog>
  </div>, document.body);
}
