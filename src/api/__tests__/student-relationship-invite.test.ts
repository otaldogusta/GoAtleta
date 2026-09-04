import {
  claimStudentRelationshipInvite,
  createStudentRelationshipInvite,
  listStudentFamilyAccessSummaries,
  listStudentRelationshipInvites,
  listStudentRelationships,
  mapStudentFamilyAccessSummary,
  mapStudentRelationshipInvite,
  mapStudentRelationship,
  revokeStudentRelationshipInvite,
  revokeStudentRelationship,
  updateStudentRelationship,
  validateStudentRelationshipInvite,
} from "../student-relationship-invite";
import {
  forceRefreshAccessToken,
  getValidAccessToken,
} from "../../auth/session";
import { supabaseRestPost } from "../rest";

jest.mock("../../auth/session", () => ({
  getValidAccessToken: jest.fn(),
  forceRefreshAccessToken: jest.fn(),
}));
jest.mock("../rest", () => ({ supabaseRestPost: jest.fn() }));

const tokenMock = getValidAccessToken as jest.MockedFunction<
  typeof getValidAccessToken
>;
const refreshMock = forceRefreshAccessToken as jest.MockedFunction<
  typeof forceRefreshAccessToken
>;
const postMock = supabaseRestPost as jest.MockedFunction<
  typeof supabaseRestPost
>;

const mockResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(body),
});

describe("student relationship invite API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tokenMock.mockResolvedValue("access-token");
    refreshMock.mockResolvedValue(null);
  });

  it("sends typed permissions and the caller bearer when creating", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({
        inviteId: "invite-1",
        expiresAt: "2026-09-30T00:00:00Z",
        token: "opaque-token",
        inviteUrl: "https://goatleta.com/family-invite/opaque-token",
      }),
    ) as jest.Mock;

    await createStudentRelationshipInvite({
      organizationId: "org-1",
      studentId: "student-1",
      invitedEmail: "responsavel@example.com",
      relationshipKind: "guardian",
      permissions: { canViewAttendance: true, canPay: true },
    });

    const [url, request] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toContain("/functions/v1/create-student-relationship-invite");
    expect(request.headers).toMatchObject({ Authorization: "Bearer access-token" });
    expect(JSON.parse(String(request.body))).toMatchObject({
      organizationId: "org-1",
      studentId: "student-1",
      relationshipKind: "guardian",
      permissions: { canViewAttendance: true, canPay: true },
    });
  });

  it("keeps validation public and sends bearer only while claiming", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        mockResponse({
          status: "valid",
          preview: {
            inviteId: "invite-1",
            organization: { id: "org-1", name: "Rede Esporte" },
            student: { id: "student-1", name: "Júlia" },
            relationship: { kind: "guardian", label: "Mãe" },
            expiresAt: "2026-09-30T00:00:00Z",
            permissions: {},
          },
        }),
      )
      .mockResolvedValueOnce(
        mockResponse({
          receipt: {
            status: "claimed",
            relationshipId: "relationship-1",
            organizationId: "org-1",
            studentId: "student-1",
            relationshipKind: "guardian",
          },
        }),
      ) as jest.Mock;

    await validateStudentRelationshipInvite("opaque-token");
    await claimStudentRelationshipInvite("opaque-token");

    const firstHeaders = (global.fetch as jest.Mock).mock.calls[0][1].headers;
    const secondHeaders = (global.fetch as jest.Mock).mock.calls[1][1].headers;
    expect(firstHeaders).not.toHaveProperty("Authorization");
    expect(secondHeaders).toMatchObject({ Authorization: "Bearer access-token" });
  });

  it("maps only the allowlisted relationship projection", () => {
    expect(
      mapStudentRelationship({
        relationship_id: "relationship-1",
        user_id: "user-1",
        contact_email: "family@example.com",
        relationship_kind: "payer",
        relationship_label: "Responsável financeiro",
        status: "active",
        can_view_profile: true,
        can_view_financial: true,
        can_pay: true,
        claimed_at: "2026-08-30T00:00:00Z",
        private_field: "not-exposed",
      } as never),
    ).toEqual({
      id: "relationship-1",
      userId: "user-1",
      contactEmail: "family@example.com",
      kind: "payer",
      label: "Responsável financeiro",
      status: "active",
      canViewProfile: true,
      canViewSchedule: false,
      canViewAttendance: false,
      canViewProgress: false,
      canViewHealth: false,
      canSignConsents: false,
      canViewFinancial: true,
      canPay: true,
      claimedAt: "2026-08-30T00:00:00Z",
      revokedAt: null,
    });
  });

  it("keeps deleted or backfilled relationship identities nullable", () => {
    expect(
      mapStudentRelationship({
        relationship_id: "relationship-1",
        user_id: null,
        contact_email: null,
        relationship_kind: "guardian",
        status: "active",
        claimed_at: "2026-08-30T00:00:00Z",
      }),
    ).toEqual(
      expect.objectContaining({ userId: null, contactEmail: null }),
    );
  });

  it("maps the safe invite projection without token or token hash", () => {
    expect(
      mapStudentRelationshipInvite({
        invite_id: "invite-1",
        invited_email: "family@example.com",
        invited_via: "whatsapp",
        relationship_kind: "guardian",
        relationship_label: "Mãe",
        status: "pending",
        expires_at: "2026-09-30T00:00:00Z",
        created_at: "2026-08-30T00:00:00Z",
        created_by: null,
        used_at: null,
        claimed_by: null,
        revoked_at: null,
        token_hash: "must-not-leak",
      } as never),
    ).toEqual({
      id: "invite-1",
      invitedEmail: "family@example.com",
      invitedVia: "whatsapp",
      relationshipKind: "guardian",
      relationshipLabel: "Mãe",
      status: "pending",
      expiresAt: "2026-09-30T00:00:00Z",
      createdAt: "2026-08-30T00:00:00Z",
      createdBy: null,
      usedAt: null,
      claimedBy: null,
      revokedAt: null,
    });
  });

  it("maps the family directory summary without exposing invite tokens", () => {
    expect(
      mapStudentFamilyAccessSummary({
        student_id: "student-1",
        access_status: "invited",
        invite_id: "invite-1",
        contact_name: "Patrícia Costa",
        contact_email: "patricia@example.com",
        relationship_kind: "guardian",
        relationship_label: "Mãe",
        expires_at: "2026-10-03T00:00:00Z",
        token_hash: "must-not-leak",
      } as never),
    ).toEqual({
      studentId: "student-1",
      status: "invited",
      relationshipId: null,
      inviteId: "invite-1",
      contactName: "Patrícia Costa",
      contactEmail: "patricia@example.com",
      relationshipKind: "guardian",
      relationshipLabel: "Mãe",
      expiresAt: "2026-10-03T00:00:00Z",
    });
  });

  it("loads one organization-scoped family access summary for the directory", async () => {
    postMock.mockResolvedValueOnce([
      {
        student_id: "student-1",
        access_status: "active",
        relationship_id: "relationship-1",
      },
    ]);

    await expect(listStudentFamilyAccessSummaries("org-1")).resolves.toEqual([
      expect.objectContaining({
        studentId: "student-1",
        status: "active",
        relationshipId: "relationship-1",
      }),
    ]);
    expect(postMock).toHaveBeenCalledWith(
      "/rpc/list_student_family_access_summaries_v1",
      { p_org_id: "org-1" },
    );
  });

  it("lists by organization and student, then refreshes that scope after revoke", async () => {
    postMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([]);

    await listStudentRelationships("org-1", "student-1");
    await revokeStudentRelationship({
      organizationId: "org-1",
      studentId: "student-1",
      relationshipId: "relationship-1",
      reason: "Solicitação do responsável",
    });

    expect(postMock).toHaveBeenNthCalledWith(
      1,
      "/rpc/list_student_relationships_v1",
      { p_org_id: "org-1", p_student_id: "student-1" },
    );
    expect(postMock).toHaveBeenNthCalledWith(
      2,
      "/rpc/revoke_student_relationship_v1",
      {
        p_relationship_id: "relationship-1",
        p_reason: "Solicitação do responsável",
        p_clear_legacy_login_email: false,
      },
      "return=minimal",
    );
    expect(postMock).toHaveBeenNthCalledWith(
      3,
      "/rpc/list_student_relationships_v1",
      { p_org_id: "org-1", p_student_id: "student-1" },
    );
  });

  it("lists and revokes invites in the selected organization/student scope", async () => {
    postMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([]);

    await listStudentRelationshipInvites("org-1", "student-1");
    await revokeStudentRelationshipInvite({
      organizationId: "org-1",
      studentId: "student-1",
      inviteId: "invite-1",
      reason: "E-mail incorreto",
    });

    expect(postMock).toHaveBeenNthCalledWith(
      1,
      "/rpc/list_student_relationship_invites_v1",
      { p_org_id: "org-1", p_student_id: "student-1" },
    );
    expect(postMock).toHaveBeenNthCalledWith(
      2,
      "/rpc/revoke_student_relationship_invite_v1",
      { p_invite_id: "invite-1", p_reason: "E-mail incorreto" },
      "return=minimal",
    );
    expect(postMock).toHaveBeenNthCalledWith(
      3,
      "/rpc/list_student_relationship_invites_v1",
      { p_org_id: "org-1", p_student_id: "student-1" },
    );
  });

  it("updates a non-athlete relationship inside the selected scope", async () => {
    postMock.mockResolvedValueOnce(null).mockResolvedValueOnce([]);

    await updateStudentRelationship({
      organizationId: "org-1",
      studentId: "student-1",
      relationshipId: "relationship-1",
      relationshipKind: "payer",
      relationshipLabel: "Responsável financeiro",
      permissions: {
        canViewProfile: false,
        canViewSchedule: false,
        canViewAttendance: false,
        canViewProgress: false,
        canViewHealth: false,
        canSignConsents: false,
        canViewFinancial: false,
        canPay: true,
      },
    });

    expect(postMock).toHaveBeenNthCalledWith(
      1,
      "/rpc/update_student_relationship_v1",
      expect.objectContaining({
        p_relationship_id: "relationship-1",
        p_relationship_kind: "payer",
        p_can_view_financial: true,
        p_can_pay: true,
        p_can_view_health: false,
        p_can_sign_consents: false,
      }),
      "return=minimal",
    );
    expect(postMock).toHaveBeenNthCalledWith(
      2,
      "/rpc/list_student_relationships_v1",
      { p_org_id: "org-1", p_student_id: "student-1" },
    );
  });
});
