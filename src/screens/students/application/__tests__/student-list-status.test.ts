import { resolveStudentListPrimaryStatus } from "../student-list-status";

describe("resolveStudentListPrimaryStatus", () => {
  it("shows inactive membership before the academic profile", () => {
    expect(
      resolveStudentListPrimaryStatus({
        membershipStatus: "inactive",
        isExperimental: false,
      }),
    ).toBe("inactive");

    expect(
      resolveStudentListPrimaryStatus({
        membershipStatus: "inactive",
        isExperimental: true,
      }),
    ).toBe("inactive");
  });

  it("keeps the existing active and experimental labels", () => {
    expect(
      resolveStudentListPrimaryStatus({
        membershipStatus: "active",
        isExperimental: true,
      }),
    ).toBe("experimental");
    expect(
      resolveStudentListPrimaryStatus({
        membershipStatus: "active",
        isExperimental: false,
      }),
    ).toBe("active");
  });
});
