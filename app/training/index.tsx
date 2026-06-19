import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Calendar from "expo-calendar";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
    Suspense,
    lazy,
    memo,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";
import {
    Alert,
    Animated,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Share,
    Text,
    TextInput,
    useWindowDimensions,
    View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenBackdrop } from "../../src/components/ui/ScreenBackdrop";
import { Pressable } from "../../src/ui/Pressable";

import { SectionLoadingState } from "../../src/components/ui/SectionLoadingState";
import { normalizeAgeBand, sortAgeBandList } from "../../src/core/age-band";
import { translateMethodology } from "../../src/core/methodology/methodology-translator";
import type {
    ClassGroup,
    Exercise,
    HiddenTemplate,
    TrainingPlan,
    TrainingPlanActivity,
    TrainingTemplate,
} from "../../src/core/models";
import { createTrainingPlanVersion } from "../../src/core/training-plan-factory";
import type { TrainingPlanBlockKey } from "../../src/core/training-plan-blocks";
import { trainingTemplates } from "../../src/core/trainingTemplates";
import {
    deleteTrainingPlan,
    deleteTrainingTemplate,
    getClasses,
    getHiddenTemplates,
    getLatestTrainingPlanByClass,
    getTrainingPlans,
    getTrainingTemplates,
    hideTrainingTemplate,
    saveTrainingPlan,
    saveTrainingTemplate,
    updateTrainingTemplate,
    upsertTrainingSession,
} from "../../src/db/seed";
import { notifyTrainingSaved } from "../../src/notifications";
import { logAction } from "../../src/observability/breadcrumbs";
import { markRender, measure, measureAsync } from "../../src/observability/perf";
import { TrainingAnchoredDropdownOption } from "../../src/screens/training/components/TrainingAnchoredDropdownOption";
import { TrainingFabMenu } from "../../src/screens/training/components/TrainingFabMenu";
import { PlanningBlockActivityCards } from "../../src/screens/training/components/PlanningBlockActivityCards";
import { PlanningLibraryBridgeSheet } from "../../src/screens/training/components/PlanningLibraryBridgeSheet";
import {
    addPlanningActivityToBlock,
    buildPedagogyBlocksFromPlanningForm,
    buildPlanningActivitiesFromLegacyLines,
    buildTrainingPlanActivityFromCatalogItem,
    buildTrainingPlanActivityFromExerciseLink,
    createEmptyPlanningBlockActivities,
    hydratePlanningActivitiesFromPlan,
    planningBlockKeys,
    removePlanningActivityFromBlock,
    syncLegacyLinesFromBlocks,
    type PlanningBlockActivities,
} from "../../src/screens/training/application/planning-library-bridge";
import { formatTrainingPlanDisplayText } from "../../src/screens/training/application/training-plan-display-text";
import { useTemplateEditorForm } from "../../src/screens/training/hooks/useTemplateEditorForm";
import { useTrainingPlanForm } from "../../src/screens/training/hooks/useTrainingPlanForm";
import type { ActivityCatalogListItem } from "../../src/screens/library/activity-catalog-view-model";
import { AnchoredDropdown } from "../../src/ui/AnchoredDropdown";
import { animateLayout } from "../../src/ui/animate-layout";
import { useAppTheme } from "../../src/ui/app-theme";
import { Button } from "../../src/ui/Button";
import { ClassGenderBadge } from "../../src/ui/ClassGenderBadge";
import { useConfirmDialog } from "../../src/ui/confirm-dialog";
import { useConfirmUndo } from "../../src/ui/confirm-undo";
import { ConfirmCloseOverlay } from "../../src/ui/ConfirmCloseOverlay";
import { FadeHorizontalScroll } from "../../src/ui/FadeHorizontalScroll";
import { ModalSheet } from "../../src/ui/ModalSheet";
import { useSaveToast } from "../../src/ui/save-toast";
import { getSectionCardStyle } from "../../src/ui/section-styles";
import { sortClassesByAgeBand } from "../../src/ui/sort-classes";
import { TimeInput } from "../../src/ui/TimeInput";
import { useCollapsibleAnimation } from "../../src/ui/use-collapsible";
import { useModalCardStyle } from "../../src/ui/use-modal-card-style";
import { usePersistedState } from "../../src/ui/use-persisted-state";
import { radius, shadow } from "../../src/theme/tokens";
import { formatClock, formatDuration } from "../../src/utils/format-time";

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

const TrainingPlanDetailsModalContent = lazy(() =>
  import("../../src/screens/training/components/TrainingPlanDetailsModalContent").then(
    (module) => ({
      default: module.TrainingPlanDetailsModalContent,
    })
  )
);

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

const toLines = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const toManualRows = (value: string) => (value.length ? value.split("\n") : [""]);

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

const formatDate = (value: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR");
};

const formatShortDate = (value: string) => {
  if (!value) return "";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }
  return formatDate(value);
};

const formatShortDateValue = (value: Date) =>
  value.toLocaleDateString("pt-BR");

const getWeekStart = (value: Date) => {
  const date = new Date(value);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

const getWeekEnd = (start: Date) => {
  const date = new Date(start);
  date.setDate(date.getDate() + 6);
  date.setHours(23, 59, 59, 999);
  return date;
};


const weekdays = [
  { id: 1, label: "Seg" },
  { id: 2, label: "Ter" },
  { id: 3, label: "Qua" },
  { id: 4, label: "Qui" },
  { id: 5, label: "Sex" },
  { id: 6, label: "Sab" },
  { id: 7, label: "Dom" },
];

const formatWeekdays = (days: number[]) => {
  if (!days || !days.length) return "";
  const labels = days
    .map((day) => weekdays.find((item) => item.id === day)?.label)
    .filter(Boolean);
  return labels.join(", ");
};

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

const normalizeTagToken = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const compactTagList = (values: string[], limit = 8) => {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    const normalized = normalizeTagToken(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  });
  return result.slice(0, limit);
};

const normalizeSearchValue = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const getTrainingPlanBlockCounts = (plan: TrainingPlan) => {
  const blocks = plan.pedagogy?.blocks;
  if (blocks) {
    return {
      warmup: blocks.warmup?.activities?.length ?? 0,
      main: blocks.main?.activities?.length ?? 0,
      cooldown: blocks.cooldown?.activities?.length ?? 0,
    };
  }

  return {
    warmup: plan.warmup?.length ?? 0,
    main: plan.main?.length ?? 0,
    cooldown: plan.cooldown?.length ?? 0,
  };
};

const getSavedPlanDisplayTitle = (plan: TrainingPlan) => {
  const parts = plan.title
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
  return formatTrainingPlanDisplayText(parts.length >= 2 ? parts[parts.length - 1] : plan.title);
};

export default function TrainingList() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width: viewportWidth } = useWindowDimensions();
  const router = useRouter();
  const { confirm } = useConfirmUndo();
  const { confirm: confirmDialog } = useConfirmDialog();
  const { showSaveToast } = useSaveToast();
  const templateEditorCardStyle = useModalCardStyle({ maxHeight: "100%" });
  const selectedPlanCardStyle = useModalCardStyle({ maxHeight: "100%" });
  const applyModalCardStyle = useModalCardStyle({ maxHeight: "100%" });
  const planActionsCardStyle = useModalCardStyle({ maxHeight: "100%" });
  const params = useLocalSearchParams();
  const targetClassId =
    typeof params.targetClassId === "string" ? params.targetClassId : "";
  const targetDateRaw =
    typeof params.targetDate === "string" ? params.targetDate : "";
  const initialTabRaw =
    typeof params.tab === "string" ? params.tab : "";
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
    resetPlanForm,
  } = useTrainingPlanForm();
  const {
    title,
    tagsText,
    warmup,
    main,
    cooldown,
    warmupTime,
    mainTime,
    cooldownTime,
    editingId,
    editingCreatedAt,
    formUnit,
  } = planForm;
  const [items, setItems] = useState<TrainingPlan[]>([]);
  const [templateItems, setTemplateItems] = useState<TrainingTemplate[]>([]);
  const [hiddenTemplates, setHiddenTemplates] = useState<HiddenTemplate[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [classId, setClassId] = useState("");
  const [planningActivities, setPlanningActivities] =
    useState<PlanningBlockActivities>(() => createEmptyPlanningBlockActivities());
  const [planningLibraryBlockKey, setPlanningLibraryBlockKey] =
    useState<TrainingPlanBlockKey | null>(null);
  const [planningDetailSelection, setPlanningDetailSelection] =
    useState<PlanningDetailSelection | null>(null);
  const [showTemplates, setShowTemplates] = usePersistedState<boolean>(
    "training_show_templates_v1",
    false
  );
  const {
    animatedStyle: templatesAnimStyle,
    isVisible: showTemplatesContent,
  } = useCollapsibleAnimation(showTemplates);
  const [selectedPlan, setSelectedPlan] = useState<TrainingPlan | null>(null);
  const [showSavedPlans, setShowSavedPlans] = usePersistedState<boolean>(
    "training_show_saved_plans_v1",
    true
  );
  const [savedPlanSearch, setSavedPlanSearch] = useState("");
  const [savedPlanClassFilter, setSavedPlanClassFilter] = useState("__all__");
  const {
    animatedStyle: savedPlansAnimStyle,
    isVisible: showSavedPlansContent,
  } = useCollapsibleAnimation(showSavedPlans);
  const [formY, setFormY] = useState(0);
  const formContainerRef = useRef<View>(null);
  const formUnitTriggerRef = useRef<View>(null);
  const formClassTriggerRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [scrollRequested, setScrollRequested] = useState(false);
  const [templateAgeBand, setTemplateAgeBand] = useState("");
  const [formMode, setFormMode] = useState<"plan" | "template">("plan");
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editingTemplateCreatedAt, setEditingTemplateCreatedAt] = useState<string | null>(null);
  const [planningTab, setPlanningTab] = useState<
    "formulario" | "salvos" | "modelos"
  >("formulario");
  const {
    templateForm,
    setTemplateTitle,
    setTemplateAge,
    setTemplateTags,
    setTemplateWarmup,
    setTemplateMain,
    setTemplateCooldown,
    setTemplateWarmupTime,
    setTemplateMainTime,
    setTemplateCooldownTime,
    setTemplateEditorId,
    setTemplateEditorCreatedAt,
    setTemplateEditorSource,
    setTemplateEditorTemplateId,
    setTemplateEditorComposerHeight,
    setTemplateEditorKeyboardHeight,
    setRenameTemplateId,
    setRenameTemplateText,
    setShowTemplateEditor,
    setShowTemplateCloseConfirm,
    resetTemplateForm,
  } = useTemplateEditorForm();
  const {
    templateTitle,
    templateAge,
    templateTags,
    templateWarmup,
    templateMain,
    templateCooldown,
    templateWarmupTime,
    templateMainTime,
    templateCooldownTime,
    templateEditorId,
    templateEditorCreatedAt,
    templateEditorSource,
    templateEditorTemplateId,
    templateEditorComposerHeight,
    templateEditorKeyboardHeight,
    renameTemplateId,
    renameTemplateText,
    showTemplateEditor,
    showTemplateCloseConfirm,
  } = templateForm;
  markRender("screen.training.render.root");
  const [lastCreatedPlanId, setLastCreatedPlanId] = useState<string | null>(null);
  const [lastCreatedClassId, setLastCreatedClassId] = useState("");
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
  const [handledAiDraftRaw, setHandledAiDraftRaw] = useState<string | null>(null);
  const [applyUnit, setApplyUnit] = useState("");
  const [applyClassId, setApplyClassId] = useState("");
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showApplyCloseConfirm, setShowApplyCloseConfirm] = useState(false);
  const [applyPlan, setApplyPlan] = useState<TrainingPlan | null>(null);
  const [applyDays, setApplyDays] = useState<number[]>([]);
  const [applyDate, setApplyDate] = useState("");
  const [showApplyUnitPicker, setShowApplyUnitPicker] = useState(false);
  const [showApplyClassPicker, setShowApplyClassPicker] = useState(false);
  const [showFormUnitPicker, setShowFormUnitPicker] = useState(false);
  const [showFormClassPicker, setShowFormClassPicker] = useState(false);
  const [applyContainerWindow, setApplyContainerWindow] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [formContainerWindow, setFormContainerWindow] = useState<{
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
  const [formUnitTriggerLayout, setFormUnitTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [formClassTriggerLayout, setFormClassTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const parsedAiDraft = useMemo(() => {
    if (!aiDraftRaw.trim()) return null;
    try {
      const decoded = decodeURIComponent(aiDraftRaw);
      const payload = JSON.parse(decoded) as Record<string, unknown>;
      const toList = (value: unknown) =>
        Array.isArray(value) ? value.map(String).filter(Boolean) : [];
      const toText = (value: unknown) => (typeof value === "string" ? value.trim() : "");
      return {
        title: toText(payload.title),
        tags: toList(payload.tags),
        warmup: toList(payload.warmup),
        main: toList(payload.main),
        cooldown: toList(payload.cooldown),
        warmupTime: toText(payload.warmupTime),
        mainTime: toText(payload.mainTime),
        cooldownTime: toText(payload.cooldownTime),
      };
    } catch {
      return null;
    }
  }, [aiDraftRaw]);
  const applyContainerRef = useRef<View>(null);
  const applyUnitTriggerRef = useRef<View>(null);
  const applyClassTriggerRef = useRef<View>(null);
  const {
    animatedStyle: formUnitPickerAnimStyle,
    isVisible: showFormUnitPickerContent,
  } = useCollapsibleAnimation(showFormUnitPicker, { translateY: -6 });
  const {
    animatedStyle: formClassPickerAnimStyle,
    isVisible: showFormClassPickerContent,
  } = useCollapsibleAnimation(showFormClassPicker, { translateY: -6 });
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
  const trainingFabAnim = useRef(new Animated.Value(0)).current;

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === classId),
    [classes, classId]
  );
  const trainingSessionDefaultClassIds = useMemo(
    () =>
      createSessionClassIdsRaw
        ? createSessionClassIdsRaw
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        : selectedClass?.id
          ? [selectedClass.id]
          : [],
    [createSessionClassIdsRaw, selectedClass?.id]
  );
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
  const trainingFabBottom = Math.max(insets.bottom + 166, 182);
  const trainingFabRight = 16;
  const trainingFabRotate = useMemo(
    () =>
      trainingFabAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ["0deg", "45deg"],
      }),
    [trainingFabAnim]
  );
  const trainingFabScale = useMemo(
    () =>
      trainingFabAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.06],
      }),
    [trainingFabAnim]
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
      setShowTrainingFabMenu(false);
    }
  }, [planningTab, showTrainingFabMenu]);

  useEffect(() => {
    if (!createSessionRequestKey) return;
    if (createSessionRequestKey === handledCreateSessionRequestRaw) return;
    setHandledCreateSessionRequestRaw(createSessionRequestKey);
    setShowTrainingSessionCreate(true);
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

  const classStartTimeById = useMemo(() => {
    const map: Record<string, string> = {};
    classes.forEach((item) => {
      if (item.startTime) map[item.id] = item.startTime;
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
  const classOptionsForForm = useMemo(() => {
    if (formUnit === ALL_UNITS_VALUE) return sortedClasses;
    if (!formUnit) return [];
    return sortedClasses.filter((item) => unitLabel(item.unit) === formUnit);
  }, [formUnit, sortedClasses]);
  const selectedApplyClass = useMemo(
    () => classOptionsForUnit.find((item) => item.id === applyClassId) ?? null,
    [applyClassId, classOptionsForUnit]
  );
  const selectedFormClass = useMemo(
    () => classOptionsForForm.find((item) => item.id === classId) ?? null,
    [classId, classOptionsForForm]
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
  }, [classId, classes, formUnit]);

  useEffect(() => {
    if (!formUnit || !classId) return;
    const selected = classes.find((item) => item.id === classId);
    if (!selected) return;
    if (unitLabel(selected.unit) !== formUnit) {
      setClassId("");
    }
  }, [formUnit, classId, classes]);

  useEffect(() => {
    if (!applyPlan) return;
    const defaultClass = classes.find((item) => item.id === applyPlan.classId);
    const targetClass = classes.find((item) => item.id === targetClassId);
    const resolvedClass = targetClass ?? defaultClass;
    const resolvedClassId = resolvedClass?.id ?? applyPlan.classId;
    const resolvedUnit = unitLabel(resolvedClass?.unit ?? "");
    const resolvedDate = targetDate || applyPlan.applyDate || "";
    const isFreshPlan =
      lastCreatedPlanId && applyPlan.id === lastCreatedPlanId;
    if (isFreshPlan) {
      const freshClassId = lastCreatedClassId;
      const freshClass = classes.find((item) => item.id === freshClassId);
      const freshUnit = freshClass ? unitLabel(freshClass.unit) : "";
      setApplyUnit(freshUnit);
      setApplyClassId(freshClassId || "");
      setApplyDays([]);
      setApplyDate("");
      setApplySnapshot({
        unit: freshUnit,
        classId: freshClassId || "",
        days: [],
        date: "",
      });
      return;
    }
    setApplyUnit(resolvedUnit);
    setApplyClassId(resolvedClassId);
    setApplyDays(applyPlan.applyDays ?? []);
    setApplyDate(resolvedDate);
    setApplySnapshot({
      unit: resolvedUnit,
      classId: resolvedClassId,
      days: (applyPlan.applyDays ?? []).slice().sort((a, b) => a - b),
      date: resolvedDate,
    });
  }, [applyPlan, classes, lastCreatedClassId, lastCreatedPlanId, targetClassId, targetDate]);

  useEffect(() => {
    if (!applyPlanId || applyPlanId === handledApplyPlanId) return;
    const plan = items.find((item) => item.id === applyPlanId);
    if (!plan) return;
    setApplyPlan(plan);
    setShowApplyModal(true);
    setHandledApplyPlanId(applyPlanId);
  }, [applyPlanId, handledApplyPlanId, items]);

  useEffect(() => {
    if (!viewPlanId || viewPlanId === handledViewPlanId) return;
    const plan = items.find((item) => item.id === viewPlanId);
    if (!plan) return;
    setSelectedPlan(plan);
    setShowSavedPlans(true);
    setHandledViewPlanId(viewPlanId);
  }, [handledViewPlanId, items, viewPlanId]);


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
      setApplyClassId(classOptionsForUnit[0]?.id ?? "");
    }
  }, [classOptionsForUnit, applyClassId]);

  const ageBands = useMemo(() => {
    const values = new Set<string>();
    classes.forEach((item) => {
      const band = normalizeAgeBand(item.ageBand);
      if (band) values.add(band);
    });
    trainingTemplates.forEach((template) => {
      template.ageBands.forEach((band) => {
        const normalized = normalizeAgeBand(band);
        if (normalized) values.add(normalized);
      });
    });
    return sortAgeBandList(Array.from(values));
  }, [classes]);

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
        const [classList, plans] = await measureAsync(
          "screen.training.load.initial",
          () =>
            Promise.all([
              getClasses(),
              getTrainingPlans(),
            ]),
          { hasSelectedClass: classId ? 1 : 0 }
        );
        if (!alive) return;
        setClasses(classList);
        setItems(plans);
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
          { hasSelectedClass: classId ? 1 : 0 }
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
        console.error("Training bootstrap load failed:", error);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

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
  }, []);


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

  const savedPlanClassOptions = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((plan) => {
      counts.set(plan.classId, (counts.get(plan.classId) ?? 0) + 1);
    });

    const labelCounts = new Map<string, number>();
    Array.from(counts.keys()).forEach((id) => {
      const label = classById.get(id)?.name ?? "Turma";
      labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([id, count]) => {
        const classItem = classById.get(id);
        const baseLabel = classItem?.name ?? "Turma";
        const hasDuplicateLabel = (labelCounts.get(baseLabel) ?? 0) > 1;
        return {
          id,
          count,
          label:
            hasDuplicateLabel && classItem?.startTime
              ? `${baseLabel} · ${classItem.startTime}`
              : baseLabel,
          detail: [classItem?.unit, classItem?.ageBand, classItem?.startTime]
            .filter(Boolean)
            .join(" · "),
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [classById, items]);

  const filteredItems = useMemo(() => {
    const query = normalizeSearchValue(savedPlanSearch);

    return items.filter((plan) => {
      if (savedPlanClassFilter !== "__all__" && plan.classId !== savedPlanClassFilter) {
        return false;
      }

      if (!query) return true;

      const classItem = classById.get(plan.classId);
      const counts = getTrainingPlanBlockCounts(plan);
      const searchText = normalizeSearchValue(
        [
          plan.title,
          plan.tags?.join(" "),
          classItem?.name,
          classItem?.unit,
          classItem?.ageBand,
          classItem?.startTime,
          classItem?.endTime,
          formatDate(plan.createdAt),
          plan.applyDate ? formatShortDate(plan.applyDate) : "",
          plan.applyDays?.length ? formatWeekdays(plan.applyDays) : "",
          `aquecimento ${counts.warmup}`,
          `principal ${counts.main}`,
          `volta ${counts.cooldown}`,
        ]
          .filter(Boolean)
          .join(" ")
      );

      return searchText.includes(query);
    });
  }, [classById, items, savedPlanClassFilter, savedPlanSearch]);

  const groupedSavedPlans = useMemo(() => {
    const getPlanDateTime = (plan: TrainingPlan) => {
      if (plan.applyDate) {
        const startTime = classStartTimeById[plan.classId];
        if (
          startTime &&
          /^\d{4}-\d{2}-\d{2}$/.test(plan.applyDate)
        ) {
          const dated = new Date(`${plan.applyDate}T${startTime}:00`);
          if (!Number.isNaN(dated.getTime())) return dated;
        }
        const applied = new Date(plan.applyDate);
        if (!Number.isNaN(applied.getTime())) return applied;
      }
      const created = new Date(plan.createdAt);
      return Number.isNaN(created.getTime()) ? new Date(0) : created;
    };

    const entries = filteredItems
      .map((plan) => ({ plan, date: getPlanDateTime(plan) }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const groups: {
      key: string;
      label: string;
      items: TrainingPlan[];
      start: Date;
    }[] = [];
    const map = new Map<string, (typeof groups)[number]>();

    entries.forEach(({ plan, date }) => {
      const start = getWeekStart(date);
      const key = start.toISOString().slice(0, 10);
      let group = map.get(key);
      if (!group) {
        const end = getWeekEnd(start);
        group = {
          key,
          label: `${formatShortDateValue(start)} - ${formatShortDateValue(end)}`,
          items: [],
          start,
        };
        map.set(key, group);
        groups.push(group);
      }
      group.items.push(plan);
    });

    return groups;
  }, [classStartTimeById, filteredItems]);

  const getClassName = useCallback(
    (id: string) => classById.get(id)?.name ?? "Turma",
    [classById]
  );

  const TemplateRow = useMemo(
    () =>
      memo(function TemplateRowItem({
        template,
        onRename,
        onUse,
        onOpenEditor,
      }: {
        template: (typeof templates)[number];
        onRename: (id: string, title: string) => void;
        onUse: (template: (typeof templates)[number]) => void;
        onOpenEditor: (template: (typeof templates)[number]) => void;
      }) {
        return (
          <View style={{ gap: 6 }}>
            <View
              style={{
                padding: 12,
                borderRadius: 14,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Pressable
                onLongPress={() => onOpenEditor(template)}
                delayLongPress={250}
              >
                <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>
                  {template.title}
                </Text>
                <Text style={{ color: colors.muted, marginTop: 2, fontSize: 12 }}>
                  {"Tags: " + template.tags.join(", ")}
                </Text>
                <Text style={{ color: colors.muted, marginTop: 2, fontSize: 10 }}>
                  {template.source === "built"
                     ? "Fonte: Instituto Compartilhar e CMV (Volei Veilig)"
                    : "Fonte: Modelo criado"}
                </Text>
              </Pressable>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                <Pressable
                  onPress={() => onUse(template)}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 12,
                    backgroundColor: colors.primaryBg,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: colors.primaryText, fontWeight: "700", fontSize: 12 }}>
                    Usar modelo
                  </Text>
                </Pressable>
                { template.source === "custom" ? (
                  <Pressable
                    onPress={() => onRename(template.id, template.title)}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      backgroundColor: colors.secondaryBg,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                      Renomear
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              { renameTemplateId === template.id ? (
                <View style={{ gap: 8, marginTop: 10 }}>
                  <TextInput
                    placeholder="Novo nome"
                    value={renameTemplateText}
                    onChangeText={setRenameTemplateText}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      padding: 8,
                      borderRadius: 10,
                      backgroundColor: colors.inputBg,
                    }}
                  />
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 6,
                      padding: 6,
                      borderRadius: 999,
                      backgroundColor: colors.secondaryBg,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Pressable
                      onPress={async () => {
                        if (!renameTemplateText.trim()) return;
                        await updateTrainingTemplate({
                          id: template.id,
                          title: renameTemplateText.trim(),
                          ageBand: template.ageBands[0] ?? templateAgeBand ?? "08-09",
                          tags: template.tags ?? [],
                          warmup: template.warmup ?? [],
                          main: template.main ?? [],
                          cooldown: template.cooldown ?? [],
                          warmupTime: template.warmupTime ?? "",
                          mainTime: template.mainTime ?? "",
                          cooldownTime: template.cooldownTime ?? "",
                          createdAt: template.createdAt,
                        });
                        setTemplateItems((current) =>
                          current.map((item) =>
                            item.id === template.id
                              ? { ...item, title: renameTemplateText.trim() }
                              : item
                          )
                        );
                        setRenameTemplateId(null);
                        setRenameTemplateText("");
                      }}
                      style={{
                        flex: 1,
                        paddingVertical: 6,
                        borderRadius: 8,
                        backgroundColor: colors.primaryBg,
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ color: colors.primaryText, fontWeight: "700", fontSize: 12 }}>
                        Salvar nome
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setRenameTemplateId(null);
                        setRenameTemplateText("");
                      }}
                      style={{
                        flex: 1,
                        paddingVertical: 6,
                        borderRadius: 8,
                        backgroundColor: colors.secondaryBg,
                        borderWidth: 1,
                        borderColor: colors.border,
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                        Cancelar
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        );
      }),
    [colors, renameTemplateId, renameTemplateText]
  );

  const savedPlanCardWidth = viewportWidth >= 760 ? "49%" : "100%";

  const PlanRow = useMemo(
    () =>
      memo(function PlanRowItem({
        plan,
        onOpenActions,
        onApply,
        onView,
      }: {
        plan: TrainingPlan;
        onOpenActions: (plan: TrainingPlan) => void;
        onApply: (plan: TrainingPlan) => void;
        onView: (plan: TrainingPlan) => void;
      }) {
        const classItem = classById.get(plan.classId);
        const displayTitle = getSavedPlanDisplayTitle(plan);
        const scheduleText = [
          classItem?.startTime && classItem?.endTime
            ? `${classItem.startTime}-${classItem.endTime}`
            : "",
          classItem?.ageBand,
        ]
          .filter(Boolean)
          .join(" · ");
        const appliedText = plan.applyDays?.length
          ? formatWeekdays(plan.applyDays)
          : plan.applyDate
            ? formatShortDate(plan.applyDate)
            : "Sem data";

        return (
          <View
            style={{
              width: savedPlanCardWidth as any,
              gap: 12,
              padding: 14,
              borderRadius: 14,
              backgroundColor: colors.inputBg,
              borderWidth: 1,
              borderColor: colors.border,
              minHeight: 168,
              justifyContent: "space-between",
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Abrir ${displayTitle}`}
              onPress={() => onView(plan)}
              onLongPress={() => onOpenActions(plan)}
              delayLongPress={250}
              style={{ gap: 8 }}
            >
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 12,
                  fontWeight: "700",
                }}
                numberOfLines={1}
              >
                {classItem?.unit ? `${classItem.unit} · ` : ""}
                {getClassName(plan.classId)}
              </Text>
              <Text
                style={{ fontSize: 17, fontWeight: "800", color: colors.text }}
                numberOfLines={2}
              >
                {displayTitle}
              </Text>
              {scheduleText ? (
                <Text style={{ color: colors.secondaryText, fontSize: 12 }} numberOfLines={1}>
                  {scheduleText}
                </Text>
              ) : null}

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                    paddingVertical: 5,
                    paddingHorizontal: 8,
                    borderRadius: 999,
                    backgroundColor: colors.card,
                  }}
                >
                  <Ionicons name="time-outline" size={13} color={colors.muted} />
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>
                    Criado {formatDate(plan.createdAt)}
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                    paddingVertical: 5,
                    paddingHorizontal: 8,
                    borderRadius: 999,
                    backgroundColor: colors.card,
                  }}
                >
                  <Ionicons name="calendar-outline" size={13} color={colors.muted} />
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>
                    {appliedText}
                  </Text>
                </View>
              </View>
            </Pressable>

            <View
              style={{
                flexDirection: "row",
                gap: 8,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Aplicar ${displayTitle}`}
                onPress={(event: any) => {
                  event?.stopPropagation?.();
                  onApply(plan);
                }}
                style={{
                  flex: 1,
                  minHeight: 42,
                  paddingVertical: 8,
                  borderRadius: 12,
                  backgroundColor: colors.primaryBg,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 6,
                }}
              >
                <Ionicons name="checkmark-circle-outline" size={16} color={colors.primaryText} />
                <Text style={{ color: colors.primaryText, fontWeight: "800", fontSize: 13 }}>
                  Aplicar
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Ver ${displayTitle}`}
                onPress={(event: any) => {
                  event?.stopPropagation?.();
                  onView(plan);
                }}
                style={{
                  flex: 1,
                  minHeight: 42,
                  paddingVertical: 8,
                  borderRadius: 12,
                  backgroundColor: colors.secondaryBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 6,
                }}
              >
                <Ionicons name="eye-outline" size={16} color={colors.text} />
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 13 }}>
                  Ver
                </Text>
              </Pressable>
            </View>
          </View>
        );
      }),
    [classById, colors, getClassName, savedPlanCardWidth]
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
  }, [classId, classes, selectedClassForMethodology, templateAgeBand, templateTitle, title]);

  const suggestions = useMemo(() => {
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

  const autoPlanningTags = useMemo(() => {
    const structuredActivities = planningBlockKeys.flatMap(
      (blockKey) => planningActivities[blockKey] ?? []
    );
    const structuredText = structuredActivities
      .flatMap((activity) => [
        activity.name,
        activity.description,
        activity.objective,
        activity.coachFocus,
        activity.primarySkill,
        activity.catalog?.source === "goAtletaCatalog" ? "catalogo-goatleta" : "",
        activity.execution ? "video-link" : "",
      ])
      .filter(Boolean)
      .join(" ");
    const planText = [title, warmup, main, cooldown, structuredText].join(" ");
    const keywordCounts = extractKeywords(planText).reduce<Record<string, number>>(
      (acc, token) => {
        acc[token] = (acc[token] ?? 0) + 1;
        return acc;
      },
      {}
    );
    const topKeywords = Object.entries(keywordCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([token]) => token);
    const activityTags = structuredActivities.flatMap((activity) => [
      activity.primarySkill ?? "",
      activity.stage ?? "",
      activity.catalog?.source === "goAtletaCatalog" ? "catalogo-goatleta" : "",
      activity.execution ? "video-link" : "",
    ]);
    const classTags = [
      selectedClassForMethodology?.ageBand
        ? `idade-${selectedClassForMethodology.ageBand}`
        : "",
    ];
    return compactTagList(
      [
        ...activityTags,
        ...(methodologyTranslation?.tags ?? []),
        ...classTags,
        ...topKeywords,
        ...tagsText.split(","),
      ],
      8
    );
  }, [
    cooldown,
    main,
    methodologyTranslation,
    planningActivities,
    selectedClassForMethodology?.ageBand,
    tagsText,
    title,
    warmup,
  ]);

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

  const reload = async () => {
    const data = await getTrainingPlans();
    setItems(data);
  };

  const planningBlockText = useMemo(
    () => ({ warmup, main, cooldown }),
    [cooldown, main, warmup]
  );

  const setPlanningBlockText = useCallback(
    (blockKey: TrainingPlanBlockKey, value: string) => {
      if (blockKey === "warmup") {
        setWarmup(value);
      } else if (blockKey === "main") {
        setMain(value);
      } else {
        setCooldown(value);
      }
    },
    [setCooldown, setMain, setWarmup]
  );

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

  const resetPlanningActivities = useCallback(() => {
    setPlanningActivities(createEmptyPlanningBlockActivities());
  }, []);

  const applyLegacyActivitiesToPlanningForm = useCallback(
    (lines: Record<TrainingPlanBlockKey, string[]>) => {
      const nextActivities = buildPlanningActivitiesFromLegacyLines(lines);
      setPlanningActivities(nextActivities);
    },
    []
  );

  const handleOpenPlanningLibrary = useCallback((blockKey: TrainingPlanBlockKey) => {
    setPlanningLibraryBlockKey(blockKey);
  }, []);

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

  const handleRemovePlanningActivity = useCallback(
    async (blockKey: TrainingPlanBlockKey, index: number) => {
      const activity = planningActivities[blockKey]?.[index];
      if (!activity) return;
      const shouldRemove = await confirmDialog({
        title: "Remover atividade?",
        message: `Deseja remover "${activity.name || "esta atividade"}" deste bloco?`,
        confirmLabel: "Remover",
        cancelLabel: "Cancelar",
        tone: "danger",
        onConfirm: () => {},
      });
      if (!shouldRemove) return;
      setPlanningActivities((current) => removePlanningActivityFromBlock(current, blockKey, index));
      showSaveToast({
        message: "Atividade removida do bloco.",
        variant: "info",
      });
    },
    [confirmDialog, planningActivities, showSaveToast]
  );

  const handleRemoveManualPlanningLine = useCallback(
    async (blockKey: TrainingPlanBlockKey, index: number) => {
      const rows = toManualRows(planningBlockText[blockKey] ?? "");
      const label = rows[index]?.trim();
      if (label) {
        const shouldRemove = await confirmDialog({
          title: "Remover atividade manual?",
          message: `Deseja remover "${label}" deste bloco?`,
          confirmLabel: "Remover",
          cancelLabel: "Cancelar",
          tone: "danger",
          onConfirm: () => {},
        });
        if (!shouldRemove) return;
      }
      const nextRows = rows.filter((_, rowIndex) => rowIndex !== index);
      setPlanningBlockText(blockKey, nextRows.length ? nextRows.join("\n") : "");
      showSaveToast({
        message: "Atividade removida.",
        variant: "info",
      });
    },
    [confirmDialog, planningBlockText, setPlanningBlockText, showSaveToast]
  );

  const planningDetailActivity = useMemo(() => {
    if (!planningDetailSelection) return null;
    return (
      planningActivities[planningDetailSelection.blockKey]?.[
        planningDetailSelection.index
      ] ?? null
    );
  }, [planningActivities, planningDetailSelection]);

  const handleViewPlanningActivity = useCallback(
    (blockKey: TrainingPlanBlockKey, index: number) => {
      setPlanningDetailSelection({ blockKey, index });
    },
    []
  );

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
  const planningBlockListStyle = useMemo(() => ({ gap: 10 }), []);
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
  const planningShellStyle = useMemo(
    () => ({
      width: "100%" as const,
      maxWidth: viewportWidth >= 1440 ? 1280 : 1180,
      alignSelf: "center" as const,
    }),
    [viewportWidth]
  );

  const savePlan = async () => {
    if (!classId) {
      showSaveToast({
        message: "Selecione a turma",
        variant: "warning",
      });
      return;
    }
    const nowIso = new Date().toISOString();
    const latestVersionPlan = await getLatestTrainingPlanByClass(classId);
    const latestVersion = latestVersionPlan?.version ?? 0;
    const basePlan = editingId
      ? items.find((item) => item.id === editingId) ?? null
      : null;
    const pedagogy = buildPedagogyBlocksFromPlanningForm({
      currentPedagogy: basePlan?.pedagogy,
      blockActivities: planningActivities,
      blockText: planningBlockText,
    });
    const syncedLegacyLines = syncLegacyLinesFromBlocks({
      warmup: pedagogy.blocks?.warmup?.activities ?? [],
      main: pedagogy.blocks?.main?.activities ?? [],
      cooldown: pedagogy.blocks?.cooldown?.activities ?? [],
    });
    const plan: TrainingPlan = createTrainingPlanVersion({
      classId,
      version: Math.max(basePlan?.version ?? 0, latestVersion) + 1,
      origin: editingId ? "edited_auto" : "manual",
      draft: {
        title: title.trim() || "Planejamento sem título",
        tags: autoPlanningTags,
        warmup: syncedLegacyLines.warmup,
        main: syncedLegacyLines.main,
        cooldown: syncedLegacyLines.cooldown,
        warmupTime: warmupTime.trim(),
        mainTime: mainTime.trim(),
        cooldownTime: cooldownTime.trim(),
      },
      applyDays: basePlan?.applyDays ?? [],
      applyDate: basePlan?.applyDate ?? "",
      inputHash: basePlan?.inputHash,
      nowIso,
      idPrefix: "t",
      status: "final",
      finalizedAt: nowIso,
      pedagogy,
    });

    if (editingId) {
      await measure("saveTrainingPlanVersion", () => saveTrainingPlan(plan));
    } else {
      await measure("saveTrainingPlan", () => saveTrainingPlan(plan));
      setLastCreatedPlanId(plan.id);
      setLastCreatedClassId(classId);
    }
    logAction(editingId ? "Editar plano de aula" : "Salvar plano de aula", {
      planId: plan.id,
      classId,
    });
    void notifyTrainingSaved();
    showSaveToast({
      message: "Plano salvo com sucesso.",
      actionLabel: "Ver plano",
      variant: "success",
      onAction: () => {
        setSelectedPlan(plan);
        setShowSavedPlans(true);
      },
    });
    setTitle("");
    setTagsText("");
    setWarmup("");
    setMain("");
    setCooldown("");
    setWarmupTime("");
    setMainTime("");
    setCooldownTime("");
    setFormUnit("");
    resetPlanningActivities();
    setEditingId(null);
    setEditingCreatedAt(null);
    setFormMode("plan");
    closeFormPickers();
    await reload();
  };

  const saveTemplate = async () => {
    const band =
      selectedClass?.ageBand ||
      templateAgeBand ||
      (classes[0] ? classes[0].ageBand : "");
    if (!band) {
      Alert.alert("Selecione uma turma", "Defina a faixa etária primeiro.");
      return;
    }
    const nowIso = new Date().toISOString();
    const template: TrainingTemplate = {
      id: editingTemplateId ?? "tpl_" + Date.now(),
      title: title.trim() || "Modelo sem título",
      ageBand: band,
      tags: autoPlanningTags,
      warmup: toLines(warmup),
      main: toLines(main),
      cooldown: toLines(cooldown),
      warmupTime: warmupTime.trim(),
      mainTime: mainTime.trim(),
      cooldownTime: cooldownTime.trim(),
      createdAt: editingTemplateCreatedAt ?? nowIso,
    };
    if (editingTemplateId) {
      await measure("updateTrainingTemplate", () =>
        updateTrainingTemplate(template)
      );
    } else {
      await measure("saveTrainingTemplate", () => saveTrainingTemplate(template));
    }
    logAction(editingTemplateId ? "Editar modelo" : "Salvar modelo", {
      templateId: template.id,
      ageBand: template.ageBand,
    });
    if (editingTemplateId) {
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
    setEditingTemplateId(null);
    setEditingTemplateCreatedAt(null);
    setFormMode("plan");
    closeFormPickers();
    showSaveToast({ message: "Modelo salvo com sucesso.", variant: "success" });
  };

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
  }, []);

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
    const nowIso = new Date().toISOString();
    const latestVersionPlan = await getLatestTrainingPlanByClass(applyClassId);
    const latestVersion = latestVersionPlan?.version ?? 0;
    const updated: TrainingPlan = createTrainingPlanVersion({
      classId: applyClassId,
      version: Math.max(applyPlan.version ?? 0, latestVersion) + 1,
      origin: "manual",
      draft: {
        title: applyPlan.title,
        tags: applyPlan.tags,
        warmup: applyPlan.warmup,
        main: applyPlan.main,
        cooldown: applyPlan.cooldown,
        warmupTime: applyPlan.warmupTime,
        mainTime: applyPlan.mainTime,
        cooldownTime: applyPlan.cooldownTime,
      },
      applyDays,
      applyDate,
      nowIso,
      idPrefix: "t",
      status: "final",
      finalizedAt: nowIso,
      inputHash: applyPlan.inputHash,
    });
    await measure("applyTrainingPlan", () => saveTrainingPlan(updated));
    await createCalendarEvent(updated);
    await reload();
    closeApplyModal();
    logAction("Aplicar planejamento", {
      planId: updated.id,
      classId: applyClassId,
      applyDate,
      daysCount: applyDays.length,
    });
    showSaveToast({
      message: "Planejamento aplicado com sucesso.",
      actionLabel: "Ver aula do dia",
      variant: "success",
      onAction: () => {
        router.push({
          pathname: "/class/[id]/session",
          params: { id: applyClassId, date: applyDate },
        });
      },
    });
  };

  const openTemplateForEdit = useCallback((template: {
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
    setEditingTemplateId(template.source === "custom" ? template.id : null);
    setEditingTemplateCreatedAt(
      template.source === "custom" ? template.createdAt : null
    );
    setFormMode("template");
    if (template.ageBands.length) {
      setTemplateAgeBand(template.ageBands[0]);
    }
    const band = template.ageBands[0] || templateAgeBand;
    setClassId(band ? pickClassIdForAgeBand(band) : "");
    applyTemplate(template);
  }, [applyTemplate, pickClassIdForAgeBand, templateAgeBand]);

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
      id: "tpl_" + Date.now(),
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

  const openTemplateEditor = useCallback((template: {
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
    const isCustom = template.source === "custom";
    const nextAge = template.ageBands[0] || templateAgeBand;
    setTemplateEditorId(isCustom ? template.id : null);
    setTemplateEditorCreatedAt(isCustom ? template.createdAt : null);
    setTemplateEditorSource(isCustom ? "custom" : "built");
    setTemplateEditorTemplateId(template.id);
    setTemplateTitle(template.title);
    setTemplateAge(nextAge);
    setTemplateTags(template.tags.join(", "));
    setTemplateWarmup(template.warmup.join("\n"));
    setTemplateMain(template.main.join("\n"));
    setTemplateCooldown(template.cooldown.join("\n"));
    setTemplateWarmupTime(template.warmupTime);
    setTemplateMainTime(template.mainTime);
    setTemplateCooldownTime(template.cooldownTime);
    setTemplateEditorSnapshot({
      title: template.title,
      age: nextAge,
      tags: template.tags.join(", "),
      warmup: template.warmup.join("\n"),
      main: template.main.join("\n"),
      cooldown: template.cooldown.join("\n"),
      warmupTime: template.warmupTime,
      mainTime: template.mainTime,
      cooldownTime: template.cooldownTime,
    });
    setShowTemplateEditor(true);
  }, [templateAgeBand]);

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

  const toggleFormPicker = (target: "unit" | "class") => {
    setShowFormUnitPicker((prev) => (target === "unit" ? !prev : false));
    setShowFormClassPicker((prev) => (target === "class" ? !prev : false));
  };

  const closeApplyPickers = () => {
    setShowApplyUnitPicker(false);
    setShowApplyClassPicker(false);
  };

  const closeFormPickers = () => {
    setShowFormUnitPicker(false);
    setShowFormClassPicker(false);
  };

  const syncApplyPickerLayouts = () => {
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
  };

  const syncFormPickerLayouts = () => {
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
  };

  const closeApplyModal = () => {
    setShowApplyModal(false);
    setShowApplyCloseConfirm(false);
    setApplyPlan(null);
    setShowApplyCalendar(false);
    setApplySnapshot(null);
    closeApplyPickers();
  };

  const requestCloseApplyModal = () => {
    if (isApplyDirty) {
      setShowApplyCloseConfirm(true);
      return;
    }
    closeApplyModal();
  };

  useEffect(() => {
    syncApplyPickerLayouts();
  }, [showApplyUnitPicker, showApplyClassPicker]);

  useEffect(() => {
    syncFormPickerLayouts();
  }, [showFormUnitPicker, showFormClassPicker]);

  const saveTemplateEditor = async () => {
    const ageBand = templateAge.trim() || templateAgeBand;
    if (!ageBand) {
      Alert.alert("Defina a faixa etária", "Informe a faixa etária do modelo.");
      return;
    }
    const nowIso = new Date().toISOString();
    const template: TrainingTemplate = {
      id: templateEditorId ?? "tpl_" + Date.now(),
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

  const buildShareText = (plan: TrainingPlan) => {
    const lines = [
      plan.title,
      "Turma: " + getClassName(plan.classId),
      "",
      "Aquecimento " + (plan.warmupTime ? "(" + formatDuration(plan.warmupTime) + ")" : ""),
      plan.warmup.length ? "- " + plan.warmup.join("\n- ") : "- Sem itens",
      "",
      "Parte principal " + (plan.mainTime ? "(" + formatClock(plan.mainTime) + ")" : ""),
      plan.main.length ? "- " + plan.main.join("\n- ") : "- Sem itens",
      "",
      "Volta a calma " + (plan.cooldownTime ? "(" + formatDuration(plan.cooldownTime) + ")" : ""),
      plan.cooldown.length ? "- " + plan.cooldown.join("\n- ") : "- Sem itens",
    ];
    if (plan.tags.length) {
      lines.push("");
      lines.push("Tags: " + plan.tags.join(", "));
    }
    return lines.join("\n");
  };

  const shareTraining = async (plan: TrainingPlan) => {
    const message = buildShareText(plan);
    await Share.share({ message });
  };

  const saveCurrentAsTemplate = async () => {
    const band =
      selectedClass?.ageBand ||
      templateAgeBand ||
      (classes[0] ? classes[0].ageBand : "");
    if (!band) {
      Alert.alert("Selecione uma turma", "Defina a faixa etária primeiro.");
      return;
    }
    const nowIso = new Date().toISOString();
    const template: TrainingTemplate = {
      id: "tpl_" + Date.now(),
      title: title.trim() || "Modelo sem título",
      ageBand: band,
      tags: autoPlanningTags,
      warmup: toLines(warmup),
      main: toLines(main),
      cooldown: toLines(cooldown),
      warmupTime: warmupTime.trim(),
      mainTime: mainTime.trim(),
      cooldownTime: cooldownTime.trim(),
      createdAt: nowIso,
    };
    await saveTrainingTemplate(template);
    setTemplateItems((current) => [template, ...current.filter((item) => item.id !== template.id)]);
    Alert.alert("Modelo salvo", "Agora ele aparece em Modelos prontos.");
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
      id: "tpl_" + Date.now(),
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

  const isFormDirty =
    title.trim() ||
    warmup.trim() ||
    main.trim() ||
    cooldown.trim() ||
    warmupTime.trim() ||
    mainTime.trim() ||
    cooldownTime.trim() ||
    editingId;

  const hasFormContent = Boolean(
    title.trim() ||
      warmup.trim() ||
      main.trim() ||
      cooldown.trim() ||
      warmupTime.trim() ||
      mainTime.trim() ||
      cooldownTime.trim()
  );

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
  const canSaveCurrentForm = formMode === "template" ? hasTemplateContent : hasFormContent;
  const saveButtonLabel =
    formMode === "template"
      ? "Salvar modelo"
      : editingId
        ? "Salvar alterações"
        : "Salvar planejamento";
  const handleSavePress = () => {
    if (formMode === "template") {
      void saveTemplate();
      return;
    }

    void savePlan();
  };

  const scrollToForm = () => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(formY - 8, 0),
        animated: true,
      });
    }, 50);
  };

  useEffect(() => {
    if (!scrollRequested) return;
    scrollToForm();
    setScrollRequested(false);
  }, [formY, scrollRequested]);

  useEffect(() => {
    if (!initialTab) return;
    setPlanningTab(initialTab);
    if (initialTab === "salvos") {
      setShowSavedPlans(true);
    }
  }, [initialTab, setShowSavedPlans]);

  useEffect(() => {
    if (!targetClassId) return;
    setClassId(targetClassId);
  }, [targetClassId]);

  useEffect(() => {
    if (!openForm) return;
    const shouldApplyAiDraft = parsedAiDraft && aiDraftRaw !== handledAiDraftRaw;
    setEditingId(null);
    setEditingCreatedAt(null);
    setEditingTemplateId(null);
    setEditingTemplateCreatedAt(null);
    setFormMode("plan");
    if (shouldApplyAiDraft && parsedAiDraft) {
      setPlanningTab("formulario");
      setTitle(parsedAiDraft.title || "Planejamento assistido");
      setTagsText(parsedAiDraft.tags.join(", "));
      setWarmup(parsedAiDraft.warmup.join("\n"));
      setMain(parsedAiDraft.main.join("\n"));
      setCooldown(parsedAiDraft.cooldown.join("\n"));
      applyLegacyActivitiesToPlanningForm({
        warmup: parsedAiDraft.warmup,
        main: parsedAiDraft.main,
        cooldown: parsedAiDraft.cooldown,
      });
      setWarmupTime(parsedAiDraft.warmupTime);
      setMainTime(parsedAiDraft.mainTime);
      setCooldownTime(parsedAiDraft.cooldownTime);
      setHandledAiDraftRaw(aiDraftRaw);
      showSaveToast("Planejamento assistido aplicado ao formulário.");
    } else {
      setTitle("");
      setTagsText("");
      setWarmup("");
      setMain("");
      setCooldown("");
      resetPlanningActivities();
      setWarmupTime("");
      setMainTime("");
      setCooldownTime("");
    }
    setScrollRequested(true);
    if (targetClassId) {
      setClassId(targetClassId);
      const targetClass = classes.find((item) => item.id === targetClassId);
      setFormUnit(unitLabel(targetClass?.unit ?? ""));
    }
  }, [
    openForm,
    parsedAiDraft,
    aiDraftRaw,
    handledAiDraftRaw,
    targetClassId,
    classes,
    showSaveToast,
    applyLegacyActivitiesToPlanningForm,
    resetPlanningActivities,
  ]);

  useEffect(() => {
    if (!pendingPlanCreate) return;
    setEditingId(null);
    setEditingCreatedAt(null);
    setEditingTemplateId(null);
    setEditingTemplateCreatedAt(null);
    setFormMode("plan");
    setTitle("");
    setTagsText("");
    setWarmup("");
    setMain("");
    setCooldown("");
    resetPlanningActivities();
    setWarmupTime("");
    setMainTime("");
    setCooldownTime("");
    setScrollRequested(true);
    if (pendingPlanCreate.classId) {
      setClassId(pendingPlanCreate.classId);
      const pendingClass = classes.find(
        (item) => item.id === pendingPlanCreate.classId
      );
      setFormUnit(unitLabel(pendingClass?.unit ?? ""));
    }
    setPendingPlanCreate(null);
  }, [pendingPlanCreate, setPendingPlanCreate, classes, resetPlanningActivities]);

  const handleRenameTemplate = useCallback((id: string, title: string) => {
    setRenameTemplateId(id);
    setRenameTemplateText(title);
  }, []);

  const handleUseTemplate = useCallback(
    (template: (typeof templates)[number]) => {
      applyTemplateAsPlan(template);
    },
    [applyTemplateAsPlan]
  );

  const handleOpenTemplateEditor = useCallback(
    (template: (typeof templates)[number]) => {
      openTemplateEditor(template);
    },
    [openTemplateEditor]
  );

  const renderTemplateItem = useCallback(
    ({ item }: { item: (typeof templates)[number] }) => (
      <TemplateRow
        template={item}
        onRename={handleRenameTemplate}
        onUse={handleUseTemplate}
        onOpenEditor={handleOpenTemplateEditor}
      />
    ),
    [TemplateRow, handleOpenTemplateEditor, handleRenameTemplate, handleUseTemplate]
  );

  const templateKeyExtractor = useCallback(
    (item: (typeof templates)[number]) => String(item.id),
    []
  );

  const handleOpenPlanActions = useCallback((plan: TrainingPlan) => {
    setActionPlan(plan);
    setShowPlanActions(true);
  }, []);

  const handleApplyPlan = useCallback((plan: TrainingPlan) => {
    setApplyPlan(plan);
    setShowApplyModal(true);
  }, []);

  const handleViewPlan = useCallback((plan: TrainingPlan) => {
    setSelectedPlan(plan);
  }, []);

  const selectedPlanClassItem = selectedPlan
    ? classById.get(selectedPlan.classId)
    : undefined;
  const selectedPlanScheduleText = selectedPlanClassItem
    ? [
        selectedPlanClassItem.startTime && selectedPlanClassItem.endTime
          ? `${selectedPlanClassItem.startTime}-${selectedPlanClassItem.endTime}`
          : "",
        selectedPlanClassItem.ageBand,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenBackdrop />
      <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View
          style={{
            gap: 16,
            backgroundColor: colors.background,
            paddingBottom: 8,
            paddingHorizontal: 16,
            paddingTop: 16,
          }}
        >
          <View style={[planningShellStyle, { marginBottom: 2 }]}>
            <Pressable
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                  return;
                }
                router.replace("/");
              }}
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Ionicons name="chevron-back" size={20} color={colors.text} />
              <Text style={{ fontSize: 26, fontWeight: "700", color: colors.text }}>
                Planejamento
              </Text>
            </Pressable>
          </View>

          <View
            style={[planningShellStyle, {
              flexDirection: "row",
              gap: 6,
              padding: 6,
              borderRadius: 999,
              backgroundColor: colors.secondaryBg,
            }]}
          >
            {[
              { id: "formulario" as const, label: "Planejar" },
              { id: "salvos" as const, label: "Planos salvos" },
              { id: "modelos" as const, label: "Modelos prontos" },
            ].map((tab) => {
              const selected = planningTab === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => setPlanningTab(tab.id)}
                  style={{
                    flex: 1,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 999,
                    backgroundColor: selected ? colors.primaryBg : colors.card,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: selected ? colors.primaryText : colors.text,
                      fontWeight: "700",
                      fontSize: 12,
                    }}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1, minHeight: 0 }}
          contentContainerStyle={{ paddingBottom: 24, gap: 12, paddingHorizontal: 16, paddingTop: 10 }}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={() => {
            closeFormPickers();
            setShowTrainingFabMenu(false);
          }}
        >
        {planningTab === "formulario" && (
        <>
          <View
            ref={formContainerRef}
            onLayout={(event) => {
              setFormY(event.nativeEvent.layout.y);
              syncFormPickerLayouts();
            }}
            style={[planningShellStyle, { gap: 10 }]}
          >
          <View style={{ gap: 10 }}>
          <Text style={{ color: colors.muted }}>Selecione a turma</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Unidade</Text>
              <View ref={formUnitTriggerRef}>
                <Pressable
                  onPress={() => toggleFormPicker("unit")}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor: colors.background,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                    {formUnit === ALL_UNITS_VALUE
                       ? "Todas as unidades"
                      : formUnit || "Selecione uma unidade"}
                  </Text>
                  <MaterialCommunityIcons
                    name="chevron-down"
                    size={18}
                    color={colors.muted}
                    style={{
                      transform: [
                        { rotate: showFormUnitPicker ? "180deg" : "0deg" },
                      ],
                    }}
                  />
                </Pressable>
              </View>
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Turma</Text>
              <View ref={formClassTriggerRef}>
                <Pressable
                  onPress={() => toggleFormPicker("class")}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor: colors.background,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <View style={{ flex: 1, flexDirection: "row", gap: 8, alignItems: "center" }}>
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                      {selectedFormClass?.name ?? "Selecione uma turma"}
                    </Text>
                    { selectedFormClass ? (
                      <ClassGenderBadge gender={selectedFormClass.gender} />
                    ) : null}
                  </View>
                    <MaterialCommunityIcons
                      name="chevron-down"
                      size={18}
                      color={colors.muted}
                      style={{
                        transform: [
                          { rotate: showFormClassPicker ? "180deg" : "0deg" },
                        ],
                      }}
                    />
                </Pressable>
              </View>
            </View>
          </View>
          <AnchoredDropdown
            visible={showFormUnitPickerContent}
            layout={formUnitTriggerLayout}
            container={formContainerWindow}
            animationStyle={formUnitPickerAnimStyle}
            zIndex={410}
            maxHeight={220}
            nestedScrollEnabled
            scrollContentStyle={{ padding: 8, gap: 6 }}
            onRequestClose={closeFormPickers}
            interactiveRefs={[formUnitTriggerRef, formClassTriggerRef]}
          >
            {[
              { label: "Selecione uma unidade", value: "" },
              { label: "Todas as unidades", value: ALL_UNITS_VALUE },
              ...unitOptions.map((unit) => ({ label: unit, value: unit })),
            ].map((option) => {
              const active = formUnit === option.value;
              return (
                <TrainingAnchoredDropdownOption
                  key={option.value || "unit-empty"}
                  active={active}
                  onPress={() => {
                    setClassId("");
                    setFormUnit(option.value);
                    closeFormPickers();
                  }}
                >
                  <Text
                    style={{
                      color: active ? colors.primaryText : colors.text,
                      fontSize: 14,
                      fontWeight: active ? "700" : "500",
                    }}
                  >
                    {option.label}
                  </Text>
                </TrainingAnchoredDropdownOption>
              );
            })}
          </AnchoredDropdown>
          <AnchoredDropdown
            visible={showFormClassPickerContent}
            layout={formClassTriggerLayout}
            container={formContainerWindow}
            animationStyle={formClassPickerAnimStyle}
            zIndex={410}
            maxHeight={240}
            nestedScrollEnabled
            scrollContentStyle={{ padding: 8, gap: 6 }}
            onRequestClose={closeFormPickers}
            interactiveRefs={[formUnitTriggerRef, formClassTriggerRef]}
          >
            { classOptionsForForm.length ? (
              classOptionsForForm.map((item) => {
                const active = classId === item.id;
                return (
                  <TrainingAnchoredDropdownOption
                    key={item.id}
                    active={active}
                    onPress={() => {
                      setClassId(item.id);
                      closeFormPickers();
                    }}
                  >
                    <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                      <Text
                        style={{
                          color: active ? colors.primaryText : colors.text,
                          fontSize: 14,
                          fontWeight: active ? "700" : "500",
                        }}
                      >
                        {item.name}
                      </Text>
                      <ClassGenderBadge gender={item.gender} />
                    </View>
                  </TrainingAnchoredDropdownOption>
                );
              })
            ) : (
              <View style={{ padding: 10 }}>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {formUnit ? "Nenhuma turma cadastrada." : "Selecione uma unidade."}
                </Text>
              </View>
            )}
          </AnchoredDropdown>

          <TextInput
            placeholder="Título do planejamento"
            value={title}
            onChangeText={setTitle}
            placeholderTextColor={colors.placeholder}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              padding: 10,
              borderRadius: 10,
              backgroundColor: colors.inputBg,
              color: colors.inputText,
            }}
          />
          <View style={planningBlockListStyle}>
            {planningBlockKeys.map((blockKey) => (
              <PlanningBlockActivityCards
                key={blockKey}
                blockKey={blockKey}
                activities={planningActivities[blockKey] ?? []}
                manualText={planningBlockText[blockKey] ?? ""}
                duration={
                  blockKey === "warmup"
                    ? warmupTime
                    : blockKey === "main"
                      ? mainTime
                      : cooldownTime
                }
                durationPlaceholder={
                  blockKey === "warmup" ? "10:00" : blockKey === "main" ? "01:30" : "05:00"
                }
                durationFormat={blockKey === "main" ? "clock" : "duration"}
                onAdd={handleOpenPlanningLibrary}
                onView={handleViewPlanningActivity}
                onRemove={handleRemovePlanningActivity}
                onManualTextChange={
                  blockKey === "warmup"
                    ? setWarmup
                    : blockKey === "main"
                      ? setMain
                      : setCooldown
                }
                onManualLineRemove={handleRemoveManualPlanningLine}
                onDurationChange={
                  blockKey === "warmup"
                    ? setWarmupTime
                    : blockKey === "main"
                      ? setMainTime
                      : setCooldownTime
                }
              />
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={saveButtonLabel}
            accessibilityState={{ disabled: !canSaveCurrentForm }}
            onPress={handleSavePress}
            disabled={!canSaveCurrentForm}
            style={{
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: canSaveCurrentForm
                ? colors.primaryBg
                : colors.primaryDisabledBg,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: canSaveCurrentForm ? colors.primaryText : colors.secondaryText,
                fontWeight: "700",
              }}
            >
              {saveButtonLabel}
            </Text>
          </Pressable>
          {editingId ? (
            <Button
              label="Cancelar edicao"
              variant="secondary"
              onPress={() => {
                setEditingId(null);
                setEditingCreatedAt(null);
                setEditingTemplateId(null);
                setEditingTemplateCreatedAt(null);
                setFormMode("plan");
                setTitle("");
                setTagsText("");
                setWarmup("");
                setMain("");
                setCooldown("");
                resetPlanningActivities();
                setWarmupTime("");
                setMainTime("");
                setCooldownTime("");
                setFormUnit("");
                closeFormPickers();
              }}
            />
              ) : null}
            </View>
        </View>
        </>
        )}

        {planningTab === "modelos" && (
        <View style={getSectionCardStyle(colors, "info")}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
            Modelos prontos
          </Text>
          <Text style={{ color: colors.muted }}>Escolha a faixa etária</Text>
          <FadeHorizontalScroll
            fadeColor={colors.card}
            contentContainerStyle={{ flexDirection: "row", gap: 8 }}
          >
            <Pressable
              onPress={() => setTemplateAgeBand("")}
              style={{
                paddingVertical: 4,
                paddingHorizontal: 8,
                borderRadius: 8,
                backgroundColor: templateAgeBand
                  ? colors.secondaryBg
                  : colors.primaryBg,
              }}
            >
              <Text
                style={{
                  color: templateAgeBand ? colors.text : colors.primaryText,
                  fontSize: 12,
                }}
              >
                Todas
              </Text>
            </Pressable>
            {ageBands.map((band) => {
              const active = band === templateAgeBand;
              return (
                <Pressable
                  key={band}
                  onPress={() => setTemplateAgeBand(band)}
                  style={{
                    paddingVertical: 4,
                    paddingHorizontal: 8,
                    borderRadius: 8,
                    backgroundColor: active ? colors.primaryBg : colors.secondaryBg,
                  }}
                >
                  <Text style={{ color: active ? colors.primaryText : colors.text, fontSize: 12 }}>
                    {band}
                  </Text>
                </Pressable>
              );
            })}
          </FadeHorizontalScroll>
          <Pressable
            onPress={() => {
              if (!templates.length) return;
              animateLayout();
              setShowTemplates((prev) => !prev);
            }}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 14,
              backgroundColor: templates.length ? colors.primaryBg : colors.secondaryBg,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: templates.length ? colors.primaryText : colors.text,
                fontWeight: "700",
                fontSize: 14,
              }}
            >
              {showTemplates ? "Esconder modelos" : "Abrir modelos"} (
              {templates.length})
            </Text>
          </Pressable>
            { showTemplatesContent ? (
              <Animated.View
                style={templatesAnimStyle}
              >
                { templates.length ? (
                  <>
                    <Text style={{ color: colors.muted }}>Para a faixa selecionada</Text>
                    <FlatList
                      data={templates}
                      keyExtractor={templateKeyExtractor}
                      renderItem={renderTemplateItem}
                      style={{ maxHeight: 280 }}
                      contentContainerStyle={{ gap: 8 }}
                      nestedScrollEnabled
                      showsVerticalScrollIndicator
                      initialNumToRender={12}
                      windowSize={7}
                      maxToRenderPerBatch={12}
                      removeClippedSubviews={true}
                    />
                  </>
                ) : (
                  <Text style={{ color: colors.muted }}>
                    Nenhum modelo para essa faixa etária.
                  </Text>
                )}
              </Animated.View>
          ) : null}
        </View>
        )}

        {planningTab === "salvos" && (
        <View
          style={[
            getSectionCardStyle(colors, "warning"),
            { borderLeftWidth: 1, borderLeftColor: colors.border },
          ]}
        >
          <Pressable
            onPress={() => {
              animateLayout();
              setShowSavedPlans((prev) => !prev);
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              paddingVertical: 6,
              paddingHorizontal: 8,
              borderRadius: 12,
              backgroundColor: colors.inputBg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
                Planos salvos
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {filteredItems.length}
              </Text>
            </View>
            <MaterialCommunityIcons
              name={showSavedPlans ? "chevron-down" : "chevron-right"}
              size={18}
              color={colors.muted}
            />
          </Pressable>

          { showSavedPlansContent ? (
            <Animated.View style={savedPlansAnimStyle}>
              <View style={{ gap: 10, marginTop: 10, marginBottom: 14 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    paddingHorizontal: 12,
                    minHeight: 46,
                    borderRadius: 14,
                    backgroundColor: colors.inputBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Ionicons name="search" size={18} color={colors.muted} />
                  <TextInput
                    value={savedPlanSearch}
                    onChangeText={setSavedPlanSearch}
                    placeholder="Buscar por turma, foco, unidade ou data..."
                    placeholderTextColor={colors.muted}
                    style={{
                      flex: 1,
                      color: colors.text,
                      fontSize: 14,
                      outlineStyle: "none" as any,
                    }}
                  />
                  {savedPlanSearch.trim() ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Limpar busca"
                      onPress={() => setSavedPlanSearch("")}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 15,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: colors.secondaryBg,
                      }}
                    >
                      <Ionicons name="close" size={16} color={colors.text} />
                    </Pressable>
                  ) : null}
                </View>

                <FadeHorizontalScroll>
                  <View style={{ flexDirection: "row", gap: 8, paddingVertical: 2 }}>
                    {[
                      {
                        id: "__all__",
                        label: "Todas as turmas",
                        count: items.length,
                        detail: "",
                      },
                      ...savedPlanClassOptions,
                    ].map((option) => {
                      const active = savedPlanClassFilter === option.id;
                      return (
                        <Pressable
                          key={option.id}
                          accessibilityRole="button"
                          accessibilityLabel={`Filtrar ${option.label}`}
                          onPress={() => setSavedPlanClassFilter(option.id)}
                          style={{
                            minHeight: 36,
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderRadius: 999,
                            backgroundColor: active ? colors.primaryBg : colors.secondaryBg,
                            borderWidth: 1,
                            borderColor: active ? "transparent" : colors.border,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <Text
                            style={{
                              color: active ? colors.primaryText : colors.text,
                              fontWeight: "800",
                              fontSize: 12,
                            }}
                          >
                            {option.label}
                          </Text>
                          <Text
                            style={{
                              color: active ? colors.primaryText : colors.muted,
                              fontWeight: "700",
                              fontSize: 11,
                            }}
                          >
                            {option.count}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </FadeHorizontalScroll>
              </View>
              { groupedSavedPlans.length ? (
                <View style={{ gap: 16 }}>
                  {groupedSavedPlans.map((group) => (
                    <View key={group.key} style={{ gap: 10 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <View
                          style={{
                            paddingVertical: 3,
                            paddingHorizontal: 10,
                            borderRadius: 999,
                            backgroundColor: colors.inputBg,
                          }}
                        >
                          <Text
                            style={{
                              color: colors.text,
                              fontWeight: "700",
                              fontSize: 11,
                            }}
                          >
                            Semana {group.label}
                          </Text>
                        </View>
                        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                        <Text style={{ color: colors.muted, fontSize: 12 }}>
                          {group.items.length} {group.items.length === 1 ? "plano" : "planos"}
                        </Text>
                      </View>
                      <View
                        style={{
                          flexDirection: viewportWidth >= 760 ? "row" : "column",
                          flexWrap: "wrap",
                          gap: 12,
                        }}
                      >
                        {group.items.map((plan) => (
                          <PlanRow
                            key={plan.id}
                            plan={plan}
                            onOpenActions={handleOpenPlanActions}
                            onApply={handleApplyPlan}
                            onView={handleViewPlan}
                          />
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={{ color: colors.muted }}>
                  Nenhum planejamento encontrado para os filtros selecionados.
                </Text>
              )}
            </Animated.View>
          ) : null}
        </View>
        )}
      </ScrollView>

      {planningTab !== "formulario" ? (
        <>
          <Pressable
            onPress={() => setShowTrainingFabMenu((current) => !current)}
            style={{
              ...(Platform.OS === "web"
                ? ({ position: "fixed", right: trainingFabRight, bottom: trainingFabBottom } as any)
                : { position: "absolute" as const, right: trainingFabRight, bottom: trainingFabBottom }),
              width: 56,
              height: 56,
              borderRadius: 28,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.primaryBg,
              borderWidth: 1,
              borderColor: colors.border,
              zIndex: 3200,
              ...shadow.elevated,
            }}
          >
            <Animated.View
              style={{
                transform: [{ rotate: trainingFabRotate }, { scale: trainingFabScale }],
              }}
            >
              <Ionicons name="add" size={24} color={colors.primaryText} />
            </Animated.View>
          </Pressable>

          <TrainingFabMenu
            visible={showTrainingFabMenu}
            importBusy={false}
            anchorRight={trainingFabRight}
            anchorBottom={trainingFabBottom}
            onClose={() => setShowTrainingFabMenu(false)}
            onCreatePress={() => {
              setShowTrainingFabMenu(false);
              setShowTrainingSessionCreate(true);
            }}
            onImportPress={() => {
              setShowTrainingFabMenu(false);
              router.push({ pathname: "/training/import" });
            }}
          />
        </>
      ) : null}
      </KeyboardAvoidingView>
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
      {selectedPlan ? (
        <ModalSheet
          visible
          onClose={() => setSelectedPlan(null)}
          cardStyle={[selectedPlanCardStyle, { paddingBottom: 12 }]}
          position="center"
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1, gap: 6, paddingRight: 8 }}>
              <Text
                numberOfLines={2}
                style={{ fontSize: 20, fontWeight: "900", color: colors.text }}
              >
                {getSavedPlanDisplayTitle(selectedPlan)}
              </Text>
              <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 13 }}>
                {[getClassName(selectedPlan.classId), selectedPlanScheduleText]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                setSelectedPlan(null);
              }}
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
            <TrainingPlanDetailsModalContent
              plan={selectedPlan}
            />
          </Suspense>
        </ModalSheet>
      ) : null}
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
            Aplicar planejamento
          </Text>
          <Pressable
            onPress={requestCloseApplyModal}
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
            refs={{
              applyContainerRef,
              applyUnitTriggerRef,
              applyClassTriggerRef,
            }}
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
            canApply={canApply}
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
                    ? "Catálogo GoAtleta"
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
