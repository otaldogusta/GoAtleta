import type { ClassGroup } from "../core/models";

type AgeRange = { start: number; end: number; label: string };

const parseAgeRange = (value?: string): AgeRange => {
  const fallback = value ?? "";
  const match = fallback.match(/(\d+)\s*-\s*(\d+)/);
  if (match) {
    const start = Number(match[1]);
    const end = Number(match[2]);
    return {
      start: Number.isFinite(start) ? start : Number.POSITIVE_INFINITY,
      end: Number.isFinite(end) ? end : Number.POSITIVE_INFINITY,
      label: fallback,
    };
  }
  const single = fallback.match(/(\d+)/);
  if (single) {
    const valueNum = Number(single[1]);
    return {
      start: Number.isFinite(valueNum) ? valueNum : Number.POSITIVE_INFINITY,
      end: Number.isFinite(valueNum) ? valueNum : Number.POSITIVE_INFINITY,
      label: fallback,
    };
  }
  return {
    start: Number.POSITIVE_INFINITY,
    end: Number.POSITIVE_INFINITY,
    label: fallback,
  };
};

export const sortClassesByAgeBand = (items: ClassGroup[]) => {
  return [...items].sort((a, b) => {
    const aRange = parseAgeRange(a.ageBand || a.name);
    const bRange = parseAgeRange(b.ageBand || b.name);
    if (aRange.start !== bRange.start) return aRange.start - bRange.start;
    if (aRange.end !== bRange.end) return aRange.end - bRange.end;
    return aRange.label.localeCompare(bRange.label);
  });
};
