import type { ConfirmDialogOptions } from "../../../ui/confirm-dialog";

type Options = {
  hasPeriodization: boolean;
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
  onConfigure: () => void;
};

export async function confirmPlanWithoutPeriodization({
  hasPeriodization,
  confirm,
  onConfigure,
}: Options): Promise<boolean> {
  if (hasPeriodization) return true;

  return confirm({
    title: "Sem periodização para esta data",
    message: "Gerar um plano básico com o perfil da turma ou configurar a periodização antes?",
    confirmLabel: "Gerar plano básico",
    cancelLabel: "Configurar periodização",
    tone: "default",
    onConfirm: () => {},
    onCancel: onConfigure,
  });
}
