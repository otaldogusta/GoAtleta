import { Ionicons } from "@expo/vector-icons";
import { Text, useWindowDimensions, View } from "react-native";

import type { TrainingPlanActivity } from "../../../core/models";
import { getTrainingPlanActivitySourceLabel } from "../../../core/training-plan-activity-source";
import type { TrainingPlanBlockKey } from "../../../core/training-plan-blocks";
import { Pressable } from "../../../ui/Pressable";
import { useAppTheme } from "../../../ui/app-theme";
import { getPlanningBlockLabel } from "../application/planning-library-bridge";

type Props = {
  blockKey: TrainingPlanBlockKey;
  activities: TrainingPlanActivity[];
  onAdd: (blockKey: TrainingPlanBlockKey) => void;
  onView: (activity: TrainingPlanActivity) => void;
  onRemove: (blockKey: TrainingPlanBlockKey, index: number) => void;
};

const getActivityBadge = (activity: TrainingPlanActivity) =>
  getTrainingPlanActivitySourceLabel(activity) ?? (activity.execution ? "Vídeo/link" : "Manual");

export function PlanningBlockActivityCards({
  blockKey,
  activities,
  onAdd,
  onView,
  onRemove,
}: Props) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const compact = width < 720;

  return (
    <View
      testID={`planning-block-${blockKey}`}
      style={{
        gap: 10,
        paddingTop: compact ? 10 : 12,
        paddingBottom: compact ? 10 : 12,
        paddingLeft: compact ? 10 : 12,
        paddingRight: compact ? 10 : 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 9,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}>
            {getPlanningBlockLabel(blockKey)}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
            {activities.length
              ? `${activities.length} ${activities.length === 1 ? "atividade" : "atividades"}`
              : "Sem atividades"}
          </Text>
        </View>
        <Pressable
          testID={`planning-add-activity-${blockKey}`}
          accessibilityRole="button"
          accessibilityLabel={`Adicionar atividade em ${getPlanningBlockLabel(blockKey)}`}
          onPress={() => onAdd(blockKey)}
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primaryBg,
          }}
        >
          <Ionicons name="add" size={22} color={colors.primaryText} />
        </Pressable>
      </View>

      {activities.length ? (
        <View style={{ gap: 0 }}>
          {activities.map((activity, index) => (
            <View
              key={`${activity.catalog?.variantId ?? activity.name}-${index}`}
              testID={`planning-activity-card-${blockKey}`}
              style={{
                gap: 7,
                paddingTop: 10,
                paddingBottom: index === activities.length - 1 ? 0 : 10,
                borderTopWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View
                style={{
                  flexDirection: compact ? "column" : "row",
                  gap: 8,
                  alignItems: compact ? "stretch" : "flex-start",
                }}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <Text
                    numberOfLines={2}
                    style={{ color: colors.text, fontSize: 14, fontWeight: "900" }}
                  >
                    {activity.name || "Atividade sem título"}
                  </Text>
                  {activity.description ? (
                    <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>
                      {activity.description}
                    </Text>
                  ) : null}
                </View>
                <View
                  style={{
                    alignSelf: compact ? "flex-start" : "auto",
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 999,
                    backgroundColor: activity.catalog ? colors.successBg : colors.infoBg,
                  }}
                >
                  <Text
                    style={{
                      color: activity.catalog ? colors.successText : colors.infoText,
                      fontSize: 10,
                      fontWeight: "900",
                    }}
                  >
                    {getActivityBadge(activity)}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <ActionButton
                  icon="eye-outline"
                  label="Ver"
                  testID={`planning-view-${blockKey}-${index}`}
                  onPress={() => onView(activity)}
                />
                <ActionButton
                  icon="trash-outline"
                  label="Remover"
                  danger
                  testID={`planning-remove-${blockKey}-${index}`}
                  onPress={() => onRemove(blockKey, index)}
                />
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ActionButton({
  icon,
  label,
  testID,
  danger,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  testID: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: danger ? colors.dangerBg : colors.card,
        borderWidth: 1,
        borderColor: danger ? colors.dangerBorder : colors.border,
      }}
    >
      <Ionicons
        name={icon}
        size={16}
        color={danger ? colors.dangerText : colors.text}
      />
    </Pressable>
  );
}
