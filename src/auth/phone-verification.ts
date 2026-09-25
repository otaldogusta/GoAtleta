type PhoneVerificationUser = {
  phone?: string | null;
  phone_confirmed_at?: string | null;
  app_metadata?: {
    providers?: string[] | null;
  };
};

export const PHONE_VERIFICATION_RESEND_DELAY_MS = 60_000;

export const getPhoneVerificationTarget = (
  countryCode: string,
  nationalPhone: string,
) => {
  const countryDigits = countryCode.replace(/\D/g, "");
  const nationalDigits = nationalPhone.replace(/\D/g, "");
  const digits = `${countryDigits}${nationalDigits}`;
  return digits.length >= 10 && digits.length <= 15 ? `+${digits}` : "";
};

export const getPhoneVerificationRetrySeconds = (
  retryUntil: number,
  now: number,
) => Math.max(0, Math.ceil((retryUntil - now) / 1000));

export const getConfirmedPhone = (
  user: PhoneVerificationUser | null | undefined,
) => {
  const phoneDigits = typeof user?.phone === "string" ? user.phone.replace(/\D/g, "") : "";
  const phone = phoneDigits ? `+${phoneDigits}` : "";
  const hasPhoneProvider = user?.app_metadata?.providers?.includes("phone") ?? false;
  return phone && (Boolean(user?.phone_confirmed_at) || hasPhoneProvider) ? phone : "";
};

export const hasConfirmedPhone = (
  user: PhoneVerificationUser | null | undefined,
  expectedPhone: string,
) => getConfirmedPhone(user) === expectedPhone;
