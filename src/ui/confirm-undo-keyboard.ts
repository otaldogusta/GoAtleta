type KeyboardListenerHost = {
  addEventListener?: unknown;
  removeEventListener?: unknown;
};

export function supportsUndoKeyboardShortcut(
  platform: string,
  host: KeyboardListenerHost | null | undefined
) {
  return (
    platform === "web" &&
    typeof host?.addEventListener === "function" &&
    typeof host?.removeEventListener === "function"
  );
}
