export const normalizeAccountDeletionEmail = (value: string) =>
  value.trim().toLowerCase();

export const isAccountDeletionConfirmationValid = (
  confirmationEmail: string,
  accountEmail: string | null | undefined,
) => {
  const normalizedAccountEmail = normalizeAccountDeletionEmail(accountEmail ?? "");
  return Boolean(
    normalizedAccountEmail &&
      normalizeAccountDeletionEmail(confirmationEmail) === normalizedAccountEmail,
  );
};
