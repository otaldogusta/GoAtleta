import type { OperationalSnapshot } from "../copilot/operational-context";

export type ReplyDestination = { section: "reports" | "attendance"; label: string };

// Only verified local destinations. Never accept URLs or IDs from generated prose.
export function resolveReplyDestination(text: string, snapshot: OperationalSnapshot, canCoordinate: boolean): ReplyDestination | null {
  if (!canCoordinate) return null;
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const pending = (key: string) => snapshot.operationalFacts.some(fact => fact.key === key && typeof fact.value === "number" && fact.value > 0);
  if (/\b(registros?|relatorios?)\b/.test(normalized) && /\b(atrasad|pendent|regularizar)/.test(normalized) && pending("class_records_pending")) {
    return { section: "reports", label: "relatórios pendentes" };
  }
  if (/\bchamadas?\b/.test(normalized) && /\b(pendent|registrar)/.test(normalized) && pending("attendance_pending")) {
    return { section: "attendance", label: "chamadas pendentes" };
  }
  return null;
}
