import { useCallback, useState } from "react";

import { readTagUid, stopScan } from "./nfc";

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
