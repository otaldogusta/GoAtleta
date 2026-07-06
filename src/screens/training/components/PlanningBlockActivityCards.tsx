import { Text, TextInput, useWindowDimensions, View } from "react-native";

import type { TrainingPlanActivity } from "../../../core/models";
import { getTrainingPlanActivitySourceLabel } from "../../../core/training-plan-activity-source";
import type { TrainingPlanBlockKey } from "../../../core/training-plan-blocks";
import { Pressable } from "../../../ui/Pressable";
import { TimeInput } from "../../../ui/TimeInput";
import { useAppTheme } from "../../../ui/app-theme";
import { GoAtletaIcon, type GoAtletaIconName } from "../../../ui/icon-registry";
import { getPlanningBlockLabel } from "../application/planning-library-bridge";

type Props = {
  blockKey: TrainingPlanBlockKey;
  activities: TrainingPlanActivity[];
  manualText: string;
  duration: string;
  durationPlaceholder: string;
  durationFormat: "duration" | "clock";
  onAdd: (blockKey: TrainingPlanBlockKey) => void;
  onView: (blockKey: TrainingPlanBlockKey, index: number) => void;
  onRemove: (blockKey: TrainingPlanBlockKey, index: number) => void;
  onManualTextChange: (value: string) => void;
  onManualLineRemove: (blockKey: TrainingPlanBlockKey, index: number) => void;
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
  onManualLineRemove,
  onDurationChange,
}: Props) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const compact = width < 720;
  const manualLines = manualText.length ? manualText.split("\n") : [""];
  const canRemoveManualLine = manualLines.length > 1;

  const updateManualLine = (index: number, value: string) => {
    const nextLines = [...manualLines];
    nextLines[index] = value;
    onManualTextChange(nextLines.join("\n"));
  };

  const addManualLine = () => {
    onManualTextChange([...manualLines, ""].join("\n"));
  };

  return (
    <View
      testID={`planning-block-${blockKey}`}
      style={{
        gap: 10,
        padding: compact ? 12 : 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
      }}
    >
      <View
        style={{
          flexDirection: compact ? "column" : "row",
          alignItems: compact ? "stretch" : "center",
          gap: compact ? 8 : 10,
        }}
      >
        <View
          style={{
            flex: 1,
            minWidth: 0,
            flexDirection: compact ? "row" : "column",
            alignItems: compact ? "center" : "flex-start",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}>
            {getPlanningBlockLabel(blockKey)}
          </Text>
          {compact ? (
            <AddActivityButton blockKey={blockKey} onAdd={onAdd} />
          ) : null}
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
            minHeight: 46,
          }}
        >
          <GoAtletaIcon name="time" size={15} color={colors.muted} />
          <TimeInput
            testID={`planning-duration-${blockKey}`}
            placeholder={durationPlaceholder}
            value={duration}
            onChangeText={onDurationChange}
            format={durationFormat}
            style={{
              flex: 1,
              minHeight: 44,
              borderWidth: 0,
              paddingHorizontal: 0,
              paddingVertical: 8,
              backgroundColor: "transparent",
            }}
          />
        </View>
        {compact ? null : (
          <AddActivityButton blockKey={blockKey} onAdd={onAdd} />
        )}
      </View>

      <View style={{ gap: 8 }}>
        {manualLines.map((line, index) => (
          <View
            key={`${blockKey}-manual-${index}`}
            style={{
              flexDirection: "row",
              alignItems: "stretch",
              gap: 8,
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
                minHeight: 58,
              }}
            >
              <TextInput
                testID={`planning-manual-text-${blockKey}-${index}`}
                placeholder="Descreva a atividade..."
                value={line}
                onChangeText={(value) => updateManualLine(index, value)}
                multiline
                placeholderTextColor={colors.placeholder}
                style={{
                  flex: 1,
                  minHeight: 56,
                  paddingVertical: 12,
                  color: colors.inputText,
                  fontSize: 14,
                  textAlignVertical: "top",
                }}
              />
            </View>
            {canRemoveManualLine ? (
              <Pressable
                testID={`planning-remove-manual-${blockKey}-${index}`}
                accessibilityRole="button"
                accessibilityLabel="Remover atividade manual"
                onPress={() => onManualLineRemove(blockKey, index)}
                style={{
                  width: 42,
                  minHeight: 58,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <GoAtletaIcon name="trash" size={18} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
        ))}
        <Pressable
          testID={`planning-add-manual-${blockKey}`}
          accessibilityRole="button"
          accessibilityLabel={`Adicionar atividade manual em ${getPlanningBlockLabel(blockKey)}`}
          onPress={addManualLine}
          style={{
            alignSelf: "flex-start",
            minHeight: 32,
            borderRadius: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <GoAtletaIcon name="add" size={18} color={colors.text} />
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: "900" }}>
            Adicionar atividade
          </Text>
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
                  icon="view"
                  label="Ver"
                  testID={`planning-view-${blockKey}-${index}`}
                  onPress={() => onView(blockKey, index)}
                />
                <ActionButton
                  icon="trash"
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

function AddActivityButton({
  blockKey,
  onAdd,
}: {
  blockKey: TrainingPlanBlockKey;
  onAdd: (blockKey: TrainingPlanBlockKey) => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      testID={`planning-add-activity-${blockKey}`}
      accessibilityRole="button"
      accessibilityLabel={`Adicionar da biblioteca ou vídeo em ${getPlanningBlockLabel(blockKey)}`}
      onPress={() => onAdd(blockKey)}
      style={{
        width: 46,
        height: 46,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primaryBg,
      }}
    >
      <GoAtletaIcon name="playCircle" size={22} color={colors.primaryText} />
    </Pressable>
  );
}

function ActionButton({
  icon,
  label,
  testID,
  danger,
  onPress,
}: {
  icon: GoAtletaIconName;
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
      <GoAtletaIcon
        name={icon}
        size={16}
        color={danger ? colors.dangerText : colors.text}
      />
    </Pressable>
  );
}
