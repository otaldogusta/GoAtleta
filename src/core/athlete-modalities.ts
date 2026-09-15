import type { ClassModality } from "./class-modality";

export const mergeAthleteModalities = (automatic: ClassModality[], personal: ClassModality[]) =>
  [...new Set([...automatic, ...personal])];

// Preserve a personal declaration even when the same sport later comes from a plan.
export const updatePersonalModalities = (automatic: ClassModality[], personal: ClassModality[], selected: ClassModality[]) =>
  [...new Set([...personal.filter((sport) => automatic.includes(sport) || selected.includes(sport)),
    ...selected.filter((sport) => !automatic.includes(sport))])];
