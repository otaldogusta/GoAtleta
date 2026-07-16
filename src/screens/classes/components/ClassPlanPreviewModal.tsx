import { createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";

import { ptBR } from "../../../constants/copy/pt-br";
import type { ClassGroup, TrainingPlan } from "../../../core/models";
import {
  resolveTrainingPlanBlock,
  type TrainingPlanBlockKey,
} from "../../../core/training-plan-blocks";
import { PdfPreviewFrame } from "../../../pdf/PdfPreviewFrame";
import { buildSessionMonthlyPlanData, sessionPlanHtml } from "../../../pdf/templates/session-plan";
import { AnchoredDropdown } from "../../../ui/AnchoredDropdown";
import { AnchoredDropdownOption } from "../../../ui/AnchoredDropdownOption";
import { useAppTheme } from "../../../ui/app-theme";
import { useConfirmDialog } from "../../../ui/confirm-dialog";
import { GoAtletaIcon, type GoAtletaIconName } from "../../../ui/icon-registry";
import { ModalSheet } from "../../../ui/ModalSheet";
import { Pressable } from "../../../ui/Pressable";
import { useSaveToast } from "../../../ui/save-toast";
import { useModalCardStyle } from "../../../ui/use-modal-card-style";
import { buildClassPlanPdfData } from "../application/build-class-plan-pdf-data";
import {
  appendClassPlanActivity,
  buildClassPlanBlockDraft,
  getClassPlanPdfContentDraft,
  normalizeClassTrainingPlan,
  updateClassPlanPdfContent,
  updateClassTrainingPlanBlock,
  type ClassPlanBlockDraft,
  type ClassPlanPdfContentDraft,
} from "../application/edit-class-training-plan";
import {
  CLASS_PLAN_BLOCK_KEYS,
  CLASS_PLAN_BLOCK_PRESENTATION,
  summarizeClassPlanActivities,
} from "./class-plan-block-presentation";
import { AppliedPlanReferencesSection } from "./AppliedPlanReferencesSection";

type ClassPlanPreviewModalProps = {
  visible: boolean;
  onClose: () => void;
  plan: TrainingPlan;
  classGroup: ClassGroup;
  lessonDate: string;
  coachName?: string;
  initialMode?: "preview" | "edit";
  onSavePlan: (plan: TrainingPlan) => Promise<TrainingPlan>;
  onRemovePlan: () => Promise<void>;
};

type PreviewStatus = "idle" | "loading" | "ready" | "error";

type PlanUndoEntry = {
  plan: TrainingPlan;
  isDirty: boolean;
  pdfStatusLabel: string;
};

const BLOCKS: Array<{
  key: TrainingPlanBlockKey;
  label: string;
  icon: GoAtletaIconName;
}> = CLASS_PLAN_BLOCK_KEYS.map((key) => ({ key, ...CLASS_PLAN_BLOCK_PRESENTATION[key] }));

const formatDuration = (value: string | undefined) => {
  const text = String(value ?? "").trim();
  if (!text) return "—";
  return /min/i.test(text) ? text : `${text} min`;
};

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return "";
  return bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`;
};

const formatLessonDate = (dateKey: string) => {
  const parts = dateKey.split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateKey;
};

const formatLessonTime = (classGroup: ClassGroup) => {
  const start = String(classGroup.startTime ?? "").trim();
  const match = start.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return start;
  const startMinutes = Number(match[1]) * 60 + Number(match[2]);
  const endMinutes = startMinutes + (classGroup.durationMinutes ?? 60);
  const format = (value: number) => {
    const hours = Math.floor(value / 60) % 24;
    const minutes = value % 60;
    return minutes ? `${hours}h${String(minutes).padStart(2, "0")}` : `${hours}h`;
  };
  return `${format(startMinutes)} às ${format(endMinutes)}`;
};

const getDuration = (plan: TrainingPlan, blockKey: TrainingPlanBlockKey) =>
  blockKey === "warmup"
    ? plan.warmupTime
    : blockKey === "main"
    ? plan.mainTime
    : plan.cooldownTime;

export function ClassPlanPreviewModal({
  visible,
  onClose,
  plan,
  classGroup,
  lessonDate,
  coachName,
  initialMode = "preview",
  onSavePlan,
  onRemovePlan,
}: ClassPlanPreviewModalProps) {
  const { colors } = useAppTheme();
  const { showSaveToast } = useSaveToast();
  const { confirm } = useConfirmDialog();
  const { width } = useWindowDimensions();
  const splitLayout = Platform.OS === "web" && width >= 980;
  const phoneLayout = Platform.OS === "web" && width < 600;
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("idle");
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfSize, setPdfSize] = useState<number | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [mobileView, setMobileView] = useState<"pdf" | "outline">("pdf");
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isEditing, setIsEditing] = useState(initialMode === "edit");
  const [isEditorExpanded, setIsEditorExpanded] = useState(initialMode === "edit");
  const [isPdfContentExpanded, setIsPdfContentExpanded] = useState(false);
  const [selectedBlockKey, setSelectedBlockKey] = useState<TrainingPlanBlockKey>("main");
  const [focusedActivityDescriptionIndex, setFocusedActivityDescriptionIndex] = useState<number | null>(null);
  const [pdfPlan, setPdfPlan] = useState(plan);
  const [workingPlan, setWorkingPlan] = useState(plan);
  const [isDirty, setIsDirty] = useState(false);
  const [pdfStatusLabel, setPdfStatusLabel] = useState("PDF sincronizado");
  const [showMenu, setShowMenu] = useState(false);
  const [menuLayout, setMenuLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const menuTriggerRef = useRef<View | null>(null);
  const menuAnimation = useRef(new Animated.Value(1)).current;
  const workingPlanRef = useRef(plan);
  const undoStackRef = useRef<PlanUndoEntry[]>([]);

  const cardStyle = useModalCardStyle({
    maxHeight: splitLayout ? "94%" : "100%",
    maxWidth: splitLayout ? 1160 : undefined,
    fullWidth: !splitLayout,
    padding: 0,
    radius: splitLayout ? 18 : 0,
    flushBottom: !splitLayout,
  });

  useEffect(() => {
    if (!visible) return;
    setPdfPlan(plan);
    setWorkingPlan(plan);
    workingPlanRef.current = plan;
    undoStackRef.current = [];
    setIsDirty(false);
    setIsEditing(initialMode === "edit");
    setIsEditorExpanded(initialMode === "edit");
    setIsPdfContentExpanded(false);
    setSelectedBlockKey("main");
    setFocusedActivityDescriptionIndex(null);
    setMobileView(initialMode === "edit" ? "outline" : "pdf");
    setPdfStatusLabel("PDF sincronizado");
    setShowMenu(false);
  }, [initialMode, plan, visible]);

  const pdfData = useMemo(
    () => buildClassPlanPdfData({ classGroup, plan: pdfPlan, lessonDate, coachName }),
    [classGroup, coachName, lessonDate, pdfPlan]
  );
  const previewHtml = useMemo(() => sessionPlanHtml(pdfData), [pdfData]);
  const fileName = useMemo(() => {
    const date = lessonDate || pdfPlan.applyDate || "aula";
    const className = classGroup.name || "turma";
    return `plano-aula-${className}-${date}.pdf`;
  }, [classGroup.name, lessonDate, pdfPlan.applyDate]);

  useEffect(() => {
    if (!visible) return undefined;
    if (Platform.OS !== "web") {
      setPreviewStatus("idle");
      return undefined;
    }

    let active = true;
    let generatedUrl = "";
    setPreviewStatus("loading");
    setPdfUrl("");
    setPdfBlob(null);
    setPdfSize(null);

    void (async () => {
      try {
        const [{ SessionPlanDocument }, { createWebPdfBlob }] = await Promise.all([
          import("../../../pdf/session-plan-document"),
          import("../../../pdf/export-pdf"),
        ]);
        const document = createElement(SessionPlanDocument, { data: pdfData });
        const blob = await createWebPdfBlob(document);
        if (!active) return;
        generatedUrl = URL.createObjectURL(blob);
        setPdfBlob(blob);
        setPdfSize(blob.size);
        setPdfUrl(generatedUrl);
        setPreviewStatus("ready");
      } catch {
        if (active) setPreviewStatus("error");
      }
    })();

    return () => {
      active = false;
      if (generatedUrl) URL.revokeObjectURL(generatedUrl);
    };
  }, [pdfData, retryKey, visible]);

  const handleDownload = useCallback(async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const pdfModule = await import("../../../pdf/export-pdf");
      if (Platform.OS === "web" && pdfBlob) {
        pdfModule.downloadWebPdfBlob(
          pdfBlob,
          pdfModule.safeFileName(fileName.replace(/\.pdf$/i, "")) + ".pdf"
        );
        showSaveToast({ message: ptBR.session.success.pdfGenerated, variant: "success" });
        return;
      }

      const { SessionPlanDocument } = await import("../../../pdf/session-plan-document");
      await pdfModule.exportPdf({
        html: sessionPlanHtml(pdfData),
        fileName: pdfModule.safeFileName(fileName.replace(/\.pdf$/i, "")) + ".pdf",
        webDocument:
          Platform.OS === "web"
            ? createElement(SessionPlanDocument, { data: pdfData })
            : undefined,
      });
      showSaveToast({ message: ptBR.session.success.pdfGenerated, variant: "success" });
    } catch {
      showSaveToast({ message: ptBR.session.errors.pdfGenerateFailed, variant: "error" });
      Alert.alert("Não foi possível baixar o PDF", "Tente novamente.");
    } finally {
      setIsDownloading(false);
    }
  }, [fileName, isDownloading, pdfBlob, pdfData, showSaveToast]);

  const updateSelectedBlock = useCallback(
    (update: (draft: ClassPlanBlockDraft) => ClassPlanBlockDraft) => {
      setWorkingPlan((current) => {
        const draft = buildClassPlanBlockDraft(current, selectedBlockKey);
        const nextPlan = updateClassTrainingPlanBlock(current, selectedBlockKey, update(draft));
        workingPlanRef.current = nextPlan;
        return nextPlan;
      });
      setIsDirty(true);
      setPdfStatusLabel("Alterações não salvas");
    },
    [selectedBlockKey]
  );

  const updatePdfContentField = useCallback(<Key extends keyof ClassPlanPdfContentDraft,>(
    field: Key,
    value: ClassPlanPdfContentDraft[Key]
  ) => {
    setWorkingPlan((current) => {
      const resolvedLesson = buildSessionMonthlyPlanData(
        buildClassPlanPdfData({ classGroup, plan: current, lessonDate, coachName })
      ).lessons[0];
      const currentDraft = getClassPlanPdfContentDraft(current);
      const usesManualContent = current.pedagogy?.sessionObjectiveSource === "manual";
      const nextPlan = updateClassPlanPdfContent(current, {
        generalObjective: usesManualContent ? currentDraft.generalObjective : currentDraft.generalObjective || resolvedLesson.generalObjective,
        specificObjective: usesManualContent ? currentDraft.specificObjective : currentDraft.specificObjective || resolvedLesson.specificObjective,
        situationProblem: usesManualContent ? currentDraft.situationProblem : currentDraft.situationProblem || resolvedLesson.situationProblem || "",
        observations: usesManualContent ? currentDraft.observations : currentDraft.observations || resolvedLesson.observations || "",
        [field]: value,
      });
      workingPlanRef.current = nextPlan;
      return nextPlan;
    });
    setIsDirty(true);
    setPdfStatusLabel("Alterações não salvas");
  }, [classGroup, coachName, lessonDate]);

  const handleSave = useCallback(async () => {
    if (isSaving || !isDirty) return;
    const normalizedPlan = normalizeClassTrainingPlan(workingPlan);
    if (!resolveTrainingPlanBlock(normalizedPlan, "main").activities.length) {
      showSaveToast({
        message: "Mantenha pelo menos uma atividade na parte principal.",
        variant: "warning",
      });
      return;
    }
    setIsSaving(true);
    try {
      const savedPlan = await onSavePlan(normalizedPlan);
      setWorkingPlan(savedPlan);
      workingPlanRef.current = savedPlan;
      setPdfPlan(savedPlan);
      undoStackRef.current = [];
      setIsDirty(false);
      setPdfStatusLabel("PDF atualizado agora");
      showSaveToast({ message: "Plano salvo e PDF atualizado.", variant: "success" });
    } catch (error) {
      showSaveToast({
        error,
        message: "Não foi possível salvar o plano.",
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  }, [isDirty, isSaving, onSavePlan, showSaveToast, workingPlan]);

  const handleCancelEditing = useCallback(() => {
    setWorkingPlan(pdfPlan);
    workingPlanRef.current = pdfPlan;
    undoStackRef.current = [];
    setIsDirty(false);
    setIsEditing(false);
    setIsEditorExpanded(false);
    setIsPdfContentExpanded(false);
    setPdfStatusLabel("PDF sincronizado");
  }, [pdfPlan]);

  const handleDeleteActivity = useCallback(
    (index: number) => {
      undoStackRef.current = [
        ...undoStackRef.current.slice(-19),
        { plan: workingPlanRef.current, isDirty, pdfStatusLabel },
      ];
      updateSelectedBlock((draft) => ({
        ...draft,
        activities: draft.activities.filter((_, itemIndex) => itemIndex !== index),
      }));
      showSaveToast({
        message: "Atividade removida. Use Ctrl+Z para desfazer.",
        variant: "success",
      });
    },
    [isDirty, pdfStatusLabel, showSaveToast, updateSelectedBlock]
  );

  useEffect(() => {
    if (!visible || Platform.OS !== "web") return undefined;

    const handleUndoShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.key.toLowerCase() !== "z") {
        return;
      }

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (tagName === "input" || tagName === "textarea" || target?.isContentEditable) return;

      const previous = undoStackRef.current.pop();
      if (!previous) return;

      event.preventDefault();
      workingPlanRef.current = previous.plan;
      setWorkingPlan(previous.plan);
      setIsDirty(previous.isDirty);
      setPdfStatusLabel(previous.pdfStatusLabel);
      showSaveToast({ message: "Remoção desfeita.", variant: "success" });
    };

    window.addEventListener("keydown", handleUndoShortcut);
    return () => window.removeEventListener("keydown", handleUndoShortcut);
  }, [showSaveToast, visible]);

  const handleRemove = useCallback(() => {
    setShowMenu(false);
    void confirm({
      title: "Remover plano desta aula?",
      message: "A turma voltará a pedir um novo plano para esta data.",
      confirmLabel: "Remover plano",
      cancelLabel: "Manter plano",
      tone: "danger",
      onConfirm: async () => {
        setIsRemoving(true);
        try {
          await onRemovePlan();
          showSaveToast({ message: "Plano removido desta aula.", variant: "success" });
          onClose();
        } catch (error) {
          showSaveToast({
            error,
            message: "Não foi possível remover o plano.",
            variant: "error",
          });
        } finally {
          setIsRemoving(false);
        }
      },
    });
  }, [confirm, onClose, onRemovePlan, showSaveToast]);

  const toggleMenu = useCallback(() => {
    if (showMenu) {
      setShowMenu(false);
      return;
    }
    menuTriggerRef.current?.measureInWindow((x, y, measuredWidth, measuredHeight) => {
      const panelWidth = 220;
      setMenuLayout({
        x: Math.max(12, x + measuredWidth - panelWidth),
        y,
        width: panelWidth,
        height: measuredHeight,
      });
      setShowMenu(true);
    });
  }, [showMenu]);

  const selectBlock = useCallback(
    (blockKey: TrainingPlanBlockKey) => {
      setSelectedBlockKey(blockKey);
      setIsPdfContentExpanded(false);
      setFocusedActivityDescriptionIndex(null);
      if (!isEditing) setIsEditing(true);
      setIsEditorExpanded(true);
      if (!splitLayout) setMobileView("outline");
    },
    [isEditing, splitLayout]
  );

  const selectPdfContent = useCallback(() => {
    setIsPdfContentExpanded(true);
    setFocusedActivityDescriptionIndex(null);
    if (!isEditing) setIsEditing(true);
    setIsEditorExpanded(true);
    if (!splitLayout) setMobileView("outline");
  }, [isEditing, splitLayout]);

  const preview = (
    <View style={[styles.previewPane, { backgroundColor: colors.backgroundSubtle }]}>
      {previewStatus === "ready" && pdfUrl ? (
        <PdfPreviewFrame url={pdfUrl} html={previewHtml} title={`PDF do plano ${pdfPlan.title}`} />
      ) : previewStatus === "error" ? (
        <View style={styles.previewState} accessibilityLiveRegion="polite">
          <GoAtletaIcon name="document" size={30} color={colors.muted} />
          <Text style={[styles.previewStateTitle, { color: colors.text }]}>Não foi possível preparar a prévia</Text>
          <Pressable
            onPress={() => setRetryKey((current) => current + 1)}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.retryAction,
              { borderColor: colors.border, opacity: pressed ? 0.72 : 1 },
            ]}
          >
            <Text style={[styles.retryActionLabel, { color: colors.text }]}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : Platform.OS !== "web" ? (
        <View style={styles.previewState}>
          <GoAtletaIcon name="document" size={30} color={colors.muted} />
          <Text style={[styles.previewStateTitle, { color: colors.text }]}>Prévia disponível no navegador</Text>
          <Text style={[styles.previewStateText, { color: colors.muted }]}>Baixe o PDF para ver o plano completo.</Text>
        </View>
      ) : (
        <View style={styles.previewState} accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" color={colors.primaryBg} />
          <Text style={[styles.previewStateTitle, { color: colors.text }]}>Preparando o PDF</Text>
          <Text style={[styles.previewStateText, { color: colors.muted }]}>Organizando o plano completo desta aula.</Text>
        </View>
      )}
    </View>
  );

  const outline = (
    <View style={[styles.outlinePane, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.outlineTitle, { color: colors.text }]}>Roteiro da aula</Text>
      <ScrollView
        style={styles.outlineScroll}
        contentContainerStyle={styles.outlineContent}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={selectPdfContent}
          accessibilityRole="button"
          accessibilityLabel="Editar conteúdo pedagógico"
          style={({ pressed }) => [
            styles.outlineBlock,
            {
              borderColor: isPdfContentExpanded ? colors.primaryBg : colors.border,
              backgroundColor: isPdfContentExpanded ? colors.backgroundSubtle : colors.card,
              opacity: pressed ? 0.78 : 1,
            },
          ]}
        >
          <GoAtletaIcon name="document" size={18} color={isPdfContentExpanded ? colors.primaryBg : colors.muted} />
          <View style={styles.outlineBlockCopy}>
            <Text style={[styles.outlineBlockLabel, { color: colors.text }]}>Conteúdo Pedagógico</Text>
            <Text numberOfLines={1} style={[styles.outlineActivity, { color: colors.muted }]}>Objetivos, situação-problema e observações</Text>
          </View>
          <GoAtletaIcon name="pencil" size={15} color={colors.text} />
        </Pressable>
        <AppliedPlanReferencesSection
          references={workingPlan.pedagogy?.appliedReferences}
        />
        {BLOCKS.map((item) => {
          const block = resolveTrainingPlanBlock(workingPlan, item.key);
          const activitySummary = summarizeClassPlanActivities(block.activities);
          const selected = !isPdfContentExpanded && selectedBlockKey === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => selectBlock(item.key)}
              accessibilityRole="button"
              accessibilityLabel={`Editar ${item.label}`}
              style={({ pressed }) => [
                styles.outlineBlock,
                {
                  borderColor: selected ? colors.primaryBg : colors.border,
                  backgroundColor: selected ? colors.backgroundSubtle : colors.card,
                  opacity: pressed ? 0.78 : 1,
                },
              ]}
            >
              <GoAtletaIcon name={item.icon} size={18} color={selected ? colors.primaryBg : colors.muted} />
              <View style={styles.outlineBlockCopy}>
                <View style={styles.outlineBlockHeader}>
                  <Text style={[styles.outlineBlockLabel, { color: colors.text }]}>{item.label}</Text>
                  <Text style={[styles.outlineDuration, { color: colors.muted }]}>
                    {formatDuration(getDuration(workingPlan, item.key))}
                  </Text>
                </View>
                {activitySummary.visibleActivities.map((activity, index) => (
                  <Text
                    key={`${item.key}-${index}`}
                    numberOfLines={1}
                    style={[styles.outlineActivity, { color: colors.muted }]}
                  >
                    {block.activities.length > 1 ? "• " : ""}{activity.name}
                  </Text>
                ))}
                {activitySummary.remainingCount > 0 ? (
                  <Text numberOfLines={1} style={[styles.outlineActivityMore, { color: colors.muted }]}>
                    {`+ ${activitySummary.remainingCount} ${activitySummary.remainingCount === 1 ? "atividade" : "atividades"}`}
                  </Text>
                ) : null}
              </View>
              <GoAtletaIcon name="pencil" size={15} color={colors.text} />
            </Pressable>
          );
        })}
      </ScrollView>
      {!isEditing && pdfSize ? (
        <Text style={[styles.fileSize, { color: colors.muted }]}>PDF da aula · {formatFileSize(pdfSize)}</Text>
      ) : null}
    </View>
  );

  const selectedBlock = buildClassPlanBlockDraft(workingPlan, selectedBlockKey);
  const storedPdfContentDraft = getClassPlanPdfContentDraft(workingPlan);
  const resolvedPdfLesson = buildSessionMonthlyPlanData(
    buildClassPlanPdfData({ classGroup, plan: workingPlan, lessonDate, coachName })
  ).lessons[0];
  const usesManualPdfContent = workingPlan.pedagogy?.sessionObjectiveSource === "manual";
  const pdfContentDraft: ClassPlanPdfContentDraft = {
    generalObjective: usesManualPdfContent ? storedPdfContentDraft.generalObjective : storedPdfContentDraft.generalObjective || resolvedPdfLesson.generalObjective,
    specificObjective: usesManualPdfContent ? storedPdfContentDraft.specificObjective : storedPdfContentDraft.specificObjective || resolvedPdfLesson.specificObjective,
    situationProblem: usesManualPdfContent ? storedPdfContentDraft.situationProblem : storedPdfContentDraft.situationProblem || resolvedPdfLesson.situationProblem || "",
    observations: usesManualPdfContent ? storedPdfContentDraft.observations : storedPdfContentDraft.observations || resolvedPdfLesson.observations || "",
  };
  const selectedBlockLabel = BLOCKS.find((item) => item.key === selectedBlockKey)?.label ?? "Bloco";
  const editorSectionLabel = isPdfContentExpanded ? "Conteúdo Pedagógico" : selectedBlockLabel;

  const editor = isEditing ? (
    <View
      style={[
        styles.editorPane,
        !isEditorExpanded ? styles.editorPaneCollapsed : null,
        { borderTopColor: colors.border, backgroundColor: colors.card },
      ]}
    >
      <View style={styles.editorHeader}>
        <Text style={[styles.editorTitle, { color: colors.text }]}>{editorSectionLabel}</Text>
        <View style={styles.editorHeaderActions}>
          {!isPdfContentExpanded ? (
            <View style={styles.headerDurationField}>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Duração</Text>
              <View style={[styles.headerDurationShell, { borderColor: colors.border, backgroundColor: colors.backgroundSubtle }]}>
                <TextInput
                  value={selectedBlock.duration.replace(/\s*min\s*$/i, "")}
                  onChangeText={(duration) => updateSelectedBlock((draft) => ({ ...draft, duration }))}
                  keyboardType="number-pad"
                  style={[styles.headerDurationInput, { color: colors.text }]}
                  accessibilityLabel="Duração do bloco"
                />
                <Text style={[styles.inputSuffix, { color: colors.muted }]}>min</Text>
              </View>
            </View>
          ) : null}
          <Pressable
            onPress={() => setIsEditorExpanded((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel={`${isEditorExpanded ? "Recolher" : "Expandir"} edição de ${editorSectionLabel}`}
            accessibilityState={{ expanded: isEditorExpanded }}
            style={({ pressed }) => [styles.editorCollapseAction, { opacity: pressed ? 0.6 : 1 }]}
          >
            <GoAtletaIcon name={isEditorExpanded ? "chevronUp" : "chevronDown"} size={18} color={colors.muted} />
          </Pressable>
        </View>
      </View>
      {isEditorExpanded ? (
        <ScrollView
          style={styles.editorScroll}
          contentContainerStyle={styles.editorContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        {isPdfContentExpanded ? (
        <>
        <Text style={[styles.pdfContentHint, { color: colors.muted }]}>Preenchido pelo planejamento inteligente</Text>
        <View style={[styles.pdfContentGrid, !splitLayout ? styles.editorFieldsCompact : null]}>
          <View style={styles.pdfContentField}>
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Objetivo geral</Text>
            <TextInput
              value={pdfContentDraft.generalObjective}
              onChangeText={(value) => updatePdfContentField("generalObjective", value)}
              placeholder="Objetivo geral desta aula"
              placeholderTextColor={colors.muted}
              multiline
              style={[styles.textInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundSubtle }]}
              accessibilityLabel="Objetivo geral da aula"
            />
          </View>
          <View style={styles.pdfContentField}>
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Objetivo específico</Text>
            <TextInput
              value={pdfContentDraft.specificObjective}
              onChangeText={(value) => updatePdfContentField("specificObjective", value)}
              placeholder="Objetivo específico desta aula"
              placeholderTextColor={colors.muted}
              multiline
              style={[styles.textInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundSubtle }]}
              accessibilityLabel="Objetivo específico da aula"
            />
          </View>
          <View style={styles.pdfContentField}>
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Situação-problema</Text>
            <TextInput
              value={pdfContentDraft.situationProblem}
              onChangeText={(value) => updatePdfContentField("situationProblem", value)}
              placeholder="Pergunta que orienta a aula"
              placeholderTextColor={colors.muted}
              multiline
              style={[styles.textInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundSubtle }]}
              accessibilityLabel="Situação-problema da aula"
            />
          </View>
          <View style={styles.pdfContentField}>
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Observações</Text>
            <TextInput
              value={pdfContentDraft.observations}
              onChangeText={(value) => updatePdfContentField("observations", value)}
              placeholder="Observações que devem aparecer no PDF"
              placeholderTextColor={colors.muted}
              multiline
              style={[styles.textInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundSubtle }]}
              accessibilityLabel="Observações do plano da aula"
            />
          </View>
        </View>
        </>
        ) : null}

        {!isPdfContentExpanded ? (
        <>
        <Text style={[styles.fieldLabel, { color: colors.muted }]}>Atividades</Text>
        {selectedBlock.activities.map((activity, index) => (
          <View
            key={`${selectedBlockKey}-${index}`}
            style={[styles.activityEditor, !splitLayout ? styles.activityEditorCompact : null, { borderColor: colors.border }]}
          >
            <View style={[styles.activityNumber, { borderColor: colors.border, backgroundColor: colors.backgroundSubtle }]}>
              <Text style={[styles.activityNumberLabel, { color: colors.text }]}>{index + 1}</Text>
            </View>
            <TextInput
              value={activity.name}
              onChangeText={(name) =>
                updateSelectedBlock((draft) => ({
                  ...draft,
                  activities: draft.activities.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, name } : item
                  ),
                }))
              }
              placeholder="Nome da atividade"
              placeholderTextColor={colors.muted}
              style={[
                styles.activityNameInput,
                { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundSubtle },
              ]}
              accessibilityLabel={`Nome da atividade ${index + 1}`}
            />
            <TextInput
              value={activity.description ?? ""}
              onChangeText={(description) =>
                updateSelectedBlock((draft) => ({
                  ...draft,
                  activities: draft.activities.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, description } : item
                  ),
                }))
              }
              placeholder="Organização, execução e condução"
              placeholderTextColor={colors.muted}
              multiline
              onFocus={() => setFocusedActivityDescriptionIndex(index)}
              onBlur={() => setFocusedActivityDescriptionIndex((current) => current === index ? null : current)}
              style={[
                styles.activityDescriptionInput,
                focusedActivityDescriptionIndex === index
                  ? styles.activityDescriptionInputFocused
                  : styles.activityDescriptionInputCompact,
                { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundSubtle },
              ]}
              accessibilityLabel={`Descrição da atividade ${index + 1}`}
            />
            <Pressable
              onPress={() => handleDeleteActivity(index)}
              accessibilityRole="button"
              accessibilityLabel={`Remover atividade ${index + 1}`}
              style={({ pressed }) => [styles.activityDelete, { opacity: pressed ? 0.6 : 1 }]}
            >
              <GoAtletaIcon name="trash" size={17} color={colors.dangerText} />
            </Pressable>
          </View>
        ))}
        <Pressable
          onPress={() => updateSelectedBlock(appendClassPlanActivity)}
          accessibilityRole="button"
          accessibilityLabel="Adicionar atividade"
          style={({ pressed }) => [styles.addActivity, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
        >
          <GoAtletaIcon name="add" size={17} color={colors.text} />
          <Text style={[styles.addActivityLabel, { color: colors.text }]}>Adicionar atividade</Text>
        </Pressable>
        </>
        ) : null}
        </ScrollView>
      ) : null}
    </View>
  ) : null;

  const menuButton = (
    <View ref={menuTriggerRef} collapsable={false}>
      <Pressable
        onPress={toggleMenu}
        disabled={isRemoving}
        accessibilityRole="button"
        accessibilityLabel="Mais opções do plano"
        style={({ pressed }) => [
          styles.iconAction,
          { borderColor: colors.border, opacity: isRemoving ? 0.5 : pressed ? 0.72 : 1 },
        ]}
      >
        {isRemoving ? (
          <ActivityIndicator size="small" color={colors.text} />
        ) : (
          <GoAtletaIcon name="ellipsisVertical" size={18} color={colors.text} />
        )}
      </Pressable>
    </View>
  );

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      position="center"
      containerPadding={splitLayout ? 16 : 0}
      cardStyle={[
        cardStyle,
        styles.modalCard,
        splitLayout ? styles.modalCardDesktop : styles.modalCardCompact,
        !splitLayout ? { borderColor: colors.border, borderWidth: 0 } : null,
      ]}
    >
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerCopy}>
          <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>Plano da aula</Text>
          <Text numberOfLines={1} style={[styles.subtitle, { color: colors.muted }]}>
            {classGroup.name} · {formatLessonDate(lessonDate)} · {formatLessonTime(classGroup)}
          </Text>
        </View>

        {splitLayout ? (
          <>
            <Pressable
              onPress={handleDownload}
              disabled={isDownloading || previewStatus === "loading"}
              accessibilityRole="button"
              accessibilityLabel="Baixar PDF da aula"
              style={({ pressed }) => [
                styles.headerButton,
                {
                  borderColor: colors.border,
                  opacity: isDownloading || previewStatus === "loading" ? 0.5 : pressed ? 0.72 : 1,
                },
              ]}
            >
              {isDownloading ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <GoAtletaIcon name="download" size={17} color={colors.text} />
              )}
              <Text style={[styles.headerButtonLabel, { color: colors.text }]}>Baixar PDF</Text>
            </Pressable>
            {menuButton}
          </>
        ) : (
          <>
            {!phoneLayout ? (
              <Pressable
                onPress={handleDownload}
                disabled={isDownloading || previewStatus === "loading"}
                accessibilityRole="button"
                accessibilityLabel="Baixar PDF da aula"
                style={({ pressed }) => [styles.iconAction, { borderColor: colors.border, opacity: pressed ? 0.72 : 1 }]}
              >
                <GoAtletaIcon name="download" size={18} color={colors.text} />
              </Pressable>
            ) : null}
            {!isEditing ? menuButton : null}
          </>
        )}
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fechar plano"
          style={({ pressed }) => [styles.closeAction, { borderColor: colors.border, opacity: pressed ? 0.72 : 1 }]}
        >
          <GoAtletaIcon name="close" size={20} color={colors.text} />
        </Pressable>
      </View>

      {!splitLayout ? (
        <View style={[styles.mobileTabs, { borderBottomColor: colors.border }]}>
          {(["pdf", "outline"] as const).map((tab) => {
            const active = mobileView === tab;
            return (
              <Pressable
                key={tab}
                onPress={() => setMobileView(tab)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={[styles.mobileTab, active ? { borderBottomColor: colors.primaryBg } : null]}
              >
                <Text style={[styles.mobileTabLabel, { color: active ? colors.text : colors.muted }]}>
                  {tab === "pdf" ? "PDF" : "Roteiro"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={styles.body}>
        <View style={[styles.primaryWorkspace, splitLayout ? styles.primaryWorkspaceDesktop : null]}>
          {splitLayout ? (
            <>
              {preview}
              {outline}
            </>
          ) : mobileView === "pdf" ? (
            preview
          ) : (
            <ScrollView
              style={styles.compactOutlineScroll}
              contentContainerStyle={styles.compactOutlineContent}
              keyboardShouldPersistTaps="handled"
            >
              {outline}
              {editor}
            </ScrollView>
          )}
        </View>
        {splitLayout ? editor : null}
      </View>

      {isEditing ? (
        <View
          style={[
            styles.editFooter,
            !splitLayout ? styles.editFooterCompact : null,
            { borderTopColor: colors.border, backgroundColor: colors.card },
          ]}
        >
          {splitLayout ? (
            <View style={[styles.pdfStatus, { borderColor: isDirty ? colors.warningBorder : colors.successBorder }]}>
              <GoAtletaIcon
                name={isDirty ? "warningCircle" : "success"}
                size={17}
                color={isDirty ? colors.warningText : colors.successText}
              />
              <Text style={[styles.pdfStatusLabel, { color: isDirty ? colors.warningText : colors.successText }]}>
                {pdfStatusLabel}
              </Text>
            </View>
          ) : null}
          <View style={[styles.footerActions, !splitLayout ? styles.footerActionsCompact : null]}>
            {splitLayout ? (
              <Pressable
                onPress={handleCancelEditing}
                accessibilityRole="button"
                style={({ pressed }) => [styles.cancelButton, { borderColor: colors.border, opacity: pressed ? 0.72 : 1 }]}
              >
                <Text style={[styles.cancelButtonLabel, { color: colors.text }]}>Cancelar</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={handleSave}
              disabled={!isDirty || isSaving}
              accessibilityRole="button"
              accessibilityLabel="Salvar e atualizar PDF"
              style={({ pressed }) => [
                styles.saveButton,
                !splitLayout ? styles.saveButtonCompact : null,
                {
                  backgroundColor: colors.primaryBg,
                  opacity: !isDirty || isSaving ? 0.48 : pressed ? 0.8 : 1,
                },
              ]}
            >
              {isSaving ? <ActivityIndicator size="small" color={colors.primaryText} /> : null}
              <Text style={[styles.saveButtonLabel, { color: colors.primaryText }]}>Salvar e atualizar PDF</Text>
            </Pressable>
            {!splitLayout ? menuButton : null}
          </View>
        </View>
      ) : !splitLayout ? (
        <View style={[styles.previewFooter, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
          {phoneLayout ? (
            <Pressable
              onPress={handleDownload}
              disabled={isDownloading || previewStatus === "loading"}
              accessibilityRole="button"
              accessibilityLabel="Baixar PDF da aula"
              style={({ pressed }) => [
                styles.footerDownloadButton,
                { borderColor: colors.border, opacity: isDownloading ? 0.5 : pressed ? 0.72 : 1 },
              ]}
            >
              {isDownloading ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <GoAtletaIcon name="download" size={17} color={colors.text} />
              )}
              <Text style={[styles.footerDownloadLabel, { color: colors.text }]}>Baixar PDF</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => {
              setIsEditing(true);
              setIsEditorExpanded(true);
              setIsPdfContentExpanded(false);
              setSelectedBlockKey("main");
              setMobileView("outline");
            }}
            accessibilityRole="button"
            accessibilityLabel="Editar plano"
            style={({ pressed }) => [
              styles.saveButton,
              styles.saveButtonCompact,
              { backgroundColor: colors.primaryBg, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <GoAtletaIcon name="pencil" size={16} color={colors.primaryText} />
            <Text style={[styles.saveButtonLabel, { color: colors.primaryText }]}>Editar plano</Text>
          </Pressable>
        </View>
      ) : null}

      <AnchoredDropdown
        visible={showMenu}
        layout={menuLayout}
        container={null}
        animationStyle={{ opacity: menuAnimation }}
        zIndex={32000}
        maxHeight={104}
        nestedScrollEnabled={false}
        onRequestClose={() => setShowMenu(false)}
        interactiveRefs={[menuTriggerRef]}
        showVerticalScrollIndicator={false}
      >
        <AnchoredDropdownOption active={false} onPress={handleRemove}>
          <View style={styles.menuOption}>
            <GoAtletaIcon name="trash" size={17} color={colors.dangerText} />
            <View style={styles.menuOptionCopy}>
              <Text style={[styles.menuOptionLabel, { color: colors.dangerText }]}>Remover plano</Text>
              <Text style={[styles.menuOptionHint, { color: colors.muted }]}>Voltar para sem plano aplicado</Text>
            </View>
          </View>
        </AnchoredDropdownOption>
      </AnchoredDropdown>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  modalCard: { overflow: "hidden", paddingBottom: 0, marginBottom: 0, gap: 0 },
  modalCardDesktop: { height: "94%" },
  modalCardCompact: {
    width: "100%",
    maxWidth: "100%",
    height: "100%",
    maxHeight: "100%",
    borderRadius: 0,
  },
  header: {
    minHeight: 72,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 19, fontWeight: "800" },
  subtitle: { marginTop: 3, fontSize: 12 },
  headerButton: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  headerButtonLabel: { fontSize: 13, fontWeight: "800" },
  iconAction: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  closeAction: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  mobileTabs: { minHeight: 46, flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  mobileTab: { flex: 1, alignItems: "center", justifyContent: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  mobileTabLabel: { fontSize: 13, fontWeight: "800" },
  body: { flex: 1, minHeight: 0 },
  primaryWorkspace: { flex: 1, minHeight: 0 },
  primaryWorkspaceDesktop: { flexDirection: "row" },
  previewPane: { flex: 1.7, minWidth: 0, minHeight: 0 },
  previewState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, gap: 9 },
  previewStateTitle: { fontSize: 15, fontWeight: "800", textAlign: "center" },
  previewStateText: { maxWidth: 320, fontSize: 12, lineHeight: 18, textAlign: "center" },
  retryAction: { minHeight: 40, borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  retryActionLabel: { fontSize: 13, fontWeight: "700" },
  outlinePane: { width: 380, minHeight: 0, borderLeftWidth: 1, padding: 14, gap: 12 },
  outlineTitle: { fontSize: 16, fontWeight: "800" },
  outlineScroll: { flex: 1 },
  outlineContent: { gap: 8, paddingBottom: 8 },
  outlineBlock: { minHeight: 82, borderWidth: 1, borderRadius: 11, padding: 12, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  outlineBlockCopy: { flex: 1, minWidth: 0, gap: 3 },
  outlineBlockHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  outlineBlockLabel: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: "800" },
  outlineDuration: { fontSize: 11, fontWeight: "700" },
  outlineActivity: { fontSize: 11, lineHeight: 16 },
  outlineActivityMore: { fontSize: 11, lineHeight: 16, fontWeight: "700" },
  fileSize: { fontSize: 11, textAlign: "center" },
  compactOutlineScroll: { flex: 1 },
  compactOutlineContent: { paddingBottom: 18 },
  editorPane: { height: 330, minHeight: 240, borderTopWidth: 1 },
  editorPaneCollapsed: { height: 62, minHeight: 62 },
  editorHeader: { minHeight: 62, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  editorTitle: { minWidth: 0, fontSize: 16, fontWeight: "800" },
  editorHeaderActions: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  headerDurationField: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerDurationShell: { width: 92, minHeight: 38, borderWidth: 1, borderRadius: 9, flexDirection: "row", alignItems: "center", paddingHorizontal: 9 },
  headerDurationInput: { flex: 1, minWidth: 0, paddingVertical: 7, fontSize: 13, fontWeight: "700", outlineStyle: "none" } as any,
  editorCollapseAction: { width: 36, height: 36, marginLeft: "auto", alignItems: "center", justifyContent: "center" },
  editorScroll: { flex: 1 },
  editorContent: { paddingHorizontal: 18, paddingBottom: 18, gap: 10 },
  editorFieldsCompact: { flexDirection: "column" },
  pdfContentHint: { fontSize: 10, lineHeight: 14 },
  pdfContentGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  pdfContentField: { width: "49%", minWidth: 280, flexGrow: 1, gap: 5 },
  fieldLabel: { fontSize: 11, fontWeight: "700" },
  inputSuffix: { fontSize: 12 },
  textInput: { minHeight: 42, maxHeight: 68, borderWidth: 1, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 9, fontSize: 12, lineHeight: 17, outlineStyle: "none" } as any,
  activityEditor: { borderWidth: 1, borderRadius: 10, padding: 8, flexDirection: "row", alignItems: "center", gap: 8 },
  activityEditorCompact: { flexWrap: "wrap", alignItems: "flex-start" },
  activityNumber: { width: 32, height: 36, borderWidth: 1, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  activityNumberLabel: { fontSize: 12, fontWeight: "800" },
  activityNameInput: { width: 220, minHeight: 38, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12, outlineStyle: "none" } as any,
  activityDescriptionInput: { flex: 1, minWidth: 240, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, fontSize: 11, lineHeight: 16, textAlignVertical: "top", outlineStyle: "none" } as any,
  activityDescriptionInputCompact: { minHeight: 40, maxHeight: 56, paddingVertical: 8 },
  activityDescriptionInputFocused: { minHeight: 240, maxHeight: 320, paddingVertical: 12 },
  activityDelete: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  addActivity: { minHeight: 40, alignSelf: "flex-start", borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 7 },
  addActivityLabel: { fontSize: 12, fontWeight: "700" },
  editFooter: { minHeight: 64, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 18, paddingVertical: 9, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  editFooterCompact: { minHeight: 116, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "column" },
  pdfStatus: { minHeight: 38, borderWidth: 1, borderRadius: 9, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 7 },
  pdfStatusLabel: { fontSize: 12, fontWeight: "700" },
  footerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  footerActionsCompact: { width: "100%", flexDirection: "row" },
  cancelButton: { minHeight: 42, borderWidth: 1, borderRadius: 9, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  cancelButtonLabel: { fontSize: 13, fontWeight: "700" },
  saveButton: { minHeight: 42, borderRadius: 9, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  saveButtonCompact: { flex: 1 },
  saveButtonLabel: { fontSize: 13, fontWeight: "800" },
  previewFooter: { minHeight: 66, borderTopWidth: StyleSheet.hairlineWidth, padding: 10, flexDirection: "row", gap: 8 },
  footerDownloadButton: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  footerDownloadLabel: { fontSize: 13, fontWeight: "800" },
  menuOption: { flexDirection: "row", alignItems: "center", gap: 10 },
  menuOptionCopy: { flex: 1, minWidth: 0, gap: 2 },
  menuOptionLabel: { fontSize: 13, fontWeight: "800" },
  menuOptionHint: { fontSize: 10 },
});
