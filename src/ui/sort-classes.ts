import { parseAgeBandRange } from "../core/age-band";

export const sortClassesByAgeBand = <T extends { ageBand: string; name: string }>(
  items: T[]
) => {
  return [...items].sort((a, b) => {
    const aRange = parseAgeBandRange(a.ageBand || a.name);
    const bRange = parseAgeBandRange(b.ageBand || b.name);
    if (aRange.start !== bRange.start) return aRange.start - bRange.start;
    if (aRange.end !== bRange.end) return aRange.end - bRange.end;
    return aRange.label.localeCompare(bRange.label);
  });
};
