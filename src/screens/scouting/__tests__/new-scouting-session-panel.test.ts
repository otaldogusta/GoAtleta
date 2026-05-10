import {
  formatIsoDateForInput,
  normalizeInputDateToIso,
} from "../components/NewScoutingSessionPanel";

describe("new-scouting-session-panel helpers", () => {
  test("formats iso date to pt-BR input", () => {
    expect(formatIsoDateForInput("2026-05-10")).toBe("10/05/2026");
  });

  test("normalizes pt-BR input to iso", () => {
    expect(normalizeInputDateToIso("10/05/2026")).toBe("2026-05-10");
  });

  test("keeps iso input when already normalized", () => {
    expect(normalizeInputDateToIso("2026-05-10")).toBe("2026-05-10");
  });

  test("returns null for invalid input", () => {
    expect(normalizeInputDateToIso("10-05-2026")).toBeNull();
  });
});
