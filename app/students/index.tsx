import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  StudentInvitePendingItem,
  listStudentPendingInvites,
} from "../../src/api/student-invite";
import {
  removeStudentPhotoObject,
  uploadStudentPhoto,
} from "../../src/api/student-photo-storage";
import { useAuth } from "../../src/auth/auth";
import { ScreenPageHeader } from "../../src/components/ui/ScreenPageHeader";
import { sortClassesBySchedule } from "../../src/core/class-schedule-sort";
import { useEffectiveProfile } from "../../src/hooks/use-effective-profile";
import type { ClassGroup, Student } from "../../src/core/models";
import { deriveStudentHealthAssessment } from "../../src/core/student-health";
import {
  findPossibleExistingStudents,
  normalizeStudentLookupName,
} from "../../src/core/students/find-possible-existing-students";
import { isStudentBirthdayToday } from "../../src/core/students/student-birthday";
import { normalizeUnitKey } from "../../src/core/unit-key";
import {
  deleteStudent,
  getClasses,
  getStudents,
  revealStudentCpf,
  saveStudent,
  updateStudent,
} from "../../src/db/seed";
import { navigateBackOrReplace } from "../../src/navigation/safe-router";
import { useIsOnline } from "../../src/hooks/use-is-online";
import { useDebouncedValue } from "../../src/hooks/useDebouncedValue";
import { logAction } from "../../src/observability/breadcrumbs";
import {
  markRender,
  measure,
  measureAsync,
} from "../../src/observability/perf";
import { useOrganization } from "../../src/providers/OrganizationProvider";
import { shadow } from "../../src/theme/tokens";
import {
  StudentClassDropdownPanel,
  type ClassModalityFilterValue,
} from "../../src/screens/students/components/StudentClassDropdownPanel";
import { StudentSelectOption } from "../../src/screens/students/components/StudentDropdownOptions";
import { StudentListRow } from "../../src/screens/students/components/StudentListRow";
import { StudentsExportSyncMenu } from "../../src/screens/students/components/StudentsExportSyncMenu";
import {
  filterStudentsForList,
  hasActiveStudentSearch,
  normalizeStudentSearchText,
} from "../../src/screens/students/application/student-search";
import {
  buildStudentListGroups,
  groupStudentsByClassId,
} from "../../src/screens/students/application/student-list-selectors";
import { exportStudentsXlsx } from "../../src/screens/students/export/exportStudentsXlsx";
import { useBuildStudentMessage } from "../../src/screens/students/hooks/useBuildStudentMessage";
import { useOnEditStudent } from "../../src/screens/students/hooks/useOnEditStudent";
import { usePreRegistrationForm } from "../../src/screens/students/hooks/usePreRegistrationForm";
import { useStudentForm } from "../../src/screens/students/hooks/useStudentForm";
import { useStudentInvites } from "../../src/screens/students/hooks/useStudentInvites";
import { useWhatsAppModal } from "../../src/screens/students/hooks/useWhatsAppModal";
import { StudentEditModal } from "../../src/screens/students/modals/StudentEditModal";
import { StudentsFormsSyncModal } from "../../src/screens/students/modals/StudentsFormsSyncModal";
import { StudentsImportModal } from "../../src/screens/students/modals/StudentsImportModal";
import { WhatsAppModal } from "../../src/screens/students/modals/WhatsAppModal";
import { StudentsListTab } from "../../src/screens/students/StudentsListTab";
import { AnchoredDropdown as StudentsAnchoredDropdown } from "../../src/ui/AnchoredDropdown";
import { useAppTheme } from "../../src/ui/app-theme";
import { AppRefreshControl } from "../../src/ui/AppRefreshControl";
import { Button } from "../../src/ui/Button";
import { getClassPalette } from "../../src/ui/class-colors";
import { useConfirmDialog } from "../../src/ui/confirm-dialog";
import { useConfirmUndo } from "../../src/ui/confirm-undo";
import { ConfirmCloseOverlay } from "../../src/ui/ConfirmCloseOverlay";
import { DatePickerModal } from "../../src/ui/DatePickerModal";
import { ModalSheet } from "../../src/ui/ModalSheet";
import { Pressable } from "../../src/ui/Pressable";
import { useSaveToast } from "../../src/ui/save-toast";
import { useFormValidationFeedback } from "../../src/ui/form-validation-feedback";
import { ShimmerBlock } from "../../src/ui/Shimmer";
import { getUnitPalette } from "../../src/ui/unit-colors";
import { useCollapsibleAnimation } from "../../src/ui/use-collapsible";
import { useModalCardStyle } from "../../src/ui/use-modal-card-style";
import { useUndoableListDelete } from "../../src/ui/useUndoableListDelete";
import { usePersistedState } from "../../src/ui/use-persisted-state";
import { WebCameraCaptureModal } from "../../src/ui/WebCameraCaptureModal";
import { useWhatsAppSettings } from "../../src/ui/whatsapp-settings-context";
import {
  normalizeRaDigits,
  validateStudentRa,
} from "../../src/utils/student-ra";
import { getContactPhone } from "../../src/utils/whatsapp";
import { GoAtletaIcon } from "../../src/ui/icon-registry";
import {
  WHATSAPP_TEMPLATES,
  type WhatsAppTemplateId,
} from "../../src/utils/whatsapp-templates";

const createStudentId = () => `s_${Date.now()}`;

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
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    age -= 1;
  }
  return age;
};

const hasBirthDateWarning = (birthDate: string) => {
  const raw = String(birthDate ?? "").trim();
  if (!raw) return false;
  const age = calculateAge(raw);
  if (age === null) return true;
  return age < 5 || age > 60;
};

const StudentRegistrationTab = lazy(() =>
  import("../../src/screens/students/StudentRegistrationTab").then(
    (module) => ({
      default: module.StudentRegistrationTab,
    }),
  ),
);

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
const athleteLearningStyleOptions = [
  "misto",
  "visual",
  "auditivo",
  "cinestesico",
] as const;
type StudentValidationField = "unitClass" | "name" | "birthDate" | "ra";

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
type StudentsTab = "cadastro" | "alunos";

export default function StudentsScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const isCompactForm = Platform.OS !== "web" && windowWidth <= 760;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const effectiveProfile = useEffectiveProfile();
  const isOnline = useIsOnline();
  const canRevealCpf = effectiveProfile === "admin";
  const { colors, mode } = useAppTheme();
  const { showSaveToast } = useSaveToast();
  const { activeOrganization } = useOrganization();
  const { coachName, groupInviteLinks } = useWhatsAppSettings();
  const { confirm } = useConfirmUndo();
  const { confirm: confirmDialog } = useConfirmDialog();
  const emptyDropdownTextStyle = useMemo(
    () => ({
      color: colors.muted,
      fontSize: 12,
      padding: 10,
    }),
    [colors.muted],
  );
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
  const editModalCardStyle = useModalCardStyle({
    maxHeight: Platform.OS === "web" ? "92%" : "96%",
    maxWidth: isCompactForm ? 700 : 960,
    padding: 16,
    radius: 16,
  });
  const whatsappModalCardStyle = useModalCardStyle({
    maxHeight: "70%",
    maxWidth: 440,
  });
  const photoPreviewCardStyle = useModalCardStyle({
    maxHeight: "70%",
    maxWidth: 360,
  });
  const photoSheetCardStyle = useModalCardStyle({
    maxHeight: "55%",
    maxWidth: 320,
  });
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isMountedRef = useRef(true);
  const [showForm, setShowForm] = usePersistedState<boolean>(
    "students_show_form_v1",
    false,
  );
  const [studentsTab, setStudentsTab] = useState<StudentsTab>("alunos");
  const isCadastroTab = studentsTab === "cadastro";
  const [showStudentsFormsSyncModal, setShowStudentsFormsSyncModal] =
    useState(false);
  const [showStudentsImportModal, setShowStudentsImportModal] = useState(false);
  const [studentsExportBusy, setStudentsExportBusy] = useState(false);
  const [showStudentsTabConfirm, setShowStudentsTabConfirm] = useState(false);
  const [pendingStudentsTab, setPendingStudentsTab] =
    useState<StudentsTab | null>(null);
  const [studentsUnitFilter, setStudentsUnitFilter] = useState("Todas");
  const [studentsSearch, setStudentsSearch] = useState("");
  const [dismissedExistingStudentProbe, setDismissedExistingStudentProbe] =
    useState("");
  const debouncedStudentsSearch = useDebouncedValue(studentsSearch, 250);

  useFocusEffect(
    useCallback(() => {
      setStudentsTab("alunos");
    }, []),
  );

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      return undefined;
    }
    const openStudentsList = () => setStudentsTab("alunos");
    window.addEventListener("goatleta:open-students-list", openStudentsList);
    return () =>
      window.removeEventListener(
        "goatleta:open-students-list",
        openStudentsList,
      );
  }, []);
  // --- Formulário de aluno (42 campos → useReducer) ---
  const {
    form,
    setUnit,
    setAgeBand,
    setCustomAgeBand,
    setClassId,
    setName,
    setPhotoUrl,
    setPhotoMimeType,
    setBirthDate,
    setAgeNumber,
    setPhone,
    setCpfDisplay,
    setCpfMaskedOriginal,
    setCpfRevealedValue,
    setIsCpfVisible,
    setCpfRevealUnavailable,
    setRevealCpfBusy,
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
    setHealthIssue,
    setHealthIssueNotes,
    setMedicationUse,
    setMedicationNotes,
    setHealthObservations,
    setIsExperimental,
    setCollegeCourse,
    setEditingId,
    setEditingCreatedAt,
    setOpenCreateSection,
    setOpenEditSection,
    setStudentFormError,
    setStudentDocumentsError,
    setEditSnapshot,
    resetForm,
  } = useStudentForm();

  const {
    unit,
    ageBand,
    customAgeBand,
    classId,
    name,
    collegeCourse,
    photoUrl,
    photoMimeType,
    birthDate,
    ageNumber,
    phone,
    cpfDisplay,
    cpfMaskedOriginal,
    cpfRevealedValue,
    isCpfVisible,
    cpfRevealUnavailable,
    revealCpfBusy,
    rgDocument,
    ra,
    loginEmail,
    guardianName,
    guardianPhone,
    guardianRelation,
    positionPrimary,
    positionSecondary,
    athleteObjective,
    learningStyle,
    healthIssue,
    healthIssueNotes,
    medicationUse,
    medicationNotes,
    healthObservations,
    isExperimental,
    editingId,
    editingCreatedAt,
    openCreateSection,
    openEditSection,
    formError: studentFormError,
    documentsError: studentDocumentsError,
    editSnapshot,
  } = form;
  const {
    issue: studentValidationIssue,
    showValidationError: showStudentValidationError,
    clearValidationError: clearStudentValidationError,
  } = useFormValidationFeedback<StudentValidationField>();
  const debouncedExistingStudentName = useDebouncedValue(name, 400);

  // --- Pr?-cadastro (useReducer) ---
  const { resetPreRegistrationForm } = usePreRegistrationForm();

  // --- Modal WhatsApp (useReducer) ---
  const {
    waModal,
    setShowWhatsAppModal,
    setWhatsappNotice,
    setShowRevokeConfirm,
    setSelectedStudentId,
    setSelectedContactType,
    setSelectedTemplateId,
    setSelectedTemplateLabel,
    setCustomFields,
    setCustomStudentMessage,
    setShowTemplateList,
    setWhatsappContainerWindow,
    setTemplateTriggerLayout,
  } = useWhatsAppModal();

  const {
    showWhatsAppModal,
    whatsappNotice,
    showRevokeConfirm,
    selectedStudentId,
    selectedContactType,
    selectedTemplateId,
    selectedTemplateLabel,
    customFields,
    customStudentMessage,
    showTemplateList,
    whatsappContainerWindow,
    templateTriggerLayout,
  } = waModal;

  // --- Estados de UI que permanecem locais (não pertencem ao Formulário) ---
  const [showCalendar, setShowCalendar] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [showClassPicker, setShowClassPicker] = useState(false);
  const [classModalityFilter, setClassModalityFilter] =
    useState<ClassModalityFilterValue>("all");
  const [showGuardianRelationPicker, setShowGuardianRelationPicker] =
    useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showEditUnitPicker, setShowEditUnitPicker] = useState(false);
  const [showEditClassPicker, setShowEditClassPicker] = useState(false);
  const [showEditGuardianRelationPicker, setShowEditGuardianRelationPicker] =
    useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editUnitFilters, setEditUnitFilters] = useState<string[]>([]);
  const [showEditCloseConfirm, setShowEditCloseConfirm] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);
  const [showWebCamera, setShowWebCamera] = useState(false);
  const [showPhotoPreview, setShowPhotoPreview] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<{
    uri: string | null;
    name: string;
  } | null>(null);
  markRender("screen.students.render.root");
  const [saveNotice, setSaveNotice] = useState("");
  const [studentInviteBusy, setStudentInviteBusy] = useState(false);
  const [pendingStudentInvites, setPendingStudentInvites] = useState<
    StudentInvitePendingItem[]
  >([]);
  const [pendingStudentInviteBusyId, setPendingStudentInviteBusyId] = useState<
    string | null
  >(null);
  const saveNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const whatsappNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const saveNoticeAnim = useRef(new Animated.Value(0)).current;
  const [expandedUnits, setExpandedUnits] = usePersistedState<
    Record<string, boolean>
  >("students_units_expanded_v1", {});
  const [expandedClasses, setExpandedClasses] = usePersistedState<
    Record<string, boolean>
  >("students_classes_expanded_v1", {});
  const [containerWindow, setContainerWindow] = useState<{
    x: number;
    y: number;
  } | null>(null);
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
  const [guardianRelationTriggerLayout, setGuardianRelationTriggerLayout] =
    useState<{
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
  const [editContainerWindow, _setEditContainerWindow] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const setEditContainerWindow = useCallback(
    (value: { x: number; y: number } | null) => {
      _setEditContainerWindow((current) => {
        if (
          current &&
          value &&
          current.x === value.x &&
          current.y === value.y
        ) {
          return current;
        }
        if (!current && !value) return current;
        return value;
      });
    },
    [],
  );
  const [
    editGuardianRelationTriggerLayout,
    setEditGuardianRelationTriggerLayout,
  ] = useState<{
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
  const {
    animatedStyle: unitPickerAnimStyle,
    isVisible: showUnitPickerContent,
  } = useCollapsibleAnimation(showUnitPicker);
  const {
    animatedStyle: classPickerAnimStyle,
    isVisible: showClassPickerContent,
  } = useCollapsibleAnimation(showClassPicker);
  const {
    animatedStyle: guardianRelationPickerAnimStyle,
    isVisible: showGuardianRelationPickerContent,
  } = useCollapsibleAnimation(showGuardianRelationPicker);
  const {
    animatedStyle: typePickerAnimStyle,
    isVisible: showTypePickerContent,
  } = useCollapsibleAnimation(showTypePicker);
  const {
    animatedStyle: editUnitPickerAnimStyle,
    isVisible: showEditUnitPickerContent,
  } = useCollapsibleAnimation(showEditUnitPicker);
  const {
    animatedStyle: editClassPickerAnimStyle,
    isVisible: showEditClassPickerContent,
  } = useCollapsibleAnimation(showEditClassPicker);
  const {
    animatedStyle: editGuardianRelationPickerAnimStyle,
    isVisible: showEditGuardianRelationPickerContent,
  } = useCollapsibleAnimation(showEditGuardianRelationPicker);
  const {
    animatedStyle: templateListAnimStyle,
    isVisible: showTemplateListContent,
  } = useCollapsibleAnimation(showTemplateList, { translateY: -6 });
  const accordionAnimOptions = useMemo(
    () => ({ durationIn: 160, durationOut: 120, translateY: -3 }),
    [],
  );
  const createSectionTransitionRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const editSectionTransitionRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const createStudentDataAnim = useCollapsibleAnimation(
    openCreateSection === "studentData",
    accordionAnimOptions,
  );
  const createAcademicAnim = useCollapsibleAnimation(
    openCreateSection === "academic",
    accordionAnimOptions,
  );
  const createDocumentsAnim = useCollapsibleAnimation(
    openCreateSection === "documents",
    accordionAnimOptions,
  );
  const createSportAnim = useCollapsibleAnimation(
    openCreateSection === "sportProfile",
    accordionAnimOptions,
  );
  const createHealthAnim = useCollapsibleAnimation(
    openCreateSection === "health",
    accordionAnimOptions,
  );
  const createGuardianAnim = useCollapsibleAnimation(
    openCreateSection === "guardian",
    accordionAnimOptions,
  );
  const editStudentDataAnim = useCollapsibleAnimation(
    openEditSection === "studentData",
    accordionAnimOptions,
  );
  const editAcademicAnim = useCollapsibleAnimation(
    openEditSection === "academic",
    accordionAnimOptions,
  );
  const editDocumentsAnim = useCollapsibleAnimation(
    openEditSection === "documents",
    accordionAnimOptions,
  );
  const editSportAnim = useCollapsibleAnimation(
    openEditSection === "sportProfile",
    accordionAnimOptions,
  );
  const editHealthAnim = useCollapsibleAnimation(
    openEditSection === "health",
    accordionAnimOptions,
  );
  const editGuardianAnim = useCollapsibleAnimation(
    openEditSection === "guardian",
    accordionAnimOptions,
  );
  const editLinksAnim = useCollapsibleAnimation(
    openEditSection === "links",
    accordionAnimOptions,
  );
  useEffect(
    () => () => {
      if (createSectionTransitionRef.current)
        clearTimeout(createSectionTransitionRef.current);
      if (editSectionTransitionRef.current)
        clearTimeout(editSectionTransitionRef.current);
    },
    [],
  );
  const loadSupplementaryStudentsData = useCallback(
    async (aliveRef: { current: boolean }) => {
      const invitesPromise = session?.access_token
        ? listStudentPendingInvites().catch((error) => {
            console.warn("StudentsScreen invite load failed", error);
            return { invites: [] };
          })
        : Promise.resolve({ invites: [] });

      const pendingInvitesResult = await invitesPromise;
      if (!aliveRef.current) return;
      setPendingStudentInvites(pendingInvitesResult.invites ?? []);
    },
    [session?.access_token],
  );

  useEffect(() => {
    const alive = { current: true };
    (async () => {
      try {
        const [classList, studentList] = await measureAsync(
          "screen.students.load.critical",
          () =>
            Promise.all([
              getClasses({ organizationId: activeOrganization?.id }),
              getStudents({ organizationId: activeOrganization?.id }),
            ]),
          { hasOrganization: activeOrganization?.id ? 1 : 0 },
        );
        if (!alive.current) return;
        setClasses(classList);
        setStudents(studentList);
        void measureAsync(
          "screen.students.load.supplementary",
          () => loadSupplementaryStudentsData(alive),
          { hasOrganization: activeOrganization?.id ? 1 : 0 },
        );
      } catch (error) {
        if (!alive.current) return;
        setClasses([]);
        setStudents([]);
        setPendingStudentInvites([]);
        console.warn("StudentsScreen initial load failed", error);
      } finally {
        if (alive.current) setLoading(false);
      }
    })();
    return () => {
      alive.current = false;
    };
  }, [activeOrganization, loadSupplementaryStudentsData]);

  const reload = useCallback(async () => {
    try {
      const [studentList] = await Promise.all([
        getStudents({ organizationId: activeOrganization?.id }),
      ]);
      setStudents(studentList);
      await loadSupplementaryStudentsData(isMountedRef);
    } catch (error) {
      console.warn("StudentsScreen reload failed", error);
    }
  }, [activeOrganization, loadSupplementaryStudentsData]);

  useEffect(() => {
    if ((studentsTab as string) === "importar") {
      setStudentsTab("alunos");
    }
  }, [studentsTab, setStudentsTab]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleExportStudents = async () => {
    const organizationId = activeOrganization?.id ?? null;
    if (!organizationId) {
      Alert.alert("Alunos", "Selecione uma organização ativa.");
      return;
    }
    setStudentsExportBusy(true);
    try {
      const result = await exportStudentsXlsx({
        organizationId,
        organizationName: activeOrganization?.name ?? null,
      });
      Alert.alert(
        "Exportação concluída",
        `Arquivo ${result.fileName} com ${result.totalStudents} aluno(s).`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Falha ao exportar XLSX de alunos.";
      Alert.alert("Alunos", message);
    } finally {
      setStudentsExportBusy(false);
    }
  };
  const unitLabel = useCallback(
    (value: string) => (value && value.trim() ? value.trim() : "Sem unidade"),
    [],
  );

  const closeAllPickers = useCallback(() => {
    setShowUnitPicker(false);
    setShowClassPicker(false);
    setShowGuardianRelationPicker(false);
    setShowTypePicker(false);
    setShowTemplateList(false);
  }, [setShowTemplateList]);
  const closeAllEditPickers = useCallback(() => {
    setShowEditUnitPicker(false);
    setShowEditClassPicker(false);
    setShowEditGuardianRelationPicker(false);
  }, []);

  const toggleFormPicker = useCallback(
    (target: "unit" | "class" | "guardianRelation" | "type") => {
      setShowUnitPicker((prev) => (target === "unit" ? !prev : false));
      setShowClassPicker((prev) => (target === "class" ? !prev : false));
      setShowGuardianRelationPicker((prev) =>
        target === "guardianRelation" ? !prev : false,
      );
      setShowTypePicker((prev) => (target === "type" ? !prev : false));
    },
    [],
  );
  const toggleEditPicker = useCallback(
    (target: "unit" | "class" | "guardianRelation") => {
      setShowEditUnitPicker((prev) => (target === "unit" ? !prev : false));
      setShowEditClassPicker((prev) => (target === "class" ? !prev : false));
      setShowEditGuardianRelationPicker((prev) =>
        target === "guardianRelation" ? !prev : false,
      );
    },
    [],
  );

  const toggleCreateSection = useCallback(
    (
      section:
        | "studentData"
        | "academic"
        | "documents"
        | "sportProfile"
        | "health"
        | "guardian",
    ) => {
      if (createSectionTransitionRef.current)
        clearTimeout(createSectionTransitionRef.current);
      if (openCreateSection && openCreateSection !== section) {
        setOpenCreateSection(null);
        createSectionTransitionRef.current = setTimeout(() => {
          setOpenCreateSection(section);
          createSectionTransitionRef.current = null;
        }, 120);
        return;
      }
      setOpenCreateSection(openCreateSection === section ? null : section);
    },
    [openCreateSection, setOpenCreateSection],
  );
  const toggleEditSection = useCallback(
    (
      section:
        | "studentData"
        | "academic"
        | "documents"
        | "sportProfile"
        | "health"
        | "guardian"
        | "links",
    ) => {
      if (editSectionTransitionRef.current)
        clearTimeout(editSectionTransitionRef.current);
      if (openEditSection && openEditSection !== section) {
        setOpenEditSection(null);
        editSectionTransitionRef.current = setTimeout(() => {
          setOpenEditSection(section);
          editSectionTransitionRef.current = null;
        }, 120);
        return;
      }
      setOpenEditSection(openEditSection === section ? null : section);
    },
    [openEditSection, setOpenEditSection],
  );

  const handleSelectUnit = useCallback(
    (value: string) => {
      setUnit(value);
      setShowUnitPicker(false);
    },
    [setUnit],
  );

  const handleSelectClass = useCallback(
    (value: ClassGroup) => {
      setClassId(value.id);
      setUnit(unitLabel(value.unit));
      setAgeBand(value.ageBand);
      setCustomAgeBand("");
      setShowClassPicker(false);
    },
    [setAgeBand, setClassId, setCustomAgeBand, setUnit, unitLabel],
  );

  const handleSelectGuardianRelation = useCallback(
    (value: string) => {
      setGuardianRelation(value);
      setShowGuardianRelationPicker(false);
    },
    [setGuardianRelation],
  );

  const handleSelectType = useCallback(
    (value: string) => {
      setIsExperimental(value === "experimental");
      setShowTypePicker(false);
    },
    [setIsExperimental],
  );

  const handleToggleEditUnitFilter = useCallback((value: string) => {
    setEditUnitFilters((current) => {
      if (current.includes(value)) {
        return current.filter((item) => item !== value);
      }
      return [...current, value];
    });
  }, []);

  const handleSelectEditClass = useCallback(
    (value: ClassGroup) => {
      const nextUnit = unitLabel(value.unit);
      setClassId(value.id);
      setUnit(nextUnit);
      setEditUnitFilters((current) =>
        current.includes(nextUnit) ? current : [...current, nextUnit],
      );
      setAgeBand(value.ageBand);
      setCustomAgeBand("");
      setShowEditClassPicker(false);
    },
    [setAgeBand, setClassId, setCustomAgeBand, setUnit, unitLabel],
  );

  const handleSelectEditGuardianRelation = useCallback(
    (value: string) => {
      setGuardianRelation(value);
      setShowEditGuardianRelationPicker(false);
    },
    [setGuardianRelation],
  );

  const syncPickerLayouts = useCallback(() => {
    const hasPickerOpen =
      showUnitPicker ||
      showClassPicker ||
      showGuardianRelationPicker ||
      showTypePicker;
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
        guardianRelationTriggerRef.current?.measureInWindow(
          (x, y, width, height) => {
            setGuardianRelationTriggerLayout({ x, y, width, height });
          },
        );
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
  }, [
    showClassPicker,
    showGuardianRelationPicker,
    showUnitPicker,
    showTypePicker,
  ]);

  const syncEditPickerLayouts = useCallback(() => {
    const hasPickerOpen = showEditGuardianRelationPicker;
    if (!hasPickerOpen) return;
    requestAnimationFrame(() => {
      if (showEditGuardianRelationPicker) {
        editGuardianRelationTriggerRef.current?.measureInWindow(
          (x, y, width, height) => {
            setEditGuardianRelationTriggerLayout({ x, y, width, height });
          },
        );
      }
      editModalRef.current?.measureInWindow((x, y) => {
        setEditContainerWindow({ x, y });
      });
    });
  }, [setEditContainerWindow, showEditGuardianRelationPicker]);

  const syncTemplateLayout = useCallback(() => {
    requestAnimationFrame(() => {
      templateTriggerRef.current?.measureInWindow((x, y, width, height) => {
        setTemplateTriggerLayout({ x, y, width, height });
      });
      whatsappContainerRef.current?.measureInWindow((x, y) => {
        setWhatsappContainerWindow({ x, y });
      });
    });
  }, [setTemplateTriggerLayout, setWhatsappContainerWindow]);

  const unitOptions = useMemo(() => {
    const map = new Map<string, string>();
    const upperScore = (value: string) => (value.match(/[A-Z]/g) ?? []).length;
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
    [],
  );
  const classById = useMemo(() => {
    return new Map(classes.map((item) => [item.id, item] as const));
  }, [classes]);

  useEffect(() => {
    syncPickerLayouts();
  }, [
    showUnitPicker,
    showClassPicker,
    showGuardianRelationPicker,
    syncPickerLayouts,
  ]);

  useEffect(() => {
    if (showEditModal) syncEditPickerLayouts();
  }, [showEditModal, showEditGuardianRelationPicker, syncEditPickerLayouts]);

  useEffect(() => {
    if (showWhatsAppModal && showTemplateList) {
      syncTemplateLayout();
    }
  }, [showTemplateList, showWhatsAppModal, syncTemplateLayout]);

  useEffect(() => {
    if (!showForm)
      Promise.resolve().then(() => {
        closeAllPickers();
      });
  }, [closeAllPickers, showForm]);
  useEffect(() => {
    if (!showEditModal)
      Promise.resolve().then(() => {
        closeAllEditPickers();
      });
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
  }, [classId, classes, setClassId, unit, unitLabel]);

  const pickStudentPhoto = async (source: "camera" | "library" | "remove") => {
    try {
      if (source === "remove") {
        setPhotoUrl(null);
        setPhotoMimeType(null);
        return;
      }
      if (source === "camera") {
        if (Platform.OS === "web") {
          setShowWebCamera(true);
          return;
        }
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (permission.status !== "granted") {
          Alert.alert(
            "Permissão necessária",
            "Ative a Câmera para tirar a foto.",
          );
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.65,
          allowsEditing: true,
          aspect: [1, 1],
          base64: false,
          cameraType: ImagePicker.CameraType.back,
        });
        const asset = result.assets?.[0];
        if (!result.canceled && asset?.uri) {
          setPhotoUrl(asset.uri);
          setPhotoMimeType(asset.mimeType ?? null);
        }
        return;
      }
      if (Platform.OS !== "web") {
        const permission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permission.status !== "granted") {
          Alert.alert(
            "Permissão necessária",
            "Ative a galeria para escolher uma foto.",
          );
          return;
        }
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

  const reportStudentValidation = (
    field: StudentValidationField,
    message: string,
  ) => {
    setStudentFormError("");
    showStudentValidationError(field, message);
    if (editingId) {
      setOpenEditSection(
        field === "ra"
          ? "academic"
          : field === "unitClass"
            ? "links"
            : "studentData",
      );
    } else {
      setOpenCreateSection(field === "ra" ? "academic" : "studentData");
    }
  };

  const onSave = async () => {
    const wasEditing = !!editingId;
    setStudentDocumentsError({});
    if (!unit || !classId) {
      reportStudentValidation("unitClass", "Selecione a unidade e a turma.");
      return false;
    }
    clearStudentValidationError("unitClass");
    if (!classId || !name.trim()) {
      reportStudentValidation("name", "Informe o nome do aluno.");
      return false;
    }
    clearStudentValidationError("name");
    if (!isOnline) {
      setStudentFormError("Conecte-se ? internet para salvar o aluno.");
      return false;
    }
    setStudentFormError("");
    const resolvedAge = ageNumber
      ? birthDate
        ? calculateAge(birthDate)
        : null
      : null;
    if (resolvedAge === null || Number.isNaN(resolvedAge)) {
      reportStudentValidation("birthDate", "Informe a data de nascimento.");
      return false;
    }
    clearStudentValidationError("birthDate");
    const nowIso = new Date().toISOString();
    const studentId = editingId || createStudentId();
    const resolvedOrganizationId =
      classById.get(classId)?.organizationId ?? activeOrganization?.id ?? "";

    try {
      const raValidation = validateStudentRa(ra);
      if (raValidation) {
        setStudentDocumentsError((prev) => ({ ...prev, ra: raValidation }));
        reportStudentValidation("ra", raValidation);
        return false;
      }
      clearStudentValidationError();
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
        collegeCourse: collegeCourse.trim() || null,
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
      showSaveNotice(wasEditing ? "alterações salvas." : "Aluno cadastrado.");
      if (!wasEditing) {
        showSaveToast({
          message: `${name.trim()} foi cadastrado com sucesso.`,
          variant: "success",
          actionLabel: "Ver alunos",
          onAction: () => setStudentsTab("alunos"),
        });
      }
      return true;
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "Erro ao salvar aluno.";
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
    collegeCourse.trim() ||
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

  const canSaveStudent = true;

  const isEditDirty = useMemo(() => {
    if (!editingId || !editSnapshot) return false;
    return (
      editSnapshot.unit !== unit ||
      editSnapshot.ageBand !== ageBand ||
      editSnapshot.customAgeBand !== customAgeBand ||
      editSnapshot.classId !== classId ||
      editSnapshot.name !== name ||
      editSnapshot.collegeCourse !== collegeCourse ||
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
    collegeCourse,
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

  // Wrappers que combinam reset do Formulário (hook) com efeitos de UI locais
  const doResetForm = useCallback(() => {
    closeAllPickers();
    setShowForm(false);
    clearStudentValidationError();
    resetForm();
  }, [clearStudentValidationError, closeAllPickers, resetForm, setShowForm]);

  const requestSwitchStudentsTab = (nextTab: StudentsTab) => {
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
    if (nextTab === "cadastro") {
      setShowForm(true);
    }
    setStudentsTab(nextTab);
  };

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

  const showWhatsAppNotice = useCallback(
    (message: string) => {
      setWhatsappNotice(message);
      if (whatsappNoticeTimer.current) {
        clearTimeout(whatsappNoticeTimer.current);
      }
      whatsappNoticeTimer.current = setTimeout(() => {
        setWhatsappNotice("");
        whatsappNoticeTimer.current = null;
      }, 2200);
    },
    [setWhatsappNotice],
  );

  const closeEditModal = () => {
    setShowEditModal(false);
    setShowEditCloseConfirm(false);
    setEditUnitFilters([]);
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

  const getStudentId = useCallback((student: Student) => student.id, []);
  const undoableStudentDelete = useUndoableListDelete({
    items: students,
    setItems: setStudents,
    getId: getStudentId,
    confirm,
    title: "Excluir aluno?",
    message: (targets) => {
      const [student] = targets;
      return student?.name
        ? `Tem certeza que deseja excluir ${student.name}?`
        : "Tem certeza que deseja excluir este aluno?";
    },
    confirmLabel: "Excluir",
    undoMessage: "Aluno excluído. Deseja desfazer?",
    deleteItems: async (ids) => {
      const [studentId] = ids;
      if (!studentId) return;
      await measure("deleteStudent", () => deleteStudent(studentId));
    },
    onOptimistic: (_targets, ids) => {
      if (ids.includes(editingId ?? "")) {
        closeEditModal();
      }
    },
    onConfirmed: (targets) => {
      const [student] = targets;
      if (!student) return;
      logAction("Excluir aluno", {
        studentId: student.id,
        classId: student.classId,
      });
    },
    onError: (error) => {
      const detail =
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o aluno.";
      Alert.alert("Excluir aluno", detail);
    },
  });

  const deleteEditingStudent = useCallback(() => {
    if (!editingId) return;
    undoableStudentDelete.deleteOne(editingId);
  }, [editingId, undoableStudentDelete]);

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
        error instanceof Error
          ? error.message
          : "não foi possível revelar o CPF.";
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
    setCpfDisplay,
    setCpfRevealUnavailable,
    setCpfRevealedValue,
    setIsCpfVisible,
    setRevealCpfBusy,
    setStudentDocumentsError,
  ]);

  const selectedClassName = useMemo(
    () => classById.get(classId)?.name ?? "",
    [classById, classId],
  );
  const existingStudentProbeKey = useMemo(
    () =>
      `${normalizeStudentLookupName(debouncedExistingStudentName)}::${String(
        birthDate ?? "",
      ).trim()}`,
    [birthDate, debouncedExistingStudentName],
  );
  const existingStudentMatches = useMemo(() => {
    if (editingId) return [];
    if (!showForm || studentsTab !== "cadastro") return [];
    if (!debouncedExistingStudentName.trim()) return [];
    if (dismissedExistingStudentProbe === existingStudentProbeKey) return [];

    return findPossibleExistingStudents({
      name: debouncedExistingStudentName,
      birthDate,
      currentClassId: classId,
      editingStudentId: editingId,
      students,
      classesById: classById,
    });
  }, [
    birthDate,
    classById,
    classId,
    debouncedExistingStudentName,
    dismissedExistingStudentProbe,
    editingId,
    existingStudentProbeKey,
    showForm,
    students,
    studentsTab,
  ]);
  const reviewExistingStudents = useCallback(() => {
    const focusName = existingStudentMatches[0]?.studentName ?? name.trim();
    setStudentsTab("alunos");
    setStudentsSearch(focusName);
    setShowForm(true);
  }, [existingStudentMatches, name, setStudentsTab, setShowForm]);
  const selectedClassLabel = useMemo(() => {
    const cls = classById.get(classId) ?? null;
    if (!cls) return "";
    const genderLabel =
      cls.gender === "masculino"
        ? "Masculino"
        : cls.gender === "feminino"
          ? "Feminino"
          : "Misto";
    return `${cls.name} (${genderLabel})`;
  }, [classById, classId]);
  const editDocumentsSummary = useMemo(() => {
    const parts = [
      cpfDisplay ? "CPF cadastrado" : "CPF não informado",
      rgDocument ? "RG cadastrado" : "RG não informado",
    ];
    return parts.join(" • ");
  }, [cpfDisplay, rgDocument]);
  const editAcademicSummary = useMemo(() => {
    const raLabel = ra.trim() ? `RA ${ra}` : "RA não informado";
    const courseLabel = collegeCourse.trim()
      ? collegeCourse
      : "Curso não informado";
    return `${raLabel} • ${courseLabel}`;
  }, [collegeCourse, ra]);
  const editSportSummary = useMemo(() => {
    const primaryLabel = positionPrimary.trim() || "indefinido";
    const secondaryLabel = positionSecondary.trim() || "indefinido";
    return `${primaryLabel} • ${secondaryLabel}`;
  }, [positionPrimary, positionSecondary]);
  const editHealthSummary = useMemo(() => {
    return deriveStudentHealthAssessment({
      healthIssue,
      healthIssueNotes,
      medicationUse,
      medicationNotes,
      healthObservations,
    }).summary;
  }, [
    healthIssue,
    healthIssueNotes,
    healthObservations,
    medicationNotes,
    medicationUse,
  ]);
  const editGuardianSummary = useMemo(() => {
    const nameLabel = guardianName.trim() || "Responsável não informado";
    const phoneLabel = guardianPhone.trim() || "Sem telefone";
    return `${nameLabel} • ${phoneLabel}`;
  }, [guardianName, guardianPhone]);
  const editLinksSummary = useMemo(() => {
    const classLabel = selectedClassLabel || "Sem turma";
    const unitLabel = unit || "Sem unidade";
    return `${classLabel} • ${unitLabel}`;
  }, [selectedClassLabel, unit]);

  useEffect(() => {
    if (!birthDate) {
      setAgeNumber(null);
      return;
    }
    setAgeNumber(calculateAge(birthDate));
  }, [birthDate, setAgeNumber]);

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
    setEditUnitFilters,
    setUnit,
    setAgeBand,
    setCustomAgeBand,
    setClassId,
    setEditingId,
    setEditingCreatedAt,
    setName,
    setCollegeCourse,
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

  const normalizeSearch = normalizeStudentSearchText;

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    }
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

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
          "Adicione o telefone do aluno ou Responsável para usar o WhatsApp.",
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
      setSelectedContactType(
        contact.source === "student" ? "student" : "guardian",
      );
      setCustomStudentMessage(
        buildStudentMessage(student, cls, suggested, fields),
      );
      setSelectedStudentId(student.id);
      setShowWhatsAppModal(true);
    },
    [
      buildStudentMessage,
      classById,
      setCustomFields,
      setCustomStudentMessage,
      setSelectedContactType,
      setSelectedStudentId,
      setSelectedTemplateId,
      setSelectedTemplateLabel,
      setShowWhatsAppModal,
    ],
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
  }, [
    setCustomFields,
    setCustomStudentMessage,
    setSelectedContactType,
    setSelectedStudentId,
    setSelectedTemplateId,
    setSelectedTemplateLabel,
    setShowRevokeConfirm,
    setShowTemplateList,
    setShowWhatsAppModal,
    setWhatsappNotice,
  ]);

  const { applyStudentInviteTemplate, onGenerateInviteFromList } =
    useStudentInvites({
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
    const particles = new Set(["da", "de", "do", "das", "dos", "e"]);
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

  const classOptions = useMemo(() => {
    if (!classes.length) return [];
    if (unit) {
      return sortClassesBySchedule(
        classes.filter((item) => unitLabel(item.unit) === unit),
      );
    }
    return sortClassesBySchedule(classes);
  }, [classes, unit, unitLabel]);
  const editClassOptions = useMemo(() => {
    if (!classes.length) return [];
    if (!editUnitFilters.length) return sortClassesBySchedule(classes);
    const selectedUnits = new Set(editUnitFilters);
    return sortClassesBySchedule(
      classes.filter((item) => selectedUnits.has(unitLabel(item.unit))),
    );
  }, [classes, editUnitFilters, unitLabel]);
  const selectedClassModality = useMemo(
    () => classById.get(classId)?.modality ?? null,
    [classById, classId],
  );
  const classModalities = useMemo(
    () => Array.from(new Set(classOptions.map((item) => item.modality))),
    [classOptions],
  );
  const filteredClassOptions = useMemo(
    () =>
      classModalityFilter === "all"
        ? classOptions
        : classOptions.filter((item) => item.modality === classModalityFilter),
    [classModalityFilter, classOptions],
  );

  useEffect(() => {
    if (!showClassPicker) return;
    Promise.resolve().then(() => {
      setClassModalityFilter(selectedClassModality ?? "all");
    });
  }, [selectedClassModality, showClassPicker]);

  useEffect(() => {
    if (!showClassPicker) return;
    if (classModalityFilter === "all") return;
    if (!classModalities.includes(classModalityFilter)) {
      Promise.resolve().then(() => {
        setClassModalityFilter(selectedClassModality ?? "all");
      });
    }
  }, [
    classModalities,
    classModalityFilter,
    selectedClassModality,
    showClassPicker,
  ]);

  const today = useMemo(() => new Date(), []);
  const studentsUnitOptions = useMemo(
    () => ["Todas", ...unitOptions],
    [unitOptions],
  );
  const studentsFiltered = useMemo(() => {
    return filterStudentsForList({
      students,
      classById,
      unitFilter: studentsUnitFilter,
      unitLabel,
      query: debouncedStudentsSearch,
    });
  }, [
    studentsUnitFilter,
    classById,
    students,
    unitLabel,
    debouncedStudentsSearch,
  ]);
  const hasActiveStudentsSearch = hasActiveStudentSearch(
    debouncedStudentsSearch,
  );
  const studentsByClassId = useMemo(() => {
    return groupStudentsByClassId(studentsFiltered);
  }, [studentsFiltered]);
  const toggleUnitExpanded = useCallback(
    (unitName: string) => {
      setExpandedUnits((prev) => ({
        ...prev,
        [unitName]: !prev[unitName],
      }));
    },
    [setExpandedUnits],
  );
  const toggleClassExpanded = useCallback(
    (classIdValue: string) => {
      setExpandedClasses((prev) => ({
        ...prev,
        [classIdValue]: !prev[classIdValue],
      }));
    },
    [setExpandedClasses],
  );
  const studentsGrouped = useMemo(() => {
    return buildStudentListGroups({
      classes,
      classById,
      studentsByClassId,
      unitFilter: studentsUnitFilter,
      unitLabel,
      hasActiveSearch: hasActiveStudentsSearch,
      fallbackPalette: {
        bg: colors.primaryBg,
        text: colors.primaryText,
      },
      resolveClassPalette: (cls, unitName) =>
        getClassPalette(cls.colorKey, colors, unitName),
      resolveUnitPalette: (unitName) => getUnitPalette(unitName, colors),
      formatClassScheduleLabel,
    });
  }, [
    classById,
    classes,
    colors,
    hasActiveStudentsSearch,
    studentsByClassId,
    studentsUnitFilter,
    unitLabel,
  ]);
  const birthdayTodayAll = useMemo(() => {
    return students.filter((student) =>
      isStudentBirthdayToday(student.birthDate, today),
    );
  }, [students, today]);
  const birthdayStudentIds = useMemo(
    () => new Set(birthdayTodayAll.map((student) => student.id)),
    [birthdayTodayAll],
  );
  useEffect(() => {
    if ((studentsTab as string) === "experimentais") {
      setStudentsTab("cadastro");
    }
  }, [setStudentsTab, studentsTab]);

  useEffect(() => {
    return () => {
      if (saveNoticeTimer.current) {
        clearTimeout(saveNoticeTimer.current);
      }
    };
  }, []);

  const renderStudentItem = ({
    item,
    paletteOverride,
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
        : (getUnitPalette(unitName, colors) ?? {
            bg: colors.primaryBg,
            text: colors.primaryText,
          }));
    const healthAssessment = deriveStudentHealthAssessment(item);
    return (
      <StudentListRow
        student={item}
        onPress={onEdit}
        onWhatsApp={openStudentWhatsApp}
        onInvite={onGenerateInviteFromList}
        onPhotoPress={openPhotoPreview}
        classPalette={classPalette}
        healthAssessment={healthAssessment}
        hasBirthDateWarning={hasBirthDateWarning(item.birthDate)}
      />
    );
  };

  const goBackFromStudents = useCallback(() => {
    navigateBackOrReplace({ router, fallback: "/prof/home" });
  }, [router]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View
          ref={containerRef}
          style={{ flex: 1, position: "relative", overflow: "visible" }}
        >
          <ScreenPageHeader
            title="Alunos"
            onBack={goBackFromStudents}
            right={
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <StudentsExportSyncMenu
                  colors={colors}
                  compact={windowWidth < 1040}
                  disabled={!activeOrganization?.id}
                  exportBusy={studentsExportBusy}
                  onExportPress={() => {
                    void handleExportStudents();
                  }}
                  onImportPress={() => setShowStudentsImportModal(true)}
                  onSyncFormsPress={() => setShowStudentsFormsSyncModal(true)}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Adicionar aluno"
                  onPress={() => setStudentsTab("cadastro")}
                  style={{
                    height: 40,
                    paddingHorizontal: windowWidth < 1040 ? 11 : 15,
                    borderRadius: 12,
                    backgroundColor: colors.primaryBg,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                  }}
                >
                  <GoAtletaIcon
                    name="add"
                    size={17}
                    color={colors.primaryText}
                  />
                  {windowWidth >= 1040 ? (
                    <Text
                      style={{
                        color: colors.primaryText,
                        fontSize: 12,
                        fontWeight: "900",
                      }}
                    >
                      Adicionar aluno
                    </Text>
                  ) : null}
                </Pressable>
              </View>
            }
            contentStyle={{ paddingBottom: 8 }}
          />

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

          <ScrollView
            style={{ flex: 1, minHeight: 0 }}
            scrollEnabled={windowWidth < 1040}
            contentContainerStyle={{
              ...(windowWidth >= 1040
                ? {
                    height: "100%",
                    maxHeight: "100%",
                    minHeight: 0,
                    overflow: "hidden" as const,
                  }
                : { flexGrow: 0 }),
              paddingBottom: isCadastroTab
                ? Math.max(insets.bottom + 104, 120)
                : windowWidth >= 1040
                  ? 0
                  : 24,
              gap: 16,
              paddingHorizontal: 16,
              paddingTop: 12,
            }}
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={closeAllPickers}
            refreshControl={
              <AppRefreshControl
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
            <Suspense
              fallback={
                <View
                  style={{
                    gap: 12,
                    paddingHorizontal: 16,
                    paddingTop: 16,
                    paddingBottom: 24,
                  }}
                >
                  <ShimmerBlock
                    style={{ height: 28, width: 160, borderRadius: 12 }}
                  />
                  <ShimmerBlock style={{ height: 140, borderRadius: 18 }} />
                  <ShimmerBlock style={{ height: 260, borderRadius: 18 }} />
                </View>
              }
            >
              {isCadastroTab && (
                <ModalSheet
                  visible={isCadastroTab}
                  onClose={() => requestSwitchStudentsTab("alunos")}
                  position="right"
                  slideOffset={560}
                  containerPadding={0}
                  backdropOpacity={0.7}
                  cardStyle={{
                    width: windowWidth < 720 ? "100%" : "42%",
                    minWidth: windowWidth < 720 ? 0 : 480,
                    maxWidth: 560,
                    height: "100%",
                    maxHeight: "100%",
                    alignSelf: "flex-end",
                    marginBottom: 0,
                    borderRadius: 0,
                    padding: 0,
                  }}
                >
                  <View
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 16,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: 20,
                        fontWeight: "900",
                      }}
                    >
                      {editingId ? "Editar aluno" : "Adicionar aluno"}
                    </Text>
                    <Pressable
                      onPress={() => requestSwitchStudentsTab("alunos")}
                      style={{
                        width: 38,
                        height: 38,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 19,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <GoAtletaIcon
                        name="close"
                        size={19}
                        color={colors.text}
                      />
                    </Pressable>
                  </View>
                  <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ padding: 20, paddingBottom: 28 }}
                    keyboardShouldPersistTaps="handled"
                  >
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
                      createAcademicAnim={createAcademicAnim}
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
                      validationIssue={studentValidationIssue}
                      onClearValidation={clearStudentValidationError}
                      existingStudentMatches={existingStudentMatches}
                      onReviewExistingStudents={reviewExistingStudents}
                      onDismissExistingStudentWarning={() =>
                        setDismissedExistingStudentProbe(
                          existingStudentProbeKey,
                        )
                      }
                      birthDate={birthDate}
                      setBirthDate={setBirthDate}
                      setShowCalendar={setShowCalendar}
                      ageNumber={ageNumber}
                      phone={phone}
                      setPhone={setPhone}
                      formatPhone={formatPhone}
                      ra={ra}
                      setRa={setRa}
                      collegeCourse={collegeCourse}
                      setCollegeCourse={setCollegeCourse}
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
                      showInlineSaveButton={false}
                      continuousMode
                      isFormDirty={isFormDirty}
                      doResetForm={doResetForm}
                      confirmDialog={confirmDialog}
                    />
                  </ScrollView>
                  <View
                    style={{
                      padding: 16,
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      {isFormDirty
                        ? "Alterações não salvas"
                        : "Preencha os dados do aluno"}
                    </Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Pressable
                        onPress={() => requestSwitchStudentsTab("alunos")}
                        style={{
                          minHeight: 42,
                          paddingHorizontal: 18,
                          borderRadius: 11,
                          borderWidth: 1,
                          borderColor: colors.border,
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ color: colors.text, fontWeight: "800" }}>
                          Cancelar
                        </Text>
                      </Pressable>
                      <Button
                        label={editingId ? "Salvar alterações" : "Salvar aluno"}
                        onPress={onSave}
                        disabled={!canSaveStudent}
                      />
                    </View>
                  </View>
                </ModalSheet>
              )}

              <StudentsListTab
                studentsUnitOptions={studentsUnitOptions}
                studentsUnitFilter={studentsUnitFilter}
                setStudentsUnitFilter={setStudentsUnitFilter}
                studentsSearch={studentsSearch}
                setStudentsSearch={setStudentsSearch}
                students={students}
                studentsFiltered={studentsFiltered}
                studentsGrouped={studentsGrouped}
                classById={classById}
                unitLabel={unitLabel}
                expandedUnits={expandedUnits}
                expandedClasses={expandedClasses}
                toggleUnitExpanded={toggleUnitExpanded}
                toggleClassExpanded={toggleClassExpanded}
                renderStudentItem={renderStudentItem}
                onStudentPress={onEdit}
                onStudentWhatsApp={openStudentWhatsApp}
                birthdayStudentIds={birthdayStudentIds}
                loading={loading}
              />
            </Suspense>
          </ScrollView>

          {false ? (
            <View
              style={{
                ...(Platform.OS === "web"
                  ? ({
                      position: "fixed",
                      left: 12,
                      right: 12,
                      bottom: Math.max(insets.bottom + 10, 14),
                    } as any)
                  : {
                      position: "absolute" as const,
                      left: 12,
                      right: 12,
                      bottom: Math.max(insets.bottom + 10, 14),
                    }),
                zIndex: 3150,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor:
                  Platform.OS === "web"
                    ? mode === "dark"
                      ? "rgba(17, 27, 48, 0.94)"
                      : "rgba(255,255,255,0.94)"
                    : colors.card,
                padding: 12,
                ...(Platform.OS === "web"
                  ? {
                      backdropFilter: "blur(18px) saturate(165%)",
                      WebkitBackdropFilter: "blur(18px) saturate(165%)",
                      backgroundImage:
                        mode === "dark"
                          ? "linear-gradient(180deg, rgba(24,34,55,0.98) 0%, rgba(13,21,37,0.94) 100%)"
                          : "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.92) 100%)",
                    }
                  : {}),
                ...shadow.elevated,
              }}
            >
              <Button
                label={editingId ? "Salvar alterações" : "Adicionar aluno"}
                onPress={onSave}
                disabled={!canSaveStudent}
              />
            </View>
          ) : null}

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
            interactiveRefs={[unitTriggerRef]}
            scrollContentStyle={{ padding: 8, gap: 6 }}
          >
            {unitOptions.length ? (
              unitOptions.map((item, index) => (
                <StudentSelectOption
                  key={item}
                  label={item}
                  value={item}
                  active={item === unit}
                  onSelect={handleSelectUnit}
                  isFirst={index === 0}
                />
              ))
            ) : (
              <Text style={emptyDropdownTextStyle}>
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
            interactiveRefs={[classTriggerRef]}
            scrollContentStyle={{ padding: 8, gap: 6 }}
          >
            <StudentClassDropdownPanel
              colors={colors}
              classOptions={classOptions}
              filteredClassOptions={filteredClassOptions}
              classModalities={classModalities}
              selectedClassId={classId}
              modalityFilter={classModalityFilter}
              onModalityFilterChange={setClassModalityFilter}
              onSelectClass={handleSelectClass}
            />
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
            interactiveRefs={[guardianRelationTriggerRef]}
            scrollContentStyle={{ padding: 8, gap: 6 }}
          >
            {guardianRelationOptions.map((item, index) => (
              <StudentSelectOption
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
            interactiveRefs={[typeTriggerRef]}
            scrollContentStyle={{ padding: 8, gap: 6 }}
          >
            {(
              [
                { label: "Aluno regular", value: "regular" },
                { label: "Experimental", value: "experimental" },
              ] as const
            ).map((item, index) => (
              <StudentSelectOption
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
        {saveNotice ? (
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
              ...shadow.elevated,
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
          editAcademicAnim={editAcademicAnim}
          editDocumentsAnim={editDocumentsAnim}
          editSportAnim={editSportAnim}
          editHealthAnim={editHealthAnim}
          editGuardianAnim={editGuardianAnim}
          editLinksAnim={editLinksAnim}
          name={name}
          setName={setName}
          collegeCourse={collegeCourse}
          setCollegeCourse={setCollegeCourse}
          loginEmail={loginEmail}
          setLoginEmail={setLoginEmail}
          birthDate={birthDate}
          setBirthDate={setBirthDate}
          ageNumber={ageNumber}
          phone={phone}
          setPhone={setPhone}
          studentFormError={studentFormError}
          validationIssue={studentValidationIssue}
          onClearValidation={clearStudentValidationError}
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
          editAcademicSummary={editAcademicSummary}
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
          showEditGuardianRelationPickerContent={
            showEditGuardianRelationPickerContent
          }
          editGuardianRelationTriggerLayout={editGuardianRelationTriggerLayout}
          editGuardianRelationPickerAnimStyle={
            editGuardianRelationPickerAnimStyle
          }
          handleSelectEditGuardianRelation={handleSelectEditGuardianRelation}
          editUnitTriggerRef={editUnitTriggerRef}
          showEditUnitPicker={showEditUnitPicker}
          selectedClassName={selectedClassLabel}
          editClassTriggerRef={editClassTriggerRef}
          showEditClassPicker={showEditClassPicker}
          editLinksSummary={editLinksSummary}
          unitOptions={unitOptions}
          showEditUnitPickerContent={showEditUnitPickerContent}
          editContainerWindow={editContainerWindow}
          editUnitPickerAnimStyle={editUnitPickerAnimStyle}
          selectedUnitFilters={editUnitFilters}
          handleToggleEditUnitFilter={handleToggleEditUnitFilter}
          classOptions={editClassOptions}
          classId={classId}
          showEditClassPickerContent={showEditClassPickerContent}
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
          SelectOption={StudentSelectOption}
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
            <Text
              style={{ fontSize: 14, fontWeight: "700", color: colors.text }}
            >
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
                <Text
                  style={{ color: colors.dangerSolidText, fontWeight: "700" }}
                >
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
        <WebCameraCaptureModal
          visible={showWebCamera}
          onClose={() => setShowWebCamera(false)}
          onCapture={({ uri, mimeType }) => {
            setPhotoUrl(uri);
            setPhotoMimeType(mimeType);
          }}
        />
        <ModalSheet
          visible={showPhotoPreview}
          onClose={() => setShowPhotoPreview(false)}
          cardStyle={photoPreviewCardStyle}
          position="center"
          backdropOpacity={0.7}
        >
          <View style={{ gap: 12, alignItems: "center" }}>
            <Text
              style={{ fontSize: 14, fontWeight: "700", color: colors.text }}
            >
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
