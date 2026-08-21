import {
  isAccountDeletionConfirmationValid,
  normalizeAccountDeletionEmail,
} from "../account-deletion";

describe("account deletion confirmation", () => {
  it("normalizes the confirmation email", () => {
    expect(normalizeAccountDeletionEmail("  Pessoa@Example.COM ")).toBe(
      "pessoa@example.com",
    );
  });

  it("requires the exact account email and rejects an unavailable account email", () => {
    expect(
      isAccountDeletionConfirmationValid(
        "PESSOA@example.com",
        "pessoa@example.com",
      ),
    ).toBe(true);
    expect(
      isAccountDeletionConfirmationValid("outra@example.com", "pessoa@example.com"),
    ).toBe(false);
    expect(isAccountDeletionConfirmationValid("", null)).toBe(false);
  });
});
