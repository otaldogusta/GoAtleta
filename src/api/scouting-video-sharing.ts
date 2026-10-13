import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
import { assertSessionIdentity, getSessionIdentity, getValidAccessToken } from '../auth/session';
import { supabasePost } from '../db/client';
import { parseVideoDocument, type VideoDocument } from '../core/scouting-video';
import { publishableVideoDocument, type VideoShareAudience } from '../core/scouting-video-sharing';

export type VideoShare = { id: string; audience: VideoShareAudience; expiresAt: string; revoked: boolean; updatedAt: string };
export type VideoShareAsset = { assetId: string; objectPath: string; uploaded: boolean; share: VideoShare | null };
export type VideoShareScope = { org: string; sessionId: string };
export type SharedVideo = { document: VideoDocument; teamName: string; title: string; opponent: string; updatedAt: string; expiresAt: string; permission: 'viewer'; mediaUrl: string; mediaExpiresAt: number };
export const videoShareError = (failure: unknown) => {
  const message = failure instanceof Error ? failure.message : '';
  if (/PGRST202|42P01|42883/.test(message)) return 'O compartilhamento por link ainda precisa ser ativado no servidor.';
  if (/42501/.test(message)) return 'Sua conta não pode gerenciar o acesso a esta análise.';
  return 'Não foi possível compartilhar. Confira sua conexão e tente novamente.';
};
export function prepareVideoShare(scope: VideoShareScope, doc: VideoDocument, file: File) {
  return supabasePost<VideoShareAsset>('/rpc/prepare_scouting_video_share', { p_org: scope.org, p_session: scope.sessionId, p_fingerprint: doc.media.fingerprint, p_size: file.size, p_type: videoContentType(file) });
}
export function videoContentType(file: File) {
  if (/\.mov$/i.test(file.name)) return 'video/quicktime';
  if (/\.webm$/i.test(file.name)) return 'video/webm';
  return 'video/mp4';
}
export function getVideoShare(scope: VideoShareScope, fingerprint: string) {
  return supabasePost<VideoShare | null>('/rpc/get_scouting_video_share', { p_org: scope.org, p_session: scope.sessionId, p_fingerprint: fingerprint });
}
export function publishVideoShare(scope: VideoShareScope, asset: VideoShareAsset, doc: VideoDocument, team: string, audience: VideoShareAudience, code: string, days: number) {
  return supabasePost<VideoShare>('/rpc/publish_scouting_video_share', { p_org: scope.org, p_session: scope.sessionId, p_asset: asset.assetId, p_document: publishableVideoDocument(doc), p_team: team, p_audience: audience, p_proof: code, p_days: days });
}
export function revokeVideoShare(scope: VideoShareScope, id: string) {
  return supabasePost<void>('/rpc/revoke_scouting_video_share', { p_org: scope.org, p_session: scope.sessionId, p_share: id });
}
export class SharedVideoError extends Error { constructor(public code: string) { super(code); } }
export async function readSharedVideo(id: string, code: string, signal: AbortSignal): Promise<SharedVideo> {
  // Hydration may establish an initially empty session; an existing identity
  // must never be replaced while a refresh is in flight.
  const initialIdentity = getSessionIdentity();
  const token = await getValidAccessToken(), identity = initialIdentity.userId ? initialIdentity : getSessionIdentity();
  assertSessionIdentity(identity);
  const res = await fetch(`${SUPABASE_URL}/functions/v1/scouting-video-share`, { method: 'POST', signal,
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ id, code }) });
  assertSessionIdentity(identity);
  const value = await res.json();
  assertSessionIdentity(identity);
  if (!res.ok || value.permission !== 'viewer') throw new SharedVideoError(value.error || 'LINK_UNAVAILABLE');
  const media = new URL(value.mediaUrl), base = new URL(SUPABASE_URL);
  if (media.origin !== base.origin || !media.pathname.startsWith('/storage/v1/object/sign/scouting-videos/')) throw new SharedVideoError('MEDIA_UNAVAILABLE');
  return { ...value, document: parseVideoDocument(value.document) };
}
