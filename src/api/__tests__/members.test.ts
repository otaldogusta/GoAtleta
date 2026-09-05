import {
  adminApplyMemberAccessChange,
  adminListOrgMembers,
  adminListOrgMemberClassAssignments,
} from "../members";
import { supabaseRestPost } from "../rest";

jest.mock("../rest", () => ({
  supabaseRestPost: jest.fn(),
}));

const mockSupabaseRestPost = supabaseRestPost as jest.MockedFunction<
  typeof supabaseRestPost
>;

describe("members api", () => {
  beforeEach(() => {
    mockSupabaseRestPost.mockReset();
  });

  it("applies member access through one atomic RPC and maps its receipt", async () => {
    mockSupabaseRestPost.mockResolvedValueOnce([
      {
        receipt_id: "5b3ab9c9-4890-43cf-af8f-d8f35310be31",
        changed: true,
        role_level: 10,
        class_count: 2,
        permission_count: 3,
        notification_id: "ba07f507-6941-414a-89f1-08a46cf39f2b",
        applied_at: "2026-07-29T15:00:00.000Z",
      },
    ]);

    await expect(
      adminApplyMemberAccessChange({
        organizationId: "org-1",
        userId: "user-1",
        roleLevel: 10,
        classIds: ["class-1", "class-2"],
        permissionKeys: ["classes", "calendar", "training"],
        idempotencyKey: "5b3ab9c9-4890-43cf-af8f-d8f35310be31",
      })
    ).resolves.toEqual({
      receiptId: "5b3ab9c9-4890-43cf-af8f-d8f35310be31",
      changed: true,
      roleLevel: 10,
      classCount: 2,
      permissionCount: 3,
      notificationId: "ba07f507-6941-414a-89f1-08a46cf39f2b",
      appliedAt: "2026-07-29T15:00:00.000Z",
    });

    expect(mockSupabaseRestPost).toHaveBeenCalledTimes(1);
    expect(mockSupabaseRestPost).toHaveBeenCalledWith(
      "/rpc/admin_apply_member_access_change_v2",
      {
        p_org_id: "org-1",
        p_user_id: "user-1",
        p_new_role_level: 10,
        p_class_ids: ["class-1", "class-2"],
        p_permission_keys: ["classes", "calendar", "training"],
        p_idempotency_key: "5b3ab9c9-4890-43cf-af8f-d8f35310be31",
      },
      "return=representation"
    );
  });

  it("rejects a response without the server receipt", async () => {
    mockSupabaseRestPost.mockResolvedValueOnce([]);

    await expect(
      adminApplyMemberAccessChange({
        organizationId: "org-1",
        userId: "user-1",
        roleLevel: 10,
        classIds: [],
        permissionKeys: [],
        idempotencyKey: "5b3ab9c9-4890-43cf-af8f-d8f35310be31",
      })
    ).rejects.toThrow("O servidor não confirmou a atualização de acesso.");
  });

  it("lists head and intern class assignments for the access editor", async () => {
    mockSupabaseRestPost.mockResolvedValueOnce([
      {
        user_id: "user-1",
        class_id: "class-1",
        class_name: "Turma 10-12",
        unit: "Rede Esportes Pinhais",
        staff_role: "intern",
      },
      {
        user_id: "user-2",
        class_id: "class-2",
        class_name: "Turma 12-14",
        unit: "Rede Esportes Pinhais",
        staff_role: "head",
      },
    ]);

    await expect(adminListOrgMemberClassAssignments("org-1")).resolves.toEqual([
      {
        userId: "user-1",
        classId: "class-1",
        className: "Turma 10-12",
        unit: "Rede Esportes Pinhais",
        staffRole: "intern",
      },
      {
        userId: "user-2",
        classId: "class-2",
        className: "Turma 12-14",
        unit: "Rede Esportes Pinhais",
        staffRole: "head",
      },
    ]);
    expect(mockSupabaseRestPost).toHaveBeenCalledWith(
      "/rpc/admin_list_org_member_class_assignments",
      { p_org_id: "org-1" },
      "return=representation"
    );
  });

  it("uses the email username until the member sets a profile name", async () => {
    mockSupabaseRestPost.mockResolvedValueOnce([
      {
        organization_id: "org-1",
        user_id: "user-1",
        role_level: 10,
        created_at: "2026-08-21T00:00:00.000Z",
        display_name: "brabinha123",
        email: "brabinha123@gmail.com",
        last_access_at: null,
      },
    ]);

    await expect(adminListOrgMembers("org-1")).resolves.toEqual([
      expect.objectContaining({
        userId: "user-1",
        displayName: "brabinha123",
        email: "brabinha123@gmail.com",
      }),
    ]);
  });
});
