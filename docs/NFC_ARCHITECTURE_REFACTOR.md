NFC Architecture Refactor Proposal
====================================

Date: 2026-03-03
Status: Architectural Design (pre-implementation)

## Problem Statement

Current `useNfcContinuousScan` architecture (state management via Refs + loop):
- Relies on mutable refs (`runningRef`, `pausedRef`, `busyRef`, `loopStartedRef`) for state
- Loop-driven: continuous `readTagUid()` call with busy-wait on flags
- Race conditions possible on remount/unmount if promise chain breaks
- Difficult to reason about state transitions; hard to trace race condition paths
- GC cleanup (Map TTL) is bolt-on; not core design

## Root Cause: Synchronous State vs. Async Execution

The current design uses **synchronous mutable refs** to control an **async loop**. This is fragile:

```typescript
// Current approach (problematic):
const loopStartedRef = useRef(false);
const loop = useCallback(async () => {
  if (loopStartedRef.current) return;
  loopStartedRef.current = true;
  try {
    while (runningRef.current) { /* read and emit */ }
  } finally {
    loopStartedRef.current = false; // ← Relies on promise chain completing
  }
}, []);

// Risks:
// 1. If readTagUid() hangs forever, finally never runs → loopStartedRef stuck true
// 2. If remount happens during await, runningRef=false but loop() still running
// 3. busyRef state not guarded; can lead to concurrent reads (2x onTag calls)
```

## Proposed Architecture: Event-Driven State Machine

Replace loop-based approach with **event-driven state accumulator**:

```typescript
// Event-driven pattern (robust):
type NfcLoopEvent = 
  | { type: "start" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "stop" }
  | { type: "tag_read"; uid: string; error?: null }
  | { type: "tag_error"; error: unknown }
  | { type: "loop_timeout"; afterMs: number };

type NfcLoopState = {
  status: "idle" | "scanning" | "paused";
  activeLoopPromise: Promise<void> | null;
  lastEmitTime: number;
  scanCount: number;
};

// State accumulator (pure function):
const nfcStateReducer = (state: NfcLoopState, event: NfcLoopEvent): NfcLoopState => {
  switch (event.type) {
    case "start":
      return state.status === "idle" 
        ? { ...state, status: "scanning", activeLoopPromise: new Promise(...) }
        : state;
    case "pause":
      return state.status === "scanning"
        ? { ...state, status: "paused" }
        : state;
    case "stop":
      return { ...state, status: "idle", activeLoopPromise: null };
    case "tag_read":
      // Deduplicate at event level: compare uid + timestamp
      const elapsed = Date.now() - state.lastEmitTime;
      if (elapsed < DUPLICATE_WINDOW_MS) return state; // Ignore duplicate
      return { ...state, lastEmitTime: Date.now(), scanCount: state.scanCount + 1 };
    default:
      return state;
  }
};
```

## Key Improvements

1. **Centralized state machine**: All transitions validated in reducer, no scattered ref mutations
2. **Deduplication at event level**: Not in cache Map; cleaner and more predictable
3. **Timeout-aware loops**: Each loop iteration sets a watchdog timer; if no event within N seconds, emit loop_timeout
4. **Promise-based lifecycle**: activeLoopPromise tracked; no ref-dependent finally blocks
5. **Remount resilience**: If component unmounts, old promise continues but no state updates (via cleanup)

## Migration Path (3-step)

### Step 1: Add event enum and reducer (non-breaking)
- Define `NfcLoopEvent`, `NfcLoopState`, `nfcStateReducer` in new file `src/nfc/nfc-state-machine.ts`
- Keep existing useNfcContinuousScan momentarily; add reducer as separate utility
- Test: unit tests for reducer state transitions (no RN runtime needed)

### Step 2: Migrate hook to use reducer (semi-breaking within hook)
- Refactor `useNfcContinuousScan` to dispatch events instead of mutating refs
- Update onTag/onError callbacks to emit events
- Add watchdog timer: if no reads for 30s and status="scanning", emit loop_timeout
- Keep same hook signature (no external breaking change)

### Step 3: Simplify dedup logic
- Remove `recentScanByUidRef` Map (GC no longer needed)
- Store deduplicate state in machine: `lastTagUid` + `lastEmitTime`
- Remove `cache_gc_cleanup` logs (no longer necessary)

## Expected Outcomes

| Metric | Before | After | Benefit |
|--------|--------|-------|---------|
| State mutation points | 4 refs + loop logic | 1 reducer + dispatch | Easier to audit, trace, test |
| Race conditions (remount) | Possible (ref stuck) | Eliminated (promise-aware) | Production stability |
| Memory (recentScanByUidRef) | Unbounded → GC cleanup | Bounded by state (2 fields) | Simpler GC, predictable RAM |
| Test coverage for state | 0 (mutation hidden in hook) | 100% (pure reducer) | Regression-proof |
| Dedup latency | Checked in handler (depends on handler speed) | Instant (event-level check) | Faster response to duplicates |

## Implementation Estimate

- **Step 1**: ~1.5h (types + reducer + unit tests)
- **Step 2**: ~2h (hook refactor + integration tests)
- **Step 3**: ~30min (cleanup)
- **Total**: ~4h elapsed

Risk: Medium (hook signature stable, but internal behavior changes; thorough testing required)

## Pseudo-code: New Loop Structure

```typescript
const startLoop = useCallback(async () => {
  const watchdog = setTimeout(() => {
    dispatch({ type: "loop_timeout", afterMs: 30_000 });
  }, 30_000);

  try {
    while (state.status === "scanning") {
      if (state.status === "paused") {
        clearTimeout(watchdog);
        await new Promise(r => setTimeout(r, 500));
        continue;
      }

      try {
        const result = await readTagUid();
        clearTimeout(watchdog);
        dispatch({ type: "tag_read", uid: result.uid });
        onTagRef.current?.(result);

        watchdog = setTimeout(() => dispatch(...), 30_000);
      } catch (error) {
        dispatch({ type: "tag_error", error });
      }

      await wait(loopDelayMs);
    }
  } finally {
    clearTimeout(watchdog);
    dispatch({ type: "stop" });
  }
}, [state]);
```

## Recommendation

**Priority: Medium-High**
- Do not block current releases (PR-A & PR-C are stable patches)
- Plan for Sprint N+1 (after validation of PR-A & PR-C in production)
- Start with Step 1 (pure reducer) to build confidence via unit tests
- Pair with stress-test validation (run tests before/after refactor)

## Open Questions for Team

1. Should dedup window be per-UID or global? (Current: global; proposed: per-UID in state machine)
2. Should retry logic live in state machine or in hook callback?
3. Should we log state transitions to Sentry for debugging?
