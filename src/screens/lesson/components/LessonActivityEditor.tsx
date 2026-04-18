import { Ionicons } from "@expo/vector-icons";
import { ScrollView, Text, TextInput, View } from "react-native";

import type { LessonActivity } from "../../../core/models";
import { Pressable } from "../../../ui/Pressable";
import { useAppTheme } from "../../../ui/app-theme";

type Props = {
  activities: LessonActivity[];
  onChange: (activities: LessonActivity[]) => void;
  maxHeight?: number;
};

const nextActivityId = () => `act_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

export function LessonActivityEditor({ activities, onChange, maxHeight = 280 }: Props) {
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
            </View>
          ))
        ) : (
          <Text style={{ color: colors.muted, fontSize: 13 }}>Sem atividades cadastradas.</Text>
        )}
      </ScrollView>
    </View>
  );
}
