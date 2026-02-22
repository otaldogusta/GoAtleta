import type { RegulationClause } from "../../api/regulation-rule-sets";
import { resolveClauseMap, resolveClauseValue } from "../clause-engine";

const baseClause = (patch: Partial<RegulationClause>): RegulationClause => ({
  id: "c1",
  organizationId: "org1",
  ruleSetId: "rs1",
  clauseKey: "tournament.require_location",
  clauseLabel: "Exigir local",
  clauseType: "boolean",
  baseValue: true,
  overrides: [],
  sourceReference: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...patch,
});

describe("clause-engine", () => {
  test("uses override when context matches", () => {
    const clause = baseClause({
      overrides: [
        {
          match: { eventSport: "futebol" },
          value: false,
        },
      ],
    });

    expect(
      resolveClauseValue(clause, {
        eventSport: "futebol",
      })
    ).toBe(false);
  });

  test("falls back to base value when no override matches", () => {
    const clause = baseClause({
      overrides: [
        {
          match: { eventSport: "volei_praia" },
          value: false,
        },
      ],
    });

    expect(
      resolveClauseValue(clause, {
        eventSport: "volei_quadra",
      })
    ).toBe(true);
  });

  test("builds map with resolved values", () => {
    const map = resolveClauseMap(
      [
        baseClause({
          clauseKey: "tournament.min_duration_minutes",
          clauseType: "number",
          baseValue: 60,
          overrides: [{ match: { eventType: "torneio" }, value: 90 }],
        }),
      ],
      { eventType: "torneio" }
    );

    expect(map.get("tournament.min_duration_minutes")).toBe(90);
  });
});
