import { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as Sentry from "@sentry/react-native";

import { bootstrapApp } from "./bootstrap";
import type { BootstrapResult } from "./bootstrap";

type BootstrapState = {
  ready: boolean;
  loading: boolean;
  error: Error | null;
  data: BootstrapResult | null;
  retry: () => void;
};

const BootstrapContext = createContext<BootstrapState | null>(null);

export function BootstrapProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<BootstrapResult | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await bootstrapApp();
      setData(result);
      setReady(true);
    } catch (err) {
      const parsed = err instanceof Error ? err : new Error(String(err));
      setError(parsed);
      setReady(false);
      Sentry.captureException(parsed);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  return (
    <BootstrapContext.Provider value={{ ready, loading, error, data, retry: run }}>
      {children}
    </BootstrapContext.Provider>
  );
}

export function useBootstrap() {
  const ctx = useContext(BootstrapContext);
  if (!ctx) {
    throw new Error("useBootstrap must be used within BootstrapProvider");
  }
  return ctx;
}
