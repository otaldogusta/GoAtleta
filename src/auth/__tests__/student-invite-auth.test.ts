import {
  canSubmitStudentInviteAuth,
  getStudentInviteAuthValidationMessage,
} from "../student-invite-auth";

describe("student invite auth form", () => {
  it("requires a matching password confirmation before signup", () => {
    const base = {
      mode: "signup" as const,
      email: "atleta@example.com",
      password: "Senha1",
    };

    expect(canSubmitStudentInviteAuth({ ...base, confirm: "" })).toBe(false);
    expect(canSubmitStudentInviteAuth({ ...base, confirm: "Outra1" })).toBe(false);
    expect(canSubmitStudentInviteAuth({ ...base, confirm: "Senha1" })).toBe(true);
  });

  it("returns a specific message when confirmation is missing", () => {
    expect(
      getStudentInviteAuthValidationMessage({
        mode: "signup",
        email: "atleta@example.com",
        password: "Senha1",
        confirm: "",
      })
    ).toBe("Confirme sua senha.");
  });

  it("does not require password confirmation for login", () => {
    expect(
      canSubmitStudentInviteAuth({
        mode: "login",
        email: "atleta@example.com",
        password: "senha-existente",
        confirm: "",
      })
    ).toBe(true);
  });
});
