import { canActOnAbsenceNotice } from "../absence-notice-state";

describe("absence notice state", () => {
  test.each([
    ["pending", true],
    ["confirmed", false],
    ["ignored", false],
  ] as const)("shows actions for %s status: %s", (status, expected) => {
    expect(canActOnAbsenceNotice({ status })).toBe(expected);
  });
});
