type PermissionsLoadingState = {
  currentRequestKey: string;
  resolvedRequestKey: string;
  fetchLoading: boolean;
};

export function resolvePermissionsLoading({
  currentRequestKey,
  resolvedRequestKey,
  fetchLoading,
}: PermissionsLoadingState) {
  return Boolean(currentRequestKey) && (
    fetchLoading || resolvedRequestKey !== currentRequestKey
  );
}
