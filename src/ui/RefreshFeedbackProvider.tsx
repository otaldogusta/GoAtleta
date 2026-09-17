import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import { GoAtletaIcon } from "./icon-registry";
import { SectionLoadingState } from "../components/ui/SectionLoadingState";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "./app-theme";
import { updateRefreshFeedback, type RefreshFeedback as Feedback } from "./refresh-feedback-state";

const RefreshFeedbackContext = createContext<((id: string, value: Feedback | null) => void) | null>(null);

export function RefreshFeedbackProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Record<string, Feedback>>({});
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const update = useCallback((id: string, value: Feedback | null) => {
    setEntries((current) => updateRefreshFeedback(current, id, value));
  }, []);
  const feedback = useMemo(() => ({
    refreshing: Object.values(entries).some((entry) => entry.refreshing),
    pull: Math.max(0, ...Object.values(entries).map((entry) => entry.pull)),
  }), [entries]);
  return (
    <RefreshFeedbackContext.Provider value={update}>
      {children}
      {feedback.refreshing || feedback.pull > 8 ? (
        <View pointerEvents="none" style={{ position: "absolute", top: insets.top + 4, left: 0, right: 0, alignItems: "center", zIndex: 10001 }}>
          <View accessibilityLabel={feedback.refreshing ? "Atualizando tela" : "Puxe para atualizar"} style={{ padding: 10, borderRadius: 24, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
            {feedback.refreshing ? <ActivityIndicator color={colors.text} /> : <GoAtletaIcon name="refresh" size={20} color={colors.text} />}
          </View>
        </View>
      ) : null}
      {feedback.refreshing ? (
        <View pointerEvents="none" accessibilityLabel="Atualizando conteúdo da tela" accessibilityState={{ busy: true }} style={{ position: "absolute", top: insets.top + 96, bottom: insets.bottom + 100, left: 0, right: 0, padding: 16, gap: 24, overflow: "hidden", backgroundColor: colors.background, zIndex: 10000 }}>
          <SectionLoadingState />
          <SectionLoadingState />
        </View>
      ) : null}
    </RefreshFeedbackContext.Provider>
  );
}

export const useRefreshFeedback = () => useContext(RefreshFeedbackContext);
