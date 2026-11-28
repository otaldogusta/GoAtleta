import { assertSessionIdentity, getSessionIdentity } from "../../auth/session";
import { listDiscoverableFamilyPlanOffers, listMyFamilyPlanOffers, publishOrganizationFamilyPlan, requestFamilyEnrollment, requestMyFamilyPlan, reviewOrganizationFamilyPlan } from "../family-plans";
import { supabaseRestRequest } from "../rest";

jest.mock("../../auth/session", () => ({ assertSessionIdentity: jest.fn(), getSessionIdentity: jest.fn() }));
jest.mock("../rest", () => ({ supabaseRestRequest: jest.fn() }));

const restMock = jest.mocked(supabaseRestRequest);
const sessionMock = jest.mocked(getSessionIdentity);
const assertSessionMock = jest.mocked(assertSessionIdentity);

beforeEach(() => {
  jest.clearAllMocks();
  sessionMock.mockReturnValue({ userId: "guardian-1", generation: 2 });
});

describe("family plan RPC transport", () => {
  it("requests an enrollment with the selected organization's offer, observed terms and retry key", async () => {
    restMock.mockResolvedValueOnce([]).mockResolvedValueOnce("access-request-1");
    await listDiscoverableFamilyPlanOffers("organization-1");
    await expect(requestFamilyEnrollment({ organizationId: "organization-1", kind: "guardian", studentName: " Ana ", relationshipLabel: " Mãe " },
      { offer_id: "offer-1", kind: "monthly", name: "Mensalidade", amount_cents: 9500, billing_day: 10 }, "retry-key")).resolves.toBe("access-request-1");
    expect(restMock).toHaveBeenNthCalledWith(1, "/rpc/list_discoverable_family_plan_offers_v1",
      expect.objectContaining({ body: { p_org_id: "organization-1" } }));
    expect(restMock).toHaveBeenNthCalledWith(2, "/rpc/request_family_enrollment_v1", expect.objectContaining({
      body: { p_org_id: "organization-1", p_kind: "guardian", p_student_name: "Ana", p_relationship_label: "Mãe",
        p_offer_id: "offer-1", p_expected_amount_cents: 9500, p_expected_billing_day: 10, p_idempotency_key: "retry-key" },
    }));
  });

  it("sends the selected relationship and observed terms without a client-supplied organization or student", async () => {
    restMock.mockResolvedValueOnce("request-1");
    const assertContext = jest.fn();
    await expect(requestMyFamilyPlan("relationship-1", { offer_id: "offer-1", amount_cents: 7500, billing_day: null }, assertContext)).resolves.toBe("request-1");
    expect(restMock).toHaveBeenCalledWith("/rpc/request_my_family_plan_v1", {
      method: "POST",
      body: {
        p_relationship_id: "relationship-1", p_offer_id: "offer-1",
        p_expected_amount_cents: 7500, p_expected_billing_day: null,
      },
      assertContextCurrent: expect.any(Function),
    });
    restMock.mock.calls[0]?.[1]?.assertContextCurrent?.();
    expect(assertSessionMock).toHaveBeenCalledWith({ userId: "guardian-1", generation: 2 });
    expect(assertContext).toHaveBeenCalled();
  });

  it("keeps offers scoped to the selected link and fails a stale response", async () => {
    restMock.mockResolvedValueOnce([]);
    await listMyFamilyPlanOffers("relationship-2", () => { throw new Error("Selected link changed"); });
    const [path, options] = restMock.mock.calls[0];
    expect(path).toBe("/rpc/list_my_family_plan_offers_v1");
    expect(options?.body).toEqual({ p_relationship_id: "relationship-2" });
    expect(() => options?.assertContextCurrent?.()).toThrow("Selected link changed");
  });

  it("distinguishes one-time registration offers, tuition publication and explicit human decisions", async () => {
    await publishOrganizationFamilyPlan("organization-1", { enrollmentName: "Matrícula QA", amountCents: 10000 });
    await publishOrganizationFamilyPlan("organization-1", { tuitionPlanId: "plan-1" });
    await reviewOrganizationFamilyPlan("organization-1", "request-1", false);
    expect(restMock).toHaveBeenNthCalledWith(1, "/rpc/publish_organization_family_plan_v1", expect.objectContaining({
      body: { p_org_id: "organization-1", p_tuition_plan_id: null, p_enrollment_name: "Matrícula QA", p_enrollment_amount_cents: 10000 },
    }));
    expect(restMock).toHaveBeenNthCalledWith(2, "/rpc/publish_organization_family_plan_v1", expect.objectContaining({
      body: { p_org_id: "organization-1", p_tuition_plan_id: "plan-1", p_enrollment_name: null, p_enrollment_amount_cents: null },
    }));
    expect(restMock).toHaveBeenNthCalledWith(3, "/rpc/review_organization_family_plan_v1", expect.objectContaining({
      body: { p_org_id: "organization-1", p_request_id: "request-1", p_accept: false },
    }));
  });
});
