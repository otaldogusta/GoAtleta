import {
  resolveAuthorizedProfileSwitchIds,
  resolveVisibleProfileSwitchIds,
} from "../profile-switch-options";

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

  test("não inventa perfis quando a conta não tem vínculos", () => {
    expect(
      resolveVisibleProfileSwitchIds({
        hasHybridAccount: false,
        isOrgAdmin: false,
      }),
    ).toEqual([]);
  });

  test("preserva Coordenação quando canUseDevPreview estiver ativo", () => {
    expect(
      resolveVisibleProfileSwitchIds({
        hasHybridAccount: true,
        isOrgAdmin: false,
        canUseDevPreview: true,
      }),
    ).toEqual(["professor", "admin", "student"]);
  });

  test("limita a troca real aos perfis autorizados pela conta", () => {
    expect(
      resolveAuthorizedProfileSwitchIds({
        hasTrainerRole: true,
        hasStudentRole: true,
        isOrgAdmin: false,
        canUseDevPreview: false,
      }),
    ).toEqual(["professor", "student"]);
  });

  test("inclui Coordenação somente para treinador administrador", () => {
    expect(
      resolveAuthorizedProfileSwitchIds({
        hasTrainerRole: true,
        hasStudentRole: false,
        isOrgAdmin: true,
        canUseDevPreview: false,
      }),
    ).toEqual(["professor", "admin"]);
  });

  test("inclui Família somente quando há vínculo confirmado pelo servidor", () => {
    expect(
      resolveAuthorizedProfileSwitchIds({
        hasTrainerRole: true,
        hasStudentRole: false,
        hasFamilyRole: true,
        isOrgAdmin: false,
        canUseDevPreview: false,
      }),
    ).toEqual(["professor", "family"]);
  });

  test("mantém a troca entre os três papéis reais da conta híbrida", () => {
    expect(
      resolveVisibleProfileSwitchIds({
        hasHybridAccount: true,
        hasTrainerRole: true,
        hasStudentRole: true,
        hasFamilyRole: true,
        isOrgAdmin: false,
      }),
    ).toEqual(["professor", "student", "family"]);
  });

  test("preserva os três perfis no preview local", () => {
    expect(
      resolveAuthorizedProfileSwitchIds({
        hasTrainerRole: false,
        hasStudentRole: false,
        isOrgAdmin: false,
        canUseDevPreview: true,
      }),
    ).toEqual(["professor", "student", "admin"]);
  });
});
