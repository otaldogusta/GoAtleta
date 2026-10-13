import type { BallPosition } from './scouting-video';

/** Last sample at or before the displayed frame. Never paint across missing frames. */
export function trackingIndex(rows: readonly BallPosition[], time: number) {
    let low = 0, high = rows.length - 1;
    while (low <= high) {
        const mid = (low + high) >>> 1;
        if (rows[mid].time <= time + .001) low = mid + 1;
        else high = mid - 1;
    }
    return high >= 0 && time - rows[high].time < 1 / 30 - .001 ? high : -1;
}

export function trackingTrail(rows: readonly BallPosition[], index: number, cutStart: number) {
    if (index < 0) return [];
    let start = index;
    while (start > 0 && index - start < 12) {
        const a = rows[start - 1], b = rows[start];
        if (a.time < cutStart || b.time - a.time > .05 || Math.hypot(b.x - a.x, b.y - a.y) > .15) break;
        start--;
    }
    return rows.slice(start, index + 1);
}

/** Same adaptive scene threshold and strongest-first suppression as the local prototype. */
export function sceneCuts(scores: readonly number[], fps = 30) {
    if (!scores.length) return [];
    const median = (values: number[]) => { values.sort((a, b) => a - b); const m = values.length >> 1; return values.length % 2 ? values[m] : (values[m - 1] + values[m]) / 2; };
    const middle = median([...scores]), threshold = Math.max(3, middle + 8 * median(scores.map(n => Math.abs(n - middle))));
    const chosen: number[] = [];
    scores.map((score, frame) => ({ score, frame })).filter(p => p.score >= threshold && p.frame > fps && p.frame < scores.length - fps).sort((a, b) => b.score - a.score).forEach(p => {
        if (chosen.every(frame => Math.abs(frame - p.frame) > fps * 2)) chosen.push(p.frame);
    });
    return chosen.sort((a, b) => a - b).map(frame => frame / fps);
}
