import { normalizeInviteCodeInput } from "../invite-code-input";

describe("invite code input", () => {
  it.each([
    " abcd-efgh ",
    "https://goatleta.com/signup?role=trainer&inviteCode=abcd-efgh",
    "HTTPS://GOATLETA.COM/SIGNUP?ROLE=TRAINER&INVITECODE=ABCD-EFGH",
    "/signup?inviteCode=abcd%2Defgh&role=trainer",
    `https://goatleta.com/signup?extra=${"x".repeat(200)}&inviteCode=ABCD-EFGH`,
  ])("extracts the code from %s", (input) => {
    expect(normalizeInviteCodeInput(input)).toBe("ABCD-EFGH");
  });
  it.each([
    "https://goatleta.com/signup?role=trainer",
    "https://goatleta.com/signup?inviteCode=",
    "https://goatleta.com/signup?inviteCode=ABCD-EFGH&inviteCode=IJKL-MNOP",
    "https://goatleta.com/signup?inviteCode=%3Cscript%3E",
  ])("does not turn malformed or ambiguous links into accepted codes", (input) => {
    expect(normalizeInviteCodeInput(input)).toBe(input.toUpperCase());
  });
});
