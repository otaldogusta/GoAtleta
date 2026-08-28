export type TrainingPlanWorkspaceExitIntent = "leave" | "replace";

export type TrainingPlanWorkspaceExitConfirmation = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  tone: "default" | "danger";
};

export function buildTrainingPlanWorkspaceExitConfirmation({
  intent,
  draftPersisted,
}: {
  intent: TrainingPlanWorkspaceExitIntent;
  draftPersisted: boolean;
}): TrainingPlanWorkspaceExitConfirmation {
  if (!draftPersisted) {
    return intent === "replace"
      ? {
          title: "Rascunho não salvo",
          message: "Se trocar agora, as alterações atuais serão descartadas.",
          confirmLabel: "Descartar e trocar",
          cancelLabel: "Continuar editando",
          tone: "danger",
        }
      : {
          title: "Rascunho não salvo",
          message: "Se sair agora, suas alterações poderão ser perdidas.",
          confirmLabel: "Sair sem salvar",
          cancelLabel: "Continuar editando",
          tone: "danger",
        };
  }

  return intent === "replace"
    ? {
        title: "Trocar de plano?",
        message: "O rascunho atual está salvo neste dispositivo. Ao trocar, ele será descartado.",
        confirmLabel: "Descartar e trocar",
        cancelLabel: "Continuar editando",
        tone: "danger",
      }
    : {
        title: "Sair do planejamento?",
        message: "Seu rascunho está salvo neste dispositivo e será restaurado quando você voltar.",
        confirmLabel: "Sair",
        cancelLabel: "Continuar editando",
        tone: "default",
      };
}
