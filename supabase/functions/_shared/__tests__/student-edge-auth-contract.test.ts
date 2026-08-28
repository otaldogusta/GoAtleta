import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(__dirname, path), "utf8");

const configSource = read("../../../config.toml");
const authMiddlewareSource = read("../middlewares/auth.ts");
const frameworkSource = read("../framework.ts");

const functionSources = {
  create: read("../../create-student-invite/index.ts"),
  claim: read("../../claim-student-invite/index.ts"),
  list: read("../../list-student-invites/index.ts"),
  revokeInvite: read("../../revoke-student-invite/index.ts"),
  revokeAccess: read("../../revoke-student-access/index.ts"),
};

const studentFunctions = [
  "create-student-invite",
  "claim-student-invite",
  "list-student-invites",
  "revoke-student-invite",
  "revoke-student-access",
];

describe("student Edge Function authentication contract", () => {
  test("lets ES256 bearer tokens reach handlers for in-function verification", () => {
    for (const functionName of studentFunctions) {
      expect(configSource).toMatch(
        new RegExp(
          `\\[functions\\.${functionName}\\]\\s+verify_jwt\\s*=\\s*false`
        )
      );
    }
  });

  test("cryptographically validates manual handlers through Supabase Auth", () => {
    expect(authMiddlewareSource).toContain(
      "await authClient.auth.getUser(token)"
    );

    for (const source of [
      functionSources.create,
      functionSources.claim,
      functionSources.revokeInvite,
      functionSources.revokeAccess,
    ]) {
      expect(source).toContain("await authenticateRequest(req)");
      expect(source).not.toContain("atob(");
      expect(source).not.toContain('token.split(".")');
    }
  });

  test("keeps list authentication on the verified shared framework path", () => {
    expect(functionSources.list).toContain("createEdgeFunction");
    expect(functionSources.list).toContain("requireAuth: true");
    expect(frameworkSource).toContain(
      "validateAuth(supabase, token, !!config.requireAuth)"
    );
    expect(authMiddlewareSource).toContain(
      "await supabase.auth.getUser(token)"
    );
  });
});
