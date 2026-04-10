import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { ConfirmCloseOverlay } from "../../../ui/ConfirmCloseOverlay";
import { ModalSheet } from "../../../ui/ModalSheet";
import { Pressable } from "../../../ui/Pressable";
import { useAppTheme } from "../../../ui/app-theme";

export type EditableBlockItem = {
  name: string;
  description: string;
};

export type BlockEditPayload = {
  durationMinutes: number;
  summary: string;
  activities: EditableBlockItem[];
};

type BlockEditModalProps = {
  visible: boolean;
  title: string;
  durationMinutes: number;
  summary: string;
  activities: EditableBlockItem[];
  saving?: boolean;
  onClose: () => void;
  onSave: (payload: BlockEditPayload) => Promise<boolean> | boolean;
};

export function BlockEditModal({
  visible,
  title,
  durationMinutes,
  summary,
  activities,
  saving,
  onClose,
  onSave,
}: BlockEditModalProps) {
  const { colors } = useAppTheme();
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [draftDuration, setDraftDuration] = useState(String(durationMinutes));
  const [draftSummary, setDraftSummary] = useState(summary);
  const [draftActivities, setDraftActivities] = useState<EditableBlockItem[]>(activities);
  const [baseline, setBaseline] = useState<BlockEditPayload>({
    durationMinutes,
    summary,
    activities,
  });

  useEffect(() => {
    if (!visible) return;
    setDraftDuration(String(durationMinutes));
    setDraftSummary(summary);
    setDraftActivities(activities.map((item) => ({ ...item })));
    setBaseline({
      durationMinutes,
      summary,
      activities: activities.map((item) => ({ ...item })),
    });
    setShowCloseConfirm(false);
  }, [visible, durationMinutes, summary, activities]);

  const hasChanges = useMemo(() => {
    const draftDurationValue = Number.parseInt(draftDuration.replace(/[^0-9]/g, ""), 10);
    const normalizedDraft = JSON.stringify(
      draftActivities.map((item) => ({
        name: String(item?.name ?? "").trim(),
        description: String(item?.description ?? "").trim(),
      }))
    );
    const normalizedBase = JSON.stringify(
      baseline.activities.map((item) => ({
        name: String(item?.name ?? "").trim(),
        description: String(item?.description ?? "").trim(),
      }))
    );
    return (
      draftDurationValue !== baseline.durationMinutes ||
      String(draftSummary ?? "").trim() !== String(baseline.summary ?? "").trim() ||
      normalizedDraft !== normalizedBase
    );
  }, [draftDuration, draftSummary, draftActivities, baseline]);

  const buildPayload = (): BlockEditPayload => {
    const numeric = Number.parseInt(draftDuration.replace(/[^0-9]/g, ""), 10);
    const sanitizedDuration = Number.isFinite(numeric) && numeric > 0 ? numeric : durationMinutes;
    const sanitizedSummary = String(draftSummary ?? "").trim();
    const sanitizedActivities = draftActivities
      .map((item) => ({
        name: String(item?.name ?? "").trim(),
        description: String(item?.description ?? "").trim(),
      }))
      .filter((item) => item.name);
    return {
      durationMinutes: sanitizedDuration,
      summary: sanitizedSummary,
      activities: sanitizedActivities,
    };
  };

  const handleSave = async () => {
    const ok = await Promise.resolve(onSave(buildPayload()));
    return ok !== false;
  };

  const requestClose = () => {
    if (hasChanges && !saving) {
      setShowCloseConfirm(true);
      return;
    }
    onClose();
  };

  const handleDiscard = () => {
    setShowCloseConfirm(false);
    onClose();
  };

  const handleSaveAndClose = async () => {
    setShowCloseConfirm(false);
    await handleSave();
    onClose();
  };

  const updateActivity = (
    index: number,
    field: keyof EditableBlockItem,
    value: string
  ) => {
    setDraftActivities((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    );
  };

  const removeActivity = (index: number) => {
    setDraftActivities((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const addActivity = () => {
    setDraftActivities((current) => [...current, { name: "", description: "" }]);
  };

  return (
    <>
      <ModalSheet
        visible={visible}
        onClose={requestClose}
        position="center"
        overlayZIndex={33000}
        backdropOpacity={0.72}
        cardStyle={{
          width: "100%",
          maxWidth: 760,
          maxHeight: "85%",
          borderRadius: 22,
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 16,
          gap: 12,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>
              {title}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              Edite duração, resumo, atividades e descrições.
            </Text>
          </View>
          <Pressable
            onPress={requestClose}
            disabled={saving}
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
              marginTop: 2,
            }}
          >
            <Ionicons name="close" size={18} color={colors.text} />
          </Pressable>
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
            Duração (min)
          </Text>
          <TextInput
            value={draftDuration}
            keyboardType="numeric"
            inputMode="numeric"
            onChangeText={setDraftDuration}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              paddingVertical: 10,
              paddingHorizontal: 12,
              backgroundColor: colors.inputBg,
              color: colors.inputText,
              fontSize: 15,
              fontWeight: "600",
            }}
          />
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
            Resumo
          </Text>
          <TextInput
            value={draftSummary}
            multiline
            textAlignVertical="top"
            onChangeText={setDraftSummary}
            placeholder="Resumo do bloco"
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

        <View style={{ gap: 8, flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
              Atividades
            </Text>
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
          <ScrollView
            style={{ maxHeight: 280 }}
            contentContainerStyle={{ gap: 8 }}
            showsVerticalScrollIndicator={true}
          >
            {draftActivities.length ? (
              draftActivities.map((activity, index) => (
                <View
                  key={`activity_${index}`}
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
                      <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                        Atividade
                      </Text>
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
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                      Descrição
                    </Text>
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
              <Text style={{ color: colors.muted, fontSize: 13 }}>
                Sem atividades cadastradas.
              </Text>
            )}
          </ScrollView>
        </View>
      </ModalSheet>

      <ConfirmCloseOverlay
        visible={showCloseConfirm}
        title="Alterações não salvas"
        message="Deseja salvar as alterações antes de fechar?"
        confirmLabel="Salvar"
        cancelLabel="Descartar"
        overlayZIndex={34000}
        onConfirm={handleSaveAndClose}
        onCancel={handleDiscard}
      />
    </>
  );
}
