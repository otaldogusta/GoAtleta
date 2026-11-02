export type VideoReviewPreferences = { version: 1; format: '' | '21-23'; sides: Record<string, 'near' | 'far'> };

function validSideKey(key: string) {
    try { const tuple = JSON.parse(key); return Array.isArray(tuple) && tuple.length === 2 && typeof tuple[0] === 'string' && tuple[0].length > 0 && tuple[0].length <= 300 && Number.isInteger(tuple[1]) && tuple[1] >= 1 && tuple[1] <= 99 && JSON.stringify(tuple) === key; }
    catch { return false; }
}

/** Shared parser for local review settings and verified backup recovery. */
export function parseVideoReviewPreferences(value: unknown): VideoReviewPreferences {
    const v = value as VideoReviewPreferences;
    if (!v || v.version !== 1 || !['', '21-23'].includes(v.format) || !v.sides || typeof v.sides !== 'object' || Array.isArray(v.sides) || Object.keys(v.sides).length > 1000) throw new Error('Preferências de revisão inválidas.');
    const sides: VideoReviewPreferences['sides'] = {};
    for (const [key, side] of Object.entries(v.sides)) {
        if (!validSideKey(key) || !['near', 'far'].includes(side)) throw new Error('Preferências de revisão inválidas.');
        sides[key] = side;
    }
    return { version: 1, format: v.format, sides };
}
