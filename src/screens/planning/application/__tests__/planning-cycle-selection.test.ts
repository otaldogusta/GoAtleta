import type { PlanningCycle } from "../../../../core/models";
import {
  isMonthWithinPlanningCycle,
  resolvePlanningCycleForMonth,
} from "../planning-cycle-selection";

const cycle = (overrides: Partial<PlanningCycle>): PlanningCycle => ({
  id: "cycle-2026",
  organizationId: "org-1",
  classId: "class-1",
  year: 2026,
  title: "Ciclo 2026",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("planning cycle selection", () => {
  it("selects the archived cycle that actually covers a historical month", () => {
    const archived = cycle({ status: "archived" });
    const active = cycle({
      id: "cycle-2027",
      year: 2027,
      startDate: "2027-01-01",
      endDate: "2027-12-31",
    });

    expect(
      resolvePlanningCycleForMonth([active, archived], active, "2026-08"),
    ).toBe(archived);
  });

  it("supports cycles whose date window crosses into another calendar year", () => {
    const crossing = cycle({
      startDate: "2026-02-01",
      endDate: "2027-01-31",
    });

    expect(isMonthWithinPlanningCycle(crossing, "2027-01")).toBe(true);
    expect(
      resolvePlanningCycleForMonth([crossing], crossing, "2027-01"),
    ).toBe(crossing);
  });

  it("does not fall back to an unrelated active cycle", () => {
    const active = cycle({
      id: "cycle-2027",
      year: 2027,
      startDate: "2027-01-01",
      endDate: "2027-12-31",
    });

    expect(resolvePlanningCycleForMonth([active], active, "2028-06")).toBeNull();
  });
});
