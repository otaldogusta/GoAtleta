import {
  buildInstitutionalProfilePrompt,
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

    expect(prompt).toContain("Weights change emphasis, never facts");
    expect(prompt).toContain("governance");
    expect(prompt).toContain("readiness");
  });
});
