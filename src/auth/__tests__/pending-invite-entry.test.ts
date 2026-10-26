import { resolvePendingInviteEntry } from "../pending-invite-entry";

describe("pending invite entry", () => {
  it("accepts a staff invitation code", () => {
    expect(resolvePendingInviteEntry("abcd-efgh")).toEqual({ kind: "staff_code", code: "ABCD-EFGH" });
    expect(resolvePendingInviteEntry("ABCD-EFGH")).toEqual({
      kind: "staff_code",
      code: "ABCD-EFGH",
    });
  });

  it.each([
    ["https://goatleta.com/signup?role=trainer&inviteCode=ABCD-EFGH", "ABCD-EFGH"],
    ["https://goatleta.com/staff-invite?code=ABCD-EFGH", "ABCD-EFGH"],
    ["https://goatleta.com/staff-invite#code=abcd-efgh&token_hash=private&type=magiclink", "ABCD-EFGH"],
  ])("extracts a staff code from %s", (link, code) => {
    expect(resolvePendingInviteEntry(link)).toEqual({ kind: "staff_code", code });
  });

  it.each([
    "https://goatleta.com/invite/student-token",
    "https://goatleta.com/family-invite/family-token",
  ])("keeps a supported account-link route from %s", (link) => {
    expect(resolvePendingInviteEntry(link)).toEqual({
      kind: "route",
      href: new URL(link).pathname,
    });
  });

  it.each(["", "não é convite", "VAPO", "h212134", "https://example.com/login",
    "https://goatleta.com/staff-invite?code=ABCD-EFGH#code=IJKL-MNOP",
    "https://goatleta.com/signup?inviteCode=ABCD-EFGH&inviteCode=IJKL-MNOP"])(
    "rejects unsupported input %s",
    (input) => {
      expect(resolvePendingInviteEntry(input)).toBeNull();
    },
  );
});
