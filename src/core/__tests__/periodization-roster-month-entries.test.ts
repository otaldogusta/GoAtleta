import { buildRosterMonthEntries } from "../periodization";

describe("buildRosterMonthEntries", () => {
  const maySaturdayDates = [
    "2026-05-02",
    "2026-05-09",
    "2026-05-16",
    "2026-05-23",
    "2026-05-30",
  ];

  it("builds roster entries from YYYY-MM month value", () => {
    const entries = buildRosterMonthEntries("2026-05", [6]);

    expect(entries.map((entry) => entry.dateKey)).toEqual(maySaturdayDates);
  });

  it("builds roster entries from YYYY-MM-DD month value", () => {
    const entries = buildRosterMonthEntries("2026-05-01", [6]);

    expect(entries.map((entry) => entry.dateKey)).toEqual(maySaturdayDates);
  });
});
