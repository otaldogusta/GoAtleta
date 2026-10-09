import { useRef, useState } from "react";
import { useSaveToast } from "./save-toast";

/** Same controlled refresh lifecycle for screens without their own loader state. */
export function useScreenRefresh(load: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);
  const { showSaveToast } = useSaveToast();
  const onRefresh = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    try { await load(); }
    catch (error) { showSaveToast({ error, variant: "error" }); }
    finally { inFlight.current = false; setRefreshing(false); }
  };
  return { refreshing, onRefresh };
}
