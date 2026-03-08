const DIGITS_ONLY = /\D/g;

export const normalizeCpfDigits = (value: string): string =>
  String(value ?? "").replace(DIGITS_ONLY, "").slice(0, 11);

export const maskCpf = (value: string): string => {
  const digits = normalizeCpfDigits(value);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
};

export const maskCpfSafe = (value: string | null | undefined): string => {
  const digits = normalizeCpfDigits(String(value ?? ""));
  if (digits.length !== 11) return "";
  return `***.***.***-${digits.slice(9)}`;
};

export const validateCpf = (cpfDigitsRaw: string): boolean => {
  const cpf = normalizeCpfDigits(cpfDigitsRaw);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const calcCheckDigit = (base: string, factor: number) => {
    let total = 0;
    for (const digit of base) {
      total += Number(digit) * factor;
      factor -= 1;
    }
    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const d1 = calcCheckDigit(cpf.slice(0, 9), 10);
  const d2 = calcCheckDigit(cpf.slice(0, 10), 11);

  return Number(cpf[9]) === d1 && Number(cpf[10]) === d2;
};
