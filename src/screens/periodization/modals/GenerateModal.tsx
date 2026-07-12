import { Text, View } from "react-native";

import { isAnnualCycle } from "../../../core/periodization-basics";
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
  cycleLength: number;
  onGenerateAction: (action: GenerateAction) => void;
};

export function GenerateModal({
  visible,
  onClose,
  modalCardStyle,
  colors,
  isSavingPlans,
  cycleLength,
  onGenerateAction,
}: Props) {
  const annual = isAnnualCycle(cycleLength);

  return (
    <ModalDialogFrame
      visible={visible}
      onClose={onClose}
      cardStyle={[modalCardStyle, { paddingBottom: 16, maxHeight: "92%", height: "92%" }]}
      position="center"
      colors={colors}
      title={annual ? "Gerar ciclo anual" : "Gerar ciclo"}
      subtitle={
        annual
          ? "Use os dados da turma para completar ou recriar o planejamento anual."
          : "Use os dados da turma para completar ou recriar o planejamento."
      }
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
          <Text style={{ color: colors.text, fontWeight: "700" }}>
            {annual ? "Completar semanas faltantes" : "Completar faltantes"}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => onGenerateAction("all")}
          disabled={isSavingPlans}
          style={{
            paddingVertical: 12,
            borderRadius: 12,
            alignItems: "center",
            backgroundColor: colors.primaryBg,
          }}
        >
          <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
            Recriar ciclo
          </Text>
        </Pressable>
      </View>
    </ModalDialogFrame>
  );
}
