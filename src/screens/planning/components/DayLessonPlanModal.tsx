import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from "react-native";

import type { DailyLessonPlan, LessonBlock } from "../../../core/models";
import { useAppTheme } from "../../../ui/app-theme";
import { ModalDialogFrame } from "../../../ui/ModalDialogFrame";
import { Pressable } from "../../../ui/Pressable";
import { useModalCardStyle } from "../../../ui/use-modal-card-style";
import { LessonBlocksEditor } from "../../lesson/components/LessonBlocksEditor";
import { resolveLessonBlocksFromDailyPlan } from "../application/daily-lesson-blocks";
import { PlanningSyncStatusChip } from "./PlanningSyncStatusChip";

type Props = {
  visible: boolean;
  initialPlan: DailyLessonPlan | null;
  dayLabel: string;
  onClose: () => void;
  onRegenerate?: () => Promise<void>;
  onExportPdf?: () => Promise<void>;
  onSave: (payload: { title: string; blocks: LessonBlock[]; observations: string }) => Promise<void>;
};

export function DayLessonPlanModal({ visible, initialPlan, dayLabel, onClose, onRegenerate, onExportPdf, onSave }: Props) {
  const { colors } = useAppTheme();
  const modalCardStyle = useModalCardStyle({ maxWidth: 760, maxHeight: "92%", radius: 18 });
  const [title, setTitle] = useState("");
  const [blocks, setBlocks] = useState<LessonBlock[]>([]);
  const [observations, setObservations] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(initialPlan?.title ?? "");
    setBlocks(
      resolveLessonBlocksFromDailyPlan({
        warmup: initialPlan?.warmup ?? "",
        mainPart: initialPlan?.mainPart ?? "",
        cooldown: initialPlan?.cooldown ?? "",
        blocksJson: initialPlan?.blocksJson,
      })
    );
    setObservations(initialPlan?.observations ?? "");
  }, [initialPlan, visible]);

  const inputStyle = useMemo(
    () => ({
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.inputBg,
      color: colors.text,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 13,
    }),
    [colors]
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        title: title.trim(),
        blocks,
        observations: observations.trim(),
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerate = async () => {
    if (!onRegenerate) return;
    setIsRegenerating(true);
    try {
      await onRegenerate();
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleExportPdf = async () => {
    if (!onExportPdf) return;
    setIsExportingPdf(true);
    try {
      await onExportPdf();
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <ModalDialogFrame
      visible={visible}
      onClose={onClose}
      cardStyle={modalCardStyle}
      position="center"
      colors={colors}
      title={dayLabel}
      subtitle="Plano diário"
      contentContainerStyle={{
        gap: 10,
        paddingTop: 12,
        paddingBottom: 24,
      }}
      footerStyle={{
        paddingTop: 10,
        paddingBottom: 4,
      }}
      footer={
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={() => {
              void handleExportPdf();
            }}
            disabled={isExportingPdf || !onExportPdf}
            style={{
              flex: 1,
              alignItems: "center",
              paddingVertical: 10,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.secondaryBg,
              opacity: onExportPdf ? 1 : 0.6,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              {isExportingPdf ? "Gerando PDF..." : "Baixar PDF"}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              void handleSave();
            }}
            disabled={isSaving}
            style={{
              flex: 1,
              alignItems: "center",
              paddingVertical: 10,
              borderRadius: 14,
              backgroundColor: isSaving ? colors.primaryDisabledBg : colors.primaryBg,
            }}
          >
            <Text style={{ color: isSaving ? colors.secondaryText : colors.primaryText, fontWeight: "700" }}>
              {isSaving ? "Salvando..." : "Salvar plano"}
            </Text>
          </Pressable>
        </View>
      }
    >
      <KeyboardAvoidingView
        style={{ width: "100%" }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        <View style={{ gap: 10 }}>
          <PlanningSyncStatusChip status={initialPlan?.syncStatus ?? "in_sync"} />

          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.muted, fontSize: 11 }}>Título da aula</Text>
            <TextInput
              placeholder="Tema da aula"
              placeholderTextColor={colors.placeholder}
              value={title}
              onChangeText={setTitle}
              style={inputStyle}
            />
          </View>

          <LessonBlocksEditor blocks={blocks} onChange={setBlocks} maxHeight={420} />

          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.muted, fontSize: 11 }}>Observações</Text>
            <TextInput
              multiline
              textAlignVertical="top"
              placeholder="Ajustes para próxima aula"
              placeholderTextColor={colors.placeholder}
              value={observations}
              onChangeText={setObservations}
              style={[inputStyle, { minHeight: 84 }]}
            />
          </View>

          <Pressable
            onPress={() => {
              void handleRegenerate();
            }}
            disabled={isRegenerating || !onRegenerate}
            style={{
              marginTop: 12,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: isRegenerating ? "rgba(239, 68, 68, 0.3)" : "rgba(239, 68, 68, 0.1)",
              borderWidth: 1,
              borderColor: "rgba(239, 68, 68, 0.5)",
              opacity: onRegenerate ? 1 : 0.5,
            }}
          >
            <Text style={{ color: "#ef4444", fontWeight: "700", textAlign: "center" }}>
              {isRegenerating ? "Gerando..." : "Gerar novamente"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ModalDialogFrame>
  );
}
