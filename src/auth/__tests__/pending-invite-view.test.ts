import {
  getPendingInviteCopy,
  isTerminalPendingInviteIssue,
  resolvePendingInviteViewState,
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

  it("keeps the waiting copy only when no invite is available", () => {
    const state = resolvePendingInviteViewState({
      accessApproved: false,
      inviteBusy: false,
      issue: null,
      hasStoredInvite: false,
    });

    expect(state).toBe("waiting");
    expect(getPendingInviteCopy(state).title).toBe("Aguardando liberação");
  });
});
