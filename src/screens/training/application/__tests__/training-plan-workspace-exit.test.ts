import { buildTrainingPlanWorkspaceExitConfirmation } from "../training-plan-workspace-exit";

describe("training plan workspace exit confirmation", () => {
  it("only says the draft is saved after persistence succeeds", () => {
    expect(
      buildTrainingPlanWorkspaceExitConfirmation({
        intent: "leave",
        draftPersisted: true,
      })
    ).toEqual({
      title: "Sair do planejamento?",
      message: "Seu rascunho está salvo neste dispositivo e será restaurado quando você voltar.",
      confirmLabel: "Sair",
      cancelLabel: "Continuar editando",
      tone: "default",
    });

    expect(
      buildTrainingPlanWorkspaceExitConfirmation({
        intent: "replace",
        draftPersisted: true,
      }).message
    ).toContain("está salvo neste dispositivo");
  });

  it("warns about loss when leaving or replacing after persistence fails", () => {
    expect(
      buildTrainingPlanWorkspaceExitConfirmation({
        intent: "leave",
        draftPersisted: false,
      })
    ).toEqual({
      title: "Rascunho não salvo",
      message: "Se sair agora, suas alterações poderão ser perdidas.",
      confirmLabel: "Sair sem salvar",
      cancelLabel: "Continuar editando",
      tone: "danger",
    });

    expect(
      buildTrainingPlanWorkspaceExitConfirmation({
        intent: "replace",
        draftPersisted: false,
      })
    ).toEqual({
      title: "Rascunho não salvo",
      message: "Se trocar agora, as alterações atuais serão descartadas.",
      confirmLabel: "Descartar e trocar",
      cancelLabel: "Continuar editando",
      tone: "danger",
    });
  });
});
