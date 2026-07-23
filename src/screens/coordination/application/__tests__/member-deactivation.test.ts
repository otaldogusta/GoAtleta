import type { OrgMember } from "../../../../api/members";
import {
  formatMemberDeactivationError,
  getMemberDeactivationBlockReason,
} from "../member-deactivation";

const member = (userId: string, roleLevel: number): OrgMember => ({
  organizationId: "org-1",
  userId,
  roleLevel,
  createdAt: "2026-07-23T00:00:00.000Z",
  displayName: `Pessoa ${userId}`,
  email: null,
  lastAccessAt: null,
});

describe("member deactivation", () => {
  it("blocks members who still lead classes", () => {
    expect(getMemberDeactivationBlockReason(member("coach", 10), [], 2)).toBe(
      "Reatribua as turmas desta pessoa antes de desativar o acesso."
    );
  });

  it("blocks the last coordinator", () => {
    const coordinator = member("admin", 50);
    expect(getMemberDeactivationBlockReason(coordinator, [coordinator], 0)).toBe(
      "Defina outra pessoa como coordenação antes de desativar este acesso."
    );
  });

  it("allows a coordinator when another coordinator remains", () => {
    const coordinator = member("admin-1", 50);
    expect(
      getMemberDeactivationBlockReason(
        coordinator,
        [coordinator, member("admin-2", 50)],
        0
      )
    ).toBeNull();
  });

  it("translates database guards into direct blocking messages", () => {
    expect(
      formatMemberDeactivationError(
        new Error('{"message":"Cannot remove yourself","code":"P0001"}')
      )
    ).toEqual({
      message: "Seu próprio acesso não pode ser desativado por aqui.",
      blocking: true,
    });
  });

  it("keeps unexpected failures retryable", () => {
    expect(formatMemberDeactivationError(new Error("Network unavailable"))).toEqual({
      message: "Não foi possível desativar agora. Tente novamente.",
      blocking: false,
    });
  });
});
