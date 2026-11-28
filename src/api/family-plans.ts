import { assertSessionIdentity, getSessionIdentity } from "../auth/session";
import type { FamilyAccessRequestInput } from "./family-access-request";
import { supabaseRestRequest } from "./rest";

export type FamilyPlanKind = "enrollment" | "monthly";
export type FamilyPlanRequestStatus = "pending" | "accepted" | "declined";

export type FamilyPlanOffer = {
  offer_id: string;
  kind: FamilyPlanKind;
  name: string;
  description: string | null;
  amount_cents: number;
  billing_day: number | null;
  status: FamilyPlanRequestStatus | "available";
};

export type OrganizationFamilyPlanOffer = Pick<FamilyPlanOffer, "offer_id" | "kind" | "name" | "amount_cents"> & {
  tuition_plan_id: string | null;
  published: boolean;
  discoverable?: boolean;
};

export type FamilyEnrollmentPlan = Pick<FamilyPlanOffer, "offer_id" | "kind" | "name" | "amount_cents" | "billing_day">;

export type OrganizationFamilyPlanRequest = {
  request_id: string;
  kind: FamilyPlanKind;
  student_name: string;
  offer_name: string;
  amount_cents: number;
  billing_day: number | null;
  status: FamilyPlanRequestStatus;
};

export type OrganizationFamilyPlans = {
  offers: OrganizationFamilyPlanOffer[];
  requests: OrganizationFamilyPlanRequest[];
  enrollments?: (FamilyEnrollmentPlan & {
    request_id: string;
    student_name: string;
    access_status: "pending" | "approved" | "rejected";
  })[];
};

function familyPlanRpc<T>(path: string, body: object, assertContextCurrent?: () => void) {
  const session = getSessionIdentity();
  return supabaseRestRequest<T>(`/rpc/${path}`, {
    method: "POST",
    body,
    assertContextCurrent: () => {
      assertSessionIdentity(session);
      assertContextCurrent?.();
    },
  });
}

export const listMyFamilyPlanOffers = (relationshipId: string, assertContextCurrent?: () => void) =>
  familyPlanRpc<FamilyPlanOffer[]>("list_my_family_plan_offers_v1", { p_relationship_id: relationshipId }, assertContextCurrent);

export const listDiscoverableFamilyPlanOffers = (organizationId: string, assertContextCurrent?: () => void) =>
  familyPlanRpc<FamilyPlanOffer[]>("list_discoverable_family_plan_offers_v1", { p_org_id: organizationId }, assertContextCurrent);

export const requestFamilyEnrollment = (
  request: FamilyAccessRequestInput,
  offer: FamilyEnrollmentPlan,
  idempotencyKey: string,
  assertContextCurrent?: () => void,
) => familyPlanRpc<string>("request_family_enrollment_v1", {
  p_org_id: request.organizationId,
  p_kind: request.kind,
  p_student_name: request.studentName.trim(),
  p_relationship_label: request.kind === "guardian" ? request.relationshipLabel?.trim() ?? null : null,
  p_offer_id: offer.offer_id,
  p_expected_amount_cents: offer.amount_cents,
  p_expected_billing_day: offer.billing_day,
  p_idempotency_key: idempotencyKey,
}, assertContextCurrent);

export const setOrganizationFamilyPlanDiscoverable = (
  organizationId: string,
  offerId: string,
  discoverable: boolean,
  assertContextCurrent?: () => void,
) => familyPlanRpc<null>("set_organization_family_plan_discoverable_v1", {
  p_org_id: organizationId,
  p_offer_id: offerId,
  p_discoverable: discoverable,
}, assertContextCurrent);

export const requestMyFamilyPlan = (
  relationshipId: string,
  offer: Pick<FamilyPlanOffer, "offer_id" | "amount_cents" | "billing_day">,
  assertContextCurrent?: () => void,
) => familyPlanRpc<string>("request_my_family_plan_v1", {
  p_relationship_id: relationshipId,
  p_offer_id: offer.offer_id,
  p_expected_amount_cents: offer.amount_cents,
  p_expected_billing_day: offer.billing_day,
}, assertContextCurrent);

export const listOrganizationFamilyPlans = (organizationId: string, assertContextCurrent?: () => void) =>
  familyPlanRpc<OrganizationFamilyPlans>("list_organization_family_plans_v1", { p_org_id: organizationId }, assertContextCurrent);

type FamilyPlanPublication = { tuitionPlanId: string } | { enrollmentName: string; amountCents: number };

export const publishOrganizationFamilyPlan = (
  organizationId: string,
  publication: FamilyPlanPublication,
  assertContextCurrent?: () => void,
) => familyPlanRpc<string>("publish_organization_family_plan_v1", {
  p_org_id: organizationId,
  p_tuition_plan_id: "tuitionPlanId" in publication ? publication.tuitionPlanId : null,
  p_enrollment_name: "enrollmentName" in publication ? publication.enrollmentName : null,
  p_enrollment_amount_cents: "amountCents" in publication ? publication.amountCents : null,
}, assertContextCurrent);

export const unpublishOrganizationFamilyPlan = (
  organizationId: string,
  offerId: string,
  assertContextCurrent?: () => void,
) => familyPlanRpc<null>("unpublish_organization_family_plan_v1", {
  p_org_id: organizationId,
  p_offer_id: offerId,
}, assertContextCurrent);

export const reviewOrganizationFamilyPlan = (
  organizationId: string,
  requestId: string,
  accept: boolean,
  assertContextCurrent?: () => void,
) => familyPlanRpc<FamilyPlanRequestStatus>("review_organization_family_plan_v1", {
  p_org_id: organizationId,
  p_request_id: requestId,
  p_accept: accept,
}, assertContextCurrent);
