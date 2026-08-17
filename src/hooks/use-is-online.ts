import * as Network from "expo-network";
import { useEffect, useState } from "react";

/**
 * Hook para detectar se o dispositivo está online ou offline.
 * Monitora mudanças de conexão e atualiza o estado em tempo real.
 *
 * Usa expo-network, que já faz parte do runtime nativo do aplicativo.
 */
export function useIsOnline(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let subscription: ReturnType<typeof Network.addNetworkStateListener> | null = null;

    const updateConnectionState = (state: Network.NetworkState) => {
      if (!isMounted) return;

      setIsOnline(state.isConnected !== false && state.isInternetReachable !== false);
    };

    const setupNetworkListener = async () => {
      try {
        subscription = Network.addNetworkStateListener(updateConnectionState);
        const state = await Network.getNetworkStateAsync();
        updateConnectionState(state);
      } catch (error) {
        console.warn("Network state unavailable, assuming online", error);
        if (isMounted) setIsOnline(true);
      }
    };

    setupNetworkListener();

    return () => {
      isMounted = false;
      subscription?.remove();
    };
  }, []);

  return isOnline;
}
