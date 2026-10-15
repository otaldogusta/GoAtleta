import { useState } from 'react';
import { StudioAction } from './StudioUI.web';

export function ConnectedVideoSources({ youtubeId, originalName, onRemove }: { youtubeId?: string; originalName?: string; onRemove: (kind: 'youtube' | 'original') => void }) {
    const [pending, setPending] = useState<'youtube' | 'original' | null>(null);
    if (!youtubeId && !originalName) return null;
    return <section aria-label="Vídeos conectados" style={{ margin: '8px 0 14px' }}>
      <small>Conectados</small>
      {pending ? <div role="alert" style={{ marginTop: 8 }}><b>Remover {pending === 'youtube' ? 'link do YouTube' : 'vídeo original'}?</b><p style={{ fontSize: 12 }}>A reprodução desta fonte será desconectada. Os rallies, contatos e marcações serão mantidos.{pending === 'youtube' && originalName ? ' O original associado também será desconectado.' : ''}</p><div className="sv-wrap"><StudioAction label="Cancelar remoção do vídeo" onPress={() => setPending(null)}>Cancelar</StudioAction><StudioAction label="Confirmar remoção do vídeo" onPress={() => { onRemove(pending); setPending(null); }}>Remover</StudioAction></div></div> : <>
        {([{ kind: 'youtube' as const, text: youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : '' }, { kind: 'original' as const, text: originalName ?? '' }]).filter(item => item.text).map(item => <div key={item.kind} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, border: '1px solid var(--sv-line)', borderRadius: 8, padding: '4px 8px' }}><span style={{ color: 'var(--sv-muted)', fontSize: 11, minWidth: 0, overflowWrap: 'anywhere', flex: 1 }}>{item.text}</span><StudioAction label={item.kind === 'youtube' ? 'Remover link do YouTube' : 'Remover vídeo original'} icon="close" onPress={() => setPending(item.kind)}/></div>)}
      </>}
    </section>;
}
