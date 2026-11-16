import { createClient } from "https://esm.sh/@supabase/supabase-js@2.115.0";

import { buildCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { validateStringField } from "../_shared/input-validation.ts";

type PendingUser = {
  id: string;
  email?: string;
  email_confirmed_at?: string;
  is_anonymous?: boolean;
  app_metadata?: Record<string, unknown>;
};

const isPendingEmailUser = (user: PendingUser) => {
  const metadata = user.app_metadata;
  return !user.is_anonymous && metadata?.provider === "email" &&
    Array.isArray(metadata.providers) && metadata.providers.length === 1 && metadata.providers[0] === "email" &&
    metadata.staff_invite_setup_required !== true && !metadata.email_verified_hybrid_at;
};

const isOwnedCandidate = (user: PendingUser | null, id: string, email: string, sourceId: string): user is PendingUser =>
  Boolean(user && user.id === id && user.id !== sourceId && user.email === email &&
    isPendingEmailUser(user) && user.app_metadata?.signup_email_correction_source === sourceId);

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight(req);
  const respond = (status: number, payload: Record<string, unknown>) => Response.json(payload, {
    status,
    headers: { ...buildCorsHeaders(req), "Cache-Control": "no-store" },
  });
  const unavailable = () => respond(503, { error: "Não foi possível corrigir o e-mail agora. Tente novamente." });
  const occupied = () => respond(409, { error: "Este e-mail já está em uso." });
  const denied = () => respond(403, { error: "A correção está disponível durante a confirmação do cadastro." });

  if (req.method !== "POST") return respond(405, { error: "Método inválido." });
  const token = req.headers.get("Authorization")?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!token) return respond(401, { error: "Entre novamente para corrigir o e-mail." });

  let destination: string;
  let code: string | undefined;
  try {
    const payload = await req.json();
    const email = validateStringField(typeof payload?.email === "string" ? payload.email : "", {
      minLength: 5, maxLength: 320, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    });
    if (!email.ok) return respond(400, { error: "Informe um e-mail válido." });
    destination = email.data.toLowerCase();
    if (payload.code !== undefined) {
      if (typeof payload.code !== "string" || !/^\d{6}$/.test(payload.code)) {
        return respond(400, { error: "Informe o código de seis dígitos." });
      }
      code = payload.code;
    }
  } catch {
    return respond(400, { error: "Dados inválidos." });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return unavailable();

  try {
    const authClient = createClient(url, anonKey, clientOptions);
    const admin = createClient(url, serviceKey, clientOptions);
    const { data: { user: source }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !source) return respond(401, { error: "Entre novamente para corrigir o e-mail." });
    if (!source.email || !isPendingEmailUser(source)) return denied();
    if (source.email === destination) return respond(400, { error: "Informe um e-mail diferente." });

    const { data: prepared, error: prepareError } = await admin.rpc("prepare_pending_signup_email_correction", {
      p_user_id: source.id, p_current_email: source.email, p_new_email: destination,
      p_request_code: code === undefined,
    });
    if (prepareError || !prepared) return unavailable();
    if (prepared.status === "conflict") return occupied();
    if (prepared.status === "limited") {
      return respond(429, { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." });
    }
    if (prepared.status !== "ready") return denied();

    let candidate: PendingUser | null;
    let candidateId: string;
    if (typeof prepared.candidate_id === "string") {
      candidateId = prepared.candidate_id;
      const { data } = await admin.auth.admin.getUserById(candidateId);
      candidate = data.user;
    } else {
      if (typeof prepared.origin_id !== "string") return unavailable();
      const { data, error } = await admin.auth.admin.createUser({
        email: destination,
        email_confirm: false,
        app_metadata: {
          signup_email_correction_source: source.id,
          signup_email_correction_origin: prepared.origin_id,
        },
        user_metadata: {
          requires_email_hybrid_verification: true,
          ...(prepared.full_name ? { full_name: prepared.full_name } : {}),
        },
      });
      if (error?.code === "email_exists" || error?.code === "user_already_exists") return occupied();
      if (error || !data.user) return unavailable();
      candidate = data.user;
      candidateId = candidate.id;
      if (!isOwnedCandidate(candidate, candidateId, destination, source.id) || candidate.email_confirmed_at) {
        return unavailable();
      }
      const { data: cleared, error: clearError } = await admin.rpc("clear_signup_email_candidate_password", {
        p_candidate_id: candidateId, p_source_id: source.id, p_email: destination,
      });
      if (clearError || !cleared) return unavailable();
    }
    if (!isOwnedCandidate(candidate, candidateId, destination, source.id)) return occupied();

    if (code === undefined) {
      // The first send must not use /otp: GoTrue's hybrid autoconfirm can
      // internally confirm an existing unconfirmed address through that route.
      const { error } = candidate.email_confirmed_at
        ? await authClient.auth.signInWithOtp({ email: destination, options: { shouldCreateUser: false } })
        : await authClient.auth.resend({ type: "signup", email: destination });
      return respond(200, { deliveryFailed: Boolean(error) });
    }

    const { data: verified, error: verificationError } = await authClient.auth.verifyOtp({
      email: destination, token: code, type: "email",
    });
    if (verificationError || !verified.session) {
      return respond(400, { error: "Código inválido ou expirado." });
    }
    if (!isOwnedCandidate(verified.user, candidateId, destination, source.id)) return denied();
    const { data: finished, error: finishError } = await admin.rpc("finish_pending_signup_email_correction", {
      p_source_id: source.id, p_source_email: source.email,
      p_target_id: candidateId, p_target_email: destination,
    });
    if (finishError || !finished) return unavailable();

    return respond(200, { session: verified.session });
  } catch {
    return unavailable();
  }
});
