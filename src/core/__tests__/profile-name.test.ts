import {
  PROFILE_NAME_FALLBACK,
  getProfileNameValidationError,
  getFirstAccessProfileNameValidationError,
  normalizeProfileName,
  requiresFirstAccessProfile,
  resolveProfileDisplayName,
  resolveProfileNameFromMetadata,
  suggestProfileNameFromEmail,
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

  it("builds an editable first-access suggestion from the email", () => {
    expect(suggestProfileNameFromEmail("mariahthais2923@gmail.com")).toBe(
      "Mariah Thaís"
    );
    expect(suggestProfileNameFromEmail("ana.julia42@example.com")).toBe(
      "Ana Julia"
    );
  });

  it("only requires first access when no real profile name exists", () => {
    expect(
      requiresFirstAccessProfile({
        metadata: { full_name: "brabinha123" },
        email: "brabinha123@gmail.com",
      })
    ).toBe(true);
    expect(
      requiresFirstAccessProfile({
        metadata: { full_name: "Ana Júlia" },
        email: "brabinha123@gmail.com",
      })
    ).toBe(false);
    expect(
      resolveProfileNameFromMetadata(
        { given_name: "Ana", family_name: "Júlia" },
        "brabinha123@gmail.com"
      )
    ).toBe("Ana Júlia");
  });

  it("does not let the first-access form confirm the email username", () => {
    expect(
      getFirstAccessProfileNameValidationError(
        "brabinha123",
        "brabinha123@gmail.com"
      )
    ).toBe("Use seu nome, não o nome do e-mail.");
  });
});
