import { resolveProfileInstitution } from "../profile-institution";

it("shows approved athlete institution without staff membership or a class", () => {
  expect(resolveProfileInstitution({ id: "s", organizationId: "org" }, [
    { studentId: "s", organizationId: "org", organizationName: "Instituição QA" },
  ], null)).toEqual({ id: "org", name: "Instituição QA" });
});
it("never substitutes another workspace or another athlete", () => {
  expect(resolveProfileInstitution({ id: "s", organizationId: "org" }, [
    { studentId: "other", organizationId: "org", organizationName: "Other" },
  ], { id: "staff", name: "Staff" })).toEqual({ id: "org", name: "Instituição vinculada" });
});
it("only shows the find institution state without an athlete organization", () => {
  expect(resolveProfileInstitution(null, [], { id: "staff", name: "Staff" })).toBeNull();
});
