import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import {
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
    KeyboardAvoidingView,
    Platform,
    RefreshControl,
    ScrollView,
    Text,
    TextInput,
  View,
  useWindowDimensions
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SUPABASE_URL } from "../../src/api/config";
import { createStudentInvite, revokeStudentAccess } from "../../src/api/student-invite";
import {
    removeStudentPhotoObject,
    uploadStudentPhoto,
} from "../../src/api/student-photo-storage";
import { useAuth } from "../../src/auth/auth";
import {
    compareClassesBySchedule,
    sortClassesBySchedule,
} from "../../src/core/class-schedule-sort";
import type { ClassGroup, Student } from "../../src/core/models";
import { normalizeUnitKey } from "../../src/core/unit-key";
import {
    deleteStudent,
    getClasses,
    getStudents,
    saveStudent,
    updateStudent,
} from "../../src/db/seed";
import { notifyBirthdays } from "../../src/notifications";
import { logAction } from "../../src/observability/breadcrumbs";
import { measure } from "../../src/observability/perf";
import { useOrganization } from "../../src/providers/OrganizationProvider";
import { AnchoredDropdown as StudentsAnchoredDropdown } from "../../src/ui/AnchoredDropdown";
import { useAppTheme } from "../../src/ui/app-theme";
import { Button } from "../../src/ui/Button";
import { getClassPalette } from "../../src/ui/class-colors";
import { ClassGenderBadge } from "../../src/ui/ClassGenderBadge";
import { useConfirmDialog } from "../../src/ui/confirm-dialog";
import { useConfirmUndo } from "../../src/ui/confirm-undo";
import { ConfirmCloseOverlay } from "../../src/ui/ConfirmCloseOverlay";
import { DateInput } from "../../src/ui/DateInput";
import { DatePickerModal } from "../../src/ui/DatePickerModal";
import { FadeHorizontalScroll } from "../../src/ui/FadeHorizontalScroll";
import { ModalSheet } from "../../src/ui/ModalSheet";
import { Pressable } from "../../src/ui/Pressable";
import { ScreenHeader } from "../../src/ui/ScreenHeader";
import { getSectionCardStyle } from "../../src/ui/section-styles";
import { ShimmerBlock } from "../../src/ui/Shimmer";
import { getUnitPalette } from "../../src/ui/unit-colors";
import { UnitFilterBar } from "../../src/ui/UnitFilterBar";
import { useCollapsibleAnimation } from "../../src/ui/use-collapsible";
import { useModalCardStyle } from "../../src/ui/use-modal-card-style";
import { usePersistedState } from "../../src/ui/use-persisted-state";
import { useWhatsAppSettings } from "../../src/ui/whatsapp-settings-context";
import {
    buildWaMeLink,
    getContactPhone,
    normalizePhoneBR,
    openWhatsApp,
} from "../../src/utils/whatsapp";
import {
    WHATSAPP_TEMPLATES,
    calculateNextClassDate,
    formatNextClassDate,
    renderTemplate,
    type WhatsAppTemplateId,
} from "../../src/utils/whatsapp-templates";

const monthNames = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const weekdayShortLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const formatStartTimeLabel = (value: string) => {
  const raw = value.trim();
  if (!raw) return "";
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return raw;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return raw;
  if (minute === 0) return `${hour}h`;
  return `${hour}h${String(minute).padStart(2, "0")}`;
};

const formatClassScheduleLabel = (cls: ClassGroup | null) => {
  if (!cls) return "";
  const days = (cls.daysOfWeek ?? [])
    .map((day) => weekdayShortLabels[day] ?? "")
    .filter(Boolean);
  const daysLabel = days.join(", ");
  const timeLabel = formatStartTimeLabel(cls.startTime);
  if (daysLabel && timeLabel) return `${daysLabel} ${timeLabel}`;
  return daysLabel || timeLabel;
};
type BirthdayEntry = { student: Student; date: Date; unitName: string };
type BirthdayUnitGroup = [string, BirthdayEntry[]];
type BirthdayMonthGroup = [number, BirthdayUnitGroup[]];

export default function StudentsScreen() {
  const { height: windowHeight } = useWindowDimensions();
  const { signOut } = useAuth();
  const { colors } = useAppTheme();
  const { activeOrganization } = useOrganization();
  const { coachName, groupInviteLinks } = useWhatsAppSettings();
  const { confirm } = useConfirmUndo();
  const { confirm: confirmDialog } = useConfirmDialog();
  const selectFieldStyle = {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    gap: 8,
  };
  const editModalCardStyle = useModalCardStyle({ maxHeight: "90%", maxWidth: 440 });
  const editModalStandardHeight = useMemo(() => {
    if (Platform.OS === "web") return undefined;
    const target = Math.round(windowHeight * 0.78);
    return Math.max(520, Math.min(target, 700));
  }, [windowHeight]);
  const whatsappModalCardStyle = useModalCardStyle({
    maxHeight: "70%",
    maxWidth: 440,
  });
  const photoPreviewCardStyle = useModalCardStyle({ maxHeight: "70%", maxWidth: 360 });
  const photoSheetCardStyle = useModalCardStyle({ maxHeight: "55%", maxWidth: 320 });
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [classId, setClassId] = useState("");
  const [showForm, setShowForm] = usePersistedState<boolean>(
    "students_show_form_v1",
    false
  );
  const [studentsTab, setStudentsTab] = usePersistedState<
    "cadastro" | "aniversários" | "alunos"
  >("students_tab_v1", "alunos");
  const [showStudentsTabConfirm, setShowStudentsTabConfirm] = useState(false);
  const [pendingStudentsTab, setPendingStudentsTab] = useState<
    "cadastro" | "aniversários" | "alunos" | null
  >(null);
  const [birthdayUnitFilter, setBirthdayUnitFilter] = useState("Todas");
  const [birthdaySearch, setBirthdaySearch] = useState("");
  const [birthdayMonthFilter, setBirthdayMonthFilter] = useState<"Todas" | number>(
    "Todas"
  );
  const [showAllBirthdays, setShowAllBirthdays] = useState(true);
  const [studentsUnitFilter, setStudentsUnitFilter] = useState("Todas");
  const [unit, setUnit] = useState("");
  const [ageBand, setAgeBand] = useState<ClassGroup["ageBand"]>("");
  const [customAgeBand, setCustomAgeBand] = useState("");
  const [name, setName] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoMimeType, setPhotoMimeType] = useState<string | null>(null);
  const [birthDate, setBirthDate] = useState("");
  const [ageNumber, setAgeNumber] = useState<number | null>(null);
  const [phone, setPhone] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianRelation, setGuardianRelation] = useState("");
  const [healthIssue, setHealthIssue] = useState(false);
  const [healthIssueNotes, setHealthIssueNotes] = useState("");
  const [medicationUse, setMedicationUse] = useState(false);
  const [medicationNotes, setMedicationNotes] = useState("");
  const [healthObservations, setHealthObservations] = useState("");
  const [showHealthSection, setShowHealthSection] = useState(false);
  const [showEditHealthSection, setShowEditHealthSection] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCreatedAt, setEditingCreatedAt] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [showClassPicker, setShowClassPicker] = useState(false);
  const [showGuardianRelationPicker, setShowGuardianRelationPicker] = useState(false);
  const [showEditUnitPicker, setShowEditUnitPicker] = useState(false);
  const [showEditClassPicker, setShowEditClassPicker] = useState(false);
  const [showEditGuardianRelationPicker, setShowEditGuardianRelationPicker] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEditCloseConfirm, setShowEditCloseConfirm] = useState(false);
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);
  const [showPhotoPreview, setShowPhotoPreview] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<{ uri: string | null; name: string } | null>(null);
  const [studentFormError, setStudentFormError] = useState("");
  const [saveNotice, setSaveNotice] = useState("");
  const [studentInviteBusy, setStudentInviteBusy] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsappNotice, setWhatsappNotice] = useState("");
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedContactType, setSelectedContactType] = useState<
    "guardian" | "student"
  >("guardian");
  const [selectedTemplateId, setSelectedTemplateId] =
    useState<WhatsAppTemplateId | null>(null);
  const [selectedTemplateLabel, setSelectedTemplateLabel] = useState<string | null>(null);
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  const [customStudentMessage, setCustomStudentMessage] = useState("");
  const [showTemplateList, setShowTemplateList] = useState(false);
  const [whatsappContainerWindow, setWhatsappContainerWindow] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [templateTriggerLayout, setTemplateTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const saveNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const whatsappNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveNoticeAnim = useRef(new Animated.Value(0)).current;
  const [editSnapshot, setEditSnapshot] = useState<{
    unit: string;
    ageBand: string;
    customAgeBand: string;
    classId: string;
    name: string;
    photoUrl: string | null;
    birthDate: string;
    phone: string;
    loginEmail: string;
    guardianName: string;
    guardianPhone: string;
    guardianRelation: string;
    healthIssue: boolean;
    healthIssueNotes: string;
    medicationUse: boolean;
    medicationNotes: string;
    healthObservations: string;
  } | null>(null);
  const [lastBirthdayNotice, setLastBirthdayNotice] = usePersistedState<string>(
    "students_birthday_notice_v1",
    ""
  );
  const [expandedUnits, setExpandedUnits] = usePersistedState<Record<string, boolean>>(
    "students_units_expanded_v1",
    {}
  );
  const [expandedClasses, setExpandedClasses] = usePersistedState<Record<string, boolean>>(
    "students_classes_expanded_v1",
    {}
  );
  const [containerWindow, setContainerWindow] = useState<{ x: number; y: number } | null>(null);
  const [unitTriggerLayout, setUnitTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [classTriggerLayout, setClassTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [guardianRelationTriggerLayout, setGuardianRelationTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [editContainerWindow, setEditContainerWindow] = useState<{ x: number; y: number } | null>(null);
  const [editUnitTriggerLayout, setEditUnitTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [editClassTriggerLayout, setEditClassTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [editGuardianRelationTriggerLayout, setEditGuardianRelationTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const containerRef = useRef<View>(null);
  const unitTriggerRef = useRef<View>(null);
  const classTriggerRef = useRef<View>(null);
  const guardianRelationTriggerRef = useRef<View>(null);
  const editModalRef = useRef<View>(null);
  const editUnitTriggerRef = useRef<View>(null);
  const editClassTriggerRef = useRef<View>(null);
  const editGuardianRelationTriggerRef = useRef<View>(null);
  const whatsappContainerRef = useRef<View>(null);
  const templateTriggerRef = useRef<View>(null);
  const { animatedStyle: unitPickerAnimStyle, isVisible: showUnitPickerContent } =
    useCollapsibleAnimation(showUnitPicker);
  const { animatedStyle: classPickerAnimStyle, isVisible: showClassPickerContent } =
    useCollapsibleAnimation(showClassPicker);
  const {
    animatedStyle: guardianRelationPickerAnimStyle,
    isVisible: showGuardianRelationPickerContent,
  } = useCollapsibleAnimation(showGuardianRelationPicker);
  const { animatedStyle: editUnitPickerAnimStyle, isVisible: showEditUnitPickerContent } =
    useCollapsibleAnimation(showEditUnitPicker);
  const { animatedStyle: editClassPickerAnimStyle, isVisible: showEditClassPickerContent } =
    useCollapsibleAnimation(showEditClassPicker);
  const {
    animatedStyle: editGuardianRelationPickerAnimStyle,
    isVisible: showEditGuardianRelationPickerContent,
  } = useCollapsibleAnimation(showEditGuardianRelationPicker);
  const { animatedStyle: templateListAnimStyle, isVisible: showTemplateListContent } =
    useCollapsibleAnimation(showTemplateList, { translateY: -6 });
  const { animatedStyle: allBirthdaysAnimStyle, isVisible: showAllBirthdaysContent } =
    useCollapsibleAnimation(showAllBirthdays, { translateY: -6 });
  const {
    animatedStyle: healthSectionAnimStyle,
    isVisible: showHealthSectionContent,
  } = useCollapsibleAnimation(showHealthSection, { translateY: -6 });
  const {
    animatedStyle: editHealthSectionAnimStyle,
    isVisible: showEditHealthSectionContent,
  } = useCollapsibleAnimation(showEditHealthSection, { translateY: -6 });
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [classList, studentList] = await Promise.all([
          getClasses({ organizationId: activeOrganization?.id }),
          getStudents({ organizationId: activeOrganization?.id }),
        ]);
        if (!alive) return;
        setClasses(classList);
        setStudents(studentList);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [activeOrganization?.id]);

  const reload = async () => {
    const data = await getStudents({ organizationId: activeOrganization?.id });
    setStudents(data);
  };

  const unitLabel = useCallback(
    (value: string) => (value && value.trim() ? value.trim() : "Sem unidade"),
    []
  );

  const closeAllPickers = useCallback(() => {
    setShowUnitPicker(false);
    setShowClassPicker(false);
    setShowGuardianRelationPicker(false);
    setShowTemplateList(false);
  }, []);
  const closeAllEditPickers = useCallback(() => {
    setShowEditUnitPicker(false);
    setShowEditClassPicker(false);
    setShowEditGuardianRelationPicker(false);
  }, []);

  const toggleFormPicker = useCallback(
    (target: "unit" | "class" | "guardianRelation") => {
      setShowUnitPicker((prev) => (target === "unit" ? !prev : false));
      setShowClassPicker((prev) => (target === "class" ? !prev : false));
      setShowGuardianRelationPicker((prev) => (target === "guardianRelation" ? !prev : false));
    },
    []
  );
  const toggleEditPicker = useCallback(
    (target: "unit" | "class" | "guardianRelation") => {
      setShowEditUnitPicker((prev) => (target === "unit" ? !prev : false));
      setShowEditClassPicker((prev) => (target === "class" ? !prev : false));
      setShowEditGuardianRelationPicker((prev) => (target === "guardianRelation" ? !prev : false));
    },
    []
  );

  const handleSelectUnit = useCallback((value: string) => {
    setUnit(value);
    setShowUnitPicker(false);
  }, []);

  const handleSelectClass = useCallback((value: ClassGroup) => {
    setClassId(value.id);
    setUnit(unitLabel(value.unit));
    setAgeBand(value.ageBand);
    setCustomAgeBand("");
    setShowClassPicker(false);
  }, [unitLabel]);

  const handleSelectGuardianRelation = useCallback((value: string) => {
    setGuardianRelation(value);
    setShowGuardianRelationPicker(false);
  }, []);

  const handleSelectEditUnit = useCallback((value: string) => {
    setUnit(value);
    setShowEditUnitPicker(false);
  }, []);

  const handleSelectEditClass = useCallback((value: ClassGroup) => {
    setClassId(value.id);
    setUnit(unitLabel(value.unit));
    setAgeBand(value.ageBand);
    setCustomAgeBand("");
    setShowEditClassPicker(false);
  }, [unitLabel]);

  const handleSelectEditGuardianRelation = useCallback((value: string) => {
    setGuardianRelation(value);
    setShowEditGuardianRelationPicker(false);
  }, []);

  const syncPickerLayouts = useCallback(() => {
    const hasPickerOpen = showUnitPicker || showClassPicker || showGuardianRelationPicker;
    if (!hasPickerOpen) return;
    requestAnimationFrame(() => {
      if (showUnitPicker) {
        unitTriggerRef.current.measureInWindow((x, y, width, height) => {
          setUnitTriggerLayout({ x, y, width, height });
        });
      }
      if (showClassPicker) {
        classTriggerRef.current.measureInWindow((x, y, width, height) => {
          setClassTriggerLayout({ x, y, width, height });
        });
      }
      if (showGuardianRelationPicker) {
        guardianRelationTriggerRef.current.measureInWindow((x, y, width, height) => {
          setGuardianRelationTriggerLayout({ x, y, width, height });
        });
      }
      containerRef.current.measureInWindow((x, y) => {
        setContainerWindow({ x, y });
      });
    });
  }, [showClassPicker, showGuardianRelationPicker, showUnitPicker]);

  const syncEditPickerLayouts = useCallback(() => {
    const hasPickerOpen =
      showEditUnitPicker || showEditClassPicker || showEditGuardianRelationPicker;
    if (!hasPickerOpen) return;
    requestAnimationFrame(() => {
      if (showEditUnitPicker) {
        editUnitTriggerRef.current.measureInWindow((x, y, width, height) => {
          setEditUnitTriggerLayout({ x, y, width, height });
        });
      }
      if (showEditClassPicker) {
        editClassTriggerRef.current.measureInWindow((x, y, width, height) => {
          setEditClassTriggerLayout({ x, y, width, height });
        });
      }
      if (showEditGuardianRelationPicker) {
        editGuardianRelationTriggerRef.current.measureInWindow((x, y, width, height) => {
          setEditGuardianRelationTriggerLayout({ x, y, width, height });
        });
      }
      editModalRef.current.measureInWindow((x, y) => {
        setEditContainerWindow({ x, y });
      });
    });
  }, [showEditClassPicker, showEditGuardianRelationPicker, showEditUnitPicker]);

  const syncTemplateLayout = useCallback(() => {
    requestAnimationFrame(() => {
      templateTriggerRef.current.measureInWindow((x, y, width, height) => {
        setTemplateTriggerLayout({ x, y, width, height });
      });
      whatsappContainerRef.current.measureInWindow((x, y) => {
        setWhatsappContainerWindow({ x, y });
      });
    });
  }, []);

  const unitOptions = useMemo(() => {
    const map = new Map<string, string>();
    const upperScore = (value: string) =>
      (value.match(/[A-Z]/g) ?? []).length;
    const preferLabel = (current: string, next: string) => {
      const currentScore = upperScore(current);
      const nextScore = upperScore(next);
      if (nextScore > currentScore) return next;
      if (nextScore < currentScore) return current;
      return next.length > current.length ? next : current;
    };
    classes.forEach((item) => {
      const label = unitLabel(item.unit);
      const key = normalizeUnitKey(label);
      if (!key) return;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, label);
      } else {
        map.set(key, preferLabel(existing, label));
      }
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [classes, unitLabel]);

  const ageBandOptions = useMemo(() => {
    const set = new Set<ClassGroup["ageBand"]>();
    classes.forEach((item) => {
      if (item.ageBand) set.add(item.ageBand);
    });
    const parse = (value: string) => {
      const [startRaw, endRaw] = value.split("-");
      const start = Number(startRaw);
      const end = Number(endRaw);
      return {
        start: Number.isFinite(start) ? start : Number.POSITIVE_INFINITY,
        end: Number.isFinite(end) ? end : Number.POSITIVE_INFINITY,
        label: value,
      };
    };
    return Array.from(set).sort((a, b) => {
      const aParsed = parse(a);
      const bParsed = parse(b);
      if (aParsed.start !== bParsed.start) return aParsed.start - bParsed.start;
      if (aParsed.end !== bParsed.end) return aParsed.end - bParsed.end;
      return aParsed.label.localeCompare(bParsed.label);
    });
  }, [classes]);
  const guardianRelationOptions = useMemo(
    () => ["Pai", "Mãe", "Tia", "Avó", "Irmão", "Irmã", "Outro"],
    []
  );

  useEffect(() => {
    syncPickerLayouts();
  }, [showUnitPicker, showClassPicker, showGuardianRelationPicker, syncPickerLayouts]);

  useEffect(() => {
    if (showEditModal) syncEditPickerLayouts();
  }, [
    showEditModal,
    showEditUnitPicker,
    showEditClassPicker,
    showEditGuardianRelationPicker,
    syncEditPickerLayouts,
  ]);

  useEffect(() => {
    if (showWhatsAppModal && showTemplateList) {
      syncTemplateLayout();
    }
  }, [showTemplateList, showWhatsAppModal, syncTemplateLayout]);

  useEffect(() => {
    if (!showForm) closeAllPickers();
  }, [closeAllPickers, showForm]);
  useEffect(() => {
    if (!showEditModal) closeAllEditPickers();
  }, [closeAllEditPickers, showEditModal]);

  useEffect(() => {
    if (!classes.length) return;
    if (!unit) {
      setClassId("");
      return;
    }
    const matching = classes
      .filter((item) => unitLabel(item.unit) === unit)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!matching.length) {
      setClassId("");
      return;
    }
    if (matching.some((item) => item.id === classId)) return;
    // Removido auto-seleção: usuário deve escolher turma manualmente
    // setClassId(matching[0].id);
  }, [classes, unit, unitLabel]);

  useEffect(() => {
    if (!birthDate) {
      setAgeNumber(null);
      return;
    }
    setAgeNumber(calculateAge(birthDate));
  }, [birthDate]);

  const pickStudentPhoto = async (source: "camera" | "library" | "remove") => {
    try {
      if (source === "remove") {
        setPhotoUrl(null);
        setPhotoMimeType(null);
        return;
      }
      if (Platform.OS === "web" && source === "camera") {
        Alert.alert("Câmera indisponível", "Use a Galeria no navegador.");
        return;
      }
      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (permission.status !== "granted") {
          Alert.alert("Permissão necessária", "Ative a câmera para tirar a foto.");
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.65,
          allowsEditing: true,
          aspect: [1, 1],
          base64: false,
        });
        const asset = result.assets?.[0];
        if (!result.canceled && asset?.uri) {
          setPhotoUrl(asset.uri);
          setPhotoMimeType(asset.mimeType ?? null);
        }
        return;
      }
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Permissão necessária", "Ative a galeria para escolher uma foto.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.65,
        allowsEditing: true,
        aspect: [1, 1],
        base64: false,
      });
      const asset = result.assets?.[0];
      if (!result.canceled && asset?.uri) {
        setPhotoUrl(asset.uri);
        setPhotoMimeType(asset.mimeType ?? null);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      Alert.alert("Erro", detail);
    } finally {
      setShowPhotoSheet(false);
    }
  };

  const openPhotoPreview = (student: Student) => {
    setPhotoPreview({ uri: student.photoUrl ?? null, name: student.name });
    setShowPhotoPreview(true);
  };


  const onSave = async () => {
    const wasEditing = !!editingId;
    if (!unit || !classId) {
      setStudentFormError("Selecione a unidade e a turma.");
      return false;
    }
    if (!classId || !name.trim()) {
      setStudentFormError("Preencha o nome do aluno.");
      return false;
    }
    setStudentFormError("");
    const resolvedAge = ageNumber
      ? birthDate
        ? calculateAge(birthDate)
        : null
      : null;
    if (resolvedAge === null || Number.isNaN(resolvedAge)) {
      setStudentFormError("Informe a data de nascimento.");
      return false;
    }
    const nowIso = new Date().toISOString();
    const studentId = editingId ? editingId : "s_" + Date.now();
    const resolvedOrganizationId =
      classes.find((item) => item.id === classId)?.organizationId ??
      activeOrganization?.id ??
      "";

    try {
      let resolvedPhotoUrl: string | undefined = photoUrl || undefined;
      const isRemotePhoto = /^https?:\/\//i.test(photoUrl ?? "");

      if (photoUrl && !isRemotePhoto) {
        resolvedPhotoUrl = await uploadStudentPhoto({
          organizationId: resolvedOrganizationId,
          studentId,
          uri: photoUrl,
          contentType: photoMimeType,
        });
      }

      if (!photoUrl && editingId && editSnapshot?.photoUrl) {
        await removeStudentPhotoObject({
          organizationId: resolvedOrganizationId,
          studentId,
        });
      }

      const student: Student = {
        id: studentId,
        name: name.trim(),
        organizationId: resolvedOrganizationId,
        photoUrl: resolvedPhotoUrl || undefined,
        classId,
        age: resolvedAge,
        phone: phone.trim(),
        loginEmail: loginEmail.trim() ? formatEmail(loginEmail) : undefined,
        guardianName: guardianName.trim(),
        guardianPhone: guardianPhone.trim(),
        guardianRelation: guardianRelation.trim(),
        healthIssue,
        healthIssueNotes: healthIssue ? healthIssueNotes.trim() : "",
        medicationUse,
        medicationNotes: medicationUse ? medicationNotes.trim() : "",
        healthObservations: healthObservations.trim(),
        birthDate: birthDate || undefined,
        createdAt: editingCreatedAt ? editingCreatedAt : nowIso,
        updatedAt: nowIso,
      };

      if (editingId) {
        await measure("updateStudent", () => updateStudent(student));
      } else {
        await measure("saveStudent", () => saveStudent(student));
      }
      logAction(wasEditing ? "Editar aluno" : "Cadastrar aluno", {
        studentId: student.id,
        classId,
      });

      resetForm();
      await reload();
      showSaveNotice(wasEditing ? "Alterações salvas." : "Aluno cadastrado.");
      return true;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Erro ao salvar aluno.";
      setStudentFormError(detail);
      return false;
    }
  };

  const isFormDirty =
    unit.trim() ||
    classId.trim() ||
    name.trim() ||
    photoUrl ||
    birthDate.trim() ||
    phone.trim() ||
    loginEmail.trim() ||
    guardianName.trim() ||
    guardianPhone.trim() ||
    guardianRelation.trim() ||
    healthIssue ||
    medicationUse ||
    healthIssueNotes.trim() ||
    medicationNotes.trim() ||
    healthObservations.trim() ||
    editingId;

  const canSaveStudent =
    !!unit &&
    !!classId &&
    !!name.trim() &&
    ageNumber !== null &&
    (!!birthDate.trim() || !!editingId);

  const isEditDirty = useMemo(() => {
    if (!editingId || !editSnapshot) return false;
    return (
      editSnapshot.unit !== unit ||
      editSnapshot.ageBand !== ageBand ||
      editSnapshot.customAgeBand !== customAgeBand ||
      editSnapshot.classId !== classId ||
      editSnapshot.name !== name ||
      editSnapshot.photoUrl !== photoUrl ||
      editSnapshot.birthDate !== birthDate ||
      editSnapshot.phone !== phone ||
      editSnapshot.loginEmail !== loginEmail ||
      editSnapshot.guardianName !== guardianName ||
      editSnapshot.guardianPhone !== guardianPhone ||
      editSnapshot.guardianRelation !== guardianRelation ||
      editSnapshot.healthIssue !== healthIssue ||
      editSnapshot.healthIssueNotes !== healthIssueNotes ||
      editSnapshot.medicationUse !== medicationUse ||
      editSnapshot.medicationNotes !== medicationNotes ||
      editSnapshot.healthObservations !== healthObservations
    );
  }, [
    ageBand,
    birthDate,
    classId,
    customAgeBand,
    editSnapshot,
    editingId,
    guardianName,
    guardianPhone,
    guardianRelation,
    healthIssue,
    healthIssueNotes,
    medicationUse,
    medicationNotes,
    healthObservations,
    loginEmail,
    name,
    photoUrl,
    phone,
    unit,
  ]);

  const resetForm = () => {
    closeAllPickers();
    setShowForm(false);
    setEditingId(null);
    setEditingCreatedAt(null);
    setName("");
    setPhotoUrl(null);
    setPhotoMimeType(null);
    setBirthDate("");
    setAgeNumber(null);
    setPhone("");
    setLoginEmail("");
    setGuardianName("");
    setGuardianPhone("");
    setGuardianRelation("");
    setHealthIssue(false);
    setHealthIssueNotes("");
    setMedicationUse(false);
    setMedicationNotes("");
    setHealthObservations("");
    setShowHealthSection(false);
    setShowEditHealthSection(false);
    setCustomAgeBand("");
    setUnit("");
    setAgeBand("");
    setClassId("");
    setStudentFormError("");
    setEditSnapshot(null);
  };

  const resetCreateForm = () => {
    closeAllPickers();
    setUnit("");
    setAgeBand("");
    setClassId("");
    setCustomAgeBand("");
    setStudentFormError("");
    setName("");
    setPhotoUrl(null);
    setPhotoMimeType(null);
    setBirthDate("");
    setAgeNumber(null);
    setPhone("");
    setLoginEmail("");
    setGuardianName("");
    setGuardianPhone("");
    setGuardianRelation("");
    setHealthIssue(false);
    setHealthIssueNotes("");
    setMedicationUse(false);
    setMedicationNotes("");
    setHealthObservations("");
    setShowHealthSection(false);
  };

  const requestSwitchStudentsTab = useCallback(
    (nextTab: "cadastro" | "aniversários" | "alunos") => {
      if (nextTab === studentsTab) return;
      if (studentsTab === "cadastro" && isFormDirty) {
        setPendingStudentsTab(nextTab);
        setShowStudentsTabConfirm(true);
        return;
      }
      if (studentsTab === "cadastro" && !isFormDirty) {
        resetForm();
      }
      setStudentsTab(nextTab);
    },
    [isFormDirty, resetForm, studentsTab]
  );

  const showSaveNotice = (message: string) => {
    setSaveNotice(message);
    if (saveNoticeTimer.current) {
      clearTimeout(saveNoticeTimer.current);
    }
    saveNoticeAnim.setValue(0);
    Animated.timing(saveNoticeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    saveNoticeTimer.current = setTimeout(() => {
      Animated.timing(saveNoticeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setSaveNotice("");
        saveNoticeTimer.current = null;
      });
    }, 2200);
  };

  const showWhatsAppNotice = useCallback((message: string) => {
    setWhatsappNotice(message);
    if (whatsappNoticeTimer.current) {
      clearTimeout(whatsappNoticeTimer.current);
    }
    whatsappNoticeTimer.current = setTimeout(() => {
      setWhatsappNotice("");
      whatsappNoticeTimer.current = null;
    }, 2200);
  }, []);

  const closeEditModal = () => {
    setShowEditModal(false);
    setShowEditCloseConfirm(false);
    closeAllEditPickers();
    resetForm();
  };

  const requestCloseEditModal = () => {
    if (isEditDirty) {
      setShowEditCloseConfirm(true);
      return;
    }
    closeEditModal();
  };

  const onEdit = useCallback(
    (student: Student) => {
      // Open first so a bad field doesn't block the modal entirely.
      setShowForm(false);
      setStudentFormError("");
      setShowEditModal(true);
      try {
        const safeText = (value: unknown) =>
          typeof value === "string" ? value : value == null ? "" : String(value);
        const cls = classes.find((item) => item.id === student.classId);
        let nextUnit = "";
        let nextAgeBand = "";
        let nextCustomAgeBand = "";
        let nextClassId = "";
        if (cls) {
          nextUnit = unitLabel(cls.unit);
          nextAgeBand = safeText(cls.ageBand);
          if (!ageBandOptions.includes(nextAgeBand)) {
            nextCustomAgeBand = nextAgeBand;
          }
          nextClassId = cls.id;
        }
        const birthDateValue = safeText(student.birthDate);
        const loginEmailValue = safeText(student.loginEmail);
        const guardianNameValue = safeText(student.guardianName);
        const guardianPhoneValue = safeText(student.guardianPhone);
        const guardianRelationValue = safeText(student.guardianRelation);
        const healthIssueNotesValue = safeText(student.healthIssueNotes);
        const medicationNotesValue = safeText(student.medicationNotes);
        const healthObservationsValue = safeText(student.healthObservations);
        setUnit(nextUnit);
        setAgeBand(nextAgeBand);
        setCustomAgeBand(nextCustomAgeBand);
        setClassId(nextClassId);
        setEditingId(student.id);
        setEditingCreatedAt(student.createdAt);
        setName(safeText(student.name));
        setPhotoUrl(student.photoUrl ?? null);
        setPhotoMimeType(null);
        setEditSnapshot({
          unit: nextUnit,
          ageBand: nextAgeBand,
          customAgeBand: nextCustomAgeBand,
          classId: nextClassId,
          name: safeText(student.name),
          photoUrl: student.photoUrl ?? null,
          birthDate: birthDateValue,
          phone: student.phone,
          loginEmail: loginEmailValue,
          guardianName: guardianNameValue,
          guardianPhone: guardianPhoneValue,
          guardianRelation: guardianRelationValue,
          healthIssue: student.healthIssue ?? false,
          healthIssueNotes: healthIssueNotesValue,
          medicationUse: student.medicationUse ?? false,
          medicationNotes: medicationNotesValue,
          healthObservations: healthObservationsValue,
        });
        if (birthDateValue) {
          setBirthDate(birthDateValue);
          setAgeNumber(calculateAge(birthDateValue));
        } else {
          setBirthDate("");
          setAgeNumber(student.age);
        }
        setPhone(student.phone);
        setLoginEmail(loginEmailValue);
        setGuardianName(guardianNameValue);
        setGuardianPhone(guardianPhoneValue);
        setGuardianRelation(guardianRelationValue);
        setHealthIssue(student.healthIssue ?? false);
        setHealthIssueNotes(healthIssueNotesValue);
        setMedicationUse(student.medicationUse ?? false);
        setMedicationNotes(medicationNotesValue);
        setHealthObservations(healthObservationsValue);
        setShowEditHealthSection(
          Boolean(
            student.healthIssue ||
              student.medicationUse ||
              healthIssueNotesValue.trim() ||
              medicationNotesValue.trim() ||
              healthObservationsValue.trim()
          )
        );
        closeAllPickers();
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        Alert.alert("Erro ao abrir aluno", detail);
      }
    },
    [ageBandOptions, classes, closeAllPickers, unitLabel]
  );

  const onDelete = (id: string) => {
    const student = students.find((item) => item.id === id);
    if (!student) return;
    confirm({
      title: "Excluir aluno?",
      message: student.name
        ? `Tem certeza que deseja excluir ${student.name}?`
        : "Tem certeza que deseja excluir este aluno?",
      confirmLabel: "Excluir",
      undoMessage: "Aluno excluído. Deseja desfazer?",
      onOptimistic: () => {
        setStudents((prev) => prev.filter((item) => item.id !== student.id));
        if (editingId === student.id) {
          setEditingId(null);
          setEditingCreatedAt(null);
        }
      },
      onConfirm: async () => {
        await measure("deleteStudent", () => deleteStudent(student.id));
        await reload();
        logAction("Excluir aluno", {
          studentId: student.id,
          classId: student.classId,
        });
      },
      onUndo: async () => {
        await reload();
      },
    });
  };

  const deleteEditingStudent = useCallback(() => {
    if (!editingId) return;
    const student = students.find((item) => item.id === editingId);
    if (!student) return;
    confirm({
      title: "Excluir aluno?",
      message: student.name
        ? `Tem certeza que deseja excluir ${student.name}?`
        : "Tem certeza que deseja excluir este aluno?",
      confirmLabel: "Excluir",
      undoMessage: "Aluno excluído. Deseja desfazer?",
      onOptimistic: () => {
        setStudents((prev) => prev.filter((item) => item.id !== student.id));
        closeEditModal();
      },
      onConfirm: async () => {
        await measure("deleteStudent", () => deleteStudent(student.id));
        await reload();
        logAction("Excluir aluno", {
          studentId: student.id,
          classId: student.classId,
        });
      },
      onUndo: async () => {
        await reload();
      },
    });
  }, [confirm, editingId, closeEditModal, logAction, reload, students]);

  const getClassName = useCallback(
    (id: string) =>
      classes.find((item) => item.id === id)?.name ?? "Selecione a turma",
    [classes]
  );
  const selectedClassName = useMemo(
    () => classes.find((item) => item.id === classId)?.name ?? "",
    [classId, classes]
  );

  const formatShortDate = (value: string) => {
    if (!value) return "";
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return value;
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  };

  const formatIsoDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const parseIsoDate = (value: string) => {
    if (!value) return null;
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const local = new Date(year, month - 1, day);
      return Number.isNaN(local.getTime()) ? null : local;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const calculateAge = (iso: string) => {
    const date = parseIsoDate(iso);
    if (!date) return null;
    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    const monthDiff = today.getMonth() - date.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < date.getDate())
    ) {
      age -= 1;
    }
    return age;
  };

  const normalizeSearch = useCallback(
    (value: string) =>
      value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim(),
    []
  );

  const getDaysUntilBirthday = (birthDate: Date, today: Date) => {
    const thisYear = today.getFullYear();
    const nextBirthday = new Date(
      thisYear,
      birthDate.getMonth(),
      birthDate.getDate()
    );
    if (nextBirthday < today) {
      nextBirthday.setFullYear(thisYear + 1);
    }
    const diffTime = nextBirthday.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const hasBirthdayPassed = (birthDate: Date, today: Date) => {
    const birthMonth = birthDate.getMonth();
    const birthDay = birthDate.getDate();
    const todayMonth = today.getMonth();
    const todayDay = today.getDate();
    if (birthMonth < todayMonth) return true;
    if (birthMonth === todayMonth && birthDay < todayDay) return true;
    return false;
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    }
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const sanitizePhone = (value: string) => value.replace(/\D/g, "");

  const formatEmail = (value: string) => value.trim().toLowerCase();

  const formatTodayLabel = () =>
    new Date().toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });

  const buildStudentMessage = useCallback(
    (
      student: Student,
      cls: ClassGroup | null,
      templateId: WhatsAppTemplateId,
      fields: Record<string, string>
    ) => {
      const nextClassDate = cls?.daysOfWeek?.length
        ? calculateNextClassDate(cls.daysOfWeek)
        : null;
      return renderTemplate(templateId, {
        coachName,
        studentName: student.name,
        className: cls?.name ?? "Turma",
        unitLabel: unitLabel(cls?.unit ?? ""),
        dateLabel: formatTodayLabel(),
        nextClassDate: nextClassDate ? formatNextClassDate(nextClassDate) : "",
        nextClassTime: cls?.startTime ? formatStartTimeLabel(cls.startTime) : "",
        groupInviteLink: cls ? groupInviteLinks?.[cls.id] ?? "" : "",
        inviteLink: fields.inviteLink ?? "",
        highlightNote: fields.highlightNote ?? "",
        customText: fields.customText ?? "",
      });
    },
    [coachName, groupInviteLinks]
  );

  const openStudentWhatsApp = useCallback(
    (student: Student) => {
      const contact = getContactPhone(student);
      if (contact.status === "missing") {
        Alert.alert(
          "Sem telefone",
          "Adicione o telefone do aluno ou responsável para usar o WhatsApp."
        );
        return;
      }
      if (contact.status === "invalid") {
        Alert.alert("Telefone inválido", "Informe um telefone com DDD.");
        return;
      }
      const cls = classes.find((entry) => entry.id === student.classId) ?? null;
      const hasReminder =
        !!cls?.daysOfWeek?.length && Boolean((cls?.startTime ?? "").trim());
      const suggested: WhatsAppTemplateId = hasReminder
        ? "class_reminder"
        : "quick_notice";
      const fields: Record<string, string> = {};
      setSelectedTemplateId(suggested);
      setSelectedTemplateLabel(WHATSAPP_TEMPLATES[suggested].title);
      setCustomFields(fields);
      setSelectedContactType(contact.source === "student" ? "student" : "guardian");
      setCustomStudentMessage(buildStudentMessage(student, cls, suggested, fields));
      setSelectedStudentId(student.id);
      setShowWhatsAppModal(true);
    },
    [buildStudentMessage, classes]
  );

  const closeWhatsAppModal = useCallback(() => {
    setShowWhatsAppModal(false);
    setSelectedStudentId(null);
    setSelectedTemplateId(null);
    setSelectedTemplateLabel(null);
    setCustomFields({});
    setCustomStudentMessage("");
    setSelectedContactType("guardian");
    setShowTemplateList(false);
    setStudentInviteBusy(false);
    setWhatsappNotice("");
    setShowRevokeConfirm(false);
    if (whatsappNoticeTimer.current) {
      clearTimeout(whatsappNoticeTimer.current);
      whatsappNoticeTimer.current = null;
    }
  }, []);

  const buildInviteLink = (token: string) => {
    if (!SUPABASE_URL) {
      return `goatleta://invite/${token}`;
    }
    const base = SUPABASE_URL.replace(/\/$/, "").replace(
      ".supabase.co",
      ".functions.supabase.co"
    );
    return `${base}/invite-link?token=${encodeURIComponent(token)}`;
  };

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const applyStudentInviteTemplate = useCallback(
    async (
      student: Student,
      cls: ClassGroup | null,
      invitedTo: string,
      options: { revokeFirst: boolean; copyLink: boolean }
    ): Promise<string | null> => {
      if (studentInviteBusy) return null;
      setStudentInviteBusy(true);
      setSelectedTemplateId("student_invite");
      setSelectedTemplateLabel(WHATSAPP_TEMPLATES.student_invite.title);
      setCustomFields({});
      setCustomStudentMessage("Gerando convite...");
      const createInvite = async () => {
        const response = await createStudentInvite(student.id, {
          invitedVia: "whatsapp",
          invitedTo: invitedTo.trim() ? invitedTo : undefined,
        });
        if (!response.token) {
          throw new Error("Convite inválido.");
        }
        const link = buildInviteLink(response.token);
        const fields: Record<string, string> = { inviteLink: link };
        setCustomFields(fields);
        const message = buildStudentMessage(student, cls, "student_invite", fields);
        setCustomStudentMessage(message);
        if (options.copyLink) {
          await Clipboard.setStringAsync(link);
          showWhatsAppNotice("Link copiado.");
        }
        return message;
      };
      try {
        if (options.revokeFirst) {
          await revokeStudentAccess(student.id, { clearLoginEmail: true });
        }
        const attempts = options.revokeFirst ? 2 : 1;
        for (let attempt = 0; attempt < attempts; attempt += 1) {
          try {
            return await createInvite();
          } catch (error) {
            if (attempt + 1 < attempts) {
              await wait(400);
              continue;
            }
            throw error;
          }
        }
        return null;
      } catch (error) {
        let detail = error instanceof Error ? error.message : String(error);
        try {
          const parsed = JSON.parse(detail) as { error: string; message: string; details: string };
          if (parsed.error) {
            detail = String(parsed.error);
          } else if (parsed.message) {
            detail = String(parsed.message);
          } else if (parsed.details) {
            detail = String(parsed.details);
          }
        } catch {
          // ignore
        }
        const lower = detail.toLowerCase();
        const shortDetail = detail.length > 140 ? `${detail.slice(0, 140)}...` : detail;
        if (lower.includes("invalid jwt") || lower.includes("missing auth token")) {
          Alert.alert("Sessão expirada", "Entre novamente para gerar o convite.");
          void signOut();
        } else if (lower.includes("forbidden") || lower.includes("permission")) {
          Alert.alert("Convite", "Sem permissão para gerar o convite.");
          setCustomStudentMessage("Sem permissão para gerar o convite.");
        } else if (lower.includes("already linked")) {
          const message = options.revokeFirst
             ? "Não foi possível revogar o acesso. Tente novamente."
            : "Esse aluno já está vinculado. Use Revogar e gerar novo link.";
          Alert.alert("Convite", message);
          setCustomStudentMessage(message);
        } else if (lower.includes("student not found")) {
          Alert.alert("Convite", "Aluno não encontrado.");
          setCustomStudentMessage("Aluno não encontrado.");
        } else {
          Alert.alert("Convite", "Não foi possível gerar o convite.");
          setCustomStudentMessage(
            shortDetail
              ? `Não foi possível gerar o convite. ${shortDetail}`
              : "Não foi possível gerar o convite."
          );
        }
        return null;
      } finally {
        setStudentInviteBusy(false);
      }
    },
    [buildInviteLink, buildStudentMessage, showWhatsAppNotice, signOut, studentInviteBusy]
  );

  const formatName = (value: string) => {
    const particles = new Set([
      "da",
      "de",
      "do",
      "das",
      "dos",
      "e",
    ]);
    const hasTrailingSpace = /\s$/.test(value);
    const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    const formatted = words
      .map((word, index) => {
        const lower = word.toLowerCase();
        if (index > 0 && particles.has(lower)) return lower;
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      })
      .join(" ");
    return hasTrailingSpace ? formatted + " " : formatted;
  };

  const parseTime = (value: string) => {
    const match = value.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    return { hour, minute };
  };

  const formatTime = (hour: number, minute: number) => {
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  };

  const formatTimeRange = (startTime: string, durationMinutes: number) => {
    const parsed = parseTime(startTime);
    if (!parsed) return "";
    const total = parsed.hour * 60 + parsed.minute + durationMinutes;
    const endHour = Math.floor(total / 60) % 24;
    const endMinute = total % 60;
    return `${formatTime(parsed.hour, parsed.minute)} - ${formatTime(
      endHour,
      endMinute
    )}`;
  };

  const classOptions = useMemo(() => {
    if (!classes.length) return [];
    if (unit) {
      return sortClassesBySchedule(
        classes.filter((item) => unitLabel(item.unit) === unit)
      );
    }
    return sortClassesBySchedule(classes);
  }, [classes, unit, unitLabel]);

  const getClassLabel = (cls: ClassGroup) => {
    const start = cls.startTime || "";
    const duration = cls.durationMinutes || 60;
    const timeRange = start ? formatTimeRange(start, duration) : "";
    if (timeRange) return `${timeRange} - ${cls.name}`;
    return cls.name;
  };

  const renderClassPicker = () => {
    if (!unit) return null;
    if (!classOptions.length) {
      return (
        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.muted }}>Turma</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Nenhuma turma disponível para essa unidade.
          </Text>
        </View>
      );
    }
    return (
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.muted }}>Turma</Text>
        <View
          style={{
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
          }}
        >
          {classOptions.map((item, index) => {
            const active = item.id === classId;
            return (
              <Pressable
                key={item.id}
                onPress={() => setClassId(active ? "" : item.id)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: 10,
                  margin: index === 0 ? 6 : 2,
                  backgroundColor: active ? colors.primaryBg : "transparent",
                }}
              >
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  <Text
                    style={{
                      color: active ? colors.primaryText : colors.text,
                      fontSize: 12,
                      fontWeight: active ? "700" : "500",
                    }}
                  >
                    {getClassLabel(item)}
                  </Text>
                  <ClassGenderBadge gender={item.gender} />
                </View>
                <Text
                  style={{
                    color: active ? colors.primaryText : colors.muted,
                    fontSize: 11,
                    marginTop: 2,
                  }}
                >
                  {unitLabel(item.unit)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        { selectedClassName ? (
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Turma selecionada: {selectedClassName}
          </Text>
        ) : (
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Selecione uma turma.
          </Text>
        )}
      </View>
    );
  };

  const today = useMemo(() => new Date(), []);
  const birthdayUnitOptions = useMemo(
    () => ["Todas", ...unitOptions],
    [unitOptions]
  );
  const studentsUnitOptions = useMemo(
    () => ["Todas", ...unitOptions],
    [unitOptions]
  );
  const birthdayFilteredStudents = useMemo(() => {
    if (birthdayUnitFilter === "Todas") return students;
    return students.filter((student) => {
      const cls = classes.find((item) => item.id === student.classId) ?? null;
      return unitLabel(cls?.unit ?? "") === birthdayUnitFilter;
    });
  }, [birthdayUnitFilter, classes, students, unitLabel]);
  const birthdayVisibleStudents = useMemo(() => {
    const query = normalizeSearch(birthdaySearch);
    const hasQuery = query.length > 0;
    return birthdayFilteredStudents.filter((student) => {
      if (!student.birthDate) return false;
      const date = parseIsoDate(student.birthDate);
      if (!date) return false;
      if (birthdayMonthFilter !== "Todas" && date.getMonth() !== birthdayMonthFilter) {
        return false;
      }
      if (!hasQuery) return true;
      const cls = classes.find((item) => item.id === student.classId) ?? null;
      const unitName = unitLabel(cls?.unit ?? "");
      const className = cls?.name ?? "";
      const monthLabel = monthNames[date.getMonth()] ?? "";
      const dayLabel = String(date.getDate()).padStart(2, "0");
      const yearLabel = String(date.getFullYear());
      const shortDate = formatShortDate(student.birthDate);
      const haystack = normalizeSearch(
        `${student.name} ${monthLabel} ${dayLabel} ${yearLabel} ${shortDate} ${unitName} ${className}`
      );
      return haystack.includes(query);
    });
  }, [
    birthdayFilteredStudents,
    birthdayMonthFilter,
    birthdaySearch,
    classes,
    normalizeSearch,
    unitLabel,
  ]);
  const studentsFiltered = useMemo(() => {
    const filteredByUnit =
      studentsUnitFilter === "Todas"
        ? students
        : students.filter((student) => {
            const cls = classes.find((item) => item.id === student.classId) ?? null;
            return unitLabel(cls?.unit ?? "") === studentsUnitFilter;
          });
    return filteredByUnit;
  }, [studentsUnitFilter, classes, students, unitLabel]);
  const classById = useMemo(() => {
    return new Map(classes.map((item) => [item.id, item] as const));
  }, [classes]);
  const toggleUnitExpanded = useCallback(
    (unitName: string) => {
      setExpandedUnits((prev) => ({
        ...prev,
        [unitName]: !prev[unitName],
      }));
    },
    [setExpandedUnits]
  );
  const toggleClassExpanded = useCallback(
    (classIdValue: string) => {
      setExpandedClasses((prev) => ({
        ...prev,
        [classIdValue]: !prev[classIdValue],
      }));
    },
    [setExpandedClasses]
  );
  const studentsGrouped = useMemo(() => {
    const unitMap = new Map<string, Map<string, Student[]>>();
    studentsFiltered.forEach((student) => {
      const cls = classById.get(student.classId) ?? null;
      const unitName = unitLabel(cls?.unit ?? "");
      const classKey = cls?.id ?? `missing:${student.classId || "none"}`;
      if (!unitMap.has(unitName)) unitMap.set(unitName, new Map());
      const classMap = unitMap.get(unitName)!;
      if (!classMap.has(classKey)) classMap.set(classKey, []);
      classMap.get(classKey)!.push(student);
    });
    return Array.from(unitMap.entries())
      .map(([unitName, classMap]) => {
        const classesInUnit = Array.from(classMap.entries())
          .map(([classKey, items]) => {
            const cls = classById.get(items[0].classId) ?? null;
            const className = cls?.name?.trim() || "Sem turma";
            const palette =
              cls
                ? getClassPalette(cls.colorKey, colors, unitName)
                : getUnitPalette(unitName, colors) ?? {
                    bg: colors.primaryBg,
                    text: colors.primaryText,
                  };
            const scheduleLabel = formatClassScheduleLabel(cls);
            const sortedStudents = [...items].sort((a, b) =>
              a.name.localeCompare(b.name, "pt-BR")
            );
            return {
              classId: classKey,
              className,
              gender: cls?.gender ?? "misto",
              scheduleLabel,
              palette,
              students: sortedStudents,
            };
          })
          .sort((a, b) => {
            const aClass =
              classById.get(a.classId) ??
              ({
                name: a.className,
                daysOfWeek: null,
                startTime: null,
                organizationId: "",
              } as ClassGroup);
            const bClass =
              classById.get(b.classId) ??
              ({
                name: b.className,
                daysOfWeek: null,
                startTime: null,
                organizationId: "",
              } as ClassGroup);
            return compareClassesBySchedule(aClass, bClass);
          });
        return { unitName, classes: classesInUnit };
      })
      .sort((a, b) => a.unitName.localeCompare(b.unitName, "pt-BR"));
  }, [classById, colors, studentsFiltered, unitLabel]);
  const birthdayTodayAll = useMemo(() => {
    return students.filter((student) => {
      if (!student.birthDate) return false;
      const date = parseIsoDate(student.birthDate);
      if (!date) return false;
      return (
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
      );
    });
  }, [students, today]);
  const birthdayToday = useMemo(() => {
    return birthdayVisibleStudents.filter((student) => {
      if (!student.birthDate) return false;
      const date = parseIsoDate(student.birthDate);
      if (!date) return false;
      return (
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
      );
    });
  }, [birthdayVisibleStudents, today]);
  const upcomingBirthdays = useMemo(() => {
    const withDates = birthdayVisibleStudents
      .filter((student) => {
        if (!student.birthDate) return false;
        const date = parseIsoDate(student.birthDate);
        if (!date) return false;
        return !hasBirthdayPassed(date, today) && getDaysUntilBirthday(date, today) > 0;
      })
      .map((student) => {
        const date = parseIsoDate(student.birthDate)!;
        const daysLeft = getDaysUntilBirthday(date, today);
        return { student, date, daysLeft };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);
    return withDates.slice(0, 8);
  }, [birthdayVisibleStudents, today]);

  const birthdayMonthGroups = useMemo<BirthdayMonthGroup[]>(() => {
    const byMonth = new Map<number, Map<string, BirthdayEntry[]>>();
    birthdayVisibleStudents.forEach((student) => {
      if (!student.birthDate) return;
      const date = parseIsoDate(student.birthDate);
      if (!date) return;
      const month = date.getMonth();
      const cls = classes.find((item) => item.id === student.classId);
      const unitName = unitLabel(cls.unit);
      if (!byMonth.has(month)) byMonth.set(month, new Map());
      const monthMap = byMonth.get(month)!;
      if (!monthMap.has(unitName)) monthMap.set(unitName, []);
      monthMap.get(unitName)!.push({ student, date, unitName });
    });
    return Array.from(byMonth.entries())
      .sort((a, b) => a[0] - b[0])
      .map(
        ([month, unitMap]) =>
          [
            month,
            Array.from(unitMap.entries()).sort((a, b) => a[0].localeCompare(b[0])),
          ] as BirthdayMonthGroup
      );
  }, [birthdayVisibleStudents, classes, unitLabel]);

  useEffect(() => {
    if (!birthdayTodayAll.length) return;
    const todayKey = formatIsoDate(today);
    if (lastBirthdayNotice === todayKey) return;
    const names = birthdayTodayAll.map((student) => student.name);
    void notifyBirthdays(names);
    setLastBirthdayNotice(todayKey);
  }, [birthdayTodayAll, lastBirthdayNotice, setLastBirthdayNotice, today]);

  useEffect(() => {
    return () => {
      if (saveNoticeTimer.current) {
        clearTimeout(saveNoticeTimer.current);
      }
    };
  }, []);

  const StudentRow = useMemo(
    () =>
      memo(function StudentRowItem({
        item,
        onPress,
        onWhatsApp,
        onPhotoPress,
        className,
        unitName,
        classPalette,
      }: {
        item: Student;
        onPress: (student: Student) => void;
        onWhatsApp: (student: Student) => void;
        onPhotoPress: (student: Student) => void;
        className: string;
        unitName: string;
        classPalette: { bg: string; text: string };
      }) {
        const contact = getContactPhone(item);
        const disabled = contact.status === "missing";
        const nameParts = item.name.trim().split(/\s+/);
        const shortName = nameParts.slice(0, 2).join(" ");
        const restName = nameParts.slice(2).join(" ");
        return (
          <Pressable
            onPress={() => onPress(item)}
            style={{
              padding: 14,
              borderRadius: 18,
              backgroundColor: colors.background,
              borderWidth: 1,
              borderColor: classPalette.bg,
              shadowColor: "#000",
              shadowOpacity: 0.08,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 8 },
              elevation: 3,
              gap: 6,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ flex: 1, gap: 6, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Pressable
                    onPress={() => onPhotoPress(item)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: colors.secondaryBg,
                      borderWidth: 1,
                      borderColor: colors.border,
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                    }}
                  >
                    {item.photoUrl ? (
                      <Image
                        source={{ uri: item.photoUrl }}
                        style={{ width: "100%", height: "100%" }}
                        contentFit="cover"
                      />
                    ) : (
                      <Ionicons name="person" size={18} color={colors.text} />
                    )}
                  </Pressable>
                  <FadeHorizontalScroll
                    containerStyle={{ flex: 1, minWidth: 0 }}
                    fadeColor={colors.card}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "700",
                        color: colors.text,
                      }}
                      numberOfLines={1}
                    >
                      {shortName}
                      {restName ? " " + restName : ""}
                    </Text>
                  </FadeHorizontalScroll>
                </View>
              </View>
              <Pressable
                onPress={() => onWhatsApp(item)}
                disabled={disabled}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  backgroundColor: disabled ? colors.secondaryBg : "#25D366",
                  opacity: disabled ? 0.5 : 1,
                }}
              >
                <MaterialCommunityIcons
                  name="whatsapp"
                  size={18}
                  color={disabled ? colors.muted : "white"}
                />
              </Pressable>
            </View>
          </Pressable>
        );
      }),
    [colors]
  );

  const SelectOption = useMemo(
    () =>
      memo(function SelectOptionItem({
        label,
        value,
        active,
        onSelect,
        isFirst,
      }: {
        label: string;
        value: string;
        active: boolean;
        onSelect: (value: string) => void;
        isFirst: boolean;
      }) {
        return (
          <Pressable
            onPress={() => onSelect(value)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 10,
              borderRadius: 10,
              margin: isFirst ? 6 : 2,
              backgroundColor: active ? colors.primaryBg : "transparent",
            }}
          >
            <Text
              style={{
                color: active ? colors.primaryText : colors.text,
                fontSize: 12,
                fontWeight: active ? "700" : "500",
              }}
            >
              {label}
            </Text>
          </Pressable>
        );
      }),
    [colors]
  );

  const ClassOption = useMemo(
    () =>
      memo(function ClassOptionItem({
        item,
        active,
        onSelect,
        isFirst,
      }: {
        item: ClassGroup;
        active: boolean;
        onSelect: (value: ClassGroup) => void;
        isFirst: boolean;
      }) {
        return (
          <Pressable
            onPress={() => onSelect(item)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 10,
              borderRadius: 10,
              margin: isFirst ? 6 : 2,
              backgroundColor: active ? colors.primaryBg : "transparent",
            }}
          >
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              <Text
                style={{
                  color: active ? colors.primaryText : colors.text,
                  fontSize: 12,
                  fontWeight: active ? "700" : "500",
                }}
              >
                {getClassLabel(item)}
              </Text>
              <ClassGenderBadge gender={item.gender} />
            </View>
            <Text
              style={{
                color: active ? colors.primaryText : colors.muted,
                fontSize: 11,
                marginTop: 2,
              }}
            >
              {unitLabel(item.unit)}
            </Text>
          </Pressable>
        );
      }),
    [colors, getClassLabel, unitLabel]
  );

  const renderStudentItem = useCallback(
    ({
      item,
      paletteOverride,
      classNameOverride,
      unitNameOverride,
    }: {
      item: Student;
      paletteOverride: { bg: string; text: string };
      classNameOverride: string;
      unitNameOverride: string;
    }) => {
      const cls = classById.get(item.classId) ?? null;
      const unitName = unitNameOverride || unitLabel(cls?.unit ?? "");
      const classPalette =
        paletteOverride ??
        (cls
          ? getClassPalette(cls.colorKey, colors, unitName)
          : getUnitPalette(unitName, colors) ?? {
              bg: colors.primaryBg,
              text: colors.primaryText,
            });
      const className = classNameOverride || getClassName(item.classId);
      return (
        <StudentRow
          item={item}
          onPress={onEdit}
          onWhatsApp={openStudentWhatsApp}
          onPhotoPress={openPhotoPreview}
          className={className}
          unitName={unitName}
          classPalette={classPalette}
        />
      );
    },
    [
      StudentRow,
      classById,
      colors,
      getClassName,
      onEdit,
      openPhotoPreview,
      openStudentWhatsApp,
      unitLabel,
    ]
  );

  const studentKeyExtractor = useCallback(
    (item: Student) => String(item.id),
    []
  );

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 24, paddingHorizontal: 16, paddingTop: 16 }}>
          <View style={{ gap: 10 }}>
            <ShimmerBlock style={{ height: 28, width: 140, borderRadius: 12 }} />
            <ShimmerBlock style={{ height: 16, width: 220, borderRadius: 8 }} />
          </View>
          <View style={{ gap: 10 }}>
            <ShimmerBlock style={{ height: 38, borderRadius: 20 }} />
            <ShimmerBlock style={{ height: 38, borderRadius: 20 }} />
          </View>
          <View style={{ gap: 10 }}>
            <ShimmerBlock style={{ height: 38, borderRadius: 20 }} />
          </View>
          <View style={{ gap: 12 }}>
            {Array.from({ length: 5 }).map((_, index) => (
              <ShimmerBlock key={`student-shimmer-${index}`} style={{ height: 72, borderRadius: 18 }} />
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <View ref={containerRef} style={{ flex: 1, position: "relative", overflow: "visible" }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 24, gap: 16, paddingHorizontal: 16, paddingTop: 16 }}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={closeAllPickers}
        onScroll={syncPickerLayouts}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await load();
              } finally {
                setRefreshing(false);
              }
            }}
            tintColor={colors.text}
            colors={[colors.text]}
          />
        }
      >
        <ScreenHeader title="Alunos" subtitle="Lista de chamada por turma" />

        <ConfirmCloseOverlay
          visible={showStudentsTabConfirm}
          onCancel={() => {
            setShowStudentsTabConfirm(false);
            setPendingStudentsTab(null);
          }}
          onConfirm={() => {
            setShowStudentsTabConfirm(false);
            resetForm();
            setStudentsTab(pendingStudentsTab ?? "alunos");
            setPendingStudentsTab(null);
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
          {[
            { id: "alunos" as const, label: "Alunos" },
            { id: "cadastro" as const, label: "Cadastro" },
            { id: "aniversários" as const, label: "Aniversários" },
          ].map((tab) => {
            const selected = studentsTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => requestSwitchStudentsTab(tab.id)}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: selected ? colors.primaryBg : colors.card,
                  borderWidth: selected ? 0 : 1,
                  borderColor: selected ? "transparent" : colors.border,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: selected ? colors.primaryText : colors.muted,
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

        {studentsTab === "cadastro" && (
          <View
            style={[
              getSectionCardStyle(colors, "success", { padding: 16, radius: 20 }),
              { borderLeftWidth: 1, borderLeftColor: colors.border },
            ]}
          >
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Pressable
                  onPress={() => setShowPhotoSheet(true)}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: colors.secondaryBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  {photoUrl ? (
                    <Image
                      source={{ uri: photoUrl }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                    />
                  ) : (
                    <Ionicons name="person" size={20} color={colors.text} />
                  )}
                </Pressable>
                <Pressable
                  onPress={() => setShowPhotoSheet(true)}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor: colors.secondaryBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>
                    Adicionar foto
                  </Text>
                </Pressable>
              </View>
              <TextInput
                placeholder="Nome do aluno"
                value={name}
                onChangeText={setName}
                onBlur={() => setName(formatName(name))}
                placeholderTextColor={colors.placeholder}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: colors.background,
                  color: colors.inputText,
                }}
              />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
                  <Text style={{ color: colors.muted }}>Unidade</Text>
                  <View ref={unitTriggerRef}>
                    <Pressable
                      onPress={() => toggleFormPicker("unit")}
                      style={selectFieldStyle}
                    >
                      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                        {unit || "Selecione a unidade"}
                      </Text>
                      <Ionicons
                        name="chevron-down"
                        size={16}
                        color={colors.muted}
                        style={{ transform: [{ rotate: showUnitPicker ? "180deg" : "0deg" }] }}
                      />
                    </Pressable>
                  </View>
                </View>
                <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
                  <Text style={{ color: colors.muted }}>Turma</Text>
                  <View ref={classTriggerRef}>
                    <Pressable
                      onPress={() => toggleFormPicker("class")}
                      style={selectFieldStyle}
                    >
                      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                        {selectedClassName || "Selecione a turma"}
                      </Text>
                      <Ionicons
                        name="chevron-down"
                        size={16}
                        color={colors.muted}
                        style={{ transform: [{ rotate: showClassPicker ? "180deg" : "0deg" }] }}
                      />
                    </Pressable>
                  </View>
                </View>
              </View>
              { studentFormError ? (
                <Text style={{ color: colors.dangerText, fontSize: 12 }}>
                  {studentFormError}
                </Text>
              ) : null}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
                  <DateInput
                    value={birthDate}
                    onChange={setBirthDate}
                    placeholder="Data de nascimento"
                    onOpenCalendar={() => setShowCalendar(true)}
                  />
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {ageNumber !== null
                       ? `Idade: ${ageNumber} anos`
                      : "Idade calculada automaticamente"}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
              <TextInput
                placeholder="Telefone"
                value={phone}
                onChangeText={(value) => setPhone(formatPhone(value))}
                keyboardType="phone-pad"
                placeholderTextColor={colors.placeholder}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      padding: 12,
                      borderRadius: 12,
                      backgroundColor: colors.background,
                      color: colors.inputText,
                    }}
                  />
                </View>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
                  <Text style={{ color: colors.muted }}>Email do aluno (login)</Text>
                  <TextInput
                    placeholder="email@exemplo.com"
                    value={loginEmail}
                    onChangeText={setLoginEmail}
                    onBlur={() => setLoginEmail(formatEmail(loginEmail))}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholderTextColor={colors.placeholder}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      padding: 12,
                      borderRadius: 12,
                      backgroundColor: colors.background,
                      color: colors.inputText,
                    }}
                  />
                </View>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
                  <TextInput
                    placeholder="Nome do responsável"
                    value={guardianName}
                    onChangeText={setGuardianName}
                    onBlur={() => setGuardianName(formatName(guardianName))}
                    placeholderTextColor={colors.placeholder}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      padding: 12,
                      borderRadius: 12,
                      backgroundColor: colors.background,
                      color: colors.inputText,
                    }}
                  />
                </View>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
                  <Text style={{ color: colors.muted }}>Telefone do responsável</Text>
                  <TextInput
                    placeholder="Telefone do responsável"
                    value={guardianPhone}
                    onChangeText={(value) => setGuardianPhone(formatPhone(value))}
                    keyboardType="phone-pad"
                    placeholderTextColor={colors.placeholder}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      padding: 12,
                      borderRadius: 12,
                      backgroundColor: colors.background,
                      color: colors.inputText,
                    }}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
                  <Text style={{ color: colors.muted }}>Parentesco</Text>
                  <View ref={guardianRelationTriggerRef}>
                    <Pressable
                      onPress={() => toggleFormPicker("guardianRelation")}
                      style={selectFieldStyle}
                    >
                      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                        {guardianRelation || "Selecione"}
                      </Text>
                      <Ionicons
                        name="chevron-down"
                        size={16}
                        color={colors.muted}
                        style={{
                          transform: [
                            { rotate: showGuardianRelationPicker ? "180deg" : "0deg" },
                          ],
                        }}
                      />
                    </Pressable>
                  </View>
                </View>
              </View>

              <View style={{ gap: 8 }}>
                <Pressable
                  onPress={() => setShowHealthSection((prev) => !prev)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor: colors.background,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700" }}>Saúde do aluno</Text>
                  <Ionicons
                    name={showHealthSection ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={colors.muted}
                  />
                </Pressable>
                { showHealthSectionContent ? (
                  <Animated.View style={[healthSectionAnimStyle, { gap: 8 }]}>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                      <View style={{ flex: 1, minWidth: 160, gap: 8 }}>
                        <Text style={{ color: colors.muted }}>
                          Observações sobre saúde do aluno
                        </Text>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <Pressable
                            onPress={() => {
                              setHealthIssue(false);
                              setHealthIssueNotes("");
                            }}
                            style={{
                              paddingVertical: 8,
                              paddingHorizontal: 12,
                              borderRadius: 999,
                              backgroundColor: !healthIssue
                                ? colors.primaryBg
                                : colors.secondaryBg,
                              borderWidth: 1,
                              borderColor: !healthIssue ? colors.primaryBg : colors.border,
                            }}
                          >
                            <Text
                              style={{
                                color: !healthIssue ? colors.primaryText : colors.text,
                                fontWeight: "700",
                              }}
                            >
                              Não
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => setHealthIssue(true)}
                            style={{
                              paddingVertical: 8,
                              paddingHorizontal: 12,
                              borderRadius: 999,
                              backgroundColor: healthIssue
                                ? colors.primaryBg
                                : colors.secondaryBg,
                              borderWidth: 1,
                              borderColor: healthIssue ? colors.primaryBg : colors.border,
                            }}
                          >
                            <Text
                              style={{
                                color: healthIssue ? colors.primaryText : colors.text,
                                fontWeight: "700",
                              }}
                            >
                              Sim
                            </Text>
                          </Pressable>
                        </View>
                        { healthIssue ? (
                          <TextInput
                            placeholder="Descreva a observação"
                            value={healthIssueNotes}
                            onChangeText={setHealthIssueNotes}
                            placeholderTextColor={colors.placeholder}
                            multiline
                            style={{
                              borderWidth: 1,
                              borderColor: colors.border,
                              padding: 12,
                              borderRadius: 12,
                              backgroundColor: colors.background,
                              color: colors.inputText,
                              minHeight: 70,
                              textAlignVertical: "top",
                            }}
                          />
                        ) : null}
                      </View>
                      <View style={{ flex: 1, minWidth: 160, gap: 8 }}>
                        <Text style={{ color: colors.muted }}>Uso contínuo de medicação</Text>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <Pressable
                            onPress={() => {
                              setMedicationUse(false);
                              setMedicationNotes("");
                            }}
                            style={{
                              paddingVertical: 8,
                              paddingHorizontal: 12,
                              borderRadius: 999,
                              backgroundColor: !medicationUse
                                ? colors.primaryBg
                                : colors.secondaryBg,
                              borderWidth: 1,
                              borderColor: !medicationUse ? colors.primaryBg : colors.border,
                            }}
                          >
                            <Text
                              style={{
                                color: !medicationUse ? colors.primaryText : colors.text,
                                fontWeight: "700",
                              }}
                            >
                              Não
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => setMedicationUse(true)}
                            style={{
                              paddingVertical: 8,
                              paddingHorizontal: 12,
                              borderRadius: 999,
                              backgroundColor: medicationUse
                                ? colors.primaryBg
                                : colors.secondaryBg,
                              borderWidth: 1,
                              borderColor: medicationUse ? colors.primaryBg : colors.border,
                            }}
                          >
                            <Text
                              style={{
                                color: medicationUse ? colors.primaryText : colors.text,
                                fontWeight: "700",
                              }}
                            >
                              Sim
                            </Text>
                          </Pressable>
                        </View>
                        { medicationUse ? (
                          <TextInput
                            placeholder="Qual medicação?"
                            value={medicationNotes}
                            onChangeText={setMedicationNotes}
                            placeholderTextColor={colors.placeholder}
                            multiline
                            style={{
                              borderWidth: 1,
                              borderColor: colors.border,
                              padding: 12,
                              borderRadius: 12,
                              backgroundColor: colors.background,
                              color: colors.inputText,
                              minHeight: 70,
                              textAlignVertical: "top",
                            }}
                          />
                        ) : null}
                      </View>
                    </View>
                    <View style={{ gap: 6 }}>
                      <Text style={{ color: colors.muted }}>Observações</Text>
                      <TextInput
                        placeholder="Outras observações"
                        value={healthObservations}
                        onChangeText={setHealthObservations}
                        placeholderTextColor={colors.placeholder}
                        multiline
                        style={{
                          borderWidth: 1,
                          borderColor: colors.border,
                          padding: 12,
                          borderRadius: 12,
                          backgroundColor: colors.background,
                          color: colors.inputText,
                          minHeight: 80,
                          textAlignVertical: "top",
                        }}
                      />
                    </View>
                  </Animated.View>
                ) : null}
              </View>

              <Button
                label={editingId ? "Salvar alterações" : "Adicionar aluno"}
                onPress={onSave}
                disabled={!canSaveStudent}
              />
              { editingId ? (
                <Button
                  label="Cancelar edição"
                  variant="secondary"
                  onPress={() => {
                    if (isFormDirty) {
                      confirmDialog({
                        title: "Sair sem salvar?",
                        message: "Você tem alterações não salvas.",
                        confirmLabel: "Descartar",
                        cancelLabel: "Continuar",
                        onConfirm: () => {
                          resetForm();
                        },
                      });
                      return;
                    }
                    resetForm();
                  }}
                />
              ) : null}
            </View>
          </View>
        )}

        {studentsTab === "aniversários" && (
          <View style={{ gap: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontSize: 22, fontWeight: "800", color: colors.text }}>
                  Olá!
                </Text>
                <Text style={{ color: colors.muted, fontSize: 13 }}>
                  {birthdayToday.length
                    ? (() => {
                        const first = birthdayToday[0]?.name ?? "";
                        if (birthdayToday.length === 1) {
                          return `Hoje é aniversário de ${first}.`;
                        }
                        return `Hoje é aniversário de ${first} e mais ${
                          birthdayToday.length - 1
                        } pessoa(s).`;
                      })()
                    : "Sem aniversários hoje."}
                </Text>
              </View>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: colors.secondaryBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {birthdayToday[0]?.photoUrl ? (
                  <Image
                    source={{ uri: birthdayToday[0].photoUrl }}
                    style={{ width: "100%", height: "100%" }}
                  />
                ) : (
                  <Ionicons name="person" size={20} color={colors.muted} />
                )}
              </View>
            </View>

            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.muted }}>
                Mês
              </Text>
              <FadeHorizontalScroll
                fadeColor={colors.background}
                contentContainerStyle={{ flexDirection: "row", gap: 8 }}
              >
                {["Todas", ...monthNames].map((label, index) => {
                  const value = label === "Todas" ? "Todas" : index - 1;
                  const active = birthdayMonthFilter === value;
                  return (
                    <Pressable
                      key={`${label}-${index}`}
                      onPress={() => setBirthdayMonthFilter(value)}
                      onContextMenu={(event: any) => event.preventDefault()}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        borderRadius: 999,
                        backgroundColor: active ? colors.primaryBg : colors.secondaryBg,
                        borderWidth: 1,
                        borderColor: active ? "transparent" : colors.border,
                      }}
                    >
                      <Text
                        style={{
                          color: active ? colors.primaryText : colors.text,
                          fontWeight: active ? "700" : "500",
                          fontSize: 12,
                        }}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </FadeHorizontalScroll>
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 14,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Ionicons name="search" size={16} color={colors.muted} />
              <TextInput
                placeholder="Buscar nomes, datas e meses"
                placeholderTextColor={colors.placeholder}
                value={birthdaySearch}
                onChangeText={setBirthdaySearch}
                style={{ flex: 1, color: colors.inputText, fontSize: 13 }}
              />
              {birthdaySearch ? (
                <Pressable
                  onPress={() => setBirthdaySearch("")}
                  onContextMenu={(event: any) => event.preventDefault()}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: colors.secondaryBg,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="close" size={14} color={colors.muted} />
                </Pressable>
              ) : null}
            </View>

            <View
              style={{
                borderRadius: 24,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                overflow: "hidden",
              }}
            >
              <LinearGradient
                colors={[colors.secondaryBg, colors.card]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  bottom: 0,
                  left: 0,
                }}
              />
              <View style={{ padding: 16, gap: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="gift" size={18} color={colors.text} />
                  <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>
                    Aniversário de hoje 🎉
                  </Text>
                </View>
                {birthdayToday.length ? (
                  birthdayToday.map((student) => {
                    const cls = classes.find((item) => item.id === student.classId) ?? null;
                    const unitName = unitLabel(cls?.unit ?? "");
                    const age = calculateAge(student.birthDate);
                    return (
                      <View
                        key={student.id}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 12,
                          padding: 10,
                          borderRadius: 14,
                          backgroundColor: colors.background,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        {student.photoUrl ? (
                          <Image
                            source={{ uri: student.photoUrl }}
                            style={{ width: 40, height: 40, borderRadius: 20 }}
                          />
                        ) : (
                          <View
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 20,
                              backgroundColor: colors.secondaryBg,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Ionicons name="person" size={20} color={colors.muted} />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>
                            {student.name}
                          </Text>
                          <Text style={{ color: colors.muted, marginTop: 2, fontSize: 12 }}>
                            {age ? `${age} anos` : "Idade não informada"} - {unitName}
                          </Text>
                        </View>
                        <Ionicons name="balloon" size={18} color={colors.primaryText} />
                      </View>
                    );
                  })
                ) : (
                  <Text style={{ color: colors.muted, fontSize: 13 }}>
                    Sem aniversariantes hoje.
                  </Text>
                )}
              </View>
            </View>

            {upcomingBirthdays.length ? (
              <View style={{ gap: 10 }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
                    Próximos aniversários
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {upcomingBirthdays.length} próximos
                  </Text>
                </View>
                <FadeHorizontalScroll
                  fadeColor={colors.background}
                  contentContainerStyle={{ flexDirection: "row", gap: 12 }}
                >
                  {upcomingBirthdays.map(({ student, date, daysLeft }) => {
                    const age = calculateAge(student.birthDate);
                    return (
                      <View
                        key={`upcoming-${student.id}`}
                        style={{
                          width: 170,
                          padding: 14,
                          borderRadius: 20,
                          backgroundColor: colors.card,
                          borderWidth: 1,
                          borderColor: colors.border,
                          minHeight: 220,
                          justifyContent: "space-between",
                        }}
                      >
                        <View style={{ gap: 10, alignItems: "center" }}>
                          {student.photoUrl ? (
                            <Image
                              source={{ uri: student.photoUrl }}
                              style={{
                                width: 56,
                                height: 56,
                                borderRadius: 28,
                              }}
                            />
                          ) : (
                            <View
                              style={{
                                width: 56,
                                height: 56,
                                borderRadius: 28,
                                backgroundColor: colors.secondaryBg,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Ionicons name="person" size={26} color={colors.muted} />
                            </View>
                          )}
                          <View
                            style={{
                              gap: 4,
                              minHeight: 64,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Text
                              numberOfLines={2}
                              style={{
                                color: colors.text,
                                fontWeight: "700",
                                fontSize: 13,
                                textAlign: "center",
                              }}
                            >
                              {student.name}
                            </Text>
                            <Text
                              style={{ color: colors.muted, fontSize: 12, textAlign: "center" }}
                            >
                              {monthNames[date.getMonth()]} {date.getDate()}
                            </Text>
                            {age ? (
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 4,
                                }}
                              >
                                <Ionicons
                                  name="gift-outline"
                                  size={12}
                                  color={colors.primaryText}
                                />
                                <Text
                                  style={{
                                    color: colors.primaryText,
                                    fontSize: 12,
                                    fontWeight: "600",
                                  }}
                                >
                                  {age} anos
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                        <View
                          style={{
                            paddingVertical: 6,
                            paddingHorizontal: 10,
                            borderRadius: 12,
                            backgroundColor: colors.primaryBg,
                            minHeight: 32,
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            style={{
                              color: colors.primaryText,
                              fontSize: 12,
                              fontWeight: "700",
                              textAlign: "center",
                            }}
                          >
                            {daysLeft === 1 ? "Amanhã" : `${daysLeft} dias`}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </FadeHorizontalScroll>
              </View>
            ) : (
              <View
                style={{
                  padding: 14,
                  borderRadius: 16,
                  backgroundColor: colors.secondaryBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>
                  Sem próximos aniversários
                </Text>
                <Text style={{ color: colors.muted, marginTop: 4, fontSize: 12 }}>
                  Ajuste o mês ou a busca para ver mais resultados.
                </Text>
              </View>
            )}

            <View style={{ gap: 10 }}>
              <Pressable
                onPress={() => setShowAllBirthdays((prev) => !prev)}
                onContextMenu={(event: any) => event.preventDefault()}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 16,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
                  Todos os aniversários
                </Text>
                <Ionicons
                  name={showAllBirthdays ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={colors.muted}
                />
              </Pressable>
              { showAllBirthdaysContent ? (
                <Animated.View style={[allBirthdaysAnimStyle, { gap: 12 }] }>
                  <View
                    style={{
                      padding: 12,
                      borderRadius: 16,
                      backgroundColor: colors.card,
                      borderWidth: 1,
                      borderColor: colors.border,
                      gap: 8,
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
                      Unidade
                    </Text>
                    <FadeHorizontalScroll
                      fadeColor={colors.card}
                      contentContainerStyle={{ flexDirection: "row", gap: 8 }}
                    >
                      {birthdayUnitOptions.map((unit) => {
                        const active = birthdayUnitFilter === unit;
                        const palette = unit === "Todas" ? null : getUnitPalette(unit, colors);
                        const chipBg = active
                          ? palette?.bg ?? colors.primaryBg
                          : colors.secondaryBg;
                        const chipText = active
                          ? palette?.text ?? colors.primaryText
                          : colors.text;
                        return (
                          <Pressable
                            key={unit}
                            onPress={() => setBirthdayUnitFilter(unit)}
                            onContextMenu={(event: any) => event.preventDefault()}
                            style={{
                              paddingVertical: 6,
                              paddingHorizontal: 10,
                              borderRadius: 999,
                              backgroundColor: chipBg,
                            }}
                          >
                            <Text
                              style={{
                                color: chipText,
                                fontWeight: active ? "700" : "500",
                              }}
                            >
                              {unit}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </FadeHorizontalScroll>
                  </View>

                  {birthdayMonthGroups.length ? (
                    birthdayMonthGroups.map(([month, unitGroups]) => {
                      const monthKey = `m-${month}`;
                      const totalCount = unitGroups.reduce(
                        (sum, [, entries]) => sum + entries.length,
                        0
                      );
                      return (
                        <View
                          key={monthKey}
                          style={{
                            padding: 14,
                            borderRadius: 18,
                            backgroundColor: colors.card,
                            borderWidth: 1,
                            borderColor: colors.border,
                            gap: 10,
                          }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                            }}
                          >
                            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>
                              {monthNames[month]}
                            </Text>
                            <View
                              style={{
                                paddingVertical: 4,
                                paddingHorizontal: 8,
                                borderRadius: 8,
                                backgroundColor: colors.secondaryBg,
                              }}
                            >
                              <Text
                                style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}
                              >
                                {totalCount}
                              </Text>
                            </View>
                          </View>

                          {unitGroups.map(([unitName, entries]) => {
                            const unitKey = `m-${month}-u-${unitName}`;
                            const palette =
                              getUnitPalette(unitName, colors) ?? {
                                bg: colors.primaryBg,
                                text: colors.primaryText,
                              };
                            return (
                              <View key={unitKey} style={{ gap: 6 }}>
                                <View
                                  style={{
                                    flexDirection: "row",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                  }}
                                >
                                  <View
                                    style={{
                                      paddingVertical: 4,
                                      paddingHorizontal: 10,
                                      borderRadius: 999,
                                      backgroundColor: palette.bg,
                                    }}
                                  >
                                    <Text
                                      style={{
                                        color: palette.text,
                                        fontWeight: "700",
                                        fontSize: 12,
                                      }}
                                    >
                                      {unitName}
                                    </Text>
                                  </View>
                                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                                    {entries.length === 1
                                      ? "1 aluno"
                                      : `${entries.length} alunos`}
                                  </Text>
                                </View>
                                <View style={{ gap: 8 }}>
                                  {entries
                                    .sort((a, b) => a.date.getDate() - b.date.getDate())
                                    .map(({ student, date }) => {
                                      const cls =
                                        classes.find((item) => item.id === student.classId) ??
                                        null;
                                      const className = cls?.name ?? "Turma";
                                      return (
                                        <View
                                          key={student.id}
                                          style={{
                                            padding: 12,
                                            borderRadius: 14,
                                            backgroundColor: colors.background,
                                            borderWidth: 1,
                                            borderColor: colors.border,
                                          }}
                                        >
                                          <Text
                                            style={{
                                              color: colors.text,
                                              fontWeight: "700",
                                              fontSize: 13,
                                            }}
                                          >
                                            {String(date.getDate()).padStart(2, "0")} - {student.name}
                                          </Text>
                                          <Text
                                            style={{
                                              color: colors.muted,
                                              marginTop: 4,
                                              fontSize: 12,
                                            }}
                                          >
                                            {formatShortDate(student.birthDate)} | {className}
                                          </Text>
                                        </View>
                                      );
                                    })}
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      );
                    })
                  ) : (
                    <View
                      style={{
                        padding: 12,
                        borderRadius: 16,
                        backgroundColor: colors.secondaryBg,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text style={{ color: colors.text, fontWeight: "700" }}>
                        Sem aniversários
                      </Text>
                      <Text style={{ color: colors.muted, marginTop: 4 }}>
                        Nenhum aluno com data de nascimento.
                      </Text>
                    </View>
                  )}
                </Animated.View>
              ) : null}
            </View>
          </View>
        )}


        {studentsTab === "alunos" && (
          <View style={{ gap: 12 }}>
            <UnitFilterBar
              units={studentsUnitOptions}
              selectedUnit={studentsUnitFilter}
              onSelectUnit={setStudentsUnitFilter}
            />

            <View style={{ gap: 8 }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
                  Alunos
                </Text>
              </View>

              { studentsGrouped.length > 0 ? (
                <View style={{ gap: 12 }}>
                  {studentsGrouped.map(({ unitName, classes: unitClasses }) => (
                    <View key={unitName} style={{ gap: 8 }}>
                      {(() => {
                        const unitExpanded = !!expandedUnits[unitName];
                        return (
                          <>
                            <Pressable
                              onPress={() => toggleUnitExpanded(unitName)}
                              style={{
                                paddingVertical: 7,
                                paddingHorizontal: 10,
                                borderRadius: 12,
                                backgroundColor: colors.background,
                                borderWidth: 1,
                                borderColor: colors.border,
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                              }}
                            >
                              <Text
                                style={{ fontSize: 14, fontWeight: "800", color: colors.text }}
                              >
                                {unitName}
                              </Text>
                              <Ionicons
                                name={unitExpanded ? "chevron-down" : "chevron-forward"}
                                size={16}
                                color={colors.muted}
                              />
                            </Pressable>
                            { unitExpanded ? (
                              <View
                                style={{
                                  gap: 10,
                                  marginLeft: 4,
                                  paddingLeft: 10,
                                  paddingTop: 6,
                                  borderLeftWidth: 2,
                                  borderLeftColor: colors.border,
                                }}
                              >
                                {unitClasses.map((group) => {
                                  const classExpanded = !!expandedClasses[group.classId];
                                  const groupPalette =
                                    group.palette ?? {
                                      bg: colors.primaryBg,
                                      text: colors.primaryText,
                                    };
                                  return (
                                    <View key={group.classId} style={{ gap: 6 }}>
                                      <Pressable
                                        onPress={() => toggleClassExpanded(group.classId)}
                                        style={{
                                          paddingVertical: 6,
                                          paddingHorizontal: 8,
                                          borderRadius: 10,
                                          backgroundColor: colors.background,
                                          borderWidth: 1,
                                          borderColor: colors.border,
                                          flexDirection: "row",
                                          alignItems: "center",
                                          justifyContent: "space-between",
                                          gap: 10,
                                        }}
                                      >
                                        {(() => {
                                          const items: { key: string; node: JSX.Element }[] = [
                                            {
                                              key: "name",
                                              node: (
                                                <Text
                                                  style={{
                                                    fontSize: 13,
                                                    fontWeight: "800",
                                                    color: colors.text,
                                                  }}
                                                  numberOfLines={1}
                                                >
                                                  {group.className}
                                                </Text>
                                              ),
                                            },
                                          ];
                                          if (group.gender) {
                                            items.push({
                                              key: "gender",
                                              node: <ClassGenderBadge gender={group.gender} size="sm" />,
                                            });
                                          }
                                          if (group.scheduleLabel) {
                                            items.push({
                                              key: "schedule",
                                              node: (
                                                <Text
                                                  style={{
                                                    fontSize: 11,
                                                    fontWeight: "700",
                                                    color: colors.muted,
                                                  }}
                                                >
                                                  {group.scheduleLabel}
                                                </Text>
                                              ),
                                            });
                                          }
                                          return (
                                            <View
                                              style={{
                                                flexDirection: "row",
                                                alignItems: "center",
                                                flexWrap: "wrap",
                                                gap: 6,
                                                minWidth: 0,
                                                flex: 1,
                                              }}
                                            >
                                              <View
                                                style={{
                                                  width: 8,
                                                  height: 8,
                                                  borderRadius: 999,
                                                  backgroundColor: groupPalette.bg,
                                                  marginRight: 2,
                                                }}
                                              />
                                              {items.map((entry, index) => (
                                                <View
                                                  key={entry.key}
                                                  style={{
                                                    flexDirection: "row",
                                                    alignItems: "center",
                                                    gap: 6,
                                                    minWidth: 0,
                                                  }}
                                                >
                                                  {index > 0 ? (
                                                    <View
                                                      style={{
                                                        width: 4,
                                                        height: 4,
                                                        borderRadius: 999,
                                                        backgroundColor: colors.muted,
                                                        opacity: 0.9,
                                                        marginHorizontal: 2,
                                                      }}
                                                    />
                                                  ) : null}
                                                  {entry.node}
                                                </View>
                                              ))}
                                            </View>
                                          );
                                        })()}
                                        <Ionicons
                                          name={classExpanded ? "chevron-down" : "chevron-forward"}
                                          size={16}
                                          color={colors.muted}
                                        />
                                      </Pressable>
                                      { classExpanded ? (
                                        <View
                                          style={{
                                            gap: 8,
                                            marginLeft: 4,
                                            paddingLeft: 10,
                                            borderLeftWidth: 2,
                                            borderLeftColor: groupPalette.bg,
                                          }}
                                        >
                                          {group.students.map((student) => (
                                            <View key={student.id}>
                                              {renderStudentItem({
                                                item: student,
                                                paletteOverride: groupPalette,
                                                classNameOverride: group.className,
                                                unitNameOverride: unitName,
                                              })}
                                            </View>
                                          ))}
                                        </View>
                                      ) : null}
                                    </View>
                                  );
                                })}
                              </View>
                            ) : null}
                          </>
                        );
                      })()}
                    </View>
                  ))}
                </View>
              ) : (
                <View
                  style={{
                    padding: 16,
                    borderRadius: 16,
                    backgroundColor: colors.secondaryBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700" }}>
                    Nenhum aluno encontrado
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {studentsUnitFilter === "Todas"
                       ? "Comece adicionando alunos"
                      : "Nenhum aluno nesta unidade"}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>

        <StudentsAnchoredDropdown
          visible={showUnitPickerContent}
          layout={unitTriggerLayout}
          container={containerWindow}
          animationStyle={unitPickerAnimStyle}
          zIndex={320}
          maxHeight={220}
          nestedScrollEnabled
          onRequestClose={closeAllPickers}
          panelStyle={{
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
          }}
          scrollContentStyle={{ padding: 4 }}
        >
          { unitOptions.length ? (
            unitOptions.map((item, index) => (
              <SelectOption
                key={item}
                label={item}
                value={item}
                active={item === unit}
                onSelect={handleSelectUnit}
                isFirst={index === 0}
              />
            ))
          ) : (
            <Text style={{ color: colors.muted, fontSize: 12, padding: 10 }}>
              Nenhuma unidade cadastrada.
            </Text>
          )}
        </StudentsAnchoredDropdown>

        <StudentsAnchoredDropdown
          visible={showClassPickerContent}
          layout={classTriggerLayout}
          container={containerWindow}
          animationStyle={classPickerAnimStyle}
          zIndex={320}
          maxHeight={240}
          nestedScrollEnabled
          onRequestClose={closeAllPickers}
          panelStyle={{
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
          }}
          scrollContentStyle={{ padding: 4 }}
        >
          { classOptions.length ? (
            classOptions.map((item, index) => (
              <ClassOption
                key={item.id}
                item={item}
                active={item.id === classId}
                onSelect={handleSelectClass}
                isFirst={index === 0}
              />
            ))
          ) : (
            <Text style={{ color: colors.muted, fontSize: 12, padding: 10 }}>
              Nenhuma turma encontrada.
            </Text>
          )}
        </StudentsAnchoredDropdown>
        <StudentsAnchoredDropdown
          visible={showGuardianRelationPickerContent}
          layout={guardianRelationTriggerLayout}
          container={containerWindow}
          animationStyle={guardianRelationPickerAnimStyle}
          zIndex={320}
          maxHeight={220}
          nestedScrollEnabled
          onRequestClose={closeAllPickers}
          panelStyle={{
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
          }}
          scrollContentStyle={{ padding: 4 }}
        >
          {guardianRelationOptions.map((item, index) => (
            <SelectOption
              key={item}
              label={item}
              value={item}
              active={item === guardianRelation}
              onSelect={handleSelectGuardianRelation}
              isFirst={index === 0}
            />
          ))}
        </StudentsAnchoredDropdown>
      </View>
      { saveNotice ? (
        <Animated.View
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 24,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 14,
            backgroundColor: colors.successBg,
            borderWidth: 1,
            borderColor: colors.successBg,
            shadowColor: "#000",
            shadowOpacity: 0.12,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 6 },
            elevation: 4,
            alignItems: "center",
            opacity: saveNoticeAnim,
            transform: [
              {
                translateY: saveNoticeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [8, 0],
                }),
              },
            ],
          }}
        >
          <Text style={{ color: colors.successText, fontWeight: "700" }}>
            {saveNotice}
          </Text>
        </Animated.View>
      ) : null}
      <ModalSheet
        visible={showEditModal}
        onClose={requestCloseEditModal}
        cardStyle={[
          editModalCardStyle,
          {
            maxHeight: "92%",
            minHeight: editModalStandardHeight,
            height: editModalStandardHeight,
            paddingBottom: 12,
            overflow: "hidden",
          },
        ]}
        position="center"
      >
        <View
          ref={editModalRef}
          onLayout={() => {
            editModalRef.current.measureInWindow((x, y) => {
              setEditContainerWindow({ x, y });
            });
          }}
          style={{ position: "relative", width: "100%", flex: 1, minHeight: 0 }}
        >
        <ConfirmCloseOverlay
          visible={showEditCloseConfirm}
          onCancel={() => setShowEditCloseConfirm(false)}
          onConfirm={() => {
            setShowEditCloseConfirm(false);
            closeEditModal();
          }}
        />
        <View style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12, paddingTop: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
              Editar aluno
            </Text>
            <Pressable
              onPress={requestCloseEditModal}
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
          <KeyboardAvoidingView
            style={{ width: "100%", flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
          >
            <ScrollView
              style={{ width: "100%", flex: 1 }}
              contentContainerStyle={{ paddingBottom: 24, paddingHorizontal: 12, paddingTop: 16 }}
              keyboardShouldPersistTaps="handled"
              onScrollBeginDrag={closeAllEditPickers}
              onScroll={syncEditPickerLayouts}
              scrollEventThrottle={16}
            >
              <View style={{ gap: 4 }}>
                <View style={{ gap: 16 }}>
                <View style={{ gap: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>
                    Dados do aluno
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Pressable
                      onPress={() => setShowPhotoSheet(true)}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: colors.secondaryBg,
                        borderWidth: 1,
                        borderColor: colors.border,
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                      }}
                    >
                      {photoUrl ? (
                        <Image
                          source={{ uri: photoUrl }}
                          style={{ width: "100%", height: "100%" }}
                          contentFit="cover"
                        />
                      ) : (
                        <Ionicons name="person" size={20} color={colors.text} />
                      )}
                    </Pressable>
                    <Pressable
                      onPress={() => setShowPhotoSheet(true)}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: 12,
                        backgroundColor: colors.secondaryBg,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>
                        Alterar foto
                      </Text>
                    </Pressable>
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                    <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>Nome do aluno</Text>
                      <TextInput
                        placeholder="Nome do aluno"
                        value={name}
                        onChangeText={setName}
                        onBlur={() => setName(formatName(name))}
                        placeholderTextColor={colors.placeholder}
                        style={{
                          borderWidth: 1,
                          borderColor: colors.border,
                          padding: 10,
                          fontSize: 13,
                          borderRadius: 12,
                          backgroundColor: colors.background,
                          color: colors.inputText,
                        }}
                      />
                    </View>
                    <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>Unidade</Text>
                      <View ref={editUnitTriggerRef}>
                        <Pressable
                          onPress={() => toggleEditPicker("unit")}
                          style={selectFieldStyle}
                        >
                          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                            {unit || "Selecione a unidade"}
                          </Text>
                          <Ionicons
                            name="chevron-down"
                            size={16}
                            color={colors.muted}
                            style={{
                              transform: [
                                { rotate: showEditUnitPicker ? "180deg" : "0deg" },
                              ],
                            }}
                          />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                    <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>Turma</Text>
                      <View ref={editClassTriggerRef}>
                        <Pressable
                          onPress={() => toggleEditPicker("class")}
                          style={selectFieldStyle}
                        >
                          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                            {selectedClassName || "Selecione a turma"}
                          </Text>
                          <Ionicons
                            name="chevron-down"
                            size={16}
                            color={colors.muted}
                            style={{
                              transform: [
                                { rotate: showEditClassPicker ? "180deg" : "0deg" },
                              ],
                            }}
                          />
                        </Pressable>
                      </View>
                    </View>
                    <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>
                        Email do aluno (login)
                      </Text>
                      <TextInput
                        placeholder="email@exemplo.com"
                        value={loginEmail}
                        onChangeText={setLoginEmail}
                        onBlur={() => setLoginEmail(formatEmail(loginEmail))}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        placeholderTextColor={colors.placeholder}
                        style={{
                          borderWidth: 1,
                          borderColor: colors.border,
                          padding: 10,
                          fontSize: 13,
                          borderRadius: 12,
                          backgroundColor: colors.background,
                          color: colors.inputText,
                        }}
                      />
                    </View>
                  </View>
                  { studentFormError ? (
                    <Text style={{ color: colors.dangerText, fontSize: 12 }}>
                      {studentFormError}
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                    <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
                      <DateInput
                        value={birthDate}
                        onChange={setBirthDate}
                        placeholder="Data de nascimento"
                        onOpenCalendar={() => setShowCalendar(true)}
                      />
                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                        {ageNumber !== null
                           ? `Idade: ${ageNumber} anos`
                          : "Idade calculada automaticamente"}
                      </Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
                      <TextInput
                        placeholder="Telefone"
                        value={phone}
                        onChangeText={(value) => setPhone(formatPhone(value))}
                        keyboardType="phone-pad"
                        placeholderTextColor={colors.placeholder}
                        style={{
                          borderWidth: 1,
                          borderColor: colors.border,
                          padding: 10,
                          fontSize: 13,
                          borderRadius: 12,
                          backgroundColor: colors.background,
                          color: colors.inputText,
                        }}
                      />
                    </View>
                  </View>
                </View>

                <View style={{ gap: 8 }}>
                  <Pressable
                    onPress={() => setShowEditHealthSection((prev) => !prev)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      backgroundColor: colors.background,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                      Saúde do aluno
                    </Text>
                    <Ionicons
                      name={showEditHealthSection ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={colors.muted}
                    />
                  </Pressable>
                  { showEditHealthSectionContent ? (
                    <Animated.View style={[editHealthSectionAnimStyle, { gap: 8 }]}>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                        <View style={{ flex: 1, minWidth: 140, gap: 8 }}>
                          <Text style={{ color: colors.muted, fontSize: 11 }}>
                            Observações sobre saúde do aluno
                          </Text>
                          <View style={{ flexDirection: "row", gap: 8 }}>
                            <Pressable
                              onPress={() => {
                                setHealthIssue(false);
                                setHealthIssueNotes("");
                              }}
                              style={{
                                paddingVertical: 8,
                                paddingHorizontal: 12,
                                borderRadius: 999,
                                backgroundColor: !healthIssue
                                  ? colors.primaryBg
                                  : colors.secondaryBg,
                                borderWidth: 1,
                                borderColor: !healthIssue ? colors.primaryBg : colors.border,
                              }}
                            >
                              <Text
                                style={{
                                  color: !healthIssue ? colors.primaryText : colors.text,
                                  fontWeight: "700",
                                }}
                              >
                                Não
                              </Text>
                            </Pressable>
                            <Pressable
                              onPress={() => setHealthIssue(true)}
                              style={{
                                paddingVertical: 8,
                                paddingHorizontal: 12,
                                borderRadius: 999,
                                backgroundColor: healthIssue
                                  ? colors.primaryBg
                                  : colors.secondaryBg,
                                borderWidth: 1,
                                borderColor: healthIssue ? colors.primaryBg : colors.border,
                              }}
                            >
                              <Text
                                style={{
                                  color: healthIssue ? colors.primaryText : colors.text,
                                  fontWeight: "700",
                                }}
                              >
                                Sim
                              </Text>
                            </Pressable>
                          </View>
                          { healthIssue ? (
                            <TextInput
                              placeholder="Descreva a observação"
                              value={healthIssueNotes}
                              onChangeText={setHealthIssueNotes}
                              placeholderTextColor={colors.placeholder}
                              multiline
                              style={{
                                borderWidth: 1,
                                borderColor: colors.border,
                                padding: 10,
                                borderRadius: 12,
                                backgroundColor: colors.background,
                                color: colors.inputText,
                                minHeight: 70,
                                textAlignVertical: "top",
                              }}
                            />
                          ) : null}
                        </View>
                        <View style={{ flex: 1, minWidth: 140, gap: 8 }}>
                          <Text style={{ color: colors.muted, fontSize: 11 }}>
                            Uso contínuo de medicação
                          </Text>
                          <View style={{ flexDirection: "row", gap: 8 }}>
                            <Pressable
                              onPress={() => {
                                setMedicationUse(false);
                                setMedicationNotes("");
                              }}
                              style={{
                                paddingVertical: 8,
                                paddingHorizontal: 12,
                                borderRadius: 999,
                                backgroundColor: !medicationUse
                                  ? colors.primaryBg
                                  : colors.secondaryBg,
                                borderWidth: 1,
                                borderColor: !medicationUse ? colors.primaryBg : colors.border,
                              }}
                            >
                              <Text
                                style={{
                                  color: !medicationUse ? colors.primaryText : colors.text,
                                  fontWeight: "700",
                                }}
                              >
                                Não
                              </Text>
                            </Pressable>
                            <Pressable
                              onPress={() => setMedicationUse(true)}
                              style={{
                                paddingVertical: 8,
                                paddingHorizontal: 12,
                                borderRadius: 999,
                                backgroundColor: medicationUse
                                  ? colors.primaryBg
                                  : colors.secondaryBg,
                                borderWidth: 1,
                                borderColor: medicationUse ? colors.primaryBg : colors.border,
                              }}
                            >
                              <Text
                                style={{
                                  color: medicationUse ? colors.primaryText : colors.text,
                                  fontWeight: "700",
                                }}
                              >
                                Sim
                              </Text>
                            </Pressable>
                          </View>
                          { medicationUse ? (
                            <TextInput
                              placeholder="Qual medicação?"
                              value={medicationNotes}
                              onChangeText={setMedicationNotes}
                              placeholderTextColor={colors.placeholder}
                              multiline
                              style={{
                                borderWidth: 1,
                                borderColor: colors.border,
                                padding: 10,
                                borderRadius: 12,
                                backgroundColor: colors.background,
                                color: colors.inputText,
                                minHeight: 70,
                                textAlignVertical: "top",
                              }}
                            />
                          ) : null}
                        </View>
                      </View>
                      <View style={{ gap: 6 }}>
                        <Text style={{ color: colors.muted, fontSize: 11 }}>Observações</Text>
                        <TextInput
                          placeholder="Outras observações"
                          value={healthObservations}
                          onChangeText={setHealthObservations}
                          placeholderTextColor={colors.placeholder}
                          multiline
                          style={{
                            borderWidth: 1,
                            borderColor: colors.border,
                            padding: 10,
                            borderRadius: 12,
                            backgroundColor: colors.background,
                            color: colors.inputText,
                            minHeight: 80,
                            textAlignVertical: "top",
                          }}
                        />
                      </View>
                    </Animated.View>
                  ) : null}
                </View>

                <View style={{ height: 1, backgroundColor: colors.border }} />

                <View style={{ gap: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>
                    Dados do responsável
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                    <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>
                        Nome do responsável
                      </Text>
                      <TextInput
                        placeholder="Nome do responsável"
                        value={guardianName}
                        onChangeText={setGuardianName}
                        onBlur={() => setGuardianName(formatName(guardianName))}
                        placeholderTextColor={colors.placeholder}
                        style={{
                          borderWidth: 1,
                          borderColor: colors.border,
                          padding: 10,
                          fontSize: 13,
                          borderRadius: 12,
                          backgroundColor: colors.background,
                          color: colors.inputText,
                        }}
                      />
                    </View>
                    <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>
                        Telefone do responsável
                      </Text>
                      <TextInput
                        placeholder="Telefone do responsável"
                        value={guardianPhone}
                        onChangeText={(value) => setGuardianPhone(formatPhone(value))}
                        keyboardType="phone-pad"
                        placeholderTextColor={colors.placeholder}
                        style={{
                          borderWidth: 1,
                          borderColor: colors.border,
                          padding: 10,
                          fontSize: 13,
                          borderRadius: 12,
                          backgroundColor: colors.background,
                          color: colors.inputText,
                        }}
                      />
                    </View>
                    <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>Parentesco</Text>
                      <View ref={editGuardianRelationTriggerRef}>
                        <Pressable
                          onPress={() => toggleEditPicker("guardianRelation")}
                          style={selectFieldStyle}
                        >
                          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                            {guardianRelation || "Selecione"}
                          </Text>
                          <Ionicons
                            name="chevron-down"
                            size={16}
                            color={colors.muted}
                            style={{
                              transform: [
                                { rotate: showEditGuardianRelationPicker ? "180deg" : "0deg" },
                              ],
                            }}
                          />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </View>

                <View style={{ height: 1, backgroundColor: colors.border }} />
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  onPress={async () => {
                    const didSave = await onSave();
                    if (didSave) {
                      closeEditModal();
                    }
                  }}
                  disabled={!isEditDirty}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: isEditDirty
                      ? colors.primaryBg
                      : colors.primaryDisabledBg,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: isEditDirty ? colors.primaryText : colors.secondaryText,
                      fontWeight: "700",
                    }}
                  >
                    Salvar alterações
                  </Text>
                </Pressable>
                <Pressable
                  onPress={requestCloseEditModal}
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
                    Cancelar
                  </Text>
                </Pressable>
              </View>
              { editingId ? (
                <Pressable
                  onPress={deleteEditingStudent}
                  style={{
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: colors.dangerSolidBg,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: colors.dangerSolidText, fontWeight: "700" }}>
                    Excluir aluno
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </ScrollView>
          </KeyboardAvoidingView>
        </View>
        <StudentsAnchoredDropdown
          visible={showEditUnitPickerContent}
          layout={
            editUnitTriggerLayout
              ? editUnitTriggerLayout
              : null
          }
          container={editContainerWindow}
          animationStyle={editUnitPickerAnimStyle}
          zIndex={420}
          maxHeight={220}
          nestedScrollEnabled
          onRequestClose={closeAllEditPickers}
          panelStyle={{
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
          }}
          scrollContentStyle={{ padding: 4 }}
        >
          { unitOptions.length ? (
            unitOptions.map((item, index) => (
              <SelectOption
                key={item}
                label={item}
                value={item}
                active={item === unit}
                onSelect={handleSelectEditUnit}
                isFirst={index === 0}
              />
            ))
          ) : (
            <Text style={{ color: colors.muted, fontSize: 12, padding: 10 }}>
              Nenhuma unidade cadastrada.
            </Text>
          )}
        </StudentsAnchoredDropdown>

        <StudentsAnchoredDropdown
          visible={showEditClassPickerContent}
          layout={
            editClassTriggerLayout
              ? editClassTriggerLayout
              : null
          }
          container={editContainerWindow}
          animationStyle={editClassPickerAnimStyle}
          zIndex={420}
          maxHeight={240}
          nestedScrollEnabled
          onRequestClose={closeAllEditPickers}
          panelStyle={{
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
          }}
          scrollContentStyle={{ padding: 4 }}
        >
          { classOptions.length ? (
            classOptions.map((item, index) => (
              <ClassOption
                key={item.id}
                item={item}
                active={item.id === classId}
                onSelect={handleSelectEditClass}
                isFirst={index === 0}
              />
            ))
          ) : (
            <Text style={{ color: colors.muted, fontSize: 12, padding: 10 }}>
              Nenhuma turma encontrada.
            </Text>
          )}
        </StudentsAnchoredDropdown>
        <StudentsAnchoredDropdown
          visible={showEditGuardianRelationPickerContent}
          layout={
            editGuardianRelationTriggerLayout
              ? editGuardianRelationTriggerLayout
              : null
          }
          container={editContainerWindow}
          animationStyle={editGuardianRelationPickerAnimStyle}
          zIndex={420}
          maxHeight={160}
          nestedScrollEnabled
          onRequestClose={closeAllEditPickers}
          panelStyle={{
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
          }}
          scrollContentStyle={{ padding: 4 }}
        >
          {guardianRelationOptions.map((item, index) => (
            <SelectOption
              key={item}
              label={item}
              value={item}
              active={item === guardianRelation}
              onSelect={handleSelectEditGuardianRelation}
              isFirst={index === 0}
            />
          ))}
        </StudentsAnchoredDropdown>
        </View>
      </ModalSheet>
      <ModalSheet
        visible={showWhatsAppModal}
        onClose={closeWhatsAppModal}
        cardStyle={whatsappModalCardStyle}
        position="center"
        backdropOpacity={0.65}
      >
        {(() => {
          if (!selectedStudentId) return null;
          const student = students.find((item) => item.id === selectedStudentId);
          if (!student) return null;
          const cls = classes.find((item) => item.id === student.classId) ?? null;
          const guardianContact = normalizePhoneBR(student.guardianPhone);
          const studentContact = normalizePhoneBR(student.phone);
          const hasGuardian = guardianContact.isValid;
          const hasStudent = studentContact.isValid;
          const useGuardian = selectedContactType === "guardian" && hasGuardian;
          const useStudent = selectedContactType === "student" && hasStudent;
          const finalPhone = useGuardian
             ? guardianContact.phoneDigits
            : useStudent
              ? studentContact.phoneDigits
            : "";
          const nextClassDate = cls?.daysOfWeek?.length
            ? calculateNextClassDate(cls.daysOfWeek)
            : null;
          const sendMessage = async () => {
            if (!finalPhone) {
              Alert.alert(
                "Contato inválido",
                "Atualize o telefone do aluno ou responsável."
              );
              return;
            }
            let messageText = customStudentMessage.trim();
            if (selectedTemplateId === "student_invite" && !customFields.inviteLink) {
              const generated = await applyStudentInviteTemplate(
                student,
                cls,
                finalPhone
              );
              if (generated) {
                messageText = generated.trim();
              }
            }
            if (!messageText) {
              Alert.alert("Mensagem vazia", "Escreva ou escolha um template.");
              return;
            }
            const url = buildWaMeLink(finalPhone, messageText);
            await openWhatsApp(url);
            closeWhatsAppModal();
          };

          return (
            <View
              ref={whatsappContainerRef}
              style={{ gap: 12, overflow: "visible" }}
            >
              <ConfirmCloseOverlay
                visible={showRevokeConfirm}
                title="Revogar acesso do aluno?"
                message="Isso remove o acesso atual, revoga convites antigos e gera um novo link."
                confirmLabel="Revogar e gerar"
                cancelLabel="Cancelar"
                overlayZIndex={10000}
                onCancel={() => setShowRevokeConfirm(false)}
                onConfirm={() => {
                  setShowRevokeConfirm(false);
                  void applyStudentInviteTemplate(student, cls, finalPhone, {
                    revokeFirst: true,
                    copyLink: true,
                  });
                }}
              />
              <View>
                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
                  {student.name}
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                  {cls?.name ?? "Turma"}
                </Text>
              </View>

              <View style={{ gap: 6 }}>
                <View ref={templateTriggerRef}>
                  <Pressable
                    onPress={() => {
                      setShowTemplateList((prev) => {
                        const next = !prev;
                        if (!prev && next) {
                          syncTemplateLayout();
                        }
                        return next;
                      });
                    }}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      backgroundColor: colors.background,
                      borderWidth: 1,
                      borderColor: colors.border,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>
                      {selectedTemplateId
                        ? WHATSAPP_TEMPLATES[selectedTemplateId]?.title
                        : selectedTemplateLabel ?? "Template"}
                    </Text>
                    <Ionicons
                      name="chevron-down"
                      size={16}
                      color={colors.muted}
                      style={{
                        transform: [{ rotate: showTemplateList ? "180deg" : "0deg" }],
                      }}
                    />
                  </Pressable>
                </View>
              </View>

              { selectedTemplateId === "student_invite" ? (
                <Pressable
                  onPress={() => {
                    if (studentInviteBusy) return;
                    setShowRevokeConfirm(true);
                  }}
                  disabled={studentInviteBusy}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor: studentInviteBusy
                      ? colors.primaryDisabledBg
                      : colors.dangerSolidBg,
                    alignItems: "center",
                    opacity: studentInviteBusy ? 0.6 : 1,
                  }}
                >
                  <Text style={{ color: colors.dangerSolidText, fontWeight: "700" }}>
                    {studentInviteBusy ? "Processando..." : "Revogar e gerar novo link"}
                  </Text>
                </Pressable>
              ) : null}

              { whatsappNotice ? (
                <View
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                    borderRadius: 10,
                    backgroundColor: colors.successBg,
                    borderWidth: 1,
                    borderColor: colors.successBg,
                  }}
                >
                  <Text style={{ color: colors.successText, fontWeight: "700", fontSize: 12 }}>
                    {whatsappNotice}
                  </Text>
                </View>
              ) : null}

              {selectedTemplateId ? (
                WHATSAPP_TEMPLATES[selectedTemplateId].requires.map((field) => {
                  if (
                    field === "nextClassDate" ||
                    field === "nextClassTime" ||
                    field === "groupInviteLink" ||
                    field === "inviteLink"
                  ) {
                    return null;
                  }
                  const fieldLabel = field === "highlightNote" ? "Destaque" : "Texto";
                  const fieldPlaceholder =
                    field === "highlightNote"
                       ? "Ex: excelente postura no saque!"
                      : "Ex: não haverá treino na sexta";
                  return (
                    <View key={field} style={{ gap: 6 }}>
                      <Text style={{ fontSize: 11, fontWeight: "600", color: colors.muted }}>
                        {fieldLabel}:
                      </Text>
                      <TextInput
                        placeholder={fieldPlaceholder}
                        placeholderTextColor={colors.placeholder}
                        value={customFields[field] || ""}
                        onChangeText={(text) => {
                          const updatedFields = { ...customFields, [field]: text };
                          setCustomFields(updatedFields);
                          if (selectedTemplateId) {
                            setCustomStudentMessage(
                              buildStudentMessage(student, cls, selectedTemplateId, updatedFields)
                            );
                          }
                        }}
                        multiline
                        numberOfLines={2}
                        style={{
                          padding: 10,
                          borderRadius: 8,
                          backgroundColor: colors.background,
                          borderWidth: 1,
                          borderColor: colors.border,
                          color: colors.text,
                          fontSize: 12,
                          textAlignVertical: "top",
                        }}
                      />
                    </View>
                  );
                })
              ) : null}

              { hasGuardian || hasStudent ? (
                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: colors.muted }}>
                    Enviar para:
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    { hasGuardian ? (
                      <Pressable
                        onPress={() => setSelectedContactType("guardian")}
                        style={{
                          flex: 1,
                          minWidth: 140,
                          padding: 10,
                          borderRadius: 8,
                          backgroundColor:
                            selectedContactType === "guardian"
                               ? colors.primaryBg
                              : colors.inputBg,
                          borderWidth: 1,
                          borderColor:
                            selectedContactType === "guardian"
                               ? colors.primaryBg
                              : colors.border,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "600",
                            color:
                              selectedContactType === "guardian"
                                 ? colors.primaryText
                                : colors.text,
                          }}
                        >
                          Responsável
                        </Text>
                        <Text
                          style={{
                            fontSize: 11,
                            color:
                              selectedContactType === "guardian"
                                 ? colors.primaryText
                                : colors.muted,
                            marginTop: 2,
                          }}
                        >
                          {student.guardianPhone || "Sem telefone"}
                        </Text>
                      </Pressable>
                    ) : null}
                    { hasStudent ? (
                      <Pressable
                        onPress={() => setSelectedContactType("student")}
                        style={{
                          flex: 1,
                          minWidth: 140,
                          padding: 10,
                          borderRadius: 8,
                          backgroundColor:
                            selectedContactType === "student"
                               ? colors.primaryBg
                              : colors.inputBg,
                          borderWidth: 1,
                          borderColor:
                            selectedContactType === "student"
                               ? colors.primaryBg
                              : colors.border,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "600",
                            color:
                              selectedContactType === "student"
                                 ? colors.primaryText
                                : colors.text,
                          }}
                        >
                          Aluno
                        </Text>
                        <Text
                          style={{
                            fontSize: 11,
                            color:
                              selectedContactType === "student"
                                 ? colors.primaryText
                                : colors.muted,
                            marginTop: 2,
                          }}
                        >
                          {student.phone || "Sem telefone"}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ) : (
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  Sem telefone válido cadastrado.
                </Text>
              )}

              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: "600", color: colors.muted }}>
                  Mensagem:
                </Text>
                <TextInput
                  placeholder="Escreva a mensagem"
                  placeholderTextColor={colors.muted}
                  value={customStudentMessage}
                  onChangeText={setCustomStudentMessage}
                  multiline
                  numberOfLines={4}
                  style={{
                    padding: 10,
                    borderRadius: 8,
                    backgroundColor: colors.background,
                    borderWidth: 1,
                    borderColor: colors.border,
                    color: colors.text,
                    fontSize: 12,
                    textAlignVertical: "top",
                    minHeight: 80,
                  }}
                />
              </View>

              <Pressable
                onPress={sendMessage}
                style={{
                  paddingVertical: 11,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  backgroundColor: "#25D366",
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>
                  Enviar via WhatsApp
                </Text>
              </Pressable>

              <Pressable
                onPress={closeWhatsAppModal}
                style={{
                  paddingVertical: 10,
                  borderRadius: 10,
                  backgroundColor: colors.secondaryBg,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "600", fontSize: 13 }}>
                  Fechar
                </Text>
              </Pressable>
              <StudentsAnchoredDropdown
                visible={showTemplateListContent}
                layout={templateTriggerLayout}
                container={whatsappContainerWindow}
                animationStyle={templateListAnimStyle}
                zIndex={9999}
                maxHeight={220}
                nestedScrollEnabled
                onRequestClose={closeAllPickers}
                panelStyle={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                }}
                scrollContentStyle={{ padding: 8, gap: 8 }}
              >
                {Object.values(WHATSAPP_TEMPLATES).map((template) => {
                  const isSelected = selectedTemplateId === template.id;
                  let canUse = true;
                  let missingRequirement = "";
                  if (template.requires) {
                    for (const req of template.requires) {
                      if (req === "nextClassDate" && !nextClassDate) {
                        canUse = false;
                        missingRequirement = "Dias da semana não configurados";
                        break;
                      }
                      if (req === "nextClassTime" && !cls.startTime) {
                        canUse = false;
                        missingRequirement = "Horário não configurado";
                        break;
                      }
                      if (req === "groupInviteLink" && cls && !groupInviteLinks[cls.id]) {
                        canUse = false;
                        missingRequirement = "Link do grupo não configurado";
                        break;
                      }
                    }
                  }
                  return (
                    <Pressable
                      key={template.id}
                      disabled={!canUse}
                      onPress={() => {
                        if (!canUse) {
                          Alert.alert("Template indisponível", missingRequirement);
                          return;
                        }
                        if (template.id === "student_invite") {
                          setShowTemplateList(false);
                          void applyStudentInviteTemplate(
                            student,
                            cls,
                            finalPhone
                          );
                          return;
                        }
                        const fields: Record<string, string> = {};
                        setSelectedTemplateId(template.id);
                        setSelectedTemplateLabel(template.title);
                        setCustomFields(fields);
                        setCustomStudentMessage(
                          buildStudentMessage(student, cls, template.id, fields)
                        );
                        setShowTemplateList(false);
                      }}
                      style={{
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 10,
                        backgroundColor: isSelected ? colors.primaryBg : colors.card,
                        borderWidth: 1,
                        borderColor: isSelected ? colors.primaryBg : colors.border,
                        opacity: canUse ? 1 : 0.5,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "700",
                          color: isSelected ? colors.primaryText : colors.text,
                        }}
                      >
                        {template.title}
                      </Text>
                      { !canUse ? (
                        <Text style={{ fontSize: 11, color: colors.dangerText, marginTop: 2 }}>
                          {missingRequirement}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </StudentsAnchoredDropdown>
            </View>
          );
        })()}
      </ModalSheet>
      <ModalSheet
        visible={showPhotoSheet}
        onClose={() => setShowPhotoSheet(false)}
        cardStyle={photoSheetCardStyle}
        position="center"
        backdropOpacity={0.7}
      >
        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
            Foto do aluno
          </Text>
          <Pressable
            onPress={() => pickStudentPhoto("camera")}
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
              Usar camera
            </Text>
          </Pressable>
          <Pressable
            onPress={() => pickStudentPhoto("library")}
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
              Escolher da galeria
            </Text>
          </Pressable>
          {photoUrl ? (
            <Pressable
              onPress={() => pickStudentPhoto("remove")}
              style={{
                paddingVertical: 10,
                borderRadius: 12,
                backgroundColor: colors.dangerSolidBg,
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.dangerSolidText, fontWeight: "700" }}>
                Remover foto
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => setShowPhotoSheet(false)}
            style={{
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              Cancelar
            </Text>
          </Pressable>
        </View>
      </ModalSheet>
      <ModalSheet
        visible={showPhotoPreview}
        onClose={() => setShowPhotoPreview(false)}
        cardStyle={photoPreviewCardStyle}
        position="center"
        backdropOpacity={0.7}
      >
        <View style={{ gap: 12, alignItems: "center" }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
            {photoPreview?.name ?? "Foto do aluno"}
          </Text>
          <View
            style={{
              width: 220,
              height: 220,
              borderRadius: 18,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {photoPreview?.uri ? (
              <Image
                source={{ uri: photoPreview.uri }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
              />
            ) : (
              <Text style={{ color: colors.muted, fontWeight: "600" }}>
                Sem foto
              </Text>
            )}
          </View>
          <Pressable
            onPress={() => setShowPhotoPreview(false)}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderRadius: 12,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              Fechar
            </Text>
          </Pressable>
        </View>
      </ModalSheet>
      <DatePickerModal
        visible={showCalendar}
        value={birthDate}
        onChange={setBirthDate}
        onClose={() => setShowCalendar(false)}
      />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}


