import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import type { CourtVisualPayload } from '../../core/visual-court';
import { parseCourtShareHash } from '../../core/court-sharing';
import { readSharedCourt } from '../../api/court-sharing';
import { CourtReadOnlyPlayer } from './CourtReadOnlyPlayer';
import { CourtActionButton } from './CourtEditorControls';
import { useAppTheme } from '../../ui/app-theme';

export default function SharedCourtScreen() {
  const router = useRouter(), { colors } = useAppTheme();
  const [payload, setPayload] = useState<CourtVisualPayload | null>(null), [error, setError] = useState('');
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    let stopped = false, unavailable = false, pageActive = document.visibilityState === 'visible';
    let poll: ReturnType<typeof setTimeout> | null = null;
    let request: { controller: AbortController; deadline: ReturnType<typeof setTimeout> | null } | null = null;
    const visible = () => pageActive && document.visibilityState === 'visible';
    const clearPoll = () => { if (poll !== null) clearTimeout(poll); poll = null; };
    const pause = () => {
      clearPoll();
      const previous = request; request = null;
      if (previous) { if (previous.deadline !== null) clearTimeout(previous.deadline); previous.controller.abort(); }
    };
    const schedule = () => {
      clearPoll();
      if (!stopped && !unavailable && visible()) poll = setTimeout(() => { poll = null; void refresh(); }, 60000);
    };
    async function refresh() {
      if (request || stopped || unavailable || !visible()) return;
      clearPoll();
      const access = parseCourtShareHash(window.location.hash);
      if (!access) { unavailable = true; setPayload(null); setError('LINK_UNAVAILABLE'); return; }
      const task = { controller: new AbortController(), deadline: null as ReturnType<typeof setTimeout> | null }; request = task;
      task.deadline = setTimeout(() => {
        if (stopped || request !== task) return;
        request = null; task.controller.abort();
        // A slow or suspended request must not discard an already mounted player.
        setError('SERVICE_UNAVAILABLE'); schedule();
      }, 20000);
      try {
        const next = await readSharedCourt(access.id, access.code, task.controller.signal);
        if (!stopped && request === task && !task.controller.signal.aborted && visible()) { setPayload(old => old ?? next); setError(''); }
      } catch (failure) {
        if (stopped || request !== task || !visible()) return;
        const message = failure instanceof Error ? failure.message : 'SERVICE_UNAVAILABLE';
        if (message === 'LINK_UNAVAILABLE') { unavailable = true; setPayload(null); }
        setError(message);
      } finally {
        if (task.deadline !== null) clearTimeout(task.deadline);
        if (request === task) { request = null; schedule(); }
      }
    }
    void refresh();
    const visibility = () => { pageActive = document.visibilityState === 'visible'; if (pageActive) void refresh(); else pause(); };
    const show = () => { pageActive = true; void refresh(); };
    const hide = () => { pageActive = false; pause(); };
    const online = () => { void refresh(); };
    const hash = () => { unavailable = true; pause(); setPayload(null); setError(''); setEpoch(value => value + 1); };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pageshow', show); window.addEventListener('pagehide', hide);
    window.addEventListener('online', online); window.addEventListener('hashchange', hash);
    return () => {
      stopped = true; pause(); document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pageshow', show); window.removeEventListener('pagehide', hide);
      window.removeEventListener('online', online); window.removeEventListener('hashchange', hash);
    };
  }, [epoch]);
  if (typeof document === 'undefined') return null;
  return createPortal(<div style={{ position: 'fixed', inset: 0, zIndex: 6100, display: 'flex' }}>
    {payload ? <CourtReadOnlyPlayer payload={payload} onClose={() => router.replace('/welcome')} /> : <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '600' }}>Quadra compartilhada</Text>
      <Text accessibilityRole={error ? 'alert' : undefined} style={{ color: colors.muted, textAlign: 'center' }}>{error === 'LINK_UNAVAILABLE' ? 'Este link foi revogado ou não é válido.' : error ? 'Não foi possível abrir a jogada. Tente novamente.' : 'Abrindo jogada…'}</Text>
      {error && error !== 'LINK_UNAVAILABLE' ? <CourtActionButton icon="view" text label="Tentar novamente" onPress={() => setEpoch(value => value + 1)} /> : null}
      <CourtActionButton icon="view" text label="Ir para o Go Atleta" onPress={() => router.replace('/welcome')} />
    </View>}
  </div>, document.body);
}
