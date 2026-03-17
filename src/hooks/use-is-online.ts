import { useEffect, useState } from "react";

/**
 * Hook para detectar se o dispositivo está online ou offline.
 * Monitora mudanças de conexão e atualiza o estado em tempo real.
 * 
 * Se @react-native-community/netinfo não estiver disponível,
 * assume online por padrão (fallback para app online-first).
 */
export function useIsOnline(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const setupNetworkListener = async () => {
      try {
        // Try to dynamically import NetInfo - it may not be installed
        const NetInfo = await import("@react-native-community/netinfo");
        
        // Get initial state
        try {
          const state = await NetInfo.default.fetch();
          setIsOnline(state.isConnected !== false);
        } catch (fetchError) {
          console.warn("NetInfo.fetch failed", fetchError);
          setIsOnline(true);
        }

        // Subscribe to changes
        try {
          unsubscribe = NetInfo.default.addEventListener((state) => {
            setIsOnline(state.isConnected !== false);
          });
        } catch (subscribeError) {
          console.warn("NetInfo.addEventListener failed", subscribeError);
        }
      } catch (error) {
        // NetInfo module not available, assume online (fallback)
        // This is safe for online-first apps
        console.warn("NetInfo not available, assuming online", error);
        setIsOnline(true);
      }
    };

    setupNetworkListener();

    return () => {
      unsubscribe?.();
    };
  }, []);

  return isOnline;
}

