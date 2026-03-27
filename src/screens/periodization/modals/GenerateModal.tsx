import { Text, View } from "react-native";

import type { ThemeColors } from "../../../ui/app-theme";
import { ModalDialogFrame } from "../../../ui/ModalDialogFrame";
import { Pressable } from "../../../ui/Pressable";

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
    <ModalDialogFrame
      visible={visible}
      onClose={onClose}
      cardStyle={[modalCardStyle, { paddingBottom: 16, maxHeight: "92%", height: "92%" }]}
      position="center"
      colors={colors}
      title="Gerar ciclo"
      subtitle="Escolha como preencher as semanas do ciclo."
    >
      <View style={{ gap: 10 }}>
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
          <Text style={{ color: colors.text, fontWeight: "700" }}>Completar faltantes</Text>
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
          <Text style={{ color: colors.primaryText, fontWeight: "700" }}>Regerar apenas AUTO</Text>
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
    </ModalDialogFrame>
  );
}
