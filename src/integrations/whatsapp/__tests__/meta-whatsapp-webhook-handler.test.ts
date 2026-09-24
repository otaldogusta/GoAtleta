import {
  createMetaWhatsAppWebhookHandler,
  createMetaWebhookTestSignature,
} from "../../../../supabase/functions/_shared/meta-whatsapp-webhook-handler";

describe("Meta WhatsApp webhook", () => {
  it("returns the challenge only for the configured verification token", async () => {
    const handler = createMetaWhatsAppWebhookHandler({ verifyToken: "verify-me", appSecret: "secret" });
    const response = await handler(new Request(
      "https://example.test?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=12345",
    ));
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("12345");
  });

  it("rejects an invalid verification token", async () => {
    const handler = createMetaWhatsAppWebhookHandler({ verifyToken: "verify-me", appSecret: "secret" });
    const response = await handler(new Request(
      "https://example.test?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=12345",
    ));
    expect(response.status).toBe(403);
  });

  it("accepts a signed WhatsApp Business payload", async () => {
    const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
    const signature = await createMetaWebhookTestSignature(body, "secret");
    const handler = createMetaWhatsAppWebhookHandler({ verifyToken: "verify-me", appSecret: "secret" });
    const response = await handler(new Request("https://example.test", {
      method: "POST",
      headers: { "x-hub-signature-256": signature },
      body,
    }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true });
  });

  it("rejects an unsigned payload", async () => {
    const handler = createMetaWhatsAppWebhookHandler({ verifyToken: "verify-me", appSecret: "secret" });
    const response = await handler(new Request("https://example.test", {
      method: "POST",
      body: JSON.stringify({ object: "whatsapp_business_account" }),
    }));
    expect(response.status).toBe(401);
  });
});
