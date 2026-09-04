import { getStudentLoginAccessLabel } from "../student-login-access";

it.each([
  ["user", "", "Acesso vinculado"],
  [null, "athlete@example.test", "Acesso não vinculado"],
  [null, " ", "Sem e-mail de acesso"],
  [undefined, "athlete@example.test", "Acesso não verificado"],
])("does not confuse membership or an email with login access", (studentUserId, loginEmail, expected) => {
  expect(getStudentLoginAccessLabel({ studentUserId, loginEmail: loginEmail as string })).toBe(expected);
});

it("keeps mobile labels short without changing their meaning", () => {
  expect(getStudentLoginAccessLabel({ studentUserId: null, loginEmail: "email" }, true)).toBe("Sem acesso");
  expect(getStudentLoginAccessLabel({ studentUserId: "user", loginEmail: "email" }, true)).toBe("Com acesso");
});
