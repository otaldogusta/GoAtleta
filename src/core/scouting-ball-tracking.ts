import type { BallPosition } from './scouting-video';

/** Confidence is detector evidence, not a calibrated probability of correctness. */
export type BallTrackingCandidate = BallPosition & { score: number };

export type BallTrackingMetrics = {
  candidates: number;
  invalid: number;
  belowConfidence: number;
  duplicateTimes: number;
  isolatedSpikes: number;
  accepted: number;
};

/**
 * Select observed positions only. Missing/occluded frames remain missing.
 * A weak single-frame excursion is removed only when four reliable adjacent
 * observations describe a much smaller local movement. No maximum ball speed
 * is imposed: fast shots, changes of direction and confident jumps survive.
 */
export function selectBallTracking(
  candidates: readonly BallTrackingCandidate[],
  options: { cuts?: readonly number[]; sampledFps?: number; minConfidence?: number } = {},
): { positions: BallPosition[]; metrics: BallTrackingMetrics } {
  const suppliedFps = options.sampledFps ?? 30, suppliedConfidence = options.minConfidence ?? .5;
  const fps = Number.isFinite(suppliedFps) && suppliedFps > 0 ? suppliedFps : 30;
  const confidence = Number.isFinite(suppliedConfidence) && suppliedConfidence >= 0 && suppliedConfidence <= 1 ? suppliedConfidence : .5;
  const metrics: BallTrackingMetrics = {
    candidates: candidates.length, invalid: 0, belowConfidence: 0,
    duplicateTimes: 0, isolatedSpikes: 0, accepted: 0,
  };
  const selected: BallTrackingCandidate[] = [];
  for (const point of candidates) {
    if (![point.time, point.x, point.y, point.score].every(Number.isFinite)
      || point.time < 0 || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1
      || point.score < 0 || point.score > 1) {
      metrics.invalid++;
    } else if (point.score < confidence) {
      metrics.belowConfidence++;
    } else {
      selected.push(point);
    }
  }
  selected.sort((a, b) => a.time - b.time || b.score - a.score);
  const unique = selected.filter((point, index) => {
    if (index && point.time === selected[index - 1].time) {
      metrics.duplicateTimes++;
      return false;
    }
    return true;
  });
  const cuts = [...(options.cuts ?? [])].filter(cut => Number.isFinite(cut) && cut >= 0).sort((a, b) => a - b);
  let cutIndex = 0;
  const segments = unique.map(point => {
    while (cutIndex < cuts.length && point.time >= cuts[cutIndex]) cutIndex++;
    return cutIndex;
  });
  const distance = (a: BallPosition, b: BallPosition) => Math.hypot(a.x - b.x, a.y - b.y);
  const positions: BallPosition[] = [];
  for (let index = 0; index < unique.length; index++) {
    const point = unique[index];
    let spike = false;
    if (index >= 2 && index + 2 < unique.length && point.score <= .7) {
      const before2 = unique[index - 2], before = unique[index - 1];
      const after = unique[index + 1], after2 = unique[index + 2];
      const neighbors = [before2, before, after, after2];
      const window = [before2, before, point, after, after2];
      const continuous = segments[index - 2] === segments[index + 2]
        && window.slice(1).every((p, i) => p.time - window[i].time <= 1.5 / fps);
      const reliable = neighbors.every(p => p.score >= .75 && p.score - point.score >= .15);
      if (continuous && reliable) {
        const localMovement = Math.max(distance(before2, before), distance(before, after) / 2, distance(after, after2));
        const excursion = Math.min(distance(before, point), distance(point, after));
        const fraction = (point.time - before.time) / (after.time - before.time);
        const expected = { time: point.time, x: before.x + (after.x - before.x) * fraction, y: before.y + (after.y - before.y) * fraction };
        // Relative disagreement with adjacent evidence, not a physical speed limit.
        spike = excursion > Math.max(.12, localMovement * 4)
          && distance(point, expected) > Math.max(.12, localMovement * 4);
      }
    }
    if (spike) metrics.isolatedSpikes++;
    else positions.push({ time: point.time, x: point.x, y: point.y });
  }
  metrics.accepted = positions.length;
  return { positions, metrics };
}
