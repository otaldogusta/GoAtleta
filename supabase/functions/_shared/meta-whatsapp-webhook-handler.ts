type WebhookEnvironment = {
  verifyToken: string;
  appSecret: string;
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

const bytesToHex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");

const safeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
};

const signPayload = async (body: string, secret: string) => {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return `sha256=${bytesToHex(await crypto.subtle.sign("HMAC", key, encoder.encode(body)))}`;
};

export const createMetaWhatsAppWebhookHandler = (environment: WebhookEnvironment) =>
  async (request: Request): Promise<Response> => {
    if (request.method === "GET") {
      const url = new URL(request.url);
      const mode = url.searchParams.get("hub.mode") ?? "";
      const token = url.searchParams.get("hub.verify_token") ?? "";
      const challenge = url.searchParams.get("hub.challenge") ?? "";
      if (mode !== "subscribe" || !environment.verifyToken || !safeEqual(token, environment.verifyToken)) {
        return json(403, { error: "webhook_verification_failed" });
      }
      return new Response(challenge, {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    if (request.method !== "POST") {
      return json(405, { error: "method_not_allowed" });
    }
    if (!environment.appSecret) {
      return json(503, { error: "webhook_not_configured" });
    }

    const rawBody = await request.text();
    const providedSignature = request.headers.get("x-hub-signature-256") ?? "";
    const expectedSignature = await signPayload(rawBody, environment.appSecret);
    if (!providedSignature || !safeEqual(providedSignature, expectedSignature)) {
      return json(401, { error: "invalid_signature" });
    }

    try {
      const payload = JSON.parse(rawBody) as { object?: unknown };
      if (payload.object !== "whatsapp_business_account") {
        return json(400, { error: "unsupported_object" });
      }
    } catch {
      return json(400, { error: "invalid_json" });
    }

    // Do not log message bodies, phone numbers, names, or webhook payloads.
    return json(200, { received: true });
  };

export const createMetaWebhookTestSignature = signPayload;
