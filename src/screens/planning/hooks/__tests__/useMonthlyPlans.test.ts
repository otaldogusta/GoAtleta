import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import type { ClassGroup, ClassPlan, PlanningCycle } from "../../../../core/models";
import { ensureActiveCycleForYear, getActivePlanningCycle } from "../../../../db/cycles";
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
  ensureActiveCycleForYear: jest.fn(),
  getActivePlanningCycle: jest.fn(),
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

function renderUseMonthlyPlans(onSnapshot: (snapshot: ReturnType<typeof useMonthlyPlans>) => void) {
  function Harness() {
    const snapshot = useMonthlyPlans("class-1", "2026-06");
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
    (ensureActiveCycleForYear as jest.Mock).mockResolvedValue(undefined);
    (getActivePlanningCycle as jest.Mock).mockResolvedValue(cycle);
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
    (listDailyLessonPlansByWeekIds as jest.Mock).mockImplementation(() => new Promise(() => undefined));
    let latest: ReturnType<typeof useMonthlyPlans> | null = null;

    await act(async () => {
      renderUseMonthlyPlans((snapshot) => {
        latest = snapshot;
      });
    });
    await flushPromises();

    expect(latest?.isLoading).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(6000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(latest?.isLoading).toBe(false);
    expect(latest?.error).toBeNull();
    expect(latest?.weeklyItems).toHaveLength(4);
    expect(latest?.dailyPlansByKey).toEqual({});
  });

  it("stops loading and shows an error when required month data hangs", async () => {
    (getClassPlansByClass as jest.Mock).mockImplementation(() => new Promise(() => undefined));
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
    expect(latest?.error).toContain("Tempo excedido ao carregar semanas do ciclo.");
    expect(latest?.weeklyItems).toHaveLength(0);
  });
});
