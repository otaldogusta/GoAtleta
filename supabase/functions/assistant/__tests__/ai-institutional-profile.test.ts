import {
  buildModalityScopeId,
  buildInstitutionalProfilePrompt,
  resolveHierarchicalInstitutionalProfile,
  resolveInstitutionalProfile,
} from "../../_shared/ai-institutional-profile";

describe("AI institutional profile", () => {
  test("normalizes configured weights and clamps unsafe values", () => {
    const profile = resolveInstitutionalProfile("Rede Esperança", {
      organization_type: "social_project",
      priorities: ["participacao", "cooperacao"],
      pedagogical_bias: ["sociocultural"],
      pillar_weights: {
        attendance: 1.2,
        individual_context: 4,
        reports: 0.1,
      },
    });

    expect(profile.organizationType).toBe("social_project");
    expect(profile.pillarWeights.attendance).toBe(1.2);
    expect(profile.pillarWeights.individual_context).toBe(1.5);
    expect(profile.pillarWeights.reports).toBe(0.5);
    expect(profile.pillarWeights.periodization).toBe(1);
  });

  test("makes evidence and governance precedence explicit in the prompt", () => {
    const prompt = buildInstitutionalProfilePrompt(
      resolveInstitutionalProfile("Workspace sem perfil")
    );

    expect(prompt).toContain("never authorization or facts");
    expect(prompt).toContain("governance");
    expect(prompt).toContain("readiness");
    expect(prompt).toContain("workspace determines which data you may access");
  });

  test("merges workspace, program, modality and class without replacing absent fields", () => {
    const profile = resolveHierarchicalInstitutionalProfile({
      organizationName: "Gustavo Workspace",
      classContext: {
        id: "c_1",
        unitId: "u_rede",
        unit: "Rede Esperança",
        modality: "voleibol",
      },
      rows: [
        {
          scope_type: "workspace",
          scope_id: "workspace:org_1",
          scope_label: "Gustavo Workspace",
          organization_type: "multi_context",
          pillar_weights: { reports: 1 },
          active: true,
        },
        {
          scope_type: "program",
          scope_id: "unit:u_rede",
          scope_label: "Rede Esperança",
          organization_type: "social_project",
          priorities: ["participacao"],
          pillar_weights: { attendance: 1.2, periodization: 0.9 },
          active: true,
        },
        {
          scope_type: "modality",
          scope_id: "modality:voleibol",
          scope_label: "Voleibol",
          pillar_weights: { physical_load: 1.1 },
          active: true,
        },
        {
          scope_type: "class",
          scope_id: "class:c_1",
          scope_label: "Turma 8-11",
          pillar_weights: { individual_context: 1.3 },
          active: true,
        },
      ],
    });

    expect(profile.organizationType).toBe("social_project");
    expect(profile.priorities).toEqual(["participacao"]);
    expect(profile.pillarWeights.reports).toBe(1);
    expect(profile.pillarWeights.attendance).toBe(1.2);
    expect(profile.pillarWeights.periodization).toBe(0.9);
    expect(profile.pillarWeights.physical_load).toBe(1.1);
    expect(profile.pillarWeights.individual_context).toBe(1.3);
    expect(profile.appliedScopes.map((scope) => scope.scopeType)).toEqual([
      "workspace",
      "program",
      "modality",
      "class",
    ]);
  });

  test("keeps a future swimming profile addressable without a registered class", () => {
    expect(buildModalityScopeId("Natação")).toBe("modality:natacao");
  });
});
