import { assertEquals } from "jsr:@std/assert@1";
import {
  createMetaWhatsAppWebhookHandler,
  createMetaWebhookTestSignature,
  type WhatsAppDeliveryStatus,
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

const deliveryRequest = async (payload: unknown, signingSecret = "secret") => {
  const body = JSON.stringify(payload);
  return new Request("https://example.test", {
    method: "POST",
    headers: { "x-hub-signature-256": await createMetaWebhookTestSignature(body, signingSecret) },
    body,
  });
};

const deliveryPayload = {
  object: "whatsapp_business_account",
  entry: [{ id: "private-account-id", changes: [{ field: "messages", value: {
    contacts: [{ profile: { name: "Private person" } }],
    messages: [{ text: { body: "Private message and OTP 123456" } }],
    statuses: [
      { id: "private-message-id", recipient_id: "15551234567", status: "failed", errors: [
        { code: 131026, title: "Private error", error_data: { details: "Private details" } },
        { code: 131026 }, { code: "private-value" }, { code: -1 }, { code: 1.5 },
      ] },
      { status: "delivered", recipient_id: "15551234567" },
      { status: "private-unrecognized-status" },
    ],
  } }] }],
};

Deno.test("reports only allowlisted delivery status and numeric error codes", async () => {
  const reports: WhatsAppDeliveryStatus[] = [];
  const handler = createMetaWhatsAppWebhookHandler(
    { verifyToken: "verify-me", appSecret: "secret" }, (status) => reports.push(status),
  );
  const response = await handler(await deliveryRequest(deliveryPayload));
  assertEquals(response.status, 200);
  assertEquals(reports, [
    { status: "failed", errorCodes: [131026] },
    { status: "delivered", errorCodes: [] },
  ]);
});

Deno.test("never reports delivery data from an invalid signature or object", async () => {
  const reports: WhatsAppDeliveryStatus[] = [];
  const handler = createMetaWhatsAppWebhookHandler(
    { verifyToken: "verify-me", appSecret: "secret" }, (status) => reports.push(status),
  );
  assertEquals((await handler(await deliveryRequest(deliveryPayload, "wrong-secret"))).status, 401);
  assertEquals((await handler(await deliveryRequest({ ...deliveryPayload, object: "page" }))).status, 400);
  assertEquals(reports, []);
});

Deno.test("acknowledges malformed optional data without logging messages or other events", async () => {
  const reports: WhatsAppDeliveryStatus[] = [];
  const handler = createMetaWhatsAppWebhookHandler(
    { verifyToken: "verify-me", appSecret: "secret" }, (status) => reports.push(status),
  );
  for (const entry of [null, {}, [null, { changes: [null, { field: "messages", value: { statuses: [null, "bad", {}] } }] }],
    [{ changes: [{ field: "calls", value: { statuses: [{ status: "sent" }] } }] }]]) {
    const response = await handler(await deliveryRequest({ object: "whatsapp_business_account", entry }));
    assertEquals(response.status, 200);
  }
  assertEquals(reports, []);
});

Deno.test("diagnostic sink failure does not retry an authenticated webhook", async () => {
  const handler = createMetaWhatsAppWebhookHandler(
    { verifyToken: "verify-me", appSecret: "secret" }, () => { throw new Error("sink unavailable"); },
  );
  assertEquals((await handler(await deliveryRequest(deliveryPayload))).status, 200);
});
