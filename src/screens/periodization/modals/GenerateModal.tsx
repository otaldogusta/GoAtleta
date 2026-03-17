import { Text, View } from "react-native";
import { Pressable } from "../../../ui/Pressable";
import type { ThemeColors } from "../../../ui/app-theme";
import { ModalSheet } from "../../../ui/ModalSheet";

type GenerateAction = "fill" | "auto" | "all";

type Props = {
  visible: boolean;
  onClose: () => void;
  modalCardStyle: object;
  colors: ThemeColors;
  isSavingPlans: boolean;
  onGenerateAction: (action: GenerateAction) => void;
};

export function GenerateModal({
  visible,
  onClose,
  modalCardStyle,
  colors,
  isSavingPlans,
  onGenerateAction,
}: Props) {
  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      cardStyle={[modalCardStyle, { paddingBottom: 16 }]}
      position="center"
    >
      <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
        Gerar ciclo
      </Text>

      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
        Escolha como preencher as semanas do ciclo.
      </Text>

      <View style={{ gap: 10, marginTop: 12 }}>
        <Pressable
          onPress={() => onGenerateAction("fill")}
          disabled={isSavingPlans}
          style={{
            paddingVertical: 12,
            borderRadius: 12,
            alignItems: "center",
            backgroundColor: colors.secondaryBg,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "700" }}>
            Completar faltantes
          </Text>
        </Pressable>

        <Pressable
          onPress={() => onGenerateAction("auto")}
          disabled={isSavingPlans}
          style={{
            paddingVertical: 12,
            borderRadius: 12,
            alignItems: "center",
            backgroundColor: colors.primaryBg,
          }}
        >
          <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
            Regerar apenas AUTO
          </Text>
        </Pressable>

        <Pressable
          onPress={() => onGenerateAction("all")}
          disabled={isSavingPlans}
          style={{
            paddingVertical: 12,
            borderRadius: 12,
            alignItems: "center",
            backgroundColor: colors.dangerSolidBg,
          }}
        >
          <Text style={{ color: colors.dangerSolidText, fontWeight: "700" }}>
            Regerar tudo (AUTO + MANUAL)
          </Text>
        </Pressable>
      </View>
    </ModalSheet>
  );
}
