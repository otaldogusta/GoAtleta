/**
 * nfc-state-machine.ts
 * Event-driven NFC loop state management.
 * Pure function reducer for deterministic state transitions.
 */

export type NfcLoopEvent =
  | { type: "start" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "stop" }
  | { type: "tag_read"; uid: string }
  | { type: "tag_error"; error: unknown }
  | { type: "loop_timeout"; afterMs: number };

export type NfcLoopState = {
  /** Current scanning status */
  status: "idle" | "scanning" | "paused";

  /** Internal: timestamp of last emitted tag for deduplication */
  lastTagEmitTime: number;

  /** Internal: UID of last emitted tag (optional: per-uid dedup) */
  lastTagUid: string | null;

  /** Diagnostics: total tags read */
  totalTagsRead: number;

  /** Diagnostics: total duplicate rejections */
  totalDuplicatesRejected: number;

  /** Diagnostics: total errors */
  totalErrors: number;

  /** Active loop watchdog timeout ID (if any) */
  activeWatchdogId: ReturnType<typeof setTimeout> | null;
};

export const emptyNfcLoopState = (): NfcLoopState => ({
  status: "idle",
  lastTagEmitTime: 0,
  lastTagUid: null,
  totalTagsRead: 0,
  totalDuplicatesRejected: 0,
  totalErrors: 0,
  activeWatchdogId: null,
});

/**
 * Pure reducer: given current state and event, return new state.
 * No side effects; deterministic.
 */
export const nfcStateReducer = (
  state: NfcLoopState,
  event: NfcLoopEvent,
  opts?: { duplicateWindowMs?: number; perUidDedup?: boolean }
): NfcLoopState => {
  const duplicateWindowMs = opts?.duplicateWindowMs ?? 5_000;
  const perUidDedup = opts?.perUidDedup ?? false;

  switch (event.type) {
    case "start":
      // Only transition to scanning if idle
      if (state.status === "idle") {
        return {
          ...state,
          status: "scanning",
          lastTagEmitTime: 0,
          lastTagUid: null,
        };
      }
      return state;

    case "pause":
      // Only pause if scanning
      if (state.status === "scanning") {
        return { ...state, status: "paused" };
      }
      return state;

    case "resume":
      // Only resume if paused
      if (state.status === "paused") {
        return { ...state, status: "scanning" };
      }
      return state;

    case "stop":
      // Stop from any state
      return {
        ...state,
        status: "idle",
        lastTagEmitTime: 0,
        lastTagUid: null,
      };

    case "tag_read":
      // Only process if scanning (not paused)
      if (state.status !== "scanning") {
        return state;
      }

      const now = Date.now();
      const timeSinceLastEmit = now - state.lastTagEmitTime;
      const isDuplicate =
        timeSinceLastEmit < duplicateWindowMs &&
        (!perUidDedup || state.lastTagUid === event.uid);

      if (isDuplicate) {
        return {
          ...state,
          totalDuplicatesRejected: state.totalDuplicatesRejected + 1,
        };
      }

      return {
        ...state,
        lastTagEmitTime: now,
        lastTagUid: event.uid,
        totalTagsRead: state.totalTagsRead + 1,
      };

    case "tag_error":
      return {
        ...state,
        totalErrors: state.totalErrors + 1,
      };

    case "loop_timeout":
      // Timeout is informational; no state change
      // Caller should decide: emit warning log, continue loop, or stop
      return state;

    default:
      return state;
  }
};

/**
 * Select whether a tag_read event should be emitted to listeners.
 * Returns true if event passed dedup check.
 */
export const shouldEmitTagRead = (
  state: NfcLoopState,
  event: Extract<NfcLoopEvent, { type: "tag_read" }>,
  duplicateWindowMs: number
): boolean => {
  const newState = nfcStateReducer(state, event, { duplicateWindowMs });
  return newState.totalTagsRead > state.totalTagsRead;
};
