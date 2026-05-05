import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Text, TextInput, useWindowDimensions, View } from "react-native";

import type { DailyLessonPlan, LessonBlock, SessionEnvironment } from "../../../core/models";
import { useAppTheme } from "../../../ui/app-theme";
import { ConfirmCloseOverlay } from "../../../ui/ConfirmCloseOverlay";
import { ModalDialogFrame } from "../../../ui/ModalDialogFrame";
import { Pressable } from "../../../ui/Pressable";
import { useModalCardStyle } from "../../../ui/use-modal-card-style";
import { LessonActivityEditor } from "../../lesson/components/LessonActivityEditor";
import {
  buildSessionEnvironmentLessonBlocks,
  ensureLessonBlocksMatchSessionEnvironment,
  resolveConservativeDailySessionEnvironment,
  resolveLessonBlocksFromDailyPlan,
} from "../application/daily-lesson-blocks";
import { PlanningSyncStatusChip } from "./PlanningSyncStatusChip";

type Props = {
  visible: boolean;
  initialPlan: DailyLessonPlan | null;
  dayLabel: string;
  onClose: () => void;
  onRegenerate?: () => Promise<void>;
  onExportPdf?: () => Promise<void>;
  onSave: (payload: {
    title: string;
    blocks: LessonBlock[];
    observations: string;
    sessionEnvironment: SessionEnvironment;
  }) => Promise<void>;
};

const SESSION_ENVIRONMENT_OPTIONS: {
  value: SessionEnvironment;
  label: string;
  description: string;
}[] = [
  { value: "quadra", label: "Quadra", description: "Técnico/tático" },
  { value: "academia", label: "Academia", description: "Treino resistido" },
  { value: "mista", label: "Mista", description: "Quadra + academia" },
];

const normalizeEditableSessionEnvironment = (value?: SessionEnvironment): SessionEnvironment =>
  value === "academia" || value === "mista" ? value : "quadra";

const normalizeLessonBlocks = (blocks: LessonBlock[]) =>
  blocks.map((block) => ({
    key: String(block?.key ?? ""),
    label: String(block?.label ?? ""),
    durationMinutes: Number(block?.durationMinutes ?? 0),
    activities: (block?.activities ?? []).map((activity) => ({
      name: String(activity?.name ?? "").trim(),
      description: String(activity?.description ?? "").trim(),
      sets: String(activity?.sets ?? "").trim(),
      reps: String(activity?.reps ?? "").trim(),
      rest: String(activity?.rest ?? "").trim(),
      notes: String(activity?.notes ?? "").trim(),
    })),
  }));

const buildSnapshot = (payload: {
  title: string;
  blocks: LessonBlock[];
  observations: string;
  sessionEnvironment: SessionEnvironment;
}) =>
  JSON.stringify({
    title: payload.title.trim(),
    observations: payload.observations.trim(),
    sessionEnvironment: payload.sessionEnvironment,
    blocks: normalizeLessonBlocks(payload.blocks),
  });

const hasFilledLessonContent = (blocks: LessonBlock[]) =>
  blocks.some((block) =>
    (block.activities ?? []).some(
      (activity) =>
        activity.name?.trim() ||
        activity.description?.trim() ||
        String(activity.sets ?? "").trim() ||
        activity.reps?.trim() ||
        activity.rest?.trim() ||
        activity.notes?.trim()
    )
  );

const isWorkoutBlock = (block: LessonBlock | null) => {
  if (!block) return false;
  const label = String(block.label ?? "");
  if (/treino\s+resistido|academia/i.test(label)) return true;
  return (block.activities ?? []).some(
    (activity) =>
      String(activity.sets ?? "").trim() ||
      String(activity.reps ?? "").trim() ||
      String(activity.rest ?? "").trim()
  );
};

const sessionEnvironmentChangeCopy: Record<
  SessionEnvironment,
  { title: string; message: string }
> = {
  quadra: {
    title: "Adaptar para aula de quadra",
    message:
      "Essa mudança remove a estrutura resistida e volta para uma aula de quadra. Deseja continuar?",
  },
  academia: {
    title: "Adaptar para treino resistido",
    message:
      "Essa mudança adapta a estrutura do plano para treino resistido. As atividades atuais de quadra podem ser substituídas. Deseja continuar?",
  },
  mista: {
    title: "Adaptar para sessão mista",
    message:
      "Essa mudança divide a sessão entre quadra e academia. Revise os tempos para garantir que a aula caiba no horário.",
  },
  preventiva: {
    title: "Adaptar estrutura",
    message: "Essa mudança adapta a estrutura do plano. Deseja continuar?",
  },
};

export function DayLessonPlanModal({ visible, initialPlan, dayLabel, onClose, onRegenerate, onExportPdf, onSave }: Props) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const isCompact = width < 760;
  const modalCardStyle = useModalCardStyle({
    maxWidth: 1040,
    maxHeight: Platform.OS === "web" ? "90vh" : "92%",
    radius: isCompact ? 0 : 18,
    fullWidth: isCompact,
    padding: isCompact ? 16 : 28,
  });
  const [title, setTitle] = useState("");
  const [blocks, setBlocks] = useState<LessonBlock[]>([]);
  const [observations, setObservations] = useState("");
  const [sessionEnvironment, setSessionEnvironment] = useState<SessionEnvironment>("quadra");
  const [activeBlockKey, setActiveBlockKey] = useState<string | null>(null);
  const [baselineSnapshot, setBaselineSnapshot] = useState("");
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [pendingSessionEnvironment, setPendingSessionEnvironment] = useState<SessionEnvironment | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const rawResolvedBlocks = resolveLessonBlocksFromDailyPlan({
      warmup: initialPlan?.warmup ?? "",
      mainPart: initialPlan?.mainPart ?? "",
      cooldown: initialPlan?.cooldown ?? "",
      blocksJson: initialPlan?.blocksJson,
    });
    const resolvedTitle = initialPlan?.title ?? "";
    const resolvedObservations = initialPlan?.observations ?? "";
    const resolvedSessionEnvironment = normalizeEditableSessionEnvironment(
      resolveConservativeDailySessionEnvironment(initialPlan, rawResolvedBlocks)
    );
    const resolvedBlocks = ensureLessonBlocksMatchSessionEnvironment(
      rawResolvedBlocks,
      resolvedSessionEnvironment,
      rawResolvedBlocks.reduce((sum, block) => sum + Number(block.durationMinutes ?? 0), 0) || 60
    );
    setTitle(initialPlan?.title ?? "");
    setBlocks(resolvedBlocks);
    setObservations(resolvedObservations);
    setSessionEnvironment(resolvedSessionEnvironment);
    setActiveBlockKey(resolvedBlocks[1]?.key ?? resolvedBlocks[0]?.key ?? null);
    setBaselineSnapshot(
      buildSnapshot({
        title: resolvedTitle,
        blocks: resolvedBlocks,
        observations: resolvedObservations,
        sessionEnvironment: resolvedSessionEnvironment,
      })
    );
    setShowCloseConfirm(false);
    setPendingSessionEnvironment(null);
  }, [initialPlan, visible]);

  useEffect(() => {
    if (!blocks.length) {
      setActiveBlockKey(null);
      return;
    }
    if (activeBlockKey === "observations") {
      return;
    }
    if (!activeBlockKey || !blocks.some((block) => block.key === activeBlockKey)) {
      setActiveBlockKey(blocks[0]?.key ?? null);
    }
  }, [activeBlockKey, blocks]);

  const currentSnapshot = useMemo(
    () => buildSnapshot({ title, blocks, observations, sessionEnvironment }),
    [title, blocks, observations, sessionEnvironment]
  );

  const hasChanges = baselineSnapshot.length > 0 && currentSnapshot !== baselineSnapshot;

  const activeBlock = useMemo(
    () => blocks.find((block) => block.key === activeBlockKey) ?? null,
    [activeBlockKey, blocks]
  );

  const totalDuration = useMemo(
    () => blocks.reduce((sum, block) => sum + Number(block.durationMinutes ?? 0), 0),
    [blocks]
  );

  const totalActivities = useMemo(
    () => blocks.reduce((sum, block) => sum + (block.activities?.length ?? 0), 0),
    [blocks]
  );

  const updateBlock = (key: string, nextBlock: LessonBlock) => {
    setBlocks((currentBlocks) =>
      currentBlocks.map((block) => (block.key === key ? nextBlock : block))
    );
  };

  const applySessionEnvironmentChange = (nextEnvironment: SessionEnvironment) => {
    const nextBlocks = buildSessionEnvironmentLessonBlocks(
      nextEnvironment,
      totalDuration || 60
    );
    setSessionEnvironment(nextEnvironment);
    setBlocks(nextBlocks);
    setActiveBlockKey(nextBlocks[1]?.key ?? nextBlocks[0]?.key ?? null);
    setPendingSessionEnvironment(null);
  };

  const requestSessionEnvironmentChange = (nextEnvironment: SessionEnvironment) => {
    if (nextEnvironment === sessionEnvironment) return;
    if (hasFilledLessonContent(blocks)) {
      setPendingSessionEnvironment(nextEnvironment);
      return;
    }
    applySessionEnvironmentChange(nextEnvironment);
  };

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
    if (!hasChanges || isSaving) return;
    setIsSaving(true);
    try {
      await onSave({
        title: title.trim(),
        blocks,
        observations: observations.trim(),
        sessionEnvironment,
      });
      setBaselineSnapshot(currentSnapshot);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const requestClose = () => {
    if (hasChanges && !isSaving) {
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
    <>
      <ModalDialogFrame
        visible={visible}
        onClose={requestClose}
        cardStyle={modalCardStyle}
        position="center"
        colors={colors}
        title="Editar plano diário"
        subtitle={dayLabel}
        headerAddon={<PlanningSyncStatusChip status={initialPlan?.syncStatus ?? "in_sync"} />}
        contentContainerStyle={{
          gap: 16,
          paddingTop: 18,
          paddingBottom: 28,
        }}
        bodyStyle={{
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
        }}
        footerStyle={{
          paddingTop: 14,
          paddingBottom: 0,
        }}
        footer={
          <View
            style={{
              flexDirection: isCompact ? "column" : "row",
              gap: 10,
            }}
          >
            <Pressable
              onPress={() => {
                void handleExportPdf();
              }}
              disabled={isExportingPdf || !onExportPdf}
              style={{
                flex: 1,
                alignItems: "center",
                paddingVertical: 13,
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
              disabled={!hasChanges || isSaving}
              style={{
                flex: 1,
                alignItems: "center",
                paddingVertical: 13,
                borderRadius: 14,
                backgroundColor: hasChanges && !isSaving ? colors.primaryBg : colors.primaryDisabledBg,
                opacity: hasChanges || isSaving ? 1 : 0.55,
              }}
            >
              <Text style={{ color: hasChanges && !isSaving ? colors.primaryText : colors.secondaryText, fontWeight: "700" }}>
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
          <View style={{ gap: 16 }}>
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>Título da aula</Text>
              <TextInput
                placeholder="Tema da aula"
                placeholderTextColor={colors.placeholder}
                value={title}
                onChangeText={setTitle}
                style={inputStyle}
              />
            </View>

            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>Tipo de sessão</Text>
              <View
                style={{
                  flexDirection: isCompact ? "column" : "row",
                  gap: 8,
                }}
              >
                {SESSION_ENVIRONMENT_OPTIONS.map((option) => {
                  const selected = sessionEnvironment === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => requestSessionEnvironmentChange(option.value)}
                      style={{
                        flex: 1,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: selected ? "#2f855a" : colors.border,
                        backgroundColor: selected ? "rgba(47, 133, 90, 0.1)" : colors.secondaryBg,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        gap: 3,
                      }}
                    >
                      <Text style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}>
                        {option.label}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 11 }} numberOfLines={1}>
                        {option.description}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {sessionEnvironment === "mista" && totalDuration <= 60 ? (
                <Text style={{ color: colors.warningText, fontSize: 11, lineHeight: 15 }}>
                  Aula mista em {totalDuration} min pode reduzir a qualidade da execução.
                </Text>
              ) : null}
            </View>

            <View
              style={{
                flexDirection: isCompact ? "column" : "row",
                gap: 16,
                alignItems: "stretch",
              }}
            >
              <View
                style={{
                  flex: isCompact ? undefined : 0.8,
                  gap: 12,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  padding: 16,
                  minWidth: isCompact ? undefined : 260,
                }}
              >
                <View>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}>Estrutura da aula</Text>
                  <Text style={{ color: colors.muted, marginTop: 4, fontSize: 12 }}>
                    {totalDuration} min · {blocks.length} blocos · {totalActivities} atividades
                  </Text>
                </View>

                <View style={{ gap: 8 }}>
                  {blocks.map((block) => {
                    const selected = block.key === activeBlockKey;
                    return (
                      <Pressable
                        key={block.key}
                        onPress={() => setActiveBlockKey(block.key)}
                        style={{
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: selected ? "#2f855a" : colors.border,
                          backgroundColor: selected ? "rgba(47, 133, 90, 0.1)" : colors.secondaryBg,
                          paddingVertical: 12,
                          paddingHorizontal: 12,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                        }}
                      >
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }} numberOfLines={1}>
                            {block.label}
                          </Text>
                          <Text style={{ color: colors.muted, marginTop: 4, fontSize: 12 }} numberOfLines={1}>
                            {block.durationMinutes} min · {block.activities?.length ?? 0} atividade
                            {(block.activities?.length ?? 0) === 1 ? "" : "s"}
                          </Text>
                        </View>
                        {selected ? (
                          <View
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 999,
                              backgroundColor: "#2f855a",
                            }}
                          />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable
                  onPress={() => setActiveBlockKey("observations")}
                  style={{
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: activeBlockKey === "observations" ? "#2f855a" : colors.border,
                    backgroundColor: activeBlockKey === "observations" ? "rgba(47, 133, 90, 0.1)" : colors.secondaryBg,
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>Observações</Text>
                  <Text style={{ color: colors.muted, marginTop: 6, fontSize: 12, lineHeight: 16 }} numberOfLines={3}>
                    {observations || "Sem observações para este plano."}
                  </Text>
                </Pressable>
              </View>

              <View
                style={{
                  flex: 1.9,
                  gap: 14,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  padding: 18,
                  minHeight: isCompact ? 360 : 430,
                  overflow: "hidden",
                }}
              >
                {activeBlockKey === "observations" ? (
                  <>
                    <View>
                      <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>Observações</Text>
                      <Text style={{ color: colors.muted, marginTop: 4, fontSize: 12 }}>
                        Ajustes e lembretes que aparecem no plano salvo.
                      </Text>
                    </View>
                    <TextInput
                      multiline
                      scrollEnabled
                      textAlignVertical="top"
                      placeholder="Ajustes para próxima aula"
                      placeholderTextColor={colors.placeholder}
                      value={observations}
                      onChangeText={setObservations}
                      style={[inputStyle, { minHeight: 220, maxHeight: 360 }]}
                    />
                  </>
                ) : activeBlock ? (
                  <>
                    <View
                      style={{
                        flexDirection: isCompact ? "column" : "row",
                        alignItems: isCompact ? "stretch" : "flex-start",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900" }} numberOfLines={1}>
                          {activeBlock.label}
                        </Text>
                        <Text style={{ color: colors.muted, marginTop: 4, fontSize: 12 }} numberOfLines={2}>
                          {activeBlock.durationMinutes} min · edite as atividades que aparecem no PDF e na Aula do dia
                        </Text>
                      </View>

                      <TextInput
                        value={String(activeBlock.durationMinutes)}
                        keyboardType="numeric"
                        inputMode="numeric"
                        onChangeText={(value) => {
                          const numeric = Number.parseInt(value.replace(/[^0-9]/g, ""), 10);
                          updateBlock(activeBlock.key, {
                            ...activeBlock,
                            durationMinutes:
                              Number.isFinite(numeric) && numeric > 0
                                ? numeric
                                : activeBlock.durationMinutes,
                          });
                        }}
                        style={[
                          inputStyle,
                          {
                            width: isCompact ? "100%" : 116,
                            textAlign: "center",
                            fontWeight: "800",
                          },
                        ]}
                      />
                    </View>

                    <LessonActivityEditor
                      activities={activeBlock.activities}
                      onChange={(activities) => updateBlock(activeBlock.key, { ...activeBlock, activities })}
                      maxHeight={isCompact ? 310 : 390}
                      variant={isWorkoutBlock(activeBlock) ? "workout" : "lesson"}
                    />
                  </>
                ) : (
                  <Text style={{ color: colors.muted }}>Nenhum bloco disponível.</Text>
                )}
              </View>
            </View>

            <Pressable
              onPress={() => {
                void handleRegenerate();
              }}
              disabled={isRegenerating || !onRegenerate}
              style={{
                alignSelf: isCompact ? "stretch" : "center",
                minWidth: isCompact ? undefined : 280,
                alignItems: "center",
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 14,
                backgroundColor: "rgba(239, 68, 68, 0.06)",
                borderWidth: 1,
                borderColor: isRegenerating ? "rgba(239, 68, 68, 0.28)" : "rgba(239, 68, 68, 0.55)",
                opacity: onRegenerate ? 1 : 0.5,
              }}
            >
              <Text style={{ color: "#ef4444", fontWeight: "800" }}>
                {isRegenerating ? "Gerando..." : "Gerar novamente"}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </ModalDialogFrame>

      <ConfirmCloseOverlay
        visible={showCloseConfirm}
        title="Alterações não salvas"
        message="Deseja salvar as alterações antes de fechar?"
        confirmLabel="Salvar"
        cancelLabel="Descartar"
        overlayZIndex={34000}
        onConfirm={() => {
          void handleSaveAndClose();
        }}
        onCancel={handleDiscard}
      />

      <ConfirmCloseOverlay
        visible={Boolean(pendingSessionEnvironment)}
        title={
          pendingSessionEnvironment
            ? sessionEnvironmentChangeCopy[pendingSessionEnvironment].title
            : "Adaptar estrutura"
        }
        message={
          pendingSessionEnvironment
            ? sessionEnvironmentChangeCopy[pendingSessionEnvironment].message
            : "Deseja adaptar a estrutura do plano?"
        }
        confirmLabel="Continuar"
        cancelLabel="Cancelar"
        overlayZIndex={35000}
        onConfirm={() => {
          if (pendingSessionEnvironment) {
            applySessionEnvironmentChange(pendingSessionEnvironment);
          }
        }}
        onCancel={() => setPendingSessionEnvironment(null)}
      />
    </>
  );
}
