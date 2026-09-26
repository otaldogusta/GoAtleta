import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import type { ClassGroup, ClassPlan } from "../../../../core/models";
import {
  deleteClassPlansByClass,
  getClassPlansByClass,
  saveClassPlans,
  updateClassPlan,
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
    const buildAutoPlanForWeek = jest.fn(
      (weekNumber: number, _existing: ClassPlan | null, cycle?: { startDate: string }) => ({
        id: `plan-${weekNumber}`,
        classId: selectedClass.id,
        weekNumber,
        startDate: cycle?.startDate ?? "2026-01-01",
        source: "AUTO",
      } as ClassPlan),
    );
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
        buildAutoPlanForWeek,
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
    expect(buildAutoPlanForWeek).toHaveBeenCalledWith(1, null, {
      id: "cycle-2027",
      year: 2027,
      startDate: "2027-01-01",
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

  it("preserves the current cycle when contextual generation is incomplete", async () => {
    const selectedClass = {
      id: "class-1",
      organizationId: "org-1",
      daysOfWeek: [2],
      mvLevel: "MV1",
    } as ClassGroup;
    let generate: ReturnType<typeof useGeneratePlansMode>["handleGenerateMode"] | null = null;

    function Harness() {
      const result = useGeneratePlansMode({
        selectedClass,
        activeCycleId: "cycle-2026",
        activeCycleYear: 2026,
        cycleLength: 2,
        activeCycleStartDate: "2026-01-01",
        isCompetitiveMode: false,
        ageBand: "09-11",
        periodizationModel: "iniciacao",
        weeklySessions: 1,
        sportProfile: "voleibol",
        calendarExceptions: [],
        competitiveProfile: null,
        buildAutoPlanForWeek: jest.fn(() => null),
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

    await expect(generate?.("all")).rejects.toThrow(
      "Não foi possível gerar todas as semanas. O ciclo atual foi preservado.",
    );
    expect(deleteClassPlansByClass).not.toHaveBeenCalled();
    expect(saveClassPlans).not.toHaveBeenCalled();
  });

  it("updates only current or future automatic weeks when a new report is available", async () => {
    const selectedClass = {
      id: "class-1",
      organizationId: "org-1",
      daysOfWeek: [2],
      mvLevel: "MV1",
    } as ClassGroup;
    const previousSnapshot = JSON.stringify({
      executedHistory: { latestSessionDate: "2099-08-19" },
    });
    const nextSnapshot = JSON.stringify({
      executedHistory: { latestSessionDate: "2099-08-26" },
    });
    const existing = [
      { id: "auto", classId: "class-1", weekNumber: 1, startDate: "2099-09-21", source: "AUTO", generationContextSnapshotJson: previousSnapshot },
      { id: "manual", classId: "class-1", weekNumber: 2, startDate: "2099-09-28", source: "MANUAL", generationContextSnapshotJson: previousSnapshot },
    ] as ClassPlan[];
    (getClassPlansByClass as jest.Mock).mockResolvedValue(existing);
    const buildAutoPlanForWeek = jest.fn((week: number, plan?: ClassPlan | null) => ({
      ...(plan ?? { id: `plan-${week}`, classId: "class-1", weekNumber: week, startDate: "2099-09-21", source: "AUTO" }),
      generationContextSnapshotJson: nextSnapshot,
    } as ClassPlan));
    let generate: ReturnType<typeof useGeneratePlansMode>["handleGenerateMode"] | null = null;

    function Harness() {
      generate = useGeneratePlansMode({
        selectedClass,
        activeCycleId: "cycle-2099",
        activeCycleYear: 2099,
        cycleLength: 2,
        activeCycleStartDate: "2099-09-21",
        isCompetitiveMode: false,
        ageBand: "09-11",
        periodizationModel: "iniciacao",
        weeklySessions: 1,
        sportProfile: "voleibol",
        calendarExceptions: [],
        competitiveProfile: null,
        buildAutoPlanForWeek,
        refreshPlans: jest.fn().mockResolvedValue(undefined),
        setClassPlans: jest.fn(),
        setIsSavingPlans: jest.fn(),
      }).handleGenerateMode;
      return null;
    }

    await act(async () => { TestRenderer.create(React.createElement(Harness)); });
    await act(async () => {
      await generate?.("auto", undefined, { futureOnly: true });
    });

    expect(updateClassPlan).toHaveBeenCalledTimes(1);
    expect(updateClassPlan).toHaveBeenCalledWith(expect.objectContaining({ id: "auto" }));
  });
});
