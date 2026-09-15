type NavigationGuard = (navigate: () => void) => void;

let activeGuard: NavigationGuard | null = null;

/** Register only while the owning screen is focused. */
export function registerPendingEditsNavigation(guard: NavigationGuard) {
  activeGuard = guard;
  return () => { if (activeGuard === guard) activeGuard = null; };
}

export function requestPendingEditsNavigation(navigate: () => void) {
  if (activeGuard) activeGuard(navigate);
  else navigate();
}
