import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, AppStateStatus, Platform } from "react-native";

import { getBiometricsEnabled, setBiometricsEnabled } from "./biometric-settings";
import { promptBiometrics } from "./biometrics";

export const BIOMETRIC_FAILURE_LIMIT = 3;

export function shouldLockBiometricSession(params: {
  isNative: boolean;
  sessionActive: boolean;
  isEnabled: boolean;
}) {
  return params.isNative && params.sessionActive && params.isEnabled;
}

export function nextBiometricFailureState(previousAttempts: number) {
  const failedAttempts = previousAttempts + 1;
  return {
    failedAttempts,
    forceRelogin: failedAttempts >= BIOMETRIC_FAILURE_LIMIT,
  };
}

export function shouldRelockOnForeground(
  previous: AppStateStatus,
  next: AppStateStatus
) {
  return (previous === "background" || previous === "inactive") && next === "active";
}

type BiometricLockContextValue = {
  isEnabled: boolean;
  isUnlocked: boolean;
  isPrompting: boolean;
  failedAttempts: number;
  setEnabled: (enabled: boolean) => Promise<void>;
  lockNow: () => void;
  unlock: (reason: string) => Promise<boolean>;
  ensureUnlocked: (reason: string) => Promise<boolean>;
};

const BiometricLockContext = createContext<BiometricLockContextValue | null>(null);

export function BiometricLockProvider({
  children,
  sessionActive,
  onForceRelogin,
}: {
  children: React.ReactNode;
  sessionActive: boolean;
  onForceRelogin: () => Promise<void> | void;
}) {
  const isNative = Platform.OS !== "web";
  const [isEnabled, setIsEnabled] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(true);
  const [isPrompting, setIsPrompting] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const failedAttemptsRef = useRef(0);
  const skipNextAutoLockRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    let alive = true;
    (async () => {
      const enabled = await getBiometricsEnabled();
      if (!alive) return;
      setIsEnabled(enabled);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const shouldLock = shouldLockBiometricSession({
    isNative,
    sessionActive,
    isEnabled,
  });

  useEffect(() => {
    if (!shouldLock) {
      setIsUnlocked(true);
      setFailedAttempts(0);
      failedAttemptsRef.current = 0;
      return;
    }
    if (skipNextAutoLockRef.current) {
      skipNextAutoLockRef.current = false;
      return;
    }
    setIsUnlocked(false);
    setFailedAttempts(0);
    failedAttemptsRef.current = 0;
  }, [sessionActive, shouldLock]);

  const lockNow = useCallback(() => {
    if (!shouldLock) return;
    setIsUnlocked(false);
  }, [shouldLock]);

  const unlock = useCallback(
    async (reason: string): Promise<boolean> => {
      if (!shouldLock) {
        setIsUnlocked(true);
        return true;
      }
      if (isPrompting) return false;
      setIsPrompting(true);
      try {
        const result = await promptBiometrics(reason);
        if (result.success) {
          setFailedAttempts(0);
          failedAttemptsRef.current = 0;
          setIsUnlocked(true);
          return true;
        }
        const nextState = nextBiometricFailureState(failedAttemptsRef.current);
        failedAttemptsRef.current = nextState.failedAttempts;
        setFailedAttempts(nextState.failedAttempts);
        if (nextState.forceRelogin) {
          setFailedAttempts(0);
          failedAttemptsRef.current = 0;
          await onForceRelogin();
        }
        return false;
      } finally {
        setIsPrompting(false);
      }
    },
    [isPrompting, onForceRelogin, shouldLock]
  );

  const ensureUnlocked = useCallback(
    async (reason: string) => {
      if (!shouldLock || isUnlocked) return true;
      return unlock(reason);
    },
    [isUnlocked, shouldLock, unlock]
  );

  const setEnabled = useCallback(async (enabled: boolean) => {
    await setBiometricsEnabled(enabled);
    setIsEnabled(enabled);
    if (enabled) {
      skipNextAutoLockRef.current = true;
      setIsUnlocked(true);
      setFailedAttempts(0);
      failedAttemptsRef.current = 0;
      return;
    }
    setIsUnlocked(true);
    setFailedAttempts(0);
    failedAttemptsRef.current = 0;
  }, []);

  useEffect(() => {
    if (!shouldLock) return;
    const sub = AppState.addEventListener("change", (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (shouldRelockOnForeground(prev, next)) {
        setIsUnlocked(false);
      }
    });
    return () => sub.remove();
  }, [shouldLock]);

  const value = useMemo(
    () => ({
      isEnabled,
      isUnlocked,
      isPrompting,
      failedAttempts,
      setEnabled,
      lockNow,
      unlock,
      ensureUnlocked,
    }),
    [failedAttempts, isEnabled, isPrompting, isUnlocked, lockNow, setEnabled, unlock, ensureUnlocked]
  );

  return <BiometricLockContext.Provider value={value}>{children}</BiometricLockContext.Provider>;
}

export function useBiometricLock() {
  const context = useContext(BiometricLockContext);
  if (!context) {
    throw new Error("useBiometricLock must be used within BiometricLockProvider");
  }
  return context;
}
