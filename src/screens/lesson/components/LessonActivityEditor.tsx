import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Platform, ScrollView, Text, TextInput, View } from "react-native";

import type { LessonActivity } from "../../../core/models";
import { ConfirmCloseOverlay } from "../../../ui/ConfirmCloseOverlay";
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
  const [pendingRemoveIndex, setPendingRemoveIndex] = useState<number | null>(null);
  const [lastRemoved, setLastRemoved] = useState<{
    activity: LessonActivity;
    index: number;
  } | null>(null);

  useEffect(() => {
    if (expandedIndex === null) return;
    if (expandedIndex >= activities.length) {
      setExpandedIndex(activities.length ? activities.length - 1 : null);
    }
  }, [activities.length, expandedIndex]);

  useEffect(() => {
    if (pendingRemoveIndex === null) return;
    if (pendingRemoveIndex >= activities.length) {
      setPendingRemoveIndex(null);
    }
  }, [activities.length, pendingRemoveIndex]);

  useEffect(() => {
    if (Platform.OS !== "web") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!lastRemoved) return;
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") return;

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (tagName === "input" || tagName === "textarea" || target?.isContentEditable) {
        return;
      }

      event.preventDefault();
      restoreLastRemoved();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activities, lastRemoved]);

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

  const removeActivity = () => {
    if (pendingRemoveIndex === null) return;
    const activity = activities[pendingRemoveIndex];
    if (!activity) {
      setPendingRemoveIndex(null);
      return;
    }

    setLastRemoved({ activity, index: pendingRemoveIndex });
    onChange(activities.filter((_, itemIndex) => itemIndex !== pendingRemoveIndex));
    setExpandedIndex(null);
    setPendingRemoveIndex(null);
  };

  const restoreLastRemoved = () => {
    if (!lastRemoved) return;
    const nextActivities = [...activities];
    const insertIndex = Math.min(Math.max(lastRemoved.index, 0), nextActivities.length);
    nextActivities.splice(insertIndex, 0, lastRemoved.activity);
    onChange(nextActivities);
    setExpandedIndex(insertIndex);
    setLastRemoved(null);
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
    <>
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

        {lastRemoved ? (
          <View
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              backgroundColor: colors.secondaryBg,
              paddingVertical: 8,
              paddingHorizontal: 10,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <Text style={{ color: colors.muted, fontSize: 12, flex: 1 }} numberOfLines={1}>
              Atividade removida.
            </Text>
            <Pressable onPress={restoreLastRemoved} style={{ paddingVertical: 4, paddingHorizontal: 8 }}>
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: "800" }}>Desfazer</Text>
            </Pressable>
          </View>
        ) : null}

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
                          onPress={() => setPendingRemoveIndex(index)}
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

      <ConfirmCloseOverlay
        visible={pendingRemoveIndex !== null}
        title="Remover atividade?"
        message="Essa atividade será removida do plano."
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        overlayZIndex={36000}
        onConfirm={removeActivity}
        onCancel={() => setPendingRemoveIndex(null)}
      />
    </>
  );
}
