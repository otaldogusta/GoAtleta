import { memo, useMemo } from 'react';
import type { BallPosition, VideoDocument } from '../../../core/scouting-video';
import { trackingIndex, trackingTrail } from '../../../core/scouting-video-playback';
const emptyPositions: BallPosition[] = [];

/** Image coordinates, not a court homography or a reconstructed 3D flight. */
export const YouTubeTrackingPanel = memo(function YouTubeTrackingPanel({ doc, time, correcting, onCorrect, youtube = true }: {
    youtube?: boolean; doc: VideoDocument; time: number; correcting: boolean; onCorrect?: (x: number, y: number) => void;
}) {
    const positions = doc.analysis?.positions ?? emptyPositions, original = doc.analysis?.source ?? doc.media;
    const index = trackingIndex(positions, time);
    const correction = doc.corrections.findLast(p => Math.abs(p.time - time) < .025);
    const point = correction ?? positions[index];
    const start = Math.max(doc.rallies.findLast(r => r.start <= time)?.start ?? 0, doc.analysis?.cuts.findLast(c => c <= time) ?? 0);
    const visible = point && point.time >= start;
    const trail = useMemo(() => trackingTrail(positions, index, start).map(p => `${p.x * 1000},${p.y * 1000}`).join(' '), [positions, index, start]);
    return <section className="sv-tracking-panel" aria-label="Tracking sincronizado da bola">
      <div className="sv-row"><b>Trajetória da bola</b><small>{visible ? correction ? 'Corrigida' : 'Detectada' : 'Sem posição neste instante'}</small></div>
      <svg role="img" aria-label="Posição da bola na vista da câmera" viewBox="0 0 1000 1000" preserveAspectRatio="none" style={{ aspectRatio: `${original.width} / ${original.height}`, maxWidth: `${160 * original.width / original.height}px`, cursor: correcting ? 'crosshair' : undefined }} onClick={e => {
          if (!correcting || !onCorrect) return;
          const box = e.currentTarget.getBoundingClientRect();
          if (!box.width || !box.height) return;
          onCorrect(Math.max(0, Math.min(1, (e.clientX - box.left) / box.width)), Math.max(0, Math.min(1, (e.clientY - box.top) / box.height)));
      }}>
        <path d="M0 500H1000M500 0V1000" className="sv-tracking-grid"/>
        {visible ? <><polyline points={correction ? '' : trail} className="sv-tracking-trail" vectorEffect="non-scaling-stroke"/><ellipse cx={point.x * 1000} cy={point.y * 1000} rx={18} ry={18 * original.width / original.height} className="sv-tracking-dot"/></> : null}
      </svg>
      <small>{correcting ? 'Clique no painel para corrigir a posição da bola.' : youtube ? 'Vista da câmera · sincronização aproximada do YouTube' : 'Vista da câmera · sincronizada com o vídeo'}</small>
    </section>;
});
