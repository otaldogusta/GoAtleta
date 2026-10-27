import type { CourtVisualPayload } from './visual-court';
import { parseEditorImport } from './visual-court-editor';

export const courtShareCodePattern = /^[a-f0-9]{64}$/;
export function publishableCourt(payload: CourtVisualPayload): CourtVisualPayload {
  const parsed = parseEditorImport(JSON.stringify({ format: 'goatleta-court', version: 1, payload }));
  return { ...parsed, editor: { ...parsed.editor!, folder: '', tags: '', favorite: false, lessonLink: undefined,
    actorMeta: Object.fromEntries(Object.entries(parsed.editor!.actorMeta).map(([id, meta]) => [id, {
      team: meta.team, locked: meta.locked, simulationSupport: meta.simulationSupport,
    }])) } };
}
export function courtShareLink(id: string, code: string, origin: string) {
  return `${origin}/court/shared#${new URLSearchParams({ id, code })}`;
}
export function parseCourtShareHash(hash: string) {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const id = params.get('id') || '', code = params.get('code') || '';
  return /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id) && courtShareCodePattern.test(code) ? { id, code } : null;
}
