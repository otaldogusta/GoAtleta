import {
    Text,
    View
} from "react-native";
import { useAppTheme } from "./app-theme";
import { ModalSheet } from "./ModalSheet";
import { Pressable } from "./Pressable";

type ConfirmCloseOverlayProps = {
  visible: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  discardLabel?: string;
  showConfirmAction?: boolean;
  overlayZIndex?: number;
  onConfirm: () => void;
  onCancel: () => void;
  onDiscard?: () => void;
};

export function ConfirmCloseOverlay({
  visible,
  title = "Sair sem salvar?",
  message = "Você tem alterações não salvas.",
  confirmLabel = "Descartar",
  cancelLabel = "Continuar",
  discardLabel,
  showConfirmAction = true,
  overlayZIndex = 20000,
  onConfirm,
  onCancel,
  onDiscard,
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
        maxWidth: 440,
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
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 10,
            justifyContent: "flex-end",
          }}
        >
          {discardLabel && onDiscard ? (
            <Pressable
              onPress={onDiscard}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.dangerText, fontWeight: "700" }}>
                {discardLabel}
              </Text>
            </Pressable>
          ) : null}
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
          {showConfirmAction ? (
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
          ) : null}
        </View>
    </ModalSheet>
  );
}

