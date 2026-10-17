import { StudioAction } from './StudioUI.web';

export type VideoSyncStatus = 'loading' | 'synced' | 'pending' | 'offline' | 'unavailable' | 'conflict' | 'forbidden' | 'error';

export function videoDraftNeedsSyncRetry(status: VideoSyncStatus) {
    return ['pending', 'offline', 'unavailable', 'error'].includes(status);
}

export function VideoSyncFooter({ status, dirty, saving }: { status: VideoSyncStatus; dirty: boolean; saving: boolean }) {
    const text = saving ? 'Salvando análise…' : dirty ? 'Alterações não salvas' : {
        loading: 'Abrindo análise sincronizada…',
        synced: 'Sincronizado',
        pending: 'Salvo neste aparelho · sincronização pendente',
        offline: 'Salvo neste aparelho · sem conexão',
        unavailable: 'Salvo neste aparelho · sincronização indisponível',
        conflict: 'Há versões diferentes desta análise',
        forbidden: 'Sem permissão para sincronizar',
        error: 'Salvo neste aparelho · sincronização pendente',
    }[status];
    return <small role="status" aria-live="polite">{text}</small>;
}

export function VideoSyncConflict({ saving, writable, onResolve }: {
    saving: boolean; writable: boolean; onResolve: (version: 'local' | 'remote') => Promise<boolean>;
}) {
    return <div className="sv-alert" role="alert">
      <b>Esta análise tem versões diferentes.</b>
      <p className="sv-section-meta">Escolha qual continuar. As duas versões serão preservadas.</p>
      {writable ? <div className="sv-wrap">
        <StudioAction label="Manter versão deste aparelho" disabled={saving} onPress={() => { void onResolve('local'); }}>Manter versão deste aparelho</StudioAction>
        <StudioAction label="Usar versão sincronizada" disabled={saving} onPress={() => { void onResolve('remote'); }}>Usar versão sincronizada</StudioAction>
      </div> : <p className="sv-section-meta">Volte à edição para escolher a versão.</p>}
    </div>;
}
