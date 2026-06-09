import {
  parseSessionPlanningContext,
  SESSION_PLANNING_CONTEXT_SCHEMA_VERSION,
  type SessionPlanningContext,
} from "../session-planning-context";

const currentContext = (): SessionPlanningContext => ({
  schemaVersion: SESSION_PLANNING_CONTEXT_SCHEMA_VERSION,
  classId: "class-1",
  sessionDate: "2026-06-13",
  ageBand: "07-09",
  sport: "volleyball",
  skillFocus: "passe",
  progressionDimension: "consistencia",
  pedagogicalIntent: "technical_adjustment",
  loadIntent: "moderado",
  recentDifficulties: [],
  recentActivityFamilies: [],
  upcomingEvents: [],
  availableDuration: 60,
  materials: ["bolas"],
  classProfile: { level: 1, daysPerWeek: 2, size: 10, heterogeneity: "baixa" },
  constraints: [],
});

describe("SessionPlanningContext contract", () => {
  it("accepts current schemaVersion contexts", () => {
    const parsed = parseSessionPlanningContext(currentContext());

    expect(parsed.status).toBe("current");
    expect(parsed.context?.schemaVersion).toBe(1);
    expect(parsed.warnings).toEqual([]);
  });

  it("accepts legacy contexts with a warning and upgrades the version", () => {
    const legacy = currentContext() as Omit<SessionPlanningContext, "schemaVersion"> &
      Partial<Pick<SessionPlanningContext, "schemaVersion">>;
    delete legacy.schemaVersion;

    const parsed = parseSessionPlanningContext(legacy);

    expect(parsed.status).toBe("legacy");
    expect(parsed.context?.schemaVersion).toBe(1);
    expect(parsed.warnings[0]).toContain("legado");
  });

  it("rejects invalid payloads without throwing", () => {
    const parsed = parseSessionPlanningContext({ classId: "class-1" });

    expect(parsed.status).toBe("invalid");
    expect(parsed.context).toBeNull();
  });
});
