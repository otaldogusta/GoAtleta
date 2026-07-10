import {
  buildInstitutionalScopeId,
  buildWorkspaceScopeKey,
} from "../ai-workspace-context";

describe("AI workspace context", () => {
  test("isolates the same class identifier by active workspace", () => {
    expect(buildWorkspaceScopeKey("org_1", "class_1")).toBe("org_1:class_1");
    expect(buildWorkspaceScopeKey("org_2", "class_1")).toBe("org_2:class_1");
  });

  test("builds stable program and modality interpretation scopes", () => {
    expect(buildInstitutionalScopeId({
      scopeType: "program",
      unitId: "u_123",
      unitLabel: "Rede Esperança",
    })).toBe("unit:u_123");
    expect(buildInstitutionalScopeId({
      scopeType: "modality",
      modality: "Natação",
    })).toBe("modality:natacao");
  });
});
