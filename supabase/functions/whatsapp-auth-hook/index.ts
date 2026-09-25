import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import {
  readWhatsAppAuthConfig,
  resolveWhatsAppAuthDestination,
  sendWhatsAppAuthCode,
} from "../_shared/whatsapp-auth-provider.ts";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

Deno.serve(async (request) => {
  if (request.method !== "POST") return json(405, { error: { http_code: 405, message: "Método inválido." } });
  const rawSecret = Deno.env.get("SEND_SMS_HOOK_SECRET")?.trim() ?? "";
  if (!rawSecret.startsWith("v1,whsec_")) {
    return json(503, { error: { http_code: 503, message: "Canal de confirmação indisponível." } });
  }

  const body = await request.text();
  if (body.length > 64_000) return json(413, { error: { http_code: 413, message: "Solicitação inválida." } });

  let event: {
    user?: { phone?: unknown; phone_change?: unknown; new_phone?: unknown };
    sms?: { otp?: unknown; phone?: unknown };
  };

  try {
    const verifier = new Webhook(rawSecret.replace(/^v1,whsec_/, ""));
    event = verifier.verify(body, Object.fromEntries(request.headers)) as typeof event;
  } catch {
    console.warn("whatsapp-auth-hook signature rejected");
    return json(401, { error: { http_code: 401, message: "Assinatura inválida." } });
  }

  try {
    const phone = resolveWhatsAppAuthDestination(event.user, event.sms);
    const otp = typeof event.sms?.otp === "string" ? event.sms.otp : "";
    await sendWhatsAppAuthCode(phone, otp, readWhatsAppAuthConfig());
    return json(200, {});
  } catch (error) {
    console.error("whatsapp-auth-hook delivery failed", error instanceof Error ? error.message : "unknown");
    return json(503, { error: { http_code: 503, message: "Não foi possível enviar o código pelo WhatsApp." } });
  }
});
