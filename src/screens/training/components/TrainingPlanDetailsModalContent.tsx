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
import { formatTrainingPlanDisplayText } from "../application/training-plan-display-text";

type Props = {
  plan: TrainingPlan;
};

const objectivePrefixPattern = /^objetivo\s+(geral|especifico|específico)\s*:/i;

const cleanObjectiveText = (value: string) =>
  formatTrainingPlanDisplayText(value.replace(objectivePrefixPattern, "").trim());

const isObjectiveActivity = (value: string) => objectivePrefixPattern.test(value);

const getSimpleActivityDescription = (value: string | undefined) => {
  const normalized = formatTrainingPlanDisplayText(value).trim();
  if (!normalized) return "";
  if (normalized.length <= 118) return normalized;
  return `${normalized.slice(0, 115).trim()}...`;
};

function TrainingPlanDetailsModalContentBase({ plan }: Props) {
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
      title: "Volta à calma",
      time: plan.cooldownTime ? `(${formatDuration(plan.cooldownTime)})` : "",
      backgroundColor: colors.inputBg,
    },
  ];
  const totalActivities = sections.reduce(
    (total, section) => total + resolveTrainingPlanBlock(plan, section.key).activities.length,
    0
  );

  return (
    <ScrollView
      contentContainerStyle={{ gap: 10, paddingVertical: 12 }}
      style={{ maxHeight: "94%" }}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      showsVerticalScrollIndicator
    >
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
          paddingBottom: 2,
        }}
      >
        <View
          style={{
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: 999,
            backgroundColor: colors.secondaryBg,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 12, fontWeight: "800" }}>
            {totalActivities} {totalActivities === 1 ? "atividade" : "atividades"}
          </Text>
        </View>
      </View>

      {sections.map((section) => {
        const block = resolveTrainingPlanBlock(plan, section.key);
        const objectiveLines = block.activities
          .map((activity) => String(activity.name ?? "").trim())
          .filter(isObjectiveActivity)
          .map(cleanObjectiveText)
          .filter(Boolean);
        const displayActivities = block.activities.filter(
          (activity) => !isObjectiveActivity(String(activity.name ?? "").trim())
        );
        const activities = displayActivities.length ? displayActivities : block.activities;
        return (
          <View
            key={section.key}
            testID={`training-plan-detail-block-${section.key}`}
            style={{
              padding: 12,
              borderRadius: 14,
              backgroundColor: section.backgroundColor,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 10,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <Text style={{ fontWeight: "900", color: colors.text, fontSize: 15 }}>
                {section.title}
              </Text>
              {section.time ? (
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>
                  {section.time.replace("(", "").replace(")", "")}
                </Text>
              ) : null}
            </View>

            {objectiveLines.length ? (
              <View
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: 12,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  gap: 4,
                }}
              >
                <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "900" }}>
                  Foco
                </Text>
                <Text
                  numberOfLines={2}
                  style={{ color: colors.secondaryText, fontSize: 12, lineHeight: 17 }}
                >
                  {objectiveLines.join(" · ")}
                </Text>
              </View>
            ) : null}

            {activities.length ? (
              <View style={{ gap: 6 }}>
                {activities.map((activity, index) => {
                  const sourceLabel = getTrainingPlanActivitySourceLabel(activity);
                  const activityName =
                    formatTrainingPlanDisplayText(activity.name) || "Atividade sem título";
                  const description = getSimpleActivityDescription(activity.description);
                  return (
                    <View
                      key={`${activityName}_${index}`}
                      style={{
                        flexDirection: "row",
                        alignItems: "flex-start",
                        gap: 10,
                        paddingVertical: 7,
                        borderTopWidth: index === 0 ? 0 : 1,
                        borderColor: colors.border,
                      }}
                    >
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: colors.secondaryBg,
                          marginTop: 1,
                        }}
                      >
                        <Text style={{ color: colors.text, fontSize: 11, fontWeight: "900" }}>
                          {index + 1}
                        </Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                        <View
                          style={{
                            flexDirection: "row",
                            flexWrap: "wrap",
                            gap: 6,
                            alignItems: "center",
                          }}
                        >
                          <Text
                            numberOfLines={2}
                            style={{
                              color: colors.text,
                              fontWeight: "900",
                              flexShrink: 1,
                              fontSize: 14,
                            }}
                          >
                          {activityName}
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
                              <Text
                                style={{
                                  color: colors.successText,
                                  fontSize: 10,
                                  fontWeight: "900",
                                }}
                              >
                                {sourceLabel}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        {description ? (
                          <Text
                            numberOfLines={2}
                            style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}
                          >
                            {description}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Nenhuma atividade neste bloco.
              </Text>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

export const TrainingPlanDetailsModalContent = memo(TrainingPlanDetailsModalContentBase);
TrainingPlanDetailsModalContent.displayName = "TrainingPlanDetailsModalContent";
