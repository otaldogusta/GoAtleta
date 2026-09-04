import { parseStaffInviteFragment } from "../staff-invite-link";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("staff invite entry", () => {
  it("accepts only email authentication proof, not a bare invite or recovery", () => {
    const hash = "a".repeat(64);
    expect(parseStaffInviteFragment(`#code=TEST-CODE&token_hash=${hash}&type=magiclink`)).toEqual({ code: "TEST-CODE", token_hash: hash, type: "magiclink" });
    expect(parseStaffInviteFragment("#code=TEST-CODE")).toBeNull();
    expect(parseStaffInviteFragment(`#code=TEST-CODE&token_hash=${hash}&type=recovery`)).toBeNull();
  });
  it("does not approve an invitation merely because a role already exists", () => {
    const pending = readFileSync(resolve(__dirname, "../../../app/pending.tsx"), "utf8");
    expect(pending).not.toContain("if (resolvedRoleHome || accessApproved)");
    expect(pending).toContain("await claimTrainerInvite(code);\n      setAccessApproved(true);");
  });
});
