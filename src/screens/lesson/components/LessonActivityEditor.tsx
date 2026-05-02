import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
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
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (expandedIndex === null) return;
    if (expandedIndex >= activities.length) {
      setExpandedIndex(activities.length ? activities.length - 1 : null);
    }
  }, [activities.length, expandedIndex]);

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
    setExpandedIndex(activities.length);
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
          activities.map((activity, index) => {
            const isExpanded = expandedIndex === index;
            const activityName = String(activity.name ?? "").trim() || "Atividade sem título";
            const description = String(activity.description ?? "").trim();

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
                  overflow: "hidden",
                }}
              >
                {isExpanded ? (
                  <>
                    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                      <View style={{ flex: 1, gap: 6, minWidth: 0 }}>
                        <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>Atividade</Text>
                        <TextInput
                          value={activity.name}
                          multiline
                          scrollEnabled
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
                            maxHeight: 96,
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
                        scrollEnabled
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
                          minHeight: 82,
                          maxHeight: 132,
                        }}
                      />
                    </View>
                    <Pressable
                      onPress={() => setExpandedIndex(null)}
                      style={{
                        alignSelf: "flex-end",
                        paddingVertical: 8,
                        paddingHorizontal: 10,
                        borderRadius: 10,
                        backgroundColor: colors.secondaryBg,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>Concluir</Text>
                    </Pressable>
                  </>
                ) : (
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }} numberOfLines={1}>
                        {activityName}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }} numberOfLines={2}>
                        {description || "Sem descrição."}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => setExpandedIndex(index)}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 10,
                        borderRadius: 10,
                        backgroundColor: colors.secondaryBg,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>Editar</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })
        ) : (
          <Text style={{ color: colors.muted, fontSize: 13 }}>Sem atividades cadastradas.</Text>
        )}
      </ScrollView>
    </View>
  );
}
