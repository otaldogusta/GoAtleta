import { isStudentBirthdayToday } from "../student-birthday";

describe("isStudentBirthdayToday", () => {
  const today = new Date(2026, 7, 7, 12, 0, 0);

  it("identifies the birthday independently of the birth year", () => {
    expect(isStudentBirthdayToday("2011-08-07", today)).toBe(true);
  });

  it("accepts an ISO timestamp without applying timezone conversion", () => {
    expect(isStudentBirthdayToday("2011-08-07T00:00:00.000Z", today)).toBe(
      true,
    );
  });

  it("rejects another day and invalid values", () => {
    expect(isStudentBirthdayToday("2011-08-08", today)).toBe(false);
    expect(isStudentBirthdayToday("", today)).toBe(false);
    expect(isStudentBirthdayToday(undefined, today)).toBe(false);
  });
});
