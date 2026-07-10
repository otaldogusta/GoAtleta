import { buildWorkspaceScopeKey } from "../ai-workspace-context";

describe("AI workspace context", () => {
  test("isolates the same class identifier by active workspace", () => {
    expect(buildWorkspaceScopeKey("org_1", "class_1")).toBe("org_1:class_1");
    expect(buildWorkspaceScopeKey("org_2", "class_1")).toBe("org_2:class_1");
  });
});
