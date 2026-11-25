import { supabasePost } from '../db/client';
import { supabaseRestGet } from './rest';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
import { publishableCourt } from '../core/court-sharing';
import type { CourtVisualPayload } from '../core/visual-court';

export type CourtShareScope = { org: string; classId: string; key: string };
export type CourtShare = { id: string; revoked: boolean; updatedAt: string };
export type CourtShareClass = { id: string; name: string };

export async function listCourtShareClasses(org: string, assertCurrent: () => void): Promise<CourtShareClass[]> {
  const classes: CourtShareClass[] = [];
  const path = `/classes?select=id,name&organization_id=eq.${encodeURIComponent(org)}&order=name.asc,id.asc`;
  const pageSize = 250;
  for (;;) {
    assertCurrent();
    const page = await supabaseRestGet<CourtShareClass[]>(`${path}&limit=${pageSize}&offset=${classes.length}`, assertCurrent);
    classes.push(...page);
    if (page.length < pageSize) return classes;
  }
}

export async function canManageCourtShareClass({ org, classId }: Pick<CourtShareScope, 'org' | 'classId'>, assertCurrent: () => void) {
  const path = `/rpc/court_share_can_manage?p_org=${encodeURIComponent(org)}&p_class=${encodeURIComponent(classId)}`;
  return await supabaseRestGet<boolean>(path, assertCurrent) === true;
}

const args = (scope: CourtShareScope) => ({ p_org: scope.org, p_class: scope.classId, p_key: scope.key });
export const getCourtShare = (scope: CourtShareScope) => supabasePost<CourtShare | null>('/rpc/get_court_share', args(scope));
export const publishCourtShare = (scope: CourtShareScope, payload: CourtVisualPayload, code: string) =>
  supabasePost<CourtShare>('/rpc/publish_court_share', { ...args(scope), p_document: publishableCourt(payload), p_proof: code });
export const revokeCourtShare = (scope: CourtShareScope, id: string) =>
  supabasePost<void>('/rpc/revoke_court_share', { ...args(scope), p_share: id });
export function courtShareError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (/PGRST202|42P01|42883/.test(message)) return 'O compartilhamento da quadra ainda precisa ser ativado no servidor.';
  if (/42501/.test(message)) return 'Sua conta não pode compartilhar esta quadra.';
  return 'Não foi possível compartilhar. Confira sua conexão e tente novamente.';
}
export async function readSharedCourt(id: string, code: string, signal: AbortSignal): Promise<CourtVisualPayload> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/read_court_share`, { method: 'POST', signal,
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_share: id, p_proof: code }), cache: 'no-store' });
  if (!response.ok) throw new Error('SERVICE_UNAVAILABLE');
  const value = await response.json();
  if (!value || value.permission !== 'viewer') throw new Error('LINK_UNAVAILABLE');
  return publishableCourt(value.document);
}
