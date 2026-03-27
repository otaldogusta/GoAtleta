import { memo } from "react";

import { ScrollView, Text, View } from "react-native";

import { useAppTheme } from "../../../ui/app-theme";
import { formatClock, formatDuration } from "../../../utils/format-time";
import type { TrainingPlan } from "../../../core/models";

type Props = {
  plan: TrainingPlan;
  getClassName: (classId: string) => string;
};

function TrainingPlanDetailsModalContentBase({ plan, getClassName }: Props) {
  const { colors } = useAppTheme();

  return (
    <ScrollView
      contentContainerStyle={{ gap: 8, paddingVertical: 10 }}
      style={{ maxHeight: "94%" }}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      showsVerticalScrollIndicator
    >
      <View
        style={{
          padding: 10,
          borderRadius: 12,
          backgroundColor: colors.inputBg,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 6,
        }}
      >
        <Text style={{ fontWeight: "700", color: colors.text }}>
          Aquecimento {plan.warmupTime ? `(${formatDuration(plan.warmupTime)})` : ""}
        </Text>
        <Text style={{ color: colors.text }}>
          {plan.warmup.length ? plan.warmup.join(" - ") : "Sem itens"}
        </Text>
      </View>

      <View
        style={{
          padding: 10,
          borderRadius: 12,
          backgroundColor: colors.secondaryBg,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 6,
        }}
      >
        <Text style={{ fontWeight: "700", color: colors.text }}>
          Parte principal {plan.mainTime ? `(${formatClock(plan.mainTime)})` : ""}
        </Text>
        <Text style={{ color: colors.text }}>
          {plan.main.length ? plan.main.join(" - ") : "Sem itens"}
        </Text>
      </View>

      <View
        style={{
          padding: 10,
          borderRadius: 12,
          backgroundColor: colors.inputBg,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 6,
        }}
      >
        <Text style={{ fontWeight: "700", color: colors.text }}>
          Volta a calma {plan.cooldownTime ? `(${formatDuration(plan.cooldownTime)})` : ""}
        </Text>
        <Text style={{ color: colors.text }}>
          {plan.cooldown.length ? plan.cooldown.join(" - ") : "Sem itens"}
        </Text>
      </View>

      {plan.tags.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {plan.tags.map((tag) => (
            <View
              key={tag}
              style={{
                paddingVertical: 3,
                paddingHorizontal: 8,
                borderRadius: 999,
                backgroundColor: colors.secondaryBg,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 12 }}>{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ marginTop: 4 }}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          {getClassName(plan.classId)}
        </Text>
      </View>
    </ScrollView>
  );
}

export const TrainingPlanDetailsModalContent = memo(TrainingPlanDetailsModalContentBase);
TrainingPlanDetailsModalContent.displayName = "TrainingPlanDetailsModalContent";
