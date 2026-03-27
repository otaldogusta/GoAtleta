import {
  buildTrainingSessionId,
  buildTrainingSessionWindow,
  resolveTrainingPlanForDate,
} from "../training-sessions";

describe("training sessions helpers", () => {
  test("buildTrainingSessionId stays stable for same org, start and classes", () => {
    const startAt = "2026-03-20T14:00:00.000Z";
    const a = buildTrainingSessionId({
      organizationId: "org_1",
      startAt,
      classIds: ["c_b", "c_a"],
    });
    const b = buildTrainingSessionId({
      organizationId: "org_1",
      startAt,
      classIds: ["c_a", "c_b"],
    });

    expect(a).toBeTruthy();
    expect(a).toBe(b);
  });

  test("buildTrainingSessionWindow uses class start time and duration", () => {
    const window = buildTrainingSessionWindow("2026-03-20", "17:30", 90);
    expect(window.startAt).toContain("2026-03-20");
    expect(window.endAt).not.toBe(window.startAt);
  });

  test("resolveTrainingPlanForDate prefers exact date over weekday", () => {
    const plan = resolveTrainingPlanForDate(
      [
        {
          id: "p1",
          classId: "c1",
          title: "Semana",
          tags: [],
          warmup: [],
          main: [],
          cooldown: [],
          warmupTime: "",
          mainTime: "",
          cooldownTime: "",
          applyDays: [5],
          applyDate: "",
          createdAt: "2026-03-01T00:00:00.000Z",
        },
        {
          id: "p2",
          classId: "c1",
          title: "Dia exato",
          tags: [],
          warmup: [],
          main: [],
          cooldown: [],
          warmupTime: "",
          mainTime: "",
          cooldownTime: "",
          applyDays: [5],
          applyDate: "2026-03-20",
          createdAt: "2026-03-02T00:00:00.000Z",
        },
      ],
      "c1",
      "2026-03-20",
      5
    );

    expect(plan?.id).toBe("p2");
  });
});
