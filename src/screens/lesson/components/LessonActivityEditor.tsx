import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Animated, Platform, ScrollView, Text, TextInput, View } from "react-native";

import type { LessonActivity } from "../../../core/models";
import { ConfirmCloseOverlay } from "../../../ui/ConfirmCloseOverlay";
import { Pressable } from "../../../ui/Pressable";
import { useAppTheme } from "../../../ui/app-theme";
import { useCollapsibleAnimation } from "../../../ui/use-collapsible";

type Props = {
  activities: LessonActivity[];
  onChange: (activities: LessonActivity[]) => void;
  maxHeight?: number;
  variant?: "lesson" | "workout";
};

const nextActivityId = () => `act_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

function LessonActivityEditorCard({
  activity,
  index,
  isExpanded,
  onEdit,
  onDone,
  onRemove,
  onUpdate,
  variant,
}: {
  activity: LessonActivity;
  index: number;
  isExpanded: boolean;
  onEdit: () => void;
  onDone: () => void;
  onRemove: () => void;
  onUpdate: (index: number, field: keyof LessonActivity, value: string) => void;
  variant: "lesson" | "workout";
}) {
  const { colors } = useAppTheme();
  const { animatedStyle, isVisible } = useCollapsibleAnimation(isExpanded, {
    durationIn: 220,
    durationOut: 180,
    translateY: -8,
  });
  const activityName = String(activity.name ?? "").trim() || "Atividade sem título";
  const description = String(activity.description ?? "").trim();
  const sets = String(activity.sets ?? "").trim();
  const reps = String(activity.reps ?? "").trim();
  const rest = String(activity.rest ?? "").trim();
  const notes = String(activity.notes ?? "").trim();
  const prescription = [sets ? `${sets} séries` : "", reps ? `${reps} reps` : "", rest]
    .filter(Boolean)
    .join(" · ");

  return (
    <View
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
      {isVisible ? (
        <Animated.View style={[animatedStyle, { gap: 8, pointerEvents: isExpanded ? "auto" : "none" }]}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
            <View style={{ flex: 1, gap: 6, minWidth: 0 }}>
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>Atividade</Text>
              <TextInput
                value={activity.name}
                multiline
                scrollEnabled
                textAlignVertical="top"
                onChangeText={(value) => onUpdate(index, "name", value)}
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
              onPress={onRemove}
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

          {variant === "workout" ? (
            <>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                {([
                  ["sets", "Séries", "3"],
                  ["reps", "Repetições", "8–10"],
                  ["rest", "Intervalo", "75–90s"],
                ] as const).map(([field, label, placeholder]) => (
                  <View key={field} style={{ flex: 1, minWidth: 112, gap: 6 }}>
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                      {label}
                    </Text>
                    <TextInput
                      value={String(activity[field] ?? "")}
                      onChangeText={(value) => onUpdate(index, field, value)}
                      placeholder={placeholder}
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
                      }}
                    />
                  </View>
                ))}
              </View>
              <View style={{ gap: 6 }}>
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                  Observação curta opcional
                </Text>
                <TextInput
                  value={activity.notes ?? ""}
                  multiline
                  scrollEnabled
                  textAlignVertical="top"
                  onChangeText={(value) => onUpdate(index, "notes", value)}
                  placeholder="Ex.: executar rápido, sem chegar à falha"
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
                    minHeight: 58,
                    maxHeight: 96,
                  }}
                />
              </View>
            </>
          ) : (
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>Descrição</Text>
              <TextInput
                value={activity.description}
                multiline
                scrollEnabled
                textAlignVertical="top"
                onChangeText={(value) => onUpdate(index, "description", value)}
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
          )}
          <Pressable
            onPress={onDone}
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
        </Animated.View>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }} numberOfLines={1}>
              {activityName}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }} numberOfLines={2}>
              {variant === "workout"
                ? prescription || notes || "Sem prescrição."
                : description || "Sem descrição."}
            </Text>
          </View>
          <Pressable
            onPress={onEdit}
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
}

export function LessonActivityEditor({ activities, onChange, maxHeight = 280, variant = "lesson" }: Props) {
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
      variant === "workout"
        ? {
            id: nextActivityId(),
            name: "",
            description: "",
            sets: "3",
            reps: "8–10",
            rest: "75–90s",
          }
        : {
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
              return (
                <LessonActivityEditorCard
                  key={activity.id || `activity_${index}`}
                  activity={activity}
                  index={index}
                  isExpanded={expandedIndex === index}
                  onEdit={() => setExpandedIndex(index)}
                  onDone={() => setExpandedIndex(null)}
                  onRemove={() => setPendingRemoveIndex(index)}
                  onUpdate={updateActivity}
                  variant={variant}
                />
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
