import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { readTagUid, stopScan } from "./nfc";
import { NFC_ERRORS } from "./nfc-errors";
import { emptyNfcLoopState, nfcStateReducer } from "./nfc-state-machine";
import type { NfcScanResult } from "./nfc-types";

export type NfcContinuousState = "idle" | "scanning" | "paused";

type UseNfcContinuousScanOptions = {
  onTag: (result: NfcScanResult) => Promise<void> | void;
  onDuplicateTag?: (result: NfcScanResult) => void;
  onError?: (error: unknown) => void;
  loopDelayMs?: number;
  duplicateWindowMs?: number;
  perUidDedup?: boolean;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const shouldIgnoreContinuousScanError = (error: unknown) => {
  const code = (error as { code?: string } | null)?.code;
  return code === NFC_ERRORS.CANCELLED;
};

export function useNfcScanner() {
  const [scanning, setScanning] = useState(false);

  const scanOnce = useCallback(async () => {
    if (scanning) return null;
    setScanning(true);
    try {
      return await readTagUid();
    } finally {
      setScanning(false);
    }
  }, [scanning]);

  const cancelScan = useCallback(async () => {
    setScanning(false);
    await stopScan();
  }, []);

  return { scanning, scanOnce, cancelScan };
}

export function useNfcContinuousScan(options: UseNfcContinuousScanOptions) {
  const [loopState, setLoopState] = useState(() => emptyNfcLoopState());
  const runningRef = useRef(false);
  const busyRef = useRef(false);
  const loopStartedRef = useRef(false); // Prevent parallel loop instances
  const onTagRef = useRef(options.onTag);
  const onDuplicateTagRef = useRef(options.onDuplicateTag);
  const onErrorRef = useRef(options.onError);
  const loopDelayMs = options.loopDelayMs ?? 90;
  const duplicateWindowMs = Math.max(0, options.duplicateWindowMs ?? 5_000);
  const perUidDedup = options.perUidDedup ?? true;
  const loopStateRef = useRef(loopState);

  useEffect(() => {
    onTagRef.current = options.onTag;
  }, [options.onTag]);

  useEffect(() => {
    onDuplicateTagRef.current = options.onDuplicateTag;
  }, [options.onDuplicateTag]);

  useEffect(() => {
    onErrorRef.current = options.onError;
  }, [options.onError]);

  useEffect(() => {
    loopStateRef.current = loopState;
  }, [loopState]);

  const emitError = useCallback((error: unknown) => {
    if (shouldIgnoreContinuousScanError(error)) return;
    onErrorRef.current?.(error);
  }, []);

  const dispatch = useCallback(
    (event: Parameters<typeof nfcStateReducer>[1]) => {
      const previous = loopStateRef.current;
      const next = nfcStateReducer(previous, event, {
        duplicateWindowMs,
        perUidDedup,
      });
      loopStateRef.current = next;
      setLoopState(next);
      return { previous, next };
    },
    [duplicateWindowMs, perUidDedup]
  );

  const loop = useCallback(async () => {
    if (loopStartedRef.current) return; // Prevent parallel instance
    loopStartedRef.current = true;
    let iterationCount = 0;

    try {
      while (runningRef.current) {
        iterationCount += 1;
        if (iterationCount % 100 === 0) {
          // Periodically yield to the event loop to reduce long-run pressure.
          await wait(0);
        }
        if (loopStateRef.current.status !== "scanning") {
          await wait(80);
          continue;
        }
        if (busyRef.current) {
          await wait(40);
          continue;
        }

        busyRef.current = true;
        try {
          const result = await readTagUid();
          if (!runningRef.current || loopStateRef.current.status !== "scanning") continue;
          const event = { type: "tag_read" as const, uid: result.uid };
          const { previous, next } = dispatch(event);
          const emitted = next.totalTagsRead > previous.totalTagsRead;
          if (!emitted) {
            onDuplicateTagRef.current?.(result);
            continue;
          }
          await onTagRef.current(result);
        } catch (error) {
          if (!runningRef.current) break;
          dispatch({ type: "tag_error", error });
          emitError(error);
        } finally {
          busyRef.current = false;
        }

        if (loopDelayMs > 0) {
          await wait(loopDelayMs);
        }
      }
    } finally {
      loopStartedRef.current = false; // Mark loop as stopped
    }
  }, [dispatch, emitError, loopDelayMs]);

  useEffect(() => {
    try {
       
      // @ts-ignore - attach debug helpers to globalThis for manual inspection
      if (!globalThis.__nfcDiagnostics) {
         
        // @ts-ignore
        globalThis.__nfcDiagnostics = {};
      }
       
      // @ts-ignore
      globalThis.__nfcDiagnostics.getNfcLoopState = () => ({
        running: runningRef.current,
        paused: loopStateRef.current.status === "paused",
        busy: busyRef.current,
        loopStarted: loopStartedRef.current,
        status: loopStateRef.current.status,
        totalTagsRead: loopStateRef.current.totalTagsRead,
        totalDuplicatesRejected: loopStateRef.current.totalDuplicatesRejected,
        totalErrors: loopStateRef.current.totalErrors,
      });
    } catch {
      // defensive: do not crash the hook if global attach fails
    }
    return () => {
      try {
         
        // @ts-ignore
        if (globalThis.__nfcDiagnostics?.getNfcLoopState) {
           
          // @ts-ignore
          delete globalThis.__nfcDiagnostics.getNfcLoopState;
        }
      } catch {
        // ignore cleanup failures
      }
    };
  }, []);

  const start = useCallback((_: string = "") => {
    if (runningRef.current) {
      dispatch({ type: "resume" });
      return;
    }
    runningRef.current = true;
    dispatch({ type: "start" });
    void loop();
  }, [dispatch, loop]);

  const pause = useCallback(async () => {
    if (!runningRef.current) return;
    dispatch({ type: "pause" });
    await stopScan();
  }, [dispatch]);

  const resume = useCallback(() => {
    if (!runningRef.current) {
      start();
      return;
    }
    dispatch({ type: "resume" });
  }, [dispatch, start]);

  const stop = useCallback(async () => {
    runningRef.current = false;
    dispatch({ type: "stop" });
    await stopScan();
  }, [dispatch]);

  useEffect(() => {
    return () => {
      runningRef.current = false;
      loopStartedRef.current = false;
      loopStateRef.current = emptyNfcLoopState();
      void stopScan();
    };
  }, []);

  const state = loopState.status;

  return useMemo(
    () => ({
      state,
      isScanning: state === "scanning",
      start,
      pause,
      resume,
      stop,
    }),
    [pause, resume, start, state, stop]
  );
}
