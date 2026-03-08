export const normalizeRg = (value: string): string =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();

export const formatRgBr = (value: string): string => {
  const raw = String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 9);

  if (raw.length <= 2) return raw;
  if (raw.length <= 5) return `${raw.slice(0, 2)}.${raw.slice(2)}`;
  if (raw.length <= 8) return `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5)}`;
  return `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}-${raw.slice(8)}`;
};

export const maskRg = (value: string): string => {
  const normalized = normalizeRg(value);
  if (!normalized) return "";
  if (normalized.length <= 4) return normalized;
  return `${"*".repeat(Math.max(0, normalized.length - 4))}${normalized.slice(-4)}`;
};
