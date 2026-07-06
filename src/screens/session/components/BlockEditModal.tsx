import { useEffect, useMemo, useState } from "react";
import { Platform, Text, TextInput, View } from "react-native";
import type { LessonActivity } from "../../../core/models";
import { buildActivityPlanText } from "../../../pdf/activity-plan-text";
import { radius } from "../../../theme/tokens";
import { ConfirmCloseOverlay } from "../../../ui/ConfirmCloseOverlay";
import { ModalSheet } from "../../../ui/ModalSheet";
import { Pressable } from "../../../ui/Pressable";
import { useAppTheme } from "../../../ui/app-theme";
import { GoAtletaIcon } from "../../../ui/icon-registry";
import { useModalCardStyle } from "../../../ui/use-modal-card-style";
import { LessonActivityEditor } from "../../lesson/components/LessonActivityEditor";

export type EditableBlockItem = LessonActivity;

export type BlockEditPayload = {
  durationMinutes: number;
  activities: EditableBlockItem[];
};

const normalizeInline = (value: string | null | undefined) =>
  String(value ?? "").replace(/\s+/g, " ").trim();

const toVisibleActivity = (activity: EditableBlockItem): EditableBlockItem => ({
  ...activity,
  name: normalizeInline(activity.name),
  description: buildActivityPlanText(activity),
});

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
  const modalCardStyle = useModalCardStyle({
    maxWidth: 640,
    maxHeight: Platform.OS === "web" ? "82%" : "90%",
    padding: 14,
    radius: radius.container,
    gap: 12,
  });
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [draftDuration, setDraftDuration] = useState(String(durationMinutes));
  const [draftActivities, setDraftActivities] = useState<EditableBlockItem[]>(activities);
  const [baseline, setBaseline] = useState<BlockEditPayload>({
    durationMinutes,
    activities,
  });

  useEffect(() => {
    if (!visible) return;
    const visibleActivities = activities.map((item) => toVisibleActivity({ ...item }));
    setDraftDuration(String(durationMinutes));
    setDraftActivities(visibleActivities);
    setBaseline({
      durationMinutes,
      activities: visibleActivities.map((item) => ({ ...item })),
    });
    setShowCloseConfirm(false);
  }, [visible, durationMinutes, activities]);

  const hasChanges = useMemo(() => {
    const draftDurationValue = Number.parseInt(draftDuration.replace(/[^0-9]/g, ""), 10);
    const normalizedDraft = JSON.stringify(
      draftActivities.map((item) => ({
        name: String(item?.name ?? "").trim(),
        description: String(item?.description ?? "").trim(),
        organization: String(item?.organization ?? "").trim(),
        execution: String(item?.execution ?? "").trim(),
        coachFocus: String(item?.coachFocus ?? "").trim(),
        successCriteria: String(item?.successCriteria ?? "").trim(),
        adaptation: String(item?.adaptation ?? "").trim(),
      }))
    );
    const normalizedBase = JSON.stringify(
      baseline.activities.map((item) => ({
        name: String(item?.name ?? "").trim(),
        description: String(item?.description ?? "").trim(),
        organization: String(item?.organization ?? "").trim(),
        execution: String(item?.execution ?? "").trim(),
        coachFocus: String(item?.coachFocus ?? "").trim(),
        successCriteria: String(item?.successCriteria ?? "").trim(),
        adaptation: String(item?.adaptation ?? "").trim(),
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
      .map((item) => {
        const visibleDescription =
          normalizeInline(item?.description) || buildActivityPlanText(item);
        const nextPresentation = item?.presentation
          ? {
              ...item.presentation,
              standardText: visibleDescription,
            }
          : visibleDescription
            ? { standardText: visibleDescription }
            : item?.presentation;
        const next: EditableBlockItem = {
          ...item,
          name: normalizeInline(item?.name),
          description: visibleDescription,
          organization: normalizeInline(item?.organization) || undefined,
          execution: normalizeInline(item?.execution) || undefined,
          coachFocus: normalizeInline(item?.coachFocus) || undefined,
          successCriteria: normalizeInline(item?.successCriteria) || undefined,
          adaptation: normalizeInline(item?.adaptation) || undefined,
          primarySkill: item?.primarySkill,
          presentation: nextPresentation,
        };
        return next;
      })
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
        cardStyle={modalCardStyle}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "900" }}>
              {title}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              Edite duração, atividades e descrições.
            </Text>
          </View>
          <Pressable
            onPress={requestClose}
            disabled={saving}
            style={{
              width: 32,
              height: 32,
              borderRadius: radius.full,
              backgroundColor: colors.backgroundSubtle,
              borderWidth: 1,
              borderColor: colors.borderSubtle,
              alignItems: "center",
              justifyContent: "center",
              marginTop: 2,
            }}
          >
            <GoAtletaIcon name="close" size={18} color={colors.textPrimary} />
          </Pressable>
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "800" }}>
            Duração (min)
          </Text>
          <TextInput
            value={draftDuration}
            keyboardType="numeric"
            inputMode="numeric"
            onChangeText={setDraftDuration}
            style={{
              borderWidth: 1,
              borderColor: colors.borderSubtle,
              borderRadius: radius.internal,
              paddingVertical: 10,
              paddingHorizontal: 12,
              backgroundColor: colors.inputBg,
              color: colors.textPrimary,
              fontSize: 15,
              fontWeight: "600",
            }}
          />
        </View>

        <LessonActivityEditor
          activities={draftActivities}
          onChange={setDraftActivities}
          maxHeight={Platform.OS === "web" ? 360 : 300}
          showStructuredDetails={false}
        />
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
