import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const signupSource = ["SignupScreen.tsx", "SignupInviteCode.tsx"]
  .map((file) => readFileSync(resolve(__dirname, "../../screens/auth", file), "utf8"))
  .join("\n");

describe("signup input focus contract", () => {
  it("suppresses the inner web outline on every signup input", () => {
    expect(signupSource.match(/outlineStyle: "none"/g)).toHaveLength(4);
    expect(signupSource.match(/borderRadius: 0/g)?.length).toBeGreaterThanOrEqual(4);
  });
});
