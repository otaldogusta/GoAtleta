export const ACCOUNT_DELETION_CONFIRMATION = "EXCLUIR";

export const normalizeAccountDeletionConfirmation = (value: string) =>
  value.trim().toLocaleUpperCase("pt-BR");

export const isAccountDeletionConfirmationValid = (
  confirmationText: string,
) =>
  normalizeAccountDeletionConfirmation(confirmationText) ===
  ACCOUNT_DELETION_CONFIRMATION;
