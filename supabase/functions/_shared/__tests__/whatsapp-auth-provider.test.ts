import {
  buildWhatsAppAuthMessage,
  readWhatsAppAuthConfig,
  resolveWhatsAppAuthDestination,
  sendWhatsAppAuthCode,
  type WhatsAppAuthConfig,
} from "../whatsapp-auth-provider";

const config: WhatsAppAuthConfig = {
  accessToken: "test-token",
  phoneNumberId: "123456789",
  graphApiVersion: "v25.0",
  templateName: "goatleta_phone_verification",
  templateLanguage: "pt_BR",
};

describe("WhatsApp authentication provider", () => {
  it("uses the pending phone during a phone-change verification", () => {
    expect(resolveWhatsAppAuthDestination({
      phone: "",
      phone_change: "+5541933008130",
    })).toBe("+5541933008130");
    expect(resolveWhatsAppAuthDestination({
      phone: "+5541999999999",
      phone_change: "",
    })).toBe("+5541999999999");
  });

  it("builds the Meta authentication template with the same OTP in body and copy button", () => {
    expect(buildWhatsAppAuthMessage("+55 (41) 99999-9999", "482931", config)).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "5541999999999",
      type: "template",
      template: {
        name: "goatleta_phone_verification",
        language: { code: "pt_BR" },
        components: [
          { type: "body", parameters: [{ type: "text", text: "482931" }] },
          { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: "482931" }] },
        ],
      },
    });
  });

  it("rejects malformed destinations and codes before contacting Meta", () => {
    expect(() => buildWhatsAppAuthMessage("419999", "482931", config)).toThrow("Telefone");
    expect(() => buildWhatsAppAuthMessage("+5541999999999", "1234", config)).toThrow("OTP");
  });

  it("requires every secret and identifier from server-only environment variables", () => {
    expect(() => readWhatsAppAuthConfig(() => undefined)).toThrow("META_WHATSAPP_ACCESS_TOKEN");
    expect(readWhatsAppAuthConfig((key) => ({
      META_WHATSAPP_ACCESS_TOKEN: "token",
      META_WHATSAPP_PHONE_NUMBER_ID: "123",
      META_WHATSAPP_GRAPH_API_VERSION: "v25.0",
      META_WHATSAPP_AUTH_TEMPLATE_NAME: "goatleta_phone_verification",
      META_WHATSAPP_AUTH_TEMPLATE_LANGUAGE: "pt_BR",
    }[key]))).toEqual({ ...config, accessToken: "token", phoneNumberId: "123" });
  });

  it("returns only the provider message id and never exposes the token", async () => {
    const fetcher = jest.fn().mockResolvedValue(new Response(JSON.stringify({ messages: [{ id: "wamid.test" }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    await expect(sendWhatsAppAuthCode("+5541999999999", "482931", config, fetcher)).resolves.toEqual({ messageId: "wamid.test" });
    expect(fetcher).toHaveBeenCalledWith(
      "https://graph.facebook.com/v25.0/123456789/messages",
      expect.objectContaining({ method: "POST", headers: expect.objectContaining({ Authorization: "Bearer test-token" }) }),
    );
  });

  it("maps Meta failures to a non-sensitive error", async () => {
    const fetcher = jest.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: 131047, message: "private provider detail" },
    }), { status: 400, headers: { "Content-Type": "application/json" } }));
    await expect(sendWhatsAppAuthCode("+5541999999999", "482931", config, fetcher)).rejects.toThrow("(131047)");
    await expect(sendWhatsAppAuthCode("+5541999999999", "482931", config, fetcher)).rejects.not.toThrow("private provider detail");
  });
});
