import {
  buildNextCycleDraft,
  resolveNextCycleStartDate,
} from "../next-cycle-draft";

const archivedCycle = (overrides: Partial<{
  endDate: string;
  status: "active" | "archived";
  year: number;
}> = {}) => ({
  endDate: "2026-12-31",
  status: "archived" as const,
  year: 2026,
  ...overrides,
});

describe("next cycle draft", () => {
  it("suggests the day after the latest archived cycle", () => {
    expect(
      resolveNextCycleStartDate(
        [archivedCycle(), archivedCycle({ endDate: "2025-12-31", year: 2025 })],
        "2026-07-22",
      ),
    ).toBe("2027-01-01");
  });

  it("never suggests a date that would reuse an archived cycle year", () => {
    expect(
      resolveNextCycleStartDate(
        [archivedCycle({ endDate: "2026-06-30" })],
        "2026-07-22",
      ),
    ).toBe("2027-01-01");
  });

  it("falls back to the next year when the archived end date is invalid", () => {
    expect(
      resolveNextCycleStartDate(
        [archivedCycle({ endDate: "" })],
        "2026-07-22",
      ),
    ).toBe("2027-01-01");
  });

  it("preserves inherited parameters while replacing the temporal identity", () => {
    expect(
      buildNextCycleDraft(
        { cycleStartDate: "2026-07-22", goal: "Trabalhar o sistema (4x2)" },
        [archivedCycle()],
      ),
    ).toEqual({
      cycleStartDate: "2027-01-01",
      goal: "Trabalhar o sistema (4x2)",
    });
  });

  it("keeps the current start date when there is no archived cycle", () => {
    expect(resolveNextCycleStartDate([], "2026-07-22")).toBe("2026-07-22");
  });
});
