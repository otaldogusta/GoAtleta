import {
  getPendingInviteCopy,
  isTerminalPendingInviteIssue,
  resolvePendingInviteViewState,
  resolvePendingRoleHome,
} from "../pending-invite-view";

describe("pending invite presentation", () => {
  it("shows validation while a stored invite is being claimed", () => {
    const state = resolvePendingInviteViewState({
      accessApproved: false,
      inviteBusy: true,
      issue: null,
      hasStoredInvite: true,
    });

    expect(state).toBe("validating");
    expect(getPendingInviteCopy(state).title).toBe("Validando convite");
  });

  it("distinguishes a revoked invite from a generic pending account", () => {
    const state = resolvePendingInviteViewState({
      accessApproved: false,
      inviteBusy: false,
      issue: "revoked",
      hasStoredInvite: true,
    });

    expect(state).toBe("revoked");
    expect(getPendingInviteCopy(state).title).toBe("Convite cancelado");
    expect(isTerminalPendingInviteIssue(state)).toBe(true);
  });

  it("keeps an unmatched account pending when no invite is available", () => {
    const state = resolvePendingInviteViewState({
      accessApproved: false,
      inviteBusy: false,
      issue: null,
      hasStoredInvite: false,
    });

    expect(state).toBe("waiting");
    expect(getPendingInviteCopy(state).title).toBe("Acesso aguardando liberação");
    expect(getPendingInviteCopy(state).subtitle).toBe(
      "Peça um convite ao responsável da sua instituição ou informe o código recebido.",
    );
  });

  it("returns every resolved role to its own portal", () => {
    expect(resolvePendingRoleHome("trainer")).toBe("/prof/home");
    expect(resolvePendingRoleHome("student")).toBe("/student/home");
    expect(resolvePendingRoleHome("family")).toBe("/family/home");
    expect(resolvePendingRoleHome("pending")).toBeNull();
  });
});
