import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Text, TextInput, useWindowDimensions, View } from "react-native";

import type { DailyLessonPlan, LessonBlock } from "../../../core/models";
import { useAppTheme } from "../../../ui/app-theme";
import { ModalDialogFrame } from "../../../ui/ModalDialogFrame";
import { Pressable } from "../../../ui/Pressable";
import { useModalCardStyle } from "../../../ui/use-modal-card-style";
import { LessonBlocksEditor } from "../../lesson/components/LessonBlocksEditor";
import { resolveLessonBlocksFromDailyPlan } from "../application/daily-lesson-blocks";
import type { ProfessorCoachGuidance } from "../application/professor-agenda-events";
import { PlanningSyncStatusChip } from "./PlanningSyncStatusChip";

type Props = {
  visible: boolean;
  initialPlan: DailyLessonPlan | null;
  dayLabel: string;
  coachGuidance?: ProfessorCoachGuidance | null;
  onClose: () => void;
  onRegenerate?: () => Promise<void>;
  onExportPdf?: () => Promise<void>;
  onSave: (payload: { title: string; blocks: LessonBlock[]; observations: string }) => Promise<void>;
};

const FALLBACK_GUIDANCE: ProfessorCoachGuidance = {
  title: "Aula do dia",
  subtitle: "Conduza a aula com foco simples e decisão clara em quadra.",
  doNow: ["Comece com aquecimento com bola.", "Use uma tarefa principal com alvo claro."],
  avoidToday: ["Evite muitas regras ao mesmo tempo.", "Evite parar a aula por muito tempo."],
  advanceIf: ["A maioria cumprir a tarefa mantendo organização."],
  simplifyIf: ["A bola cair no primeiro contato.", "A turma perder a regra principal."],
};

const previewText = (value: string | undefined, fallback: string, limit = 90) => {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  const resolved = text || fallback;
  return resolved.length > limit ? `${resolved.slice(0, Math.max(0, limit - 3)).trimEnd()}...` : resolved;
};

function GuidanceList({
  title,
  items,
  colors,
}: {
  title: string;
  items: string[];
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  if (!items.length) return null;
  return (
    <View style={{ gap: 5, flex: 1, minWidth: 190 }}>
      <Text style={{ color: colors.text, fontSize: 12, fontWeight: "800" }}>{title}</Text>
      {items.slice(0, 3).map((item) => (
        <Text key={item} style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>
          {previewText(item, "")}
        </Text>
      ))}
    </View>
  );
}

function LessonBlockPreview({
  block,
  colors,
}: {
  block: LessonBlock;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  const firstActivity = block.activities[0];
  return (
    <View
      style={{
        gap: 5,
        padding: 10,
        borderRadius: 12,
        backgroundColor: colors.secondaryBg,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Text style={{ color: colors.text, fontSize: 12, fontWeight: "800" }}>{block.label}</Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>{block.durationMinutes}'</Text>
      </View>
      <Text style={{ color: colors.text, fontSize: 12, lineHeight: 17 }}>
        {previewText(firstActivity?.name || firstActivity?.description, "Atividade da aula")}
      </Text>
    </View>
  );
}

export function DayLessonPlanModal({
  visible,
  initialPlan,
  dayLabel,
  coachGuidance,
  onClose,
  onRegenerate,
  onExportPdf,
  onSave,
}: Props) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const isDrawer = width >= 900;
  const modalCardStyle = useModalCardStyle({
    maxWidth: isDrawer ? 520 : 760,
    maxHeight: isDrawer ? "100%" : "92%",
    radius: 18,
  });
  const [title, setTitle] = useState("");
  const [blocks, setBlocks] = useState<LessonBlock[]>([]);
  const [observations, setObservations] = useState("");
  const [isEditing, setIsEditing] = useState(false);
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
    setIsEditing(false);
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

  const guidance = coachGuidance ?? FALLBACK_GUIDANCE;
  const previewTitle = previewText(guidance.title || title || initialPlan?.title, "Aula do dia", 56);
  const previewObjective = previewText(guidance.subtitle || observations, "Conduza a aula com um objetivo claro.", 130);

  return (
    <ModalDialogFrame
      visible={visible}
      onClose={onClose}
      cardStyle={modalCardStyle}
      position={isDrawer ? "right" : "center"}
      colors={colors}
      title={dayLabel}
      subtitle={isEditing ? "Editar plano" : "Aula do dia"}
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
          {isEditing ? (
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
          ) : null}
        </View>
      }
    >
      {!isEditing ? (
        <View style={{ gap: 12 }}>
          <View
            style={{
              gap: 8,
              padding: 12,
              borderRadius: 16,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>Aula sugerida</Text>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>{previewTitle}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Editar plano da aula"
                onPress={() => setIsEditing(true)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Ionicons name="pencil" size={16} color={colors.text} />
              </Pressable>
            </View>
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>{previewObjective}</Text>
            {guidance.setupHint ? (
              <Text style={{ color: colors.text, fontSize: 12, lineHeight: 18 }}>
                {previewText(guidance.setupHint, "", 120)}
              </Text>
            ) : null}
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <GuidanceList title="Faça" items={guidance.doNow ?? []} colors={colors} />
            <GuidanceList title="Evite" items={guidance.avoidToday ?? []} colors={colors} />
            <GuidanceList title="Avance se" items={guidance.advanceIf ?? []} colors={colors} />
            <GuidanceList title="Simplifique se" items={guidance.simplifyIf ?? []} colors={colors} />
          </View>

          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}>Plano de quadra</Text>
            {blocks.map((block) => (
              <LessonBlockPreview key={block.key} block={block} colors={colors} />
            ))}
          </View>

          <PlanningSyncStatusChip compact status={initialPlan?.syncStatus ?? "in_sync"} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ width: "100%" }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
        >
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <PlanningSyncStatusChip status={initialPlan?.syncStatus ?? "in_sync"} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Voltar para resumo da aula"
                onPress={() => setIsEditing(false)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 10,
                  paddingVertical: 7,
                  borderRadius: 12,
                  backgroundColor: colors.secondaryBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Ionicons name="eye-outline" size={14} color={colors.text} />
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>Resumo</Text>
              </Pressable>
            </View>

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
      )}
    </ModalDialogFrame>
  );
}
