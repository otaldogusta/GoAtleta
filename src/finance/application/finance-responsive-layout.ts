type FinanceScrollPaddingInput = {
  usesWorkspaceShell: boolean;
  bottomInset: number;
};

const normalizeInset = (value: number) =>
  Number.isFinite(value) ? Math.max(0, value) : 0;

export const resolveFinanceScrollBottomPadding = ({
  usesWorkspaceShell,
  bottomInset,
}: FinanceScrollPaddingInput) => {
  const safeBottomInset = normalizeInset(bottomInset);

  if (usesWorkspaceShell) {
    return Math.max(24, safeBottomInset + 24);
  }

  return Math.max(148, safeBottomInset + 132);
};
