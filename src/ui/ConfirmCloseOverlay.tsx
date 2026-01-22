import {
  Text,
  View
} from "react-native";
import { Pressable } from "./Pressable";
import { useAppTheme } from "./app-theme";
import { ModalSheet } from "./ModalSheet";

type ConfirmCloseOverlayProps = {
  visible: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  overlayZIndex?: number;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmCloseOverlay({
  visible,
  title = "Sair sem salvar?",
  message = "Você tem alterações não salvas.",
  confirmLabel = "Descartar",
  cancelLabel = "Continuar",
  overlayZIndex,
  onConfirm,
  onCancel,
}: ConfirmCloseOverlayProps) {
  const { colors } = useAppTheme();

  if (!visible) return null;

  return (
    <ModalSheet
      visible={visible}
      onClose={onCancel}
      position="center"
      overlayZIndex={overlayZIndex}
      cardStyle={{
        width: "100%",
        maxWidth: 360,
        borderRadius: 18,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
        gap: 12,
      }}
    >
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
            {title}
          </Text>
          <Text style={{ color: colors.muted }}>{message}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end" }}>
          <Pressable
            onPress={onCancel}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 12,
              backgroundColor: colors.secondaryBg,
            }}
          >
            <Text style={{ color: colors.secondaryText, fontWeight: "700" }}>
              {cancelLabel}
            </Text>
          </Pressable>
          <Pressable
            onPress={onConfirm}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 12,
              backgroundColor: colors.primaryBg,
            }}
          >
            <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
              {confirmLabel}
            </Text>
          </Pressable>
        </View>
    </ModalSheet>
  );
}
