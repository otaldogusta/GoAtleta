export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export const validateStringField = (
  value: unknown,
  options: {
    maxLength?: number;
    minLength?: number;
    pattern?: RegExp;
    trim?: boolean;
  } = {}
): ValidationResult<string> => {
  const { maxLength = 1000, minLength = 0, pattern, trim = true } = options;
  const raw = String(value ?? "");
  const next = trim ? raw.trim() : raw;

  if (next.length < minLength) {
    return { ok: false, error: `Too short (min ${minLength})` };
  }
  if (next.length > maxLength) {
    return { ok: false, error: `Too long (max ${maxLength})` };
  }
  if (pattern && !pattern.test(next)) {
    return { ok: false, error: "Invalid format" };
  }
  return { ok: true, data: next };
};

export const validateArrayLength = <T = unknown>(
  value: unknown,
  options: { maxLength?: number; minLength?: number } = {}
): ValidationResult<T[]> => {
  const { maxLength = 1000, minLength = 0 } = options;
  if (!Array.isArray(value)) {
    return { ok: false, error: "Expected array" };
  }
  if (value.length < minLength) {
    return { ok: false, error: `Too few items (min ${minLength})` };
  }
  if (value.length > maxLength) {
    return { ok: false, error: `Too many items (max ${maxLength})` };
  }
  return { ok: true, data: value as T[] };
};

export const validateNumberField = (
  value: unknown,
  options: { min?: number; max?: number; integer?: boolean } = {}
): ValidationResult<number> => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return { ok: false, error: "Invalid number" };
  }
  if (options.integer && !Number.isInteger(parsed)) {
    return { ok: false, error: "Expected integer" };
  }
  if (typeof options.min === "number" && parsed < options.min) {
    return { ok: false, error: `Too small (min ${options.min})` };
  }
  if (typeof options.max === "number" && parsed > options.max) {
    return { ok: false, error: `Too large (max ${options.max})` };
  }
  return { ok: true, data: parsed };
};

export const validateObjectPayload = (
  value: unknown,
  options: { maxBytes?: number } = {}
): ValidationResult<Record<string, unknown> | null> => {
  if (value === null || value === undefined) return { ok: true, data: null };
  if (typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "Expected object" };
  }
  const maxBytes = options.maxBytes ?? 8_192;
  const json = JSON.stringify(value);
  if (json.length > maxBytes) {
    return { ok: false, error: `Payload too large (max ${maxBytes} bytes)` };
  }
  return { ok: true, data: value as Record<string, unknown> };
};

