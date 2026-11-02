import type { ScoutingWorkspaceProps } from './ScoutingWorkspace.types';
// perf-check: ignore-render -- Native fallback returns null; the native collector owns its rendering.
// perf-check: ignore-measure -- No imports or data load in this web-only workspace fallback.
export default function ScoutingWorkspace(_props:ScoutingWorkspaceProps) { return null; }
