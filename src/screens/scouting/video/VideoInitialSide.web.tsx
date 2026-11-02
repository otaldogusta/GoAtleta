import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

export function videoInitialSideKey(user: string, org: string, session: string, fingerprint: string) {
    if (![user, org, session, fingerprint].every(Boolean)) throw new Error('Escopo do vídeo incompleto.');
    return `goatleta:video-initial-side:v1:${[user, org, session, fingerprint].map(encodeURIComponent).join(':')}`;
}

/** Device preference; does not assign contact teams across later side changes. */
export function VideoInitialSide({ scope, disabled }: { scope: string; disabled: boolean }) {
    const [side, setSide] = useState(''), [status, setStatus] = useState('Carregando…'), [busy, setBusy] = useState(true);
    useEffect(() => {
        let alive = true;
        void AsyncStorage.getItem(scope).then(value => {
            if (alive) { setSide(value === 'near' || value === 'far' ? value : ''); setStatus(value ? 'Salvo neste aparelho' : ''); }
        }).catch(() => { if (alive) setStatus('Não foi possível ler o lado inicial.'); })
            .finally(() => { if (alive) setBusy(false); });
        return () => { alive = false; };
    }, [scope]);
    const save = async (value: string) => {
        if (busy || disabled || !['near', 'far'].includes(value)) return;
        setBusy(true);
        try { await AsyncStorage.setItem(scope, value); setSide(value); setStatus('Salvo neste aparelho'); }
        catch { setStatus('Não foi possível salvar. Tente novamente.'); }
        finally { setBusy(false); }
    };
    return <><label className="sv-field">Nossa equipe no início<span><select aria-label="Lado inicial da nossa equipe" disabled={disabled || busy} value={side} onChange={event => { void save(event.target.value); }}><option value="">Selecione o lado</option><option value="near">Perto da câmera</option><option value="far">Fundo da quadra</option></select></span></label><p className="sv-section-meta" role="status">{status}</p><p className="sv-section-meta">Confira as trocas de lado em cada set antes de atribuir contatos.</p></>;
}
