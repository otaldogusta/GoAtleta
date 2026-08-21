import {
  PROFILE_NAME_FALLBACK,
  getProfileNameValidationError,
  normalizeProfileName,
  resolveProfileDisplayName,
} from "../profile-name";

describe("profile name", () => {
  it("normalizes whitespace without changing compound names", () => {
    expect(normalizeProfileName("  Ana   Júlia ")).toBe("Ana Júlia");
  });

  it("accepts ordinary and compound display names", () => {
    expect(getProfileNameValidationError("Gustavo Ribeiro")).toBeNull();
    expect(getProfileNameValidationError("Ana Júlia")).toBeNull();
  });

  it("rejects empty, email-shaped and invalid names", () => {
    expect(getProfileNameValidationError(" ")).toBe("Informe seu nome.");
    expect(getProfileNameValidationError("brabinha123@gmail.com")).toBe(
      "Informe seu nome, não o e-mail."
    );
    expect(getProfileNameValidationError("1")).toBe("Informe um nome válido.");
  });

  it("does not expose the email local-part as a display name", () => {
    expect(
      resolveProfileDisplayName({
        displayName: "brabinha123",
        email: "brabinha123@gmail.com",
      })
    ).toBe(PROFILE_NAME_FALLBACK);
    expect(
      resolveProfileDisplayName({
        displayName: "Gustavo Ribeiro",
        email: "brabinha123@gmail.com",
      })
    ).toBe("Gustavo Ribeiro");
  });
});
