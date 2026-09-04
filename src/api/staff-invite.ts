import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";
import type { StaffInviteProof } from "../auth/staff-invite-link";
import type { AuthSession } from "../auth/session";

export type StaffInviteResult = { session: AuthSession; organization_id: string; setup_required?: boolean };
export type StaffSignupFields = { full_name: string; password: string };

// Canonical login/verification remains usable for invitation-only WhatsApp links.
export async function resumeStaffSignup(code: string, session: AuthSession): Promise<StaffInviteResult> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/accept-staff-invite`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ action: "setup", code }),
  });
  const payload = await response.json();
  if (!response.ok || payload.user?.id !== session.user.id || !payload.organization_id) {
    throw new Error("Não foi possível retomar o convite. Confirme o e-mail da conta convidada.");
  }
  return { setup_required: true, session: { ...session, user: payload.user }, organization_id: payload.organization_id };
}

export async function redeemStaffInvite(proof: StaffInviteProof): Promise<StaffInviteResult> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/accept-staff-invite`, {
    method: "POST", headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(proof),
  });
  const payload = await response.json();
  if (!response.ok || !payload.session?.access_token || !payload.session?.refresh_token ||
      !payload.session?.user?.id || !payload.organization_id) {
    throw new Error(payload.code === "AUTH_LINK_EXPIRED" || payload.code === "INVITE_INVALID"
      ? "Link inválido, expirado ou já utilizado. Solicite um novo convite."
      : "Não foi possível concluir o convite. Entre com a conta convidada para tentar novamente.");
  }
  return payload;
}

export async function completeStaffSignup(code: string, setup: StaffInviteResult, fields: StaffSignupFields): Promise<StaffInviteResult> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/accept-staff-invite`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json", Authorization: `Bearer ${setup.session.access_token}` },
    body: JSON.stringify({ action: "complete", code, ...fields }),
  });
  const payload = await response.json();
  if (!response.ok || payload.user?.id !== setup.session.user.id || !payload.organization_id) {
    throw new Error(payload.code === "SETUP_PASSWORD_REJECTED"
      ? "Essa senha não foi aceita. Use uma senha mais forte."
      : "Não foi possível concluir o cadastro. Tente novamente ou reabra o convite.");
  }
  return { session: { ...setup.session, user: payload.user }, organization_id: payload.organization_id };
}
