import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { NFC_ERRORS } from "./nfc-errors";
import { readTagUid, stopScan } from "./nfc";
import type { NfcScanResult } from "./nfc-types";

export type NfcContinuousState = "idle" | "scanning" | "paused";

type UseNfcContinuousScanOptions = {
  onTag: (result: NfcScanResult) => Promise<void> | void;
  onError?: (error: unknown) => void;
  loopDelayMs?: number;
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
  const [state, setState] = useState<NfcContinuousState>("idle");
  const runningRef = useRef(false);
  const pausedRef = useRef(false);
  const busyRef = useRef(false);
  const onTagRef = useRef(options.onTag);
  const onErrorRef = useRef(options.onError);
  const loopDelayMs = options.loopDelayMs ?? 90;

  useEffect(() => {
    onTagRef.current = options.onTag;
  }, [options.onTag]);

  useEffect(() => {
    onErrorRef.current = options.onError;
  }, [options.onError]);

  const emitError = useCallback((error: unknown) => {
    if (shouldIgnoreContinuousScanError(error)) return;
    onErrorRef.current?.(error);
  }, []);

  const loop = useCallback(async () => {
    while (runningRef.current) {
      if (pausedRef.current) {
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
        if (!runningRef.current || pausedRef.current) continue;
        await onTagRef.current(result);
      } catch (error) {
        if (!runningRef.current) break;
        emitError(error);
      } finally {
        busyRef.current = false;
      }

      if (loopDelayMs > 0) {
        await wait(loopDelayMs);
      }
    }
  }, [emitError, loopDelayMs]);

  const start = useCallback((_: string = "") => {
    if (runningRef.current) {
      pausedRef.current = false;
      setState("scanning");
      return;
    }
    runningRef.current = true;
    pausedRef.current = false;
    setState("scanning");
    void loop();
  }, [loop]);

  const pause = useCallback(async () => {
    if (!runningRef.current) return;
    pausedRef.current = true;
    setState("paused");
    await stopScan();
  }, []);

  const resume = useCallback(() => {
    if (!runningRef.current) {
      start();
      return;
    }
    pausedRef.current = false;
    setState("scanning");
  }, [start]);

  const stop = useCallback(async () => {
    runningRef.current = false;
    pausedRef.current = false;
    setState("idle");
    await stopScan();
  }, []);

  useEffect(() => {
    return () => {
      runningRef.current = false;
      pausedRef.current = false;
      void stopScan();
    };
  }, []);

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
