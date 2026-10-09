import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "./app-theme";
import { useRefreshTransition } from "./useRefreshTransition";
import { updateRefreshFeedback, type RefreshFeedback as Feedback } from "./refresh-feedback-state";

const RefreshFeedbackContext = createContext<((id: string, value: Feedback | null) => void) | null>(null);

export function RefreshFeedbackProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Record<string, Feedback>>({});
  const update = useCallback((id: string, value: Feedback | null) => {
    setEntries(current => updateRefreshFeedback(current, id, value));
  }, []);
  const refreshing = Object.values(entries).some(entry => entry.refreshing);
  const transition = useRefreshTransition(refreshing, true);
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  return (
    <RefreshFeedbackContext.Provider value={update}>
      {children}
      {transition.visible ? <Animated.View pointerEvents="none"
        accessibilityRole="progressbar" accessibilityLabel="Atualizando dados" accessibilityState={{ busy: refreshing }}
        style={{ position: "absolute", top: insets.top, left: 0, right: 0, height: 3,
          backgroundColor: colors.primaryBg, opacity: transition.progress, zIndex: 10000 }} /> : null}
    </RefreshFeedbackContext.Provider>
  );
}

export const useRefreshFeedback = () => useContext(RefreshFeedbackContext);
