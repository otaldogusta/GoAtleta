import { useState } from 'react';
import type { VideoDocumentSyncErrorCode } from '../../../api/scouting-video-documents';
import { videoTime } from '../../../core/scouting-video';
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

/** A persistent sync issue stays available without re-announcing an alert on every retry. */
export function VideoSyncNotice({ code, error, dirty, saving, firstStart, onRetry, onExport }: {
    code: VideoDocumentSyncErrorCode; error: string; dirty: boolean; saving: boolean; firstStart?: number;
    onRetry?: () => Promise<boolean>; onExport?: () => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const rejected = code === 'server-rejected';
    return <section className="sv-sync-notice" aria-label="Sincronização da análise">
      <div className="sv-row"><small>{dirty ? 'Alterações ainda na tela' : 'Salvo neste aparelho'} · sincronização pausada</small>
        <StudioAction label={expanded ? 'Recolher detalhes da sincronização' : 'Ver detalhes da sincronização'} onPress={() => setExpanded(!expanded)}>{expanded ? 'Recolher' : 'Detalhes'}</StudioAction>
      </div>
      {expanded ? <div className="sv-sync-notice-details">
        <p>{rejected ? 'A sincronização precisa aceitar a versão atual dos seus recortes. Você pode continuar a revisão neste aparelho.' : error}</p>
        {rejected && firstStart != null && firstStart > 0 ? <small>Primeiro rally em {videoTime(firstStart, true)}. O trecho de preparação continua fora do recorte.</small> : null}
        <div className="sv-wrap">
          {onExport ? <StudioAction label="Exportar cópia da análise" disabled={saving} onPress={onExport}>Exportar cópia</StudioAction> : null}
          {onRetry ? <StudioAction label="Tentar sincronizar a análise" disabled={saving} onPress={() => { void onRetry(); }}>Tentar sincronizar</StudioAction> : null}
        </div>
      </div> : null}
    </section>;
}
