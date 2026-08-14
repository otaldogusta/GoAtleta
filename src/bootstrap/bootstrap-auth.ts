type BootstrapSessionData<TSession> = {
  session?: TSession | null;
};

export function resolveBootstrapInitialSession<TSession>(
  data: BootstrapSessionData<TSession> | null,
) {
  return data ? data.session ?? null : undefined;
}
