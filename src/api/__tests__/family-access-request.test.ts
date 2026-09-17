import { approveFamilyRegistration, requestFamilyAccess, listFamilyRequestCandidates, reviewFamilyAccessRequest, familyAccessErrorMessage } from "../family-access-request";
import { supabaseRestPost } from "../rest";
jest.mock("../rest", () => ({ supabaseRestPost: jest.fn() }));
const post = supabaseRestPost as jest.Mock;
beforeEach(() => post.mockReset());
it("approves a new family registration without choosing another athlete", async () => {
  post.mockResolvedValue(true);
  await approveFamilyRegistration("request", "stable-key");
  expect(post).toHaveBeenCalledWith("/rpc/approve_family_registration", {
    p_request_id: "request", p_idempotency_key: "stable-key",
  });
});
it("accepts an idempotent replay but rejects an unconfirmed approval", async () => {
  post.mockResolvedValue(false);
  await expect(approveFamilyRegistration("request", "key")).resolves.toBeUndefined();
  post.mockResolvedValue(null);
  await expect(approveFamilyRegistration("request", "key")).rejects.toThrow();
});
it.each(['{"message":42}', 'null', '{"message":{}}'])("keeps malformed error payloads safe: %s", (payload) => {
  expect(familyAccessErrorMessage(new Error(payload))).toContain("os dados preenchidos foram mantidos");
});
it("sends explicit guardian intent without granting permissions", async () => {
  post.mockResolvedValue("id");
  await requestFamilyAccess({ organizationId: "org", kind: "guardian", studentName: " Lucas ", relationshipLabel: " Pai " });
  expect(post).toHaveBeenCalledWith("/rpc/request_family_access", {
    p_org_id: "org", p_kind: "guardian", p_student_name: "Lucas", p_relationship_label: "Pai",
  });
});
it("does not submit an incomplete guardian request", async () => {
  await expect(requestFamilyAccess({ organizationId: "org", kind: "guardian", studentName: "Lucas" })).rejects.toThrow("parentesco");
  expect(post).not.toHaveBeenCalled();
});
it("does not infer guardian privileges from athlete contact details", async () => {
  post.mockResolvedValue("id");
  await requestFamilyAccess({ organizationId: "org", kind: "athlete", studentName: "Lucas", relationshipLabel: "Pai" });
  expect(post.mock.calls[0][1].p_relationship_label).toBeNull();
});
it("requires a confirmed receipt", async () => {
  post.mockResolvedValue(null);
  await expect(reviewFamilyAccessRequest("r", "approved", "s", "key")).rejects.toThrow();
});
it("keeps candidate lookup scoped to the request", async () => {
  post.mockResolvedValue([]);
  await listFamilyRequestCandidates("r");
  expect(post).toHaveBeenCalledWith("/rpc/list_family_request_candidates", { p_request_id: "r" });
});
