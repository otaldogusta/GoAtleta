export function safeNumber(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function safeInt(
  value: unknown,
  fallback = 0,
  options?: { min?: number; max?: number }
): number {
  let numeric = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(numeric)) numeric = fallback;
  if (typeof options?.min === "number") numeric = Math.max(options.min, numeric);
  if (typeof options?.max === "number") numeric = Math.min(options.max, numeric);
  return numeric;
}

