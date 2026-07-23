import { formatMemberLastAccess } from "../member-last-access";

describe("formatMemberLastAccess", () => {
  const now = new Date(2026, 6, 23, 12, 0);

  it("formats access from today with time", () => {
    expect(formatMemberLastAccess(new Date(2026, 6, 23, 9, 42).toISOString(), now)).toBe(
      "Hoje, 09:42"
    );
  });

  it("formats access from yesterday with time", () => {
    expect(formatMemberLastAccess(new Date(2026, 6, 22, 18, 10).toISOString(), now)).toBe(
      "Ontem, 18:10"
    );
  });

  it("formats older access without repeating the current year", () => {
    expect(formatMemberLastAccess(new Date(2026, 6, 10, 8, 5).toISOString(), now)).toBe(
      "10 jul., 08:05"
    );
  });

  it("keeps the year when the access happened in another year", () => {
    expect(formatMemberLastAccess(new Date(2025, 11, 30, 14, 0).toISOString(), now)).toBe(
      "30 dez. 2025"
    );
  });

  it("handles members without a valid access timestamp", () => {
    expect(formatMemberLastAccess(null, now)).toBe("Nunca acessou");
    expect(formatMemberLastAccess("invalid", now)).toBe("Nunca acessou");
  });
});
