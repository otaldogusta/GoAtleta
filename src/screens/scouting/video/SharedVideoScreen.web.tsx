import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'expo-router';
import { getSessionIdentity, isSessionIdentityCurrent, subscribeSession } from '../../../auth/session';
import { buildLoginRedirectHref } from '../../../auth/post-login-redirect';
import { videoShareCodePattern } from '../../../core/scouting-video-sharing';
import { useAppTheme } from '../../../ui/app-theme';
import { Studio } from './ScoutingVideoStudio.web';
import { StudioAction } from './StudioUI.web';
import { studioStyles } from './studio-styles';
import { readSharedVideo, SharedVideoError, type SharedVideo } from '../../../api/scouting-video-sharing';
import type { CSSProperties } from 'react';

import { markRender, measureAsync } from '../../../observability/perf';

const pendingKey = 'goatleta:shared-video-login';
export default function SharedVideoScreen() {
  markRender('screen.scouting.shared.render.web');
  const router = useRouter(), { colors } = useAppTheme();
  const [access, setAccess] = useState<{ id: string; code: string } | null>(null);
  const [value, setValue] = useState<SharedVideo | null>(null), [error, setError] = useState('');
  const [epoch, setEpoch] = useState(0), mediaFailures = useRef(0);
  useEffect(() => {
    const read = () => {
      setValue(null); setError(''); mediaFailures.current = 0;
      let hash = window.location.hash.slice(1);
      if (!hash) {
        try { hash = sessionStorage.getItem(pendingKey) || ''; sessionStorage.removeItem(pendingKey); } catch { /* Storage may be unavailable. */ }
        if (hash) window.history.replaceState(null, '', `/scouting/shared#${hash}`);
      }
      const params = new URLSearchParams(hash), id = params.get('id') || '', code = params.get('code') || '';
      if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id) || !videoShareCodePattern.test(code)) { setAccess(null); setError('LINK_UNAVAILABLE'); return; }
      setAccess({ id, code });
    };
    read(); window.addEventListener('hashchange', read);
    let identity = getSessionIdentity();
    const unsubscribe = subscribeSession(() => {
      if (!isSessionIdentityCurrent(identity)) { identity = getSessionIdentity(); setValue(null); setEpoch(n => n + 1); }
    });
    return () => { window.removeEventListener('hashchange', read); unsubscribe(); };
  }, []);
  useEffect(() => {
    if (!access) return;
    let controller: AbortController | null = null, stopped = false;
    const refresh = async () => {
      if (controller || stopped) return;
      const task = new AbortController(); controller = task;
      const timeout = setTimeout(() => task.abort(), 20000);
      try {
        const next = await measureAsync('screen.scouting.shared.load.access', () => readSharedVideo(access.id, access.code, task.signal));
        if (stopped || task.signal.aborted) return;
        setValue(current => current ? { ...next,
          document: current.updatedAt === next.updatedAt ? current.document : next.document,
          mediaUrl: current.mediaExpiresAt > Date.now() + 65000 ? current.mediaUrl : next.mediaUrl,
          mediaExpiresAt: current.mediaExpiresAt > Date.now() + 65000 ? current.mediaExpiresAt : next.mediaExpiresAt,
        } : next);
        setError('');
      } catch (failure) {
        if (stopped) return;
        setValue(null); setError(failure instanceof SharedVideoError ? failure.code : 'SERVICE_UNAVAILABLE');
      } finally { clearTimeout(timeout); controller = null; }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 60000);
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => { stopped = true; controller?.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [access, epoch]);
  const mediaError = useCallback(() => {
    // One renewed URL may recover an expired media request; a broken file must
    // not generate an unbounded signing loop.
    if (++mediaFailures.current > 1) { setValue(null); setError('MEDIA_UNAVAILABLE'); }
    else { setValue(null); setEpoch(n => n + 1); }
  }, []);
  if (typeof document === 'undefined') return null;
  const close = () => router.replace('/');
  if (value) return createPortal(<Studio org="" userId="" classId="" sessionId="" teamName={value.teamName} students={[]}
    session={{ title: value.title, opponent: value.opponent, status: 'concluido' }}
    shared={{ document: value.document, source: value.mediaUrl, onMediaError: mediaError }} onClose={close}/>, document.body);
  const message = error === 'LOGIN_REQUIRED' ? 'Entre com a conta vinculada à equipe para assistir.' : error === 'ACCESS_DENIED' ? 'Sua conta não tem acesso a esta análise.' : error === 'LINK_UNAVAILABLE' ? 'Este link expirou, foi revogado ou não é válido.' : error === 'MEDIA_UNAVAILABLE' ? 'Não foi possível carregar o vídeo.' : error ? 'Não foi possível abrir a análise. Tente novamente.' : 'Abrindo análise…';
  return createPortal(<div className="sv sv-shared-status" style={{ '--sv-bg': colors.background, '--sv-panel': colors.card, '--sv-text': colors.text, '--sv-muted': colors.muted, '--sv-line': colors.border, '--sv-green': colors.primaryBg } as CSSProperties}>
    <style>{studioStyles}</style><section><h1>Estúdio de scouting</h1><p role={error ? 'alert' : 'status'}>{message}</p><div className="sv-wrap">
      {error === 'LOGIN_REQUIRED' ? <StudioAction primary label="Entrar para assistir" onPress={() => {
        if (!access) return;
        try { sessionStorage.setItem(pendingKey, new URLSearchParams(access).toString()); }
        catch { setError('SERVICE_UNAVAILABLE'); return; }
        router.push(buildLoginRedirectHref('/scouting/shared') as '/login');
      }}>Entrar para assistir</StudioAction> : error && error !== 'LINK_UNAVAILABLE' && error !== 'ACCESS_DENIED' ? <StudioAction primary label="Tentar novamente" onPress={() => { mediaFailures.current = 0; setError(''); setEpoch(n => n + 1); }}>Tentar novamente</StudioAction> : null}
      <StudioAction label="Ir para o Go Atleta" onPress={close}>Go Atleta</StudioAction>
    </div></section></div>, document.body);
}
