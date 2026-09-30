import {
  isClassPeriodizationConfigured,
  normalizePeriodizationPolicy,
  parsePeriodizationPolicy,
  resolvePeriodizationWeekPolicy,
  serializePeriodizationPolicy,
} from "../periodization-policy";

describe("periodization policy", () => {
  it("only marks the class ready after the pedagogical cycle is configured", () => {
    const configured = {
      goal: "Fundamentos",
      mvLevel: "MV1",
      cycleStartDate: "2026-01-05",
      cycleLengthWeeks: 52,
    } as const;

    expect(isClassPeriodizationConfigured(configured)).toBe(true);
    expect(isClassPeriodizationConfigured({ ...configured, goal: "" })).toBe(
      false,
    );
    expect(isClassPeriodizationConfigured({ ...configured, mvLevel: "" })).toBe(
      false,
    );
    expect(
      isClassPeriodizationConfigured({ ...configured, cycleLengthWeeks: 12 }),
    ).toBe(false);
  });

  it("normalizes and round-trips the manager parameters", () => {
    const serialized = serializePeriodizationPolicy({
      loadModel: "blocos",
      recoveryWeeks: 5,
      intensityMin: 2,
      intensityMax: 8,
    });

    expect(parsePeriodizationPolicy(serialized)).toEqual({
      schemaVersion: 1,
      loadModel: "blocos",
      recoveryWeeks: 5,
      intensityMin: 2,
      intensityMax: 8,
    });
  });

  it("preserves the teacher-confirmed class diagnostic", () => {
    const serialized = serializePeriodizationPolicy({
      loadModel: "ondulatorio",
      recoveryWeeks: 4,
      intensityMin: 3,
      intensityMax: 6,
      classDiagnostic: {
        gameLevel: "6x6",
        netHeightMeters: 2.2,
        teacherContext: "Já joga na quadra inteira e precisa avançar a transição.",
        updatedAt: "2026-09-28T18:00:00.000Z",
      },
    });

    expect(parsePeriodizationPolicy(serialized).classDiagnostic).toEqual({
      gameLevel: "6x6",
      netHeightMeters: 2.2,
      teacherContext: "Já joga na quadra inteira e precisa avançar a transição.",
      updatedAt: "2026-09-28T18:00:00.000Z",
    });
  });

  it("uses a configured recovery week instead of silently ignoring it", () => {
    const week = resolvePeriodizationWeekPolicy({
      policy: normalizePeriodizationPolicy({
        loadModel: "linear",
        recoveryWeeks: 4,
        intensityMin: 2,
        intensityMax: 8,
      }),
      weekNumber: 4,
      cycleLength: 12,
    });

    expect(week.recoveryWeek).toBe(true);
    expect(week.rpeTarget).toBe("2-3");
  });

  it("changes the curve according to the selected load model", () => {
    const common = {
      weekNumber: 3,
      cycleLength: 12,
    };
    const linear = resolvePeriodizationWeekPolicy({
      ...common,
      policy: {
        schemaVersion: 1,
        loadModel: "linear",
        recoveryWeeks: 5,
        intensityMin: 2,
        intensityMax: 8,
      },
    });
    const blocks = resolvePeriodizationWeekPolicy({
      ...common,
      policy: {
        schemaVersion: 1,
        loadModel: "blocos",
        recoveryWeeks: 5,
        intensityMin: 2,
        intensityMax: 8,
      },
    });

    expect(linear.intensity).not.toBe(blocks.intensity);
  });
});
