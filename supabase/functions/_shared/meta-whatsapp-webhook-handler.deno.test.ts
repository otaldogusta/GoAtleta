import { assertEquals } from "jsr:@std/assert@1";
import {
  createMetaWhatsAppWebhookHandler,
  createMetaWebhookTestSignature,
} from "./meta-whatsapp-webhook-handler.ts";

Deno.test("confirms Meta webhook challenge with the configured token", async () => {
  const handler = createMetaWhatsAppWebhookHandler({ verifyToken: "verify-me", appSecret: "secret" });
  const response = await handler(new Request(
    "https://example.test?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=12345",
  ));
  assertEquals(response.status, 200);
  assertEquals(await response.text(), "12345");
});

Deno.test("rejects an invalid verification token", async () => {
  const handler = createMetaWhatsAppWebhookHandler({ verifyToken: "verify-me", appSecret: "secret" });
  const response = await handler(new Request(
    "https://example.test?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=12345",
  ));
  assertEquals(response.status, 403);
});

Deno.test("accepts only signed WhatsApp Business payloads", async () => {
  const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
  const signature = await createMetaWebhookTestSignature(body, "secret");
  const handler = createMetaWhatsAppWebhookHandler({ verifyToken: "verify-me", appSecret: "secret" });
  const response = await handler(new Request("https://example.test", {
    method: "POST",
    headers: { "x-hub-signature-256": signature },
    body,
  }));
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { received: true });
});

Deno.test("rejects unsigned payloads", async () => {
  const handler = createMetaWhatsAppWebhookHandler({ verifyToken: "verify-me", appSecret: "secret" });
  const response = await handler(new Request("https://example.test", {
    method: "POST",
    body: JSON.stringify({ object: "whatsapp_business_account" }),
  }));
  assertEquals(response.status, 401);
});
