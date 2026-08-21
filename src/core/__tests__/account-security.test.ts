import {
  getPasswordChangeValidationError,
  getSecurityContactEmailValidationError,
  normalizeSecurityContactEmail,
} from "../account-security";

describe("account security", () => {
  it("normalizes an optional security contact email", () => {
    expect(normalizeSecurityContactEmail("  Apoio@Example.COM ")).toBe(
      "apoio@example.com",
    );
  });

  it("accepts an empty optional contact and rejects invalid or primary emails", () => {
    expect(getSecurityContactEmailValidationError("", "principal@example.com")).toBeNull();
    expect(getSecurityContactEmailValidationError("invalido", "principal@example.com")).toBe(
      "Informe um e-mail válido.",
    );
    expect(
      getSecurityContactEmailValidationError("PRINCIPAL@example.com", "principal@example.com"),
    ).toBe("Use um e-mail diferente do e-mail de acesso.");
  });

  it("validates password length, difference and confirmation", () => {
    expect(
      getPasswordChangeValidationError({
        currentPassword: "",
        newPassword: "curta",
        confirmation: "curta",
      }),
    ).toEqual({
      field: "newPassword",
      message: "A nova senha precisa ter pelo menos 8 caracteres.",
    });
    expect(
      getPasswordChangeValidationError({
        currentPassword: "SenhaAtual1!",
        newPassword: "SenhaAtual1!",
        confirmation: "SenhaAtual1!",
      }),
    ).toEqual({
      field: "newPassword",
      message: "A nova senha precisa ser diferente da atual.",
    });
    expect(
      getPasswordChangeValidationError({
        currentPassword: "SenhaAtual1!",
        newPassword: "NovaSenha1!",
        confirmation: "OutraSenha1!",
      }),
    ).toEqual({ field: "confirmation", message: "As senhas não conferem." });
    expect(
      getPasswordChangeValidationError({
        currentPassword: "SenhaAtual1!",
        newPassword: "NovaSenha1!",
        confirmation: "NovaSenha1!",
      }),
    ).toBeNull();
  });
});
