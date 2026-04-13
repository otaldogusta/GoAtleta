// ---------------------------------------------------------------------------
// Override learning: adapt methodology scoring based on teacher behavior
// ---------------------------------------------------------------------------

/**
 * Map of override frequency: { fromRuleId → { toRuleId → count } }
 * Used to detect when teachers frequently prefer alternative methodologies
 */
export type OverrideStatsByRule = Record<string, Record<string, number>>;

/**
 * A methodology rule with scoring information
 */
export type RankedRule = {
  ruleId: string;
  ruleKey: string;
  ruleLabel?: string;
  score: number;
  approach?: string;
};

export function getConservativeOverrideBonus(
  occurrenceCount: number,
  threshold: number = 2,
  pointsPerOccurrence: number = 5,
  maxBonus: number = 30
): number {
  if (!Number.isFinite(occurrenceCount) || occurrenceCount < threshold) {
    return 0;
  }

  return Math.min(occurrenceCount * pointsPerOccurrence, maxBonus);
}

/**
 * Adjust methodology scores based on teacher override patterns.
 *
 * Logic:
 * - If teachers frequently override A → B, boost B's score
 * - Apply conservative weighting to avoid overifitting to noise
 * - Cap bonus to prevent extreme distortions
 *
 * @param rules - Ranked rules (with baseline scores)
 * @param overrideStats - Override frequency map by class
 * @param threshold - Minimum override count to apply learning (default: 2)
 * @returns Adjusted ranked rules, re-sorted by score
 */
export function applyOverrideLearning(
  rules: RankedRule[],
  overrideStats: OverrideStatsByRule,
  threshold: number = 2
): RankedRule[] {
  if (!overrideStats || Object.keys(overrideStats).length === 0) {
    return rules;
  }

  return rules
    .map((rule) => {
      let bonus = 0;

      // Check if this rule is frequently selected as override target
      for (const fromRuleId in overrideStats) {
        const overridesFromRule = overrideStats[fromRuleId];
        const overrideCount = overridesFromRule[rule.ruleId] ?? 0;
        bonus += getConservativeOverrideBonus(overrideCount, threshold);
      }

      if (bonus === 0) {
        return rule;
      }

      return {
        ...rule,
        score: rule.score + bonus,
      };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Compute learning statistics for a specific override pattern.
 * Useful for understanding why a particular methodology was rejected.
 *
 * @param fromRuleId - The rule that was overridden
 * @param overrideStats - Override frequency map
 * @returns Count of times fromRuleId was overridden (overall)
 */
export function getOverrideFrequency(
  fromRuleId: string,
  overrideStats: OverrideStatsByRule
): number {
  const targets = overrideStats[fromRuleId] ?? {};
  return Object.values(targets).reduce((sum, count) => sum + count, 0);
}

/**
 * Find the most frequently selected alternative for a given rule.
 *
 * @param fromRuleId - The rule that was overridden
 * @param overrideStats - Override frequency map
 * @returns Object with toRuleId, count, or null if no overrides
 */
export function getMostFrequentAlternative(
  fromRuleId: string,
  overrideStats: OverrideStatsByRule
): { toRuleId: string; count: number } | null {
  const targets = overrideStats[fromRuleId] ?? {};
  if (Object.keys(targets).length === 0) {
    return null;
  }

  let bestToRuleId = "";
  let bestCount = 0;

  for (const toRuleId in targets) {
    const count = targets[toRuleId];
    if (count > bestCount) {
      bestCount = count;
      bestToRuleId = toRuleId;
    }
  }

  return bestCount > 0 ? { toRuleId: bestToRuleId, count: bestCount } : null;
}
