import { memo } from "react";

import { Text, View } from "react-native";

import { Pressable } from "../../../ui/Pressable";
import { useAppTheme } from "../../../ui/app-theme";
import type { TrainingPlan } from "../../../core/models";

type Props = {
  plan: TrainingPlan;
  getClassName: (classId: string) => string;
  onClose: () => void;
  onEdit: (plan: TrainingPlan) => void;
  onSaveAsTemplate: (plan: TrainingPlan) => void | Promise<void>;
  onDuplicate: (plan: TrainingPlan) => void;
  onDelete: (plan: TrainingPlan) => void;
};

function TrainingPlanActionsModalContentBase({
  plan,
  getClassName,
  onClose,
  onEdit,
  onSaveAsTemplate,
  onDuplicate,
  onDelete,
}: Props) {
  const { colors } = useAppTheme();

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <View style={{ gap: 4, paddingRight: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>
            {plan.title}
          </Text>
          <Text style={{ color: colors.muted }}>{getClassName(plan.classId)}</Text>
        </View>
        <Pressable
          onPress={onClose}
          style={{
            height: 32,
            paddingHorizontal: 12,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.secondaryBg,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>
            Fechar
          </Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() => {
          onEdit(plan);
          onClose();
        }}
        style={{
          paddingVertical: 10,
          borderRadius: 12,
          backgroundColor: colors.primaryBg,
          alignItems: "center",
        }}
      >
        <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
          Editar planejamento
        </Text>
      </Pressable>

      <Pressable
        onPress={async () => {
          await onSaveAsTemplate(plan);
          onClose();
        }}
        style={{
          paddingVertical: 10,
          borderRadius: 12,
          backgroundColor: colors.secondaryBg,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
        }}
      >
        <Text style={{ color: colors.text, fontWeight: "700" }}>
          Salvar como modelo
        </Text>
      </Pressable>

      <Pressable
        onPress={() => {
          onDuplicate(plan);
          onClose();
        }}
        style={{
          paddingVertical: 10,
          borderRadius: 12,
          backgroundColor: colors.secondaryBg,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
        }}
      >
        <Text style={{ color: colors.text, fontWeight: "700" }}>Duplicar</Text>
      </Pressable>

      <Pressable
        onPress={() => {
          onClose();
          setTimeout(() => {
            onDelete(plan);
          }, 10);
        }}
        style={{
          paddingVertical: 10,
          borderRadius: 12,
          backgroundColor: colors.dangerBg,
          borderWidth: 1,
          borderColor: colors.dangerBorder,
          alignItems: "center",
        }}
      >
        <Text style={{ color: colors.dangerText, fontWeight: "700" }}>
          Excluir planejamento
        </Text>
      </Pressable>
    </View>
  );
}

export const TrainingPlanActionsModalContent = memo(TrainingPlanActionsModalContentBase);
TrainingPlanActionsModalContent.displayName = "TrainingPlanActionsModalContent";
