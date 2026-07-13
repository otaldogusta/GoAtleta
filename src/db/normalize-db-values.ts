export const normalizeOptionalDate = (value?: string | null) => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};
