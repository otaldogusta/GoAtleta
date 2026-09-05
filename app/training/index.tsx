import * as Calendar from "expo-calendar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Keyboard, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenPageHeader } from "../../src/components/ui/ScreenPageHeader";

import { Pressable } from "../../src/ui/Pressable";
import { SectionLoadingState } from "../../src/components/ui/SectionLoadingState";
import { normalizeAgeBand } from "../../src/core/age-band";
import { translateMethodology } from "../../src/core/methodology/methodology-translator";
import type { ClassGroup, Exercise, HiddenTemplate, TrainingPlan, TrainingPlanActivity, TrainingTemplate } from "../../src/core/models";
import { createTrainingPlanVersion } from "../../src/core/training-plan-factory";
import type { TrainingPlanBlockKey } from "../../src/core/training-plan-blocks";
import { trainingTemplates } from "../../src/core/trainingTemplates";
import { deleteTrainingPlan, deleteTrainingTemplate, getClasses, getHiddenTemplates, getLatestTrainingPlanByClass, getTrainingPlans, getTrainingTemplates, hideTrainingTemplate, saveTrainingPlan, saveTrainingTemplate, updateTrainingTemplate, upsertTrainingSession } from "../../src/db/seed";
import { navigateBackOrReplace } from "../../src/navigation/safe-router";
import { useTrainerRouteScope } from "../../src/navigation/use-trainer-route-scope";
import { useAuth } from "../../src/auth/auth";
import { useEffectiveProfile } from "../../src/hooks/use-effective-profile";
import { notifyTrainingSaved } from "../../src/notifications";
import { notificationScopeForEffectiveProfile } from "../../src/notifications/inbox-scope";
import { logAction } from "../../src/observability/breadcrumbs";
import { markRender, measure, measureAsync } from "../../src/observability/perf";

import { PlanningLibraryBridgeSheet } from "../../src/screens/training/components/PlanningLibraryBridgeSheet";
import { TrainingPlanningWorkspaceLibrary, type TrainingPlanningWorkspaceTemplate } from "../../src/screens/training/components/TrainingPlanningWorkspaceLibrary";
import type { ClassPlanWorkspaceHeaderControls } from "../../src/screens/classes/components/ClassPlanPreviewModal";
import { normalizeClassTrainingPlan } from "../../src/screens/classes/application/edit-class-training-plan";
import { addPlanningActivityToBlock, buildPlanningActivitiesFromLegacyLines, buildTrainingPlanActivityFromCatalogItem, buildTrainingPlanActivityFromExerciseLink, createPlanningWorkspaceDraft, createEmptyPlanningBlockActivities, hydratePlanningActivitiesFromPlan, type PlanningBlockActivities } from "../../src/screens/training/application/planning-library-bridge";

import { buildTrainingPlanWorkspaceExitConfirmation } from "../../src/screens/training/application/training-plan-workspace-exit";
import { buildTrainingPlanWorkspaceDraftKey, loadTrainingPlanWorkspaceLibrary, removeTrainingPlanWorkspaceLibraryItem, upsertTrainingPlanWorkspaceLibrary } from "../../src/screens/training/application/training-plan-workspace-draft";
import { createTrainingPlanApplication } from "../../src/screens/training/application/apply-training-plan";
import { createAssistantWorkspacePlan, resolveWorkspaceEntryRequest, resolveWorkspaceDraftRestoration } from "../../src/screens/training/application/workspace-entry";
import { useTemplateEditorForm } from "../../src/screens/training/hooks/useTemplateEditorForm";
import { useTrainingPlanForm } from "../../src/screens/training/hooks/useTrainingPlanForm";
import { useTrainingPlanWorkspaceDraft } from "../../src/screens/training/hooks/useTrainingPlanWorkspaceDraft";
import type { ActivityCatalogListItem } from "../../src/screens/library/activity-catalog-view-model";

import { useAppTheme } from "../../src/ui/app-theme";

import { useConfirmDialog } from "../../src/ui/confirm-dialog";
import { useConfirmUndo } from "../../src/ui/confirm-undo";
import { ConfirmCloseOverlay } from "../../src/ui/ConfirmCloseOverlay";

import { ModalSheet } from "../../src/ui/ModalSheet";
import { useSaveToast } from "../../src/ui/save-toast";

import { sortClassesByAgeBand } from "../../src/ui/sort-classes";
import { useCollapsibleAnimation } from "../../src/ui/use-collapsible";
import { useModalCardStyle } from "../../src/ui/use-modal-card-style";
import { usePersistedState } from "../../src/ui/use-persisted-state";
import { useResponsiveLayout } from "../../src/ui/use-responsive-layout";
import { useOptionalOrganization } from "../../src/providers/OrganizationProvider";

import { GoAtletaIcon } from "../../src/ui/icon-registry";

const TemplateEditorModalContent = lazy(() =>
  import("../../src/screens/training/components/TemplateEditorModalContent").then((module) => ({
    default: module.TemplateEditorModalContent,
  }))
);

const TrainingApplyModalContent = lazy(() =>
  import("../../src/screens/training/components/TrainingApplyModalContent").then((module) => ({
    default: module.TrainingApplyModalContent,
  }))
);

function createTrainingTemplateId() {
  return `tpl_${Date.now()}`;
}

const TrainingPlanActionsModalContent = lazy(() =>
  import("../../src/screens/training/components/TrainingPlanActionsModalContent").then(
    (module) => ({
      default: module.TrainingPlanActionsModalContent,
    })
  )
);

const TrainingSessionCreateModalContent = lazy(() =>
  import("../../src/screens/training/components/TrainingSessionCreateModalContent").then(
    (module) => ({
      default: module.TrainingSessionCreateModalContent,
    })
  )
);

const ClassPlanPreviewModal = lazy(() =>
  import("../../src/screens/classes/components/ClassPlanPreviewModal").then((module) => ({
    default: module.ClassPlanPreviewModal,
  }))
);

const TrainingPlanPdfImportModal = lazy(() =>
  import("../../src/screens/training/components/TrainingPlanPdfImportModal").then((module) => ({
    default: module.TrainingPlanPdfImportModal,
  }))
);

const TrainingSpreadsheetImportModal = lazy(() =>
  import("../../src/screens/training/components/TrainingSpreadsheetImportModal").then((module) => ({
    default: module.TrainingSpreadsheetImportModal,
  }))
);

const toLines = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const isManualTextActivity = (activity: TrainingPlanActivity) =>
  !activity.catalog &&
  !activity.execution &&
  !activity.organization &&
  !activity.starter &&
  !activity.action &&
  !activity.rotation &&
  !activity.coachFocus &&
  !(activity.materials?.length);

type PlanningDetailSelection = {
  blockKey: TrainingPlanBlockKey;
  index: number;
};

const formatShortDateValue = (value: Date) =>
  value.toLocaleDateString("pt-BR");

const weekdays = [
  { id: 1, label: "Seg" },
  { id: 2, label: "Ter" },
  { id: 3, label: "Qua" },
  { id: 4, label: "Qui" },
  { id: 5, label: "Sex" },
  { id: 6, label: "Sab" },
  { id: 7, label: "Dom" },
];

const extractKeywords = (value: string) => {
  const stopwords = new Set([
    "para",
    "com",
    "sem",
    "uma",
    "uns",
    "umas",
    "ate",
    "ate",
    "que",
    "por",
    "dos",
    "das",
    "e",
    "de",
    "do",
    "da",
    "em",
    "no",
    "na",
    "nos",
    "nas",
  ]);
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => token.length >= 3 && !stopwords.has(token));
};

export default function TrainingList() {
  const { session } = useAuth();
  const organizationId = useOptionalOrganization()?.activeOrganization?.id;
  const workspaceKey = buildTrainingPlanWorkspaceDraftKey({ userId: session?.user?.id, organizationId });
  return <TrainingWorkspace key={workspaceKey ?? "signed-out"} />;
}

function TrainingWorkspace() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const responsiveLayout = useResponsiveLayout("dashboard");
  const router = useRouter();
  const scopedRoutes = useTrainerRouteScope();
  const effectiveProfile = useEffectiveProfile();
  const { session } = useAuth();
  const activeOrganization = useOptionalOrganization()?.activeOrganization ?? null;
  const notificationInboxScope = notificationScopeForEffectiveProfile(effectiveProfile);
  const { confirm } = useConfirmUndo();
  const { confirm: confirmDialog } = useConfirmDialog();
  const { showSaveToast } = useSaveToast();
  const templateEditorCardStyle = useModalCardStyle({ maxHeight: "100%" });

  const applyModalCardStyle = useModalCardStyle({ maxHeight: "100%" });
  const planActionsCardStyle = useModalCardStyle({ maxHeight: "100%" });
  const params = useLocalSearchParams();
  const targetClassId =
    typeof params.targetClassId === "string" ? params.targetClassId : "";
  const targetDateRaw =
    typeof params.targetDate === "string" ? params.targetDate : "";
  const initialTabRaw =
    typeof params.tab === "string" ? params.tab : "";
  const importMode =
    typeof params.import === "string" ? params.import : "";
  const openForm =
    typeof params.openForm === "string" ? params.openForm === "1" : false;
  const aiDraftRaw =
    typeof params.aiDraft === "string" ? params.aiDraft : "";
  const applyPlanId =
    typeof params.applyPlanId === "string" ? params.applyPlanId : "";
  const viewPlanId =
    typeof params.viewPlanId === "string" ? params.viewPlanId : "";
  const createSessionClassIdsRaw =
    typeof params.createSessionClassIds === "string" ? params.createSessionClassIds : "";
  const createSessionDateRaw =
    typeof params.createSessionDate === "string" ? params.createSessionDate : "";
  const createSessionStartTimeRaw =
    typeof params.createSessionStartTime === "string"
      ? params.createSessionStartTime
      : "";
  const targetDate =
    targetDateRaw && !Number.isNaN(new Date(targetDateRaw).getTime())
      ? targetDateRaw
      : "";
  const initialTab =
    initialTabRaw === "formulario" ||
    initialTabRaw === "salvos" ||
    initialTabRaw === "modelos"
      ? initialTabRaw
      : "";
  const {
    planForm,
    setTitle,
    setTagsText,
    setWarmup,
    setMain,
    setCooldown,
    setWarmupTime,
    setMainTime,
    setCooldownTime,
    setEditingId,
    setEditingCreatedAt,
    setFormUnit,
  } = useTrainingPlanForm();
  const { title, tagsText, warmup, main, cooldown, editingId, formUnit } = planForm;
  const [items, setItems] = useState<TrainingPlan[]>([]);
  const [templateItems, setTemplateItems] = useState<TrainingTemplate[]>([]);
  const [hiddenTemplates, setHiddenTemplates] = useState<HiddenTemplate[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [classCatalogKey, setClassCatalogKey] = useState<string | null>(null);
  const [classId, setClassId] = useState("");
  const [planningActivities, setPlanningActivities] =
    useState<PlanningBlockActivities>(() => createEmptyPlanningBlockActivities());
  const [planningLibraryBlockKey, setPlanningLibraryBlockKey] =
    useState<TrainingPlanBlockKey | null>(null);
  const [planningDetailSelection, setPlanningDetailSelection] =
    useState<PlanningDetailSelection | null>(null);

  const [selectedPlan, setSelectedPlan] = useState<TrainingPlan | null>(null);
  const [showPlanningPdfImport, setShowPlanningPdfImport] = useState(false);
  const [showSpreadsheetImport, setShowSpreadsheetImport] = useState(false);
  const workspaceDraftKey = useMemo(
    () =>
      buildTrainingPlanWorkspaceDraftKey({
        userId: session?.user?.id,
        organizationId: activeOrganization?.id,
      }),
    [activeOrganization?.id, session?.user?.id]
  );
  const {
    restoredDraft: restoredWorkspaceDraft,
    status: workspaceDraftStatus,
    isHydrated: workspaceDraftHydrated,
    queueDraft: queueWorkspaceDraft,
    flushDraft: flushWorkspaceDraft,
    clearDraft: clearWorkspaceDraft,
    consumeRestoredDraft,
  } = useTrainingPlanWorkspaceDraft(workspaceDraftKey);
  const previousWorkspaceDraftStatusRef = useRef(workspaceDraftStatus);
  useEffect(() => {
    const previousStatus = previousWorkspaceDraftStatusRef.current;
    previousWorkspaceDraftStatusRef.current = workspaceDraftStatus;
    if (
      responsiveLayout.isMobile &&
      workspaceDraftStatus === "error" &&
      previousStatus !== "error"
    ) {
      showSaveToast({
        message: "Não foi possível salvar o rascunho.",
        variant: "error",
      });
    }
  }, [responsiveLayout.isMobile, showSaveToast, workspaceDraftStatus]);
  const [workspaceHasUnsavedChanges, setWorkspaceHasUnsavedChanges] = useState(false);
  const [workspaceHeaderControls, setWorkspaceHeaderControls] =
    useState<ClassPlanWorkspaceHeaderControls | null>(null);
  const [workspaceDraftRestored, setWorkspaceDraftRestored] = useState(false);
  const [workspaceDraftLessonDate, setWorkspaceDraftLessonDate] = useState("");
  const [workspaceLibraryCollapsed, setWorkspaceLibraryCollapsed] = usePersistedState<boolean>(
    "training_workspace_library_collapsed_v1",
    false
  );
  const screenRootRef = useRef<View>(null);
  useEffect(() => {
    if (responsiveLayout.canPersistExpandedSidebar) return;
    Promise.resolve().then(() => setWorkspaceLibraryCollapsed(true));
  }, [responsiveLayout.canPersistExpandedSidebar, setWorkspaceLibraryCollapsed]);
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return undefined;

    const frame = window.requestAnimationFrame(() => {
      let node = screenRootRef.current as unknown as HTMLElement | null;
      while (node) {
        if (node.scrollTop > 0) node.scrollTo({ top: 0, left: 0, behavior: "auto" });
        node = node.parentElement;
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [items.length, selectedPlan?.id]);
  useEffect(() => {
    const restoration = resolveWorkspaceDraftRestoration(restoredWorkspaceDraft, classes, Boolean(workspaceDraftKey && classCatalogKey === workspaceDraftKey));
    if (!restoredWorkspaceDraft || restoration === "waiting") return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      if (restoration === "unavailable") {
        // Keep the stored draft: loss of class access is not authorization to delete it.
        consumeRestoredDraft();
        showSaveToast({ message: "O rascunho foi preservado. Sua turma não está disponível neste workspace.", variant: "warning" });
        return;
      }
      setSelectedPlan(restoredWorkspaceDraft.plan);
      setClassId(restoredWorkspaceDraft.plan.classId);
      setWorkspaceDraftLessonDate(restoredWorkspaceDraft.lessonDate);
      setWorkspaceDraftRestored(true);
      setWorkspaceHasUnsavedChanges(true);
      consumeRestoredDraft();
    });
    return () => { cancelled = true; };
  }, [classCatalogKey, classes, consumeRestoredDraft, restoredWorkspaceDraft, showSaveToast, workspaceDraftKey]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !workspaceHasUnsavedChanges) {
      return undefined;
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      void flushWorkspaceDraft();
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [flushWorkspaceDraft, workspaceHasUnsavedChanges]);
  const [, setShowSavedPlans] = usePersistedState<boolean>(
    "training_show_saved_plans_v1",
    true
  );

  const [formY, ] = useState(0);
  const formContainerRef = useRef<View>(null);
  const formUnitTriggerRef = useRef<View>(null);
  const formClassTriggerRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [scrollRequested, setScrollRequested] = useState(false);
  const [templateAgeBand, ] = useState("");
  const [, setFormMode] = useState<"plan" | "template">("plan");
  const [planningTab, setPlanningTab] = useState<
    "formulario" | "salvos" | "modelos"
  >("formulario");
  const { templateForm, setTemplateTitle, setTemplateAge, setTemplateTags, setTemplateWarmup, setTemplateMain, setTemplateCooldown, setTemplateWarmupTime, setTemplateMainTime, setTemplateCooldownTime, setTemplateEditorId, setTemplateEditorCreatedAt, setTemplateEditorSource, setTemplateEditorTemplateId, setTemplateEditorComposerHeight, setTemplateEditorKeyboardHeight, setShowTemplateEditor, setShowTemplateCloseConfirm } = useTemplateEditorForm();
  const { templateTitle, templateAge, templateTags, templateWarmup, templateMain, templateCooldown, templateWarmupTime, templateMainTime, templateCooldownTime, templateEditorId, templateEditorCreatedAt, templateEditorSource, templateEditorTemplateId, templateEditorComposerHeight, templateEditorKeyboardHeight, showTemplateEditor, showTemplateCloseConfirm } = templateForm;
  markRender("screen.training.render.root");
  const [lastCreatedPlanId, ] = useState<string | null>(null);
  const [lastCreatedClassId, ] = useState("");
  const [templateEditorSnapshot, setTemplateEditorSnapshot] = useState<{
    title: string;
    age: string;
    tags: string;
    warmup: string;
    main: string;
    cooldown: string;
    warmupTime: string;
    mainTime: string;
    cooldownTime: string;
  } | null>(null);
  const [pendingPlanCreate, setPendingPlanCreate] = usePersistedState<{
    classId: string;
    date: string;
  } | null>("training_pending_plan_create_v1", null);
  const [handledWorkspaceEntryKey, setHandledWorkspaceEntryKey] = useState<string | null>(null);
  const [applyUnit, setApplyUnit] = useState("");
  const [applyClassId, setApplyClassId] = useState("");
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [isApplyingPlan, setIsApplyingPlan] = useState(false);
  const [planApplication] = useState(createTrainingPlanApplication);
  const [showApplyCloseConfirm, setShowApplyCloseConfirm] = useState(false);
  const [applyPlan, setApplyPlan] = useState<TrainingPlan | null>(null);
  const [applyDays, setApplyDays] = useState<number[]>([]);
  const [applyDate, setApplyDate] = useState("");
  const [showApplyUnitPicker, setShowApplyUnitPicker] = useState(false);
  const [showApplyClassPicker, setShowApplyClassPicker] = useState(false);
  const [showFormUnitPicker, ] = useState(false);
  const [showFormClassPicker, ] = useState(false);
  const [applyContainerWindow, setApplyContainerWindow] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [, setFormContainerWindow] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [applyUnitTriggerLayout, setApplyUnitTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [applyClassTriggerLayout, setApplyClassTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [, setFormUnitTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [, setFormClassTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const incomingWorkspaceEntry = useMemo(() => resolveWorkspaceEntryRequest({
    openForm, assistantRaw: aiDraftRaw, targetClassId, targetDate, pendingCreate: pendingPlanCreate,
  }), [aiDraftRaw, openForm, pendingPlanCreate, targetClassId, targetDate]);
  const applyContainerRef = useRef<View>(null);
  const applyUnitTriggerRef = useRef<View>(null);
  const applyClassTriggerRef = useRef<View>(null);

  const {
    animatedStyle: applyUnitPickerAnimStyle,
    isVisible: showApplyUnitPickerContent,
  } = useCollapsibleAnimation(showApplyUnitPicker, { translateY: -6 });
  const {
    animatedStyle: applyClassPickerAnimStyle,
    isVisible: showApplyClassPickerContent,
  } = useCollapsibleAnimation(showApplyClassPicker, { translateY: -6 });
  const [handledApplyPlanId, setHandledApplyPlanId] = useState<string | null>(
    null
  );
  const [handledViewPlanId, setHandledViewPlanId] = useState<string | null>(
    null
  );
  const [applySnapshot, setApplySnapshot] = useState<{
    unit: string;
    classId: string;
    days: number[];
    date: string;
  } | null>(null);
  const [showApplyCalendar, setShowApplyCalendar] = useState(false);
  const [showPlanActions, setShowPlanActions] = useState(false);
  const [actionPlan, setActionPlan] = useState<TrainingPlan | null>(null);
  const [showTrainingFabMenu, setShowTrainingFabMenu] = useState(false);

  const [showTrainingSessionCreate, setShowTrainingSessionCreate] = useState(false);
  const [handledCreateSessionRequestRaw, setHandledCreateSessionRequestRaw] = useState<string | null>(null);
  const [trainingFabAnim] = useState(() => new Animated.Value(0));

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === classId),
    [classes, classId]
  );
  const trainingSessionDefaultClassIds = (() =>
      createSessionClassIdsRaw
        ? createSessionClassIdsRaw
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        : selectedClass?.id
          ? [selectedClass.id]
          : [])();
  const createSessionRequestKey = useMemo(
    () => createSessionClassIdsRaw.split(",").map((item) => item.trim()).filter(Boolean).join(","),
    [createSessionClassIdsRaw]
  );
  const trainingSessionDefaultDate = useMemo(
    () =>
      /^\d{4}-\d{2}-\d{2}$/.test(createSessionDateRaw) ? createSessionDateRaw : "",
    [createSessionDateRaw]
  );
  const trainingSessionDefaultStartTime = useMemo(
    () =>
      /^\d{2}:\d{2}$/.test(createSessionStartTimeRaw) ? createSessionStartTimeRaw : "",
    [createSessionStartTimeRaw]
  );

  useEffect(() => {
    Animated.timing(trainingFabAnim, {
      toValue: showTrainingFabMenu ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [showTrainingFabMenu, trainingFabAnim]);

  useEffect(() => {
    if (planningTab === "formulario" && showTrainingFabMenu) {
      Promise.resolve().then(() => {
        setShowTrainingFabMenu(false);
      });
    }
  }, [planningTab, showTrainingFabMenu]);

  useEffect(() => {
    if (!createSessionRequestKey) return;
    if (createSessionRequestKey === handledCreateSessionRequestRaw) return;
    Promise.resolve().then(() => {
      setHandledCreateSessionRequestRaw(createSessionRequestKey);
    });
    Promise.resolve().then(() => {
      setShowTrainingSessionCreate(true);
    });
  }, [createSessionRequestKey, handledCreateSessionRequestRaw]);

  const sortedClasses = useMemo(
    () => sortClassesByAgeBand(classes),
    [classes]
  );

  const classById = useMemo(() => {
    const map = new Map<string, ClassGroup>();
    classes.forEach((item) => {
      map.set(item.id, item);
    });
    return map;
  }, [classes]);

  const unitLabel = (value: string) =>
    value && value.trim() ? value.trim() : "Sem unidade";

  const ALL_UNITS_VALUE = "__all__";

  const unitOptions = useMemo(() => {
    const units = new Set<string>();
    classes.forEach((item) => {
      units.add(unitLabel(item.unit));
    });
    return Array.from(units).sort((a, b) => a.localeCompare(b));
  }, [classes]);

  const classOptionsForUnit = useMemo(() => {
    if (applyUnit === ALL_UNITS_VALUE) return sortedClasses;
    if (!applyUnit) return [];
    return sortedClasses.filter((item) => unitLabel(item.unit) === applyUnit);
  }, [applyUnit, sortedClasses]);

  const selectedApplyClass = useMemo(
    () => classOptionsForUnit.find((item) => item.id === applyClassId) ?? null,
    [applyClassId, classOptionsForUnit]
  );

  useEffect(() => {
    if (!classId) return;
    if (formUnit) return;
    const selected = classes.find((item) => item.id === classId);
    if (!selected) return;
    const selectedUnit = unitLabel(selected.unit);
    if (selectedUnit && selectedUnit !== formUnit) {
      setFormUnit(selectedUnit);
    }
  }, [classId, classes, formUnit, setFormUnit]);

  useEffect(() => {
    if (!formUnit || !classId) return;
    const selected = classes.find((item) => item.id === classId);
    if (!selected) return;
    if (unitLabel(selected.unit) !== formUnit) {
      Promise.resolve().then(() => {
        setClassId("");
      });
    }
  }, [formUnit, classId, classes]);

  useEffect(() => {
    if (!applyPlan) return;
    const defaultClass = classes.find((item) => item.id === applyPlan.classId);
    const targetClass = classes.find((item) => item.id === targetClassId);
    const resolvedClass = targetClass ?? defaultClass;
    const resolvedClassId = resolvedClass?.id ?? "";
    const resolvedUnit = resolvedClass ? unitLabel(resolvedClass.unit) : ALL_UNITS_VALUE;
    const resolvedDate = targetDate || applyPlan.applyDate || "";
    const isFreshPlan =
      lastCreatedPlanId && applyPlan.id === lastCreatedPlanId;
    if (isFreshPlan) {
      const freshClassId = lastCreatedClassId;
      const freshClass = classes.find((item) => item.id === freshClassId);
      const freshUnit = freshClass ? unitLabel(freshClass.unit) : "";
      Promise.resolve().then(() => {
        setApplyUnit(freshUnit);
      });
      Promise.resolve().then(() => {
        setApplyClassId(freshClassId || "");
      });
      Promise.resolve().then(() => {
        setApplyDays([]);
      });
      Promise.resolve().then(() => {
        setApplyDate("");
      });
      Promise.resolve().then(() => {
        setApplySnapshot({
                unit: freshUnit,
                classId: freshClassId || "",
                days: [],
                date: "",
              });
      });
      return;
    }
    Promise.resolve().then(() => {
      setApplyUnit(resolvedUnit);
    });
    Promise.resolve().then(() => {
      setApplyClassId(resolvedClassId);
    });
    Promise.resolve().then(() => {
      setApplyDays(applyPlan.applyDays ?? []);
    });
    Promise.resolve().then(() => {
      setApplyDate(resolvedDate);
    });
    Promise.resolve().then(() => {
      setApplySnapshot({
            unit: resolvedUnit,
            classId: resolvedClassId,
            days: (applyPlan.applyDays ?? []).slice().sort((a, b) => a - b),
            date: resolvedDate,
          });
    });
  }, [applyPlan, classes, lastCreatedClassId, lastCreatedPlanId, targetClassId, targetDate]);

  useEffect(() => {
    if (!applyPlanId || applyPlanId === handledApplyPlanId) return;
    const plan = items.find((item) => item.id === applyPlanId);
    if (!plan) return;
    Promise.resolve().then(() => {
      setApplyPlan(plan);
    });
    Promise.resolve().then(() => {
      setShowApplyModal(true);
    });
    Promise.resolve().then(() => {
      setHandledApplyPlanId(applyPlanId);
    });
  }, [applyPlanId, handledApplyPlanId, items]);

  useEffect(() => {
    if (!viewPlanId || viewPlanId === handledViewPlanId) return;
    const plan = items.find((item) => item.id === viewPlanId);
    if (!plan) return;
    Promise.resolve().then(() => {
      setSelectedPlan(plan);
    });
    setShowSavedPlans(true);
    Promise.resolve().then(() => {
      setHandledViewPlanId(viewPlanId);
    });
  }, [handledViewPlanId, items, setShowSavedPlans, viewPlanId]);

  const parseTimeParts = (value: string) => {
    const match = value.match(/^(\d{2}):(\d{2})$/);
    if (!match) return null;
    return { hour: Number(match[1]), minute: Number(match[2]) };
  };

  const getCalendarId = async () => {
    if (Platform.OS === "web") return null;
    const permission = await Calendar.requestCalendarPermissionsAsync();
    if (!permission.granted) return null;
    if (Platform.OS === "ios") {
      const defaultCalendar = await Calendar.getDefaultCalendarAsync();
      if (defaultCalendar.id) return defaultCalendar.id;
    }
    const calendars = await Calendar.getCalendarsAsync(
      Calendar.EntityTypes.EVENT
    );
    const writable = calendars.find((item) => item.allowsModifications);
    return writable?.id ?? calendars[0]?.id ?? null;
  };

  const createCalendarEvent = async (plan: TrainingPlan) => {
    if (Platform.OS === "web") return;
    if (!plan.applyDate) return;
    const classItem = classes.find((item) => item.id === plan.classId);
    if (!classItem) return;
    if (!classItem.startTime) return;
    const time = parseTimeParts(classItem.startTime);
    if (!time) return;
    const startDate = new Date(
      `${plan.applyDate}T${classItem.startTime}:00`
    );
    if (Number.isNaN(startDate.getTime())) return;
    const duration = classItem.durationMinutes || 60;
    const endDate = new Date(startDate.getTime() + duration * 60000);
    const calendarId = await getCalendarId();
    if (!calendarId) return;
    await Calendar.createEventAsync(calendarId, {
      title: `${plan.title} - ${classItem.name}`,
      startDate,
      endDate,
      location: classItem.unit || undefined,
      notes: `Planejamento aplicado para ${classItem.name}.`,
    });
  };

  useEffect(() => {
    if (!applyClassId) return;
    const stillValid = classOptionsForUnit.some(
      (item) => item.id === applyClassId
    );
    if (!stillValid) {
      Promise.resolve().then(() => {
        setApplyClassId(classOptionsForUnit[0]?.id ?? "");
      });
    }
  }, [classOptionsForUnit, applyClassId]);

  const isTemplateEditorDirty = useMemo(() => {
    if (!templateEditorSnapshot) return false;
    return (
      templateEditorSnapshot.title !== templateTitle ||
      templateEditorSnapshot.age !== templateAge ||
      templateEditorSnapshot.tags !== templateTags ||
      templateEditorSnapshot.warmup !== templateWarmup ||
      templateEditorSnapshot.main !== templateMain ||
      templateEditorSnapshot.cooldown !== templateCooldown ||
      templateEditorSnapshot.warmupTime !== templateWarmupTime ||
      templateEditorSnapshot.mainTime !== templateMainTime ||
      templateEditorSnapshot.cooldownTime !== templateCooldownTime
    );
  }, [
    templateAge,
    templateCooldown,
    templateCooldownTime,
    templateEditorSnapshot,
    templateMain,
    templateMainTime,
    templateTags,
    templateTitle,
    templateWarmup,
    templateWarmupTime,
  ]);

  const isApplyDirty = useMemo(() => {
    if (!applySnapshot) return false;
    const nextDays = applyDays.slice().sort((a, b) => a - b);
    if (applySnapshot.unit !== applyUnit) return true;
    if (applySnapshot.classId !== applyClassId) return true;
    if (applySnapshot.date !== applyDate) return true;
    if (applySnapshot.days.length !== nextDays.length) return true;
    return applySnapshot.days.some((value, index) => value !== nextDays[index]);
  }, [applyClassId, applyDate, applyDays, applySnapshot, applyUnit]);

  const canApply = useMemo(() => {
    if (!applyPlan) return false;
    if (!applyClassId) return false;
    if (!applyDays.length) return false;
    if (!applyDate) return false;
    return !Number.isNaN(new Date(applyDate).getTime());
  }, [applyPlan, applyClassId, applyDays, applyDate]);

  const isSameApply = useMemo(() => {
    if (!applyPlan) return false;
    if (applyPlan.classId !== applyClassId) return false;
    if ((applyPlan.applyDate ?? "") !== applyDate) return false;
    const currentDays = (applyPlan.applyDays ?? [])
      .slice()
      .sort((a, b) => a - b);
    const nextDays = applyDays.slice().sort((a, b) => a - b);
    if (currentDays.length !== nextDays.length) return false;
    return currentDays.every((value, index) => value === nextDays[index]);
  }, [applyPlan, applyClassId, applyDate, applyDays]);

  const templates = useMemo(() => {
    const combined = [
      ...trainingTemplates.map((template) => ({
        id: "built_" + template.id,
        title: template.title,
        tags: template.tags,
        warmup: template.warmup,
        main: template.main,
        cooldown: template.cooldown,
        warmupTime: template.warmupTime,
        mainTime: template.mainTime,
        cooldownTime: template.cooldownTime,
        ageBands: template.ageBands
          .map((band) => normalizeAgeBand(band))
          .filter(Boolean),
        createdAt: "",
        source: "built" as const,
      })),
      ...templateItems.map((template) => ({
        id: template.id,
        title: template.title,
        tags: template.tags,
        warmup: template.warmup,
        main: template.main,
        cooldown: template.cooldown,
        warmupTime: template.warmupTime,
        mainTime: template.mainTime,
        cooldownTime: template.cooldownTime,
        ageBands: [normalizeAgeBand(template.ageBand)].filter(Boolean),
        createdAt: template.createdAt,
        source: "custom" as const,
      })),
    ];
    const hiddenSet = new Set(
      hiddenTemplates.map((item) => item.templateId)
    );
    const visible = combined.filter(
      (template) => !hiddenSet.has(template.id)
    );
    if (!templateAgeBand) return visible;
    const normalizedBand = normalizeAgeBand(templateAgeBand);
    return visible.filter((template) =>
      template.ageBands.includes(normalizedBand)
    );
  }, [templateAgeBand, templateItems, hiddenTemplates]);

  const refreshTemplateCatalog = useCallback(async () => {
    const [templatesDb, hidden] = await Promise.all([
      getTrainingTemplates(),
      getHiddenTemplates(),
    ]);
    setTemplateItems(templatesDb);
    setHiddenTemplates(hidden);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [classList, plans, localPlans] = await measureAsync(
          "screen.training.load.initial",
          () =>
            Promise.all([
              getClasses(),
              getTrainingPlans(),
              loadTrainingPlanWorkspaceLibrary(workspaceDraftKey),
            ]),
          { screen: "training" }
        );
        if (!alive) return;
        setClasses(classList);
        setClassCatalogKey(workspaceDraftKey);
        setItems([...localPlans, ...plans.filter((plan) => !localPlans.some((draft) => draft.id === plan.id))]);
        void measureAsync(
          "screen.training.load.templates",
          async () => {
            const [templatesDb, hidden] = await Promise.all([
              getTrainingTemplates(),
              getHiddenTemplates(),
            ]);
            if (!alive) return;
            setTemplateItems(templatesDb);
            setHiddenTemplates(hidden);
          },
          { screen: "training" }
        );
      } catch (error) {
        if (!alive) return;
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("Missing auth token")) {
          setClasses([]);
          setTemplateItems([]);
          setHiddenTemplates([]);
          setItems([]);
          return;
        }
        console.warn("Training bootstrap load skipped.", error);
      }
    })();
    return () => {
      alive = false;
    };
  }, [workspaceDraftKey]);

  useEffect(() => {
    if (
      Platform.OS !== "web" ||
      Boolean(incomingWorkspaceEntry) ||
      !workspaceDraftHydrated ||
      restoredWorkspaceDraft ||
      selectedPlan ||
      !classes.length
    ) {
      return;
    }
    const routePlan = items.find(
      (plan) =>
        (!targetClassId || plan.classId === targetClassId) &&
        (!targetDate || plan.applyDate === targetDate)
    );
    const initialPlan = routePlan ?? items[0] ?? createPlanningWorkspaceDraft();
    Promise.resolve().then(() => {
      setSelectedPlan(initialPlan);
      setClassId(initialPlan.classId);
    });
  }, [
    classes,
    items,
    restoredWorkspaceDraft,
    selectedPlan,
    targetClassId,
    targetDate,
    workspaceDraftHydrated,
    incomingWorkspaceEntry,
  ]);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = (event: any) => {
      const height = event.endCoordinates?.height ?? 0;
      setTemplateEditorKeyboardHeight(height);
    };
    const onHide = () => setTemplateEditorKeyboardHeight(0);
    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [setTemplateEditorKeyboardHeight]);

  const tagCounts = useMemo(() => {
    const source = items;
    const map: Record<string, number> = {};
    source.forEach((item) => {
      (item.tags ?? []).forEach((tag) => {
        const key = tag.toLowerCase();
        map[key] = (map[key] ?? 0) + 1;
      });
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [items]);

  const getClassName = useCallback(
    (id: string) => classById.get(id)?.name ?? "Turma",
    [classById]
  );

  const currentTags = useMemo(() => {
    return tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => t.toLowerCase());
  }, [tagsText]);

  const templateCurrentTags = useMemo(() => {
    return templateTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => t.toLowerCase());
  }, [templateTags]);

  const selectedClassForMethodology = useMemo(
    () => classes.find((item) => item.id === classId) ?? null,
    [classId, classes]
  );

  const methodologyTranslation = useMemo(() => {
    const selectedAgeBand = selectedClassForMethodology?.ageBand || templateAgeBand;
    if (!selectedAgeBand) return null;
    return translateMethodology({
      ageBand: selectedAgeBand,
      sessionDurationMinutes: selectedClassForMethodology?.durationMinutes ?? 60,
      objectiveHint: title || templateTitle,
    });
  }, [selectedClassForMethodology, templateAgeBand, templateTitle, title]);

  useMemo(() => {
    const planText = [
      title,
      warmup,
      main,
      cooldown,
    ].join(" ");
    const keywords = extractKeywords(planText);
    const keywordSet = new Set(keywords);
    const translatorTags = methodologyTranslation?.tags ?? [];

    const fromExistingTags = tagCounts
      .map(([tag]) => tag)
      .filter((tag) => {
        const normalized = tag.toLowerCase();
        return (
          !currentTags.includes(normalized) &&
          (keywordSet.has(normalized) || keywords.some((word) => normalized.includes(word)))
        );
      });

    const keywordCounts = keywords.reduce<Record<string, number>>((acc, token) => {
      acc[token] = (acc[token] ?? 0) + 1;
      return acc;
    }, {});
    const fromPlanText = Object.entries(keywordCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([token]) => token)
      .filter((token) => !currentTags.includes(token));

    const combined = [
      ...translatorTags,
      ...fromExistingTags,
      ...fromPlanText,
    ];
    const seen = new Set<string>();
    const result: string[] = [];
    combined.forEach((tag) => {
      const normalized = tag.toLowerCase();
      if (seen.has(normalized)) return;
      seen.add(normalized);
      result.push(tag);
    });
    if (result.length < 6) {
      tagCounts
        .map(([tag]) => tag)
        .forEach((tag) => {
          const normalized = tag.toLowerCase();
          if (seen.has(normalized) || currentTags.includes(normalized)) return;
          seen.add(normalized);
          result.push(tag);
        });
    }
    return result.slice(0, 8);
  }, [cooldown, currentTags, main, methodologyTranslation, tagCounts, title, warmup]);

  const templateSuggestions = useMemo(() => {
    const templateText = [
      templateTitle,
      templateWarmup,
      templateMain,
      templateCooldown,
    ].join(" ");
    const keywords = extractKeywords(templateText);
    const keywordSet = new Set(keywords);
    const translatorTags =
      templateAge.trim() || templateAgeBand
        ? translateMethodology({
            ageBand: templateAge.trim() || templateAgeBand,
            objectiveHint: templateTitle,
          }).tags
        : [];

    const fromExistingTags = tagCounts
      .map(([tag]) => tag)
      .filter((tag) => {
        const normalized = tag.toLowerCase();
        return (
          !templateCurrentTags.includes(normalized) &&
          (keywordSet.has(normalized) || keywords.some((word) => normalized.includes(word)))
        );
      });

    const keywordCounts = keywords.reduce<Record<string, number>>((acc, token) => {
      acc[token] = (acc[token] ?? 0) + 1;
      return acc;
    }, {});
    const fromTemplateText = Object.entries(keywordCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([token]) => token)
      .filter((token) => !templateCurrentTags.includes(token));

    const combined = [...translatorTags, ...fromExistingTags, ...fromTemplateText];
    const seen = new Set<string>();
    const result: string[] = [];
    combined.forEach((tag) => {
      const normalized = tag.toLowerCase();
      if (seen.has(normalized)) return;
      seen.add(normalized);
      result.push(tag);
    });
    if (result.length < 6) {
      tagCounts
        .map(([tag]) => tag)
        .forEach((tag) => {
          const normalized = tag.toLowerCase();
          if (seen.has(normalized) || templateCurrentTags.includes(normalized)) return;
          seen.add(normalized);
          result.push(tag);
        });
    }
    return result.slice(0, 6);
  }, [
    tagCounts,
    templateAge,
    templateAgeBand,
    templateCooldown,
    templateCurrentTags,
    templateMain,
    templateTitle,
    templateWarmup,
  ]);

  const reload = useCallback(async () => {
    const [data, localPlans] = await Promise.all([
      getTrainingPlans(),
      loadTrainingPlanWorkspaceLibrary(workspaceDraftKey),
    ]);
    setItems([...localPlans, ...data.filter((plan) => !localPlans.some((draft) => draft.id === plan.id))]);
  }, [workspaceDraftKey]);

  const hydrateFormFromPlanningActivities = useCallback(
    (activities: PlanningBlockActivities) => {
      setWarmup(
        (activities.warmup ?? [])
          .filter(isManualTextActivity)
          .map((activity) => activity.name)
          .join("\n")
      );
      setMain(
        (activities.main ?? [])
          .filter(isManualTextActivity)
          .map((activity) => activity.name)
          .join("\n")
      );
      setCooldown(
        (activities.cooldown ?? [])
          .filter(isManualTextActivity)
          .map((activity) => activity.name)
          .join("\n")
      );
    },
    [setCooldown, setMain, setWarmup]
  );


  const applyLegacyActivitiesToPlanningForm = useCallback(
    (lines: Record<TrainingPlanBlockKey, string[]>) => {
      setPlanningActivities(buildPlanningActivitiesFromLegacyLines(lines));
    },
    [],
  );

  const handleAddPlannedActivity = useCallback(
    async (blockKey: TrainingPlanBlockKey, activity: TrainingPlanActivity) => {
      const result = addPlanningActivityToBlock(planningActivities, blockKey, activity);
      if (!result.added) {
        const shouldAddDuplicate = await confirmDialog({
          title: "Adicionar duplicado?",
          message: `"${activity.name || "Esta atividade"}" já está neste bloco. Deseja adicionar mesmo assim como duplicado?`,
          confirmLabel: "Adicionar duplicado",
          cancelLabel: "Cancelar",
          onConfirm: () => {},
        });
        if (!shouldAddDuplicate) {
          showSaveToast({ message: "Atividade duplicada cancelada.", variant: "info" });
          return false;
        }
        const duplicateResult = addPlanningActivityToBlock(
          planningActivities,
          blockKey,
          activity,
          { allowDuplicate: true }
        );
        setPlanningActivities(duplicateResult.activities);
        showSaveToast({ message: "Atividade adicionada como duplicada.", variant: "success" });
        return true;
      }
      setPlanningActivities(result.activities);
      showSaveToast({
        message: `Adicionado ao ${blockKey === "warmup" ? "Aquecimento" : blockKey === "main" ? "Principal" : "Volta à calma"}.`,
        variant: "success",
      });
      return true;
    },
    [confirmDialog, planningActivities, showSaveToast]
  );

  const handleAddCatalogActivityToPlanning = useCallback(
    async (item: ActivityCatalogListItem) => {
      if (!planningLibraryBlockKey) return;
      const activity = buildTrainingPlanActivityFromCatalogItem(
        item,
        planningLibraryBlockKey,
        new Date().toISOString()
      );
      if (await handleAddPlannedActivity(planningLibraryBlockKey, activity)) {
        setPlanningLibraryBlockKey(null);
      }
    },
    [handleAddPlannedActivity, planningLibraryBlockKey]
  );

  const handleAddExerciseLinkToPlanning = useCallback(
    async (exercise: Exercise) => {
      if (!planningLibraryBlockKey) return;
      if (await handleAddPlannedActivity(
        planningLibraryBlockKey,
        buildTrainingPlanActivityFromExerciseLink(exercise)
      )) {
        setPlanningLibraryBlockKey(null);
      }
    },
    [handleAddPlannedActivity, planningLibraryBlockKey]
  );

  const planningDetailActivity = useMemo(() => {
    if (!planningDetailSelection) return null;
    return (
      planningActivities[planningDetailSelection.blockKey]?.[
        planningDetailSelection.index
      ] ?? null
    );
  }, [planningActivities, planningDetailSelection]);

  const handleClosePlanningDetail = useCallback(() => {
    setPlanningDetailSelection(null);
  }, []);

  const updatePlanningDetailActivity = useCallback(
    (patch: Partial<TrainingPlanActivity>) => {
      if (!planningDetailSelection) return;
      const { blockKey, index } = planningDetailSelection;
      setPlanningActivities((current) => {
        const currentBlock = current[blockKey] ?? [];
        if (!currentBlock[index]) return current;
        return {
          ...current,
          [blockKey]: currentBlock.map((activity, activityIndex) =>
            activityIndex === index
              ? {
                  ...activity,
                  ...patch,
                }
              : activity
          ),
        };
      });
    },
    [planningDetailSelection]
  );

  const updatePlanningDetailTextField = useCallback(
    (field: keyof TrainingPlanActivity, value: string) => {
      updatePlanningDetailActivity({ [field]: value } as Partial<TrainingPlanActivity>);
    },
    [updatePlanningDetailActivity]
  );

  const updatePlanningDetailMaterials = useCallback(
    (value: string) => {
      updatePlanningDetailActivity({
        materials: value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      });
    },
    [updatePlanningDetailActivity]
  );

  const planningDetailRowStyle = useMemo(
    () => ({
      gap: 6,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBg,
    }),
    [colors.border, colors.inputBg]
  );
  const planningDetailLabelStyle = useMemo(
    () => ({ color: colors.text, fontSize: 12, fontWeight: "900" as const }),
    [colors.text]
  );
  const planningDetailTextStyle = useMemo(
    () => ({ color: colors.muted, fontSize: 13, lineHeight: 20 }),
    [colors.muted]
  );

  const planningDetailCardStyle = useMemo(
    () => ({
      width: "92%" as const,
      maxWidth: 760,
      padding: 18,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    }),
    [colors.border, colors.card]
  );
  const planningDetailContentStyle = useMemo(() => ({ gap: 14 }), []);
  const planningDetailHeaderStyle = useMemo(
    () => ({
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "flex-start" as const,
      gap: 14,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    }),
    [colors.border]
  );
  const planningDetailRowsStyle = useMemo(
    () => ({
      gap: 10,
    }),
    []
  );
  const planningDetailTitleWrapStyle = useMemo(() => ({ flex: 1, gap: 4 }), []);
  const planningDetailTitleStyle = useMemo(
    () => ({ color: colors.text, fontSize: 19, fontWeight: "900" as const, lineHeight: 24 }),
    [colors.text]
  );
  const planningDetailSourceStyle = useMemo(
    () => ({ color: colors.muted, fontSize: 12, fontWeight: "700" as const }),
    [colors.muted]
  );
  const planningDetailCloseButtonStyle = useMemo(
    () => ({
      height: 32,
      paddingHorizontal: 12,
      borderRadius: 16,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      backgroundColor: colors.secondaryBg,
    }),
    [colors.secondaryBg]
  );
  const planningDetailCloseTextStyle = useMemo(
    () => ({ fontSize: 12, fontWeight: "700" as const, color: colors.text }),
    [colors.text]
  );

  // Web e native compartilham a mesma experiência de planejamento. A composição
  // interna muda conforme a capacidade da plataforma, mas a rota não pode voltar
  // a escolher o formulário legado por Platform.OS.

  const onEdit = (plan: TrainingPlan) => {
    const hydratedActivities = hydratePlanningActivitiesFromPlan(plan);
    const structuredActivities: PlanningBlockActivities = {
      warmup: (hydratedActivities.warmup ?? []).filter(
        (activity) => !isManualTextActivity(activity)
      ),
      main: (hydratedActivities.main ?? []).filter(
        (activity) => !isManualTextActivity(activity)
      ),
      cooldown: (hydratedActivities.cooldown ?? []).filter(
        (activity) => !isManualTextActivity(activity)
      ),
    };
    setEditingId(plan.id);
    setEditingCreatedAt(plan.createdAt);
    setTitle(plan.title);
    setTagsText(plan.tags.join(", "));
    setPlanningActivities(structuredActivities);
    hydrateFormFromPlanningActivities(hydratedActivities);
    setWarmupTime(plan.warmupTime);
    setMainTime(plan.mainTime);
    setCooldownTime(plan.cooldownTime);
    setClassId(plan.classId);
    setFormUnit(unitLabel(classes.find((item) => item.id === plan.classId)?.unit ?? ""));
    setFormMode("plan");
    setScrollRequested(true);
  };

  const onDelete = (plan: TrainingPlan) => {
    confirm({
      title: "Excluir planejamento?",
      message: "Essa ação pode ser desfeita por alguns segundos.",
      confirmLabel: "Excluir",
      undoMessage: "Planejamento excluído. Deseja desfazer?",
      onOptimistic: () => {
        setItems((prev) => prev.filter((item) => item.id !== plan.id));
        if (editingId === plan.id) {
          setEditingId(null);
          setEditingCreatedAt(null);
        }
      },
      onConfirm: async () => {
        await measure("deleteTrainingPlan", () => deleteTrainingPlan(plan.id));
        await reload();
        logAction("Excluir planejamento", { planId: plan.id, classId: plan.classId });
      },
      onUndo: async () => {
        await reload();
      },
    });
  };

  const pickClassIdForAgeBand = useCallback(
    (band: string) => {
      if (!band) return "";
      const normalized = normalizeAgeBand(band);
      const match = classes.find(
        (item) => normalizeAgeBand(item.ageBand) === normalized
      );
      return match ? match.id : "";
    },
    [classes]
  );

  const applyTemplate = useCallback((template: {
    id: string;
    title: string;
    tags: string[];
    warmup: string[];
    main: string[];
    cooldown: string[];
    warmupTime: string;
    mainTime: string;
    cooldownTime: string;
    ageBands: string[];
    source: "built" | "custom";
    createdAt: string;
  }) => {
    setEditingId(null);
    setEditingCreatedAt(null);
    setTitle(template.title);
    setTagsText(template.tags.join(", "));
    setWarmup(template.warmup.join("\n"));
    setMain(template.main.join("\n"));
    setCooldown(template.cooldown.join("\n"));
    applyLegacyActivitiesToPlanningForm({
      warmup: template.warmup,
      main: template.main,
      cooldown: template.cooldown,
    });
    setWarmupTime(template.warmupTime);
    setMainTime(template.mainTime);
    setCooldownTime(template.cooldownTime);
    setScrollRequested(true);
  }, [applyLegacyActivitiesToPlanningForm, setCooldown, setCooldownTime, setEditingCreatedAt, setEditingId, setMain, setMainTime, setTagsText, setTitle, setWarmup, setWarmupTime]);

  const applyTemplateAsPlan = useCallback((template: {
    id: string;
    title: string;
    tags: string[];
    warmup: string[];
    main: string[];
    cooldown: string[];
    warmupTime: string;
    mainTime: string;
    cooldownTime: string;
    ageBands: string[];
    source: "built" | "custom";
    createdAt: string;
  }) => {
    setFormMode("plan");
    setClassId(
      templateAgeBand ? pickClassIdForAgeBand(templateAgeBand) : ""
    );
    applyTemplate(template);
  }, [applyTemplate, pickClassIdForAgeBand, templateAgeBand]);

  const duplicatePlan = (plan: TrainingPlan) => {
    applyTemplateAsPlan({
      id: "dup_" + Date.now(),
      title: plan.title + " (copia)",
      tags: plan.tags ?? [],
      warmup: plan.warmup ?? [],
      main: plan.main ?? [],
      cooldown: plan.cooldown ?? [],
      warmupTime: plan.warmupTime ?? "",
      mainTime: plan.mainTime ?? "",
      cooldownTime: plan.cooldownTime ?? "",
      ageBands: ["08-09", "10-12", "13-15", "16-18"],
      source: "custom",
      createdAt: new Date().toISOString(),
    });
  };

  const handleCreateTrainingSession = useCallback(
    async (payload: {
      classIds: string[];
      title: string;
      description: string;
      startAt: string;
      endAt: string;
    }) => {
      try {
        const session = await measure("saveTrainingSession", () =>
          upsertTrainingSession({
            classIds: payload.classIds,
            title: payload.title,
            description: payload.description,
            startAt: payload.startAt,
            endAt: payload.endAt,
            type: payload.classIds.length > 1 ? "integration" : "training",
            source: "manual",
            status: "scheduled",
          })
        );
        if (!session) return;
        setShowTrainingSessionCreate(false);
        setShowTrainingFabMenu(false);
        logAction("Criar treino", {
          sessionId: session.id,
          classIds: session.classIds,
          startAt: session.startAt,
          endAt: session.endAt,
          type: session.type,
        });
        showSaveToast({
          message:
            session.classIds.length > 1
              ? "Treino integrado criado com sucesso."
              : "Treino criado com sucesso.",
          variant: "success",
        });
      } catch {
        showSaveToast({
          message: "Não foi possível criar o treino.",
          variant: "warning",
        });
      }
    },
    [showSaveToast]
  );

  const handleConfirmApply = async () => {
    if (!applyPlan || !applyClassId) return;
    const wasUnassignedDraft = !applyPlan.classId;
    if (!applyDays.length) {
      Alert.alert("Selecione os dias", "Escolha pelo menos um dia da semana.");
      return;
    }
    if (!applyDate) {
      Alert.alert("Informe a data", "Digite a data específica do planejamento.");
      return;
    }
    if (Number.isNaN(new Date(applyDate).getTime())) {
      Alert.alert("Data inválida", "Escolha uma data válida.");
      return;
    }
    if (isSameApply) {
      closeApplyModal();
      showSaveToast({
        message: "Planejamento já adicionado.",
        actionLabel: "Ver aula do dia",
        variant: "warning",
        onAction: () => {
          router.push({
            pathname: "/class/[id]/session",
            params: { id: applyClassId, date: applyDate },
          });
        },
      });
      return;
    }
    try {
      const result = await planApplication.run({
        onPendingChange: setIsApplyingPlan,
        buildPlan: async () => {
          const nowIso = new Date().toISOString();
          const latestVersionPlan = await getLatestTrainingPlanByClass(applyClassId);
          return createTrainingPlanVersion({
            classId: applyClassId,
            version: Math.max(applyPlan.version ?? 0, latestVersionPlan?.version ?? 0) + 1,
            origin: "manual",
            draft: applyPlan,
            applyDays,
            applyDate,
            nowIso,
            idPrefix: "t",
            status: "final",
            finalizedAt: nowIso,
            inputHash: applyPlan.inputHash,
            pedagogy: applyPlan.pedagogy,
          });
        },
        savePlan: (plan) => measure("applyTrainingPlan", () => saveTrainingPlan(plan)),
        createCalendarEvent,
      });
      if (!result) return;
      const updated = result.plan;
      closeApplyModal();
      setApplyPlan(updated);
      let followUpFailed = result.calendarFailed;
      if (wasUnassignedDraft) {
        try {
          await Promise.all([
            clearWorkspaceDraft(),
            removeTrainingPlanWorkspaceLibraryItem(workspaceDraftKey, applyPlan.id),
          ]);
        } catch {
          followUpFailed = true;
        }
      }
    setSelectedPlan(updated);
    setClassId(updated.classId);
    setWorkspaceHasUnsavedChanges(false);
    setWorkspaceDraftRestored(false);
    setWorkspaceDraftLessonDate(updated.applyDate ?? "");
    setItems((current) => [
      updated,
      ...current.filter((item) => item.id !== applyPlan.id && item.id !== updated.id),
    ]);
    await reload().catch(() => { followUpFailed = true; });
    closeApplyModal();
    logAction("Aplicar planejamento", {
      planId: updated.id,
      classId: applyClassId,
      applyDate,
      daysCount: applyDays.length,
    });
    showSaveToast({
      message: followUpFailed
        ? "Plano aplicado. Não foi possível concluir a atualização do calendário ou dos dados locais."
        : "Planejamento aplicado com sucesso.",
      actionLabel: "Ver aula do dia",
      variant: followUpFailed ? "warning" : "success",
      onAction: () => {
        router.push({
          pathname: "/class/[id]/session",
          params: { id: applyClassId, date: applyDate },
        });
      },
    });
    } catch (error) {
      showSaveToast({ error, message: "Não foi possível aplicar o planejamento.", variant: "error" });
    }
  };

  const deleteTemplateItem = (id: string, source: "built" | "custom") => {
    confirm({
      title: "Excluir modelo?",
      message: "Essa ação pode ser desfeita por alguns segundos.",
      confirmLabel: "Excluir",
      undoMessage: "Modelo excluído. Deseja desfazer?",
      onOptimistic: () => {
        if (source === "custom") {
          setTemplateItems((prev) => prev.filter((item) => item.id !== id));
        } else {
          setHiddenTemplates((prev) => [
            ...prev,
            { id: "hide_" + Date.now(), templateId: id, createdAt: new Date().toISOString() },
          ]);
        }
      },
      onConfirm: async () => {
        if (source === "custom") {
          await measure("deleteTrainingTemplate", () => deleteTrainingTemplate(id));
          setTemplateItems((current) => current.filter((item) => item.id !== id));
          logAction("Excluir modelo", { templateId: id, source });
        } else {
          await measure("hideTrainingTemplate", () => hideTrainingTemplate(id));
          setHiddenTemplates((current) => [
            ...current,
            { id: "hide_" + Date.now(), templateId: id, createdAt: new Date().toISOString() },
          ]);
          logAction("Ocultar modelo", { templateId: id, source });
        }
      },
      onUndo: async () => {
        await refreshTemplateCatalog();
      },
    });
  };

  const duplicateTemplateFromEditor = async () => {
    const band = templateAge.trim() || templateAgeBand;
    if (!band) {
      Alert.alert("Defina a faixa etária", "Informe a faixa etária do modelo.");
      return;
    }
    const copy: TrainingTemplate = {
      id: createTrainingTemplateId(),
      title: (templateTitle.trim() || "Modelo sem título") + " (cópia)",
      ageBand: band,
      tags: templateTags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      warmup: toLines(templateWarmup),
      main: toLines(templateMain),
      cooldown: toLines(templateCooldown),
      warmupTime: templateWarmupTime.trim(),
      mainTime: templateMainTime.trim(),
      cooldownTime: templateCooldownTime.trim(),
      createdAt: new Date().toISOString(),
    };
    await measure("saveTrainingTemplate", () => saveTrainingTemplate(copy));
    setTemplateItems((current) => [copy, ...current.filter((item) => item.id !== copy.id)]);
    logAction("Duplicar modelo", { templateId: copy.id, ageBand: copy.ageBand });
    showSaveToast({ message: "Modelo duplicado com sucesso.", variant: "success" });
  };

  const closeTemplateEditor = () => {
    setShowTemplateEditor(false);
    setShowTemplateCloseConfirm(false);
    setTemplateEditorSnapshot(null);
  };

  const requestCloseTemplateEditor = () => {
    if (isTemplateEditorDirty) {
      setShowTemplateCloseConfirm(true);
      return;
    }
    closeTemplateEditor();
  };

  const toggleApplyPicker = (target: "unit" | "class") => {
    setShowApplyUnitPicker((prev) => (target === "unit" ? !prev : false));
    setShowApplyClassPicker((prev) => (target === "class" ? !prev : false));
  };

  const closeApplyPickers = () => {
    setShowApplyUnitPicker(false);
    setShowApplyClassPicker(false);
  };

  const syncApplyPickerLayouts = useCallback(() => {
    if (!showApplyUnitPicker && !showApplyClassPicker) return;
    requestAnimationFrame(() => {
      if (showApplyUnitPicker) {
        applyUnitTriggerRef.current?.measureInWindow((x, y, width, height) => {
          setApplyUnitTriggerLayout({ x, y, width, height });
        });
      }
      if (showApplyClassPicker) {
        applyClassTriggerRef.current?.measureInWindow((x, y, width, height) => {
          setApplyClassTriggerLayout({ x, y, width, height });
        });
      }
      applyContainerRef.current?.measureInWindow((x, y) => {
        setApplyContainerWindow({ x, y });
      });
    });
  }, [showApplyClassPicker, showApplyUnitPicker]);

  const syncFormPickerLayouts = useCallback(() => {
    if (!showFormUnitPicker && !showFormClassPicker) return;
    requestAnimationFrame(() => {
      if (showFormUnitPicker) {
        formUnitTriggerRef.current?.measureInWindow((x, y, width, height) => {
          setFormUnitTriggerLayout({ x, y, width, height });
        });
      }
      if (showFormClassPicker) {
        formClassTriggerRef.current?.measureInWindow((x, y, width, height) => {
          setFormClassTriggerLayout({ x, y, width, height });
        });
      }
      formContainerRef.current?.measureInWindow((x, y) => {
        setFormContainerWindow({ x, y });
      });
    });
  }, [showFormClassPicker, showFormUnitPicker]);

  const closeApplyModal = () => {
    if (planApplication.isPending()) return;
    setShowApplyModal(false);
    setShowApplyCloseConfirm(false);
    setApplyPlan(null);
    setShowApplyCalendar(false);
    setApplySnapshot(null);
    closeApplyPickers();
  };

  const requestCloseApplyModal = () => {
    if (planApplication.isPending()) return;
    if (isApplyDirty) {
      setShowApplyCloseConfirm(true);
      return;
    }
    closeApplyModal();
  };

  useEffect(() => {
    syncApplyPickerLayouts();
  }, [showApplyUnitPicker, showApplyClassPicker, syncApplyPickerLayouts]);

  useEffect(() => {
    syncFormPickerLayouts();
  }, [showFormUnitPicker, showFormClassPicker, syncFormPickerLayouts]);

  const saveTemplateEditor = async () => {
    const ageBand = templateAge.trim() || templateAgeBand;
    if (!ageBand) {
      Alert.alert("Defina a faixa etária", "Informe a faixa etária do modelo.");
      return;
    }
    const nowIso = new Date().toISOString();
    const template: TrainingTemplate = {
      id: templateEditorId ?? createTrainingTemplateId(),
      title: templateTitle.trim() || "Modelo sem título",
      ageBand,
      tags: templateTags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      warmup: toLines(templateWarmup),
      main: toLines(templateMain),
      cooldown: toLines(templateCooldown),
      warmupTime: templateWarmupTime.trim(),
      mainTime: templateMainTime.trim(),
      cooldownTime: templateCooldownTime.trim(),
      createdAt: templateEditorCreatedAt ?? nowIso,
    };
    if (templateEditorId) {
      await measure("updateTrainingTemplate", () =>
        updateTrainingTemplate(template)
      );
    } else {
      await measure("saveTrainingTemplate", () => saveTrainingTemplate(template));
    }
    if (templateEditorId) {
      setTemplateItems((current) =>
        current.map((item) =>
          item.id === template.id
            ? {
                ...item,
                title: template.title,
                ageBand: template.ageBand,
                tags: template.tags,
                warmup: template.warmup,
                main: template.main,
                cooldown: template.cooldown,
                warmupTime: template.warmupTime,
                mainTime: template.mainTime,
                cooldownTime: template.cooldownTime,
              }
            : item
        )
      );
    } else {
      setTemplateItems((current) => [template, ...current.filter((item) => item.id !== template.id)]);
    }
    logAction(templateEditorId ? "Editar modelo" : "Salvar modelo", {
      templateId: template.id,
      ageBand: template.ageBand,
    });
    closeTemplateEditor();
    setTemplateEditorId(null);
    setTemplateEditorCreatedAt(null);
    setTemplateEditorTemplateId(null);
    setTemplateEditorSource("custom");
  };

  const savePlanAsTemplate = async (plan: TrainingPlan) => {
    const band =
      classes.find((item) => item.id === plan.classId)?.ageBand ||
      templateAgeBand ||
      (classes[0] ? classes[0].ageBand : "");
    if (!band) {
      Alert.alert("Selecione uma turma", "Defina a faixa etária primeiro.");
      return;
    }
    const template: TrainingTemplate = {
      id: createTrainingTemplateId(),
      title: plan.title,
      ageBand: band,
      tags: plan.tags ?? [],
      warmup: plan.warmup ?? [],
      main: plan.main ?? [],
      cooldown: plan.cooldown ?? [],
      warmupTime: plan.warmupTime ?? "",
      mainTime: plan.mainTime ?? "",
      cooldownTime: plan.cooldownTime ?? "",
      createdAt: new Date().toISOString(),
    };
    await saveTrainingTemplate(template);
    setTemplateItems((current) => [template, ...current.filter((item) => item.id !== template.id)]);
    Alert.alert("Modelo salvo", "Agora ele aparece em Modelos prontos.");
  };

  const hasTemplateContent = Boolean(
    templateTitle.trim() ||
      templateTags.trim() ||
      templateWarmup.trim() ||
      templateMain.trim() ||
      templateCooldown.trim() ||
      templateWarmupTime.trim() ||
      templateMainTime.trim() ||
      templateCooldownTime.trim()
  );

  const scrollToForm = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(formY - 8, 0),
        animated: true,
      });
    }, 50);
  }, [formY]);

  useEffect(() => {
    if (!scrollRequested) return;
    scrollToForm();
    Promise.resolve().then(() => {
      setScrollRequested(false);
    });
  }, [formY, scrollRequested, scrollToForm]);

  useEffect(() => {
    if (!initialTab) return;
    Promise.resolve().then(() => {
      setPlanningTab(initialTab);
    });
    if (initialTab === "salvos") {
      setShowSavedPlans(true);
    }
  }, [initialTab, setShowSavedPlans]);

  useEffect(() => {
    if (!targetClassId) return;
    Promise.resolve().then(() => {
      setClassId(targetClassId);
    });
  }, [targetClassId]);

  const handleApplyPlan = useCallback((plan: TrainingPlan) => {
    setApplyPlan(plan);
    setShowApplyModal(true);
  }, []);

  const handleApplyWorkspacePlan = useCallback(
    (plan: TrainingPlan) => {
      setSelectedPlan(plan);
      handleApplyPlan(plan);
    },
    [handleApplyPlan]
  );

  const handleViewPlan = useCallback((plan: TrainingPlan) => {
    setSelectedPlan(plan);
    setClassId(plan.classId);
    setWorkspaceDraftRestored(false);
    setWorkspaceDraftLessonDate("");
    setWorkspaceHasUnsavedChanges(false);
  }, []);

  const confirmWorkspaceReplacement = useCallback(
    async (action: () => void) => {
      if (!workspaceHasUnsavedChanges) {
        action();
        return;
      }
      const flushResult = await flushWorkspaceDraft();
      const confirmation = buildTrainingPlanWorkspaceExitConfirmation({
        intent: "replace",
        draftPersisted: flushResult.persisted,
      });
      const accepted = await confirmDialog({
        ...confirmation,
        onConfirm: () => {},
      });
      if (!accepted) return;
      await clearWorkspaceDraft();
      setWorkspaceHasUnsavedChanges(false);
      setWorkspaceDraftRestored(false);
      setWorkspaceDraftLessonDate("");
      action();
    },
    [clearWorkspaceDraft, confirmDialog, flushWorkspaceDraft, workspaceHasUnsavedChanges]
  );

  const handleWorkspaceBack = useCallback(async () => {
    if (workspaceHasUnsavedChanges) {
      const flushResult = await flushWorkspaceDraft();
      const confirmation = buildTrainingPlanWorkspaceExitConfirmation({
        intent: "leave",
        draftPersisted: flushResult.persisted,
      });
      const accepted = await confirmDialog({
        ...confirmation,
        onConfirm: () => {},
      });
      if (!accepted) return;
    }
    navigateBackOrReplace({ router, fallback: scopedRoutes.home });
  }, [confirmDialog, flushWorkspaceDraft, router, scopedRoutes.home, workspaceHasUnsavedChanges]);

  const handleCreateWorkspacePlan = useCallback(() => {
    const draft = createPlanningWorkspaceDraft();
    setSelectedPlan(draft);
    setClassId("");
    setWorkspaceDraftRestored(false);
    setWorkspaceDraftLessonDate("");
    setWorkspaceHasUnsavedChanges(false);
  }, []);

  const handleOpenPlanningPdfImport = () => {
    if (!activeOrganization?.id) {
      showSaveToast({ message: "Selecione um workspace antes de importar o PDF.", variant: "warning" });
      return;
    }
    setShowPlanningPdfImport(true);
  };

  const handleUseWorkspaceTemplate = useCallback(
    (template: TrainingPlanningWorkspaceTemplate) => {
      const draft = createPlanningWorkspaceDraft(null, template);
      setSelectedPlan(draft);
      setClassId("");
      setWorkspaceDraftRestored(false);
      setWorkspaceDraftLessonDate("");
      setWorkspaceHasUnsavedChanges(false);
      showSaveToast({ message: "Modelo aberto no documento.", variant: "success" });
    },
    [showSaveToast]
  );

  const handleSaveWorkspacePlan = useCallback(
    async (draft: TrainingPlan) => {
      const normalized = normalizeClassTrainingPlan(draft);
      if (!normalized.classId) {
        const draftLessonDate = workspaceDraftLessonDate || normalized.applyDate || targetDate || formatShortDateValue(new Date());
        queueWorkspaceDraft(normalized, draftLessonDate);
        await Promise.all([
          flushWorkspaceDraft(),
          upsertTrainingPlanWorkspaceLibrary(workspaceDraftKey, [normalized]),
        ]);
        setSelectedPlan(normalized);
        setWorkspaceHasUnsavedChanges(false);
        setWorkspaceDraftRestored(false);
        setItems((current) => [normalized, ...current.filter((item) => item.id !== normalized.id)]);
        showSaveToast({ message: "Rascunho salvo neste dispositivo.", variant: "success" });
        return normalized;
      }
      const latestPlan = await getLatestTrainingPlanByClass(normalized.classId);
      const nowIso = new Date().toISOString();
      const isNewDraft = normalized.id.startsWith("draft_");
      const nextPlan = createTrainingPlanVersion({
        classId: normalized.classId,
        version: Math.max(normalized.version ?? 0, latestPlan?.version ?? 0) + 1,
        origin: isNewDraft ? "manual" : normalized.origin === "auto" ? "edited_auto" : "manual",
        draft: {
          title: normalized.title,
          tags: normalized.tags,
          warmup: normalized.warmup,
          main: normalized.main,
          cooldown: normalized.cooldown,
          warmupTime: normalized.warmupTime,
          mainTime: normalized.mainTime,
          cooldownTime: normalized.cooldownTime,
        },
        applyDays: normalized.applyDays ?? [],
        applyDate: normalized.applyDate ?? "",
        inputHash: normalized.inputHash,
        nowIso,
        idPrefix: isNewDraft ? "plan" : "plan_edit",
        status: "final",
        generatedAt: normalized.generatedAt,
        finalizedAt: nowIso,
        parentPlanId: isNewDraft ? undefined : normalized.parentPlanId ?? normalized.id,
        previousVersionId: isNewDraft ? undefined : normalized.id,
        pedagogy: normalized.pedagogy,
      });
      await measure("saveTrainingPlanWorkspace", () => saveTrainingPlan(nextPlan));
      await clearWorkspaceDraft();
      setSelectedPlan(nextPlan);
      setWorkspaceHasUnsavedChanges(false);
      setWorkspaceDraftRestored(false);
      setWorkspaceDraftLessonDate("");
      setItems((current) => [nextPlan, ...current.filter((item) => item.id !== nextPlan.id)]);
      void notifyTrainingSaved({ inboxScope: notificationInboxScope });
      await reload();
      return nextPlan;
    },
    [clearWorkspaceDraft, flushWorkspaceDraft, notificationInboxScope, queueWorkspaceDraft, reload, showSaveToast, targetDate, workspaceDraftKey, workspaceDraftLessonDate]
  );

  useEffect(() => {
    if (!incomingWorkspaceEntry || handledWorkspaceEntryKey === incomingWorkspaceEntry.key ||
        !workspaceDraftHydrated || restoredWorkspaceDraft || !workspaceDraftKey || classCatalogKey !== workspaceDraftKey) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setHandledWorkspaceEntryKey(incomingWorkspaceEntry.key);
      void confirmWorkspaceReplacement(() => {
        const targetClass = classes.find((item) => item.id === incomingWorkspaceEntry.classId) ?? null;
        const lessonDate = incomingWorkspaceEntry.date || formatShortDateValue(new Date());
        const nextPlan = incomingWorkspaceEntry.template
          ? createAssistantWorkspacePlan(incomingWorkspaceEntry.template, targetClass, lessonDate)
          : { ...createPlanningWorkspaceDraft(targetClass), applyDate: lessonDate };
        setSelectedPlan(nextPlan);
        setClassId(nextPlan.classId);
        setWorkspaceDraftLessonDate(lessonDate);
        setWorkspaceDraftRestored(Boolean(incomingWorkspaceEntry.template));
        setWorkspaceHasUnsavedChanges(Boolean(incomingWorkspaceEntry.template));
        queueWorkspaceDraft(nextPlan, lessonDate);
        if (pendingPlanCreate) setPendingPlanCreate(null);
        if (incomingWorkspaceEntry.template) showSaveToast({ message: "Plano aberto para revisão.", variant: "success" });
      });
    });
    return () => { cancelled = true; };
  }, [classCatalogKey, classes, confirmWorkspaceReplacement, handledWorkspaceEntryKey, incomingWorkspaceEntry, pendingPlanCreate, queueWorkspaceDraft, restoredWorkspaceDraft, setPendingPlanCreate, showSaveToast, workspaceDraftHydrated, workspaceDraftKey]);

  const handleImportWorkspacePlans = useCallback(
    async (drafts: TrainingPlan[]) => {
      if (!drafts.length) return;
      const plans = drafts.map((draft) => ({
        ...normalizeClassTrainingPlan(draft),
        classId: "",
      }));
      await upsertTrainingPlanWorkspaceLibrary(workspaceDraftKey, plans);
      const firstPlan = plans[0];
      setSelectedPlan(firstPlan);
      setClassId("");
      setWorkspaceDraftRestored(false);
      setWorkspaceDraftLessonDate(firstPlan.applyDate ?? "");
      setWorkspaceHasUnsavedChanges(true);
      setItems((current) => [
        ...plans,
        ...current.filter((item) => !plans.some((plan) => plan.id === item.id)),
      ]);
      queueWorkspaceDraft(firstPlan, firstPlan.applyDate ?? "");
      showSaveToast({
        message: plans.length === 1
          ? "PDF aberto como rascunho editável."
          : `${plans.length} páginas abertas como rascunhos.`,
        variant: "success",
      });
    },
    [queueWorkspaceDraft, showSaveToast, workspaceDraftKey]
  );

  const unassignedWorkspaceClass = useMemo<ClassGroup>(() => {
    const base = selectedClass ?? classes[0];
    return {
      ...(base ?? {
        organizationId: activeOrganization?.id ?? "",
        unit: "",
        unitId: "",
        trainingSpace: "",
        colorKey: "green",
        modality: "voleibol",
        ageBand: "",
        gender: "misto",
        startTime: "",
        endTime: "",
        durationMinutes: 60,
        daysOfWeek: [],
        daysPerWeek: 0,
        goal: "",
        equipment: "quadra",
        level: 1,
        mvLevel: "",
        cycleStartDate: "",
        cycleLengthWeeks: 1,
        acwrLow: 0.8,
        acwrHigh: 1.3,
        createdAt: new Date(0).toISOString(),
      }),
      id: "__planning_draft__",
      name: "",
      organizationId: activeOrganization?.id ?? base?.organizationId ?? "",
      unit: "",
      unitId: "",
      startTime: "",
      endTime: "",
      daysOfWeek: [],
      daysPerWeek: 0,
    };
  }, [activeOrganization?.id, classes, selectedClass]);
  const workspaceClass = selectedPlan
    ? selectedPlan.classId
      ? classById.get(selectedPlan.classId) ?? selectedClass ?? classes[0]
      : unassignedWorkspaceClass
    : selectedClass ?? classes[0];
  const workspaceLessonDate =
    workspaceDraftLessonDate || selectedPlan?.applyDate || targetDate || formatShortDateValue(new Date());
  const handleWorkspaceDraftChange = useCallback(
    (draft: TrainingPlan) => {
      queueWorkspaceDraft(draft, workspaceLessonDate);
    },
    [queueWorkspaceDraft, workspaceLessonDate]
  );

  const renderWorkspaceLibrary = (
    presentation: "rail" | "sheet",
    collapsed: boolean,
  ) => (
    <TrainingPlanningWorkspaceLibrary
      presentation={presentation}
      collapsed={collapsed}
      plans={items}
      templates={templates}
      classes={classes}
      selectedPlanId={selectedPlan?.id}
      onToggleCollapsed={() => setWorkspaceLibraryCollapsed((current) => !current)}
      onSelectPlan={(plan) => {
        void confirmWorkspaceReplacement(() => {
          handleViewPlan(plan);
          if (responsiveLayout.isMobile) setWorkspaceLibraryCollapsed(true);
        });
      }}
      onUseTemplate={(template) => {
        void confirmWorkspaceReplacement(() => {
          handleUseWorkspaceTemplate(template);
          if (responsiveLayout.isMobile) setWorkspaceLibraryCollapsed(true);
        });
      }}
    />
  );

  return (
    <View ref={screenRootRef} style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {(
          <>
            <ScreenPageHeader
              title="Planejamento"
              onBack={() => void handleWorkspaceBack()}
              right={
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: responsiveLayout.isMobile ? 5 : 8,
                    flexWrap: "nowrap",
                    maxWidth: responsiveLayout.isMobile ? 178 : undefined,
                  }}
                >
                  {selectedPlan && workspaceHeaderControls ? (
                    <>
                      {!responsiveLayout.isMobile ? <View style={{ minHeight: 40, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 6 }}>
                        {workspaceHeaderControls.status === "saving" ? (
                          <ActivityIndicator size="small" color={colors.warningText} />
                        ) : (
                          <GoAtletaIcon
                            name={workspaceHeaderControls.status === "error" ? "warningCircle" : "success"}
                            size={17}
                            color={workspaceHeaderControls.status === "error" ? colors.dangerText : colors.successText}
                          />
                        )}
                        {!responsiveLayout.isMobile ? (
                          <Text
                            style={{
                              color:
                                workspaceHeaderControls.status === "error"
                                  ? colors.dangerText
                                  : workspaceHeaderControls.status === "saving"
                                    ? colors.warningText
                                    : colors.text,
                              fontSize: 12,
                              fontWeight: "700",
                            }}
                          >
                            {workspaceHeaderControls.status === "error"
                              ? "Falha ao salvar"
                              : workspaceHeaderControls.status === "saving"
                                ? "Salvando"
                                : "Salvo"}
                          </Text>
                        ) : null}
                      </View> : null}
                      <Pressable
                        onPress={workspaceHeaderControls.onDownload}
                        disabled={workspaceHeaderControls.downloadDisabled}
                        accessibilityRole="button"
                        accessibilityLabel="Baixar PDF"
                        style={({ pressed }) => ({
                          width: 40,
                          height: 40,
                          borderRadius: 9,
                          backgroundColor: colors.secondaryBg,
                          alignItems: "center",
                          justifyContent: "center",
                          opacity: workspaceHeaderControls.downloadDisabled ? 0.46 : pressed ? 0.72 : 1,
                        })}
                      >
                        <GoAtletaIcon name="download" size={18} color={colors.text} />
                      </Pressable>
                      {workspaceHeaderControls.onApply ? (
                        <Pressable
                          onPress={workspaceHeaderControls.onApply}
                          disabled={workspaceHeaderControls.applyDisabled}
                          accessibilityRole="button"
                          accessibilityLabel={workspaceHeaderControls.applyLabel}
                          style={({ pressed }) => ({
                            width: responsiveLayout.isMobile ? 40 : undefined,
                            minHeight: 40,
                            paddingHorizontal: responsiveLayout.isMobile ? 0 : 13,
                            borderWidth: 1,
                            borderColor: colors.primaryBg,
                            borderRadius: 9,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 7,
                            opacity: workspaceHeaderControls.applyDisabled ? 0.46 : pressed ? 0.72 : 1,
                          })}
                        >
                          <GoAtletaIcon name="success" size={17} color={colors.primaryBg} />
                          {!responsiveLayout.isMobile ? (
                            <Text style={{ color: colors.primaryBg, fontSize: 12, fontWeight: "900" }}>
                              {workspaceHeaderControls.applyLabel}
                            </Text>
                          ) : null}
                        </Pressable>
                      ) : null}
                    </>
                  ) : null}
                  <Pressable
                    onPress={() => {
                      void confirmWorkspaceReplacement(handleCreateWorkspacePlan);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Criar novo plano"
                    style={({ pressed }) => ({
                      width: responsiveLayout.isMobile ? 40 : undefined,
                      minHeight: 40,
                      paddingHorizontal: responsiveLayout.isMobile ? 0 : 14,
                      borderWidth: 1,
                      borderColor: colors.primaryBg,
                      borderRadius: 9,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 7,
                      opacity: pressed ? 0.72 : 1,
                    })}
                  >
                    <GoAtletaIcon name="add" size={18} color={colors.primaryBg} />
                    {!responsiveLayout.isMobile ? (
                      <Text style={{ color: colors.primaryBg, fontSize: 12, fontWeight: "900" }}>Novo plano</Text>
                    ) : null}
                  </Pressable>
                  <Pressable
                    onPress={handleOpenPlanningPdfImport}
                    accessibilityRole="button"
                    accessibilityLabel="Importar PDF"
                    style={({ pressed }) => ({
                      width: responsiveLayout.isMobile ? 40 : undefined,
                      minHeight: 40,
                      paddingHorizontal: responsiveLayout.isMobile ? 0 : 14,
                      borderRadius: 9,
                      backgroundColor: colors.secondaryBg,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 7,
                      opacity: pressed ? 0.72 : 1,
                    })}
                  >
                    <GoAtletaIcon name="document" size={17} color={colors.text} />
                    {!responsiveLayout.isMobile ? (
                      <Text style={{ color: colors.text, fontSize: 12, fontWeight: "900" }}>Importar PDF</Text>
                    ) : null}
                  </Pressable>
                </View>
              }
              contentStyle={{
                width: "100%",
                maxWidth: responsiveLayout.supportsDenseGrid ? 1600 : 1440,
                alignSelf: "center",
                paddingTop: responsiveLayout.isMobile ? 8 : 12,
                paddingBottom: 8,
              }}
            />

            <View
              style={{
                flex: 1,
                minHeight: 0,
                width: "100%",
                maxWidth: responsiveLayout.supportsDenseGrid ? 1600 : 1440,
                alignSelf: "center",
                paddingHorizontal: responsiveLayout.isMobile ? 10 : 16,
                paddingBottom: Math.max(insets.bottom + (responsiveLayout.usesWorkspaceShell ? 14 : 92), 14),
                position: "relative",
              }}
            >
              <View style={{ flex: 1, minHeight: 0, position: "relative" }}>
                {responsiveLayout.isMobile ? (
                  <>
                    {!workspaceLibraryCollapsed ? (
                      <ModalSheet
                        visible
                        onClose={() => setWorkspaceLibraryCollapsed(true)}
                        position="right"
                        overlayZIndex={5200}
                        containerPadding={12}
                        cardStyle={{
                          width: "92%",
                          maxWidth: 360,
                          height: "100%",
                          maxHeight: "100%",
                          padding: 0,
                          paddingBottom: 0,
                          marginBottom: 0,
                          gap: 0,
                          borderRadius: 18,
                          overflow: "hidden",
                        }}
                      >
                        {renderWorkspaceLibrary("sheet", false)}
                      </ModalSheet>
                    ) : !selectedPlan ? (
                      <View
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          zIndex: 40,
                        }}
                      >
                        {renderWorkspaceLibrary("rail", true)}
                      </View>
                    ) : null}
                  </>
                ) : !workspaceLibraryCollapsed || !selectedPlan ? (
                  <View
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      zIndex: 40,
                      minHeight: 0,
                      overflow: "hidden",
                      boxShadow: "10px 0 28px rgba(10, 19, 34, 0.26)",
                    }}
                  >
                    {renderWorkspaceLibrary(
                      "rail",
                      !selectedPlan ? workspaceLibraryCollapsed : false,
                    )}
                  </View>
                ) : null}

                <View
                  style={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 0,
                  }}
                >
                  {selectedPlan && workspaceClass ? (
                    <Suspense fallback={<SectionLoadingState />}>
                      <ClassPlanPreviewModal
                        visible
                        presentation="workspace"
                        initialMode="edit"
                        initialDirty={workspaceDraftRestored}
                        draftStatus={workspaceDraftStatus}
                        onClose={() => {}}
                        plan={selectedPlan}
                        classGroup={workspaceClass}
                        lessonDate={workspaceLessonDate}
                        onSavePlan={handleSaveWorkspacePlan}
                        onDraftChange={handleWorkspaceDraftChange}
                        onDirtyChange={setWorkspaceHasUnsavedChanges}
                        onWorkspaceControlsChange={setWorkspaceHeaderControls}
                        onApplyPlan={handleApplyWorkspacePlan}
                        workspaceLibraryExpanded={!workspaceLibraryCollapsed}
                        onToggleWorkspaceLibrary={() => setWorkspaceLibraryCollapsed((current) => !current)}
                      />
                    </Suspense>
                  ) : (
                    <View
                      style={{
                        flex: 1,
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 10,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 14,
                        backgroundColor: colors.card,
                      }}
                    >
                      <GoAtletaIcon name="document" size={30} color={colors.muted} />
                      <Text style={{ color: colors.text, fontSize: 15, fontWeight: "900" }}>Comece um plano de aula</Text>
                      <Pressable
                        onPress={handleCreateWorkspacePlan}
                        style={{
                          minHeight: 40,
                          paddingHorizontal: 14,
                          borderRadius: 10,
                          backgroundColor: colors.primaryBg,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 7,
                        }}
                      >
                        <GoAtletaIcon name="add" size={18} color={colors.primaryText} />
                        <Text style={{ color: colors.primaryText, fontSize: 12, fontWeight: "900" }}>Novo plano</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
      {showPlanningPdfImport && activeOrganization?.id ? (
        <Suspense fallback={null}>
          <TrainingPlanPdfImportModal
            visible
            organizationId={activeOrganization.id}
            onClose={() => setShowPlanningPdfImport(false)}
            onCreatePlans={handleImportWorkspacePlans}
          />
        </Suspense>
      ) : null}
      {showSpreadsheetImport || importMode === "spreadsheet" ? (
        <Suspense fallback={null}>
          <TrainingSpreadsheetImportModal
            visible
            classId={selectedPlan?.classId || targetClassId || undefined}
            unit={workspaceClass?.unit || undefined}
            onClose={() => {
              setShowSpreadsheetImport(false);
              if (importMode === "spreadsheet") {
                router.replace({ pathname: scopedRoutes.planning });
              }
            }}
            onImported={() => {
              void reload();
            }}
          />
        </Suspense>
      ) : null}
      {showTrainingSessionCreate ? (
        <Suspense fallback={null}>
          <TrainingSessionCreateModalContent
            visible={showTrainingSessionCreate}
            classes={classes}
            defaultClassIds={trainingSessionDefaultClassIds}
            defaultDate={trainingSessionDefaultDate}
            defaultStartTime={trainingSessionDefaultStartTime}
            onClose={() => setShowTrainingSessionCreate(false)}
            onCreate={handleCreateTrainingSession}
          />
        </Suspense>
      ) : null}
      <ModalSheet
        visible={showTemplateEditor}
        onClose={requestCloseTemplateEditor}
        cardStyle={[templateEditorCardStyle, { maxHeight: "92%", paddingBottom: 12 }]}
        position="center"
      >
        <ConfirmCloseOverlay
          visible={showTemplateCloseConfirm}
          onCancel={() => setShowTemplateCloseConfirm(false)}
          onConfirm={() => {
            setShowTemplateCloseConfirm(false);
            closeTemplateEditor();
          }}
        />
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12, paddingTop: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
            Editar modelo
          </Text>
          <Pressable
            onPress={requestCloseTemplateEditor}
            style={{
              height: 32,
              paddingHorizontal: 12,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.secondaryBg,
            }}
          >
            <Text
              style={{ fontSize: 12, fontWeight: "700", color: colors.text }}
            >
              Fechar
            </Text>
          </Pressable>
        </View>
        <Suspense
          fallback={<SectionLoadingState />}
        >
          <TemplateEditorModalContent
            templateTitle={templateTitle}
            setTemplateTitle={setTemplateTitle}
            templateAge={templateAge}
            setTemplateAge={setTemplateAge}
            templateTags={templateTags}
            setTemplateTags={setTemplateTags}
            templateWarmup={templateWarmup}
            setTemplateWarmup={setTemplateWarmup}
            templateMain={templateMain}
            setTemplateMain={setTemplateMain}
            templateCooldown={templateCooldown}
            setTemplateCooldown={setTemplateCooldown}
            templateWarmupTime={templateWarmupTime}
            setTemplateWarmupTime={setTemplateWarmupTime}
            templateMainTime={templateMainTime}
            setTemplateMainTime={setTemplateMainTime}
            templateCooldownTime={templateCooldownTime}
            setTemplateCooldownTime={setTemplateCooldownTime}
            templateSuggestions={templateSuggestions}
            hasTemplateContent={hasTemplateContent}
            templateEditorComposerHeight={templateEditorComposerHeight}
            templateEditorKeyboardHeight={templateEditorKeyboardHeight}
            setTemplateEditorComposerHeight={setTemplateEditorComposerHeight}
            isTemplateEditorDirty={isTemplateEditorDirty}
            canDeleteTemplate={Boolean(templateEditorTemplateId)}
            onSave={saveTemplateEditor}
            onDuplicate={duplicateTemplateFromEditor}
            onDelete={() => {
              if (!templateEditorTemplateId) return;
              const targetId = templateEditorTemplateId;
              const targetSource = templateEditorSource;
              closeTemplateEditor();
              setTemplateEditorTemplateId(null);
              setTemplateEditorSource("custom");
              setTimeout(() => {
                void deleteTemplateItem(targetId, targetSource);
              }, 10);
            }}
          />
        </Suspense>
      </ModalSheet>
      <ModalSheet
        visible={showApplyModal}
        onClose={requestCloseApplyModal}
        cardStyle={[applyModalCardStyle, { paddingBottom: 12 }]}
        position="center"
      >
        <ConfirmCloseOverlay
          visible={showApplyCloseConfirm}
          onCancel={() => setShowApplyCloseConfirm(false)}
          onConfirm={() => {
            setShowApplyCloseConfirm(false);
            closeApplyModal();
          }}
        />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>
            {applyPlan?.classId ? "Aplicar planejamento" : "Adicionar à turma"}
          </Text>
          <Pressable
            onPress={requestCloseApplyModal}
            disabled={isApplyingPlan}
            style={{
              height: 32,
              paddingHorizontal: 12,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.secondaryBg,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>
              Fechar
            </Text>
          </Pressable>
        </View>
        <Suspense
          fallback={<SectionLoadingState />}
        >
          <TrainingApplyModalContent
            isAssigning={!applyPlan?.classId}
            applyContainerRef={applyContainerRef}
            applyUnitTriggerRef={applyUnitTriggerRef}
            applyClassTriggerRef={applyClassTriggerRef}
            layouts={{
              applyContainerWindow,
              applyUnitTriggerLayout,
              applyClassTriggerLayout,
            }}
            pickers={{
              showApplyUnitPicker,
              showApplyClassPicker,
              showApplyUnitPickerContent,
              showApplyClassPickerContent,
              applyUnitPickerAnimStyle,
              applyClassPickerAnimStyle,
              showApplyCalendar,
            }}
            state={{
              applyUnit,
              applyClassId,
              applyDays,
              applyDate,
              selectedApplyClass,
            }}
            data={{
              allUnitsValue: ALL_UNITS_VALUE,
              weekdays,
              unitOptions,
              classOptionsForUnit,
            }}
            actions={{
              closeApplyPickers,
              syncApplyPickerLayouts,
              toggleApplyPicker,
              setApplyUnit,
              setApplyClassId,
              setApplyDays,
              setApplyDate,
              setShowApplyCalendar,
              onApply: handleConfirmApply,
            }}
            canApply={canApply && !isApplyingPlan}
            isApplying={isApplyingPlan}
          />
        </Suspense>
      </ModalSheet>
      <ModalSheet
        visible={showPlanActions}
        onClose={() => {
          setShowPlanActions(false);
          setActionPlan(null);
        }}
        cardStyle={[planActionsCardStyle, { paddingBottom: 12 }]}
        position="center"
      >
        {actionPlan ? (
        <Suspense
          fallback={<SectionLoadingState />}
        >
            <TrainingPlanActionsModalContent
              plan={actionPlan}
              getClassName={getClassName}
              onClose={() => {
                setShowPlanActions(false);
                setActionPlan(null);
              }}
              onEdit={(plan) => {
                onEdit(plan);
              }}
              onSaveAsTemplate={savePlanAsTemplate}
              onDuplicate={(plan) => {
                duplicatePlan(plan);
              }}
              onDelete={(plan) => {
                onDelete(plan);
              }}
            />
          </Suspense>
        ) : null}
      </ModalSheet>
      <PlanningLibraryBridgeSheet
        visible={Boolean(planningLibraryBlockKey)}
        blockKey={planningLibraryBlockKey}
        onClose={() => setPlanningLibraryBlockKey(null)}
        onAddCatalogActivity={handleAddCatalogActivityToPlanning}
        onAddExerciseLink={handleAddExerciseLinkToPlanning}
      />
      {planningDetailActivity ? (
        <ModalSheet
          visible
          onClose={handleClosePlanningDetail}
          cardStyle={planningDetailCardStyle}
          position="center"
        >
          <View style={planningDetailContentStyle}>
            <View style={planningDetailHeaderStyle}>
              <View style={planningDetailTitleWrapStyle}>
                <TextInput
                  value={planningDetailActivity.name ?? ""}
                  onChangeText={(value) => updatePlanningDetailTextField("name", value)}
                  placeholder="Nome da atividade"
                  placeholderTextColor={colors.placeholder}
                  style={[planningDetailTitleStyle, { padding: 0 }]}
                />
                <Text style={planningDetailSourceStyle}>
                  {planningDetailActivity.catalog
                    ? "Catálogo Go Atleta"
                    : planningDetailActivity.execution
                      ? "Vídeo/link"
                      : "Atividade manual"}
                </Text>
              </View>
              <Pressable
                onPress={handleClosePlanningDetail}
                style={planningDetailCloseButtonStyle}
              >
                <Text style={planningDetailCloseTextStyle}>
                  Fechar
                </Text>
              </Pressable>
            </View>
            <View style={planningDetailRowsStyle}>
              {[
                ["Objetivo", "objective", planningDetailActivity.objective],
                ["Descrição", "description", planningDetailActivity.description],
                ["Organização", "organization", planningDetailActivity.organization],
                ["Ação", "action", planningDetailActivity.action],
                ["Progressão", "progression", planningDetailActivity.progression],
                ["Materiais", "materials", planningDetailActivity.materials?.join(", ")],
                ["Link", "execution", planningDetailActivity.execution],
              ]
                .map(([label, field, value]) => (
                  <View key={label} style={planningDetailRowStyle}>
                    <Text style={planningDetailLabelStyle}>
                      {label}
                    </Text>
                    <TextInput
                      value={String(value ?? "")}
                      onChangeText={(nextValue) => {
                        if (field === "materials") {
                          updatePlanningDetailMaterials(nextValue);
                          return;
                        }
                        updatePlanningDetailTextField(
                          field as keyof TrainingPlanActivity,
                          nextValue
                        );
                      }}
                      placeholder={`Editar ${String(label).toLowerCase()}`}
                      placeholderTextColor={colors.placeholder}
                      multiline
                      style={[
                        planningDetailTextStyle,
                        {
                          minHeight: field === "execution" ? 32 : 42,
                          padding: 0,
                          color: colors.inputText,
                          textAlignVertical: "top",
                        },
                      ]}
                    />
                  </View>
                ))}
            </View>
          </View>
        </ModalSheet>
      ) : null}
      </SafeAreaView>
    </View>
  );
}
