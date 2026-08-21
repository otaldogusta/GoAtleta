import {
  ACCOUNT_DELETION_CONFIRMATION,
  isAccountDeletionConfirmationValid,
  normalizeAccountDeletionConfirmation,
} from "../account-deletion";

describe("account deletion confirmation", () => {
  it("normalizes the confirmation text", () => {
    expect(normalizeAccountDeletionConfirmation("  excluir ")).toBe(
      ACCOUNT_DELETION_CONFIRMATION,
    );
  });

  it("requires the explicit deletion word", () => {
    expect(isAccountDeletionConfirmationValid("excluir")).toBe(true);
    expect(isAccountDeletionConfirmationValid("confirmar")).toBe(false);
    expect(isAccountDeletionConfirmationValid("")).toBe(false);
  });
});
