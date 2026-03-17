import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
    memo,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactElement
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
    StudentInvitePendingItem,
    listStudentPendingInvites,
} from "../../src/api/student-invite";
import {
    removeStudentPhotoObject,
    uploadStudentPhoto,
} from "../../src/api/student-photo-storage";
import { useAuth } from "../../src/auth/auth";
import {
    compareClassesBySchedule,
    sortClassesBySchedule,
} from "../../src/core/class-schedule-sort";
import { useEffectiveProfile } from "../../src/core/effective-profile";
import type { ClassGroup, Student, StudentPreRegistration } from "../../src/core/models";
import { normalizeUnitKey } from "../../src/core/unit-key";
import {
    convertStudentPreRegistration,
    deleteStudent,
    getClasses,
    getStudentPreRegistrations,
    getStudents,
    revealStudentCpf,
    saveStudent,
    saveStudentPreRegistration,
    updateStudent,
    updateStudentPreRegistration
} from "../../src/db/seed";
import { notifyBirthdays } from "../../src/notifications";
import { logAction } from "../../src/observability/breadcrumbs";
import { markRender, measure, measureAsync } from "../../src/observability/perf";
import { useOrganization } from "../../src/providers/OrganizationProvider";
import { BirthdaysTab } from "../../src/screens/students/BirthdaysTab";
import { StudentRegistrationTab } from "../../src/screens/students/StudentRegistrationTab";
import { StudentDocumentsFields } from "../../src/screens/students/components/StudentDocumentsFields";
import { StudentsFabMenu } from "../../src/screens/students/components/StudentsFabMenu";
import { StudentsListTab } from "../../src/screens/students/StudentsListTab";
import { exportStudentsXlsx } from "../../src/screens/students/export/exportStudentsXlsx";
import { useBuildStudentMessage } from "../../src/screens/students/hooks/useBuildStudentMessage";
import { useOnEditStudent } from "../../src/screens/students/hooks/useOnEditStudent";
import { usePreRegistrationForm } from "../../src/screens/students/hooks/usePreRegistrationForm";
import { useSavePreRegistration } from "../../src/screens/students/hooks/useSavePreRegistration";
import { useStudentForm } from "../../src/screens/students/hooks/useStudentForm";
import { useStudentInvites } from "../../src/screens/students/hooks/useStudentInvites";
import { useWhatsAppModal } from "../../src/screens/students/hooks/useWhatsAppModal";
import { StudentEditModal } from "../../src/screens/students/modals/StudentEditModal";
import { StudentsFormsSyncModal } from "../../src/screens/students/modals/StudentsFormsSyncModal";
import { StudentsImportModal } from "../../src/screens/students/modals/StudentsImportModal";
import { WhatsAppModal } from "../../src/screens/students/modals/WhatsAppModal";
import { AnchoredDropdown as StudentsAnchoredDropdown } from "../../src/ui/AnchoredDropdown";
import { AnimatedSegmentedTabs } from "../../src/ui/AnimatedSegmentedTabs";
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
import { ShimmerBlock } from "../../src/ui/Shimmer";
import { getUnitPalette } from "../../src/ui/unit-colors";
import { UnitFilterBar } from "../../src/ui/UnitFilterBar";
import { useCollapsibleAnimation } from "../../src/ui/use-collapsible";
import { useModalCardStyle } from "../../src/ui/use-modal-card-style";
import { usePersistedState } from "../../src/ui/use-persisted-state";
import { useWhatsAppSettings } from "../../src/ui/whatsapp-settings-context";
import { normalizeRaDigits, validateStudentRa } from "../../src/utils/student-ra";
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

const athletePositionOptions = [
  "indefinido",
  "levantador",
  "oposto",
  "ponteiro",
  "central",
  "libero",
] as const;
const athleteObjectiveOptions = ["ludico", "base", "rendimento"] as const;
const athleteLearningStyleOptions = ["misto", "visual", "auditivo", "cinestesico"] as const;

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
type StudentsTab = "cadastro" | "aniversários" | "alunos";

export default function StudentsScreen() {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const isCompactForm = Platform.OS !== "web" && windowWidth <= 760;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, signOut } = useAuth();
  const effectiveProfile = useEffectiveProfile();
  const canRevealCpf = effectiveProfile === "admin";
  const { colors } = useAppTheme();
  const { activeOrganization } = useOrganization();
  const canManageStudentInvites = (activeOrganization?.role_level ?? 0) >= 50;
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
  const editModalCardStyle = useModalCardStyle({ maxHeight: Platform.OS === "web" ? "92%" : "96%", maxWidth: isCompactForm ? 700 : 960, padding: 16, radius: 16 });
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
  const [preRegistrations, setPreRegistrations] = useState<StudentPreRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = usePersistedState<boolean>(
    "students_show_form_v1",
    false
  );
  const [studentsTab, setStudentsTab] = usePersistedState<StudentsTab>("students_tab_v1", "alunos");
  const [showStudentsFabMenu, setShowStudentsFabMenu] = useState(false);
  const [showStudentsFormsSyncModal, setShowStudentsFormsSyncModal] = useState(false);
  const [showStudentsImportModal, setShowStudentsImportModal] = useState(false);
  const [studentsExportBusy, setStudentsExportBusy] = useState(false);
  const [showStudentsTabConfirm, setShowStudentsTabConfirm] = useState(false);
  const [pendingStudentsTab, setPendingStudentsTab] = useState<StudentsTab | null>(null);
  const [birthdayUnitFilter, setBirthdayUnitFilter] = useState("Todas");
  const [birthdaySearch, setBirthdaySearch] = useState("");
  const [birthdayMonthFilter, setBirthdayMonthFilter] = useState<"Todas" | number>(
    "Todas"
  );
  const [showAllBirthdays, setShowAllBirthdays] = useState(true);
  const [studentsUnitFilter, setStudentsUnitFilter] = useState("Todas");
  const [studentsSearch, setStudentsSearch] = useState("");
  // --- Formulário de aluno (42 campos → useReducer) ---
  const {
    form,
    setUnit, setAgeBand, setCustomAgeBand, setClassId,
    setName, setPhotoUrl, setPhotoMimeType,
    setBirthDate, setAgeNumber, setPhone,
    setCpfDisplay, setCpfMaskedOriginal, setCpfRevealedValue,
    setIsCpfVisible, setCpfRevealUnavailable, setRevealCpfBusy,
    setRgDocument, setRa, setLoginEmail,
    setGuardianName, setGuardianPhone, setGuardianRelation,
    setPositionPrimary, setPositionSecondary, setAthleteObjective, setLearningStyle,
    setHealthIssue, setHealthIssueNotes, setMedicationUse,
    setMedicationNotes, setHealthObservations, setIsExperimental,
    setEditingId, setEditingCreatedAt,
    setOpenCreateSection, setOpenEditSection,
    setStudentFormError, setStudentDocumentsError, setEditSnapshot,
    resetForm, resetCreateForm,
  } = useStudentForm();

  const {
    unit, ageBand, customAgeBand, classId,
    name, photoUrl, photoMimeType,
    birthDate, ageNumber, phone,
    cpfDisplay, cpfMaskedOriginal, cpfRevealedValue,
    isCpfVisible, cpfRevealUnavailable, revealCpfBusy,
    rgDocument, ra, loginEmail,
    guardianName, guardianPhone, guardianRelation,
    positionPrimary, positionSecondary, athleteObjective, learningStyle,
    healthIssue, healthIssueNotes, medicationUse,
    medicationNotes, healthObservations, isExperimental,
    editingId, editingCreatedAt,
    openCreateSection, openEditSection,
    formError: studentFormError, documentsError: studentDocumentsError, editSnapshot,
  } = form;

  // --- Pré-cadastro (useReducer) ---
  const {
    preForm,
    setEditingPreId, setPreChildName, setPreGuardianName, setPreGuardianPhone,
    setPreClassInterest, setPreUnitInterest, setPreTrialDate,
    setPreNotes, setPreStatus, setPreRegistrationError, setPreRegistrationSearch,
    resetPreRegistrationForm,
  } = usePreRegistrationForm();

  const {
    editingPreId, preChildName, preGuardianName, preGuardianPhone,
    preClassInterest, preUnitInterest, preTrialDate,
    preNotes, preStatus, preRegistrationError, preRegistrationSearch,
  } = preForm;

  // --- Modal WhatsApp (useReducer) ---
  const {
    waModal,
    setShowWhatsAppModal, setWhatsappNotice, setShowRevokeConfirm,
    setSelectedStudentId, setSelectedContactType,
    setSelectedTemplateId, setSelectedTemplateLabel,
    setCustomFields, setCustomStudentMessage,
    setShowTemplateList, setWhatsappContainerWindow, setTemplateTriggerLayout,
  } = useWhatsAppModal();

  const {
    showWhatsAppModal, whatsappNotice, showRevokeConfirm,
    selectedStudentId, selectedContactType,
    selectedTemplateId, selectedTemplateLabel,
    customFields, customStudentMessage,
    showTemplateList, whatsappContainerWindow, templateTriggerLayout,
  } = waModal;

  // --- Estados de UI que permanecem locais (não pertencem ao formulário) ---
  const [showCalendar, setShowCalendar] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [showClassPicker, setShowClassPicker] = useState(false);
  const [showGuardianRelationPicker, setShowGuardianRelationPicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showEditUnitPicker, setShowEditUnitPicker] = useState(false);
  const [showEditClassPicker, setShowEditClassPicker] = useState(false);
  const [showEditGuardianRelationPicker, setShowEditGuardianRelationPicker] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEditCloseConfirm, setShowEditCloseConfirm] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);
  const [showPhotoPreview, setShowPhotoPreview] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<{ uri: string | null; name: string } | null>(null);
  markRender("screen.students.render.root");
  const [saveNotice, setSaveNotice] = useState("");
  const [studentInviteBusy, setStudentInviteBusy] = useState(false);
  const [pendingStudentInvites, setPendingStudentInvites] = useState<StudentInvitePendingItem[]>([]);
  const [pendingStudentInviteBusyId, setPendingStudentInviteBusyId] = useState<string | null>(null);
  const saveNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const whatsappNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveNoticeAnim = useRef(new Animated.Value(0)).current;
  const studentsFabAnim = useRef(new Animated.Value(0)).current;
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
  const [typeTriggerLayout, setTypeTriggerLayout] = useState<{
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
  const typeTriggerRef = useRef<View>(null);
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
  const { animatedStyle: typePickerAnimStyle, isVisible: showTypePickerContent } =
    useCollapsibleAnimation(showTypePicker);
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
  const accordionAnimOptions = useMemo(
    () =>
      Platform.OS === "web"
        ? { durationIn: 1, durationOut: 1, translateY: 0 }
        : { durationIn: 220, durationOut: 180, translateY: -4 },
    []
  );
  const createStudentDataAnim = useCollapsibleAnimation(openCreateSection === "studentData", accordionAnimOptions);
  const createDocumentsAnim = useCollapsibleAnimation(openCreateSection === "documents", accordionAnimOptions);
  const createSportAnim = useCollapsibleAnimation(openCreateSection === "sportProfile", accordionAnimOptions);
  const createHealthAnim = useCollapsibleAnimation(openCreateSection === "health", accordionAnimOptions);
  const createGuardianAnim = useCollapsibleAnimation(openCreateSection === "guardian", accordionAnimOptions);
  const editStudentDataAnim = useCollapsibleAnimation(openEditSection === "studentData", accordionAnimOptions);
  const editDocumentsAnim = useCollapsibleAnimation(openEditSection === "documents", accordionAnimOptions);
  const editSportAnim = useCollapsibleAnimation(openEditSection === "sportProfile", accordionAnimOptions);
  const editHealthAnim = useCollapsibleAnimation(openEditSection === "health", accordionAnimOptions);
  const editGuardianAnim = useCollapsibleAnimation(openEditSection === "guardian", accordionAnimOptions);
  const editLinksAnim = useCollapsibleAnimation(openEditSection === "links", accordionAnimOptions);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [classList, studentList, preRegistrationList] = await measureAsync(
          "screen.students.load.initial",
          () =>
            Promise.all([
              getClasses({ organizationId: activeOrganization?.id }),
              getStudents({ organizationId: activeOrganization?.id }),
              getStudentPreRegistrations({ organizationId: activeOrganization?.id }),
            ]),
          { hasOrganization: activeOrganization?.id ? 1 : 0 }
        );
        if (!alive) return;
        setClasses(classList);
        setStudents(studentList);
        setPreRegistrations(preRegistrationList);
        if (!canManageStudentInvites || !session?.access_token) {
          setPendingStudentInvites([]);
          return;
        }
        void listStudentPendingInvites()
          .then((pendingInvitesResult) => {
            if (!alive) return;
            setPendingStudentInvites(pendingInvitesResult.invites ?? []);
          })
          .catch(() => {
            if (!alive) return;
            setPendingStudentInvites([]);
          });
      } catch (error) {
        if (!alive) return;
        setClasses([]);
        setStudents([]);
        setPreRegistrations([]);
        setPendingStudentInvites([]);
        console.warn("StudentsScreen initial load failed", error);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [activeOrganization?.id, canManageStudentInvites, session?.access_token]);

  const reload = async () => {
    try {
      const [studentList, preRegistrationList] = await Promise.all([
        getStudents({ organizationId: activeOrganization?.id }),
        getStudentPreRegistrations({ organizationId: activeOrganization?.id }),
      ]);
      setStudents(studentList);
      setPreRegistrations(preRegistrationList);
      if (!canManageStudentInvites || !session?.access_token) {
        setPendingStudentInvites([]);
        return;
      }
      const pendingInvitesResult = await listStudentPendingInvites().catch(() => ({ invites: [] }));
      setPendingStudentInvites(pendingInvitesResult.invites ?? []);
    } catch (error) {
      console.warn("StudentsScreen reload failed", error);
    }
  };

  useEffect(() => {
    if ((studentsTab as string) === "importar") {
      setStudentsTab("alunos");
    }
  }, [studentsTab, setStudentsTab]);

  const handleExportStudents = useCallback(async () => {
    const organizationId = activeOrganization?.id ?? null;
    if (!organizationId) {
      Alert.alert("Alunos", "Selecione uma organizacao ativa.");
      return;
    }
    setStudentsExportBusy(true);
    try {
      const result = await exportStudentsXlsx({
        organizationId,
        organizationName: activeOrganization?.name ?? null,
      });
      Alert.alert(
        "Exportacao concluida",
        `Arquivo ${result.fileName} com ${result.totalStudents} aluno(s).`
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Falha ao exportar XLSX de alunos.";
      Alert.alert("Alunos", message);
    } finally {
      setStudentsExportBusy(false);
    }
  }, [activeOrganization?.id]);
  const studentsFabBottom = Math.max(insets.bottom + 166, 182);
  const studentsFabRight = 16;
  const studentsFabRotate = useMemo(
    () =>
      studentsFabAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ["0deg", "45deg"],
      }),
    [studentsFabAnim]
  );
  const studentsFabScale = useMemo(
    () =>
      studentsFabAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.06],
      }),
    [studentsFabAnim]
  );

  useEffect(() => {
    Animated.timing(studentsFabAnim, {
      toValue: showStudentsFabMenu ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [showStudentsFabMenu, studentsFabAnim]);

  const unitLabel = useCallback(
    (value: string) => (value && value.trim() ? value.trim() : "Sem unidade"),
    []
  );

  const closeAllPickers = useCallback(() => {
    setShowUnitPicker(false);
    setShowClassPicker(false);
    setShowGuardianRelationPicker(false);
    setShowTypePicker(false);
    setShowTemplateList(false);
  }, []);
  const closeAllEditPickers = useCallback(() => {
    setShowEditUnitPicker(false);
    setShowEditClassPicker(false);
    setShowEditGuardianRelationPicker(false);
  }, []);

  const toggleFormPicker = useCallback(
    (target: "unit" | "class" | "guardianRelation" | "type") => {
      setShowUnitPicker((prev) => (target === "unit" ? !prev : false));
      setShowClassPicker((prev) => (target === "class" ? !prev : false));
      setShowGuardianRelationPicker((prev) => (target === "guardianRelation" ? !prev : false));
      setShowTypePicker((prev) => (target === "type" ? !prev : false));
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

  const toggleCreateSection = useCallback(
    (section: "studentData" | "documents" | "sportProfile" | "health" | "guardian") => {
      setOpenCreateSection((prev) => (prev === section ? null : section));
    },
    []
  );
  const toggleEditSection = useCallback(
    (section: "studentData" | "documents" | "sportProfile" | "health" | "guardian" | "links") => {
      setOpenEditSection((prev) => (prev === section ? null : section));
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

  const handleSelectType = useCallback((value: string) => {
    setIsExperimental(value === "experimental");
    setShowTypePicker(false);
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
    const hasPickerOpen = showUnitPicker || showClassPicker || showGuardianRelationPicker || showTypePicker;
    if (!hasPickerOpen) return;
    requestAnimationFrame(() => {
      if (showUnitPicker) {
        unitTriggerRef.current?.measureInWindow((x, y, width, height) => {
          setUnitTriggerLayout({ x, y, width, height });
        });
      }
      if (showClassPicker) {
        classTriggerRef.current?.measureInWindow((x, y, width, height) => {
          setClassTriggerLayout({ x, y, width, height });
        });
      }
      if (showGuardianRelationPicker) {
        guardianRelationTriggerRef.current?.measureInWindow((x, y, width, height) => {
          setGuardianRelationTriggerLayout({ x, y, width, height });
        });
      }
      if (showTypePicker) {
        typeTriggerRef.current?.measureInWindow((x, y, width, height) => {
          setTypeTriggerLayout({ x, y, width, height });
        });
      }
      containerRef.current?.measureInWindow((x, y) => {
        setContainerWindow({ x, y });
      });
    });
  }, [showClassPicker, showGuardianRelationPicker, showUnitPicker, showTypePicker]);

  const syncEditPickerLayouts = useCallback(() => {
    const hasPickerOpen =
      showEditUnitPicker || showEditClassPicker || showEditGuardianRelationPicker;
    if (!hasPickerOpen) return;
    requestAnimationFrame(() => {
      if (showEditUnitPicker) {
        editUnitTriggerRef.current?.measureInWindow((x, y, width, height) => {
          setEditUnitTriggerLayout({ x, y, width, height });
        });
      }
      if (showEditClassPicker) {
        editClassTriggerRef.current?.measureInWindow((x, y, width, height) => {
          setEditClassTriggerLayout({ x, y, width, height });
        });
      }
      if (showEditGuardianRelationPicker) {
        editGuardianRelationTriggerRef.current?.measureInWindow((x, y, width, height) => {
          setEditGuardianRelationTriggerLayout({ x, y, width, height });
        });
      }
      editModalRef.current?.measureInWindow((x, y) => {
        setEditContainerWindow({ x, y });
      });
    });
  }, [showEditClassPicker, showEditGuardianRelationPicker, showEditUnitPicker]);

  const syncTemplateLayout = useCallback(() => {
    requestAnimationFrame(() => {
      templateTriggerRef.current?.measureInWindow((x, y, width, height) => {
        setTemplateTriggerLayout({ x, y, width, height });
      });
      whatsappContainerRef.current?.measureInWindow((x, y) => {
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
  const classById = useMemo(() => {
    return new Map(classes.map((item) => [item.id, item] as const));
  }, [classes]);

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
    setStudentDocumentsError({});
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
      classById.get(classId)?.organizationId ??
      activeOrganization?.id ??
      "";

    try {
      const raValidation = validateStudentRa(ra);
      if (raValidation) {
        setStudentDocumentsError((prev) => ({ ...prev, ra: raValidation }));
        setStudentFormError(raValidation);
        return false;
      }
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
        ra: normalizeRaDigits(ra) || null,
        cpfMasked: cpfDisplay.trim() || null,
        rg: rgDocument.trim() || null,
        loginEmail: loginEmail.trim() ? formatEmail(loginEmail) : "",
        guardianName: guardianName.trim(),
        guardianPhone: guardianPhone.trim(),
        guardianRelation: guardianRelation.trim(),
        positionPrimary,
        positionSecondary,
        athleteObjective,
        learningStyle,
        isExperimental,
        healthIssue,
        healthIssueNotes: healthIssue ? healthIssueNotes.trim() : "",
        medicationUse,
        medicationNotes: medicationUse ? medicationNotes.trim() : "",
        healthObservations: healthObservations.trim(),
        birthDate: birthDate || "",
        createdAt: editingCreatedAt ? editingCreatedAt : nowIso,
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

      doResetForm();
      await reload();
      showSaveNotice(wasEditing ? "Alterações salvas." : "Aluno cadastrado.");
      if (!wasEditing) {
        Alert.alert(
          "Aluno cadastrado",
          `${name.trim()} foi cadastrado com sucesso.`,
          [
            {
              text: "Ver alunos",
              onPress: () => setStudentsTab("alunos"),
            },
          ]
        );
      }
      return true;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Erro ao salvar aluno.";
      if (detail.toLowerCase().includes("cpf")) {
        setStudentDocumentsError({ cpf: detail });
      }
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
    cpfDisplay.trim() ||
    rgDocument.trim() ||
    ra.trim() ||
    loginEmail.trim() ||
    guardianName.trim() ||
    guardianPhone.trim() ||
    guardianRelation.trim() ||
    positionPrimary !== "indefinido" ||
    positionSecondary !== "indefinido" ||
    athleteObjective !== "base" ||
    learningStyle !== "misto" ||
    isExperimental ||
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
      editSnapshot.cpfDisplay !== cpfDisplay ||
      editSnapshot.rgDocument !== rgDocument ||
      editSnapshot.ra !== ra ||
      editSnapshot.loginEmail !== loginEmail ||
      editSnapshot.guardianName !== guardianName ||
      editSnapshot.guardianPhone !== guardianPhone ||
      editSnapshot.guardianRelation !== guardianRelation ||
      editSnapshot.positionPrimary !== positionPrimary ||
      editSnapshot.positionSecondary !== positionSecondary ||
      editSnapshot.athleteObjective !== athleteObjective ||
      editSnapshot.learningStyle !== learningStyle ||
      editSnapshot.isExperimental !== isExperimental ||
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
    cpfDisplay,
    customAgeBand,
    athleteObjective,
    editSnapshot,
    editingId,
    guardianName,
    guardianPhone,
    guardianRelation,
    healthIssue,
    healthIssueNotes,
    medicationUse,
    medicationNotes,
    rgDocument,
    learningStyle,
    isExperimental,
    healthObservations,
    loginEmail,
    name,
    positionPrimary,
    positionSecondary,
    photoUrl,
    phone,
    ra,
    unit,
  ]);

  // Wrappers que combinam reset do formulário (hook) com efeitos de UI locais
  const doResetForm = useCallback(() => {
    closeAllPickers();
    setShowForm(false);
    resetForm();
  }, [closeAllPickers, resetForm, setShowForm]);

  const doResetCreateForm = useCallback(() => {
    closeAllPickers();
    resetCreateForm();
  }, [closeAllPickers, resetCreateForm]);

  const { savePreRegistration } = useSavePreRegistration({
    activeOrganizationId: activeOrganization?.id,
    editingPreId,
    preChildName,
    preGuardianName,
    preGuardianPhone,
    preClassInterest,
    preUnitInterest,
    preTrialDate,
    preStatus,
    preNotes,
    setPreRegistrationError,
    resetPreRegistrationForm,
    reload,
  });

  const startEditPreRegistration = useCallback((item: StudentPreRegistration) => {
    setEditingPreId(item.id);
    setPreChildName(item.childName);
    setPreGuardianName(item.guardianName);
    setPreGuardianPhone(item.guardianPhone);
    setPreClassInterest(item.classInterest ?? "");
    setPreUnitInterest(item.unitInterest ?? "");
    setPreTrialDate(item.trialDate ?? "");
    setPreNotes(item.notes ?? "");
    setPreStatus(item.status);
    setPreRegistrationError("");
  }, []);

  const convertPreRegistrationToStudent = useCallback(
    async (item: StudentPreRegistration) => {
      const organizationId = activeOrganization?.id ?? "";
      if (!organizationId) {
        Alert.alert("Experimentais", "Selecione uma organização ativa.");
        return;
      }
      const targetClass = classes.find((cls) => cls.name === (item.classInterest ?? ""));
      if (!targetClass) {
        Alert.alert(
          "Experimentais",
          "Defina uma turma válida no pré-cadastro antes de converter."
        );
        return;
      }
      const nowIso = new Date().toISOString();
      const studentId = `s_${Date.now()}`;
      await convertStudentPreRegistration(item, {
        id: studentId,
        name: item.childName,
        organizationId,
        classId: targetClass.id,
        age: 0,
        phone: "",
        loginEmail: "",
        guardianName: item.guardianName,
        guardianPhone: item.guardianPhone,
        guardianRelation: "",
        birthDate: "",
        healthIssue: false,
        healthIssueNotes: "",
        medicationUse: false,
        medicationNotes: "",
        healthObservations: "",
        positionPrimary: "indefinido",
        positionSecondary: "indefinido",
        athleteObjective: "base",
        learningStyle: "misto",
        createdAt: nowIso,
      });
      await reload();
      Alert.alert("Experimentais", "Pré-cadastro convertido em aluno.");
    },
    [activeOrganization?.id, classes, reload]
  );

  const filteredPreRegistrations = useMemo(() => {
    const term = preRegistrationSearch.trim().toLowerCase();
    if (!term) return preRegistrations;
    return preRegistrations.filter((item) => {
      return (
        item.childName.toLowerCase().includes(term) ||
        item.guardianName.toLowerCase().includes(term) ||
        item.guardianPhone.toLowerCase().includes(term)
      );
    });
  }, [preRegistrationSearch, preRegistrations]);

  const requestSwitchStudentsTab = useCallback(
    (nextTab: StudentsTab) => {
      if (nextTab === studentsTab) return;
      if (studentsTab === "cadastro" && isFormDirty) {
        setPendingStudentsTab(nextTab);
        setShowStudentsTabConfirm(true);
        return;
      }
      if (studentsTab === "cadastro" && !isFormDirty) {
        doResetForm();
        resetPreRegistrationForm();
      }
      setStudentsTab(nextTab);
    },
    [isFormDirty, resetForm, resetPreRegistrationForm, studentsTab]
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
    doResetForm();
  };

  const requestCloseEditModal = () => {
    if (isEditDirty) {
      setShowEditCloseConfirm(true);
      return;
    }
    closeEditModal();
  };

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

  const handleRevealEditingCpf = useCallback(async () => {
    if (!editingId || !canRevealCpf) return;
    if (cpfRevealUnavailable) return;
    setStudentDocumentsError((prev) => ({ ...prev, cpf: undefined }));
    if (isCpfVisible) {
      setCpfDisplay(cpfMaskedOriginal);
      setIsCpfVisible(false);
      return;
    }
    if (cpfRevealedValue) {
      setCpfDisplay(cpfRevealedValue);
      setIsCpfVisible(true);
      return;
    }
    setRevealCpfBusy(true);
    try {
      const cpf = await revealStudentCpf(editingId, {
        reason: "edicao_aluno",
        legalBasis: "consentimento_app",
      });
      setCpfRevealedValue(cpf);
      setCpfDisplay(cpf);
      setIsCpfVisible(true);
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "Nao foi possivel revelar o CPF.";
      if (detail.toLowerCase().includes("indisponivel")) {
        setCpfRevealUnavailable(true);
      }
      setStudentDocumentsError((prev) => ({ ...prev, cpf: detail }));
      Alert.alert("CPF", detail);
    } finally {
      setRevealCpfBusy(false);
    }
  }, [
    canRevealCpf,
    cpfMaskedOriginal,
    cpfRevealUnavailable,
    cpfRevealedValue,
    editingId,
    isCpfVisible,
  ]);

  const getClassName = useCallback(
    (id: string) =>
      classById.get(id)?.name ?? "Selecione a turma",
    [classById]
  );
  const selectedClassName = useMemo(
    () => classById.get(classId)?.name ?? "",
    [classById, classId]
  );
  const editDocumentsSummary = useMemo(() => {
    const parts = [
      ra ? `RA ${ra}` : "RA não informado",
      cpfDisplay ? "CPF cadastrado" : "CPF não informado",
      rgDocument ? "RG cadastrado" : "RG não informado",
    ];
    return parts.join(" • ");
  }, [cpfDisplay, ra, rgDocument]);
  const editSportSummary = useMemo(() => {
    const primaryLabel = positionPrimary.trim() || "indefinido";
    const secondaryLabel = positionSecondary.trim() || "indefinido";
    return `${primaryLabel} • ${secondaryLabel}`;
  }, [positionPrimary, positionSecondary]);
  const editHealthSummary = useMemo(() => {
    if (!healthIssue && !medicationUse && !healthObservations.trim()) {
      return "Sem restrições informadas";
    }
    return "Informações de saúde registradas";
  }, [healthIssue, healthObservations, medicationUse]);
  const editGuardianSummary = useMemo(() => {
    const nameLabel = guardianName.trim() || "Responsável não informado";
    const phoneLabel = guardianPhone.trim() || "Sem telefone";
    return `${nameLabel} • ${phoneLabel}`;
  }, [guardianName, guardianPhone]);
  const editLinksSummary = useMemo(() => {
    const classLabel = selectedClassName || "Sem turma";
    const unitLabel = unit || "Sem unidade";
    return `${classLabel} • ${unitLabel}`;
  }, [selectedClassName, unit]);

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

  const { onEdit } = useOnEditStudent({
    ageBandOptions,
    athleteLearningStyleOptions,
    athleteObjectiveOptions,
    athletePositionOptions,
    classById,
    closeAllPickers,
    unitLabel,
    calculateAge,
    setShowForm,
    setStudentFormError,
    setStudentDocumentsError,
    setShowEditModal,
    setUnit,
    setAgeBand,
    setCustomAgeBand,
    setClassId,
    setEditingId,
    setEditingCreatedAt,
    setName,
    setPhotoUrl,
    setPhotoMimeType,
    setEditSnapshot,
    setBirthDate,
    setAgeNumber,
    setPhone,
    setCpfDisplay,
    setCpfMaskedOriginal,
    setCpfRevealedValue,
    setIsCpfVisible,
    setCpfRevealUnavailable,
    setRgDocument,
    setRa,
    setLoginEmail,
    setGuardianName,
    setGuardianPhone,
    setGuardianRelation,
    setPositionPrimary,
    setPositionSecondary,
    setAthleteObjective,
    setLearningStyle,
    setIsExperimental,
    setHealthIssue,
    setHealthIssueNotes,
    setMedicationUse,
    setMedicationNotes,
    setHealthObservations,
    setOpenEditSection,
  });

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

  const { buildStudentMessage } = useBuildStudentMessage({
    coachName,
    groupInviteLinks,
    unitLabel,
  });

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
      const cls = classById.get(student.classId) ?? null;
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
    [buildStudentMessage, classById]
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

  const { applyStudentInviteTemplate, onGenerateInviteFromList, onCancelPendingStudentInvite } = useStudentInvites({
    classes,
    studentInviteBusy,
    pendingStudentInviteBusyId,
    buildStudentMessage,
    showWhatsAppNotice,
    reload,
    setStudentInviteBusy,
    setSelectedTemplateId,
    setSelectedTemplateLabel,
    setCustomFields,
    setCustomStudentMessage,
    setPendingStudentInviteBusyId,
  });

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
      const cls = classById.get(student.classId) ?? null;
      return unitLabel(cls?.unit ?? "") === birthdayUnitFilter;
    });
  }, [birthdayUnitFilter, classById, students, unitLabel]);
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
      const cls = classById.get(student.classId) ?? null;
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
    classById,
    normalizeSearch,
    unitLabel,
  ]);
  const studentsFiltered = useMemo(() => {
    const filteredByUnit =
      studentsUnitFilter === "Todas"
        ? students
        : students.filter((student) => {
            const cls = classById.get(student.classId) ?? null;
            return unitLabel(cls?.unit ?? "") === studentsUnitFilter;
          });
    const query = normalizeSearch(studentsSearch);
    if (!query) return filteredByUnit;
    return filteredByUnit.filter((student) => {
      const cls = classById.get(student.classId) ?? null;
      const unitName = unitLabel(cls?.unit ?? "");
      const className = cls?.name ?? "";
      const haystack = normalizeSearch(
        `${student.name} ${student.guardianName ?? ""} ${student.guardianPhone ?? ""} ${unitName} ${className}`
      );
      return haystack.includes(query);
    });
  }, [studentsUnitFilter, classById, students, unitLabel, normalizeSearch, studentsSearch]);
  const studentsByClassId = useMemo(() => {
    const byClass = new Map<string, Student[]>();
    studentsFiltered.forEach((student) => {
      const key = student.classId || "";
      const bucket = byClass.get(key) ?? [];
      bucket.push(student);
      byClass.set(key, bucket);
    });
    return byClass;
  }, [studentsFiltered]);
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
    const filteredUnits = studentsUnitFilter === "Todas"
      ? null
      : new Set([studentsUnitFilter]);
    const unitMap = new Map<string, {
      classes: Map<string, {
        cls: ClassGroup | null;
        className: string;
        students: Student[];
      }>;
    }>();

    classes.forEach((cls) => {
      const unitName = unitLabel(cls.unit);
      if (filteredUnits && !filteredUnits.has(unitName)) return;
      if (!unitMap.has(unitName)) {
        unitMap.set(unitName, { classes: new Map() });
      }
      unitMap.get(unitName)!.classes.set(cls.id, {
        cls,
        className: cls.name?.trim() || "Sem turma",
        students: [...(studentsByClassId.get(cls.id) ?? [])],
      });
    });

    studentsByClassId.forEach((items, classIdValue) => {
      if (!classIdValue || classById.has(classIdValue)) return;
      const fallbackUnitName = unitLabel("");
      if (filteredUnits && !filteredUnits.has(fallbackUnitName)) return;
      if (!unitMap.has(fallbackUnitName)) {
        unitMap.set(fallbackUnitName, { classes: new Map() });
      }
      unitMap.get(fallbackUnitName)!.classes.set(`missing:${classIdValue}`, {
        cls: null,
        className: "Sem turma",
        students: [...items],
      });
    });

    return Array.from(unitMap.entries())
      .map(([unitName, data]) => {
        const classesInUnit = Array.from(data.classes.entries())
          .map(([classKey, value]) => {
            const cls = value.cls;
            const palette =
              cls
                ? getClassPalette(cls.colorKey, colors, unitName)
                : getUnitPalette(unitName, colors) ?? {
                    bg: colors.primaryBg,
                    text: colors.primaryText,
                  };
            const scheduleLabel = formatClassScheduleLabel(cls);
            const sortedStudents = [...value.students].sort((a, b) =>
              a.name.localeCompare(b.name, "pt-BR")
            );
            return {
              classId: classKey,
              className: value.className,
              gender: cls?.gender ?? "misto",
              scheduleLabel,
              palette,
              students: sortedStudents,
            };
          })
          .sort((a, b) => {
            const aClass = classById.get(a.classId) ?? {
              name: a.className,
              daysOfWeek: null,
              startTime: null,
            };
            const bClass = classById.get(b.classId) ?? {
              name: b.className,
              daysOfWeek: null,
              startTime: null,
            };
            return compareClassesBySchedule(aClass, bClass);
          });
        return { unitName, classes: classesInUnit };
      })
      .sort((a, b) => a.unitName.localeCompare(b.unitName, "pt-BR"));
  }, [classById, classes, colors, studentsByClassId, studentsUnitFilter, unitLabel]);
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
  const studentsTabMeta = useMemo(
    () => [
      { id: "alunos" as const, label: "Alunos", count: students.length },
      { id: "cadastro" as const, label: "Cadastro", count: null },
      { id: "aniversários" as const, label: "Aniversários", count: birthdayTodayAll.length },
    ],
    [students.length, birthdayTodayAll.length]
  );

  useEffect(() => {
    if ((studentsTab as string) === "experimentais") {
      setStudentsTab("cadastro");
    }
  }, [setStudentsTab, studentsTab]);

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
      const cls = classById.get(student.classId);
      const unitName = unitLabel(cls?.unit ?? "");
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
  }, [birthdayVisibleStudents, classById, unitLabel]);

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
        onInvite,
        onPhotoPress,
        className,
        unitName,
        classPalette,
      }: {
        item: Student;
        onPress: (student: Student) => void;
        onWhatsApp: (student: Student) => void;
        onInvite: (student: Student) => void;
        onPhotoPress: (student: Student) => void;
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
                  {item.isExperimental ? (
                    <View
                      style={{
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.secondaryBg,
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                      }}
                    >
                      <Text style={{ color: colors.text, fontSize: 10, fontWeight: "700" }}>
                        Experimental
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <Pressable
                onPress={() => onInvite(item)}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  backgroundColor: colors.primaryBg,
                }}
              >
                <Ionicons name="link-outline" size={16} color={colors.primaryText} />
              </Pressable>
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
              paddingVertical: 12,
              paddingHorizontal: 12,
              borderRadius: 14,
              marginVertical: 3,
              backgroundColor: active ? colors.primaryBg : colors.card,
            }}
          >
            <Text
              style={{
                color: active ? colors.primaryText : colors.text,
                fontSize: 14,
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
              paddingVertical: 12,
              paddingHorizontal: 12,
              borderRadius: 14,
              marginVertical: 3,
              backgroundColor: active ? colors.primaryBg : colors.card,
            }}
          >
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              <Text
                style={{
                  color: active ? colors.primaryText : colors.text,
                  fontSize: 14,
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
                fontSize: 12,
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
      return (
        <StudentRow
          item={item}
          onPress={onEdit}
          onWhatsApp={openStudentWhatsApp}
          onInvite={onGenerateInviteFromList}
          onPhotoPress={openPhotoPreview}
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
      onGenerateInviteFromList,
      openPhotoPreview,
      openStudentWhatsApp,
      unitLabel,
    ]
  );

  const studentKeyExtractor = useCallback(
    (item: Student) => String(item.id),
    []
  );

  const goBackFromStudents = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/");
  }, [router]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 24, paddingHorizontal: 16, paddingTop: 16 }}>
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable
                onPress={goBackFromStudents}
                style={{ flexDirection: "row", alignItems: "center" }}
              >
                <Ionicons name="chevron-back" size={20} color={colors.text} />
              </Pressable>
              <ShimmerBlock style={{ height: 28, width: 140, borderRadius: 12 }} />
            </View>
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
        contentContainerStyle={{ paddingBottom: 24, gap: 16, paddingHorizontal: 16, paddingTop: 0 }}
        keyboardShouldPersistTaps="handled"
        stickyHeaderIndices={[0]}
        onScrollBeginDrag={closeAllPickers}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await reload();
              } finally {
                setRefreshing(false);
              }
            }}
            tintColor={colors.text}
            colors={[colors.text]}
          />
        }
      >
        <View
          style={{
            gap: 16,
            backgroundColor: colors.background,
            paddingTop: 16,
            paddingBottom: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.background,
            position: "relative",
            zIndex: 20,
          }}
        >
          <Pressable
            onPress={goBackFromStudents}
            style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
            <Text style={{ fontSize: 26, fontWeight: "700", color: colors.text }}>
              Alunos
            </Text>
          </Pressable>
          <AnimatedSegmentedTabs
            tabs={studentsTabMeta}
            activeTab={studentsTab}
            onChange={requestSwitchStudentsTab}
          />
        </View>

        <ConfirmCloseOverlay
          visible={showStudentsTabConfirm}
          onCancel={() => {
            setShowStudentsTabConfirm(false);
            setPendingStudentsTab(null);
          }}
          onConfirm={() => {
            setShowStudentsTabConfirm(false);
            doResetForm();
            resetPreRegistrationForm();
            setStudentsTab(pendingStudentsTab ?? "alunos");
            setPendingStudentsTab(null);
          }}
        />

        <View
          style={{
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            padding: 12,
            gap: 10,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>
              Visão geral
            </Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>
              {activeOrganization?.name ?? "Sem organização"}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View
              style={{
                flex: 1,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.secondaryBg,
                padding: 10,
                gap: 2,
              }}
            >
              <Text style={{ color: colors.muted, fontSize: 11 }}>Alunos ativos</Text>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>{students.length}</Text>
            </View>
            <View
              style={{
                flex: 1,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.secondaryBg,
                padding: 10,
                gap: 2,
              }}
            >
              <Text style={{ color: colors.muted, fontSize: 11 }}>Convites pendentes</Text>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>
                {pendingStudentInvites.length}
              </Text>
            </View>
            <View
              style={{
                flex: 1,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.secondaryBg,
                padding: 10,
                gap: 2,
              }}
            >
              <Text style={{ color: colors.muted, fontSize: 11 }}>Aniversários hoje</Text>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>
                {birthdayTodayAll.length}
              </Text>
            </View>
          </View>
        </View>

        {studentsTab === "cadastro" && (
          <StudentRegistrationTab
            colors={colors}
            selectFieldStyle={selectFieldStyle}
            photoUrl={photoUrl}
            setShowPhotoSheet={setShowPhotoSheet}
            isExperimental={isExperimental}
            showTypePicker={showTypePicker}
            typeTriggerRef={typeTriggerRef}
            toggleFormPicker={toggleFormPicker}
            openCreateSection={openCreateSection}
            toggleCreateSection={toggleCreateSection}
            createStudentDataAnim={createStudentDataAnim}
            createDocumentsAnim={createDocumentsAnim}
            createSportAnim={createSportAnim}
            createHealthAnim={createHealthAnim}
            createGuardianAnim={createGuardianAnim}
            name={name}
            setName={setName}
            formatName={formatName}
            unit={unit}
            showUnitPicker={showUnitPicker}
            unitTriggerRef={unitTriggerRef}
            selectedClassName={selectedClassName}
            showClassPicker={showClassPicker}
            classTriggerRef={classTriggerRef}
            studentFormError={studentFormError}
            birthDate={birthDate}
            setBirthDate={setBirthDate}
            setShowCalendar={setShowCalendar}
            ageNumber={ageNumber}
            phone={phone}
            setPhone={setPhone}
            formatPhone={formatPhone}
            ra={ra}
            setRa={setRa}
            setStudentDocumentsError={setStudentDocumentsError}
            cpfDisplay={cpfDisplay}
            setCpfDisplay={setCpfDisplay}
            setIsCpfVisible={setIsCpfVisible}
            setCpfRevealedValue={setCpfRevealedValue}
            setCpfRevealUnavailable={setCpfRevealUnavailable}
            rgDocument={rgDocument}
            setRgDocument={setRgDocument}
            editingId={editingId}
            canRevealCpf={canRevealCpf}
            isCpfVisible={isCpfVisible}
            revealCpfBusy={revealCpfBusy}
            handleRevealEditingCpf={handleRevealEditingCpf}
            studentDocumentsError={studentDocumentsError}
            loginEmail={loginEmail}
            setLoginEmail={setLoginEmail}
            formatEmail={formatEmail}
            positionPrimary={positionPrimary}
            setPositionPrimary={setPositionPrimary}
            positionSecondary={positionSecondary}
            setPositionSecondary={setPositionSecondary}
            athleteObjective={athleteObjective}
            setAthleteObjective={setAthleteObjective}
            learningStyle={learningStyle}
            setLearningStyle={setLearningStyle}
            healthIssue={healthIssue}
            setHealthIssue={setHealthIssue}
            healthIssueNotes={healthIssueNotes}
            setHealthIssueNotes={setHealthIssueNotes}
            medicationUse={medicationUse}
            setMedicationUse={setMedicationUse}
            medicationNotes={medicationNotes}
            setMedicationNotes={setMedicationNotes}
            healthObservations={healthObservations}
            setHealthObservations={setHealthObservations}
            guardianName={guardianName}
            setGuardianName={setGuardianName}
            guardianPhone={guardianPhone}
            setGuardianPhone={setGuardianPhone}
            guardianRelation={guardianRelation}
            showGuardianRelationPicker={showGuardianRelationPicker}
            guardianRelationTriggerRef={guardianRelationTriggerRef}
            canSaveStudent={canSaveStudent}
            onSave={onSave}
            isFormDirty={isFormDirty}
            doResetForm={doResetForm}
            confirmDialog={confirmDialog}
          />
        )}

        {studentsTab === "aniversários" && (
          <BirthdaysTab
            colors={colors}
            birthdayMonthFilter={birthdayMonthFilter}
            setBirthdayMonthFilter={setBirthdayMonthFilter}
            birthdaySearch={birthdaySearch}
            setBirthdaySearch={setBirthdaySearch}
            birthdayToday={birthdayToday}
            upcomingBirthdays={upcomingBirthdays}
            showAllBirthdays={showAllBirthdays}
            setShowAllBirthdays={setShowAllBirthdays}
            showAllBirthdaysContent={showAllBirthdaysContent}
            allBirthdaysAnimStyle={allBirthdaysAnimStyle}
            birthdayUnitOptions={birthdayUnitOptions}
            birthdayUnitFilter={birthdayUnitFilter}
            setBirthdayUnitFilter={setBirthdayUnitFilter}
            birthdayMonthGroups={birthdayMonthGroups}
            classById={classById}
            unitLabel={unitLabel}
            calculateAge={calculateAge}
            formatShortDate={formatShortDate}
          />
        )}



        {studentsTab === "alunos" && (
          <StudentsListTab
            studentsUnitOptions={studentsUnitOptions}
            studentsUnitFilter={studentsUnitFilter}
            setStudentsUnitFilter={setStudentsUnitFilter}
            studentsSearch={studentsSearch}
            setStudentsSearch={setStudentsSearch}
            studentsFiltered={studentsFiltered}
            studentsGrouped={studentsGrouped}
            expandedUnits={expandedUnits}
            expandedClasses={expandedClasses}
            toggleUnitExpanded={toggleUnitExpanded}
            toggleClassExpanded={toggleClassExpanded}
            renderStudentItem={renderStudentItem}
          />
        )}

      </ScrollView>

      <Pressable
        onPress={() => setShowStudentsFabMenu((current) => !current)}
        style={{
          ...(Platform.OS === "web"
            ? ({ position: "fixed", right: studentsFabRight, bottom: studentsFabBottom } as any)
            : { position: "absolute" as const, right: studentsFabRight, bottom: studentsFabBottom }),
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.primaryBg,
          borderWidth: 1,
          borderColor: colors.border,
          zIndex: 3200,
          shadowColor: "#000",
          shadowOpacity: 0.2,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 8 },
          elevation: 12,
        }}
      >
        <Animated.View
          style={{
            transform: [{ rotate: studentsFabRotate }, { scale: studentsFabScale }],
          }}
        >
          <Ionicons name="add" size={24} color={colors.primaryText} />
        </Animated.View>
      </Pressable>

      <StudentsFabMenu
        visible={showStudentsFabMenu}
        exportBusy={studentsExportBusy}
        anchorRight={studentsFabRight}
        anchorBottom={studentsFabBottom}
        onClose={() => setShowStudentsFabMenu(false)}
        onSyncFormsPress={() => {
          setShowStudentsFabMenu(false);
          setShowStudentsFormsSyncModal(true);
        }}
        onImportPress={() => {
          setShowStudentsFabMenu(false);
          setShowStudentsImportModal(true);
        }}
        onExportPress={() => {
          void handleExportStudents().finally(() => {
            setShowStudentsFabMenu(false);
          });
        }}
      />

      <StudentsFormsSyncModal
        visible={showStudentsFormsSyncModal}
        organizationId={activeOrganization?.id ?? null}
        classes={classes}
        onClose={() => setShowStudentsFormsSyncModal(false)}
        onImportApplied={() => {
          void reload();
        }}
      />

      <StudentsImportModal
        visible={showStudentsImportModal}
        organizationId={activeOrganization?.id ?? null}
        classes={classes}
        onClose={() => setShowStudentsImportModal(false)}
        onImportApplied={() => {
          void reload();
        }}
      />

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
            backgroundColor: colors.card,
          }}
          scrollContentStyle={{ padding: 8, gap: 6 }}
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
            backgroundColor: colors.card,
          }}
          scrollContentStyle={{ padding: 8, gap: 6 }}
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
            backgroundColor: colors.card,
          }}
          scrollContentStyle={{ padding: 8, gap: 6 }}
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
        <StudentsAnchoredDropdown
          visible={showTypePickerContent}
          layout={typeTriggerLayout}
          container={containerWindow}
          animationStyle={typePickerAnimStyle}
          zIndex={320}
          maxHeight={120}
          nestedScrollEnabled
          onRequestClose={closeAllPickers}
          panelStyle={{
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
          }}
          scrollContentStyle={{ padding: 8, gap: 6 }}
        >
          {([{ label: "Aluno regular", value: "regular" }, { label: "Experimental", value: "experimental" }] as const).map((item, index) => (
            <SelectOption
              key={item.value}
              label={item.label}
              value={item.value}
              active={(item.value === "experimental") === isExperimental}
              onSelect={handleSelectType}
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
      <StudentEditModal
        showEditModal={showEditModal}
        requestCloseEditModal={requestCloseEditModal}
        editModalCardStyle={editModalCardStyle}
        showEditCloseConfirm={showEditCloseConfirm}
        setShowEditCloseConfirm={setShowEditCloseConfirm}
        closeEditModal={closeEditModal}
        editModalRef={editModalRef}
        setEditContainerWindow={setEditContainerWindow}
        photoUrl={photoUrl}
        setShowPhotoSheet={setShowPhotoSheet}
        pickStudentPhoto={pickStudentPhoto}
        openEditSection={openEditSection}
        toggleEditSection={toggleEditSection}
        editStudentDataAnim={editStudentDataAnim}
        editDocumentsAnim={editDocumentsAnim}
        editSportAnim={editSportAnim}
        editHealthAnim={editHealthAnim}
        editGuardianAnim={editGuardianAnim}
        editLinksAnim={editLinksAnim}
        name={name}
        setName={setName}
        loginEmail={loginEmail}
        setLoginEmail={setLoginEmail}
        birthDate={birthDate}
        setBirthDate={setBirthDate}
        ageNumber={ageNumber}
        phone={phone}
        setPhone={setPhone}
        studentFormError={studentFormError}
        setShowCalendar={setShowCalendar}
        formatName={formatName}
        formatEmail={formatEmail}
        formatPhone={formatPhone}
        ra={ra}
        setRa={setRa}
        cpfDisplay={cpfDisplay}
        setCpfDisplay={setCpfDisplay}
        rgDocument={rgDocument}
        setRgDocument={setRgDocument}
        editingId={editingId}
        canRevealCpf={canRevealCpf}
        isCpfVisible={isCpfVisible}
        revealCpfBusy={revealCpfBusy}
        handleRevealEditingCpf={handleRevealEditingCpf}
        studentDocumentsError={studentDocumentsError}
        setIsCpfVisible={setIsCpfVisible}
        setCpfRevealedValue={setCpfRevealedValue}
        setCpfRevealUnavailable={setCpfRevealUnavailable}
        setStudentDocumentsError={setStudentDocumentsError}
        editDocumentsSummary={editDocumentsSummary}
        positionPrimary={positionPrimary}
        setPositionPrimary={setPositionPrimary}
        positionSecondary={positionSecondary}
        setPositionSecondary={setPositionSecondary}
        athleteObjective={athleteObjective}
        setAthleteObjective={setAthleteObjective}
        learningStyle={learningStyle}
        setLearningStyle={setLearningStyle}
        editSportSummary={editSportSummary}
        healthIssue={healthIssue}
        setHealthIssue={setHealthIssue}
        healthIssueNotes={healthIssueNotes}
        setHealthIssueNotes={setHealthIssueNotes}
        medicationUse={medicationUse}
        setMedicationUse={setMedicationUse}
        medicationNotes={medicationNotes}
        setMedicationNotes={setMedicationNotes}
        healthObservations={healthObservations}
        setHealthObservations={setHealthObservations}
        editHealthSummary={editHealthSummary}
        guardianName={guardianName}
        setGuardianName={setGuardianName}
        guardianPhone={guardianPhone}
        setGuardianPhone={setGuardianPhone}
        guardianRelation={guardianRelation}
        editGuardianRelationTriggerRef={editGuardianRelationTriggerRef}
        toggleEditPicker={toggleEditPicker}
        showEditGuardianRelationPicker={showEditGuardianRelationPicker}
        editGuardianSummary={editGuardianSummary}
        guardianRelationOptions={guardianRelationOptions}
        showEditGuardianRelationPickerContent={showEditGuardianRelationPickerContent}
        editGuardianRelationTriggerLayout={editGuardianRelationTriggerLayout}
        editGuardianRelationPickerAnimStyle={editGuardianRelationPickerAnimStyle}
        handleSelectEditGuardianRelation={handleSelectEditGuardianRelation}
        unit={unit}
        editUnitTriggerRef={editUnitTriggerRef}
        showEditUnitPicker={showEditUnitPicker}
        selectedClassName={selectedClassName}
        editClassTriggerRef={editClassTriggerRef}
        showEditClassPicker={showEditClassPicker}
        editLinksSummary={editLinksSummary}
        unitOptions={unitOptions}
        showEditUnitPickerContent={showEditUnitPickerContent}
        editUnitTriggerLayout={editUnitTriggerLayout}
        editContainerWindow={editContainerWindow}
        editUnitPickerAnimStyle={editUnitPickerAnimStyle}
        handleSelectEditUnit={handleSelectEditUnit}
        classOptions={classOptions}
        classId={classId}
        showEditClassPickerContent={showEditClassPickerContent}
        editClassTriggerLayout={editClassTriggerLayout}
        editClassPickerAnimStyle={editClassPickerAnimStyle}
        handleSelectEditClass={handleSelectEditClass}
        closeAllEditPickers={closeAllEditPickers}
        deleteEditingStudent={deleteEditingStudent}
        editSaving={editSaving}
        setEditSaving={setEditSaving}
        onSave={onSave}
        isEditDirty={isEditDirty}
        selectFieldStyle={selectFieldStyle}
        colors={colors}
        SelectOption={SelectOption}
        ClassOption={ClassOption}
      />
      <WhatsAppModal
        visible={showWhatsAppModal}
        onClose={closeWhatsAppModal}
        cardStyle={whatsappModalCardStyle}
        selectedStudentId={selectedStudentId}
        students={students}
        classById={classById}
        selectedContactType={selectedContactType}
        setSelectedContactType={setSelectedContactType}
        selectedTemplateId={selectedTemplateId}
        selectedTemplateLabel={selectedTemplateLabel}
        setSelectedTemplateId={setSelectedTemplateId}
        setSelectedTemplateLabel={setSelectedTemplateLabel}
        customFields={customFields}
        setCustomFields={setCustomFields}
        customStudentMessage={customStudentMessage}
        setCustomStudentMessage={setCustomStudentMessage}
        studentInviteBusy={studentInviteBusy}
        showRevokeConfirm={showRevokeConfirm}
        setShowRevokeConfirm={setShowRevokeConfirm}
        applyStudentInviteTemplate={applyStudentInviteTemplate}
        whatsappNotice={whatsappNotice}
        showTemplateList={showTemplateList}
        setShowTemplateList={setShowTemplateList}
        showTemplateListContent={showTemplateListContent}
        templateTriggerLayout={templateTriggerLayout}
        whatsappContainerWindow={whatsappContainerWindow}
        templateListAnimStyle={templateListAnimStyle}
        syncTemplateLayout={syncTemplateLayout}
        closeAllPickers={closeAllPickers}
        whatsappContainerRef={whatsappContainerRef}
        templateTriggerRef={templateTriggerRef}
        groupInviteLinks={groupInviteLinks}
        colors={colors}
        buildStudentMessage={buildStudentMessage}
      />
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

