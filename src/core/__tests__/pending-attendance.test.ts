import { filterActionablePendingAttendance } from "../pending-attendance";

const candidate = {
  classId: "class-saturday",
  targetDate: "2026-07-21",
};

describe("filterActionablePendingAttendance", () => {
  it("não marca uma turma de sábado como pendente na terça-feira", () => {
    const result = filterActionablePendingAttendance({
      candidates: [candidate],
      schedules: [
        {
          id: "class-saturday",
          daysOfWeek: [6],
          startTime: "09:00",
          endTime: "10:00",
        },
      ],
      now: new Date(2026, 6, 21, 12, 0),
    });

    expect(result).toEqual([]);
  });

  it("só marca a chamada do dia depois que a aula termina", () => {
    const candidates = [{ classId: "class-tuesday", targetDate: "2026-07-21" }];
    const schedules = [
      {
        id: "class-tuesday",
        daysOfWeek: [2],
        startTime: "09:00",
        endTime: "10:00",
      },
    ];

    expect(
      filterActionablePendingAttendance({
        candidates,
        schedules,
        now: new Date(2026, 6, 21, 9, 30),
      })
    ).toEqual([]);

    expect(
      filterActionablePendingAttendance({
        candidates,
        schedules,
        now: new Date(2026, 6, 21, 10, 1),
      })
    ).toEqual(candidates);
  });

  it("usa início e duração quando a turma não possui horário final", () => {
    const candidates = [{ classId: "class-tuesday", targetDate: "2026-07-21" }];

    expect(
      filterActionablePendingAttendance({
        candidates,
        schedules: [
          {
            id: "class-tuesday",
            daysOfWeek: [2],
            startTime: "09:00",
            durationMinutes: 60,
          },
        ],
        now: new Date(2026, 6, 21, 10, 1),
      })
    ).toEqual(candidates);
  });

  it("preserva uma pendência passada e ignora datas futuras ou inválidas", () => {
    const past = { classId: "class-saturday", targetDate: "2026-07-18" };
    const future = { classId: "class-saturday", targetDate: "2026-07-25" };
    const invalid = { classId: "class-saturday", targetDate: "sem-data" };

    expect(
      filterActionablePendingAttendance({
        candidates: [past, future, invalid],
        schedules: [],
        now: new Date(2026, 6, 21, 12, 0),
      })
    ).toEqual([past]);
  });
});
