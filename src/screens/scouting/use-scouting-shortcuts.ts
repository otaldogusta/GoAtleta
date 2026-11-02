import { useEffect } from "react";

export function useScoutingShortcuts({ enabled, canUndo, canRedo, undo, redo }: {
  enabled: boolean; canUndo: boolean; canRedo: boolean; undo: () => void; redo: () => void;
}) {
  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.altKey || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])')) return;
      // Keep the browser from applying text undo outside the collector's fields.
      event.preventDefault(); event.stopPropagation();
      if (event.shiftKey) { if (canRedo) redo(); }
      else if (canUndo) undo();
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [enabled, canUndo, canRedo, undo, redo]);
}
