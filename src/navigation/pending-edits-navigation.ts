type NavigationGuard = (navigate: () => void, reason?: "refresh") => void;

let activeGuard: NavigationGuard | null = null;

/** Register only while the owning screen is focused. */
export function registerPendingEditsNavigation(guard: NavigationGuard) {
  activeGuard = guard;
  return () => { if (activeGuard === guard) activeGuard = null; };
}

export function requestPendingEditsNavigation(navigate: () => void, reason?: "refresh") {
  if (activeGuard) activeGuard(navigate, reason);
  else navigate();
}
