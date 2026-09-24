export type WhatsAppAuthConfig = {
  accessToken: string;
  phoneNumberId: string;
  graphApiVersion: string;
  templateName: string;
  templateLanguage: string;
};

export type WhatsAppAuthDelivery = {
  messageId: string;
};

const ENV_KEYS = {
  accessToken: "META_WHATSAPP_ACCESS_TOKEN",
  phoneNumberId: "META_WHATSAPP_PHONE_NUMBER_ID",
  graphApiVersion: "META_WHATSAPP_GRAPH_API_VERSION",
  templateName: "META_WHATSAPP_AUTH_TEMPLATE_NAME",
  templateLanguage: "META_WHATSAPP_AUTH_TEMPLATE_LANGUAGE",
} as const;

export const readWhatsAppAuthConfig = (
  readEnv: (key: string) => string | undefined = (key) => Deno.env.get(key),
): WhatsAppAuthConfig => {
  const config = Object.fromEntries(
    Object.entries(ENV_KEYS).map(([field, key]) => [field, readEnv(key)?.trim() ?? ""]),
  ) as WhatsAppAuthConfig;
  const missing = Object.entries(config).filter(([, value]) => !value).map(([field]) => ENV_KEYS[field as keyof typeof ENV_KEYS]);
  if (missing.length) throw new Error(`Configuração ausente: ${missing.join(", ")}`);
  if (!/^v\d+\.\d+$/.test(config.graphApiVersion)) throw new Error("Versão da Graph API inválida.");
  if (!/^\d+$/.test(config.phoneNumberId)) throw new Error("Phone Number ID inválido.");
  if (!/^[a-z0-9_]+$/.test(config.templateName)) throw new Error("Nome do template inválido.");
  if (!/^[a-z]{2}(?:_[A-Z]{2})?$/.test(config.templateLanguage)) throw new Error("Idioma do template inválido.");
  return config;
};

export const buildWhatsAppAuthMessage = (phone: string, otp: string, config: WhatsAppAuthConfig) => {
  const recipient = phone.replace(/\D/g, "");
  if (recipient.length < 10 || recipient.length > 15) throw new Error("Telefone de destino inválido.");
  if (!/^\d{6}$/.test(otp)) throw new Error("OTP inválido.");
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipient,
    type: "template",
    template: {
      name: config.templateName,
      language: { code: config.templateLanguage },
      components: [
        { type: "body", parameters: [{ type: "text", text: otp }] },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [{ type: "text", text: otp }],
        },
      ],
    },
  };
};

export const sendWhatsAppAuthCode = async (
  phone: string,
  otp: string,
  config: WhatsAppAuthConfig,
  fetcher: typeof fetch = fetch,
): Promise<WhatsAppAuthDelivery> => {
  const response = await fetcher(
    `https://graph.facebook.com/${config.graphApiVersion}/${config.phoneNumberId}/messages`,
    {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildWhatsAppAuthMessage(phone, otp, config)),
    },
  );
  const payload = await response.json().catch(() => null) as {
    messages?: Array<{ id?: string }>;
    error?: { code?: number; message?: string };
  } | null;
  const messageId = payload?.messages?.[0]?.id;
  if (!response.ok || !messageId) {
    const providerCode = payload?.error?.code ? ` (${payload.error.code})` : "";
    throw new Error(`A Meta recusou o envio${providerCode}.`);
  }
  return { messageId };
};
