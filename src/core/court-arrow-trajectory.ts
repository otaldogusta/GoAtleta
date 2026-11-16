/** World-space heights in metres; X/Z remain owned by the authored 2D shape. */
export type CourtTrajectoryHandleKind = "start" | "middle" | "end";
export type CourtTrajectoryHeights = Record<CourtTrajectoryHandleKind, number>;
export const COURT_TRAJECTORY_MAX_HEIGHT = 8.12;
export const COURT_TRAJECTORY_FLOOR_HEIGHT = .025;
export const COURT_TRAJECTORY_HANDLES: readonly CourtTrajectoryHandleKind[] = ["start", "middle", "end"];
export const isCourtTrajectoryHeight = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= COURT_TRAJECTORY_MAX_HEIGHT;

export function parseCourtTrajectoryHeights(value: unknown): CourtTrajectoryHeights | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const candidate = value as Record<string, unknown>;
  if (Object.keys(candidate).some(key => !COURT_TRAJECTORY_HANDLES.includes(key as CourtTrajectoryHandleKind)) || !COURT_TRAJECTORY_HANDLES.every(key => isCourtTrajectoryHeight(candidate[key]))) return undefined;
  return { start: candidate.start as number, middle: candidate.middle as number, end: candidate.end as number };
}

/** Missing metadata retains the previous straight height profile, including ball anchors. */
export function courtTrajectoryHeights(value: unknown, linkedStart?: number): CourtTrajectoryHeights {
  const stored = parseCourtTrajectoryHeights(value);
  const start = isCourtTrajectoryHeight(linkedStart) ? linkedStart : stored?.start ?? COURT_TRAJECTORY_FLOOR_HEIGHT;
  const end = stored?.end ?? COURT_TRAJECTORY_FLOOR_HEIGHT;
  return { start, middle: stored?.middle ?? (start + end) / 2, end };
}

/** The middle is on the path. Clamp samples too: three bounded grips can overshoot. */
export function courtTrajectoryHeightAt(heights: CourtTrajectoryHeights, fraction: number): number {
  const u = Math.max(0, Math.min(1, fraction));
  const y = heights.start * (1 - u) + heights.end * u + 4 * u * (1 - u) * (heights.middle - (heights.start + heights.end) / 2);
  return Math.max(0, Math.min(COURT_TRAJECTORY_MAX_HEIGHT, y));
}
