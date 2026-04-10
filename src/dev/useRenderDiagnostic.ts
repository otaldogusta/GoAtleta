/**
 * Render diagnostic hook — DEV ONLY.
 *
 * Usage:
 *   useRenderDiagnostic("MyComponent", { propA, propB });
 *
 * Logs to console every time a component re-renders in __DEV__ mode.
 * Shows WHICH prop changed and how many times the component has rendered.
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
  if (!__DEV__ || !RENDER_DIAGNOSTICS_ENABLED) return;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const renderCount = useRef(0);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const prevProps = useRef<Record<string, unknown>>({});

  renderCount.current += 1;
  const count = renderCount.current;

  const changed: string[] = [];
  if (watchedProps) {
    for (const key of Object.keys(watchedProps)) {
      if (prevProps.current[key] !== watchedProps[key]) {
        changed.push(key);
      }
    }
    prevProps.current = { ...watchedProps };
  }

  if (count === 1) {
    console.log(`[render] ${name} — mount (#1)`);
    return;
  }

  if (changed.length > 0) {
    console.log(`[render] ${name} — #${count} — changed: ${changed.join(", ")}`);
  } else {
    console.log(`[render] ${name} — #${count} — (no tracked prop changed)`);
  }
}
