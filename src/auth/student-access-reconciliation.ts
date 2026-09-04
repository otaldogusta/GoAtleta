import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../api/config";
import { getPendingInvite, getPendingRelationshipInvite, getPendingTrainerInvite } from "./pending-invite";

export type StudentAccessResolution =
  | "linked" | "already_linked" | "not_found" | "verification_required"
  | "review_required" | "invite_required" | "unavailable";

const resolutions: readonly StudentAccessResolution[] = [
  "linked", "already_linked", "not_found", "verification_required",
  "review_required", "invite_required",
];

export async function reconcileMyStudentAccess(token: string): Promise<StudentAccessResolution> {
  // Invitation claims are the canonical path and carry their own permissions.
  const pending = await Promise.all([
    getPendingInvite(), getPendingRelationshipInvite(), getPendingTrainerInvite(),
  ]);
  if (pending.some((value) => value.trim())) return "invite_required";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/reconcile_my_student_access_v1`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: "{}",
      signal: controller.signal,
    });
    if (!response.ok) return "unavailable";
    const status: unknown = await response.json();
    return resolutions.includes(status as StudentAccessResolution)
      ? status as StudentAccessResolution : "unavailable";
  } catch {
    // A failed lookup must not masquerade as a genuinely new registration.
    return "unavailable";
  } finally {
    clearTimeout(timer);
  }
}

export function getStudentAccessPendingCopy(status: StudentAccessResolution | null) {
  switch (status) {
    case "verification_required":
      return { title: "Confirme seu e-mail", subtitle: "Confirme o e-mail da sua conta para continuar.", action: "Confirmar e-mail" };
    case "review_required":
      return { title: "Acesso aguardando liberação", subtitle: "Peça à coordenação para revisar seu vínculo de atleta.", action: "Verificar novamente" };
    case "invite_required":
      return { title: "Entre pelo seu convite", subtitle: "Abra o link da instituição. Se ele venceu, peça um novo.", action: "Verificar novamente" };
    case "unavailable":
      return { title: "Não foi possível verificar seu acesso", subtitle: "Tente novamente em instantes.", action: "Tentar novamente" };
    default:
      return null;
  }
}
