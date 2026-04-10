import { toVisibleCoachingText } from "../core/methodology/coaching-lexicon";
import { normalizeDisplayText } from "../utils/text-normalization";

const toBasePdfText = (value: unknown) => {
  if (typeof value === "string") return normalizeDisplayText(value);
  if (value === null || value === undefined) return "";
  return normalizeDisplayText(String(value));
};

export const toPdfText = (value: unknown) => toBasePdfText(value);

export const toPdfCoachingText = (value: unknown) =>
  toVisibleCoachingText(toBasePdfText(value));
