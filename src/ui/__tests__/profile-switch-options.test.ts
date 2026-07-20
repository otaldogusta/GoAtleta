import { resolveVisibleProfileSwitchIds } from "../profile-switch-options";

describe("profile switch options", () => {
  test("mantém Coordenação para uma conta híbrida administradora", () => {
    expect(
      resolveVisibleProfileSwitchIds({
        hasHybridAccount: true,
        isOrgAdmin: true,
      }),
    ).toEqual(["professor", "admin", "student"]);
  });

  test("oculta Coordenação para uma conta híbrida sem nível administrativo", () => {
    expect(
      resolveVisibleProfileSwitchIds({
        hasHybridAccount: true,
        isOrgAdmin: false,
      }),
    ).toEqual(["professor", "student"]);
  });

  test("preserva todos os previews no fluxo local sem conta híbrida", () => {
    expect(
      resolveVisibleProfileSwitchIds({
        hasHybridAccount: false,
        isOrgAdmin: false,
      }),
    ).toEqual(["professor", "admin", "student"]);
  });
});
