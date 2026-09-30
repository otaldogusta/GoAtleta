import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";
import { assertSessionIdentity, getSessionIdentity, getValidAccessToken } from "../auth/session";
import { getActiveOrganizationId, supabaseGet, supabasePost } from "../db/client";
import type { EvolutionCandidate, EvolutionEvidence, PedagogicalProfile, ProfileKey, ProfileRecord } from "../core/class-pedagogical-profile";

export type ProfileMessage = { id: string; author_id: string; content: string; reply: string; question: string; status: "pending" | "interpreted"; created_at: string };
export type ProfileRevision = { id: string; version: number; author_id: string; origin: string; changed_keys: ProfileKey[]; before_profile: PedagogicalProfile; after_profile: PedagogicalProfile; created_at: string };
export type ProfileSuggestion = { id: string; base_version: number; candidate: EvolutionCandidate & { evidence: EvolutionEvidence[] } };
export type ProfileSnapshot = {
  profile: ProfileRecord | null; messages: ProfileMessage[]; revisions: ProfileRevision[]; suggestions: ProfileSuggestion[];
  status: "ready" | "saved" | "interpreted" | "pending" | "unchanged" | "insufficient_evidence" | "conflicting_evidence";
  revisionId: string | null;
};
export type ProfileCommand = {
  action: "load" | "send" | "selectors" | "undo" | "evolution" | "accept" | "reject";
  requestId?: string; content?: string; gameFormat?: string; netHeight?: number;
  expectedVersion?: number; revisionId?: string; suggestionId?: string;
};
const listeners = new Set<(record: ProfileRecord) => void>();
export async function readClassProfileSource(organizationId: string, classId: string, sourceId: string): Promise<ProfileMessage | null> {
  if (await getActiveOrganizationId() !== organizationId) throw new Error("Reabra a turma.");
  const rows = await supabaseGet<ProfileMessage[]>(`/class_profile_messages?select=*&organization_id=eq.${encodeURIComponent(organizationId)}&class_id=eq.${encodeURIComponent(classId)}&id=eq.${encodeURIComponent(sourceId)}&limit=1`);
  return rows[0] ?? null;
}
export class ProfileConflictError extends Error {}
export function subscribeClassProfile(listener: (record: ProfileRecord) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export async function requestClassProfile(organizationId: string, classId: string, command: ProfileCommand, signal?: AbortSignal): Promise<ProfileSnapshot> {
  const identity = getSessionIdentity();
  const token = await getValidAccessToken();
  assertSessionIdentity(identity);
  if (!token || !identity.userId) throw new Error("Entre novamente para acessar o perfil.");
  if (await getActiveOrganizationId() !== organizationId) throw new Error("A organização mudou. Reabra a turma.");
  assertSessionIdentity(identity);
  // Capability/auth probe prevents an older assistant deployment interpreting
  // diagnostic commands as ordinary chat (or claiming a save that never happened).
  let allowed: boolean;
  try { allowed = await supabasePost<boolean>("/rpc/can_read_class_profile", { p_org: organizationId, p_class: classId }); }
  catch { throw new Error("Perfil ainda indisponível neste ambiente. Seu texto foi mantido para tentar novamente."); }
  if (!allowed) throw new Error("Sem permissão para o perfil desta turma.");
  assertSessionIdentity(identity);
  const response = await fetch(`${SUPABASE_URL}/functions/v1/assistant`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ ...command, mode: "class_diagnostic", organizationId, classId, messages: [] }), signal,
  });
  const data = await response.json();
  assertSessionIdentity(identity);
  if (await getActiveOrganizationId() !== organizationId) throw new Error("A organização mudou. Reabra a turma.");
  assertSessionIdentity(identity);
  if (!response.ok) {
    const message = typeof data.error === "string" ? data.error : "Não foi possível salvar. Tente novamente.";
    if (response.status === 409) throw new ProfileConflictError(message);
    throw new Error(message);
  }
  // Older assistant deployments must never masquerade as successful persistence.
  if (!Array.isArray(data.messages) || !Array.isArray(data.revisions) || !Array.isArray(data.suggestions) || !data.status ||
      (data.profile && (data.profile.organization_id !== organizationId || data.profile.class_id !== classId))) {
    throw new Error("Perfil ainda indisponível neste ambiente. Seu texto foi mantido.");
  }
  if (data.profile) listeners.forEach(listener => listener(data.profile));
  return data;
}
