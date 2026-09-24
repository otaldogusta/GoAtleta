type PhoneVerificationUser = {
  phone?: string | null;
};

export const hasConfirmedPhone = (
  user: PhoneVerificationUser | null | undefined,
  expectedPhone: string,
) => user?.phone === expectedPhone;
