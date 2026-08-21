export const SECURITY_CONTACT_EMAIL_METADATA_KEY = "security_contact_email";

export const normalizeSecurityContactEmail = (value: string) =>
  value.trim().toLowerCase();

export const getSecurityContactEmailValidationError = (
  value: string,
  accountEmail?: string | null,
): string | null => {
  const normalized = normalizeSecurityContactEmail(value);
  if (!normalized) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return "Informe um e-mail válido.";
  }
  if (normalized === normalizeSecurityContactEmail(accountEmail ?? "")) {
    return "Use um e-mail diferente do e-mail de acesso.";
  }
  return null;
};

export type PasswordChangeValidation = {
  field: "newPassword" | "confirmation";
  message: string;
} | null;

export const getPasswordChangeValidationError = ({
  currentPassword,
  newPassword,
  confirmation,
}: {
  currentPassword: string;
  newPassword: string;
  confirmation: string;
}): PasswordChangeValidation => {
  if (!newPassword) {
    return { field: "newPassword", message: "Informe a nova senha." };
  }
  if (newPassword.length < 8) {
    return {
      field: "newPassword",
      message: "A nova senha precisa ter pelo menos 8 caracteres.",
    };
  }
  if (currentPassword && currentPassword === newPassword) {
    return {
      field: "newPassword",
      message: "A nova senha precisa ser diferente da atual.",
    };
  }
  if (newPassword !== confirmation) {
    return { field: "confirmation", message: "As senhas não conferem." };
  }
  return null;
};
