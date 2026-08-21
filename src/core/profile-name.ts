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

const EMAIL_NAME_SUFFIXES: Record<string, string> = {
  thais: "Thaís",
  julia: "Júlia",
  luiza: "Luiza",
  helena: "Helena",
  clara: "Clara",
  maria: "Maria",
  eduarda: "Eduarda",
  vitoria: "Vitória",
  beatriz: "Beatriz",
  sofia: "Sofia",
  isabel: "Isabel",
};

const titleCaseProfileToken = (value: string) =>
  value
    ? value.charAt(0).toLocaleUpperCase("pt-BR") +
      value.slice(1).toLocaleLowerCase("pt-BR")
    : "";

export const suggestProfileNameFromEmail = (email: unknown) => {
  const localPart = normalizeProfileName(email).split("@")[0] ?? "";
  const withoutTrailingNumbers = localPart.replace(/\d+$/g, "");
  const explicitTokens = withoutTrailingNumbers
    .split(/[._\-+]+/g)
    .map((token) => token.replace(/[^\p{L}]/gu, ""))
    .filter(Boolean);

  if (explicitTokens.length > 1) {
    return explicitTokens.map(titleCaseProfileToken).join(" ");
  }

  const compact = explicitTokens[0] ?? "";
  const normalizedCompact = compact.toLocaleLowerCase("pt-BR");
  const suffix = Object.keys(EMAIL_NAME_SUFFIXES)
    .sort((left, right) => right.length - left.length)
    .find(
      (candidate) =>
        normalizedCompact.endsWith(candidate) &&
        normalizedCompact.length - candidate.length >= 3
    );

  if (suffix) {
    const firstName = compact.slice(0, compact.length - suffix.length);
    return `${titleCaseProfileToken(firstName)} ${EMAIL_NAME_SUFFIXES[suffix]}`;
  }

  return titleCaseProfileToken(compact);
};

export const resolveProfileNameFromMetadata = (
  metadata: Record<string, unknown> | null | undefined,
  email?: unknown
) => {
  const candidates = [metadata?.full_name, metadata?.name];
  const givenName = normalizeProfileName(metadata?.given_name);
  const familyName = normalizeProfileName(metadata?.family_name);
  if (givenName || familyName) candidates.push(`${givenName} ${familyName}`);

  for (const candidate of candidates) {
    const resolved = resolveProfileDisplayName({
      displayName: candidate,
      email,
      fallback: "",
    });
    if (resolved) return resolved;
  }
  return "";
};

export const requiresFirstAccessProfile = ({
  metadata,
  email,
}: {
  metadata: Record<string, unknown> | null | undefined;
  email?: unknown;
}) => !resolveProfileNameFromMetadata(metadata, email);

export const getFirstAccessProfileNameValidationError = (
  value: unknown,
  email: unknown
) => {
  const validationError = getProfileNameValidationError(value);
  if (validationError) return validationError;
  if (isEmailDerivedProfileName(value, email)) {
    return "Use seu nome, não o nome do e-mail.";
  }
  return null;
};
