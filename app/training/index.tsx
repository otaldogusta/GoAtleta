import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState } from "react";
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
  View
} from "react-native";
import { Pressable } from "../../src/ui/Pressable";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Calendar from "expo-calendar";

import {
  saveTrainingPlan,
  getTrainingPlans,
  getClasses,
  updateTrainingPlan,
  deleteTrainingPlan,
  getTrainingTemplates,
  saveTrainingTemplate,
  updateTrainingTemplate,
  deleteTrainingTemplate,
  getHiddenTemplates,
  hideTrainingTemplate,
} from "../../src/db/seed";
import type {
  ClassGroup,
  TrainingPlan,
  TrainingTemplate,
  HiddenTemplate,
} from "../../src/core/models";
import { trainingTemplates } from "../../src/core/trainingTemplates";
import { Button } from "../../src/ui/Button";
import { Card } from "../../src/ui/Card";
import { animateLayout } from "../../src/ui/animate-layout";
import { DatePickerModal } from "../../src/ui/DatePickerModal";
import { DateInput } from "../../src/ui/DateInput";
import { usePersistedState } from "../../src/ui/use-persisted-state";
import { notifyTrainingSaved } from "../../src/notifications";
import { useAppTheme } from "../../src/ui/app-theme";
import { useConfirmUndo } from "../../src/ui/confirm-undo";
import { useConfirmDialog } from "../../src/ui/confirm-dialog";
import { ConfirmCloseOverlay } from "../../src/ui/ConfirmCloseOverlay";
import { sortClassesByAgeBand } from "../../src/ui/sort-classes";
import { getSectionCardStyle } from "../../src/ui/section-styles";
import { useCollapsibleAnimation } from "../../src/ui/use-collapsible";
import { useModalCardStyle } from "../../src/ui/use-modal-card-style";
import { useSaveToast } from "../../src/ui/save-toast";
import { ModalSheet } from "../../src/ui/ModalSheet";
import { ScreenHeader } from "../../src/ui/ScreenHeader";
import { logAction } from "../../src/observability/breadcrumbs";
import { measure } from "../../src/observability/perf";
import { ClassGenderBadge } from "../../src/ui/ClassGenderBadge";

const toLines = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const formatDate = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR");
};

const formatShortDate = (value?: string) => {
  if (!value) return "";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }
  return formatDate(value);
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

const formatWeekdays = (days?: number[]) => {
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
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => token.length >= 3 && !stopwords.has(token));
};

const parseAgeBand = (value?: string) => {
  if (!value) return null;
  const match = value.match(/(\d+)\s*-\s*(\d+)/);
  if (match) {
    return { start: Number(match[1]), end: Number(match[2]) };
  }
  const single = value.match(/(\d+)/);
  if (single) {
    const age = Number(single[1]);
    return { start: age, end: age };
  }
  return null;
};

const getPiagetTags = (ageBand?: string) => {
  const range = parseAgeBand(ageBand);
  if (!range) return [];
  const start = range.start;
  if (start <= 2) {
    return [
      "sensorio-motor",
      "jogo de exercicio",
      "exploracao sensorial",
      "permanencia do objeto",
    ];
  }
  if (start <= 7) {
    return [
      "pre-operatorio",
      "jogo simbolico",
      "faz de conta",
      "linguagem",
    ];
  }
  if (start <= 11) {
    return [
      "operatorio concreto",
      "jogo de regras",
      "cooperacao",
      "logica concreta",
    ];
  }
  return [
    "operatorio formal",
    "jogo estrategico",
    "raciocinio abstrato",
    "hipotetico-dedutivo",
  ];
};

const getMethodologyTags = (ageBand?: string) => {
  const range = parseAgeBand(ageBand);
  if (!range) return [];
  const start = range.start;
  if (start <= 8) {
    return [
      "alfabetizacao motora",
      "jogo reduzido",
      "ludico",
      "coordenacao",
      "fundamentos basicos",
      "variedade motora",
    ];
  }
  if (start <= 11) {
    return [
      "fundamentos",
      "tomada de decisao",
      "jogo de regras",
      "controle de volume",
      "core e equilibrio",
      "volleyveilig",
    ];
  }
  return [
    "tecnica eficiente",
    "potencia controlada",
    "sistemas de jogo",
    "transicao defesa-ataque",
    "forca moderada",
    "prevencao de lesoes",
  ];
};

const getMethodologyTips = (ageBand?: string) => {
  const range = parseAgeBand(ageBand);
  if (!range) return [];
  const start = range.start;
  if (start <= 8) {
    return [
      "Sessao curta e ludica (45-60 min)",
      "Priorize correr, saltar, lancar, receber",
      "Jogo 1x1 ou 2x2 com bola leve",
      "Sem carga externa, foco em tecnica",
    ];
  }
  if (start <= 11) {
    return [
      "2-3 sessoes/semana com fundamentos",
      "Aquecimento preventivo simples (core e equilibrio)",
      "Jogo 2x2 e 3x3 com regras simples",
      "Controle de saltos e pausas ativas",
    ];
  }
  return [
    "3 sessoes/semana, 60-90 min",
    "Volleyveilig 2x/semana + mobilidade",
    "Forca 50-70% 1RM com progressao leve",
    "Monitorar saltos e PSE",
  ];
};

export default function TrainingList() {
  const { colors } = useAppTheme();
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
  const openForm =
    typeof params.openForm === "string" ? params.openForm === "1" : false;
  const applyPlanId =
    typeof params.applyPlanId === "string" ? params.applyPlanId : "";
  const viewPlanId =
    typeof params.viewPlanId === "string" ? params.viewPlanId : "";
  const targetDate =
    targetDateRaw && !Number.isNaN(new Date(targetDateRaw).getTime())
      ? targetDateRaw
      : "";
  const [title, setTitle] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [warmup, setWarmup] = useState("");
  const [main, setMain] = useState("");
  const [cooldown, setCooldown] = useState("");
  const [warmupTime, setWarmupTime] = useState("");
  const [mainTime, setMainTime] = useState("");
  const [cooldownTime, setCooldownTime] = useState("");
  const [items, setItems] = useState<TrainingPlan[]>([]);
  const [templateItems, setTemplateItems] = useState<TrainingTemplate[]>([]);
  const [hiddenTemplates, setHiddenTemplates] = useState<HiddenTemplate[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [classId, setClassId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCreatedAt, setEditingCreatedAt] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = usePersistedState<boolean>(
    "training_show_templates_v1",
    false
  );
  const {
    animatedStyle: templatesAnimStyle,
    isVisible: showTemplatesContent,
  } = useCollapsibleAnimation(showTemplates);
  const [showAllClasses, setShowAllClasses] = usePersistedState<boolean>(
    "training_show_all_classes_v1",
    false
  );
  const [selectedPlan, setSelectedPlan] = useState<TrainingPlan | null>(null);
  const [showForm, setShowForm] = usePersistedState<boolean>(
    "training_show_form_v1",
    false
  );
  const [showSavedPlans, setShowSavedPlans] = usePersistedState<boolean>(
    "training_show_saved_plans_v1",
    true
  );
  const {
    animatedStyle: savedPlansAnimStyle,
    isVisible: showSavedPlansContent,
  } = useCollapsibleAnimation(showSavedPlans);
  const [formY, setFormY] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const [scrollRequested, setScrollRequested] = useState(false);
  const {
    animatedStyle: formAnimStyle,
    isVisible: showFormContent,
  } = useCollapsibleAnimation(showForm);
  const [templateAgeBand, setTemplateAgeBand] = useState("");
  const [formMode, setFormMode] = useState<"plan" | "template">("plan");
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editingTemplateCreatedAt, setEditingTemplateCreatedAt] = useState<string | null>(null);
  const [templateEditorSource, setTemplateEditorSource] = useState<"built" | "custom">(
    "custom"
  );
  const [templateEditorTemplateId, setTemplateEditorTemplateId] = useState<string | null>(null);
  const [renameTemplateId, setRenameTemplateId] = useState<string | null>(null);
  const [renameTemplateText, setRenameTemplateText] = useState("");
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [showTemplateCloseConfirm, setShowTemplateCloseConfirm] = useState(false);
  const [templateEditorId, setTemplateEditorId] = useState<string | null>(null);
  const [templateEditorCreatedAt, setTemplateEditorCreatedAt] = useState<string | null>(null);
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateAge, setTemplateAge] = useState("");
  const [templateTags, setTemplateTags] = useState("");
  const [templateWarmup, setTemplateWarmup] = useState("");
  const [templateMain, setTemplateMain] = useState("");
  const [templateCooldown, setTemplateCooldown] = useState("");
  const [templateWarmupTime, setTemplateWarmupTime] = useState("");
  const [templateMainTime, setTemplateMainTime] = useState("");
  const [templateCooldownTime, setTemplateCooldownTime] = useState("");
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
  const [templateEditorComposerHeight, setTemplateEditorComposerHeight] =
    useState(0);
  const [templateEditorKeyboardHeight, setTemplateEditorKeyboardHeight] =
    useState(0);
  const [applyUnit, setApplyUnit] = useState("");
  const [applyClassId, setApplyClassId] = useState("");
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showApplyCloseConfirm, setShowApplyCloseConfirm] = useState(false);
  const [applyPlan, setApplyPlan] = useState<TrainingPlan | null>(null);
  const [applyDays, setApplyDays] = useState<number[]>([]);
  const [applyDate, setApplyDate] = useState("");
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

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === classId),
    [classes, classId]
  );

  const sortedClasses = useMemo(
    () => sortClassesByAgeBand(classes),
    [classes]
  );

  const unitLabel = (value?: string) =>
    value && value.trim() ? value.trim() : "Sem unidade";

  const unitOptions = useMemo(() => {
    const units = new Set<string>();
    classes.forEach((item) => {
      units.add(unitLabel(item.unit));
    });
    return Array.from(units).sort((a, b) => a.localeCompare(b));
  }, [classes]);

  const classOptionsForUnit = useMemo(() => {
    if (!applyUnit) return sortedClasses;
    return sortedClasses.filter((item) => unitLabel(item.unit) === applyUnit);
  }, [applyUnit, sortedClasses]);

  useEffect(() => {
    if (!applyPlan) return;
    const defaultClass = classes.find((item) => item.id === applyPlan.classId);
    const targetClass = classes.find((item) => item.id === targetClassId);
    const resolvedClass = targetClass ?? defaultClass;
    const resolvedClassId = resolvedClass?.id ?? applyPlan.classId;
    const resolvedUnit = unitLabel(resolvedClass?.unit);
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
      if (defaultCalendar?.id) return defaultCalendar.id;
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
    if (!classItem?.startTime) return;
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
      notes: `Treino aplicado para ${classItem.name}.`,
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
      if (item.ageBand) values.add(item.ageBand);
    });
    trainingTemplates.forEach((template) => {
      template.ageBands.forEach((band) => values.add(band));
    });
    return sortClassesByAgeBand(
      Array.from(values).map((band) => ({
        id: band,
        name: band,
        ageBand: band as ClassGroup["ageBand"],
      }))
    ).map((item) => item.ageBand);
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
    const currentDays = (applyPlan.applyDays ?? []).slice().sort((a, b) => a - b);
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
        ageBands: template.ageBands,
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
        ageBands: [template.ageBand],
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
    return visible.filter((template) =>
      template.ageBands.includes(templateAgeBand)
    );
  }, [templateAgeBand, templateItems, hiddenTemplates]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [classList, plans, templatesDb, hidden] = await Promise.all([
        getClasses(),
        getTrainingPlans(),
        getTrainingTemplates(),
        getHiddenTemplates(),
      ]);
      if (!alive) return;
      setClasses(classList);
      if (!classId && classList.length > 0 && !showForm) {
        setClassId(classList[0].id);
      }
      setTemplateItems(templatesDb);
      setHiddenTemplates(hidden);
      setItems(plans);
    })();
    return () => {
      alive = false;
    };
  }, [classId]);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = (event: any) => {
      const height = event?.endCoordinates?.height ?? 0;
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

  const filteredItems = useMemo(() => {
    return items;
  }, [items]);

  const sortedFilteredItems = useMemo(
    () =>
      filteredItems
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [filteredItems]
  );

  const getClassName = useCallback(
    (id: string) => classes.find((item) => item.id === id)?.name ?? "Turma",
    [classes]
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
                {template.source === "custom" ? (
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
              {renameTemplateId === template.id ? (
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
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Pressable
                      onPress={async () => {
                        if (!renameTemplateText.trim()) return;
                        await updateTrainingTemplate({
                          id: template.id,
                          title: renameTemplateText.trim(),
                          ageBand: template.ageBands[0],
                          tags: template.tags ?? [],
                          warmup: template.warmup ?? [],
                          main: template.main ?? [],
                          cooldown: template.cooldown ?? [],
                          warmupTime: template.warmupTime ?? "",
                          mainTime: template.mainTime ?? "",
                          cooldownTime: template.cooldownTime ?? "",
                          createdAt: template.createdAt ?? new Date().toISOString(),
                        });
                        const templatesDb = await getTrainingTemplates();
                        setTemplateItems(templatesDb);
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
        return (
          <Pressable
            onLongPress={() => onOpenActions(plan)}
            style={{
              gap: 8,
              padding: 12,
              borderRadius: 14,
              backgroundColor: colors.inputBg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
                {plan.title}
              </Text>
              <Text style={{ color: colors.muted }}>
                {getClassName(plan.classId)}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Criado em {formatDate(plan.createdAt)}
              </Text>
              {plan.applyDays?.length || plan.applyDate ? (
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  Aplicado:{" "}
                  {plan.applyDays?.length ? formatWeekdays(plan.applyDays) : ""}
                  {plan.applyDays?.length && plan.applyDate ? " • " : ""}
                  {plan.applyDate ? formatShortDate(plan.applyDate) : ""}
                </Text>
              ) : null}
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => onApply(plan)}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor: colors.primaryBg,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.primaryText, fontWeight: "700", fontSize: 12 }}>
                  Aplicar treino
                </Text>
              </Pressable>
              <Pressable
                onPress={() => onView(plan)}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor: colors.secondaryBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                  Ver planejamento
                </Text>
              </Pressable>
            </View>
          </Pressable>
        );
      }),
    [colors, formatDate, formatShortDate, formatWeekdays, getClassName]
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

  const suggestions = useMemo(() => {
    const planText = [
      title,
      warmup,
      main,
      cooldown,
    ].join(" ");
    const keywords = extractKeywords(planText);
    const keywordSet = new Set(keywords);
    const selectedAgeBand =
      classes.find((item) => item.id === classId)?.ageBand || templateAgeBand;
    const piagetTags = getPiagetTags(selectedAgeBand);
    const methodologyTags = getMethodologyTags(selectedAgeBand);

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
      ...piagetTags,
      ...methodologyTags,
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
  }, [cooldown, currentTags, main, tagCounts, title, warmup, classId, templateAgeBand, classes]);

  const templateSuggestions = useMemo(() => {
    const templateText = [
      templateTitle,
      templateWarmup,
      templateMain,
      templateCooldown,
    ].join(" ");
    const keywords = extractKeywords(templateText);
    const keywordSet = new Set(keywords);
    const selectedAgeBand = templateAge.trim() || templateAgeBand;
    const piagetTags = getPiagetTags(selectedAgeBand);

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

    const combined = [...piagetTags, ...fromExistingTags, ...fromTemplateText];
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

  const savePlan = async () => {
    if (!classId) return;
    const nowIso = new Date().toISOString();
    const plan: TrainingPlan = {
      id: editingId ?? "t_" + Date.now(),
      classId,
      title: title.trim() || "Treino sem titulo",
      tags: tagsText
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      warmup: toLines(warmup),
      main: toLines(main),
      cooldown: toLines(cooldown),
      warmupTime: warmupTime.trim(),
      mainTime: mainTime.trim(),
      cooldownTime: cooldownTime.trim(),
      applyDays: [],
      applyDate: "",
      createdAt: editingCreatedAt ?? nowIso,
    };

    if (editingId) {
      await measure("updateTrainingPlan", () => updateTrainingPlan(plan));
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
    setEditingId(null);
    setEditingCreatedAt(null);
    setFormMode("plan");
    setShowForm(false);
    await reload();
  };

  const saveTemplate = async () => {
    const band =
      selectedClass?.ageBand ||
      templateAgeBand ||
      (classes[0] ? classes[0].ageBand : "");
    if (!band) {
      Alert.alert("Selecione uma turma", "Defina a faixa etaria primeiro.");
      return;
    }
    const nowIso = new Date().toISOString();
    const template: TrainingTemplate = {
      id: editingTemplateId ?? "tpl_" + Date.now(),
      title: title.trim() || "Modelo sem titulo",
      ageBand: band,
      tags: tagsText
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
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
    const templatesDb = await getTrainingTemplates();
    setTemplateItems(templatesDb);
    setEditingTemplateId(null);
    setEditingTemplateCreatedAt(null);
    setFormMode("plan");
    setShowForm(false);
    showSaveToast({ message: "Modelo salvo com sucesso.", variant: "success" });
  };

  const onEdit = (plan: TrainingPlan) => {
    setEditingId(plan.id);
    setEditingCreatedAt(plan.createdAt);
    setTitle(plan.title);
    setTagsText(plan.tags?.join(", ") ?? "");
    setWarmup(plan.warmup.join("\n"));
    setMain(plan.main.join("\n"));
    setCooldown(plan.cooldown.join("\n"));
    setWarmupTime(plan.warmupTime);
    setMainTime(plan.mainTime);
    setCooldownTime(plan.cooldownTime);
    setClassId(plan.classId);
    setFormMode("plan");
    setShowForm(true);
    setScrollRequested(true);
  };

  const onDelete = (plan: TrainingPlan) => {
    confirm({
      title: "Excluir treino?",
      message: "Essa acao pode ser desfeita por alguns segundos.",
      confirmLabel: "Excluir",
      undoMessage: "Treino excluido. Deseja desfazer?",
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
        logAction("Excluir treino", { planId: plan.id, classId: plan.classId });
      },
      onUndo: async () => {
        await reload();
      },
    });
  };

  const pickClassIdForAgeBand = useCallback(
    (band?: string) => {
      if (!band) return "";
      return classes.find((item) => item.ageBand === band)?.id ?? "";
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
    source?: "built" | "custom";
    createdAt?: string;
  }) => {
    setEditingId(null);
    setEditingCreatedAt(null);
    setTitle(template.title);
    setTagsText(template.tags.join(", "));
    setWarmup(template.warmup.join("\n"));
    setMain(template.main.join("\n"));
    setCooldown(template.cooldown.join("\n"));
    setWarmupTime(template.warmupTime);
    setMainTime(template.mainTime);
    setCooldownTime(template.cooldownTime);
    setShowForm(true);
    setScrollRequested(true);
  }, []);

  const useTemplateAsPlan = useCallback((template: {
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
    source?: "built" | "custom";
    createdAt?: string;
  }) => {
    setFormMode("plan");
    setClassId(
      templateAgeBand ? pickClassIdForAgeBand(templateAgeBand) : ""
    );
    applyTemplate(template);
  }, [applyTemplate, pickClassIdForAgeBand, templateAgeBand]);

  const duplicatePlan = (plan: TrainingPlan) => {
    useTemplateAsPlan({
      id: "dup_" + Date.now(),
      title: plan.title + " (copia)",
      tags: plan.tags ?? [],
      warmup: plan.warmup ?? [],
      main: plan.main ?? [],
      cooldown: plan.cooldown ?? [],
      warmupTime: plan.warmupTime ?? "",
      mainTime: plan.mainTime ?? "",
      cooldownTime: plan.cooldownTime ?? "",
      ageBands: ["8-9", "10-12", "13-15", "16-18"],
      source: "custom",
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
    source?: "built" | "custom";
    createdAt?: string;
  }) => {
    setEditingTemplateId(template.source === "custom" ? template.id : null);
    setEditingTemplateCreatedAt(
      template.source === "custom" ? template.createdAt ?? null : null
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
      message: "Essa acao pode ser desfeita por alguns segundos.",
      confirmLabel: "Excluir",
      undoMessage: "Modelo excluido. Deseja desfazer?",
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
          const templatesDb = await getTrainingTemplates();
          setTemplateItems(templatesDb);
          logAction("Excluir modelo", { templateId: id, source });
        } else {
          await measure("hideTrainingTemplate", () => hideTrainingTemplate(id));
          const hidden = await getHiddenTemplates();
          setHiddenTemplates(hidden);
          logAction("Ocultar modelo", { templateId: id, source });
        }
      },
      onUndo: async () => {
        const [templatesDb, hidden] = await Promise.all([
          getTrainingTemplates(),
          getHiddenTemplates(),
        ]);
        setTemplateItems(templatesDb);
        setHiddenTemplates(hidden);
      },
    });
  };

  const duplicateTemplateFromEditor = async () => {
    const band = templateAge.trim() || templateAgeBand;
    if (!band) {
      Alert.alert("Defina a faixa etaria", "Informe a faixa etaria do modelo.");
      return;
    }
    const copy: TrainingTemplate = {
      id: "tpl_" + Date.now(),
      title: (templateTitle.trim() || "Modelo sem titulo") + " (copia)",
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
    const templatesDb = await getTrainingTemplates();
    setTemplateItems(templatesDb);
    logAction("Duplicar modelo", { templateId: copy.id, ageBand: copy.ageBand });
    Alert.alert("Modelo duplicado", "Aparece em Modelos prontos.");
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
    source?: "built" | "custom";
    createdAt?: string;
  }) => {
    const isCustom = template.source === "custom";
    const nextAge = template.ageBands[0] || templateAgeBand;
    setTemplateEditorId(isCustom ? template.id : null);
    setTemplateEditorCreatedAt(isCustom ? template.createdAt ?? null : null);
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

  const closeApplyModal = () => {
    setShowApplyModal(false);
    setShowApplyCloseConfirm(false);
    setApplyPlan(null);
    setShowApplyCalendar(false);
    setApplySnapshot(null);
  };

  const requestCloseApplyModal = () => {
    if (isApplyDirty) {
      setShowApplyCloseConfirm(true);
      return;
    }
    closeApplyModal();
  };

  const saveTemplateEditor = async () => {
    const ageBand = templateAge.trim() || templateAgeBand;
    if (!ageBand) {
      Alert.alert("Defina a faixa etaria", "Informe a faixa etaria do modelo.");
      return;
    }
    const nowIso = new Date().toISOString();
    const template: TrainingTemplate = {
      id: templateEditorId ?? "tpl_" + Date.now(),
      title: templateTitle.trim() || "Modelo sem titulo",
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
    const templatesDb = await getTrainingTemplates();
    setTemplateItems(templatesDb);
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
      "Aquecimento " + (plan.warmupTime ? "(" + plan.warmupTime + ")" : ""),
      plan.warmup.length ? "- " + plan.warmup.join("\n- ") : "- Sem itens",
      "",
      "Parte principal " + (plan.mainTime ? "(" + plan.mainTime + ")" : ""),
      plan.main.length ? "- " + plan.main.join("\n- ") : "- Sem itens",
      "",
      "Volta a calma " + (plan.cooldownTime ? "(" + plan.cooldownTime + ")" : ""),
      plan.cooldown.length ? "- " + plan.cooldown.join("\n- ") : "- Sem itens",
    ];
    if (plan.tags?.length) {
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
      Alert.alert("Selecione uma turma", "Defina a faixa etaria primeiro.");
      return;
    }
    const nowIso = new Date().toISOString();
    const template: TrainingTemplate = {
      id: "tpl_" + Date.now(),
      title: title.trim() || "Modelo sem titulo",
      ageBand: band,
      tags: tagsText
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      warmup: toLines(warmup),
      main: toLines(main),
      cooldown: toLines(cooldown),
      warmupTime: warmupTime.trim(),
      mainTime: mainTime.trim(),
      cooldownTime: cooldownTime.trim(),
      createdAt: nowIso,
    };
    await saveTrainingTemplate(template);
    const templatesDb = await getTrainingTemplates();
    setTemplateItems(templatesDb);
    Alert.alert("Modelo salvo", "Agora ele aparece em Modelos prontos.");
  };

  const savePlanAsTemplate = async (plan: TrainingPlan) => {
    const band =
      classes.find((item) => item.id === plan.classId)?.ageBand ||
      templateAgeBand ||
      (classes[0] ? classes[0].ageBand : "");
    if (!band) {
      Alert.alert("Selecione uma turma", "Defina a faixa etaria primeiro.");
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
    const templatesDb = await getTrainingTemplates();
    setTemplateItems(templatesDb);
    Alert.alert("Modelo salvo", "Agora ele aparece em Modelos prontos.");
  };

  const isFormDirty =
    title.trim() ||
    tagsText.trim() ||
    warmup.trim() ||
    main.trim() ||
    cooldown.trim() ||
    warmupTime.trim() ||
    mainTime.trim() ||
    cooldownTime.trim() ||
    editingId;

  const hasFormContent = Boolean(
    title.trim() ||
      tagsText.trim() ||
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

  const confirmCloseForm = () => {
    if (!isFormDirty) {
      setShowForm(false);
      return;
    }
    confirmDialog({
      title: "Sair sem salvar?",
      message: "Voce tem alteracoes nao salvas.",
      confirmLabel: "Descartar",
      cancelLabel: "Continuar",
      onConfirm: () => {
        setShowForm(false);
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
        setWarmupTime("");
        setMainTime("");
        setCooldownTime("");
      },
    });
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
    if (!showForm || !scrollRequested) return;
    scrollToForm();
    setScrollRequested(false);
  }, [formY, showForm, scrollRequested]);

  useEffect(() => {
    if (!openForm) return;
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
    setWarmupTime("");
    setMainTime("");
    setCooldownTime("");
    setShowForm(true);
    setScrollRequested(true);
    if (targetClassId) {
      setClassId(targetClassId);
    }
  }, [openForm, targetClassId, setShowForm]);

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
    setWarmupTime("");
    setMainTime("");
    setCooldownTime("");
    setShowForm(true);
    setScrollRequested(true);
    if (pendingPlanCreate.classId) {
      setClassId(pendingPlanCreate.classId);
    }
    setPendingPlanCreate(null);
  }, [pendingPlanCreate, setPendingPlanCreate, setShowForm]);

  const handleRenameTemplate = useCallback((id: string, title: string) => {
    setRenameTemplateId(id);
    setRenameTemplateText(title);
  }, []);

  const handleUseTemplate = useCallback(
    (template: (typeof templates)[number]) => {
      useTemplateAsPlan(template);
    },
    [useTemplateAsPlan]
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

  const renderPlanItem = useCallback(
    ({ item }: { item: TrainingPlan }) => (
      <PlanRow
        plan={item}
        onOpenActions={handleOpenPlanActions}
        onApply={handleApplyPlan}
        onView={handleViewPlan}
      />
    ),
    [PlanRow, handleApplyPlan, handleOpenPlanActions, handleViewPlan]
  );

  const planKeyExtractor = useCallback(
    (item: TrainingPlan) => String(item.id),
    []
  );

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: 24, gap: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader
          title="Treinos"
          subtitle="Aquecimento, parte principal e volta a calma"
        />

        <View
          onLayout={(event) => setFormY(event.nativeEvent.layout.y)}
          style={[
            getSectionCardStyle(colors, "success"),
            { borderRadius: 20, borderLeftWidth: 3, borderLeftColor: "#ffffff" },
          ]}
        >
          <Pressable
            onPress={() =>
              showForm
                ? confirmCloseForm()
                : (() => {
                    setEditingId(null);
                    setEditingCreatedAt(null);
                    setEditingTemplateId(null);
                    setEditingTemplateCreatedAt(null);
                    setFormMode("plan");
                    setClassId("");
                    setTitle("");
                    setTagsText("");
                    setWarmup("");
                    setMain("");
                    setCooldown("");
                    setWarmupTime("");
                    setMainTime("");
                    setCooldownTime("");
                    setShowForm(true);
                  })()
            }
            style={{
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 14,
              backgroundColor: showForm ? colors.secondaryBg : colors.primaryBg,
              borderWidth: showForm ? 1 : 0,
              borderColor: colors.border,
            }}
          >
            <View style={{ gap: 4 }}>
              <Text
                style={{
                  color: showForm ? colors.text : colors.primaryText,
                  fontWeight: "700",
                  fontSize: 16,
                }}
              >
                {showForm ? "Fechar plano de aula" : "Criar plano de aula"}
              </Text>
              <Text style={{ color: showForm ? colors.muted : colors.primaryText, fontSize: 12 }}>
                {showForm ? "Ocultar formulario" : "Criar e salvar plano de aula"}
              </Text>
            </View>
          </Pressable>
          {showFormContent ? (
            <Animated.View
              style={[formAnimStyle, { gap: 10 }]}
            >
          <Text style={{ color: colors.muted }}>Selecione a turma</Text>
          {showAllClasses ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {sortedClasses.map((item) => {
                const active = item.id === classId;
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() =>
                          setClassId((prev) => (prev === item.id ? "" : item.id))
                        }
                        style={{
                          paddingVertical: 6,
                          paddingHorizontal: 10,
                          borderRadius: 10,
                          backgroundColor: active ? colors.primaryBg : colors.secondaryBg,
                        }}
                      >
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                        <Text style={{ color: active ? colors.primaryText : colors.text }}>
                          {item.name}
                        </Text>
                        <ClassGenderBadge gender={item.gender} />
                      </View>
                      </Pressable>
                    );
                  })}
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {sortedClasses.slice(0, 5).map((item) => {
                  const active = item.id === classId;
                    return (
                    <Pressable
                      key={item.id}
                      onPress={() =>
                        setClassId((prev) => (prev === item.id ? "" : item.id))
                      }
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                          borderRadius: 10,
                          backgroundColor: active ? colors.primaryBg : colors.secondaryBg,
                        }}
                      >
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                          <Text style={{ color: active ? colors.primaryText : colors.text }}>
                            {item.name}
                          </Text>
                          <ClassGenderBadge gender={item.gender} />
                        </View>
                      </Pressable>
                    );
                  })}
              </View>
            </ScrollView>
          )}
          {sortedClasses.length > 5 ? (
            <Pressable
              onPress={() => {
                animateLayout();
                setShowAllClasses((prev) => !prev);
              }}
              style={{ alignSelf: "flex-start", paddingVertical: 4 }}
            >
              <Text style={{ color: colors.primaryBg, fontWeight: "700" }}>
                {showAllClasses ? "Ver menos turmas" : "Ver mais turmas"}
              </Text>
            </Pressable>
          ) : null}

          <TextInput
            placeholder="Titulo do treino"
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
          <TextInput
            placeholder="Tags (opcional, separe por virgula)"
            value={tagsText}
            onChangeText={setTagsText}
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
          {suggestions.length > 0 && hasFormContent ? (
            <>
              <Text style={{ color: colors.muted, marginTop: 2 }}>Sugestoes</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {suggestions.map((tag) => (
                    <Pressable
                      key={tag}
                      onPress={() =>
                        setTagsText((prev) =>
                          prev.trim()
                            ? prev.trim().replace(/\s*,\s*$/, "") + ", " + tag
                            : tag
                        )
                      }
                      style={{
                        paddingVertical: 4,
                        paddingHorizontal: 10,
                        borderRadius: 999,
                        backgroundColor: colors.secondaryBg,
                      }}
                    >
                      <Text style={{ color: colors.text }}>{tag}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </>
          ) : null}
          {hasFormContent ? (
            (() => {
              const selectedAgeBand =
                classes.find((item) => item.id === classId)?.ageBand ||
                templateAgeBand;
              const tips = getMethodologyTips(selectedAgeBand);
              if (!tips.length) return null;
              return (
                <View
                  style={{
                    padding: 10,
                    borderRadius: 12,
                    backgroundColor: colors.inputBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    gap: 6,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                    Dicas da faixa etaria
                  </Text>
                  {tips.map((tip) => (
                    <Text key={tip} style={{ color: colors.muted, fontSize: 12 }}>
                      {"- " + tip}
                    </Text>
                  ))}
                </View>
              );
            })()
          ) : null}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TextInput
              placeholder="Aquecimento (1 por linha)"
              value={warmup}
              onChangeText={setWarmup}
              multiline
              placeholderTextColor={colors.placeholder}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: 8,
                paddingVertical: 14,
                borderRadius: 10,
                minHeight: 60,
                backgroundColor: colors.inputBg,
                textAlignVertical: "center",
                color: colors.inputText,
              }}
            />
            <TextInput
              placeholder="Tempo (ex: 10')"
              value={warmupTime}
              onChangeText={setWarmupTime}
              placeholderTextColor={colors.placeholder}
              style={{
                width: 110,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 10,
                borderRadius: 10,
                backgroundColor: colors.inputBg,
                color: colors.inputText,
              }}
            />
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TextInput
              placeholder="Parte principal (1 por linha)"
              value={main}
              onChangeText={setMain}
              multiline
              placeholderTextColor={colors.placeholder}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: 8,
                paddingVertical: 20,
                borderRadius: 10,
                minHeight: 80,
                backgroundColor: colors.inputBg,
                textAlignVertical: "center",
                color: colors.inputText,
              }}
            />
            <TextInput
              placeholder="Tempo (ex: 40')"
              value={mainTime}
              onChangeText={setMainTime}
              placeholderTextColor={colors.placeholder}
              style={{
                width: 110,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 10,
                borderRadius: 10,
                backgroundColor: colors.inputBg,
                color: colors.inputText,
              }}
            />
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TextInput
              placeholder="Volta a calma (1 por linha)"
              value={cooldown}
              onChangeText={setCooldown}
              multiline
              placeholderTextColor={colors.placeholder}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: 8,
                paddingVertical: 14,
                borderRadius: 10,
                minHeight: 60,
                backgroundColor: colors.inputBg,
                textAlignVertical: "center",
                color: colors.inputText,
              }}
            />
            <TextInput
              placeholder="Tempo (ex: 5')"
              value={cooldownTime}
              onChangeText={setCooldownTime}
              placeholderTextColor={colors.placeholder}
              style={{
                width: 110,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 10,
                borderRadius: 10,
                backgroundColor: colors.inputBg,
                color: colors.inputText,
              }}
            />
          </View>
          <Pressable
            onPress={formMode === "template" ? saveTemplate : savePlan}
            disabled={!hasFormContent}
            style={{
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: hasFormContent
                ? colors.primaryBg
                : colors.primaryDisabledBg,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: hasFormContent ? colors.primaryText : colors.secondaryText,
                fontWeight: "700",
              }}
            >
              {formMode === "template"
                ? "Salvar modelo"
                : editingId
                  ? "Salvar alteracoes"
                  : "Salvar treino"}
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
                setWarmup("");
                setMain("");
                setCooldown("");
                setWarmupTime("");
                setMainTime("");
                setCooldownTime("");
                setShowForm(false);
              }}
            />
              ) : null}
            </Animated.View>
          ) : null}
        </View>

        <View style={getSectionCardStyle(colors, "info")}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
            Modelos prontos
          </Text>
          <Text style={{ color: colors.muted }}>Escolha a faixa etaria</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 8 }}>
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
            </View>
          </ScrollView>
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
            {showTemplatesContent ? (
              <Animated.View
                style={templatesAnimStyle}
              >
                {templates.length ? (
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
                        maxToRenderBatch={12}
                      removeClippedSubviews
                    />
                  </>
                ) : (
                  <Text style={{ color: colors.muted }}>
                    Nenhum modelo para essa faixa etaria.
                  </Text>
                )}
              </Animated.View>
          ) : null}
        </View>

        <View style={getSectionCardStyle(colors, "warning")}>
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
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
              Treinos salvos
            </Text>
          </Pressable>

          {showSavedPlansContent ? (
            <Animated.View style={savedPlansAnimStyle}>
              <FlatList
                data={sortedFilteredItems}
                keyExtractor={planKeyExtractor}
                renderItem={renderPlanItem}
                scrollEnabled={false}
                contentContainerStyle={{ gap: 12 }}
                initialNumToRender={12}
                windowSize={7}
                  maxToRenderBatch={12}
                removeClippedSubviews
              />
            </Animated.View>
          ) : null}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
      <ModalSheet
        visible={showTemplateEditor}
        onClose={requestCloseTemplateEditor}
        cardStyle={[templateEditorCardStyle, { paddingBottom: 12 }]}
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
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
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
        <ScrollView
          contentContainerStyle={{
            gap: 10,
            paddingVertical: 10,
            paddingBottom:
              templateEditorComposerHeight +
              templateEditorKeyboardHeight +
              12,
          }}
          style={{ maxHeight: "94%" }}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
              <TextInput
                placeholder="Titulo do modelo"
                value={templateTitle}
                onChangeText={setTemplateTitle}
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
              <TextInput
                placeholder="Faixa etaria (ex: 10-12)"
                value={templateAge}
                onChangeText={setTemplateAge}
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
              <TextInput
                placeholder="Tags (opcional, separe por virgula)"
                value={templateTags}
                onChangeText={setTemplateTags}
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
              {templateSuggestions.length > 0 && hasTemplateContent ? (
                <>
                  <Text style={{ color: colors.muted, marginTop: 2 }}>Sugestoes</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {templateSuggestions.map((tag) => (
                        <Pressable
                          key={tag}
                          onPress={() =>
                            setTemplateTags((prev) =>
                              prev.trim()
                                ? prev.trim().replace(/\s*,\s*$/, "") + ", " + tag
                                : tag
                            )
                          }
                          style={{
                            paddingVertical: 4,
                            paddingHorizontal: 10,
                            borderRadius: 999,
                            backgroundColor: colors.secondaryBg,
                          }}
                        >
                          <Text style={{ color: colors.text }}>{tag}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                </>
              ) : null}
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TextInput
                  placeholder="Aquecimento (1 por linha)"
                  value={templateWarmup}
                  onChangeText={setTemplateWarmup}
                  multiline
                  placeholderTextColor={colors.placeholder}
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: colors.border,
                    paddingHorizontal: 8,
                    paddingVertical: 14,
                    borderRadius: 10,
                    minHeight: 60,
                    backgroundColor: colors.inputBg,
                    textAlignVertical: "center",
                    color: colors.inputText,
                  }}
                />
                <TextInput
                  placeholder="Tempo (ex: 10')"
                  value={templateWarmupTime}
                  onChangeText={setTemplateWarmupTime}
                  placeholderTextColor={colors.placeholder}
                style={{
                  width: 110,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 10,
                  borderRadius: 10,
                  backgroundColor: colors.inputBg,
                  color: colors.inputText,
                }}
              />
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TextInput
                  placeholder="Parte principal (1 por linha)"
                  value={templateMain}
                  onChangeText={setTemplateMain}
                  multiline
                  placeholderTextColor={colors.placeholder}
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: colors.border,
                    paddingHorizontal: 8,
                    paddingVertical: 20,
                    borderRadius: 10,
                    minHeight: 80,
                    backgroundColor: colors.inputBg,
                    textAlignVertical: "center",
                    color: colors.inputText,
                  }}
                />
                <TextInput
                  placeholder="Tempo (ex: 40')"
                  value={templateMainTime}
                  onChangeText={setTemplateMainTime}
                  placeholderTextColor={colors.placeholder}
                style={{
                  width: 110,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 10,
                  borderRadius: 10,
                  backgroundColor: colors.inputBg,
                  color: colors.inputText,
                }}
              />
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TextInput
                  placeholder="Volta a calma (1 por linha)"
                  value={templateCooldown}
                  onChangeText={setTemplateCooldown}
                  multiline
                  placeholderTextColor={colors.placeholder}
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: colors.border,
                    paddingHorizontal: 8,
                    paddingVertical: 14,
                    borderRadius: 10,
                    minHeight: 60,
                    backgroundColor: colors.inputBg,
                    textAlignVertical: "center",
                    color: colors.inputText,
                  }}
                />
                <TextInput
                  placeholder="Tempo (ex: 5')"
                  value={templateCooldownTime}
                  onChangeText={setTemplateCooldownTime}
                  placeholderTextColor={colors.placeholder}
                style={{
                  width: 110,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 10,
                  borderRadius: 10,
                  backgroundColor: colors.inputBg,
                  color: colors.inputText,
                }}
              />
              </View>
              <View
                onLayout={(event) => {
                  const next = Math.round(event.nativeEvent.layout.height);
                  if (next !== templateEditorComposerHeight) {
                    setTemplateEditorComposerHeight(next);
                  }
                }}
              >
                <Pressable
                  onPress={saveTemplateEditor}
                  disabled={!isTemplateEditorDirty}
                  style={{
                    paddingVertical: 10,
                    borderRadius: 14,
                    backgroundColor: isTemplateEditorDirty
                      ? colors.primaryBg
                      : colors.primaryDisabledBg,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: isTemplateEditorDirty
                        ? colors.primaryText
                        : colors.secondaryText,
                      fontWeight: "700",
                    }}
                  >
                    Salvar modelo
                  </Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  onPress={duplicateTemplateFromEditor}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: colors.secondaryBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700" }}>
                    Duplicar modelo
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
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
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: colors.dangerBg,
                    borderWidth: 1,
                    borderColor: colors.dangerBorder,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: colors.dangerText, fontWeight: "700" }}>
                    Excluir modelo
                  </Text>
                </Pressable>
              </View>
        </ScrollView>
      </ModalSheet>
      <ModalSheet
        visible={Boolean(selectedPlan)}
        onClose={() => setSelectedPlan(null)}
        cardStyle={[selectedPlanCardStyle, { paddingBottom: 12 }]}
        position="center"
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View style={{ gap: 4, paddingRight: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>
              {selectedPlan?.title}
            </Text>
            <Text style={{ color: colors.muted }}>
              {selectedPlan ? getClassName(selectedPlan.classId) : ""}
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
        <ScrollView
          contentContainerStyle={{ gap: 8, paddingVertical: 10 }}
          style={{ maxHeight: "94%" }}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
              <View
                style={{
                  padding: 10,
                  borderRadius: 12,
                  backgroundColor: colors.inputBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  gap: 6,
                }}
              >
                <Text style={{ fontWeight: "700", color: colors.text }}>
                  Aquecimento{" "}
                  {selectedPlan?.warmupTime ? "(" + selectedPlan.warmupTime + ")" : ""}
                </Text>
                <Text style={{ color: colors.text }}>
                  {selectedPlan?.warmup.length
                    ? selectedPlan.warmup.join(" - ")
                    : "Sem itens"}
                </Text>
              </View>
              <View
                style={{
                  padding: 10,
                  borderRadius: 12,
                  backgroundColor: colors.secondaryBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  gap: 6,
                }}
              >
                <Text style={{ fontWeight: "700", color: colors.text }}>
                  Parte principal{" "}
                  {selectedPlan?.mainTime ? "(" + selectedPlan.mainTime + ")" : ""}
                </Text>
                <Text style={{ color: colors.text }}>
                  {selectedPlan?.main.length
                    ? selectedPlan.main.join(" - ")
                    : "Sem itens"}
                </Text>
              </View>
              <View
                style={{
                  padding: 10,
                  borderRadius: 12,
                  backgroundColor: colors.inputBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  gap: 6,
                }}
              >
                <Text style={{ fontWeight: "700", color: colors.text }}>
                  Volta a calma{" "}
                  {selectedPlan?.cooldownTime
                    ? "(" + selectedPlan.cooldownTime + ")"
                    : ""}
                </Text>
                <Text style={{ color: colors.text }}>
                  {selectedPlan?.cooldown.length
                    ? selectedPlan.cooldown.join(" - ")
                    : "Sem itens"}
                </Text>
              </View>
              {selectedPlan?.tags?.length ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {selectedPlan.tags.map((tag) => (
                    <View
                      key={tag}
                      style={{
                        paddingVertical: 3,
                        paddingHorizontal: 8,
                        borderRadius: 999,
                        backgroundColor: colors.secondaryBg,
                      }}
                    >
                      <Text style={{ color: colors.text, fontSize: 12 }}>{tag}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
        </ScrollView>
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
            Aplicar treino
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
            <Text
              style={{ fontSize: 12, fontWeight: "700", color: colors.text }}
            >
              Fechar
            </Text>
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={{ gap: 10 }}
          style={{ maxHeight: "94%" }}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
          <Text style={{ color: colors.muted, fontSize: 12 }}>Unidade</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {unitOptions.map((unit) => {
                const active = applyUnit === unit;
                return (
                  <Pressable
                    key={unit}
                    onPress={() => setApplyUnit(unit)}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      borderRadius: 999,
                      backgroundColor: active ? colors.primaryBg : colors.secondaryBg,
                    }}
                  >
                    <Text style={{ color: active ? colors.primaryText : colors.text, fontSize: 12 }}>
                      {unit}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Turma</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {classOptionsForUnit.map((item) => {
                const active = applyClassId === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() =>
                      setApplyClassId((prev) =>
                        prev === item.id ? "" : item.id
                      )
                    }
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      borderRadius: 999,
                      backgroundColor: active ? colors.primaryBg : colors.secondaryBg,
                    }}
                  >
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      <Text style={{ color: active ? colors.primaryText : colors.text, fontSize: 12 }}>
                        {item.name}
                      </Text>
                      <ClassGenderBadge gender={item.gender} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Dias da semana</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {weekdays.map((day) => {
              const active = applyDays.includes(day.id);
              return (
                <Pressable
                  key={day.id}
                  onPress={() =>
                    setApplyDays((prev) =>
                      prev.includes(day.id)
                        ? prev.filter((value) => value !== day.id)
                        : [...prev, day.id].sort((a, b) => a - b)
                    )
                  }
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 999,
                    backgroundColor: active ? colors.primaryBg : colors.secondaryBg,
                  }}
                >
                  <Text style={{ color: active ? colors.primaryText : colors.text, fontSize: 12 }}>
                    {day.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Data especifica</Text>
          <DateInput
            value={applyDate}
            onChange={setApplyDate}
            placeholder="Selecione a data"
            onOpenCalendar={() => setShowApplyCalendar(true)}
          />
        </ScrollView>
        <Pressable
          onPress={async () => {
            if (!applyPlan || !applyClassId) return;
            if (!applyDays.length) {
              Alert.alert(
                "Selecione os dias",
                "Escolha pelo menos um dia da semana."
              );
              return;
            }
            if (!applyDate) {
              Alert.alert(
                "Informe a data",
                "Digite a data especifica do treino."
              );
              return;
            }
            if (Number.isNaN(new Date(applyDate).getTime())) {
              Alert.alert(
                "Data invalida",
                "Escolha uma data valida."
              );
              return;
            }
            if (isSameApply) {
              closeApplyModal();
              showSaveToast({
                message: "Planejamento ja adicionado.",
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
            const updated: TrainingPlan = {
              ...applyPlan,
              classId: applyClassId,
              applyDays,
              applyDate,
            };
            await measure("applyTrainingPlan", () => updateTrainingPlan(updated));
            await createCalendarEvent(updated);
            await reload();
            closeApplyModal();
            logAction("Aplicar treino", {
              planId: updated.id,
              classId: applyClassId,
              applyDate,
              daysCount: applyDays.length,
            });
            showSaveToast({
              message: "Treino aplicado com sucesso.",
              actionLabel: "Ver aula do dia",
              variant: "success",
              onAction: () => {
                router.push({
                  pathname: "/class/[id]/session",
                  params: { id: applyClassId, date: applyDate },
                });
              },
            });
          }}
          disabled={!canApply}
          style={{
            paddingVertical: 10,
            borderRadius: 12,
            backgroundColor: canApply
              ? colors.primaryBg
              : colors.primaryDisabledBg,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: canApply ? colors.primaryText : colors.secondaryText,
              fontWeight: "700",
            }}
          >
            Aplicar nessa turma
          </Text>
        </Pressable>
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
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View style={{ gap: 4, paddingRight: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>
              {actionPlan?.title ?? "Treino"}
            </Text>
            <Text style={{ color: colors.muted }}>
              {actionPlan ? getClassName(actionPlan.classId) : ""}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              setShowPlanActions(false);
              setActionPlan(null);
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
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>
              Fechar
            </Text>
          </Pressable>
        </View>
        <View style={{ gap: 8 }}>
          <Pressable
            onPress={() => {
              if (!actionPlan) return;
              onEdit(actionPlan);
              setShowPlanActions(false);
              setActionPlan(null);
            }}
            style={{
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: colors.primaryBg,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
              Editar treino
            </Text>
          </Pressable>
          <Pressable
            onPress={async () => {
              if (!actionPlan) return;
              await savePlanAsTemplate(actionPlan);
              setShowPlanActions(false);
              setActionPlan(null);
            }}
            style={{
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              Salvar como modelo
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (!actionPlan) return;
              duplicatePlan(actionPlan);
              setShowPlanActions(false);
              setActionPlan(null);
            }}
            style={{
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              Duplicar
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (!actionPlan) return;
              const target = actionPlan;
              setShowPlanActions(false);
              setActionPlan(null);
              setTimeout(() => {
                onDelete(target);
              }, 10);
            }}
            style={{
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: colors.dangerBg,
              borderWidth: 1,
              borderColor: colors.dangerBorder,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.dangerText, fontWeight: "700" }}>
              Excluir treino
            </Text>
          </Pressable>
        </View>
      </ModalSheet>
      <DatePickerModal
        visible={showApplyCalendar}
        value={applyDate}
        onChange={setApplyDate}
        onClose={() => setShowApplyCalendar(false)}
        closeOnSelect
      />
    </SafeAreaView>
  );
}

