type BrowserDraftGuard = {
  href: string;
  index?: number;
  onLeave: (navigate: () => void) => void;
};

let activeGuard: BrowserDraftGuard | null = null;
let restore: { guard: BrowserDraftGuard; delta: number } | null = null;

function entryIndex() {
  return (window as Window & { navigation?: { currentEntry?: { index: number } } }).navigation?.currentEntry?.index;
}

function protectBrowserDraft(event: PopStateEvent) {
  if (restore) {
    const pending = restore;
    restore = null;
    event.stopImmediatePropagation();
    if (activeGuard === pending.guard) {
      pending.guard.onLeave(() => {
        activeGuard = null;
        window.history.go(-pending.delta);
      });
    }
    return;
  }
  const guard = activeGuard;
  if (!guard || window.location.href === guard.href) return;
  const currentIndex = entryIndex();
  const delta = guard.index !== undefined && currentIndex !== undefined ? guard.index - currentIndex : 1;
  if (!delta) return;
  event.stopImmediatePropagation();
  restore = { guard, delta };
  window.history.go(delta);
}

// Install before Expo's history listener. A listener mounted inside the screen
// can be removed by Expo's synchronous route reset before it sees popstate.
if (typeof window !== "undefined") {
  window.addEventListener("popstate", protectBrowserDraft, true);
}

/** Opt in only while a focused settings screen has a draft or an active save. */
export function registerBrowserPendingEdits(onLeave: BrowserDraftGuard["onLeave"]) {
  if (typeof window === "undefined") return () => {};
  const guard = { href: window.location.href, index: entryIndex(), onLeave };
  activeGuard = guard;
  return () => { if (activeGuard === guard) activeGuard = null; };
}
