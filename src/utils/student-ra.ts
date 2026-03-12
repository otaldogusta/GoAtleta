export const RA_DIGITS_LENGTH = 10;

export const normalizeRaDigits = (value: string | null | undefined) =>
  String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, RA_DIGITS_LENGTH);

export const deriveRaStartYear = (ra: string | null | undefined): number | null => {
  const digits = normalizeRaDigits(ra);
  if (digits.length < 4) return null;
  const year = Number(digits.slice(0, 4));
  return Number.isFinite(year) ? year : null;
};

export const validateStudentRa = (
  ra: string | null | undefined,
  options?: { minYear?: number; maxYear?: number }
): string | null => {
  const digits = normalizeRaDigits(ra);
  if (!digits) return null;
  if (digits.length !== RA_DIGITS_LENGTH) {
    return "RA deve conter 10 dígitos.";
  }
  const year = deriveRaStartYear(digits);
  if (!year) {
    return "RA inválido.";
  }
  const nowYear = new Date().getFullYear();
  const minYear = options?.minYear ?? 1990;
  const maxYear = options?.maxYear ?? nowYear + 1;
  if (year < minYear || year > maxYear) {
    return `Ano de ingresso do RA inválido (${year}).`;
  }
  return null;
};
