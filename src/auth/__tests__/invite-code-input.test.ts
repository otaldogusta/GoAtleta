import { normalizeInviteCodeInput } from "../invite-code-input";

describe("invite code input", () => {
  it.each([
    " abcd-efgh ",
    "https://goatleta.com/staff-invite#code=abcd-efgh&token_hash=fake-proof&type=magiclink&email=test%40example.com",
    "HTTPS://GOATLETA.COM/STAFF-INVITE#CODE=ABCD-EFGH&TOKEN_HASH=FAKE",
    "/staff-invite?code=abcd-efgh",
    "/staff-invite/#code=abcd%2Defgh",
    "https://goatleta.com/signup?role=trainer&inviteCode=abcd-efgh",
    "HTTPS://GOATLETA.COM/SIGNUP?ROLE=TRAINER&INVITECODE=ABCD-EFGH",
    "/signup?inviteCode=abcd%2Defgh&role=trainer",
    `https://goatleta.com/signup?extra=${"x".repeat(200)}&inviteCode=ABCD-EFGH`,
  ])("extracts the code from %s", (input) => {
    expect(normalizeInviteCodeInput(input)).toBe("ABCD-EFGH");
  });
  it.each([
    "https://goatleta.com/signup?role=trainer",
    "/staff-invite#code=ABCD-EFGH&code=IJKL-MNOP",
    "/staff-invite?code=ABCD-EFGH#code=IJKL-MNOP",
    "/staff-invite#token_hash=fake-proof",
    "/staff-invite#code=%3Cscript%3E",
    "/login#code=ABCD-EFGH",
    "https://goatleta.com/signup?inviteCode=",
    "https://goatleta.com/signup?inviteCode=ABCD-EFGH&inviteCode=IJKL-MNOP",
    "https://goatleta.com/signup?inviteCode=%3Cscript%3E",
  ])("does not turn malformed or ambiguous links into accepted codes", (input) => {
    expect(normalizeInviteCodeInput(input)).toBe(input.toUpperCase());
  });
});
