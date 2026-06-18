import { Ionicons } from "@expo/vector-icons";
import { Text, TextInput, useWindowDimensions, View } from "react-native";

import type { TrainingPlanActivity } from "../../../core/models";
import { getTrainingPlanActivitySourceLabel } from "../../../core/training-plan-activity-source";
import type { TrainingPlanBlockKey } from "../../../core/training-plan-blocks";
import { Pressable } from "../../../ui/Pressable";
import { TimeInput } from "../../../ui/TimeInput";
import { useAppTheme } from "../../../ui/app-theme";
import { getPlanningBlockLabel } from "../application/planning-library-bridge";

type Props = {
  blockKey: TrainingPlanBlockKey;
  activities: TrainingPlanActivity[];
  manualText: string;
  duration: string;
  durationPlaceholder: string;
  durationFormat: "duration" | "clock";
  onAdd: (blockKey: TrainingPlanBlockKey) => void;
  onView: (activity: TrainingPlanActivity) => void;
  onRemove: (blockKey: TrainingPlanBlockKey, index: number) => void;
  onManualTextChange: (value: string) => void;
  onDurationChange: (value: string) => void;
};

const getActivityBadge = (activity: TrainingPlanActivity) =>
  getTrainingPlanActivitySourceLabel(activity) ?? (activity.execution ? "Vídeo/link" : "Manual");

export function PlanningBlockActivityCards({
  blockKey,
  activities,
  manualText,
  duration,
  durationPlaceholder,
  durationFormat,
  onAdd,
  onView,
  onRemove,
  onManualTextChange,
  onDurationChange,
}: Props) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const compact = width < 720;
  const hasManualText = manualText.trim().length > 0;

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
            {[
              activities.length
                ? `${activities.length} ${activities.length === 1 ? "atividade" : "atividades"}`
                : "",
              hasManualText ? "texto manual" : "",
            ].filter(Boolean).join(" · ") || "Sem atividades"}
          </Text>
        </View>
        <Pressable
          testID={`planning-add-activity-${blockKey}`}
          accessibilityRole="button"
          accessibilityLabel={`Adicionar da biblioteca ou vídeo em ${getPlanningBlockLabel(blockKey)}`}
          onPress={() => onAdd(blockKey)}
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primaryBg,
          }}
        >
          <Ionicons name="play-circle-outline" size={22} color={colors.primaryText} />
        </Pressable>
      </View>

      <View
        style={{
          flexDirection: compact ? "column" : "row",
          gap: 8,
          alignItems: compact ? "stretch" : "center",
        }}
      >
        <View
          style={{
            flex: 1,
            minWidth: 0,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            backgroundColor: colors.inputBg,
            paddingHorizontal: 12,
          }}
        >
          <TextInput
            testID={`planning-manual-text-${blockKey}`}
            placeholder="Texto manual"
            value={manualText}
            onChangeText={onManualTextChange}
            multiline
            placeholderTextColor={colors.placeholder}
            style={{
              flex: 1,
              minHeight: 42,
              paddingVertical: 10,
              color: colors.inputText,
              fontSize: 13,
              textAlignVertical: "center",
            }}
          />
        </View>
        <View
          style={{
            width: compact ? "100%" : 104,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            backgroundColor: colors.inputBg,
            paddingLeft: 9,
          }}
        >
          <Ionicons name="time-outline" size={15} color={colors.muted} />
          <TimeInput
            testID={`planning-duration-${blockKey}`}
            placeholder={durationPlaceholder}
            value={duration}
            onChangeText={onDurationChange}
            format={durationFormat}
            style={{
              flex: 1,
              minHeight: 42,
              borderWidth: 0,
              paddingHorizontal: 0,
              paddingVertical: 8,
              backgroundColor: "transparent",
            }}
          />
        </View>
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
