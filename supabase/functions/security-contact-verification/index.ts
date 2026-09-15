import { createClient } from "https://esm.sh/@supabase/supabase-js@2.115.0";
import { buildCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { buildSecurityContactEmail } from "../_shared/security-contact-email.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight(req);
  const respond = (status: number, body: unknown) => new Response(JSON.stringify(body), {
    status, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
  if (req.method !== "POST") return respond(405, { error: "Método inválido." });
  const token = req.headers.get("Authorization")?.replace(/^Bearer /, "");
  if (!token) return respond(401, { error: "Entre novamente para continuar." });
  try {
    const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, secret, { auth: { persistSession: false } });
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user || user.is_anonymous) return respond(401, { error: "Entre novamente para continuar." });
    const raw = await req.text();
    if (raw.length > 2048) return respond(400, { error: "Dados inválidos." });
    const payload = JSON.parse(raw);
    const { action } = payload;
    if (!["status", "request", "verify", "remove"].includes(action)) return respond(400, { error: "Ação inválida." });
    if (action === "request" && !user.email_confirmed_at) return respond(403, { error: "Confirme primeiro seu e-mail de acesso." });
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    if (["request", "verify"].includes(action) && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email === user.email?.toLowerCase())) {
      return respond(400, { error: "Informe um e-mail válido diferente do e-mail de acesso." });
    }
    const rpc = async (operation: string, hash: string | null = null) => {
      const { data, error } = await admin.rpc("security_contact_verification_service", {
        p_user_id: user.id, p_action: operation, p_email: email || null, p_hash: hash,
      });
      if (error) throw new Error("database");
      return data;
    };
    if (action === "status" || action === "remove") return respond(200, await rpc(action));
    let code = payload.code;
    if (action === "request") {
      if (!Deno.env.get("RESEND_API_KEY")) return respond(503, { error: "Envio de confirmação indisponível. Tente mais tarde." });
      // Rejection sampling avoids modulo bias.
      const bytes = new Uint8Array(1);
      code = "";
      while (code.length < 8) { crypto.getRandomValues(bytes); if (bytes[0] < 250) code += bytes[0] % 10; }
    } else if (typeof code !== "string" || !/^\d{8}$/.test(code)) return respond(400, { error: "Informe os 8 dígitos do código." });
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`security-contact:${user.id}:${email}:${code}`));
    const hash = Array.from(new Uint8Array(signature), b => b.toString(16).padStart(2, "0")).join("");
    const result = await rpc(action, hash);
    if (result.error) return respond(400, result);
    if (action === "request") {
      let delivered = false;
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST", signal: AbortSignal.timeout(15000),
          headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: Deno.env.get("INVITE_EMAIL_FROM")?.trim() || "Go Atleta <nao-responda@auth.goatleta.com>",
            to: [email], ...buildSecurityContactEmail(code) }),
        });
        delivered = response.ok;
      } catch { /* Invalidate the challenge on ambiguous or failed delivery. */ }
      if (!delivered) {
        await rpc("delivery_failed", hash);
        return respond(503, { error: "Não foi possível enviar o código. Aguarde um minuto e tente novamente." });
      }
    }
    return respond(200, result);
  } catch {
    return respond(500, { error: "Não foi possível confirmar o e-mail. Tente novamente." });
  }
});
