import {
  getEvidenceRuleById,
  getEvidenceRuleConfidenceLabel,
  getEvidenceRuleTypeLabel,
  type EvidenceConfidence,
  type EvidenceTrace,
} from "../../../core/evidence";

export type WeekEvidenceRuleDisplayItem = {
  id: string;
  label: string;
  confidence: EvidenceConfidence;
  typeLabel: string;
  summary: string;
};

export type WeekEvidenceExplanation = {
  title: string;
  subtitle: string;
  signals: string[];
  focus: string[];
  loadAdjustment?: string;
  rules: WeekEvidenceRuleDisplayItem[];
  manualPreserved?: boolean;
};

type ScoutingImpactEvidenceSnapshot = {
  impactIds?: string[];
  recommendedFocus?: string[];
  weaknesses?: string[];
  tacticalNotes?: string[];
  loadImpact?: "reduce" | "maintain" | "increase" | "none";
  appliedSignals?: string[];
  evidenceTrace?: EvidenceTrace;
  manualPreserved?: boolean;
};

const uniqueStrings = (values: Array<string | null | undefined>) => {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const cleaned = String(value ?? "").trim();
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) continue;
    seen.add(key);
    output.push(cleaned);
  }
  return output;
};

const parseSnapshot = (snapshotJson?: string | null): Record<string, unknown> | null => {
  if (!snapshotJson?.trim()) return null;
  try {
    const parsed = JSON.parse(snapshotJson);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isEvidenceConfidence = (value: unknown): value is EvidenceConfidence =>
  value === "low" || value === "medium" || value === "high";

const parseEvidenceTrace = (value: unknown): EvidenceTrace | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const trace = value as Partial<EvidenceTrace>;
  if (!isStringArray(trace.evidenceRuleIds) || !trace.evidenceRuleIds.length) return null;
  return {
    evidenceRuleIds: trace.evidenceRuleIds,
    evidenceSummary: isStringArray(trace.evidenceSummary) ? trace.evidenceSummary : [],
    confidence: Array.isArray(trace.confidence)
      ? trace.confidence.filter(isEvidenceConfidence)
      : [],
  };
};

export function parseScoutingImpactEvidenceFromSnapshot(
  snapshotJson?: string | null,
): ScoutingImpactEvidenceSnapshot | null {
  const snapshot = parseSnapshot(snapshotJson);
  const scoutingImpact = snapshot?.scoutingImpact;
  if (!scoutingImpact || typeof scoutingImpact !== "object" || Array.isArray(scoutingImpact)) {
    return null;
  }

  const raw = scoutingImpact as Record<string, unknown>;
  const evidenceTrace = parseEvidenceTrace(raw.evidenceTrace);
  if (!evidenceTrace) return null;

  return {
    impactIds: isStringArray(raw.impactIds) ? raw.impactIds : [],
    recommendedFocus: isStringArray(raw.recommendedFocus) ? raw.recommendedFocus : [],
    weaknesses: isStringArray(raw.weaknesses) ? raw.weaknesses : [],
    tacticalNotes: isStringArray(raw.tacticalNotes) ? raw.tacticalNotes : [],
    appliedSignals: isStringArray(raw.appliedSignals) ? raw.appliedSignals : [],
    loadImpact:
      raw.loadImpact === "reduce" ||
      raw.loadImpact === "maintain" ||
      raw.loadImpact === "increase" ||
      raw.loadImpact === "none"
        ? raw.loadImpact
        : "none",
    evidenceTrace,
    manualPreserved: raw.manualPreserved === true,
  };
}

export function getEvidenceConfidenceTone(
  confidence: EvidenceConfidence,
): "muted" | "warning" | "success" {
  if (confidence === "high") return "success";
  if (confidence === "low") return "warning";
  return "muted";
}

const getLoadAdjustmentLabel = (loadImpact?: ScoutingImpactEvidenceSnapshot["loadImpact"]) => {
  if (loadImpact === "reduce") return "Evitar alta densidade e volume desnecessário.";
  if (loadImpact === "maintain") return "Carga planejada mantida; scouting usado como foco técnico.";
  if (loadImpact === "increase") return "Sinal de carga registrado; aumento não aplicado automaticamente.";
  return undefined;
};

export function getEvidenceRuleDisplayItems(
  evidenceTrace?: EvidenceTrace | null,
): WeekEvidenceRuleDisplayItem[] {
  if (!evidenceTrace) return [];
  return evidenceTrace.evidenceRuleIds
    .map((id) => {
      const rule = getEvidenceRuleById(id);
      if (!rule) return null;
      return {
        id: rule.id,
        label: rule.label,
        confidence: rule.confidence,
        typeLabel: getEvidenceRuleTypeLabel(rule.type),
        summary:
          evidenceTrace.evidenceSummary.find((item) => item.includes(rule.label)) ??
          rule.recommendation,
      };
    })
    .filter((item): item is WeekEvidenceRuleDisplayItem => Boolean(item));
}

export function formatWeekEvidenceExplanation(
  snapshotJson?: string | null,
): WeekEvidenceExplanation | null {
  const scoutingImpact = parseScoutingImpactEvidenceFromSnapshot(snapshotJson);
  if (!scoutingImpact) return null;

  const signals = uniqueStrings([
    ...(scoutingImpact.appliedSignals ?? []),
    ...(scoutingImpact.weaknesses ?? []),
  ]).slice(0, 3);
  const focus = uniqueStrings(scoutingImpact.recommendedFocus ?? []).slice(0, 3);
  const rules = getEvidenceRuleDisplayItems(scoutingImpact.evidenceTrace);
  if (!signals.length && !focus.length && !rules.length) return null;

  return {
    title: "Por que esta semana mudou?",
    subtitle: "Esta semana considerou sinais recentes de desempenho.",
    signals,
    focus,
    loadAdjustment: getLoadAdjustmentLabel(scoutingImpact.loadImpact),
    rules,
    manualPreserved: scoutingImpact.manualPreserved,
  };
}

export { getEvidenceRuleConfidenceLabel };
