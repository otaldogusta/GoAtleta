import { sortClassesBySchedule } from "../class-schedule-sort";

type ScheduledClass = {
  name: string;
  daysOfWeek: number[];
  startTime: string;
  trainingSpace?: string;
};

const scheduledClass = (overrides: Partial<ScheduledClass>): ScheduledClass => ({
  name: "Turma",
  daysOfWeek: [1, 3],
  startTime: "17:00",
  trainingSpace: "Quadra 1",
  ...overrides,
});

describe("sortClassesBySchedule", () => {
  it("puts Quadra 1 first when day and time are equal", () => {
    const sorted = sortClassesBySchedule([
      scheduledClass({ name: "A turma", trainingSpace: "Quadra 2" }),
      scheduledClass({ name: "Z turma", trainingSpace: "Quadra 1" }),
    ]);

    expect(sorted.map((item) => item.trainingSpace)).toEqual(["Quadra 1", "Quadra 2"]);
  });

  it("uses natural numeric order for training spaces", () => {
    const sorted = sortClassesBySchedule([
      scheduledClass({ trainingSpace: "Quadra 10" }),
      scheduledClass({ trainingSpace: "Quadra 2" }),
      scheduledClass({ trainingSpace: "Quadra 1" }),
    ]);

    expect(sorted.map((item) => item.trainingSpace)).toEqual(["Quadra 1", "Quadra 2", "Quadra 10"]);
  });

  it("keeps day and time ahead of the training-space tie-breaker", () => {
    const sorted = sortClassesBySchedule([
      scheduledClass({ name: "Mais tarde", startTime: "18:00", trainingSpace: "Quadra 1" }),
      scheduledClass({ name: "Mais cedo", startTime: "17:00", trainingSpace: "Quadra 2" }),
    ]);

    expect(sorted.map((item) => item.name)).toEqual(["Mais cedo", "Mais tarde"]);
  });

  it("puts classes without a training space after named spaces on a tie", () => {
    const sorted = sortClassesBySchedule([
      scheduledClass({ name: "Sem quadra", trainingSpace: "" }),
      scheduledClass({ name: "Com quadra", trainingSpace: "Quadra 1" }),
    ]);

    expect(sorted.map((item) => item.name)).toEqual(["Com quadra", "Sem quadra"]);
  });
});
