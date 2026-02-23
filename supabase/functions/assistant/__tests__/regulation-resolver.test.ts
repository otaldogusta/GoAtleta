import { resolveRegulationAssistantResponse } from "../regulation-resolver";

describe("regulation resolver", () => {
  test("returns null for non-regulation prompts", async () => {
    const response = await resolveRegulationAssistantResponse({
      token: "token",
      organizationId: "org_1",
      sportHint: "volleyball",
      messages: [{ role: "user", content: "Monte um treino de saque para hoje." }],
      appSnapshot: null,
    });

    expect(response).toBeNull();
  });

  test("returns deterministic lacuna when organization is missing", async () => {
    const response = await resolveRegulationAssistantResponse({
      token: "token",
      organizationId: "",
      sportHint: "volleyball",
      messages: [{ role: "user", content: "Qual regra vale no proximo torneio?" }],
      appSnapshot: { contextTitle: "Eventos" },
    });

    expect(response).not.toBeNull();
    expect(response?.missingData.length).toBeGreaterThan(0);
    expect(response?.reply.toLowerCase()).toContain("dados insuficientes");
  });
});
