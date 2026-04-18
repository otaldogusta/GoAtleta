import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Text, TextInput, View } from "react-native";
import type { LessonActivity } from "../../../core/models";
import { ConfirmCloseOverlay } from "../../../ui/ConfirmCloseOverlay";
import { ModalSheet } from "../../../ui/ModalSheet";
import { Pressable } from "../../../ui/Pressable";
import { useAppTheme } from "../../../ui/app-theme";
import { LessonActivityEditor } from "../../lesson/components/LessonActivityEditor";

export type EditableBlockItem = LessonActivity;

export type BlockEditPayload = {
  durationMinutes: number;
  activities: EditableBlockItem[];
};

type BlockEditModalProps = {
  visible: boolean;
  title: string;
  durationMinutes: number;
  activities: EditableBlockItem[];
  saving?: boolean;
  onClose: () => void;
  onSave: (payload: BlockEditPayload) => Promise<boolean> | boolean;
};

export function BlockEditModal({
  visible,
  title,
  durationMinutes,
  activities,
  saving,
  onClose,
  onSave,
}: BlockEditModalProps) {
  const { colors } = useAppTheme();
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [draftDuration, setDraftDuration] = useState(String(durationMinutes));
  const [draftActivities, setDraftActivities] = useState<EditableBlockItem[]>(activities);
  const [baseline, setBaseline] = useState<BlockEditPayload>({
    durationMinutes,
    activities,
  });

  useEffect(() => {
    if (!visible) return;
    setDraftDuration(String(durationMinutes));
    setDraftActivities(activities.map((item) => ({ ...item })));
    setBaseline({
      durationMinutes,
      activities: activities.map((item) => ({ ...item })),
    });
    setShowCloseConfirm(false);
  }, [visible, durationMinutes, activities]);

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
      normalizedDraft !== normalizedBase
    );
  }, [draftDuration, draftActivities, baseline]);

  const buildPayload = (): BlockEditPayload => {
    const numeric = Number.parseInt(draftDuration.replace(/[^0-9]/g, ""), 10);
    const sanitizedDuration = Number.isFinite(numeric) && numeric > 0 ? numeric : durationMinutes;
    const sanitizedActivities = draftActivities
      .map((item) => ({
        name: String(item?.name ?? "").trim(),
        description: String(item?.description ?? "").trim(),
      }))
      .filter((item) => item.name);
    return {
      durationMinutes: sanitizedDuration,
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
              Edite duração, atividades e descrições.
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

        <LessonActivityEditor activities={draftActivities} onChange={setDraftActivities} maxHeight={280} />
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
