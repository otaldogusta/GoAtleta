import { buildWeekSessionPreview } from "../application/build-week-session-preview";

describe("buildWeekSessionPreview", () => {
  it("builds session dates from the calendar week containing the anchor date", () => {
    const sessions = buildWeekSessionPreview({
      startDate: "2026-05-07",
      daysOfWeek: [2, 4],
      weeklySessions: 2,
      minDate: "2026-04-30",
    });

    expect(sessions.map((item) => item.date)).toEqual(["2026-05-05", "2026-05-07"]);
    expect(sessions.map((item) => item.weekdayLabel)).toEqual(["Ter", "Qui"]);
  });

  it("does not include session dates before the cycle start", () => {
    const sessions = buildWeekSessionPreview({
      startDate: "2026-04-30",
      daysOfWeek: [2, 4],
      weeklySessions: 2,
      minDate: "2026-04-30",
    });

    expect(sessions.map((item) => item.date)).toEqual(["2026-04-30"]);
    expect(sessions[0]?.weekdayLabel).toBe("Qui");
  });

  it("does not include session dates that belong to the next month", () => {
    const sessions = buildWeekSessionPreview({
      startDate: "2026-06-30",
      daysOfWeek: [2, 4],
      weeklySessions: 2,
      minDate: "2026-06-01",
      visibleMonthKey: "2026-06",
    });

    expect(sessions.map((item) => item.date)).toEqual(["2026-06-30"]);
    expect(sessions[0]?.weekdayLabel).toBe("Ter");
  });
});
