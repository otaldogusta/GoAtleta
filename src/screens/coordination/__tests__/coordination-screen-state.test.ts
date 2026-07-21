import { resolveCoordinationScreenPhase } from "../coordination-screen-state";

describe("resolveCoordinationScreenPhase", () => {
  it("mantém o shimmer enquanto a organização ainda está sendo resolvida", () => {
    expect(
      resolveCoordinationScreenPhase({
        organizationLoading: true,
        organizationId: null,
        loadedOrganizationId: null,
        isAdmin: false,
      })
    ).toBe("loading");
  });

  it("não libera conteúdo antes de carregar os dados da organização ativa", () => {
    expect(
      resolveCoordinationScreenPhase({
        organizationLoading: false,
        organizationId: "org-atual",
        loadedOrganizationId: null,
        isAdmin: true,
      })
    ).toBe("loading");
  });

  it("mantém o shimmer ao trocar de organização", () => {
    expect(
      resolveCoordinationScreenPhase({
        organizationLoading: false,
        organizationId: "org-nova",
        loadedOrganizationId: "org-anterior",
        isAdmin: true,
      })
    ).toBe("loading");
  });

  it("libera a tela somente quando os dados correspondem à organização ativa", () => {
    expect(
      resolveCoordinationScreenPhase({
        organizationLoading: false,
        organizationId: "org-atual",
        loadedOrganizationId: "org-atual",
        isAdmin: true,
      })
    ).toBe("ready");
  });

  it("mantém a regra de acesso depois que a organização termina de carregar", () => {
    expect(
      resolveCoordinationScreenPhase({
        organizationLoading: false,
        organizationId: "org-atual",
        loadedOrganizationId: null,
        isAdmin: false,
      })
    ).toBe("forbidden");
  });
});
