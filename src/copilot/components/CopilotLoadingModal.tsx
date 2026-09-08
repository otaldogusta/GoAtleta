import { StyleSheet, View, useWindowDimensions } from "react-native";
import { ModalSheet } from "../../ui/ModalSheet";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { AssistantPending } from "../../assistant/components/AssistantPending";

/** Immediate feedback while the conversation code is downloaded on first use. */
export function CopilotLoadingModal({ onClose }: { onClose: () => void }) {
  const { colors } = useAppTheme();
  const { height } = useWindowDimensions();
  return <ModalSheet visible onClose={onClose} position="center" overlayZIndex={5000} backdropOpacity={0.5}
    cardStyle={[styles.card, { backgroundColor: colors.background, borderColor: colors.border, minHeight: Math.min(560, height - 48), maxHeight: height - 36 }]}>
    <Pressable accessibilityRole="button" accessibilityLabel="Fechar chat" onPress={onClose}
      style={[styles.close, { backgroundColor: colors.secondaryBg }]}>
      <GoAtletaIcon name="close" size={18} color={colors.text} />
    </Pressable>
    <View style={styles.pending}><AssistantPending label="Abrindo conversa" compact /></View>
  </ModalSheet>;
}
const styles = StyleSheet.create({
  card: { width: "94%", maxWidth: 860, borderWidth: 1, borderRadius: 28, padding: 14 },
  close: { width: 36, height: 36, borderRadius: 18, alignSelf: "flex-end", alignItems: "center", justifyContent: "center" },
  pending: { flex: 1, alignItems: "center", justifyContent: "center" },
});
