import {
  getClassScheduleOverlapDays,
  trainingSpacesMayOverlap,
} from "../class-schedule-conflicts";

const scheduledClass = (overrides: Record<string, unknown> = {}) => ({
  unit: "Rede Esperança",
  trainingSpace: "Quadra 1",
  startTime: "15:00",
  durationMinutes: 60,
  daysOfWeek: [1, 3],
  ...overrides,
});

describe("class schedule conflicts by training space", () => {
  it("does not overlap classes assigned to different courts", () => {
    expect(
      getClassScheduleOverlapDays(
        scheduledClass(),
        scheduledClass({ trainingSpace: "Quadra 2" })
      )
    ).toEqual([]);
  });

  it("keeps conflicts for the same court ignoring accents and casing", () => {
    expect(trainingSpacesMayOverlap("Área 1", "area 1")).toBe(true);
    expect(getClassScheduleOverlapDays(scheduledClass(), scheduledClass())).toEqual([1, 3]);
  });

  it("treats missing court data conservatively for legacy classes", () => {
    expect(trainingSpacesMayOverlap("Quadra 1", "")).toBe(true);
    expect(
      getClassScheduleOverlapDays(
        scheduledClass(),
        scheduledClass({ trainingSpace: undefined })
      )
    ).toEqual([1, 3]);
  });

  it("does not overlap adjacent time ranges", () => {
    expect(
      getClassScheduleOverlapDays(
        scheduledClass(),
        scheduledClass({ startTime: "16:00" })
      )
    ).toEqual([]);
  });
});
