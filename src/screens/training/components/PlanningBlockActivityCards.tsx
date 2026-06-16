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
  const reserveFloatingSpace = width >= 720 && width < 1040;

  return (
    <View
      testID={`planning-block-${blockKey}`}
      style={{
        gap: 9,
        paddingTop: compact ? 10 : 12,
        paddingBottom: compact ? 10 : 12,
        paddingLeft: compact ? 10 : 12,
        paddingRight: reserveFloatingSpace ? 72 : compact ? 10 : 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
      }}
    >
      <View
        style={{
          flexDirection: compact ? "column" : "row",
          alignItems: compact ? "stretch" : "center",
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
          onPress={() => onAdd(blockKey)}
          style={{
            minHeight: 36,
            borderRadius: 12,
            paddingHorizontal: 12,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 6,
            backgroundColor: colors.primaryBg,
            alignSelf: compact ? "stretch" : "auto",
          }}
        >
          <Ionicons name="add" size={18} color={colors.primaryText} />
          <Text style={{ color: colors.primaryText, fontSize: 13, fontWeight: "900" }}>
            Adicionar
          </Text>
        </Pressable>
      </View>

      {activities.length ? (
        <View style={{ gap: 8 }}>
          {activities.map((activity, index) => (
            <View
              key={`${activity.catalog?.variantId ?? activity.name}-${index}`}
              testID={`planning-activity-card-${blockKey}`}
              style={{
                gap: 8,
                padding: compact ? 10 : 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.secondaryBg,
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
                    style={{ color: colors.text, fontSize: 15, fontWeight: "900" }}
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
                    paddingHorizontal: 9,
                    paddingVertical: 5,
                    borderRadius: 999,
                    backgroundColor: activity.catalog ? colors.successBg : colors.infoBg,
                  }}
                >
                  <Text
                    style={{
                      color: activity.catalog ? colors.successText : colors.infoText,
                      fontSize: 11,
                      fontWeight: "900",
                    }}
                  >
                    {getActivityBadge(activity)}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <ActionButton label="Ver" testID={`planning-view-${blockKey}-${index}`} onPress={() => onView(activity)} />
                <ActionButton
                  label="Remover"
                  danger
                  testID={`planning-remove-${blockKey}-${index}`}
                  onPress={() => onRemove(blockKey, index)}
                />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text
          testID={`planning-empty-${blockKey}`}
          style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}
        >
          Nenhuma atividade.
        </Text>
      )}
    </View>
  );
}

function ActionButton({
  label,
  testID,
  danger,
  onPress,
}: {
  label: string;
  testID: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={{
        minHeight: 32,
        borderRadius: 10,
        paddingHorizontal: 10,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: danger ? colors.dangerBg : colors.card,
        borderWidth: 1,
        borderColor: danger ? colors.dangerBorder : colors.border,
      }}
    >
      <Text
        style={{
          color: danger ? colors.dangerText : colors.text,
          fontSize: 12,
          fontWeight: "900",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
