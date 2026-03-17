import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Animated,
    BackHandler,
    LayoutAnimation,
    Platform,
    ScrollView,
    Text,
    TextInput,
    UIManager,
    View,
    useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { uploadStudentPhoto } from "../../../src/api/student-photo-storage";
import { matchAthleteIntakeToStudents, type AthleteIntake } from "../../../src/core/athlete-intake";
import { useEffectiveProfile } from "../../../src/core/effective-profile";
import type { ClassGroup, Student } from "../../../src/core/models";
import {
    deleteStudent,
    getAthleteIntakesByClass,
    getClassById,
    getStudentsByClass,
    linkExistingStudentByIdentity,
    revealStudentCpf,
    saveStudent,
    updateStudent,
    updateStudentPhoto,
} from "../../../src/db/seed";
import { AnchoredDropdown } from "../../../src/ui/AnchoredDropdown";
import { ConfirmCloseOverlay } from "../../../src/ui/ConfirmCloseOverlay";
import { ModalSheet } from "../../../src/ui/ModalSheet";
import { Pressable } from "../../../src/ui/Pressable";
import { useAppTheme } from "../../../src/ui/app-theme";
import { useConfirmUndo } from "../../../src/ui/confirm-undo";
import { getSectionCardStyle } from "../../../src/ui/section-styles";
import { useCollapsibleAnimation } from "../../../src/ui/use-collapsible";
import { useModalCardStyle } from "../../../src/ui/use-modal-card-style";
import { maskCpf } from "../../../src/utils/cpf";
import { formatRgBr } from "../../../src/utils/document-normalization";
import { normalizeRaDigits, validateStudentRa } from "../../../src/utils/student-ra";
import { buildWaMeLink, getContactPhone, openWhatsApp } from "../../../src/utils/whatsapp";

const guardianRelationOptions = ["Mãe", "Pai", "Avó", "Avô", "Irmão", "Irmã", "Tio", "Tia", "Outro"] as const;
const positionOptions = ["indefinido", "levantador", "oposto", "ponteiro", "central", "libero"] as const;
type DropKey = "guardian" | "primary" | "secondary" | null;
type CreateDropKey = "createGuardian" | "createPrimary" | "createSecondary" | null;
type Layout = { x: number; y: number; width: number; height: number };
type StudentSectionKey = "studentData" | "sportProfile" | "documents" | "health" | "guardian" | "links" | null;
type CreateSectionKey = "studentData" | "sportProfile" | "health" | "documents" | "guardian" | "links" | null;
type ScreenTab = "alunos" | "cadastro";

const inputStyle = (colors: ReturnType<typeof useAppTheme>["colors"]) => ({
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 12,
  backgroundColor: colors.inputBg,
  color: colors.inputText,
  paddingHorizontal: 12,
  paddingVertical: 10,
  fontSize: 13,
});

const formatBr = (iso: string) => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};

const formatBrInput = (value: string) => {
  const d = value.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
};

const brToIso = (value: string) => {
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getDate() !== day ||
    date.getMonth() !== month - 1 ||
    date.getFullYear() !== year
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const formatPhoneBrWithCountry = (value: string) => {
  const rawDigits = value.replace(/\D/g, "");
  const digits = rawDigits.startsWith("55") ? rawDigits.slice(2, 15) : rawDigits.slice(0, 13);
  const ddd = digits.slice(0, 2);
  const number = digits.slice(2, 11);

  let masked = "+55";
  if (ddd.length > 0) masked += ` (${ddd}`;
  if (ddd.length === 2) masked += ")";
  if (number.length > 0) masked += ` ${number.slice(0, 1)}`;
  if (number.length > 1) masked += ` ${number.slice(1, 5)}`;
  if (number.length > 5) masked += `-${number.slice(5, 9)}`;
  return masked;
};

const calculateAgeFromIso = (isoDate: string) => {
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const hasBirthdayPassed =
    now.getMonth() > d.getMonth() ||
    (now.getMonth() === d.getMonth() && now.getDate() >= d.getDate());
  if (!hasBirthdayPassed) age -= 1;
  return age >= 0 ? age : null;
};

const labelByValue: Record<string, string> = {
  indefinido: "Indefinido",
  levantador: "Levantador",
  oposto: "Oposto",
  ponteiro: "Ponteiro",
  central: "Central",
  libero: "Líbero",
  ludico: "Lúdico",
  base: "Base",
  rendimento: "Rendimento",
  misto: "Misto",
  visual: "Visual",
  auditivo: "Auditivo",
  cinestesico: "Cinestésico",
};

const isUnsetValue = (value: string) =>
  !value || value === "indefinido" || value === "base" || value === "misto";
const getSelectDisplayValue = (value: string) =>
  isUnsetValue(value) ? "Selecione" : labelByValue[value] ?? value;
const getOptionLabel = (value: string) => labelByValue[value] ?? value;
const normalizeTextKey = (value: string) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const matchesClassModality = (modalityLabel: string, classModality: ClassGroup["modality"] | undefined) => {
  const label = normalizeTextKey(modalityLabel);
  if (!label) return false;
  if (classModality === "voleibol") {
    return label.includes("volei") || label.includes("voleibol") || label.includes("volleyball");
  }
  if (classModality === "fitness") {
    return (
      label.includes("fitness") ||
      label.includes("funcional") ||
      label.includes("academia") ||
      label.includes("musculacao")
    );
  }
  return false;
};

export default function ClassStudentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const { confirm } = useConfirmUndo();
  const effectiveProfile = useEffectiveProfile();
  const canRevealCpf = effectiveProfile === "admin";
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const isCompactForm = Platform.OS !== "web" && windowWidth <= 760;
  const editModalCardStyle = useModalCardStyle({
    maxHeight: Platform.OS === "web" ? "92%" : "96%",
    maxWidth: isCompactForm ? 700 : 960,
    padding: 16,
    radius: 16,
  });

  const [cls, setCls] = useState<ClassGroup | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [athleteIntakes, setAthleteIntakes] = useState<AthleteIntake[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [screenTab, setScreenTab] = useState<ScreenTab>("alunos");
  const [createExitTarget, setCreateExitTarget] = useState<"back" | "alunos" | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [saving, setSaving] = useState(false);
  const [dropKey, setDropKey] = useState<DropKey>(null);
  const [showEditCloseConfirm, setShowEditCloseConfirm] = useState(false);
  const [showCreateCloseConfirm, setShowCreateCloseConfirm] = useState(false);
  const [openSection, setOpenSection] = useState<StudentSectionKey>("studentData");
  const [openCreateSection, setOpenCreateSection] = useState<CreateSectionKey>("studentData");
  const [createDropKey, setCreateDropKey] = useState<CreateDropKey>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthIso, setBirthIso] = useState("");
  const [birthText, setBirthText] = useState("");
  const [age, setAge] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianRelation, setGuardianRelation] = useState("");
  const [primaryPos, setPrimaryPos] = useState("");
  const [secondaryPos, setSecondaryPos] = useState("");
  const [objective, setObjective] = useState("");
  const [learningStyle, setLearningStyle] = useState<Student["learningStyle"]>("misto");
  const [healthIssue, setHealthIssue] = useState(false);
  const [healthIssueNotes, setHealthIssueNotes] = useState("");
  const [medicationUse, setMedicationUse] = useState(false);
  const [medicationNotes, setMedicationNotes] = useState("");
  const [healthObs, setHealthObs] = useState("");
  const [cpfDisplay, setCpfDisplay] = useState("");
  const [cpfMaskedOriginal, setCpfMaskedOriginal] = useState("");
  const [cpfRevealedValue, setCpfRevealedValue] = useState<string | null>(null);
  const [isCpfVisible, setIsCpfVisible] = useState(false);
  const [cpfRevealUnavailable, setCpfRevealUnavailable] = useState(false);
  const [cpfWasEdited, setCpfWasEdited] = useState(false);
  const [rgDocument, setRgDocument] = useState("");
  const [ra, setRa] = useState("");
  const [documentsError, setDocumentsError] = useState<{ ra?: string; cpf?: string; rg?: string }>({});
  const [revealCpfBusy, setRevealCpfBusy] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoMimeType, setPhotoMimeType] = useState<string | null>(null);
  const [photoChanged, setPhotoChanged] = useState(false);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createBirthText, setCreateBirthText] = useState("");
  const [createGuardianName, setCreateGuardianName] = useState("");
  const [createGuardianPhone, setCreateGuardianPhone] = useState("");
  const [createGuardianRelation, setCreateGuardianRelation] = useState("");
  const [createRa, setCreateRa] = useState("");
  const [createPositionPrimary, setCreatePositionPrimary] = useState<Student["positionPrimary"]>("indefinido");
  const [createPositionSecondary, setCreatePositionSecondary] = useState<Student["positionSecondary"]>("indefinido");
  const [createCollegeCourse, setCreateCollegeCourse] = useState("");
  const [createHealthIssue, setCreateHealthIssue] = useState(false);
  const [createHealthIssueNotes, setCreateHealthIssueNotes] = useState("");
  const [createMedicationUse, setCreateMedicationUse] = useState(false);
  const [createMedicationNotes, setCreateMedicationNotes] = useState("");
  const [createHealthObs, setCreateHealthObs] = useState("");
  const [createCpf, setCreateCpf] = useState("");
  const [createRg, setCreateRg] = useState("");
  const [createPhotoUrl, setCreatePhotoUrl] = useState<string | null>(null);
  const [createPhotoMimeType, setCreatePhotoMimeType] = useState<string | null>(null);
  const [createError, setCreateError] = useState("");
  const [creatingStudent, setCreatingStudent] = useState(false);
  const [editSnapshot, setEditSnapshot] = useState<{
    name: string;
    phone: string;
    email: string;
    birthIso: string;
    birthText: string;
    age: string;
    guardianName: string;
    guardianPhone: string;
    guardianRelation: string;
    primaryPos: string;
    secondaryPos: string;
    objective: string;
    learningStyle: Student["learningStyle"];
    healthIssue: boolean;
    healthIssueNotes: string;
    medicationUse: boolean;
    medicationNotes: string;
    healthObs: string;
    cpfDisplay: string;
    rgDocument: string;
    ra: string;
    photoUrl: string;
  } | null>(null);

  const containerRef = useRef<View>(null);
  const guardianRef = useRef<View>(null);
  const primaryRef = useRef<View>(null);
  const secondaryRef = useRef<View>(null);
  const [container, setContainer] = useState<{ x: number; y: number } | null>(null);
  const [layouts, setLayouts] = useState<Record<Exclude<DropKey, null>, Layout | null>>({
    guardian: null,
    primary: null,
    secondary: null,
  });

  const { animatedStyle: dropdownAnimatedStyle, isVisible: dropdownVisible } = useCollapsibleAnimation(
    dropKey !== null
  );
  const accordionAnimOptions = useMemo(
    () =>
      Platform.OS === "web"
        ? { durationIn: 1, durationOut: 1, translateY: 0 }
        : { durationIn: 220, durationOut: 180, translateY: -4 },
    []
  );
  const studentDataAnim = useCollapsibleAnimation(openSection === "studentData", accordionAnimOptions);
  const sportAnim = useCollapsibleAnimation(openSection === "sportProfile", accordionAnimOptions);
  const documentsAnim = useCollapsibleAnimation(openSection === "documents", accordionAnimOptions);
  const healthAnim = useCollapsibleAnimation(openSection === "health", accordionAnimOptions);
  const guardianAnim = useCollapsibleAnimation(openSection === "guardian", accordionAnimOptions);
  const linksAnim = useCollapsibleAnimation(openSection === "links", accordionAnimOptions);
  const createStudentDataAnim = useCollapsibleAnimation(openCreateSection === "studentData", accordionAnimOptions);
  const createSportAnim = useCollapsibleAnimation(openCreateSection === "sportProfile", accordionAnimOptions);
  const createHealthAnim = useCollapsibleAnimation(openCreateSection === "health", accordionAnimOptions);
  const createDocumentsAnim = useCollapsibleAnimation(openCreateSection === "documents", accordionAnimOptions);
  const createGuardianAnim = useCollapsibleAnimation(openCreateSection === "guardian", accordionAnimOptions);
  const createLinksAnim = useCollapsibleAnimation(openCreateSection === "links", accordionAnimOptions);

  const rowStyle = useMemo(
    () => ({
      flexDirection: (isCompactForm ? "column" : "row") as const,
      alignItems: "flex-start" as const,
      gap: 12,
    }),
    [isCompactForm]
  );

  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const toggleSection = useCallback((section: Exclude<StudentSectionKey, null>) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenSection((prev) => (prev === section ? null : section));
  }, []);
  const toggleCreateSection = useCallback((section: Exclude<CreateSectionKey, null>) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenCreateSection((prev) => (prev === section ? null : section));
  }, []);

  const colStyle = useMemo(
    () => ({
      flex: 1,
      minWidth: 0,
      gap: 4,
    }),
    []
  );

  const selectFieldStyle = useMemo(
    () => ({
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.inputBg,
      minHeight: 40,
      paddingHorizontal: 12,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
    }),
    [colors.border, colors.inputBg]
  );

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError("");
    try {
      const [classData, list, intakes] = await Promise.all([
        getClassById(id),
        getStudentsByClass(id),
        getAthleteIntakesByClass(id),
      ]);
      setCls(classData);
      setStudents(list.slice().sort((a, b) => a.name.localeCompare(b.name)));
      setAthleteIntakes(intakes);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao carregar alunos da turma.";
      if (message.toLowerCase().includes("missing auth token")) {
        setLoadError("Sessão expirada. Faça login novamente para acessar os alunos da turma.");
        return;
      }
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const intakeByStudentId = useMemo(() => {
    const byStudent = new Map<string, AthleteIntake>();
    for (const intake of athleteIntakes) {
      const targetStudentId = intake.studentId?.trim();
      if (!targetStudentId) continue;
      const current = byStudent.get(targetStudentId);
      if (!current || intake.updatedAt > current.updatedAt) {
        byStudent.set(targetStudentId, intake);
      }
    }

    const pending = athleteIntakes.filter((item) => !item.studentId?.trim());
    if (!pending.length || !students.length) return byStudent;

    const { matches } = matchAthleteIntakeToStudents(pending, students);
    const pendingMap = new Map(pending.map((item) => [item.id, item]));
    for (const match of matches) {
      const intake = pendingMap.get(match.intakeId);
      if (!intake) continue;
      const current = byStudent.get(match.studentId);
      if (!current || intake.updatedAt > current.updatedAt) {
        byStudent.set(match.studentId, intake);
      }
    }
    return byStudent;
  }, [athleteIntakes, students]);

  const riskBadgePalette = useMemo(
    () => ({
      apto: {
        bg: colors.successBg,
        text: colors.successText,
        label: "Apto",
      },
      atencao: {
        bg: colors.warningBg,
        text: colors.warningText,
        label: "Atenção",
      },
      revisar: {
        bg: colors.dangerBg,
        text: colors.dangerText,
        label: "Revisar",
      },
    }),
    [colors.dangerBg, colors.dangerText, colors.successBg, colors.successText, colors.warningBg, colors.warningText]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const closeDropdown = useCallback(() => setDropKey(null), []);

  const syncLayouts = useCallback(() => {
    const apply = (key: Exclude<DropKey, null>, ref: React.RefObject<View>) => {
      ref.current?.measureInWindow((x, y, width0, height0) => {
        setLayouts((prev) => ({ ...prev, [key]: { x, y, width: width0, height: height0 } }));
      });
    };
    containerRef.current?.measureInWindow((x, y) => setContainer({ x, y }));
    apply("guardian", guardianRef);
    apply("primary", primaryRef);
    apply("secondary", secondaryRef);
  }, []);

  useEffect(() => {
    if (editingStudent) {
      const t = setTimeout(syncLayouts, 0);
      return () => clearTimeout(t);
    }
  }, [editingStudent, syncLayouts]);

  useEffect(() => {
    if (dropKey) syncLayouts();
  }, [dropKey, syncLayouts]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return students.filter((s) => {
      if (!t) return true;
      const p = String(s.phone ?? "").replace(/\D/g, "");
      const raDigits = String(s.ra ?? "").replace(/\D/g, "");
      return (
        s.name.toLowerCase().includes(t) ||
        String(s.guardianName ?? "").toLowerCase().includes(t) ||
        p.includes(t.replace(/\D/g, "")) ||
        raDigits.includes(t.replace(/\D/g, ""))
      );
    });
  }, [search, students]);

  const pickStudentPhoto = useCallback(async (source: "camera" | "library") => {
    try {
      if (source === "camera") {
        if (Platform.OS === "web") {
          Alert.alert("Câmera indisponível", "Use a galeria no navegador.");
          return;
        }
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
          setPhotoChanged(true);
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
        setPhotoChanged(true);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      Alert.alert("Erro", detail);
    }
  }, []);

  const pickCreatePhoto = useCallback(async (source: "camera" | "library") => {
    try {
      if (source === "camera") {
        if (Platform.OS === "web") {
          Alert.alert("Câmera indisponível", "Use a galeria no navegador.");
          return;
        }
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
          setCreatePhotoUrl(asset.uri);
          setCreatePhotoMimeType(asset.mimeType ?? null);
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
        setCreatePhotoUrl(asset.uri);
        setCreatePhotoMimeType(asset.mimeType ?? null);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      Alert.alert("Erro", detail);
    }
  }, []);

  const openEdit = (s: Student) => {
    setEditingStudent(s);
    setDropKey(null);
    setShowEditCloseConfirm(false);
    setOpenSection("studentData");
    setName(s.name ?? "");
    setPhone(s.phone ?? "");
    setEmail(s.loginEmail ?? "");
    setBirthIso(s.birthDate ?? "");
    setBirthText(s.birthDate ? formatBr(s.birthDate) : "");
    setAge(String(s.age ?? ""));
    setGuardianName(s.guardianName ?? "");
    setGuardianPhone(formatPhoneBrWithCountry(s.guardianPhone ?? ""));
    setGuardianRelation(s.guardianRelation ?? "");
    setPrimaryPos(s.positionPrimary && s.positionPrimary !== "indefinido" ? s.positionPrimary : "");
    setSecondaryPos(s.positionSecondary && s.positionSecondary !== "indefinido" ? s.positionSecondary : "");
    setObjective(s.athleteObjective && s.athleteObjective !== "base" ? s.athleteObjective : "");
    setLearningStyle(s.learningStyle ?? "misto");
    setHealthIssue(Boolean(s.healthIssue));
    setHealthIssueNotes(s.healthIssueNotes ?? "");
    setMedicationUse(Boolean(s.medicationUse));
    setMedicationNotes(s.medicationNotes ?? "");
    setHealthObs(s.healthObservations ?? "");
    setCpfDisplay(s.cpfMasked ?? "");
    setCpfMaskedOriginal(s.cpfMasked ?? "");
    setCpfRevealedValue(null);
    setIsCpfVisible(false);
    setCpfRevealUnavailable(false);
    setCpfWasEdited(false);
    setRgDocument(s.rg ?? "");
    setRa(s.ra ?? "");
    setPhotoUrl(s.photoUrl ?? null);
    setPhotoMimeType(null);
    setPhotoChanged(false);
    setDocumentsError({});
    setEditSnapshot({
      name: s.name ?? "",
      phone: s.phone ?? "",
      email: s.loginEmail ?? "",
      birthIso: s.birthDate ?? "",
      birthText: s.birthDate ? formatBr(s.birthDate) : "",
      age: String(s.age ?? ""),
      guardianName: s.guardianName ?? "",
      guardianPhone: formatPhoneBrWithCountry(s.guardianPhone ?? ""),
      guardianRelation: s.guardianRelation ?? "",
      primaryPos: s.positionPrimary && s.positionPrimary !== "indefinido" ? s.positionPrimary : "",
      secondaryPos:
        s.positionSecondary && s.positionSecondary !== "indefinido" ? s.positionSecondary : "",
      objective: s.athleteObjective && s.athleteObjective !== "base" ? s.athleteObjective : "",
      learningStyle: s.learningStyle ?? "misto",
      healthIssue: Boolean(s.healthIssue),
      healthIssueNotes: s.healthIssueNotes ?? "",
      medicationUse: Boolean(s.medicationUse),
      medicationNotes: s.medicationNotes ?? "",
      healthObs: s.healthObservations ?? "",
      cpfDisplay: s.cpfMasked ?? "",
      rgDocument: s.rg ?? "",
      ra: s.ra ?? "",
      photoUrl: s.photoUrl ?? "",
    });
  };

  const isEditDirty = useMemo(() => {
    if (!editingStudent || !editSnapshot) return false;
    return (
      editSnapshot.name !== name ||
      editSnapshot.phone !== phone ||
      editSnapshot.email !== email ||
      editSnapshot.birthIso !== birthIso ||
      editSnapshot.birthText !== birthText ||
      editSnapshot.age !== age ||
      editSnapshot.guardianName !== guardianName ||
      editSnapshot.guardianPhone !== guardianPhone ||
      editSnapshot.guardianRelation !== guardianRelation ||
      editSnapshot.primaryPos !== primaryPos ||
      editSnapshot.secondaryPos !== secondaryPos ||
      editSnapshot.objective !== objective ||
      editSnapshot.learningStyle !== learningStyle ||
      editSnapshot.healthIssue !== healthIssue ||
      editSnapshot.healthIssueNotes !== healthIssueNotes ||
      editSnapshot.medicationUse !== medicationUse ||
      editSnapshot.medicationNotes !== medicationNotes ||
      editSnapshot.healthObs !== healthObs ||
      (cpfWasEdited && editSnapshot.cpfDisplay !== cpfDisplay) ||
      editSnapshot.rgDocument !== rgDocument ||
      editSnapshot.ra !== ra ||
      photoChanged
    );
  }, [
    age,
    birthIso,
    birthText,
    cpfDisplay,
    cpfWasEdited,
    editSnapshot,
    editingStudent,
    email,
    guardianName,
    guardianPhone,
    guardianRelation,
    healthIssue,
    healthIssueNotes,
    healthObs,
    learningStyle,
    medicationNotes,
    medicationUse,
    name,
    objective,
    phone,
    primaryPos,
    photoChanged,
    rgDocument,
    ra,
    secondaryPos,
  ]);

  const closeEditModal = useCallback(() => {
    setDropKey(null);
    setShowEditCloseConfirm(false);
    setEditingStudent(null);
    setEditSnapshot(null);
    setPhotoUrl(null);
    setPhotoMimeType(null);
    setPhotoChanged(false);
  }, []);

  const requestCloseEditModal = useCallback(() => {
    if (isEditDirty) {
      setShowEditCloseConfirm(true);
      return;
    }
    closeEditModal();
  }, [closeEditModal, isEditDirty]);

  const resetCreateForm = useCallback(() => {
    setCreateName("");
    setCreateEmail("");
    setCreatePhone("");
    setCreateBirthText("");
    setCreateGuardianName("");
    setCreateGuardianPhone("");
    setCreateGuardianRelation("");
    setCreateRa("");
    setCreatePositionPrimary("indefinido");
    setCreatePositionSecondary("indefinido");
    setCreateCollegeCourse("");
    setCreateHealthIssue(false);
    setCreateHealthIssueNotes("");
    setCreateMedicationUse(false);
    setCreateMedicationNotes("");
    setCreateHealthObs("");
    setCreateCpf("");
    setCreateRg("");
    setCreatePhotoUrl(null);
    setCreatePhotoMimeType(null);
    setCreateError("");
    setOpenCreateSection("studentData");
    setCreateDropKey(null);
  }, []);

  const createFormDirty = useMemo(() => {
    const hasTextChanges = [
      createName,
      createEmail,
      createPhone,
      createBirthText,
      createGuardianName,
      createGuardianPhone,
      createGuardianRelation,
      createRa,
      createCollegeCourse,
      createHealthIssueNotes,
      createMedicationNotes,
      createHealthObs,
      createCpf,
      createRg,
    ].some((value) => value.trim().length > 0);

    return hasTextChanges ||
      createPositionPrimary !== "indefinido" ||
      createPositionSecondary !== "indefinido" ||
      createHealthIssue ||
      createMedicationUse ||
      Boolean(createPhotoUrl);
  }, [
    createBirthText,
    createCollegeCourse,
    createCpf,
    createEmail,
    createGuardianName,
    createGuardianPhone,
    createGuardianRelation,
    createHealthIssue,
    createHealthIssueNotes,
    createHealthObs,
    createMedicationNotes,
    createMedicationUse,
    createName,
    createPhone,
    createPositionPrimary,
    createPositionSecondary,
    createPhotoUrl,
    createRa,
    createRg,
  ]);

  const requestDiscardCreateForm = useCallback(
    (target: "back" | "alunos") => {
      if (!createFormDirty) {
        resetCreateForm();
        if (target === "back") {
          router.back();
          return;
        }
        setScreenTab("alunos");
        return;
      }
      setCreateExitTarget(target);
      setShowCreateCloseConfirm(true);
    },
    [createFormDirty, resetCreateForm, router]
  );

  const closeCreateDiscardConfirm = useCallback(() => {
    setShowCreateCloseConfirm(false);
    setCreateExitTarget(null);
  }, []);

  const confirmCreateDiscard = useCallback(() => {
    const target = createExitTarget;
    setShowCreateCloseConfirm(false);
    setCreateExitTarget(null);
    resetCreateForm();
    if (target === "back") {
      router.back();
      return;
    }
    if (target === "alunos") {
      setScreenTab("alunos");
    }
  }, [createExitTarget, resetCreateForm, router]);

  const handleScreenTabChange = useCallback(
    (nextTab: ScreenTab) => {
      if (nextTab === screenTab) return;
      if (screenTab === "cadastro" && nextTab === "alunos") {
        requestDiscardCreateForm("alunos");
        return;
      }
      setScreenTab(nextTab);
    },
    [requestDiscardCreateForm, screenTab]
  );

  const handleBackPress = useCallback(() => {
    if (screenTab === "cadastro") {
      requestDiscardCreateForm("back");
      return;
    }
    router.back();
  }, [requestDiscardCreateForm, router, screenTab]);

  const canSubmitCreateStudent = createFormDirty && !creatingStudent;

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (screenTab !== "cadastro") return false;
      handleBackPress();
      return true;
    });
    return () => subscription.remove();
  }, [handleBackPress, screenTab]);

  const createStudent = useCallback(async () => {
    if (!id) return;
    const cleanName = createName.trim();
    if (!cleanName) {
      setCreateError("Informe o nome do aluno.");
      return;
    }
    const birthIso = brToIso(createBirthText.trim());
    if (!birthIso) {
      setCreateError("Informe uma data de nascimento válida.");
      return;
    }
    const ageResolved = calculateAgeFromIso(birthIso);
    if (ageResolved === null) {
      setCreateError("Não foi possível calcular a idade.");
      return;
    }
    const raValidation = validateStudentRa(createRa);
    if (raValidation) {
      setCreateError(raValidation);
      return;
    }

    setCreatingStudent(true);
    setCreateError("");
    try {
      const existingLink = await linkExistingStudentByIdentity({
        classId: id,
        organizationId: cls?.organizationId ?? null,
        modality: cls?.modality ?? null,
        ra: createRa,
        email: createEmail,
      });

      if (existingLink.status === "linked" || existingLink.status === "already-linked") {
        const actionLabel =
          existingLink.status === "linked" ? "vinculado" : "já estava vinculado";
        Alert.alert(
          "Aluno existente encontrado",
          `${existingLink.student?.name ?? "Aluno"} ${actionLabel} a esta turma.`,
          [
            {
              text: "OK",
              onPress: () => setScreenTab("alunos"),
            },
          ]
        );
        resetCreateForm();
        await load();
        return;
      }

      const nowIso = new Date().toISOString();
      const studentId = `s_${Date.now()}`;
      await saveStudent({
        id: studentId,
        name: cleanName,
        organizationId: cls?.organizationId ?? "",
        classId: id,
        age: ageResolved,
        phone: createPhone.trim(),
        loginEmail: createEmail.trim(),
        guardianName: createGuardianName.trim(),
        guardianPhone: createGuardianPhone.trim(),
        guardianRelation: createGuardianRelation.trim(),
        birthDate: birthIso,
        ra: normalizeRaDigits(createRa) || null,
        cpfMasked: createCpf.trim() || null,
        rg: createRg.trim() || null,
        collegeCourse: createCollegeCourse.trim() || null,
        healthIssue: createHealthIssue,
        healthIssueNotes: createHealthIssue ? createHealthIssueNotes.trim() : "",
        medicationUse: createMedicationUse,
        medicationNotes: createMedicationUse ? createMedicationNotes.trim() : "",
        healthObservations: createHealthObs.trim(),
        positionPrimary: createPositionPrimary,
        positionSecondary: createPositionSecondary,
        athleteObjective: "base",
        learningStyle: "misto",
        createdAt: nowIso,
      });
      if (createPhotoUrl && cls?.organizationId) {
        const uploadedUrl = await uploadStudentPhoto({
          organizationId: cls.organizationId,
          studentId,
          uri: createPhotoUrl,
          contentType: createPhotoMimeType,
        });
        await updateStudentPhoto(studentId, uploadedUrl);
      }
      resetCreateForm();
      await load();
      Alert.alert(
        "Aluno cadastrado",
        `${cleanName} foi adicionado à turma com sucesso.`,
        [
          {
            text: "Ver alunos",
            onPress: () => setScreenTab("alunos"),
          },
        ]
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Não foi possível cadastrar o aluno.";
      setCreateError(detail);
    } finally {
      setCreatingStudent(false);
    }
  }, [
    cls?.organizationId,
    createBirthText,
    createCpf,
    createEmail,
    createGuardianName,
    createGuardianPhone,
    createGuardianRelation,
    createHealthIssue,
    createHealthIssueNotes,
    createHealthObs,
    createMedicationNotes,
    createMedicationUse,
    createName,
    createPhone,
    createPositionPrimary,
    createPositionSecondary,
    createRa,
    createRg,
    createCollegeCourse,
    createPhotoMimeType,
    createPhotoUrl,
    id,
    load,
    resetCreateForm,
  ]);

  const save = async () => {
    if (!editingStudent || !name.trim() || !isEditDirty) return;
    setSaving(true);
    try {
      setDocumentsError({});
      const raValidation = validateStudentRa(ra);
      if (raValidation) {
        setDocumentsError((prev) => ({ ...prev, ra: raValidation }));
        Alert.alert("RA", raValidation);
        return;
      }
      const parsed = birthText.trim() ? brToIso(birthText.trim()) : "";
      let resolvedPhotoUrl = editingStudent.photoUrl ?? undefined;
      if (photoChanged && photoUrl && cls?.organizationId) {
        setPhotoSaving(true);
        resolvedPhotoUrl = await uploadStudentPhoto({
          organizationId: cls.organizationId,
          studentId: editingStudent.id,
          uri: photoUrl,
          contentType: photoMimeType,
        });
        await updateStudentPhoto(editingStudent.id, resolvedPhotoUrl);
      }
      await updateStudent({
        ...editingStudent,
        name: name.trim(),
        photoUrl: resolvedPhotoUrl,
        phone: phone.trim(),
        loginEmail: email.trim(),
        birthDate: (parsed || birthIso || "").trim(),
        age: Number.isFinite(Number(age)) && Number(age) > 0 ? Number(age) : editingStudent.age,
        guardianName: guardianName.trim(),
        guardianPhone: guardianPhone.trim(),
        guardianRelation: guardianRelation.trim(),
        positionPrimary: (primaryPos || "indefinido") as Student["positionPrimary"],
        positionSecondary: (secondaryPos || "indefinido") as Student["positionSecondary"],
        athleteObjective: (objective || "base") as Student["athleteObjective"],
        learningStyle,
        healthIssue,
        healthIssueNotes: healthIssue ? healthIssueNotes.trim() : "",
        medicationUse,
        medicationNotes: medicationUse ? medicationNotes.trim() : "",
        healthObservations: healthObs.trim(),
        ra: normalizeRaDigits(ra) || null,
        cpfMasked: cpfDisplay.trim() || null,
        rg: rgDocument.trim() || null,
      });
      closeEditModal();
      await load();
    } finally {
      setPhotoSaving(false);
      setSaving(false);
    }
  };

  const revealCpf = async () => {
    if (!editingStudent || !canRevealCpf) return;
    if (cpfRevealUnavailable) return;
    setDocumentsError((prev) => ({ ...prev, cpf: undefined }));
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
      const cpf = await revealStudentCpf(editingStudent.id, {
        reason: "edicao_aluno_turma",
        legalBasis: "consentimento_app",
      });
      setCpfRevealedValue(cpf);
      setCpfDisplay(cpf);
      setIsCpfVisible(true);
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "Não foi possível revelar o CPF.";
      if (detail.toLowerCase().includes("indisponivel")) {
        setCpfRevealUnavailable(true);
      }
      setDocumentsError((prev) => ({ ...prev, cpf: detail }));
      Alert.alert("CPF", detail);
    } finally {
      setRevealCpfBusy(false);
    }
  };

  const removeStudent = useCallback((student: Student) => {
    confirm({
      title: "Excluir aluno?",
      message: student.name
        ? `Tem certeza que deseja excluir ${student.name}?`
        : "Tem certeza que deseja excluir este aluno?",
      confirmLabel: "Excluir",
      undoMessage: "Aluno excluído. Deseja desfazer?",
      onOptimistic: () => {
        setStudents((prev) => prev.filter((item) => item.id !== student.id));
        if (editingStudent?.id === student.id) {
          closeEditModal();
        }
      },
      onConfirm: async () => {
        await deleteStudent(student.id);
        await load();
      },
      onUndo: async () => {
        await load();
      },
    });
  }, [closeEditModal, confirm, editingStudent?.id, load]);

  const activeLayout = dropKey ? layouts[dropKey] : null;
  const activeOptions =
    dropKey === "guardian"
      ? guardianRelationOptions
      : positionOptions;

  const activeValue =
    dropKey === "guardian"
      ? guardianRelation
      : dropKey === "primary"
      ? primaryPos
      : secondaryPos;

  const studentDataSummary = useMemo(() => {
    const parts = [
      birthText || "Nascimento não informado",
      phone.trim() ? "Telefone informado" : "Sem telefone",
      email.trim() ? "E-mail informado" : "Sem e-mail",
    ];
    return parts.join(" • ");
  }, [birthText, email, phone]);

  const documentsSummary = useMemo(() => {
    const parts = [
      ra ? `RA ${ra}` : "RA não informado",
      cpfDisplay ? "CPF cadastrado" : "CPF não informado",
      rgDocument ? "RG cadastrado" : "RG não informado",
    ];
    return parts.join(" • ");
  }, [cpfDisplay, ra, rgDocument]);

  const sportSummary = useMemo(() => {
    return [getSelectDisplayValue(primaryPos), getSelectDisplayValue(secondaryPos)].join(" • ");
  }, [primaryPos, secondaryPos]);

  const editingIntake = useMemo(() => {
    if (!editingStudent) return null;
    return intakeByStudentId.get(editingStudent.id) ?? null;
  }, [editingStudent, intakeByStudentId]);

  const healthSummary = useMemo(() => {
    if (editingIntake?.riskStatus === "revisar") {
      return "Revisão necessária";
    }
    if (editingIntake?.riskStatus === "atencao") {
      return "Acompanhamento";
    }
    if (editingIntake?.riskStatus === "apto") {
      return "Sem alerta";
    }
    if (!healthIssue && !medicationUse && !healthObs.trim()) {
      return "Sem restrições informadas";
    }
    return "Informações de saúde registradas";
  }, [editingIntake?.riskStatus, healthIssue, healthObs, medicationUse]);

  const guardianSummary = useMemo(() => {
    const nameLabel = guardianName.trim() || "Responsável não informado";
    const phoneLabel = guardianPhone.trim() || "Sem telefone";
    return `${nameLabel} • ${phoneLabel}`;
  }, [guardianName, guardianPhone]);

  const createStudentDataSummary = useMemo(() => {
    const parts = [
      createBirthText.trim() || "Nascimento não informado",
      createPhone.trim() ? "Telefone informado" : "Sem telefone",
      createEmail.trim() ? "E-mail informado" : "Sem e-mail",
    ];
    return parts.join(" • ");
  }, [createBirthText, createEmail, createPhone]);

  const createSportSummary = useMemo(() => {
    const positionLabel = getOptionLabel(createPositionPrimary || "indefinido");
    const secondaryLabel = getOptionLabel(createPositionSecondary || "indefinido");
    return `${positionLabel} • ${secondaryLabel}`;
  }, [createPositionPrimary, createPositionSecondary]);

  const createHealthSummary = useMemo(() => {
    if (!createHealthIssue && !createMedicationUse && !createHealthObs.trim()) {
      return "Sem restrições informadas";
    }
    return "Informações de saúde registradas";
  }, [createHealthIssue, createHealthObs, createMedicationUse]);

  const createDocumentsSummary = useMemo(() => {
    const parts = [
      createRa.trim() ? `RA ${createRa.trim()}` : "RA não informado",
      createCpf.trim() ? "CPF informado" : "CPF não informado",
      createRg.trim() ? "RG informado" : "RG não informado",
    ];
    return parts.join(" • ");
  }, [createCpf, createRa, createRg]);

  const createGuardianSummary = useMemo(() => {
    const nameLabel = createGuardianName.trim() || "Responsável não informado";
    const relationLabel = createGuardianRelation.trim() || "Parentesco não informado";
    return `${nameLabel} • ${relationLabel}`;
  }, [createGuardianName, createGuardianRelation]);

  const createLinksSummary = useMemo(() => {
    const classLabel = cls?.name || "Sem turma";
    const unitLabel = cls?.unit || "Sem unidade";
    return `${classLabel} • ${unitLabel}`;
  }, [cls?.name, cls?.unit]);

  const linksSummary = useMemo(() => {
    if (!editingIntake) {
      const classLabel = cls?.name || "Sem turma";
      const unitLabel = cls?.unit || "Sem unidade";
      return `${classLabel} • ${unitLabel}`;
    }
    const modalities = Array.from(
      new Set((editingIntake.modalities ?? []).map((item) => item.trim()).filter(Boolean))
    );
    if (!modalities.length) {
      return `${cls?.name || "Sem turma"} • ${cls?.unit || "Sem unidade"}`;
    }
    return modalities.join(" • ");
  }, [cls?.modality, cls?.name, cls?.unit, editingIntake]);

  const intakeHealthSignals = useMemo(() => {
    if (!editingIntake) return [] as string[];
    const signals: string[] = [];
    if (editingIntake.needsMedicalClearance) signals.push("Necessita liberação médica");
    if (editingIntake.needsIndividualAttention) signals.push("Treino com atenção individual");
    if (editingIntake.cardioRisk) signals.push("Risco cardiovascular");
    if (editingIntake.orthoRisk) signals.push("Atenção ortopédica");
    if (editingIntake.currentInjury) signals.push("Lesão atual");
    if (editingIntake.jumpRestriction === "avaliar") signals.push("Avaliar salto/impacto");
    return signals;
  }, [editingIntake]);

  const intakeModalitiesSummary = useMemo(() => {
    if (!editingIntake) {
      return {
        all: [] as string[],
        others: [] as string[],
        hasOther: false,
      };
    }
    const all = Array.from(
      new Set((editingIntake.modalities ?? []).map((item) => item.trim()).filter(Boolean))
    );
    const others = all.filter((item) => !matchesClassModality(item, cls?.modality));
    return {
      all,
      others,
      hasOther: others.length > 0,
    };
  }, [cls?.modality, editingIntake]);

  const healthBadgeItems = useMemo(() => {
    if (!editingIntake) return [] as string[];
    if (editingIntake.riskStatus === "apto") {
      const safeBadges: string[] = [];
      if (!editingIntake.parqPositive && !editingIntake.cardioRisk) safeBadges.push("PAR-Q ok");
      if (!editingIntake.currentInjury) safeBadges.push("Sem lesão atual");
      if (editingIntake.jumpRestriction === "nenhuma") safeBadges.push("Sem restrição de salto");
      if (!editingIntake.needsIndividualAttention) safeBadges.push("Sem atenção individual");
      return safeBadges.slice(0, 4);
    }
    return intakeHealthSignals.slice(0, 4);
  }, [editingIntake, intakeHealthSignals]);

  const sportsLinkBadges = useMemo(() => {
    const badges: string[] = [];
    if (cls?.modality) {
      badges.push(cls.modality === "voleibol" ? "Vôlei" : "Fitness");
    }
    for (const modality of intakeModalitiesSummary.all) {
      if (!badges.includes(modality)) {
        badges.push(modality);
      }
    }
    return badges;
  }, [cls?.modality, intakeModalitiesSummary.all]);

  const onSelect = (value: string) => {
    if (dropKey === "guardian") setGuardianRelation(value);
    if (dropKey === "primary") setPrimaryPos(value);
    if (dropKey === "secondary") setSecondaryPos(value);
    setDropKey(null);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Pressable
            onPress={handleBackPress}
            style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
            <Text style={{ color: colors.text, fontSize: 26, fontWeight: "700" }}>Alunos da turma</Text>
          </Pressable>
        </View>

        <Text style={{ color: colors.muted, marginTop: 6 }}>{cls ? `${cls.name} • ${cls.unit}` : "Carregando turma..."}</Text>

        {loadError ? (
          <View
            style={{
              marginTop: 12,
              borderWidth: 1,
              borderColor: colors.dangerText,
              borderRadius: 12,
              backgroundColor: colors.card,
              padding: 12,
              gap: 10,
            }}
          >
            <Text style={{ color: colors.dangerText, fontSize: 13 }}>{loadError}</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => void load()}
                style={{
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.secondaryBg,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>Tentar novamente</Text>
              </Pressable>
              <Pressable
                onPress={() => router.replace("/login")}
                style={{
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.primaryBg,
                  backgroundColor: colors.primaryBg,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
              >
                <Text style={{ color: colors.primaryText, fontWeight: "700" }}>Ir para login</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View
          style={{
            flexDirection: "row",
            gap: 6,
            marginTop: 12,
            padding: 6,
            borderRadius: 999,
            backgroundColor: colors.secondaryBg,
          }}
        >
          <Pressable
            onPress={() => handleScreenTabChange("alunos")}
            style={{
              flex: 1,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: screenTab === "alunos" ? colors.primaryBg : colors.card,
              alignItems: "center",
            }}
          >
            <Text style={{ color: screenTab === "alunos" ? colors.primaryText : colors.text, fontWeight: "700" }}>
              Alunos
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleScreenTabChange("cadastro")}
            style={{
              flex: 1,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: screenTab === "cadastro" ? colors.primaryBg : colors.card,
              alignItems: "center",
            }}
          >
            <Text style={{ color: screenTab === "cadastro" ? colors.primaryText : colors.text, fontWeight: "700" }}>
              Cadastro
            </Text>
          </Pressable>
        </View>

        {screenTab === "alunos" ? (
          <>
            <View style={[getSectionCardStyle(colors, "neutral", { radius: 14, padding: 12 }), { marginTop: 12 }]}>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Buscar aluno"
                placeholderTextColor={colors.placeholder}
                style={inputStyle(colors)}
              />
            </View>

            <ScrollView contentContainerStyle={{ gap: 10, paddingTop: 12, paddingBottom: Math.max(insets.bottom + 24, 36) }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator persistentScrollbar={Platform.OS === "android"}>
              {loading ? (
                <Text style={{ color: colors.muted }}>Carregando alunos...</Text>
              ) : (
                filtered.map((s) => {
                  const c = getContactPhone(s);
                  return (
                    <View
                      key={s.id}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 14,
                        backgroundColor: colors.card,
                        padding: 12,
                        gap: 8,
                        flexDirection: "row",
                        alignItems: "center",
                      }}
                    >
                      <View style={{ width: 52, height: 52, borderRadius: 26, overflow: "hidden", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondaryBg, alignItems: "center", justifyContent: "center" }}>
                        {s.photoUrl ? (
                          <Image source={{ uri: s.photoUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                        ) : (
                          <Ionicons name="person" size={22} color={colors.muted} />
                        )}
                      </View>
                      <Pressable onPress={() => openEdit(s)} style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>{s.name}</Text>
                      </Pressable>
                      <View style={{ gap: 8 }}>
                        <Pressable
                          onPress={() =>
                            void (c.phone
                              ? openWhatsApp(buildWaMeLink(c.phone, `Olá! Sou da turma ${cls?.name ?? ""}.`))
                              : Promise.resolve())
                          }
                          disabled={!c.phone}
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 21,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: c.phone ? "#25D366" : colors.secondaryBg,
                            borderWidth: 1,
                            borderColor: c.phone ? "#25D366" : colors.border,
                            opacity: c.phone ? 1 : 0.5,
                          }}
                        >
                          <Ionicons name="logo-whatsapp" size={20} color={c.phone ? "#fff" : colors.muted} />
                        </Pressable>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </>
        ) : (
          <View style={{ flex: 1, marginTop: 12 }}>
          <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator persistentScrollbar={Platform.OS === "android"}>

            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.card, padding: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Pressable
                  onPress={() => void pickCreatePhoto("library")}
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 36,
                    overflow: "hidden",
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {createPhotoUrl ? (
                    <Image source={{ uri: createPhotoUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                  ) : (
                    <Ionicons name="camera-outline" size={24} color={colors.muted} />
                  )}
                </Pressable>
                <View style={{ gap: 6 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>{createPhotoUrl ? "Alterar foto" : "Adicionar foto"}</Text>
                  <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
                    <Pressable onPress={() => void pickCreatePhoto("library")}>
                      <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>Galeria</Text>
                    </Pressable>
                    <Pressable onPress={() => void pickCreatePhoto("camera")}>
                      <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>Tirar foto</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>

            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.card, overflow: "hidden" }}>
              <Pressable
                onPress={() => toggleCreateSection("studentData")}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>Dados do aluno</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{createStudentDataSummary}</Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={colors.muted} style={{ transform: [{ rotate: openCreateSection === "studentData" ? "180deg" : "0deg" }] }} />
              </Pressable>
              {openCreateSection === "studentData" ? <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 12 }} /> : null}
              {createStudentDataAnim.isVisible ? (
                <Animated.View style={[createStudentDataAnim.animatedStyle, { overflow: "hidden" }]}>
                  <View style={{ gap: 10, padding: 12 }}>
                    <TextInput value={createName} onChangeText={setCreateName} placeholder="Nome do aluno" placeholderTextColor={colors.placeholder} style={inputStyle(colors)} />
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <TextInput value={createBirthText} onChangeText={(v) => setCreateBirthText(formatBrInput(v))} placeholder="Nascimento (DD/MM/AAAA)" placeholderTextColor={colors.placeholder} keyboardType="numeric" style={inputStyle(colors)} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <TextInput value={createPhone} onChangeText={(value) => setCreatePhone(formatPhoneBrWithCountry(value))} placeholder="+55 (DDD) 0 0000-0000" placeholderTextColor={colors.placeholder} keyboardType="phone-pad" style={inputStyle(colors)} />
                      </View>
                    </View>
                    <TextInput value={createEmail} onChangeText={setCreateEmail} placeholder="E-mail de login (opcional)" placeholderTextColor={colors.placeholder} autoCapitalize="none" style={inputStyle(colors)} />
                  </View>
                </Animated.View>
              ) : null}
            </View>

            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.card, overflow: "hidden" }}>
              <Pressable
                onPress={() => toggleCreateSection("sportProfile")}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>Perfil esportivo</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{createSportSummary}</Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={colors.muted} style={{ transform: [{ rotate: openCreateSection === "sportProfile" ? "180deg" : "0deg" }] }} />
              </Pressable>
              {openCreateSection === "sportProfile" ? <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 12 }} /> : null}
              {createSportAnim.isVisible ? (
                <Animated.View style={[createSportAnim.animatedStyle, { overflow: "hidden" }]}>
                  <View style={{ gap: 10, padding: 12 }}>
                    <View style={rowStyle}>
                      <View style={colStyle}>
                        <Text style={{ color: colors.muted, fontSize: 11 }}>Posição principal</Text>
                        <Pressable onPress={() => setCreateDropKey(createDropKey === "createPrimary" ? null : "createPrimary")} style={selectFieldStyle}>
                          <Text style={{ color: colors.text, fontSize: 13, fontWeight: "500" }}>{getSelectDisplayValue(createPositionPrimary)}</Text>
                          <Ionicons name="chevron-down" size={16} color={colors.muted} style={{ transform: [{ rotate: createDropKey === "createPrimary" ? "180deg" : "0deg" }] }} />
                        </Pressable>
                        {createDropKey === "createPrimary" ? (
                          <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: "hidden", backgroundColor: colors.card }}>
                            {positionOptions.map((option) => (
                              <Pressable key={`create_primary_${option}`} onPress={() => { setCreatePositionPrimary(option); setCreateDropKey(null); }} style={{ paddingHorizontal: 12, paddingVertical: 10, backgroundColor: option === createPositionPrimary ? colors.secondaryBg : colors.card }}>
                                <Text style={{ color: colors.text, fontWeight: option === createPositionPrimary ? "600" : "500" }}>{getOptionLabel(option)}</Text>
                              </Pressable>
                            ))}
                          </View>
                        ) : null}
                      </View>
                      <View style={colStyle}>
                        <Text style={{ color: colors.muted, fontSize: 11 }}>Posição secundária</Text>
                        <Pressable onPress={() => setCreateDropKey(createDropKey === "createSecondary" ? null : "createSecondary")} style={selectFieldStyle}>
                          <Text style={{ color: colors.text, fontSize: 13, fontWeight: "500" }}>{getSelectDisplayValue(createPositionSecondary)}</Text>
                          <Ionicons name="chevron-down" size={16} color={colors.muted} style={{ transform: [{ rotate: createDropKey === "createSecondary" ? "180deg" : "0deg" }] }} />
                        </Pressable>
                        {createDropKey === "createSecondary" ? (
                          <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: "hidden", backgroundColor: colors.card }}>
                            {positionOptions.map((option) => (
                              <Pressable key={`create_secondary_${option}`} onPress={() => { setCreatePositionSecondary(option); setCreateDropKey(null); }} style={{ paddingHorizontal: 12, paddingVertical: 10, backgroundColor: option === createPositionSecondary ? colors.secondaryBg : colors.card }}>
                                <Text style={{ color: colors.text, fontWeight: option === createPositionSecondary ? "600" : "500" }}>{getOptionLabel(option)}</Text>
                              </Pressable>
                            ))}
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>
                </Animated.View>
              ) : null}
            </View>

            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.card, overflow: "hidden" }}>
              <Pressable
                onPress={() => toggleCreateSection("documents")}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>Documentos</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{createDocumentsSummary}</Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={colors.muted} style={{ transform: [{ rotate: openCreateSection === "documents" ? "180deg" : "0deg" }] }} />
              </Pressable>
              {openCreateSection === "documents" ? <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 12 }} /> : null}
              {createDocumentsAnim.isVisible ? (
                <Animated.View style={[createDocumentsAnim.animatedStyle, { overflow: "hidden" }]}>
                  <View style={{ gap: 10, padding: 12 }}>
                    <TextInput value={createRa} onChangeText={(v) => setCreateRa(normalizeRaDigits(v))} placeholder="RA (ex: 2022202626)" placeholderTextColor={colors.placeholder} keyboardType="numeric" style={inputStyle(colors)} />
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <TextInput value={createCpf} onChangeText={(v) => setCreateCpf(maskCpf(v))} placeholder="CPF (opcional)" placeholderTextColor={colors.placeholder} keyboardType="numeric" style={inputStyle(colors)} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <TextInput value={createRg} onChangeText={(v) => setCreateRg(formatRgBr(v))} placeholder="RG (opcional)" placeholderTextColor={colors.placeholder} style={inputStyle(colors)} />
                      </View>
                    </View>
                  </View>
                </Animated.View>
              ) : null}
            </View>

            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.card, overflow: "hidden" }}>
              <Pressable
                onPress={() => toggleCreateSection("health")}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>Saúde</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{createHealthSummary}</Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={colors.muted} style={{ transform: [{ rotate: openCreateSection === "health" ? "180deg" : "0deg" }] }} />
              </Pressable>
              {openCreateSection === "health" ? <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 12 }} /> : null}
              {createHealthAnim.isVisible ? (
                <Animated.View style={[createHealthAnim.animatedStyle, { overflow: "hidden" }]}>
                  <View style={{ gap: 10, padding: 12 }}>
                    <View style={rowStyle}>
                      <View style={colStyle}>
                        <Text style={{ color: colors.muted, fontSize: 12 }}>Problema de saúde?</Text>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <Pressable onPress={() => { setCreateHealthIssue(false); setCreateHealthIssueNotes(""); }} style={{ paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: !createHealthIssue ? colors.primaryBg : colors.secondaryBg }}>
                            <Text style={{ color: !createHealthIssue ? colors.primaryText : colors.text, fontWeight: "700" }}>Não</Text>
                          </Pressable>
                          <Pressable onPress={() => setCreateHealthIssue(true)} style={{ paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: createHealthIssue ? colors.primaryBg : colors.secondaryBg }}>
                            <Text style={{ color: createHealthIssue ? colors.primaryText : colors.text, fontWeight: "700" }}>Sim</Text>
                          </Pressable>
                        </View>
                      </View>

                      <View style={colStyle}>
                        <Text style={{ color: colors.muted, fontSize: 12 }}>Uso contínuo de medicação?</Text>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <Pressable onPress={() => { setCreateMedicationUse(false); setCreateMedicationNotes(""); }} style={{ paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: !createMedicationUse ? colors.primaryBg : colors.secondaryBg }}>
                            <Text style={{ color: !createMedicationUse ? colors.primaryText : colors.text, fontWeight: "700" }}>Não</Text>
                          </Pressable>
                          <Pressable onPress={() => setCreateMedicationUse(true)} style={{ paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: createMedicationUse ? colors.primaryBg : colors.secondaryBg }}>
                            <Text style={{ color: createMedicationUse ? colors.primaryText : colors.text, fontWeight: "700" }}>Sim</Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>

                    {createHealthIssue ? (
                      <TextInput value={createHealthIssueNotes} onChangeText={setCreateHealthIssueNotes} placeholder="Descreva a questão de saúde" placeholderTextColor={colors.placeholder} style={[inputStyle(colors), { minHeight: 72, textAlignVertical: "top" }]} multiline />
                    ) : null}
                    {createMedicationUse ? (
                      <TextInput value={createMedicationNotes} onChangeText={setCreateMedicationNotes} placeholder="Qual medicação?" placeholderTextColor={colors.placeholder} style={[inputStyle(colors), { minHeight: 72, textAlignVertical: "top" }]} multiline />
                    ) : null}
                    <TextInput value={createHealthObs} onChangeText={setCreateHealthObs} placeholder="Adicionar observações" placeholderTextColor={colors.placeholder} style={[inputStyle(colors), { minHeight: 84, textAlignVertical: "top" }]} multiline />
                  </View>
                </Animated.View>
              ) : null}
            </View>

            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.card, overflow: "hidden" }}>
              <Pressable
                onPress={() => toggleCreateSection("guardian")}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>Responsável</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{createGuardianSummary}</Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={colors.muted} style={{ transform: [{ rotate: openCreateSection === "guardian" ? "180deg" : "0deg" }] }} />
              </Pressable>
              {openCreateSection === "guardian" ? <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 12 }} /> : null}
              {createGuardianAnim.isVisible ? (
                <Animated.View style={[createGuardianAnim.animatedStyle, { overflow: "hidden" }]}>
                  <View style={{ gap: 10, padding: 12 }}>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <TextInput value={createGuardianName} onChangeText={setCreateGuardianName} placeholder="Responsável (opcional)" placeholderTextColor={colors.placeholder} style={inputStyle(colors)} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <TextInput value={createGuardianPhone} onChangeText={(value) => setCreateGuardianPhone(formatPhoneBrWithCountry(value))} placeholder="+55 (DDD) 0 0000-0000" placeholderTextColor={colors.placeholder} keyboardType="phone-pad" style={inputStyle(colors)} />
                      </View>
                    </View>
                    <View style={{ gap: 6 }}>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>Parentesco</Text>
                      <Pressable onPress={() => setCreateDropKey(createDropKey === "createGuardian" ? null : "createGuardian")} style={selectFieldStyle}>
                        <Text style={{ color: colors.text, fontSize: 13, fontWeight: "500" }}>{createGuardianRelation || "Selecione"}</Text>
                        <Ionicons name="chevron-down" size={16} color={colors.muted} style={{ transform: [{ rotate: createDropKey === "createGuardian" ? "180deg" : "0deg" }] }} />
                      </Pressable>
                      {createDropKey === "createGuardian" ? (
                        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: "hidden", backgroundColor: colors.card }}>
                          {guardianRelationOptions.map((option) => (
                            <Pressable key={`create_guardian_${option}`} onPress={() => { setCreateGuardianRelation(option); setCreateDropKey(null); }} style={{ paddingHorizontal: 12, paddingVertical: 10, backgroundColor: option === createGuardianRelation ? colors.secondaryBg : colors.card }}>
                              <Text style={{ color: colors.text, fontWeight: option === createGuardianRelation ? "600" : "500" }}>{option}</Text>
                            </Pressable>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  </View>
                </Animated.View>
              ) : null}
            </View>

            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.card, overflow: "hidden" }}>
              <Pressable
                onPress={() => toggleCreateSection("links")}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>Vínculos esportivos</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{createLinksSummary}</Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={colors.muted} style={{ transform: [{ rotate: openCreateSection === "links" ? "180deg" : "0deg" }] }} />
              </Pressable>
              {openCreateSection === "links" ? <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 12 }} /> : null}
              {createLinksAnim.isVisible ? (
                <Animated.View style={[createLinksAnim.animatedStyle, { overflow: "hidden" }]}>
                  <View style={{ gap: 8, padding: 12 }}>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {cls?.modality ? (
                        <View
                          style={{
                            borderRadius: 999,
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            backgroundColor: colors.secondaryBg,
                            borderWidth: 1,
                            borderColor: colors.border,
                          }}
                        >
                          <Text style={{ color: colors.text, fontSize: 11, fontWeight: "600" }}>
                            {cls.modality === "voleibol" ? "Vôlei" : "Fitness"}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{`${cls?.name ?? "Sem turma"} • ${cls?.unit ?? "Sem unidade"}`}</Text>
                  </View>
                </Animated.View>
              ) : null}
            </View>

          </ScrollView>
          <View style={{ paddingTop: 10, paddingBottom: Math.max(insets.bottom + 24, 28), borderTopWidth: 1, borderTopColor: colors.border, gap: 8, backgroundColor: colors.background }}>
            {createError ? <Text style={{ color: colors.dangerText, fontSize: 12 }}>{createError}</Text> : null}
            <Pressable
              onPress={() => void createStudent()}
              disabled={!canSubmitCreateStudent}
              style={{
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.primaryBg,
                backgroundColor: colors.primaryBg,
                paddingVertical: 11,
                alignItems: "center",
                opacity: canSubmitCreateStudent ? 1 : 0.5,
              }}
            >
              <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
                {creatingStudent ? "Salvando..." : "Cadastrar aluno"}
              </Text>
            </Pressable>
          </View>
          </View>
        )}
      </View>

      <ModalSheet
        visible={Boolean(editingStudent)}
        onClose={requestCloseEditModal}
        position="center"
        cardStyle={[editModalCardStyle, { height: Platform.OS === "web" ? "92%" : "96%" }]}
      >
        <View ref={containerRef} style={{ flex: 1, position: "relative", minHeight: 0 }}>
          <View style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}>Editar aluno</Text>
            <Pressable
              onPress={requestCloseEditModal}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.secondaryBg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            persistentScrollbar={Platform.OS === "android"}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 4, paddingBottom: 2 }}>
              <Pressable
                onPress={() => void pickStudentPhoto("library")}
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.secondaryBg,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {photoUrl ? (
                  <Image source={{ uri: photoUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                ) : (
                  <Ionicons name="camera-outline" size={24} color={colors.muted} />
                )}
              </Pressable>
              <View style={{ gap: 6 }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>
                  {photoUrl ? "Alterar foto" : "Adicionar foto"}
                </Text>
                <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
                  <Pressable onPress={() => void pickStudentPhoto("library")}>
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>Galeria</Text>
                  </Pressable>
                  <Pressable onPress={() => void pickStudentPhoto("camera")}>
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>Tirar foto</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.card, overflow: "hidden" }}>
              <Pressable
                onPress={() => toggleSection("studentData")}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>Dados do aluno</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{studentDataSummary}</Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={colors.muted} style={{ transform: [{ rotate: openSection === "studentData" ? "180deg" : "0deg" }] }} />
              </Pressable>
              {openSection === "studentData" ? <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 12 }} /> : null}
              {studentDataAnim.isVisible ? (
                <Animated.View style={[studentDataAnim.animatedStyle, { overflow: "hidden" }]}>
                  <View style={{ gap: 10, padding: 12 }}>
                    <View style={rowStyle}>
                      <View style={colStyle}>
                        <Text style={{ color: colors.muted, fontSize: 11 }}>Nome do aluno</Text>
                        <TextInput value={name} onChangeText={setName} placeholder="Nome" placeholderTextColor={colors.placeholder} style={inputStyle(colors)} />
                      </View>
                      <View style={colStyle}>
                        <Text style={{ color: colors.muted, fontSize: 11 }}>E-mail de login</Text>
                        <TextInput value={email} onChangeText={setEmail} placeholder="email@exemplo.com" placeholderTextColor={colors.placeholder} style={inputStyle(colors)} />
                      </View>
                    </View>

                    <View style={rowStyle}>
                      <View style={colStyle}>
                        <Text style={{ color: colors.muted, fontSize: 11 }}>Nascimento</Text>
                        <TextInput
                          value={birthText}
                          onChangeText={(v) => {
                            const f = formatBrInput(v);
                            setBirthText(f);
                            const iso = brToIso(f);
                            if (iso) setBirthIso(iso);
                            if (!f) setBirthIso("");
                          }}
                          placeholder="DD/MM/AAAA"
                          placeholderTextColor={colors.placeholder}
                          style={inputStyle(colors)}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={colStyle}>
                        <Text style={{ color: colors.muted, fontSize: 11 }}>Telefone do aluno</Text>
                        <TextInput
                          value={phone}
                          onChangeText={(value) => setPhone(formatPhoneBrWithCountry(value))}
                          placeholder="+55 (DDD) 0 0000-0000"
                          placeholderTextColor={colors.placeholder}
                          style={inputStyle(colors)}
                          keyboardType="phone-pad"
                        />
                      </View>
                    </View>
                  </View>
                </Animated.View>
              ) : null}
            </View>

            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.card, overflow: "hidden" }}>
              <Pressable
                onPress={() => toggleSection("documents")}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>Documentos</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{documentsSummary}</Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={colors.muted} style={{ transform: [{ rotate: openSection === "documents" ? "180deg" : "0deg" }] }} />
              </Pressable>
              {openSection === "documents" ? <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 12 }} /> : null}
              {documentsAnim.isVisible ? (
                <Animated.View style={[documentsAnim.animatedStyle, { overflow: "hidden" }]}>
                  <View style={{ gap: 10, padding: 12 }}>
                    <TextInput
                      value={ra}
                      onChangeText={(value) => {
                        setRa(normalizeRaDigits(value));
                        setDocumentsError((prev) => ({ ...prev, ra: undefined }));
                      }}
                      placeholder="RA (ex: 2022202626)"
                      placeholderTextColor={colors.placeholder}
                      keyboardType="numeric"
                      style={[inputStyle(colors), documentsError.ra ? { borderColor: colors.dangerText } : null]}
                    />
                    {documentsError.ra ? <Text style={{ color: colors.dangerText, fontSize: 11 }}>{documentsError.ra}</Text> : null}

                    <View style={rowStyle}>
                      <View style={colStyle}>
                        <Text style={{ color: colors.muted, fontSize: 11 }}>CPF</Text>
                        <View style={{ position: "relative" }}>
                          <TextInput
                            value={cpfDisplay}
                            onChangeText={(value) => {
                              setCpfWasEdited(true);
                              setCpfDisplay(maskCpf(value));
                              setCpfRevealedValue(null);
                              setIsCpfVisible(false);
                              setCpfRevealUnavailable(false);
                              setDocumentsError((prev) => ({ ...prev, cpf: undefined }));
                            }}
                            placeholder="000.000.000-00"
                            placeholderTextColor={colors.placeholder}
                            keyboardType="numeric"
                            style={[inputStyle(colors), canRevealCpf ? { paddingRight: 36 } : null, documentsError.cpf ? { borderColor: colors.dangerText } : null]}
                          />
                          {canRevealCpf ? (
                            <Pressable onPress={() => void revealCpf()} disabled={revealCpfBusy} style={{ position: "absolute", right: 10, top: 0, bottom: 0, justifyContent: "center", opacity: revealCpfBusy ? 0.7 : 1 }}>
                              {revealCpfBusy ? (
                                <Ionicons name="hourglass-outline" size={18} color={colors.muted} />
                              ) : (
                                <Ionicons name={isCpfVisible ? "eye-off-outline" : "eye-outline"} size={18} color={colors.muted} />
                              )}
                            </Pressable>
                          ) : null}
                        </View>
                        {documentsError.cpf ? <Text style={{ color: colors.dangerText, fontSize: 11 }}>{documentsError.cpf}</Text> : null}
                      </View>
                      <View style={colStyle}>
                        <Text style={{ color: colors.muted, fontSize: 11 }}>RG</Text>
                        <TextInput
                          value={rgDocument}
                          onChangeText={(value) => setRgDocument(formatRgBr(value))}
                          placeholder="00.000.000-0"
                          placeholderTextColor={colors.placeholder}
                          style={[inputStyle(colors), documentsError.rg ? { borderColor: colors.dangerText } : null]}
                        />
                        {documentsError.rg ? <Text style={{ color: colors.dangerText, fontSize: 11 }}>{documentsError.rg}</Text> : null}
                      </View>
                    </View>
                  </View>
                </Animated.View>
              ) : null}
            </View>

            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.card, overflow: "hidden" }}>
              <Pressable
                onPress={() => toggleSection("sportProfile")}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>Perfil esportivo</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{sportSummary}</Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={colors.muted} style={{ transform: [{ rotate: openSection === "sportProfile" ? "180deg" : "0deg" }] }} />
              </Pressable>
              {openSection === "sportProfile" ? <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 12 }} /> : null}
              {sportAnim.isVisible ? (
                <Animated.View style={[sportAnim.animatedStyle, { overflow: "hidden" }]}>
                  <View style={{ gap: 10, padding: 12 }}>
                  <View style={rowStyle}>
                    <View style={colStyle}>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>Posição principal</Text>
                      <View ref={primaryRef}>
                        <Pressable onPress={() => setDropKey(dropKey === "primary" ? null : "primary")} style={selectFieldStyle}>
                          <Text style={{ color: colors.text, fontSize: 13, fontWeight: "500" }}>{getSelectDisplayValue(primaryPos)}</Text>
                          <Ionicons name="chevron-down" size={16} color={colors.muted} style={{ transform: [{ rotate: dropKey === "primary" ? "180deg" : "0deg" }] }} />
                        </Pressable>
                      </View>
                    </View>
                    <View style={colStyle}>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>Posição secundária</Text>
                      <View ref={secondaryRef}>
                        <Pressable onPress={() => setDropKey(dropKey === "secondary" ? null : "secondary")} style={selectFieldStyle}>
                          <Text style={{ color: colors.text, fontSize: 13, fontWeight: "500" }}>{getSelectDisplayValue(secondaryPos)}</Text>
                          <Ionicons name="chevron-down" size={16} color={colors.muted} style={{ transform: [{ rotate: dropKey === "secondary" ? "180deg" : "0deg" }] }} />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                  </View>
                </Animated.View>
              ) : null}
            </View>

            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.card, overflow: "hidden" }}>
              <Pressable
                onPress={() => toggleSection("health")}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>Saúde</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{healthSummary}</Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={colors.muted} style={{ transform: [{ rotate: openSection === "health" ? "180deg" : "0deg" }] }} />
              </Pressable>
              {openSection === "health" ? <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 12 }} /> : null}
              {healthAnim.isVisible ? (
                <Animated.View style={[healthAnim.animatedStyle, { overflow: "hidden" }]}>
                  <View style={{ gap: 10, padding: 12 }}>
                  <View style={rowStyle}>
                    <View style={colStyle}>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>Problema de saúde?</Text>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <Pressable onPress={() => { setHealthIssue(false); setHealthIssueNotes(""); }} style={{ paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: !healthIssue ? colors.primaryBg : colors.secondaryBg }}>
                          <Text style={{ color: !healthIssue ? colors.primaryText : colors.text, fontWeight: "700" }}>Não</Text>
                        </Pressable>
                        <Pressable onPress={() => setHealthIssue(true)} style={{ paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: healthIssue ? colors.primaryBg : colors.secondaryBg }}>
                          <Text style={{ color: healthIssue ? colors.primaryText : colors.text, fontWeight: "700" }}>Sim</Text>
                        </Pressable>
                      </View>
                    </View>
                    <View style={colStyle}>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>Uso contínuo de medicação?</Text>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <Pressable onPress={() => { setMedicationUse(false); setMedicationNotes(""); }} style={{ paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: !medicationUse ? colors.primaryBg : colors.secondaryBg }}>
                          <Text style={{ color: !medicationUse ? colors.primaryText : colors.text, fontWeight: "700" }}>Não</Text>
                        </Pressable>
                        <Pressable onPress={() => setMedicationUse(true)} style={{ paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: medicationUse ? colors.primaryBg : colors.secondaryBg }}>
                          <Text style={{ color: medicationUse ? colors.primaryText : colors.text, fontWeight: "700" }}>Sim</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                  {healthIssue ? (
                    <TextInput value={healthIssueNotes} onChangeText={setHealthIssueNotes} placeholder="Descreva a questão de saúde" placeholderTextColor={colors.placeholder} style={[inputStyle(colors), { minHeight: 72, textAlignVertical: "top" }]} multiline />
                  ) : null}
                  {medicationUse ? (
                    <TextInput value={medicationNotes} onChangeText={setMedicationNotes} placeholder="Qual medicação?" placeholderTextColor={colors.placeholder} style={[inputStyle(colors), { minHeight: 72, textAlignVertical: "top" }]} multiline />
                  ) : null}
                  <TextInput value={healthObs} onChangeText={setHealthObs} placeholder="Adicionar observações" placeholderTextColor={colors.placeholder} style={[inputStyle(colors), { minHeight: 84, textAlignVertical: "top" }]} multiline />

                  {editingIntake ? (
                    <View style={{ gap: 8 }}>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        {editingIntake.riskStatus !== "apto" ? (
                          <View
                            style={{
                              borderRadius: 999,
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              backgroundColor: riskBadgePalette[editingIntake.riskStatus].bg,
                            }}
                          >
                            <Text style={{ color: riskBadgePalette[editingIntake.riskStatus].text, fontSize: 11, fontWeight: "700" }}>
                              {riskBadgePalette[editingIntake.riskStatus].label}
                            </Text>
                          </View>
                        ) : null}
                        {healthBadgeItems.map((item) => (
                          <View
                            key={item}
                            style={{
                              borderRadius: 999,
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              backgroundColor: colors.secondaryBg,
                              borderWidth: 1,
                              borderColor: colors.border,
                            }}
                          >
                            <Text style={{ color: colors.text, fontSize: 11, fontWeight: "600" }}>{item}</Text>
                          </View>
                        ))}
                      </View>
                      {editingIntake.notes ? (
                        <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={2}>
                          {editingIntake.notes}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                  </View>
                </Animated.View>
              ) : null}
            </View>

            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.card, overflow: "hidden" }}>
              <Pressable
                onPress={() => toggleSection("guardian")}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>Responsável</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{guardianSummary}</Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={colors.muted} style={{ transform: [{ rotate: openSection === "guardian" ? "180deg" : "0deg" }] }} />
              </Pressable>
              {openSection === "guardian" ? <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 12 }} /> : null}
              {guardianAnim.isVisible ? (
                <Animated.View style={[guardianAnim.animatedStyle, { overflow: "hidden" }]}>
                  <View style={{ gap: 10, padding: 12 }}>
                  <View style={rowStyle}>
                    <View style={colStyle}>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>Nome do responsável</Text>
                      <TextInput value={guardianName} onChangeText={setGuardianName} placeholder="Responsável" placeholderTextColor={colors.placeholder} style={inputStyle(colors)} />
                    </View>
                    <View style={colStyle}>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>Telefone do responsável</Text>
                      <TextInput value={guardianPhone} onChangeText={(value) => setGuardianPhone(formatPhoneBrWithCountry(value))} placeholder="+55 (DDD) 0 0000-0000" placeholderTextColor={colors.placeholder} keyboardType="phone-pad" style={inputStyle(colors)} />
                    </View>
                  </View>
                  <View style={{ gap: 4 }}>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>Parentesco</Text>
                    <View ref={guardianRef}>
                      <Pressable onPress={() => setDropKey(dropKey === "guardian" ? null : "guardian")} style={selectFieldStyle}>
                        <Text style={{ color: colors.text, fontSize: 13, fontWeight: "500" }}>{guardianRelation || "Selecione"}</Text>
                        <Ionicons name="chevron-down" size={16} color={colors.muted} style={{ transform: [{ rotate: dropKey === "guardian" ? "180deg" : "0deg" }] }} />
                      </Pressable>
                    </View>
                  </View>
                  </View>
                </Animated.View>
              ) : null}
            </View>

            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.card, overflow: "hidden" }}>
              <Pressable
                onPress={() => toggleSection("links")}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>Vínculos esportivos</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{linksSummary}</Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={colors.muted} style={{ transform: [{ rotate: openSection === "links" ? "180deg" : "0deg" }] }} />
              </Pressable>
              {openSection === "links" ? <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 12 }} /> : null}
              {linksAnim.isVisible ? (
                <Animated.View style={[linksAnim.animatedStyle, { overflow: "hidden" }]}>
                  <View style={{ gap: 8, padding: 12 }}>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {sportsLinkBadges.map((item) => (
                      <View
                        key={item}
                        style={{
                          borderRadius: 999,
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          backgroundColor: colors.secondaryBg,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <Text style={{ color: colors.text, fontSize: 11, fontWeight: "600" }}>{item}</Text>
                      </View>
                    ))}
                  </View>
                  {!editingIntake ? <Text style={{ color: colors.muted, fontSize: 12 }}>{`${cls?.name ?? "Sem turma"} • ${cls?.unit ?? "Sem unidade"}`}</Text> : null}
                  </View>
                </Animated.View>
              ) : null}
            </View>

            <Pressable
              onPress={() => {
                if (editingStudent) {
                  removeStudent(editingStudent);
                }
              }}
              disabled={!editingStudent || saving}
              style={{
                borderRadius: 12,
                backgroundColor: colors.dangerSolidBg,
                paddingVertical: 10,
                alignItems: "center",
                opacity: !editingStudent || saving ? 0.45 : 1,
              }}
            >
              <Text
                style={{
                  color: colors.dangerSolidText,
                  fontWeight: "700",
                }}
              >
                Excluir aluno
              </Text>
            </Pressable>
          </ScrollView>

          <View
            style={{
              paddingTop: 10,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <Pressable
              onPress={() => void save()}
              disabled={saving || photoSaving || !isEditDirty || !name.trim()}
              style={{
                borderRadius: 12,
                backgroundColor: colors.primaryBg,
                paddingVertical: 11,
                alignItems: "center",
                opacity: saving || photoSaving ? 0.7 : !isEditDirty || !name.trim() ? 0.45 : 1,
              }}
            >
              <Text
                style={{
                  color: colors.primaryText,
                  fontWeight: "700",
                }}
              >
                {saving || photoSaving ? "Salvando..." : "Salvar"}
              </Text>
            </Pressable>
          </View>
          </View>

          <AnchoredDropdown
            visible={dropdownVisible}
            layout={activeLayout}
            container={container}
            animationStyle={dropdownAnimatedStyle}
            zIndex={420}
            maxHeight={180}
            nestedScrollEnabled
            onRequestClose={closeDropdown}
            showVerticalScrollIndicator
            scrollContentStyle={{ padding: 8, gap: 6 }}
          >
            {activeOptions.map((opt, index) => (
              <Pressable key={`${opt}-${index}`} onPress={() => onSelect(opt)} style={{ paddingHorizontal: 12, paddingVertical: 12, borderRadius: 14, marginVertical: 3, backgroundColor: opt === activeValue ? colors.primaryBg : colors.card }}>
                <Text style={{ color: opt === activeValue ? colors.primaryText : colors.text, fontSize: 14, fontWeight: opt === activeValue ? "700" : "500" }}>{getOptionLabel(opt)}</Text>
              </Pressable>
            ))}
          </AnchoredDropdown>
        </View>
      </ModalSheet>

      <ConfirmCloseOverlay
        visible={showEditCloseConfirm}
        title="Sair sem salvar?"
        message="Você tem alterações não salvas."
        confirmLabel="Descartar"
        cancelLabel="Continuar"
        onConfirm={closeEditModal}
        onCancel={() => setShowEditCloseConfirm(false)}
      />
      <ConfirmCloseOverlay
        visible={showCreateCloseConfirm}
        title="Sair sem salvar?"
        message="Você tem alterações não salvas no cadastro."
        confirmLabel="Descartar"
        cancelLabel="Continuar"
        onConfirm={confirmCreateDiscard}
        onCancel={closeCreateDiscardConfirm}
      />
    </SafeAreaView>
  );
}
