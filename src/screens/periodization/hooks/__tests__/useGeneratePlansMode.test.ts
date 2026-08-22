import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import type { ClassGroup, ClassPlan } from "../../../../core/models";
import {
  deleteClassPlansByClass,
  getClassPlansByClass,
  saveClassPlans,
} from "../../../../db/seed";
import { useGeneratePlansMode } from "../useGeneratePlansMode";

jest.mock("../../../../db/seed", () => ({
  deleteClassPlansByClass: jest.fn(),
  getClassPlansByClass: jest.fn(),
  saveClassPlans: jest.fn(),
  updateClassPlan: jest.fn(),
}));

describe("useGeneratePlansMode", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getClassPlansByClass as jest.Mock).mockResolvedValue([]);
    (deleteClassPlansByClass as jest.Mock).mockResolvedValue(undefined);
    (saveClassPlans as jest.Mock).mockResolvedValue(undefined);
  });

  it("keeps cycle id, year and start date from the same override", async () => {
    const selectedClass = {
      id: "class-1",
      organizationId: "org-1",
      daysOfWeek: [2],
      mvLevel: "MV1",
    } as ClassGroup;
    let generate:
      | ReturnType<typeof useGeneratePlansMode>["handleGenerateMode"]
      | null = null;

    function Harness() {
      const result = useGeneratePlansMode({
        selectedClass,
        activeCycleId: "cycle-2026",
        activeCycleYear: 2026,
        cycleLength: 1,
        activeCycleStartDate: "2026-01-01",
        isCompetitiveMode: false,
        ageBand: "09-11",
        periodizationModel: "iniciacao",
        weeklySessions: 1,
        sportProfile: "voleibol",
        calendarExceptions: [],
        competitiveProfile: null,
        buildAutoPlanForWeek: jest.fn(),
        refreshPlans: jest.fn().mockResolvedValue(undefined),
        setClassPlans: jest.fn(),
        setIsSavingPlans: jest.fn(),
      });
      generate = result.handleGenerateMode;
      return null;
    }

    await act(async () => {
      TestRenderer.create(React.createElement(Harness));
    });
    await act(async () => {
      await generate?.("all", {
        id: "cycle-2027",
        year: 2027,
        startDate: "2027-01-01",
      });
    });

    expect(getClassPlansByClass).toHaveBeenCalledWith("class-1", {
      cycleId: "cycle-2027",
      cycleYear: 2027,
    });
    expect(deleteClassPlansByClass).toHaveBeenCalledWith("class-1", {
      cycleId: "cycle-2027",
      cycleYear: 2027,
    });
    expect(saveClassPlans).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          cycleId: "cycle-2027",
          startDate: "2027-01-01",
        }),
      ] as Partial<ClassPlan>[]),
    );
  });
});
