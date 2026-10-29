import { supabasePost } from '../db/client';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
import { publishableCourt } from '../core/court-sharing';
import type { CourtVisualPayload } from '../core/visual-court';

export type CourtShareScope = { org: string; classId: string; key: string };
export type CourtShare = { id: string; revoked: boolean; updatedAt: string };
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
