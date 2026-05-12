import {
  getEvidenceRuleById,
  getEvidenceRulesByContext,
} from "./evidence-matrix";
import type {
  EvidenceApplicationContext,
  EvidenceConfidence,
  EvidenceRule,
  EvidenceRuleType,
} from "./types";

export function resolveEvidenceRulesForContext(
  context: EvidenceApplicationContext,
): EvidenceRule[] {
  return getEvidenceRulesByContext(context);
}

export function assertEvidenceRuleIds(ruleIds: string[]): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const ruleId of ruleIds) {
    if (getEvidenceRuleById(ruleId)) {
      valid.push(ruleId);
    } else {
      invalid.push(ruleId);
    }
  }
  return { valid, invalid };
}

export function formatEvidenceRuleSummary(rule: EvidenceRule): string {
  return `${rule.label} (${getEvidenceRuleTypeLabel(rule.type)}, confiança ${getEvidenceRuleConfidenceLabel(
    rule.confidence,
  )}): ${rule.recommendation}`;
}

export function getEvidenceRuleConfidenceLabel(confidence: EvidenceConfidence): string {
  const labels: Record<EvidenceConfidence, string> = {
    low: "baixa",
    medium: "media",
    high: "alta",
  };
  return labels[confidence];
}

export function getEvidenceRuleTypeLabel(type: EvidenceRuleType): string {
  const labels: Record<EvidenceRuleType, string> = {
    scientific_principle: "principio cientifico",
    evidence_informed: "evidence-informed",
    operational_heuristic: "heuristica operacional",
    safety_guard: "limite de seguranca",
    product_decision: "decisao de produto",
  };
  return labels[type];
}
