import { memo } from "react";

import { ScrollView, Text, View } from "react-native";

import { useAppTheme } from "../../../ui/app-theme";
import { formatClock, formatDuration } from "../../../utils/format-time";
import type { TrainingPlan } from "../../../core/models";
import {
  getTrainingPlanActivitySourceLabel,
} from "../../../core/training-plan-activity-source";
import {
  resolveTrainingPlanBlock,
  type TrainingPlanBlockKey,
} from "../../../core/training-plan-blocks";

type Props = {
  plan: TrainingPlan;
  getClassName: (classId: string) => string;
};

function TrainingPlanDetailsModalContentBase({ plan, getClassName }: Props) {
  const { colors } = useAppTheme();
  const sections: Array<{
    key: TrainingPlanBlockKey;
    title: string;
    time: string;
    backgroundColor: string;
  }> = [
    {
      key: "warmup",
      title: "Aquecimento",
      time: plan.warmupTime ? `(${formatDuration(plan.warmupTime)})` : "",
      backgroundColor: colors.inputBg,
    },
    {
      key: "main",
      title: "Parte principal",
      time: plan.mainTime ? `(${formatClock(plan.mainTime)})` : "",
      backgroundColor: colors.secondaryBg,
    },
    {
      key: "cooldown",
      title: "Volta a calma",
      time: plan.cooldownTime ? `(${formatDuration(plan.cooldownTime)})` : "",
      backgroundColor: colors.inputBg,
    },
  ];

  return (
    <ScrollView
      contentContainerStyle={{ gap: 8, paddingVertical: 10 }}
      style={{ maxHeight: "94%" }}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      showsVerticalScrollIndicator
    >
      {sections.map((section) => {
        const block = resolveTrainingPlanBlock(plan, section.key);
        return (
          <View
            key={section.key}
            testID={`training-plan-detail-block-${section.key}`}
            style={{
              padding: 10,
              borderRadius: 12,
              backgroundColor: section.backgroundColor,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 8,
            }}
          >
            <Text style={{ fontWeight: "700", color: colors.text }}>
              {section.title} {section.time}
            </Text>
            {block.activities.length ? (
              <View style={{ gap: 8 }}>
                {block.activities.map((activity, index) => {
                  const sourceLabel = getTrainingPlanActivitySourceLabel(activity);
                  return (
                    <View key={`${activity.name}_${index}`} style={{ gap: 4 }}>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                        <Text style={{ color: colors.text, fontWeight: "800", flexShrink: 1 }}>
                          {activity.name}
                        </Text>
                        {sourceLabel ? (
                          <View
                            testID="training-plan-detail-source-badge"
                            style={{
                              paddingVertical: 2,
                              paddingHorizontal: 7,
                              borderRadius: 999,
                              backgroundColor: colors.successBg,
                              borderWidth: 1,
                              borderColor: colors.successBorder,
                            }}
                          >
                            <Text style={{ color: colors.successText, fontSize: 11, fontWeight: "800" }}>
                              {sourceLabel}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      {activity.description ? (
                        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>
                          {activity.description}
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={{ color: colors.text }}>Sem itens</Text>
            )}
          </View>
        );
      })}

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
