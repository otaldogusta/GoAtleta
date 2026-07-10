import {
  AIWorkspaceScopeError,
  requireActiveWorkspaceId,
} from "../../_shared/ai-workspace-scope";

describe("AI workspace scope", () => {
  test("accepts the explicit active workspace when membership allows it", () => {
    expect(requireActiveWorkspaceId("org_2", ["org_1", "org_2"])).toBe("org_2");
  });

  test("never falls back to the first membership when workspace is missing", () => {
    expect(() => requireActiveWorkspaceId("", ["org_1", "org_2"])).toThrow(
      expect.objectContaining<Partial<AIWorkspaceScopeError>>({
        status: 400,
        code: "MISSING_WORKSPACE_CONTEXT",
      })
    );
  });

  test("rejects a workspace outside the user memberships", () => {
    expect(() => requireActiveWorkspaceId("org_3", ["org_1", "org_2"])).toThrow(
      expect.objectContaining<Partial<AIWorkspaceScopeError>>({
        status: 403,
        code: "WORKSPACE_ACCESS_DENIED",
      })
    );
  });
});
