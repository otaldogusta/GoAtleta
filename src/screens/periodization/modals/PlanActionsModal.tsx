import { Text, View } from "react-native";

import type { ThemeColors } from "../../../ui/app-theme";
import { ModalDialogFrame } from "../../../ui/ModalDialogFrame";
import { Pressable } from "../../../ui/Pressable";

type Props = {
  visible: boolean;
  onClose: () => void;
  modalCardStyle: object;
  colors: ThemeColors;
  selectedClass: { id: string } | null | undefined;
  isImportingPlansFile: boolean;
  hasWeekPlans: boolean;
  periodizationRowsLength: number;
  onImportPlans: () => void;
  onExportWeek: () => void;
  onExportCycle: () => void;
};

export function PlanActionsModal({
  visible,
  onClose,
  modalCardStyle,
  colors,
  selectedClass,
  isImportingPlansFile,
  hasWeekPlans,
  periodizationRowsLength,
  onImportPlans,
  onExportWeek,
  onExportCycle,
}: Props) {
  const hasRows = periodizationRowsLength > 0;
  const canExport = Boolean(selectedClass) && hasRows && hasWeekPlans;

  return (
    <ModalDialogFrame
      visible={visible}
      onClose={onClose}
      cardStyle={[modalCardStyle, { paddingBottom: 16, maxHeight: "92%", height: "92%" }]}
      position="center"
      colors={colors}
      title="Ações da periodização"
      subtitle="Escolha o que deseja fazer nesta turma."
    >
      <View style={{ gap: 10 }}>
        <Pressable
          onPress={onImportPlans}
          disabled={!selectedClass || isImportingPlansFile}
          style={{
            paddingVertical: 12,
            borderRadius: 12,
            alignItems: "center",
            backgroundColor: colors.secondaryBg,
            borderWidth: 1,
            borderColor: colors.border,
            opacity: !selectedClass || isImportingPlansFile ? 0.6 : 1,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "700" }}>
            {isImportingPlansFile ? "Importando..." : "Importar planejamento"}
          </Text>
        </Pressable>

        <Pressable
          onPress={onExportWeek}
          disabled={!canExport}
          style={{
            paddingVertical: 12,
            borderRadius: 12,
            alignItems: "center",
            backgroundColor: colors.secondaryBg,
            borderWidth: 1,
            borderColor: colors.border,
            opacity: !canExport ? 0.6 : 1,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "700" }}>Exportar semana</Text>
        </Pressable>

        <Pressable
          onPress={onExportCycle}
          disabled={!canExport}
          style={{
            paddingVertical: 12,
            borderRadius: 12,
            alignItems: "center",
            backgroundColor: colors.primaryBg,
            opacity: !canExport ? 0.6 : 1,
          }}
        >
          <Text
            style={{
              color: !canExport ? colors.secondaryText : colors.primaryText,
              fontWeight: "700",
            }}
          >
            Exportar ciclo
          </Text>
        </Pressable>
      </View>
    </ModalDialogFrame>
  );
}
