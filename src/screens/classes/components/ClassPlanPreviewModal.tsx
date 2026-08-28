import { createElement, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import type { ClassGroup, TrainingPlan, TrainingPlanActivity } from "../../../core/models";
import {
  resolveTrainingPlanBlock,
  type TrainingPlanBlockKey,
} from "../../../core/training-plan-blocks";
import { PdfPreviewFrame } from "../../../pdf/PdfPreviewFrame";
import {
  buildSessionMonthlyPlanData,
  sessionPlanHtml,
  type SessionPlanPeriodizationSource,
} from "../../../pdf/templates/session-plan";
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
  findClassPlanUnnamedActivity,
  getClassPlanPdfContentDraft,
  normalizeClassTrainingPlan,
  removeClassPlanActivity,
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
import { PlanTimeDistribution } from "./PlanTimeDistribution";

export type ClassPlanPeriodizationSource = SessionPlanPeriodizationSource;

type ClassPlanPreviewModalProps = {
  visible: boolean;
  onClose: () => void;
  plan: TrainingPlan;
  classGroup: ClassGroup;
  lessonDate: string;
  coachName?: string;
  initialMode?: "preview" | "edit";
  initialDirty?: boolean;
  presentation?: "modal" | "workspace" | "embedded";
  draftStatus?: "idle" | "saving" | "saved" | "restored" | "error";
  periodizationSource?: ClassPlanPeriodizationSource;
  onSavePlan: (plan: TrainingPlan) => Promise<TrainingPlan>;
  onDraftChange?: (plan: TrainingPlan) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onRemovePlan?: () => Promise<void>;
  onApplyPlan?: (plan: TrainingPlan) => void | Promise<void>;
  onWorkspaceControlsChange?: (controls: ClassPlanWorkspaceHeaderControls | null) => void;
  workspaceLibraryExpanded?: boolean;
  onToggleWorkspaceLibrary?: () => void;
};

export type ClassPlanWorkspaceHeaderControls = {
  status: "saving" | "saved" | "error";
  onDownload: () => void;
  downloadDisabled: boolean;
  onApply?: () => void;
  applyDisabled: boolean;
  applyLabel: string;
};

type PreviewStatus = "idle" | "loading" | "ready" | "error";

const PREVIEW_LOAD_TIMEOUT_MS = 10_000;

type PdfBridgeMessage = {
  type?: string;
  blockKey?: unknown;
  section?: unknown;
  field?: unknown;
  text?: unknown;
  pageCount?: unknown;
  currentPage?: unknown;
};

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
  initialDirty = false,
  presentation = "modal",
  draftStatus = "idle",
  periodizationSource,
  onSavePlan,
  onDraftChange,
  onDirtyChange,
  onRemovePlan,
  onApplyPlan,
  onWorkspaceControlsChange,
  workspaceLibraryExpanded = false,
  onToggleWorkspaceLibrary,
}: ClassPlanPreviewModalProps) {
  const { colors } = useAppTheme();
  const { showSaveToast } = useSaveToast();
  const { confirm } = useConfirmDialog();
  const { width } = useWindowDimensions();
  const workspaceMode = presentation === "workspace";
  const embeddedMode = presentation === "embedded";
  const splitLayout = Platform.OS === "web" && width >= 980;
  const phoneLayout = width < 600;
  const inlinePdfEditor = true;
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("idle");
  const [previewHtml, setPreviewHtml] = useState("");
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
  const [previewZoom, setPreviewZoom] = useState(100);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewPageCount, setPreviewPageCount] = useState(1);
  const [previewRevision, setPreviewRevision] = useState(0);
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
  const directEditSnapshotCapturedRef = useRef(false);
  const workspaceRootRef = useRef<View | null>(null);

  useEffect(() => {
    if (!workspaceMode) return;
    const responsiveZoom = Platform.OS === "web" ? (width < 600 ? 70 : width < 980 ? 80 : 100) : 100;
    Promise.resolve().then(() => setPreviewZoom(responsiveZoom));
  }, [width, workspaceMode]);

  const keepWorkspaceAtTop = useCallback(() => {
    if (!workspaceMode || Platform.OS !== "web" || typeof window === "undefined") return;
    const resetScroll = () => {
      let node = workspaceRootRef.current as unknown as HTMLElement | null;
      while (node) {
        if (node.scrollTop > 0) node.scrollTo({ top: 0, left: 0, behavior: "auto" });
        node = node.parentElement;
      }
    };
    window.requestAnimationFrame(() => {
      resetScroll();
      window.requestAnimationFrame(resetScroll);
    });
  }, [workspaceMode]);

  const cardStyle = useModalCardStyle({
    maxHeight: "90%",
    maxWidth: 1200,
    fullWidth: false,
    padding: 0,
    radius: 18,
    flushBottom: false,
  });

  useEffect(() => {
    if (!visible) return;
    Promise.resolve().then(() => {
      setPdfPlan(plan);
    });
    Promise.resolve().then(() => {
      setWorkingPlan(plan);
    });
    workingPlanRef.current = plan;
    undoStackRef.current = [];
    directEditSnapshotCapturedRef.current = false;
    Promise.resolve().then(() => {
      setIsDirty(initialDirty);
    });
    Promise.resolve().then(() => {
      setIsEditing(initialMode === "edit");
    });
    Promise.resolve().then(() => {
      setIsEditorExpanded(initialMode === "edit");
    });
    Promise.resolve().then(() => {
      setIsPdfContentExpanded(false);
    });
    Promise.resolve().then(() => {
      setSelectedBlockKey("main");
    });
    Promise.resolve().then(() => {
      setFocusedActivityDescriptionIndex(null);
    });
    Promise.resolve().then(() => {
      setMobileView(initialMode === "edit" ? "outline" : "pdf");
    });
    Promise.resolve().then(() => {
      setPdfStatusLabel(initialDirty ? "Rascunho restaurado" : "PDF sincronizado");
    });
    Promise.resolve().then(() => {
      setPreviewPage(1);
      setPreviewPageCount(1);
    });
    Promise.resolve().then(() => {
      setShowMenu(false);
    });
    keepWorkspaceAtTop();
  }, [initialDirty, initialMode, keepWorkspaceAtTop, plan, visible]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
    if (isDirty) onDraftChange?.(workingPlan);
  }, [isDirty, onDirtyChange, onDraftChange, workingPlan]);

  const pdfData = useMemo(
    () => buildClassPlanPdfData({ classGroup, plan: pdfPlan, lessonDate, coachName, periodizationSource }),
    [classGroup, coachName, lessonDate, pdfPlan, periodizationSource]
  );
  const fileName = useMemo(() => {
    const date = lessonDate || pdfPlan.applyDate || "aula";
    const className = classGroup.name || "turma";
    return `plano-aula-${className}-${date}.pdf`;
  }, [classGroup.name, lessonDate, pdfPlan.applyDate]);

  useEffect(() => {
    if (!visible) return undefined;
    if (Platform.OS !== "web") {
      setPreviewStatus("loading");
      setPreviewHtml(sessionPlanHtml(pdfData, { editable: true }));
      setPdfBlob(null);
      setPdfSize(null);
      setPdfUrl("");
      return undefined;
    }

    let active = true;
    let generatedUrl = "";
    let firstFrame = 0;
    let secondFrame = 0;
    let idleHandle: number | undefined;

    setPreviewStatus("loading");
    setPreviewHtml("");
    setPdfBlob(null);
    setPdfSize(null);
    setPdfUrl("");

    // Gera o blob binário em background para download otimizado
    const idleCallback = (typeof window !== "undefined" && "requestIdleCallback" in window)
      ? (window as any).requestIdleCallback
      : (cb: () => void) => setTimeout(cb, 100);

    const prepareDownload = () => idleCallback(async () => {
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
      } catch {
        // Falha no blob em background não trava o preview visual
      }
    });

    const preparePreview = () => {
      if (!active) return;
      try {
        setPreviewHtml(sessionPlanHtml(pdfData, { editable: true }));
        idleHandle = prepareDownload();
      } catch {
        if (active) setPreviewStatus("error");
      }
    };

    if (typeof window !== "undefined") {
      firstFrame = window.requestAnimationFrame(() => {
        secondFrame = window.requestAnimationFrame(preparePreview);
      });
    } else {
      preparePreview();
    }

    return () => {
      active = false;
      if (firstFrame && typeof window !== "undefined") window.cancelAnimationFrame(firstFrame);
      if (secondFrame && typeof window !== "undefined") window.cancelAnimationFrame(secondFrame);
      if (typeof window !== "undefined" && "cancelIdleCallback" in window && idleHandle) {
        (window as any).cancelIdleCallback(idleHandle);
      }
      if (generatedUrl) URL.revokeObjectURL(generatedUrl);
    };
  }, [pdfData, retryKey, visible]);

  useEffect(() => {
    if (!visible || previewStatus !== "loading") return undefined;
    const timeout = setTimeout(() => {
      setPreviewStatus((current) => current === "loading" ? "error" : current);
    }, PREVIEW_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [previewStatus, visible]);

  const handleDownload = useCallback(async () => {
    if (isDownloading) return;
    if (isDirty) {
      showSaveToast({
        message: "Salve as alterações antes de baixar o PDF.",
        variant: "warning",
      });
      return;
    }
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
  }, [fileName, isDirty, isDownloading, pdfBlob, pdfData, showSaveToast]);

  const updateBlock = useCallback(
    (
      blockKey: TrainingPlanBlockKey,
      update: (draft: ClassPlanBlockDraft) => ClassPlanBlockDraft
    ) => {
      const current = workingPlanRef.current;
      const draft = buildClassPlanBlockDraft(current, blockKey);
      const nextPlan = updateClassTrainingPlanBlock(current, blockKey, update(draft));
      workingPlanRef.current = nextPlan;
      setWorkingPlan(nextPlan);
      setIsDirty(true);
      setPdfStatusLabel("Alterações não salvas");
      return nextPlan;
    },
    []
  );

  const updateSelectedBlock = useCallback(
    (update: (draft: ClassPlanBlockDraft) => ClassPlanBlockDraft) => {
      updateBlock(selectedBlockKey, update);
    },
    [selectedBlockKey, updateBlock]
  );

  const updatePlanTitle = useCallback((title: string) => {
    const nextPlan = { ...workingPlanRef.current, title: title.trim() };
    workingPlanRef.current = nextPlan;
    setWorkingPlan(nextPlan);
    setIsDirty(true);
    setPdfStatusLabel("Alterações não salvas");
  }, []);

  const updatePdfContentField = useCallback(<Key extends keyof ClassPlanPdfContentDraft,>(
    field: Key,
    value: ClassPlanPdfContentDraft[Key]
  ) => {
    setWorkingPlan((current) => {
      const resolvedLesson = buildSessionMonthlyPlanData(
        buildClassPlanPdfData({ classGroup, plan: current, lessonDate, coachName, periodizationSource })
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
  }, [classGroup, coachName, lessonDate, periodizationSource]);

  const handlePdfBridgeMessage = useCallback((data: unknown) => {
      const message = (data ?? {}) as PdfBridgeMessage;
      if (typeof message.type === "string" && message.type.startsWith("GOATLETA_PDF_")) {
        keepWorkspaceAtTop();
      }
      if (message.type === "GOATLETA_PDF_READY") {
        setPreviewStatus("ready");
      } else if (message.type === "GOATLETA_PDF_BLOCK_CLICK") {
        const { blockKey } = message;
        if (blockKey === "warmup" || blockKey === "main" || blockKey === "cooldown") {
          setSelectedBlockKey(blockKey);
          setIsPdfContentExpanded(false);
          if (!inlinePdfEditor && splitLayout) {
            setIsEditing(true);
            setIsEditorExpanded(true);
          }
        }
      } else if (message.type === "GOATLETA_PDF_SECTION_CLICK" && message.section === "pedagogy") {
        setIsPdfContentExpanded(true);
        if (!inlinePdfEditor && splitLayout) {
          setIsEditing(true);
          setIsEditorExpanded(true);
        }
      } else if (message.type === "GOATLETA_PDF_BACKGROUND_CLICK") {
        setIsEditing(false);
      } else if (message.type === "GOATLETA_PDF_PAGE_COUNT") {
        const pageCount = Math.max(1, Number(message.pageCount) || 1);
        setPreviewPageCount(pageCount);
        setPreviewPage((current) => Math.min(current, pageCount));
      } else if (message.type === "GOATLETA_PDF_PAGE_CHANGE") {
        const pageCount = Math.max(1, Number(message.pageCount) || 1);
        const currentPage = Math.max(1, Math.min(pageCount, Number(message.currentPage) || 1));
        setPreviewPageCount(pageCount);
        setPreviewPage(currentPage);
      } else if (message.type === "GOATLETA_PDF_EDIT") {
        const { field, text } = message;
        if (typeof field !== "string" || typeof text !== "string") return;

        if (!directEditSnapshotCapturedRef.current) {
          undoStackRef.current = [
            ...undoStackRef.current.slice(-19),
            { plan: workingPlanRef.current, isDirty, pdfStatusLabel },
          ];
          directEditSnapshotCapturedRef.current = true;
        }

        if (field === "title") {
          updatePlanTitle(text);
        } else if (field === "generalObjective") {
          updatePdfContentField("generalObjective", text);
        } else if (field === "specificObjective") {
          updatePdfContentField("specificObjective", text);
        } else if (field === "situationProblem") {
          updatePdfContentField("situationProblem", text);
        } else if (field === "observations") {
          updatePdfContentField("observations", text);
        } else if (field.startsWith("block-activity-")) {
          const [, , blockKeyValue, indexValue] = field.split("-");
          const blockKey = blockKeyValue as TrainingPlanBlockKey;
          const activityIndex = Number(indexValue);
          if (!CLASS_PLAN_BLOCK_KEYS.includes(blockKey) || !Number.isInteger(activityIndex)) return;
          setSelectedBlockKey(blockKey);
          updateBlock(blockKey, (draft) => {
            const activities = [...draft.activities];
            const currentActivity = activities[activityIndex] ?? { name: "", description: "" };
            activities[activityIndex] = { ...currentActivity, name: text.trim() };
            return { ...draft, activitiesText: undefined, activities };
          });
        } else if (field.startsWith("block-description-item-")) {
          const [, , , blockKeyValue, indexValue] = field.split("-");
          const blockKey = blockKeyValue as TrainingPlanBlockKey;
          const activityIndex = Number(indexValue);
          if (!CLASS_PLAN_BLOCK_KEYS.includes(blockKey) || !Number.isInteger(activityIndex)) return;
          setSelectedBlockKey(blockKey);
          updateBlock(blockKey, (draft) => {
            const activities = [...draft.activities];
            const currentActivity = activities[activityIndex] ?? { name: "", description: "" };
            activities[activityIndex] = { ...currentActivity, description: text.trim() };
            return { ...draft, descriptionText: undefined, activities };
          });
        } else if (field.startsWith("block-description-")) {
          const period = field.replace("block-description-", "");
          const blockKey: TrainingPlanBlockKey =
            period === "Aquecimento" ? "warmup" : period === "Parte principal" ? "main" : "cooldown";
          setSelectedBlockKey(blockKey);
          updateBlock(blockKey, (draft) => ({ ...draft, descriptionText: text }));
        } else if (field.startsWith("block-activities-")) {
          const period = field.replace("block-activities-", "");
          const blockKey: TrainingPlanBlockKey =
            period === "Aquecimento" ? "warmup" : period === "Parte principal" ? "main" : "cooldown";
          setSelectedBlockKey(blockKey);
          updateBlock(blockKey, (draft) => {
            const rawNames = text
              .split(/\r?\n/)
              .map((line) => line.replace(/^(?:\d+[\.\)]\s*|[-*]\s*)/, "").trim())
              .filter(Boolean);
            const activities: TrainingPlanActivity[] = rawNames.map((name, i) => {
              const existing = draft.activities[i];
              return existing ? { ...existing, name } : { name, description: "" };
            });
            return {
              ...draft,
              activitiesText: text,
              activities: activities.length ? activities : draft.activities,
            };
          });
        } else if (field.startsWith("block-time-")) {
          const period = field.replace("block-time-", "");
          const blockKey: TrainingPlanBlockKey =
            period === "Aquecimento" ? "warmup" : period === "Parte principal" ? "main" : "cooldown";
          setSelectedBlockKey(blockKey);
          updateBlock(blockKey, (draft) => ({ ...draft, duration: text }));
        }
      }
  }, [inlinePdfEditor, isDirty, keepWorkspaceAtTop, pdfStatusLabel, splitLayout, updateBlock, updatePdfContentField, updatePlanTitle]);

  const handlePreviewRetry = useCallback(() => {
    setPreviewStatus("loading");
    setPreviewRevision((current) => current + 1);
    setRetryKey((current) => current + 1);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handleMessage = (event: MessageEvent) => {
      handlePdfBridgeMessage(event.data);
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handlePdfBridgeMessage]);

  const persistWorkingPlan = useCallback(async (): Promise<TrainingPlan | null> => {
    if (isSaving) return null;
    if (!isDirty) return workingPlanRef.current;
    const currentWorkingPlan = workingPlanRef.current;
    const unnamedActivity = findClassPlanUnnamedActivity(currentWorkingPlan);
    if (unnamedActivity) {
      setSelectedBlockKey(unnamedActivity.blockKey);
      setIsPdfContentExpanded(false);
      setIsEditing(true);
      setIsEditorExpanded(true);
      if (!splitLayout) setMobileView("outline");
      const blockLabel =
        CLASS_PLAN_BLOCK_PRESENTATION[unnamedActivity.blockKey].label;
      showSaveToast({
        message: `Dê um nome à atividade ${unnamedActivity.index + 1} de ${blockLabel}.`,
        variant: "warning",
      });
      return null;
    }

    const normalizedPlan = normalizeClassTrainingPlan(currentWorkingPlan);
    if (!resolveTrainingPlanBlock(normalizedPlan, "main").activities.length) {
      showSaveToast({
        message: "Mantenha pelo menos uma atividade na parte principal.",
        variant: "warning",
      });
      return null;
    }
    setIsSaving(true);
    try {
      const savedPlan = await onSavePlan(normalizedPlan);
      setWorkingPlan(savedPlan);
      workingPlanRef.current = savedPlan;
      setPdfPlan(savedPlan);
      undoStackRef.current = [];
      directEditSnapshotCapturedRef.current = false;
      setIsDirty(false);
      setPdfStatusLabel("PDF atualizado agora");
      showSaveToast({ message: "Plano salvo e PDF atualizado.", variant: "success" });
      return savedPlan;
    } catch (error) {
      showSaveToast({
        error,
        message: "Não foi possível salvar o plano.",
        variant: "error",
      });
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [
    isDirty,
    isSaving,
    onSavePlan,
    showSaveToast,
    splitLayout,
  ]);

  const handleSave = useCallback(() => {
    void persistWorkingPlan();
  }, [persistWorkingPlan]);

  const handleApplyFromWorkspace = useCallback(async () => {
    if (!onApplyPlan || isSaving) return;
    const planToApply = isDirty ? await persistWorkingPlan() : workingPlanRef.current;
    if (planToApply) await onApplyPlan(planToApply);
  }, [isDirty, isSaving, onApplyPlan, persistWorkingPlan]);

  const handleWorkspaceUndo = useCallback(() => {
    const previous = undoStackRef.current.pop();
    if (!previous) return;
    workingPlanRef.current = previous.plan;
    setWorkingPlan(previous.plan);
    setPdfPlan(previous.plan);
    setPreviewRevision((current) => current + 1);
    setIsDirty(previous.isDirty);
    setPdfStatusLabel(previous.pdfStatusLabel);
    directEditSnapshotCapturedRef.current = false;
  }, []);

  const handleWorkspaceAddActivity = useCallback(() => {
    undoStackRef.current = [
      ...undoStackRef.current.slice(-19),
      { plan: workingPlanRef.current, isDirty, pdfStatusLabel },
    ];
    const nextPlan = updateBlock(selectedBlockKey, appendClassPlanActivity);
    setPdfPlan(nextPlan);
  }, [isDirty, pdfStatusLabel, selectedBlockKey, updateBlock]);

  useEffect(() => {
    if (!workspaceMode || !onWorkspaceControlsChange) return undefined;
    onWorkspaceControlsChange({
      status:
        draftStatus === "error"
          ? "error"
          : draftStatus === "saving"
            ? "saving"
            : draftStatus === "saved" || draftStatus === "restored"
              ? "saved"
              : isDirty
                ? "saving"
                : "saved",
      onDownload: () => void handleDownload(),
      downloadDisabled: isDownloading || previewStatus === "loading",
      onApply: onApplyPlan ? () => void handleApplyFromWorkspace() : undefined,
      applyDisabled: isSaving,
      applyLabel: workingPlan.classId ? "Aplicar à aula" : "Adicionar à turma",
    });
    return () => onWorkspaceControlsChange(null);
  }, [
    draftStatus,
    handleApplyFromWorkspace,
    handleDownload,
    isDirty,
    isDownloading,
    isSaving,
    onApplyPlan,
    onWorkspaceControlsChange,
    previewStatus,
    workspaceMode,
    workingPlan.classId,
  ]);

  const handleCancelEditing = useCallback(() => {
    setWorkingPlan(pdfPlan);
    workingPlanRef.current = pdfPlan;
    undoStackRef.current = [];
    directEditSnapshotCapturedRef.current = false;
    setPreviewRevision((current) => current + 1);
    setIsDirty(false);
    setIsEditing(false);
    setIsEditorExpanded(false);
    setIsPdfContentExpanded(false);
    setPdfStatusLabel("PDF sincronizado");
  }, [pdfPlan]);

  const requestClose = useCallback(() => {
    if (!isDirty) {
      onClose();
      return;
    }

    void confirm({
      title: "Descartar alterações do plano?",
      message: "As alterações ainda não foram salvas no plano desta aula.",
      confirmLabel: "Descartar alterações",
      cancelLabel: "Continuar editando",
      tone: "danger",
      onConfirm: onClose,
    });
  }, [confirm, isDirty, onClose]);

  const handleDeleteActivity = useCallback(
    (index: number) => {
      const currentDraft = buildClassPlanBlockDraft(
        workingPlanRef.current,
        selectedBlockKey
      );
      const nextDraft = removeClassPlanActivity(currentDraft, index);

      if (nextDraft === currentDraft) {
        showSaveToast({
          message:
            "Mantenha uma atividade neste bloco. Edite a atual ou adicione outra antes de removê-la.",
          variant: "warning",
        });
        return;
      }

      undoStackRef.current = [
        ...undoStackRef.current.slice(-19),
        { plan: workingPlanRef.current, isDirty, pdfStatusLabel },
      ];
      updateSelectedBlock((draft) => removeClassPlanActivity(draft, index));
      showSaveToast({
        message: "Atividade removida.",
        actionLabel: "Desfazer",
        onAction: () => {
          const previous = undoStackRef.current.pop();
          if (!previous) return;

          workingPlanRef.current = previous.plan;
          setWorkingPlan(previous.plan);
          setIsDirty(previous.isDirty);
          setPdfStatusLabel(previous.pdfStatusLabel);
          showSaveToast({
            message: "Atividade restaurada.",
            variant: "success",
          });
        },
        durationMs: 9000,
        variant: "success",
      });
    },
    [
      isDirty,
      pdfStatusLabel,
      selectedBlockKey,
      showSaveToast,
      updateSelectedBlock,
    ]
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
    if (!onRemovePlan) return;
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
      if (
        !splitLayout &&
        isEditing &&
        !isPdfContentExpanded &&
        selectedBlockKey === blockKey
      ) {
        setIsEditing(false);
        setIsEditorExpanded(false);
        return;
      }
      setSelectedBlockKey(blockKey);
      setIsPdfContentExpanded(false);
      setFocusedActivityDescriptionIndex(null);
      if (!isEditing) setIsEditing(true);
      setIsEditorExpanded(true);
      if (!splitLayout) setMobileView("outline");
    },
    [isEditing, isPdfContentExpanded, selectedBlockKey, splitLayout]
  );

  const selectPdfContent = useCallback(() => {
    if (!splitLayout && isEditing && isPdfContentExpanded) {
      setIsEditing(false);
      setIsEditorExpanded(false);
      return;
    }
    setIsPdfContentExpanded(true);
    setFocusedActivityDescriptionIndex(null);
    if (!isEditing) setIsEditing(true);
    setIsEditorExpanded(true);
    if (!splitLayout) setMobileView("outline");
  }, [isEditing, isPdfContentExpanded, splitLayout]);

  const preview = (
    <View style={[styles.previewPane, { backgroundColor: colors.backgroundSubtle }]}>
      {previewHtml ? (
        <View
          pointerEvents={previewStatus === "ready" ? "auto" : "none"}
          style={StyleSheet.absoluteFill}
        >
          <PdfPreviewFrame
            key={`plan-preview-${previewRevision}`}
            url={pdfUrl || ""}
            html={previewHtml}
            title={`PDF do plano ${pdfPlan.title}`}
            editable
            zoom={workspaceMode ? previewZoom : 100}
            minimumPageWidth={phoneLayout && Platform.OS === "web" ? 620 : undefined}
            onMessage={handlePdfBridgeMessage}
            onError={() => setPreviewStatus("error")}
          />
        </View>
      ) : null}
      {previewStatus === "error" ? (
        <View
          style={[styles.previewState, { backgroundColor: colors.backgroundSubtle }]}
          accessibilityLiveRegion="polite"
        >
          <GoAtletaIcon name="document" size={30} color={colors.muted} />
          <Text style={[styles.previewStateTitle, { color: colors.text }]}>Não foi possível preparar a prévia</Text>
          <Pressable
            onPress={handlePreviewRetry}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.retryAction,
              { borderColor: colors.border, opacity: pressed ? 0.72 : 1 },
            ]}
          >
            <Text style={[styles.retryActionLabel, { color: colors.text }]}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : previewStatus !== "ready" ? (
        <View
          style={[styles.previewState, { backgroundColor: colors.backgroundSubtle }]}
          accessibilityLiveRegion="polite"
          accessibilityRole="progressbar"
        >
          <ActivityIndicator size="small" color={colors.primaryBg} />
          <Text style={[styles.previewStateTitle, { color: colors.text }]}>Carregando plano…</Text>
        </View>
      ) : null}
    </View>
  );

  const renderOutline = (inlineEditor: ReactNode = null) => (
    <View
      style={[
        styles.outlinePane,
        !splitLayout ? styles.outlinePaneCompact : null,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.outlineTitle, { color: colors.text }]}>Roteiro da aula</Text>
      <ScrollView
        style={styles.outlineScroll}
        contentContainerStyle={styles.outlineContent}
        showsVerticalScrollIndicator={false}
      >
        {periodizationSource ? (
          <View
            style={[
              styles.periodizationSource,
              { backgroundColor: colors.backgroundSubtle, borderColor: colors.border },
            ]}
          >
            <View style={styles.periodizationSourceHeader}>
              <View
                style={[
                  styles.periodizationSourceIcon,
                  { backgroundColor: colors.successBg },
                ]}
              >
                <GoAtletaIcon name="periodization" size={17} color={colors.successText} />
              </View>
              <View style={styles.periodizationSourceCopy}>
                <Text style={[styles.periodizationSourceEyebrow, { color: colors.muted }]}>Fonte: periodização</Text>
                <Text style={[styles.periodizationSourceTitle, { color: colors.text }]}>
                  {periodizationSource.weekLabel} · {periodizationSource.phaseLabel}
                </Text>
              </View>
            </View>
            <View style={styles.periodizationSourceFacts}>
              <View style={[styles.periodizationSourceFact, { borderColor: colors.border }]}>
                <Text style={[styles.periodizationSourceFactLabel, { color: colors.muted }]}>Foco</Text>
                <Text style={[styles.periodizationSourceFactValue, { color: colors.text }]}>{periodizationSource.focusLabel}</Text>
              </View>
              <View style={[styles.periodizationSourceFact, { borderColor: colors.border }]}>
                <Text style={[styles.periodizationSourceFactLabel, { color: colors.muted }]}>Carga</Text>
                <Text style={[styles.periodizationSourceFactValue, { color: colors.text }]}>{periodizationSource.loadLabel}</Text>
              </View>
              <View style={[styles.periodizationSourceFact, { borderColor: colors.border }]}>
                <Text style={[styles.periodizationSourceFactLabel, { color: colors.muted }]}>Papel da aula</Text>
                <Text style={[styles.periodizationSourceFactValue, { color: colors.text }]}>
                  {periodizationSource.monthlyGameSession
                    ? "Jogo consolidado do mês"
                    : periodizationSource.roleLabel}
                </Text>
              </View>
            </View>
            {periodizationSource.classLevelLabel || periodizationSource.objectiveLabel || periodizationSource.loadModelLabel ? (
              <View style={styles.periodizationSourceFacts}>
                {periodizationSource.classLevelLabel ? (
                  <View style={[styles.periodizationSourceFact, { borderColor: colors.border }]}>
                    <Text style={[styles.periodizationSourceFactLabel, { color: colors.muted }]}>Nível da turma</Text>
                    <Text style={[styles.periodizationSourceFactValue, { color: colors.text }]}>{periodizationSource.classLevelLabel}</Text>
                  </View>
                ) : null}
                {periodizationSource.objectiveLabel ? (
                  <View style={[styles.periodizationSourceFact, { borderColor: colors.border }]}>
                    <Text style={[styles.periodizationSourceFactLabel, { color: colors.muted }]}>Objetivo</Text>
                    <Text style={[styles.periodizationSourceFactValue, { color: colors.text }]}>{periodizationSource.objectiveLabel}</Text>
                  </View>
                ) : null}
                {periodizationSource.loadModelLabel ? (
                  <View style={[styles.periodizationSourceFact, { borderColor: colors.border }]}>
                    <Text style={[styles.periodizationSourceFactLabel, { color: colors.muted }]}>Modelo de carga</Text>
                    <Text style={[styles.periodizationSourceFactValue, { color: colors.text }]}>{periodizationSource.loadModelLabel}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
            {periodizationSource.beforeLabel || workingPlan.pedagogy?.decisionTrace?.teacherFacingSummary ? (
              <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, gap: 5 }}>
                <Text style={{ color: colors.text, fontSize: 10, fontWeight: "900" }}>Por que este plano está assim?</Text>
                {workingPlan.pedagogy?.decisionTrace?.teacherFacingSummary ? (
                  <Text style={{ color: colors.muted, fontSize: 10, lineHeight: 15 }}>{workingPlan.pedagogy.decisionTrace.teacherFacingSummary}</Text>
                ) : null}
                {periodizationSource.beforeLabel ? <Text style={{ color: colors.muted, fontSize: 10, lineHeight: 15 }}><Text style={{ color: colors.text, fontWeight: "800" }}>Antes: </Text>{periodizationSource.beforeLabel}</Text> : null}
                {periodizationSource.nowLabel ? <Text style={{ color: colors.muted, fontSize: 10, lineHeight: 15 }}><Text style={{ color: colors.text, fontWeight: "800" }}>Agora: </Text>{periodizationSource.nowLabel}</Text> : null}
                {periodizationSource.afterLabel ? <Text style={{ color: colors.muted, fontSize: 10, lineHeight: 15 }}><Text style={{ color: colors.text, fontWeight: "800" }}>Depois: </Text>{periodizationSource.afterLabel}</Text> : null}
                {workingPlan.pedagogy?.decisionTrace?.influences.reportFeedback.used ? (
                  <Text style={{ color: colors.successText, fontSize: 10, lineHeight: 15, fontWeight: "700" }}>Relatórios recentes foram considerados nesta decisão.</Text>
                ) : null}
              </View>
            ) : null}
            <View style={[styles.periodizationTimeDistribution, { borderTopColor: colors.border }]}>
              <Text style={[styles.periodizationTimeDistributionTitle, { color: colors.text }]}>Distribuição do tempo</Text>
              <PlanTimeDistribution
                colors={colors}
                items={BLOCKS.map((item) => ({
                  label: item.label,
                  minutes: Number.parseInt(String(getDuration(workingPlan, item.key) ?? "0"), 10) || 0,
                }))}
              />
            </View>
          </View>
        ) : null}
        <Pressable
          onPress={selectPdfContent}
          accessibilityRole="button"
          accessibilityLabel={`${isPdfContentExpanded && isEditing ? "Recolher" : "Editar"} conteúdo pedagógico`}
          accessibilityState={{ expanded: isPdfContentExpanded && isEditing }}
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
          <GoAtletaIcon
            name={isPdfContentExpanded && isEditing ? "chevronUp" : "pencil"}
            size={15}
            color={colors.text}
          />
        </Pressable>
        {!splitLayout && isEditing && isPdfContentExpanded ? inlineEditor : null}
        {BLOCKS.map((item) => {
          const block = resolveTrainingPlanBlock(workingPlan, item.key);
          const activitySummary = summarizeClassPlanActivities(block.activities);
          const selected = !isPdfContentExpanded && selectedBlockKey === item.key;
          return (
            <View key={item.key} style={styles.outlineAccordionItem}>
              <Pressable
                onPress={() => selectBlock(item.key)}
                accessibilityRole="button"
                accessibilityLabel={`${selected && isEditing ? "Recolher" : "Editar"} ${item.label}`}
                accessibilityState={{ expanded: selected && isEditing }}
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
                <GoAtletaIcon
                  name={selected && isEditing ? "chevronUp" : "pencil"}
                  size={15}
                  color={colors.text}
                />
              </Pressable>
              {!splitLayout && isEditing && selected ? inlineEditor : null}
            </View>
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
    buildClassPlanPdfData({ classGroup, plan: workingPlan, lessonDate, coachName, periodizationSource })
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

  const renderEditFooter = (isCompact: boolean) => (
    <View
      style={[
        styles.editFooter,
        isCompact ? styles.editFooterCompact : null,
        { borderTopColor: colors.border, backgroundColor: colors.card },
      ]}
    >
      {!isCompact ? (
        <View style={[styles.pdfStatus, { borderColor: isDirty ? colors.warningBorder : colors.successBorder }]}>
          <GoAtletaIcon
            name={isDirty ? "warningCircle" : "success"}
            size={17}
            color={isDirty ? colors.warningText : colors.successText}
          />
          <Text numberOfLines={1} style={[styles.pdfStatusLabel, { color: isDirty ? colors.warningText : colors.successText }]}>
            {pdfStatusLabel}
          </Text>
        </View>
      ) : null}
      <View style={[styles.footerActions, isCompact ? styles.footerActionsCompact : null]}>
        {!isCompact ? (
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
            isCompact ? styles.saveButtonCompact : null,
            {
              backgroundColor: colors.primaryBg,
              opacity: !isDirty || isSaving ? 0.48 : pressed ? 0.8 : 1,
            },
          ]}
        >
          {isSaving ? <ActivityIndicator size="small" color={colors.primaryText} /> : null}
          <Text style={[styles.saveButtonLabel, { color: colors.primaryText }]}>Salvar e atualizar PDF</Text>
        </Pressable>
        {isCompact ? menuButton : null}
      </View>
    </View>
  );

  const editor = isEditing ? (
    <View
      style={[
        styles.editorPane,
        splitLayout ? styles.editorPaneDesktop : styles.editorPaneCompact,
        !isEditorExpanded && !splitLayout ? styles.editorPaneCollapsed : null,
        { borderTopColor: colors.border, borderLeftColor: colors.border, backgroundColor: colors.card },
      ]}
    >
      <View style={[styles.editorHeader, splitLayout ? styles.editorHeaderDesktop : null]}>
        {splitLayout ? (
          <Pressable
            onPress={() => setIsEditing(false)}
            accessibilityRole="button"
            accessibilityLabel="Voltar para o Roteiro da aula"
            style={({ pressed }) => [
              styles.backToOutlineButton,
              { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <GoAtletaIcon name="chevronBack" size={14} color={colors.text} />
            <Text style={[styles.backToOutlineLabel, { color: colors.text }]}>Voltar ao Roteiro</Text>
          </Pressable>
        ) : null}
        <View style={styles.editorTitleRow}>
          <Text style={[styles.editorTitle, { color: colors.text }]}>{editorSectionLabel}</Text>
          {!isPdfContentExpanded ? (
            <View style={[styles.headerDurationShell, { borderColor: colors.border, backgroundColor: colors.backgroundSubtle }]}>
              <Text style={[styles.durationLabelPrefix, { color: colors.muted }]}>Duração</Text>
              <TextInput
                value={selectedBlock.duration.replace(/\s*min\s*$/i, "")}
                onChangeText={(duration) => updateSelectedBlock((draft) => ({ ...draft, duration }))}
                keyboardType="number-pad"
                style={[styles.headerDurationInput, { color: colors.text }]}
                accessibilityLabel="Duração do bloco"
              />
              <Text style={[styles.inputSuffix, { color: colors.muted }]}>min</Text>
            </View>
          ) : null}
        </View>
      </View>
      {isEditorExpanded || splitLayout ? (
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
          <View style={splitLayout ? styles.pdfContentField : styles.pdfContentFieldCompact}>
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
          <View style={splitLayout ? styles.pdfContentField : styles.pdfContentFieldCompact}>
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
          <View style={splitLayout ? styles.pdfContentField : styles.pdfContentFieldCompact}>
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
          <View style={splitLayout ? styles.pdfContentField : styles.pdfContentFieldCompact}>
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
        <Text style={[styles.fieldLabel, { color: colors.muted }]}>ATIVIDADES</Text>
        {selectedBlock.activities.map((activity, index) => (
          <View
            key={`${selectedBlockKey}-${index}`}
            style={[styles.activityEditor, { borderColor: colors.border, backgroundColor: colors.card }]}
          >
            <View style={styles.activityHeaderRow}>
              <View style={[styles.activityNumber, { backgroundColor: colors.primaryBg }]}>
                <Text style={[styles.activityNumberLabel, { color: colors.primaryText }]}>{index + 1}</Text>
              </View>
              <TextInput
                value={activity.name}
                onChangeText={(name) =>
                  updateSelectedBlock((draft) => ({
                    ...draft,
                    activitiesText: undefined,
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
              <Pressable
                onPress={() => handleDeleteActivity(index)}
                accessibilityRole="button"
                accessibilityLabel={`Remover atividade ${index + 1}`}
                style={({ pressed }) => [styles.activityDelete, { opacity: pressed ? 0.6 : 1 }]}
              >
                <GoAtletaIcon name="trash" size={16} color={colors.dangerText} />
              </Pressable>
            </View>
            <TextInput
              value={activity.description ?? ""}
              onChangeText={(description) =>
                updateSelectedBlock((draft) => ({
                  ...draft,
                  descriptionText: undefined,
                  activities: draft.activities.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, description } : item
                  ),
                }))
              }
              placeholder="Organização, execução e condução da atividade"
              placeholderTextColor={colors.muted}
              multiline
              style={[
                styles.activityDescriptionInput,
                { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundSubtle },
              ]}
              accessibilityLabel={`Descrição da atividade ${index + 1}`}
            />
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
      {splitLayout ? renderEditFooter(false) : null}
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
          phoneLayout ? styles.iconActionPhone : null,
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

  const inlineSaveButton = (
    <Pressable
      onPress={handleSave}
      disabled={!isDirty || isSaving}
      accessibilityRole="button"
      accessibilityLabel={isDirty ? "Salvar plano" : "Plano salvo"}
      style={({ pressed }) => [
        styles.headerSaveButton,
        phoneLayout ? styles.headerSaveButtonPhone : null,
        {
          backgroundColor: colors.primaryBg,
          opacity: !isDirty || isSaving ? 0.55 : pressed ? 0.8 : 1,
        },
      ]}
    >
      {isSaving ? (
        <ActivityIndicator size="small" color={colors.primaryText} />
      ) : (
        <GoAtletaIcon
          name={isDirty ? "save" : "success"}
          size={17}
          color={colors.primaryText}
        />
      )}
      <Text style={[styles.headerButtonLabel, { color: colors.primaryText }]}>
        {isSaving
          ? "Salvando"
          : isDirty
            ? (phoneLayout ? "Salvar" : "Salvar plano")
            : phoneLayout
              ? "Salvar"
              : "Salvo"}
      </Text>
    </Pressable>
  );

  if (workspaceMode) {
    if (!visible) return null;

    if (Platform.OS !== "web") {
      return (
        <View
          ref={workspaceRootRef}
          style={[
            styles.workspaceRoot,
            styles.workspaceRootNative,
            { backgroundColor: colors.backgroundSubtle, borderColor: colors.border },
          ]}
        >
          <View
            style={[
              styles.workspaceContextBar,
              { backgroundColor: colors.card, borderBottomColor: colors.border },
            ]}
          >
            <View style={styles.workspaceContextCopy}>
              <GoAtletaIcon name="calendar" size={17} color={colors.primaryBg} />
              <View style={styles.workspaceContextText}>
                <Text numberOfLines={1} style={[styles.workspaceContextTitle, { color: colors.text }]}>
                  {classGroup.name || workingPlan.title || "Novo plano"}
                </Text>
                <Text numberOfLines={1} style={[styles.workspaceContextMeta, { color: colors.muted }]}>
                  {formatLessonDate(lessonDate)} · {formatLessonTime(classGroup) || "Horário a definir"}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={handleWorkspaceUndo}
              disabled={!undoStackRef.current.length}
              accessibilityRole="button"
              accessibilityLabel="Desfazer alteração"
              style={({ pressed }) => [
                styles.workspaceIconButton,
                {
                  borderColor: colors.border,
                  opacity: !undoStackRef.current.length ? 0.4 : pressed ? 0.68 : 1,
                },
              ]}
            >
              <GoAtletaIcon name="restore" size={17} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.workspacePreview}>{preview}</View>
        </View>
      );
    }

    return (
      <View ref={workspaceRootRef} style={[styles.workspaceRoot, { backgroundColor: colors.backgroundSubtle, borderColor: colors.border }]}>
        <View
          style={[
            styles.workspaceFloatingControls,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
            {onToggleWorkspaceLibrary ? (
              <Pressable
                onPress={onToggleWorkspaceLibrary}
                accessibilityRole="button"
                accessibilityLabel={workspaceLibraryExpanded ? "Recolher biblioteca" : "Expandir biblioteca"}
                accessibilityState={{ expanded: workspaceLibraryExpanded }}
                style={({ pressed }) => [
                  styles.workspaceIconButton,
                  { borderColor: colors.border, opacity: pressed ? 0.68 : 1 },
                ]}
              >
                <GoAtletaIcon
                  name={workspaceLibraryExpanded ? "chevronBack" : "chevronForward"}
                  size={17}
                  color={colors.text}
                />
              </Pressable>
            ) : null}
            <Pressable
              onPress={handleWorkspaceUndo}
              disabled={!undoStackRef.current.length}
              accessibilityRole="button"
              accessibilityLabel="Desfazer alteração"
              style={({ pressed }) => [
                styles.workspaceIconButton,
                {
                  borderColor: colors.border,
                  opacity: !undoStackRef.current.length ? 0.4 : pressed ? 0.68 : 1,
                },
              ]}
            >
              <GoAtletaIcon name="restore" size={17} color={colors.text} />
            </Pressable>
            <View style={[styles.workspaceZoomControl, { borderColor: colors.border }]}>
              <Pressable
                onPress={() => setPreviewZoom((current) => Math.max(70, current - 10))}
                accessibilityRole="button"
                accessibilityLabel="Reduzir zoom"
                style={styles.workspaceZoomButton}
              >
                <GoAtletaIcon name="remove" size={16} color={colors.text} />
              </Pressable>
              <Text style={[styles.workspaceZoomLabel, { color: colors.text }]}>{previewZoom}%</Text>
              <Pressable
                onPress={() => setPreviewZoom((current) => Math.min(140, current + 10))}
                accessibilityRole="button"
                accessibilityLabel="Aumentar zoom"
                style={styles.workspaceZoomButton}
              >
                <GoAtletaIcon name="add" size={16} color={colors.text} />
              </Pressable>
            </View>
            <View style={[styles.workspacePageChip, { borderColor: colors.border }]}>
              <Text style={[styles.workspacePageChipLabel, { color: colors.muted }]}>{previewPage} / {previewPageCount}</Text>
            </View>
            <Pressable
              onPress={() => setPreviewZoom(100)}
              accessibilityRole="button"
              accessibilityLabel="Ajustar documento à largura"
              style={({ pressed }) => [
                styles.workspaceFitButton,
                { opacity: pressed ? 0.68 : 1 },
              ]}
            >
              <GoAtletaIcon name="expand" size={16} color={colors.text} />
            </Pressable>
        </View>

        <View style={styles.workspacePreview}>{preview}</View>
      </View>
    );
  }

  const modalContent = (
    <>
      <View style={[styles.header, phoneLayout ? styles.headerPhone : null, { borderBottomColor: colors.border }]}>
        <View style={styles.headerCopy}>
          <Text numberOfLines={1} style={[styles.title, phoneLayout ? styles.titlePhone : null, { color: colors.text }]}>Plano da aula</Text>
          <Text numberOfLines={1} style={[styles.subtitle, phoneLayout ? styles.subtitlePhone : null, { color: colors.muted }]}>
            {classGroup.name} · {formatLessonDate(lessonDate)} · {formatLessonTime(classGroup)}
          </Text>
        </View>

        {splitLayout ? (
          <>
            {inlinePdfEditor ? inlineSaveButton : null}
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
            {inlinePdfEditor ? inlineSaveButton : null}
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
            {menuButton}
          </>
        )}
        <Pressable
          onPress={requestClose}
          accessibilityRole="button"
          accessibilityLabel="Fechar plano"
          style={({ pressed }) => [
            styles.closeAction,
            phoneLayout ? styles.closeActionPhone : null,
            { borderColor: colors.border, opacity: pressed ? 0.72 : 1 },
          ]}
        >
          <GoAtletaIcon name="close" size={20} color={colors.text} />
        </Pressable>
      </View>

      {!splitLayout && !inlinePdfEditor ? (
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
          {inlinePdfEditor ? (
            preview
          ) : splitLayout ? (
            <>
              {preview}
              {isEditing ? editor : renderOutline()}
            </>
          ) : mobileView === "pdf" ? (
            preview
          ) : (
            <ScrollView
              style={styles.compactOutlineScroll}
              contentContainerStyle={styles.compactOutlineContent}
              keyboardShouldPersistTaps="handled"
            >
              {renderOutline(editor)}
            </ScrollView>
          )}
        </View>
      </View>

      {!inlinePdfEditor && isEditing && !splitLayout ? renderEditFooter(true) : !inlinePdfEditor && !splitLayout ? (
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
            onPress={handleSave}
            disabled={!isDirty || isSaving}
            accessibilityRole="button"
            accessibilityLabel="Salvar e atualizar PDF"
            style={({ pressed }) => [
              styles.saveButton,
              styles.saveButtonCompact,
              {
                backgroundColor: colors.primaryBg,
                opacity: !isDirty || isSaving ? 0.48 : pressed ? 0.8 : 1,
              },
            ]}
          >
            {isSaving ? <ActivityIndicator size="small" color={colors.primaryText} /> : null}
            <Text style={[styles.saveButtonLabel, { color: colors.primaryText }]}>Salvar e atualizar PDF</Text>
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
    </>
  );

  if (embeddedMode) {
    return <View style={{ flex: 1, minHeight: 0 }}>{modalContent}</View>;
  }

  return (
    <ModalSheet
      visible={visible}
      onClose={requestClose}
      position="center"
      overlayZIndex={6000}
      containerPadding={8}
      cardStyle={[
        cardStyle,
        styles.modalCard,
        styles.modalCardCentered,
        { borderColor: colors.border, borderWidth: 1 },
      ]}
    >
      {modalContent}
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  workspaceRoot: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: 14,
    position: "relative",
  },
  workspaceRootNative: {
    borderRadius: 12,
  },
  workspaceFloatingControls: {
    position: "absolute",
    left: 14,
    top: 14,
    zIndex: 20,
    minHeight: 42,
    padding: 4,
    borderWidth: 1,
    borderRadius: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    boxShadow: "0 8px 20px rgba(10, 19, 34, 0.22)",
  },
  workspaceIconButton: {
    width: 38,
    height: 38,
    borderWidth: 1,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  workspaceZoomControl: {
    height: 38,
    borderWidth: 1,
    borderRadius: 9,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  workspaceZoomButton: {
    width: 34,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  workspaceZoomLabel: {
    minWidth: 44,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "800",
  },
  workspacePageChip: {
    minWidth: 54,
    height: 38,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  workspacePageChipLabel: { fontSize: 12, fontWeight: "800" },
  workspaceFitButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  workspaceContextBar: {
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  workspaceContextCopy: {
    minWidth: 0,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  workspaceContextText: { flex: 1, minWidth: 0 },
  workspaceContextTitle: { fontSize: 13, fontWeight: "900" },
  workspaceContextMeta: { fontSize: 11 },
  workspaceNativeOutline: { flex: 1, minHeight: 0 },
  workspaceDuration: {
    minHeight: 32,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  workspaceDurationInput: {
    width: 34,
    minHeight: 28,
    paddingVertical: 3,
    paddingHorizontal: 2,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "800",
    outlineStyle: "none",
  } as any,
  workspaceDurationSuffix: { fontSize: 11, fontWeight: "700" },
  workspacePreview: { flex: 1, minHeight: 0, paddingTop: 68 },
  modalCard: { overflow: "hidden", paddingBottom: 0, marginBottom: 0, gap: 0 },
  modalCardCentered: {
    width: "94%",
    maxWidth: 1200,
    height: "90%",
    maxHeight: 840,
    borderRadius: 18,
    borderWidth: 1,
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
  headerPhone: {
    minHeight: 60,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 19, fontWeight: "800" },
  titlePhone: { fontSize: 17 },
  subtitle: { marginTop: 3, fontSize: 12 },
  subtitlePhone: { marginTop: 1, fontSize: 11 },
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
  headerSaveButton: {
    minHeight: 40,
    borderRadius: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  headerSaveButtonPhone: {
    minHeight: 38,
    paddingHorizontal: 10,
    gap: 5,
  },
  iconAction: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  iconActionPhone: { width: 38, height: 38, borderRadius: 9 },
  closeAction: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  closeActionPhone: { width: 38, height: 38, borderRadius: 19 },
  mobileTabs: { minHeight: 46, flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  mobileTab: { flex: 1, alignItems: "center", justifyContent: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  mobileTabLabel: { fontSize: 13, fontWeight: "800" },
  body: { flex: 1, minHeight: 0 },
  primaryWorkspace: { flex: 1, minHeight: 0 },
  primaryWorkspaceDesktop: { flexDirection: "row" },
  previewPane: { flex: 1.7, minWidth: 0, minHeight: 0 },
  previewState: { flex: 1, zIndex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, gap: 9 },
  previewStateTitle: { fontSize: 15, fontWeight: "800", textAlign: "center" },
  previewStateText: { maxWidth: 320, fontSize: 12, lineHeight: 18, textAlign: "center" },
  retryAction: { minHeight: 40, borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  retryActionLabel: { fontSize: 13, fontWeight: "700" },
  outlinePane: { width: 420, minHeight: 0, borderLeftWidth: 1, padding: 14, gap: 12 },
  outlinePaneCompact: { width: "100%", flex: 1, alignSelf: "stretch", borderLeftWidth: 0 },
  outlineTitle: { fontSize: 16, fontWeight: "800" },
  outlineScroll: { flex: 1 },
  outlineContent: { gap: 8, paddingBottom: 8 },
  periodizationSource: { width: "100%", borderWidth: 1, borderRadius: 12, padding: 12, gap: 11 },
  periodizationSourceHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  periodizationSourceIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  periodizationSourceCopy: { flex: 1, minWidth: 0, gap: 2 },
  periodizationSourceEyebrow: { fontSize: 10, fontWeight: "700" },
  periodizationSourceTitle: { fontSize: 14, lineHeight: 19, fontWeight: "900" },
  periodizationSourceFacts: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  periodizationSourceFact: { flexGrow: 1, flexBasis: 112, minWidth: 0, borderWidth: 1, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 8, gap: 3 },
  periodizationSourceFactLabel: { fontSize: 9, fontWeight: "700" },
  periodizationSourceFactValue: { fontSize: 11, lineHeight: 15, fontWeight: "800" },
  periodizationTimeDistribution: { borderTopWidth: 1, paddingTop: 11, gap: 9 },
  periodizationTimeDistributionTitle: { fontSize: 11, fontWeight: "800" },
  outlineAccordionItem: { width: "100%", gap: 8 },
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
  editorPane: { flex: 1, minHeight: 0 },
  editorPaneDesktop: { width: 420, height: "100%", borderLeftWidth: 1, borderTopWidth: 0 },
  editorPaneCompact: { height: 380, minHeight: 280, borderTopWidth: 1 },
  editorPaneCollapsed: { height: 62, minHeight: 62 },
  editorHeader: { minHeight: 62, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  editorHeaderDesktop: { minHeight: 88, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "column", alignItems: "stretch", gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  backToOutlineButton: { minHeight: 32, alignSelf: "flex-start", borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 6 },
  backToOutlineLabel: { fontSize: 12, fontWeight: "700" },
  editorTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, width: "100%" },
  editorTitle: { minWidth: 0, fontSize: 17, fontWeight: "800" },
  editorHeaderActions: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  headerDurationField: { flexDirection: "row", alignItems: "center", gap: 8 },
  durationLabelPrefix: { fontSize: 11, fontWeight: "700" },
  headerDurationShell: { width: 110, minHeight: 36, borderWidth: 1, borderRadius: 8, flexDirection: "row", alignItems: "center", paddingHorizontal: 9 },
  headerDurationInput: { flex: 1, minWidth: 0, paddingVertical: 6, fontSize: 13, fontWeight: "700", textAlign: "center", outlineStyle: "none" } as any,
  editorCollapseAction: { width: 36, height: 36, marginLeft: "auto", alignItems: "center", justifyContent: "center" },
  editorScroll: { flex: 1 },
  editorContent: { paddingHorizontal: 16, paddingBottom: 18, gap: 12 },
  editorFieldsCompact: {
    width: "100%",
    flexDirection: "column",
    flexWrap: "nowrap",
    alignItems: "stretch",
  },
  pdfContentHint: { fontSize: 10, lineHeight: 14 },
  pdfContentGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  pdfContentField: { width: "49%", minWidth: 280, flexGrow: 1, gap: 5 },
  pdfContentFieldCompact: {
    width: "100%",
    minWidth: 0,
    maxWidth: "100%",
    flexGrow: 0,
    flexShrink: 1,
    alignSelf: "stretch",
    gap: 5,
  },
  fieldLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  inputSuffix: { fontSize: 12 },
  textInput: { minHeight: 52, maxHeight: 110, borderWidth: 1, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 9, fontSize: 12, lineHeight: 18, outlineStyle: "none" } as any,
  activityEditor: { borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: "column", gap: 10, width: "100%" },
  activityEditorCompact: { flexWrap: "nowrap" },
  activityHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8, width: "100%" },
  activityNumber: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  activityNumberLabel: { fontSize: 12, fontWeight: "800" },
  activityNameInput: { flex: 1, minWidth: 0, minHeight: 38, borderWidth: 1, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 7, fontSize: 13, fontWeight: "700", outlineStyle: "none" } as any,
  activityDescriptionInput: { width: "100%", minHeight: 84, borderWidth: 1, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 9, fontSize: 12, lineHeight: 18, textAlignVertical: "top", outlineStyle: "none" } as any,
  activityDescriptionInputCompact: { minHeight: 72, maxHeight: 120, paddingVertical: 8 },
  activityDescriptionInputFocused: { minHeight: 110, maxHeight: 160, paddingVertical: 9 },
  activityDelete: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  addActivity: { minHeight: 40, alignSelf: "flex-start", borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 7 },
  addActivityLabel: { fontSize: 12, fontWeight: "700" },
  editFooter: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "column", gap: 8, width: "100%" },
  editFooterCompact: { paddingHorizontal: 12, paddingVertical: 10 },
  pdfStatus: { minHeight: 34, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 7, width: "100%" },
  pdfStatusLabel: { fontSize: 11, fontWeight: "700" },
  footerActions: { width: "100%", flexDirection: "row", alignItems: "center", gap: 8 },
  footerActionsCompact: { width: "100%", flexDirection: "row" },
  cancelButton: { minHeight: 38, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  cancelButtonLabel: { fontSize: 12, fontWeight: "700" },
  saveButton: { flex: 1, minHeight: 38, borderRadius: 8, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  saveButtonCompact: { flex: 1 },
  saveButtonLabel: { fontSize: 12, fontWeight: "800" },
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
