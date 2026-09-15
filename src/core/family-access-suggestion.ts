/** A name match is a review aid, never identity evidence or an access grant. */
export function suggestFamilyAthlete<T extends { id: string; name: string }>(name: string | null | undefined, candidates: readonly T[]): T | null {
  const normalize = (value: string) => value.trim().replace(/\s+/g, " ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const requested = normalize(name ?? "");
  if (!requested) return null;
  const matches = candidates.filter(candidate => normalize(candidate.name) === requested);
  return matches.length === 1 ? matches[0] : null;
}
