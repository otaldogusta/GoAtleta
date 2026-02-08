import { normalizeUnitKey } from "./unit-key";

const UNIT_CANONICAL: Record<string, string> = {
  "rede esperanca": "Rede Esperança",
  "rede esportes pinhais": "Rede Esportes Pinhais",
  "rede esportes pinhas": "Rede Esportes Pinhais",
};

export const canonicalizeUnitLabel = (value: string | null) => {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const key = normalizeUnitKey(trimmed);
  return UNIT_CANONICAL[key] ?? trimmed;
};
