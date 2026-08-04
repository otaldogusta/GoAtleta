import {
  formatDateInput,
  formatShortDate,
  parseDateInputToIso,
} from "../DateInput";

describe("DateInput date conversion", () => {
  it("formats the stored local ISO date for Brazilian display", () => {
    expect(formatShortDate("2026-07-01")).toBe("01/07/2026");
  });

  it("keeps a full replacement stable while the user types", () => {
    expect(formatDateInput("29072026")).toBe("29/07/2026");
  });

  it("converts a valid Brazilian date back to the local ISO key", () => {
    expect(parseDateInputToIso("29/07/2026")).toBe("2026-07-29");
  });

  it("does not commit incomplete or impossible dates", () => {
    expect(parseDateInputToIso("29/07/202")).toBeNull();
    expect(parseDateInputToIso("31/02/2026")).toBeNull();
  });
});
