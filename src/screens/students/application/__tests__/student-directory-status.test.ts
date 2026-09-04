import { resolveStudentDirectoryStatus } from "../student-list-status";

const student = { membershipStatus: "active" as const, isExperimental: false, studentUserId: null };

describe("coordination directory status", () => {
  it.each(["none", "invited"] as const)("keeps active preregistration neutral with %s family access", (access) => {
    expect(resolveStudentDirectoryStatus(student, access)).toEqual({
      label: "Ativo", tone: "neutral", reason: "Pré-cadastro da instituição. Acesso ainda não ativado.",
    });
  });
  it("uses green for a linked student or an accepted family access", () => {
    expect(resolveStudentDirectoryStatus({ ...student, studentUserId: "user" }, "none").tone).toBe("success");
    expect(resolveStudentDirectoryStatus(student, "active").tone).toBe("success");
  });
  it("does not mistake unavailable data for an unactivated account", () => {
    expect(resolveStudentDirectoryStatus(student, undefined).reason).toContain("não foi confirmada");
    expect(resolveStudentDirectoryStatus({ ...student, studentUserId: undefined }, "none").tone).toBe("neutral");
  });
  it("never overrides inactive or experimental membership because of access", () => {
    expect(resolveStudentDirectoryStatus({ ...student, membershipStatus: "inactive" }, "active")).toMatchObject({ label: "Inativo", tone: "neutral" });
    expect(resolveStudentDirectoryStatus({ ...student, isExperimental: true }, "active")).toMatchObject({ label: "Experimental", tone: "warning" });
  });
});
