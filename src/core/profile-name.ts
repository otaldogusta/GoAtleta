export const PROFILE_NAME_FALLBACK = "Nome não informado";

export const normalizeProfileName = (value: unknown) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

export const getProfileNameValidationError = (value: unknown) => {
  const name = normalizeProfileName(value);
  if (!name) return "Informe seu nome.";
  if (name.includes("@")) return "Informe seu nome, não o e-mail.";
  if (name.length > 80) return "Use no máximo 80 caracteres.";
  const letterCount = Array.from(name).filter((character) => /\p{L}/u.test(character)).length;
  if (letterCount < 2) return "Informe um nome válido.";
  return null;
};

export const isEmailDerivedProfileName = (
  displayName: unknown,
  email: unknown
) => {
  const name = normalizeProfileName(displayName).toLocaleLowerCase("pt-BR");
  const normalizedEmail = normalizeProfileName(email).toLocaleLowerCase("pt-BR");
  if (!name || !normalizedEmail) return false;
  const localPart = normalizedEmail.split("@")[0] ?? "";
  return name === normalizedEmail || name === localPart;
};

export const resolveProfileDisplayName = ({
  displayName,
  email,
  fallback = PROFILE_NAME_FALLBACK,
}: {
  displayName: unknown;
  email?: unknown;
  fallback?: string;
}) => {
  const name = normalizeProfileName(displayName);
  if (!name || isEmailDerivedProfileName(name, email)) return fallback;
  return name;
};
