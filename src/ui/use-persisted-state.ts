import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { safeJsonParse } from "../utils/safe-json";

export function usePersistedState<T>(key: string | null, initialState: T) {
  const [state, setState] = useState<T>(initialState);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!key) {
      setLoaded(true);
      return () => {
        alive = false;
      };
    }
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (!alive) return;
        if (raw !== null) {
          setState(safeJsonParse<T>(raw, initialState));
        }
      } catch {
        // Ignore invalid or unavailable stored state.
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [key]);

  useEffect(() => {
    if (!loaded || !key) return;
    try {
      void AsyncStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Ignore storage errors.
    }
  }, [key, loaded, state]);

  return [state, setState, loaded] as const;
}
