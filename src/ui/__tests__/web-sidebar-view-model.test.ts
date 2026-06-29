import type { ClassGroup } from "../../core/models";
import { buildWebSidebarViewModel } from "../web-sidebar-view-model";

const buildClass = (overrides: Partial<ClassGroup> = {}): ClassGroup =>
  ({
    id: "c_1",
    name: "Turma 8-11",
    organizationId: "org_1",
    unit: "Rede Esperanca",
    unitId: "u_1",
    colorKey: "emerald",
    modality: "voleibol",
    ageBand: "08-11",
    gender: "misto",
    startTime: "14:00",
    endTime: "15:00",
    durationMinutes: 60,
    daysOfWeek: [2, 4],
    daysPerWeek: 2,
    goal: "Fundamentos",
    equipment: "quadra",
    level: 1,
    mvLevel: "MV1",
    cycleStartDate: "2026-01-06",
    cycleLengthWeeks: 52,
    acwrLow: 0.8,
    acwrHigh: 1.3,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }) as ClassGroup;

describe("web sidebar view model", () => {
  it("uses real class, student and notification counts", () => {
    const viewModel = buildWebSidebarViewModel({
      classes: [
        buildClass({
          id: "c_today",
          name: "ElCartel",
          unit: "UniBrasil",
          startTime: "17:30",
          endTime: "19:00",
          daysOfWeek: [5],
        }),
        buildClass({
          id: "c_tomorrow",
          name: "Amigos do Volei",
          unit: "Cidadania Boa Vista",
          startTime: "13:30",
          endTime: "14:45",
          daysOfWeek: [6],
        }),
      ],
      studentCount: 143,
      unreadCount: 2,
      now: new Date(2026, 5, 26, 12, 0),
    });

    expect(viewModel.totalClasses).toBe(2);
    expect(viewModel.totalStudents).toBe(143);
    expect(viewModel.unreadNotifications).toBe(2);
    expect(viewModel.todayClassCount).toBe(1);
    expect(viewModel.nextClass).toMatchObject({
      classId: "c_today",
      className: "ElCartel",
      unit: "UniBrasil",
      dayLabel: "Hoje",
      timeLabel: "17:30 - 19:00",
    });
  });

  it("does not invent a next class when schedule data is incomplete", () => {
    const viewModel = buildWebSidebarViewModel({
      classes: [
        buildClass({ id: "c_missing_days", daysOfWeek: [], startTime: "14:00" }),
        buildClass({ id: "c_invalid_time", daysOfWeek: [5], startTime: "99:99" }),
      ],
      studentCount: null,
      unreadCount: null,
      now: new Date(2026, 5, 26, 12, 0),
    });

    expect(viewModel.totalClasses).toBe(2);
    expect(viewModel.totalStudents).toBe(0);
    expect(viewModel.unreadNotifications).toBe(0);
    expect(viewModel.nextClass).toBeNull();
  });

  it("chooses the closest valid upcoming class", () => {
    const viewModel = buildWebSidebarViewModel({
      classes: [
        buildClass({
          id: "c_next_week",
          name: "Aula passada hoje",
          startTime: "09:00",
          endTime: "10:00",
          daysOfWeek: [5],
        }),
        buildClass({
          id: "c_tomorrow",
          name: "Primeiros Saques",
          startTime: "08:00",
          endTime: "09:00",
          daysOfWeek: [6],
        }),
      ],
      now: new Date(2026, 5, 26, 12, 0),
    });

    expect(viewModel.nextClass).toMatchObject({
      classId: "c_tomorrow",
      dayLabel: "Amanha",
      timeLabel: "08:00 - 09:00",
    });
  });
});
