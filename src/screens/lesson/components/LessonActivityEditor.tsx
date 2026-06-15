import { Ionicons } from "@expo/vector-icons";
import { ScrollView, Text, TextInput, View } from "react-native";

import { getTrainingPlanActivitySourceLabel } from "../../../core/training-plan-activity-source";
import type { LessonActivity } from "../../../core/models";
import { Pressable } from "../../../ui/Pressable";
import { useAppTheme } from "../../../ui/app-theme";

type Props = {
  activities: LessonActivity[];
  onChange: (activities: LessonActivity[]) => void;
  maxHeight?: number;
  showStructuredDetails?: boolean;
};

const nextActivityId = () => `act_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

const structuredFields: Array<{ key: keyof LessonActivity; label: string }> = [
  { key: "organization", label: "Organização" },
  { key: "execution", label: "Execução" },
  { key: "coachFocus", label: "Foco do professor" },
  { key: "successCriteria", label: "Critério de sucesso" },
  { key: "adaptation", label: "Adaptação" },
];

export function LessonActivityEditor({
  activities,
  onChange,
  maxHeight = 280,
  showStructuredDetails = true,
}: Props) {
  const { colors } = useAppTheme();

  const updateActivity = (index: number, field: keyof LessonActivity, value: string) => {
    onChange(
      activities.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  };

  const removeActivity = (index: number) => {
    onChange(activities.filter((_, itemIndex) => itemIndex !== index));
  };

  const addActivity = () => {
    onChange([
      ...activities,
      {
        id: nextActivityId(),
        name: "",
        description: "",
      },
    ]);
  };

  return (
    <View style={{ gap: 8, flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>Atividades</Text>
        <Pressable
          onPress={addActivity}
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            backgroundColor: colors.secondaryBg,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="add" size={16} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView style={{ maxHeight }} contentContainerStyle={{ gap: 8 }} showsVerticalScrollIndicator>
        {activities.length ? (
          activities.map((activity, index) => (
            (() => {
              const sourceLabel = getTrainingPlanActivitySourceLabel(activity);
              const hasStructuredDetails =
                showStructuredDetails &&
                structuredFields.some(({ key }) =>
                  Boolean(String(activity[key] ?? "").trim())
                );
              return (
            <View
              key={activity.id || `activity_${index}`}
              style={{
                gap: 8,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
                padding: 10,
                backgroundColor: colors.card,
              }}
            >
              {sourceLabel ? (
                <View
                  testID="training-plan-activity-source-badge"
                  style={{
                    alignSelf: "flex-start",
                    paddingVertical: 3,
                    paddingHorizontal: 8,
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
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>Atividade</Text>
                  <TextInput
                    value={activity.name}
                    multiline
                    textAlignVertical="top"
                    onChangeText={(value) => updateActivity(index, "name", value)}
                    placeholder="Nome da atividade"
                    placeholderTextColor={colors.muted}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 12,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      backgroundColor: colors.inputBg,
                      color: colors.inputText,
                      fontSize: 14,
                      minHeight: 52,
                    }}
                  />
                </View>
                <Pressable
                  onPress={() => removeActivity(index)}
                  style={{
                    marginTop: 22,
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    backgroundColor: colors.secondaryBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="close" size={14} color={colors.muted} />
                </Pressable>
              </View>

              <View style={{ gap: 6 }}>
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>Descrição</Text>
                <TextInput
                  value={activity.description}
                  multiline
                  textAlignVertical="top"
                  onChangeText={(value) => updateActivity(index, "description", value)}
                  placeholder="Descreva como a atividade será conduzida"
                  placeholderTextColor={colors.muted}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    backgroundColor: colors.inputBg,
                    color: colors.inputText,
                    fontSize: 14,
                    minHeight: 72,
                  }}
                />
              </View>
              {hasStructuredDetails ? (
                <View style={{ gap: 8 }}>
                  {structuredFields.map(({ key, label }) => (
                    <View key={String(key)} style={{ gap: 6 }}>
                      <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                        {label}
                      </Text>
                      <TextInput
                        value={String(activity[key] ?? "")}
                        multiline
                        textAlignVertical="top"
                        onChangeText={(value) => updateActivity(index, key, value)}
                        placeholder={label}
                        placeholderTextColor={colors.muted}
                        style={{
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: 12,
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          backgroundColor: colors.inputBg,
                          color: colors.inputText,
                          fontSize: 14,
                          minHeight: 60,
                        }}
                      />
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
              );
            })()
          ))
        ) : (
          <Text style={{ color: colors.muted, fontSize: 13 }}>Sem atividades cadastradas.</Text>
        )}
      </ScrollView>
    </View>
  );
}
