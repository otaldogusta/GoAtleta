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
    let stopped = false, controller: AbortController | null = null;
    const refresh = async () => {
      if (controller || stopped) return;
      const access = parseCourtShareHash(window.location.hash);
      if (!access) { setPayload(null); setError('LINK_UNAVAILABLE'); return; }
      const task = new AbortController(); controller = task;
      const timeout = setTimeout(() => task.abort(), 20000);
      try {
        const next = await readSharedCourt(access.id, access.code, task.signal);
        if (!stopped && !task.signal.aborted) { setPayload(old => old ?? next); setError(''); }
      } catch (failure) {
        if (!stopped) { setPayload(null); setError(failure instanceof Error ? failure.message : 'SERVICE_UNAVAILABLE'); }
      } finally { clearTimeout(timeout); controller = null; }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 60000);
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    const hash = () => { setPayload(null); setError(''); setEpoch(value => value + 1); };
    document.addEventListener('visibilitychange', visible); window.addEventListener('hashchange', hash);
    return () => { stopped = true; controller?.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', visible); window.removeEventListener('hashchange', hash); };
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
