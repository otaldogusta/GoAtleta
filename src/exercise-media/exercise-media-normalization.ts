const COMBINING_MARKS_REGEX = /[\u0300-\u036f]/g;
const NON_ALPHANUMERIC_REGEX = /[^a-z0-9]+/g;
const EDGE_HYPHENS_REGEX = /^-+|-+$/g;

export function normalizeExerciseMediaKey(value: string): string {
  if (!value || typeof value !== "string") {
    return "";
  }

  return value
    .normalize("NFD")
    .replace(COMBINING_MARKS_REGEX, "")
    .toLowerCase()
    .replace(NON_ALPHANUMERIC_REGEX, "-")
    .replace(EDGE_HYPHENS_REGEX, "");
}
