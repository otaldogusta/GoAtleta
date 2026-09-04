import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";
import type { StaffInviteProof } from "../auth/staff-invite-link";
import type { AuthSession } from "../auth/session";

export type StaffInviteResult = { session: AuthSession; organization_id: string; setup_required?: boolean };
export type StaffSignupFields = { password: string };

const STAFF_SIGNUP_REFRESH_MARGIN_SECONDS = 30;

export async function refreshStaffSignupSession(setup: StaffInviteResult): Promise<StaffInviteResult> {
  const now = Math.floor(Date.now() / 1000);
  if (setup.session.expires_at > now + STAFF_SIGNUP_REFRESH_MARGIN_SECONDS) return setup;

  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: setup.session.refresh_token }),
  });
  const payload = await response.json().catch(() => null);
  const refreshedUser = payload?.user;
  if (!response.ok || !payload?.access_token || !payload?.refresh_token || !refreshedUser?.id ||
      refreshedUser.id !== setup.session.user.id) {
    throw new Error("Sua sessão expirou. Reabra o convite.");
  }
  const expiresAt = typeof payload.expires_at === "number"
    ? payload.expires_at
    : now + (typeof payload.expires_in === "number" ? payload.expires_in : 3600);
  return {
    ...setup,
    session: {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      expires_at: expiresAt,
      user: refreshedUser,
    },
  };
}

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
    if (payload.code === "SETUP_PASSWORD_REJECTED" || payload.code === "SETUP_FIELDS_INVALID") {
      throw new Error("Essa senha não foi aceita. Use uma senha mais forte.");
    }
    if (payload.code === "SETUP_NOT_ALLOWED") throw new Error("Sua sessão expirou. Reabra o convite.");
    if (payload.code === "INVITE_INVALID") throw new Error("Convite inválido, expirado ou já utilizado.");
    if (payload.code === "INVITE_NOT_APPLIED") {
      throw new Error("A senha foi salva, mas o acesso não foi aplicado. Tente novamente.");
    }
    throw new Error("Não foi possível concluir o cadastro. Tente novamente.");
  }
  return { session: { ...setup.session, user: payload.user }, organization_id: payload.organization_id };
}
