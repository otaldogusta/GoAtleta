import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const signupSource = readFileSync(
  resolve(__dirname, "../../screens/auth/SignupScreen.tsx"),
  "utf8",
);

describe("signup input focus contract", () => {
  it("suppresses the inner web outline on every signup input", () => {
    expect(signupSource.match(/outlineStyle: "none"/g)).toHaveLength(4);
    expect(signupSource.match(/borderRadius: 0/g)?.length).toBeGreaterThanOrEqual(4);
  });
});
