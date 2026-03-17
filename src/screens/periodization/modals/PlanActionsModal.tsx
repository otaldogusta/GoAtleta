import { StyleSheet, Text, View } from "react-native";
import { Pressable } from "../../../ui/Pressable";
import type { ThemeColors } from "../../../ui/app-theme";
import { ModalSheet } from "../../../ui/ModalSheet";

type Props = {
  visible: boolean;
  onClose: () => void;
  modalCardStyle: object;
  colors: ThemeColors;
  selectedClass: { id: string } | null | undefined;
  isSavingPlans: boolean;
  isImportingPlansFile: boolean;
  hasWeekPlans: boolean;
  periodizationRowsLength: number;
  onApplyPreset: () => void;
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
  isSavingPlans,
  isImportingPlansFile,
  hasWeekPlans,
  periodizationRowsLength,
  onApplyPreset,
  onImportPlans,
  onExportWeek,
  onExportCycle,
}: Props) {
  const hasRows = periodizationRowsLength > 0;
  const canExport = Boolean(selectedClass) && hasRows && hasWeekPlans;

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      cardStyle={[modalCardStyle, { paddingBottom: 16 }]}
      position="center"
    >
      <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
        Ações da periodização
      </Text>
      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
        Escolha o que deseja fazer nesta turma.
      </Text>

      <View style={{ gap: 10, marginTop: 12 }}>
        <Pressable
          onPress={onApplyPreset}
          disabled={!selectedClass || isSavingPlans}
          style={{
            paddingVertical: 12,
            borderRadius: 12,
            alignItems: "center",
            backgroundColor: colors.primaryBg,
            opacity: !selectedClass || isSavingPlans ? 0.6 : 1,
          }}
        >
          <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
            {isSavingPlans ? "Aplicando preset..." : "Aplicar preset ElCartel (18 semanas)"}
          </Text>
        </Pressable>

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
          <Text style={{ color: colors.text, fontWeight: "700" }}>
            Exportar semana
          </Text>
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
    </ModalSheet>
  );
}
