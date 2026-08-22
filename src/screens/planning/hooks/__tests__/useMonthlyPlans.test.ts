import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import type {
  ClassGroup,
  ClassPlan,
  PlanningCycle,
} from "../../../../core/models";
import {
  getOrCreateInitialActivePlanningCycle,
} from "../../../../db/cycles";
import {
  getAttendanceByClass,
  getClassById,
  getClassCalendarExceptions,
  getClassPlansByClass,
  getSessionLogsByClass,
  getStudentsByClass,
  listDailyLessonPlansByWeekIds,
} from "../../../../db/seed";
import { useMonthlyPlans } from "../useMonthlyPlans";

jest.mock("../../../../db/cycles", () => ({
  getOrCreateInitialActivePlanningCycle: jest.fn(),
}));

jest.mock("../../../../db/seed", () => ({
  getAttendanceByClass: jest.fn(),
  getClassById: jest.fn(),
  getClassCalendarExceptions: jest.fn(),
  getClassPlansByClass: jest.fn(),
  getSessionLogsByClass: jest.fn(),
  getStudentsByClass: jest.fn(),
  listDailyLessonPlansByWeekIds: jest.fn(),
}));

const flushPromises = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

function renderUseMonthlyPlans(
  onSnapshot: (snapshot: ReturnType<typeof useMonthlyPlans>) => void,
  monthKey = "2026-06",
) {
  function Harness() {
    const snapshot = useMonthlyPlans("class-1", monthKey);
    onSnapshot(snapshot);
    return null;
  }

  return TestRenderer.create(React.createElement(Harness));
}

describe("useMonthlyPlans", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest.spyOn(console, "warn").mockImplementation(() => undefined);

    const cls = {
      id: "class-1",
      name: "Turma 07-09",
      organizationId: "org-1",
      daysOfWeek: [6],
      daysPerWeek: 1,
      durationMinutes: 60,
      goal: "Fundamentos",
      mvLevel: "MV1",
      cycleStartDate: "2026-01-05",
      cycleLengthWeeks: 52,
    } as ClassGroup;
    const cycle = {
      id: "cycle-1",
      classId: "class-1",
      year: 2026,
      title: "Jan-Dez 2026",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "active",
    } as PlanningCycle;
    const plans = [23, 24, 25, 26].map((weekNumber, index) => ({
      id: `week-${weekNumber}`,
      classId: "class-1",
      cycleId: "cycle-1",
      startDate: `2026-06-${String(6 + index * 7).padStart(2, "0")}`,
      weekNumber,
      phase: "Consolidação técnica",
      theme: "Aplicação",
      technicalFocus: "Passe",
      physicalFocus: "Controle",
      constraints: "[]",
      mvFormat: "",
      warmupProfile: "",
      jumpTarget: "",
      rpeTarget: "",
      source: "generated",
      weeklySessions: 1,
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    })) as ClassPlan[];

    (getClassById as jest.Mock).mockResolvedValue(cls);
    (getOrCreateInitialActivePlanningCycle as jest.Mock).mockResolvedValue({
      cycles: [cycle],
      activeCycle: cycle,
    });
    (getClassPlansByClass as jest.Mock).mockResolvedValue(plans);
    (getClassCalendarExceptions as jest.Mock).mockResolvedValue([]);
    (getStudentsByClass as jest.Mock).mockResolvedValue([]);
    (getAttendanceByClass as jest.Mock).mockResolvedValue([]);
    (getSessionLogsByClass as jest.Mock).mockResolvedValue([]);
    (listDailyLessonPlansByWeekIds as jest.Mock).mockResolvedValue([]);
  });

  afterEach(() => {
    (console.warn as jest.Mock).mockRestore();
    jest.useRealTimers();
  });

  it("keeps the month screen ready when daily plan lookup hangs", async () => {
    (listDailyLessonPlansByWeekIds as jest.Mock).mockImplementation(
      () => new Promise(() => undefined),
    );
    let latest: ReturnType<typeof useMonthlyPlans> | null = null;

    await act(async () => {
      renderUseMonthlyPlans((snapshot) => {
        latest = snapshot;
      });
    });
    await flushPromises();

    expect(latest?.isLoading).toBe(false);
    expect(latest?.isInitialLoading).toBe(false);
    expect(latest?.error).toBeNull();
    expect(latest?.weeklyItems).toHaveLength(4);
    expect(latest?.dailyPlansByKey).toEqual({});
  });

  it("keeps the initial view loading until the cycle state is resolved", async () => {
    const cycle = {
      id: "cycle-1",
      classId: "class-1",
      organizationId: "org-1",
      year: 2026,
      title: "Jan-Dez 2026",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "active",
    } as PlanningCycle;
    let resolveCycle: ((value: {
      cycles: PlanningCycle[];
      activeCycle: PlanningCycle;
    }) => void) | undefined;
    (getOrCreateInitialActivePlanningCycle as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCycle = resolve;
        }),
    );
    let latest: ReturnType<typeof useMonthlyPlans> | null = null;

    await act(async () => {
      renderUseMonthlyPlans((snapshot) => {
        latest = snapshot;
      });
    });
    await flushPromises();

    expect(latest?.selectedClass?.id).toBe("class-1");
    expect(latest?.activeCycle).toBeNull();
    expect(latest?.isLoading).toBe(true);
    expect(latest?.isInitialLoading).toBe(true);

    await act(async () => {
      resolveCycle?.({ cycles: [cycle], activeCycle: cycle });
      await Promise.resolve();
      await Promise.resolve();
    });
    await flushPromises();

    expect(latest?.activeCycle?.id).toBe("cycle-1");
    expect(latest?.isLoading).toBe(false);
    expect(latest?.isInitialLoading).toBe(false);
  });

  it("shows the monthly plan before optional context finishes loading", async () => {
    let resolveStudents: ((value: []) => void) | undefined;
    (getStudentsByClass as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveStudents = resolve;
        }),
    );
    let latest: ReturnType<typeof useMonthlyPlans> | null = null;

    await act(async () => {
      renderUseMonthlyPlans((snapshot) => {
        latest = snapshot;
      });
    });
    await flushPromises();

    expect(latest?.isInitialLoading).toBe(false);
    expect(latest?.isLoading).toBe(true);
    expect(latest?.activeCycle?.id).toBe("cycle-1");
    expect(latest?.weeklyItems).toHaveLength(4);

    await act(async () => {
      resolveStudents?.([]);
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  it("does not create or load a cycle before periodization is configured", async () => {
    (getClassById as jest.Mock).mockResolvedValue({
      id: "class-1",
      name: "Turma sem periodização",
      organizationId: "org-1",
      goal: "",
      mvLevel: "",
      cycleStartDate: "",
      cycleLengthWeeks: 0,
    } as ClassGroup);
    let latest: ReturnType<typeof useMonthlyPlans> | null = null;

    await act(async () => {
      renderUseMonthlyPlans((snapshot) => {
        latest = snapshot;
      });
    });
    await flushPromises();

    expect(latest?.isLoading).toBe(false);
    expect(latest?.isPeriodizationConfigured).toBe(false);
    expect(getOrCreateInitialActivePlanningCycle).not.toHaveBeenCalled();
    expect(getClassPlansByClass).not.toHaveBeenCalled();
  });

  it("loads the cycle that belongs to the selected historical year", async () => {
    const archivedCycle = {
      id: "cycle-2026",
      classId: "class-1",
      organizationId: "org-1",
      year: 2026,
      title: "Jan-Dez 2026",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "archived",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-12-31T00:00:00.000Z",
    } as PlanningCycle;
    const activeCycle = {
      ...archivedCycle,
      id: "cycle-2027",
      year: 2027,
      title: "Jan-Dez 2027",
      startDate: "2027-01-01",
      endDate: "2027-12-31",
      status: "active",
    } as PlanningCycle;
    (getOrCreateInitialActivePlanningCycle as jest.Mock).mockResolvedValue({
      cycles: [activeCycle, archivedCycle],
      activeCycle,
    });
    (getClassPlansByClass as jest.Mock).mockResolvedValue([
      {
        id: "historical-week",
        classId: "class-1",
        cycleId: "cycle-2026",
        startDate: "2026-06-06",
        weekNumber: 23,
        phase: "Consolidação",
        theme: "Histórico",
        technicalFocus: "Passe",
        physicalFocus: "Controle",
        constraints: "[]",
        mvFormat: "",
        warmupProfile: "",
        jumpTarget: "",
        rpeTarget: "",
        source: "MANUAL",
        weeklySessions: 1,
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
      },
    ] as ClassPlan[]);
    let latest: ReturnType<typeof useMonthlyPlans> | null = null;

    await act(async () => {
      renderUseMonthlyPlans((snapshot) => {
        latest = snapshot;
      });
    });
    await flushPromises();

    expect(latest?.isLoading).toBe(false);
    expect(latest?.activeCycle).toMatchObject({
      id: "cycle-2026",
      status: "archived",
    });
    expect(latest?.isHistoricalCycle).toBe(true);
    expect(latest?.weeklyItems).toHaveLength(1);
    expect(getClassPlansByClass).toHaveBeenCalledWith("class-1", {
      cycleId: "cycle-2026",
      cycleYear: 2026,
    });
  });

  it("does not fall back to another year when the selected year has no cycle", async () => {
    const activeCycle = {
      id: "cycle-2027",
      classId: "class-1",
      organizationId: "org-1",
      year: 2027,
      title: "Jan-Dez 2027",
      startDate: "2027-01-01",
      endDate: "2027-12-31",
      status: "active",
      createdAt: "2027-01-01T00:00:00.000Z",
      updatedAt: "2027-01-01T00:00:00.000Z",
    } as PlanningCycle;
    (getOrCreateInitialActivePlanningCycle as jest.Mock).mockResolvedValue({
      cycles: [activeCycle],
      activeCycle,
    });
    let latest: ReturnType<typeof useMonthlyPlans> | null = null;

    await act(async () => {
      renderUseMonthlyPlans((snapshot) => {
        latest = snapshot;
      }, "2028-06");
    });
    await flushPromises();

    expect(latest?.isLoading).toBe(false);
    expect(latest?.activeCycle).toBeNull();
    expect(getClassPlansByClass).not.toHaveBeenCalled();
  });

  it("starts the June weekly item on the first real class day when the plan is anchored later", async () => {
    (getClassById as jest.Mock).mockResolvedValue({
      id: "class-1",
      name: "Turma 8-11",
      organizationId: "org-1",
      daysOfWeek: [2, 4],
      daysPerWeek: 2,
      durationMinutes: 60,
      goal: "Fundamentos",
      mvLevel: "MV1",
      cycleStartDate: "2026-01-05",
      cycleLengthWeeks: 52,
    } as ClassGroup);
    (getClassPlansByClass as jest.Mock).mockResolvedValue([
      {
        id: "week-june-start",
        classId: "class-1",
        cycleId: "cycle-1",
        startDate: "2026-06-04",
        weekNumber: 23,
        phase: "Fundamentos",
        theme: "Ponte 1x1 -> 2x2",
        technicalFocus: "Controle",
        physicalFocus: "Deslocamento",
        constraints: "",
        mvFormat: "",
        warmupProfile: "",
        jumpTarget: "",
        rpeTarget: "",
        source: "MANUAL",
        weeklySessions: 2,
        createdAt: "2026-06-04T00:00:00.000Z",
        updatedAt: "2026-06-04T00:00:00.000Z",
      },
      {
        id: "week-next",
        classId: "class-1",
        cycleId: "cycle-1",
        startDate: "2026-06-11",
        weekNumber: 24,
        phase: "Fundamentos",
        theme: "2x2 cooperativo",
        technicalFocus: "Controle",
        physicalFocus: "Deslocamento",
        constraints: "",
        mvFormat: "",
        warmupProfile: "",
        jumpTarget: "",
        rpeTarget: "",
        source: "MANUAL",
        weeklySessions: 2,
        createdAt: "2026-06-11T00:00:00.000Z",
        updatedAt: "2026-06-11T00:00:00.000Z",
      },
    ] as ClassPlan[]);

    let latest: ReturnType<typeof useMonthlyPlans> | null = null;

    await act(async () => {
      renderUseMonthlyPlans((snapshot) => {
        latest = snapshot;
      });
    });
    await flushPromises();

    expect(latest?.isLoading).toBe(false);
    expect(latest?.weeklyItems.map((item) => item.plan.id)).toEqual([
      "week-june-start",
      "week-next",
    ]);
    expect(
      latest?.weeklyItems[0]?.sessions.map((session) => session.date),
    ).toEqual(["2026-06-02", "2026-06-04"]);
    expect(latest?.weeklyItems[0]?.weekStartLabel).toBe("02/06/2026");
    expect(listDailyLessonPlansByWeekIds).toHaveBeenLastCalledWith([
      "week-june-start",
      "week-next",
    ]);
  });

  it("stops loading and shows an error when required month data hangs", async () => {
    (getClassPlansByClass as jest.Mock).mockImplementation(
      () => new Promise(() => undefined),
    );
    let latest: ReturnType<typeof useMonthlyPlans> | null = null;

    await act(async () => {
      renderUseMonthlyPlans((snapshot) => {
        latest = snapshot;
      });
    });
    await flushPromises();

    expect(latest?.isLoading).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(10000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(latest?.isLoading).toBe(false);
    expect(latest?.error).toContain(
      "Tempo excedido ao carregar semanas do ciclo.",
    );
    expect(latest?.weeklyItems).toHaveLength(0);
  });
});
