import { listOrgStaffCandidates, listOrgStaffContactEmails, mergeOrgStaffCandidates } from "../members";
import { supabaseRestGet, supabaseRestPost } from "../rest";
jest.mock("../rest", () => ({ supabaseRestGet: jest.fn(), supabaseRestPost: jest.fn() }));
beforeEach(() => jest.resetAllMocks());
it("preserves an authorized email while filling the name from a class assignment", async () => {
  (supabaseRestPost as jest.Mock).mockResolvedValue([{ user_id: "angel", email: "angel@example.test" }]);
  const contacts = await listOrgStaffContactEmails("org");
  expect(contacts.get("angel")).toBe("angel@example.test");
  const result = mergeOrgStaffCandidates("org", [{
    organizationId: "org", userId: "angel", displayName: "", email: contacts.get("angel")!,
    roleLevel: 10, createdAt: "", lastAccessAt: null,
  }], [{ classId: "a", userId: "angel", displayName: "Angel Moraes", staffRole: "intern" }]);
  expect(result[0]).toMatchObject({ displayName: "Angel Moraes", email: "angel@example.test" });
});
it("does not expose email when access is denied", async () => {
  (supabaseRestPost as jest.Mock).mockRejectedValue(new Error("42501 Not authorized"));
  expect((await listOrgStaffContactEmails("org")).size).toBe(0);
});
it("includes imported staff from other classes only once", () => {
  const result = mergeOrgStaffCandidates("org", [], [
    { classId: "a", userId: "angel", displayName: "Angel Moraes", staffRole: "intern" },
    { classId: "b", userId: "angel", displayName: "Angel Moraes", staffRole: "intern" },
    { classId: "a", userId: "elika", displayName: "Elika", staffRole: "intern" },
  ]);
  expect(result.map((member) => member.displayName)).toEqual(["Angel Moraes", "Elika"]);
  expect(result.every((member) => member.organizationId === "org")).toBe(true);
});
it("keeps a lower-level organization member only when already assigned as staff", () => {
  const members = [{
    organizationId: "org", userId: "angel", displayName: "Angel Moraes",
    email: "angel@example.test", roleLevel: 5, createdAt: "", lastAccessAt: null,
  }, {
    organizationId: "org", userId: "student", displayName: "Aluno",
    email: "student@example.test", roleLevel: 5, createdAt: "", lastAccessAt: null,
  }];
  const result = mergeOrgStaffCandidates("org", members, [
    { classId: "a", userId: "angel", displayName: "Angel Moraes", staffRole: "intern" },
  ]);
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({ userId: "angel", email: "angel@example.test" });
});
it("combines staff accounts and unlinked pre-registrations without duplicating linked profiles", async () => {
  (supabaseRestPost as jest.Mock).mockResolvedValue([
    { organization_id: "org", user_id: "prof", role_level: 10, display_name: "Professor" },
    { organization_id: "org", user_id: "student", role_level: 5, display_name: "Aluno" },
  ]);
  (supabaseRestGet as jest.Mock).mockResolvedValue([
    { id: "intern", display_name: "Angel", linked_user_id: null, created_at: "2026-09-21" },
    { id: "linked", display_name: "Professor", linked_user_id: "prof" },
  ]);
  const result = await listOrgStaffCandidates("org");
  expect(result.map((candidate) => candidate.userId)).toEqual(["prof", "student", "staff-profile:intern"]);
  expect(result[2]).toMatchObject({ staffProfileId: "intern", isPlaceholder: true, displayName: "Angel" });
  expect(supabaseRestGet).toHaveBeenCalledWith(expect.stringContaining("organization_id=eq.org"));
});
it("does not issue an unscoped request", async () => {
  expect(await listOrgStaffCandidates(" ")).toEqual([]);
  expect(supabaseRestGet).not.toHaveBeenCalled();
});
