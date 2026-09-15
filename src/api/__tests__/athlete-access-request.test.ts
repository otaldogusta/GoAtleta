import { requestAthleteAccess, listAthleteRequestCandidates, reviewAthleteAccessRequest } from "../athlete-access-request";
import { adminListOrgAccessRequests } from "../organization-access-requests";
import { supabaseRestPost } from "../rest";
jest.mock("../rest", () => ({ supabaseRestPost: jest.fn() }));
const post = supabaseRestPost as jest.Mock;
beforeEach(() => post.mockReset());
it("submits an athlete request without a staff role or product", async () => {
  post.mockResolvedValue("request");
  await expect(requestAthleteAccess("org")).resolves.toBe("request");
  expect(post).toHaveBeenCalledWith("/rpc/request_athlete_access", { p_org_id: "org" });
});
it("requires a server receipt", async () => {
  post.mockResolvedValue(null);
  await expect(requestAthleteAccess("org")).rejects.toThrow();
});
it("loads candidates by request, not a caller-supplied user", async () => {
  post.mockResolvedValue([]);
  await listAthleteRequestCandidates("request");
  expect(post).toHaveBeenCalledWith("/rpc/list_athlete_request_candidates", { p_request_id: "request" });
});
it("reviews a selected student without granting staff access and accepts idempotent replay", async () => {
  post.mockResolvedValue(false);
  await reviewAthleteAccessRequest("request", "approved", "student", "key");
  expect(post).toHaveBeenCalledWith("/rpc/review_athlete_access_request", {
    p_request_id: "request", p_decision: "approved", p_student_id: "student", p_idempotency_key: "key",
  });
});
it("retains athlete kind in the coordination queue", async () => {
  post.mockResolvedValue([{ id: "request", organization_id: "org", request_kind: "athlete" }]);
  expect((await adminListOrgAccessRequests("org"))[0].requestKind).toBe("athlete");
});
it("keeps the existing queue usable before migration without hiding authorization failures", async () => {
  post.mockRejectedValueOnce(new Error('{"code":"PGRST202"}')).mockResolvedValueOnce([]);
  await adminListOrgAccessRequests("org");
  expect(post).toHaveBeenLastCalledWith("/rpc/admin_list_org_access_requests", { p_org_id: "org" }, "return=representation");
  post.mockReset().mockRejectedValueOnce(new Error('{"code":"42501"}'));
  await expect(adminListOrgAccessRequests("org")).rejects.toThrow();
  expect(post).toHaveBeenCalledTimes(1);
});
