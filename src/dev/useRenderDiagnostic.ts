/**
 * Render diagnostic hook — DEV ONLY.
 *
 * Usage:
 *   useRenderDiagnostic("MyComponent", { propA, propB });
 *
 * Logs committed renders in __DEV__ mode, without mutating render state.
 * Shows which tracked props changed since the previous commit.
 *
 * Set RENDER_DIAGNOSTICS_ENABLED = false to silence all output without
 * removing the call sites.
 */

import { useEffect, useRef } from "react";

const RENDER_DIAGNOSTICS_ENABLED = true;

export function useRenderDiagnostic(
  name: string,
  watchedProps?: Record<string, unknown>
): void {
  const renderCount = useRef(0);
  const prevProps = useRef<Record<string, unknown>>({});
  useEffect(() => {
    if (!__DEV__ || !RENDER_DIAGNOSTICS_ENABLED) return;
    const count = ++renderCount.current;
    const changed: string[] = [];
    if (watchedProps) {
      for (const key of Object.keys(watchedProps)) {
        if (prevProps.current[key] !== watchedProps[key]) changed.push(key);
      }
      prevProps.current = { ...watchedProps };
    }
    console.log(count === 1
      ? `[render] ${name} — mount (#1)`
      : `[render] ${name} — #${count} — ${changed.length ? `changed: ${changed.join(", ")}` : "(no tracked prop changed)"}`);
  });
}
