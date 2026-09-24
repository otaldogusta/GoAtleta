type PhoneVerificationUser = {
  phone?: string | null;
  phone_confirmed_at?: string | null;
  app_metadata?: {
    providers?: string[] | null;
  };
};

export const getConfirmedPhone = (
  user: PhoneVerificationUser | null | undefined,
) => {
  const phone = typeof user?.phone === "string" ? user.phone : "";
  const hasPhoneProvider = user?.app_metadata?.providers?.includes("phone") ?? false;
  return phone && (Boolean(user?.phone_confirmed_at) || hasPhoneProvider) ? phone : "";
};

export const hasConfirmedPhone = (
  user: PhoneVerificationUser | null | undefined,
  expectedPhone: string,
) => getConfirmedPhone(user) === expectedPhone;
