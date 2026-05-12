import { evidenceRules } from "./evidence-rules";
import { evidenceSources } from "./evidence-sources";
import type {
  EvidenceApplicationContext,
  EvidenceDomain,
  EvidenceRule,
  EvidenceRuleType,
  EvidenceSource,
} from "./types";

const ruleById = new Map(evidenceRules.map((rule) => [rule.id, rule]));
const sourceById = new Map(evidenceSources.map((source) => [source.id, source]));

export function listEvidenceRules(): EvidenceRule[] {
  return [...evidenceRules];
}

export function listEvidenceSources(): EvidenceSource[] {
  return [...evidenceSources];
}

export function getEvidenceRuleById(id: string): EvidenceRule | null {
  return ruleById.get(id) ?? null;
}

export function getEvidenceSourceById(id: string): EvidenceSource | null {
  return sourceById.get(id) ?? null;
}

export function getEvidenceRulesByDomain(domain: EvidenceDomain): EvidenceRule[] {
  return evidenceRules.filter((rule) => rule.domain.includes(domain));
}

export function getEvidenceRulesByType(type: EvidenceRuleType): EvidenceRule[] {
  return evidenceRules.filter((rule) => rule.type === type);
}

export function getEvidenceRulesByContext(context: EvidenceApplicationContext): EvidenceRule[] {
  const ruleIds = new Set<string>();
  if (context.hasUpcomingMatch && (context.daysUntilMatch ?? 999) <= 1) {
    ruleIds.add("pre_match_reduce_density");
  }
  if (context.planningMode === "pre_match") {
    ruleIds.add("pre_match_reduce_density");
  }
  if (context.planningMode === "post_match") {
    ruleIds.add("post_match_recovery_bias");
  }
  if (context.youth || /0?7-0?9|7.*9/.test(context.classAgeBand ?? "")) {
    ruleIds.add("youth_load_ceiling_not_low_lock");
  }
  if (typeof context.scoutingSampleSize === "number" && context.scoutingSampleSize < 6) {
    ruleIds.add("small_sample_no_strong_scouting_impact");
  }
  if (context.hasRecentScoutingImpact) {
    ruleIds.add("scouting_weakness_influences_focus_not_cycle");
  }
  if (context.manualOverride) {
    ruleIds.add("manual_override_preserves_teacher_decision");
  }
  if (context.loadIntent?.trim()) {
    ruleIds.add("load_monitoring_signal_not_oracle");
  }
  return Array.from(ruleIds)
    .map((id) => getEvidenceRuleById(id))
    .filter((rule): rule is EvidenceRule => Boolean(rule));
}
