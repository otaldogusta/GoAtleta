import {
  DEFAULT_ORGANIZATION_TIME_ZONE,
  formatOrganizationDateTime,
  getOrganizationMonthToDatePeriod,
  isValidOrganizationTimeZone,
  resolveOrganizationTimeZone,
  toOrganizationIsoDate,
} from "../organization-timezone";

describe("organization timezone", () => {
  const nearUtcMonthBoundary = new Date("2026-08-01T01:30:00.000Z");

  test("uses the organization IANA timezone for operational dates", () => {
    expect(toOrganizationIsoDate(nearUtcMonthBoundary, "America/Sao_Paulo")).toBe(
      "2026-07-31",
    );
    expect(
      getOrganizationMonthToDatePeriod(nearUtcMonthBoundary, "America/Sao_Paulo"),
    ).toEqual({ start: "2026-07-01", end: "2026-07-31" });
    expect(
      formatOrganizationDateTime(nearUtcMonthBoundary, "America/Sao_Paulo"),
    ).toBe("31/07/2026 22:30:00");
  });

  test("falls back safely when an older organization has no valid timezone", () => {
    expect(isValidOrganizationTimeZone("America/Sao_Paulo")).toBe(true);
    expect(isValidOrganizationTimeZone("Fuso/Inexistente")).toBe(false);
    expect(resolveOrganizationTimeZone(null)).toBe(DEFAULT_ORGANIZATION_TIME_ZONE);
    expect(resolveOrganizationTimeZone("Fuso/Inexistente")).toBe(
      DEFAULT_ORGANIZATION_TIME_ZONE,
    );
  });
});
