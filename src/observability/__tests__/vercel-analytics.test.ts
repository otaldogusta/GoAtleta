import { sanitizeVercelAnalyticsEvent } from "../vercel-analytics";

describe("sanitizeVercelAnalyticsEvent", () => {
  it.each([
    [
      "https://goatleta.com/class/c_1767460923209/attendance?date=2026-07-20",
      "https://goatleta.com/class/_id/attendance",
    ],
    [
      "https://goatleta.com/class/private-class/planning/2026-07",
      "https://goatleta.com/class/_id/planning/_month",
    ],
    [
      "https://goatleta.com/class/private-class/scouting/private-session",
      "https://goatleta.com/class/_id/scouting/_session",
    ],
    [
      "https://goatleta.com/class/private-class/scouting/new",
      "https://goatleta.com/class/_id/scouting/new",
    ],
    [
      "https://goatleta.com/events/private-event#details",
      "https://goatleta.com/events/_id",
    ],
    [
      "https://goatleta.com/invite/private-token",
      "https://goatleta.com/invite/_token",
    ],
    [
      "https://goatleta.com/students/private-student/attendance",
      "https://goatleta.com/students/_id/attendance",
    ],
  ])("anonymizes dynamic route data in %s", (input, expected) => {
    expect(
      sanitizeVercelAnalyticsEvent({ type: "pageview", url: input }),
    ).toEqual({ type: "pageview", url: expected });
  });

  it("keeps a static route and removes its query and hash", () => {
    expect(
      sanitizeVercelAnalyticsEvent({
        type: "pageview",
        url: "https://goatleta.com/prof/home?source=email#today",
      }),
    ).toEqual({
      type: "pageview",
      url: "https://goatleta.com/prof/home",
    });
  });

  it("drops malformed URLs instead of sending raw data", () => {
    expect(
      sanitizeVercelAnalyticsEvent({ type: "pageview", url: "not a url" }),
    ).toBeNull();
  });
});
