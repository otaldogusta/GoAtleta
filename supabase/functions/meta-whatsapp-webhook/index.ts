import { createMetaWhatsAppWebhookHandler } from "../_shared/meta-whatsapp-webhook-handler.ts";

Deno.serve(createMetaWhatsAppWebhookHandler({
  verifyToken: Deno.env.get("META_WHATSAPP_WEBHOOK_VERIFY_TOKEN")?.trim() ?? "",
  appSecret: Deno.env.get("META_WHATSAPP_APP_SECRET")?.trim() ?? "",
}));
