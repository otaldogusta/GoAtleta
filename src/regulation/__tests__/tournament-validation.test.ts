import type { RegulationClause } from "../../api/regulation-rule-sets";
import { validateTournamentWithClauses } from "../tournament-validation";

const makeClause = (patch: Partial<RegulationClause>): RegulationClause => ({
  id: "c1",
  organizationId: "org1",
  ruleSetId: "rs1",
  clauseKey: "tournament.min_duration_minutes",
  clauseLabel: "Duracao minima",
  clauseType: "number",
  baseValue: 60,
  overrides: [],
  sourceReference: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...patch,
});

describe("tournament-validation", () => {
  test("returns error when duration is below minimum", () => {
    const issues = validateTournamentWithClauses({
      clauses: [makeClause({ baseValue: 120 })],
      input: {
        eventType: "torneio",
        eventSport: "volei_quadra",
        startsAt: new Date("2026-02-20T18:00:00.000Z"),
        endsAt: new Date("2026-02-20T18:45:00.000Z"),
        locationLabel: "Ginasio",
        linkedClassCount: 1,
        context: { eventType: "torneio", eventSport: "volei_quadra" },
      },
    });

    expect(issues.some((issue) => issue.code === "min_duration_not_met")).toBe(true);
  });

  test("returns warning for missing recommended linked classes", () => {
    const issues = validateTournamentWithClauses({
      clauses: [
        makeClause({
          clauseKey: "tournament.min_linked_classes",
          clauseLabel: "Minimo de turmas",
          baseValue: 2,
        }),
      ],
      input: {
        eventType: "torneio",
        eventSport: "volei_quadra",
        startsAt: new Date("2026-02-20T18:00:00.000Z"),
        endsAt: new Date("2026-02-20T20:00:00.000Z"),
        locationLabel: "Ginasio",
        linkedClassCount: 1,
        context: { eventType: "torneio", eventSport: "volei_quadra" },
      },
    });

    expect(
      issues.some(
        (issue) =>
          issue.code === "min_linked_classes_not_met" && issue.severity === "warning"
      )
    ).toBe(true);
  });

  test("ignores non-tournament events", () => {
    const issues = validateTournamentWithClauses({
      clauses: [makeClause({ baseValue: 120 })],
      input: {
        eventType: "treino",
        eventSport: "volei_quadra",
        startsAt: new Date("2026-02-20T18:00:00.000Z"),
        endsAt: new Date("2026-02-20T18:45:00.000Z"),
        locationLabel: "",
        linkedClassCount: 0,
        context: { eventType: "treino", eventSport: "volei_quadra" },
      },
    });

    expect(issues).toHaveLength(0);
  });
});
