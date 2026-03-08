import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
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

import type { ClassGroup, Student } from "../../../src/core/models";
import { useEffectiveProfile } from "../../../src/core/effective-profile";
import {
  deleteStudent,
  getClassById,
  getStudentsByClass,
  revealStudentCpf,
  updateStudent,
} from "../../../src/db/seed";
import { AnchoredDropdown } from "../../../src/ui/AnchoredDropdown";
import { ConfirmCloseOverlay } from "../../../src/ui/ConfirmCloseOverlay";
import { ModalSheet } from "../../../src/ui/ModalSheet";
import { Pressable } from "../../../src/ui/Pressable";
import { useAppTheme } from "../../../src/ui/app-theme";
import { useConfirmUndo } from "../../../src/ui/confirm-undo";
import { getSectionCardStyle } from "../../../src/ui/section-styles";
import { useCollapsibleAnimation } from "../../../src/ui/use-collapsible";
import { maskCpf } from "../../../src/utils/cpf";
import { formatRgBr } from "../../../src/utils/document-normalization";
import { buildWaMeLink, getContactPhone, openWhatsApp } from "../../../src/utils/whatsapp";

const guardianRelationOptions = ["Mãe", "Pai", "Avó", "Avô", "Irmão", "Irmã", "Tio", "Tia", "Outro"] as const;
const positionOptions = ["indefinido", "levantador", "oposto", "ponteiro", "central", "libero"] as const;
const objectiveOptions = ["ludico", "base", "rendimento"] as const;
type DropKey = "guardian" | "primary" | "secondary" | "objective" | null;
type Layout = { x: number; y: number; width: number; height: number };
type StudentSectionKey = "studentData" | "sportProfile" | "health" | "guardian" | "links" | null;

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

export default function ClassStudentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const { confirm } = useConfirmUndo();
  const effectiveProfile = useEffectiveProfile();
  const canRevealCpf = effectiveProfile === "admin";
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const isCompactForm = windowWidth <= 760;

  const [cls, setCls] = useState<ClassGroup | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [saving, setSaving] = useState(false);
  const [dropKey, setDropKey] = useState<DropKey>(null);
  const [showEditCloseConfirm, setShowEditCloseConfirm] = useState(false);
  const [openSection, setOpenSection] = useState<StudentSectionKey>("studentData");

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
  const [documentsError, setDocumentsError] = useState<{ cpf?: string; rg?: string }>({});
  const [revealCpfBusy, setRevealCpfBusy] = useState(false);
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
    healthIssue: boolean;
    healthIssueNotes: string;
    medicationUse: boolean;
    medicationNotes: string;
    healthObs: string;
    cpfDisplay: string;
    rgDocument: string;
  } | null>(null);

  const containerRef = useRef<View>(null);
  const guardianRef = useRef<View>(null);
  const primaryRef = useRef<View>(null);
  const secondaryRef = useRef<View>(null);
  const objectiveRef = useRef<View>(null);
  const [container, setContainer] = useState<{ x: number; y: number } | null>(null);
  const [layouts, setLayouts] = useState<Record<Exclude<DropKey, null>, Layout | null>>({
    guardian: null,
    primary: null,
    secondary: null,
    objective: null,
  });

  const { animatedStyle: dropdownAnimatedStyle, isVisible: dropdownVisible } = useCollapsibleAnimation(
    dropKey !== null
  );
  const studentDataAnim = useCollapsibleAnimation(openSection === "studentData", {
    durationIn: 220,
    durationOut: 180,
    translateY: -4,
  });
  const sportAnim = useCollapsibleAnimation(openSection === "sportProfile", {
    durationIn: 220,
    durationOut: 180,
    translateY: -4,
  });
  const healthAnim = useCollapsibleAnimation(openSection === "health", {
    durationIn: 220,
    durationOut: 180,
    translateY: -4,
  });
  const guardianAnim = useCollapsibleAnimation(openSection === "guardian", {
    durationIn: 220,
    durationOut: 180,
    translateY: -4,
  });
  const linksAnim = useCollapsibleAnimation(openSection === "links", {
    durationIn: 220,
    durationOut: 180,
    translateY: -4,
  });

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
    try {
      const [classData, list] = await Promise.all([getClassById(id), getStudentsByClass(id)]);
      setCls(classData);
      setStudents(list.slice().sort((a, b) => a.name.localeCompare(b.name)));
    } finally {
      setLoading(false);
    }
  }, [id]);

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
    apply("objective", objectiveRef);
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
    if (!t) return students;
    return students.filter((s) => {
      const p = String(s.phone ?? "").replace(/\D/g, "");
      return (
        s.name.toLowerCase().includes(t) ||
        String(s.guardianName ?? "").toLowerCase().includes(t) ||
        p.includes(t.replace(/\D/g, ""))
      );
    });
  }, [search, students]);

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
    setGuardianPhone(s.guardianPhone ?? "");
    setGuardianRelation(s.guardianRelation ?? "");
    setPrimaryPos(s.positionPrimary && s.positionPrimary !== "indefinido" ? s.positionPrimary : "");
    setSecondaryPos(s.positionSecondary && s.positionSecondary !== "indefinido" ? s.positionSecondary : "");
    setObjective(s.athleteObjective && s.athleteObjective !== "base" ? s.athleteObjective : "");
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
    setDocumentsError({});
    setEditSnapshot({
      name: s.name ?? "",
      phone: s.phone ?? "",
      email: s.loginEmail ?? "",
      birthIso: s.birthDate ?? "",
      birthText: s.birthDate ? formatBr(s.birthDate) : "",
      age: String(s.age ?? ""),
      guardianName: s.guardianName ?? "",
      guardianPhone: s.guardianPhone ?? "",
      guardianRelation: s.guardianRelation ?? "",
      primaryPos: s.positionPrimary && s.positionPrimary !== "indefinido" ? s.positionPrimary : "",
      secondaryPos:
        s.positionSecondary && s.positionSecondary !== "indefinido" ? s.positionSecondary : "",
      objective: s.athleteObjective && s.athleteObjective !== "base" ? s.athleteObjective : "",
      healthIssue: Boolean(s.healthIssue),
      healthIssueNotes: s.healthIssueNotes ?? "",
      medicationUse: Boolean(s.medicationUse),
      medicationNotes: s.medicationNotes ?? "",
      healthObs: s.healthObservations ?? "",
      cpfDisplay: s.cpfMasked ?? "",
      rgDocument: s.rg ?? "",
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
      editSnapshot.healthIssue !== healthIssue ||
      editSnapshot.healthIssueNotes !== healthIssueNotes ||
      editSnapshot.medicationUse !== medicationUse ||
      editSnapshot.medicationNotes !== medicationNotes ||
      editSnapshot.healthObs !== healthObs ||
      (cpfWasEdited && editSnapshot.cpfDisplay !== cpfDisplay) ||
      editSnapshot.rgDocument !== rgDocument
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
    medicationNotes,
    medicationUse,
    name,
    objective,
    phone,
    primaryPos,
    rgDocument,
    secondaryPos,
  ]);

  const closeEditModal = useCallback(() => {
    setDropKey(null);
    setShowEditCloseConfirm(false);
    setEditingStudent(null);
    setEditSnapshot(null);
  }, []);

  const requestCloseEditModal = useCallback(() => {
    if (isEditDirty) {
      setShowEditCloseConfirm(true);
      return;
    }
    closeEditModal();
  }, [closeEditModal, isEditDirty]);

  const save = async () => {
    if (!editingStudent || !name.trim() || !isEditDirty) return;
    setSaving(true);
    try {
      setDocumentsError({});
      const parsed = birthText.trim() ? brToIso(birthText.trim()) : "";
      await updateStudent({
        ...editingStudent,
        name: name.trim(),
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
        learningStyle: editingStudent.learningStyle ?? "misto",
        healthIssue,
        healthIssueNotes: healthIssue ? healthIssueNotes.trim() : "",
        medicationUse,
        medicationNotes: medicationUse ? medicationNotes.trim() : "",
        healthObservations: healthObs.trim(),
        cpfMasked: cpfDisplay.trim() || null,
        rg: rgDocument.trim() || null,
      });
      closeEditModal();
      await load();
    } finally {
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
      : dropKey === "primary" || dropKey === "secondary"
      ? positionOptions
      : objectiveOptions;

  const activeValue =
    dropKey === "guardian"
      ? guardianRelation
      : dropKey === "primary"
      ? primaryPos
      : dropKey === "secondary"
      ? secondaryPos
      : objective;

  const studentDataSummary = useMemo(() => {
    const parts = [
      birthText || "Nascimento não informado",
      cpfDisplay ? "CPF cadastrado" : "CPF não informado",
      rgDocument ? "RG cadastrado" : "RG não informado",
    ];
    return parts.join(" • ");
  }, [birthText, cpfDisplay, rgDocument]);

  const sportSummary = useMemo(() => {
    return [
      getSelectDisplayValue(primaryPos),
      getSelectDisplayValue(secondaryPos),
      getSelectDisplayValue(objective),
    ].join(" • ");
  }, [objective, primaryPos, secondaryPos]);

  const healthSummary = useMemo(() => {
    if (!healthIssue && !medicationUse && !healthObs.trim()) {
      return "Sem restrições informadas";
    }
    return "Informações de saúde registradas";
  }, [healthIssue, healthObs, medicationUse]);

  const guardianSummary = useMemo(() => {
    const nameLabel = guardianName.trim() || "Responsável não informado";
    const phoneLabel = guardianPhone.trim() || "Sem telefone";
    return `${nameLabel} • ${phoneLabel}`;
  }, [guardianName, guardianPhone]);

  const linksSummary = useMemo(() => {
    const classLabel = cls?.name || "Sem turma";
    const unitLabel = cls?.unit || "Sem unidade";
    return `${classLabel} • ${unitLabel}`;
  }, [cls?.name, cls?.unit]);

  const onSelect = (value: string) => {
    if (dropKey === "guardian") setGuardianRelation(value);
    if (dropKey === "primary") setPrimaryPos(value);
    if (dropKey === "secondary") setSecondaryPos(value);
    if (dropKey === "objective") setObjective(value);
    setDropKey(null);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: colors.text, fontSize: 26, fontWeight: "700", flex: 1 }}>Alunos da turma</Text>
          <Pressable
            onPress={() => router.back()}
            style={{ borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondaryBg, paddingHorizontal: 12, paddingVertical: 8 }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>Voltar</Text>
          </Pressable>
        </View>

        <Text style={{ color: colors.muted, marginTop: 6 }}>{cls ? `${cls.name} • ${cls.unit}` : "Carregando turma..."}</Text>

        <View style={[getSectionCardStyle(colors, "neutral", { radius: 14, padding: 12 }), { marginTop: 12 }]}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar por nome, responsável ou telefone"
            placeholderTextColor={colors.placeholder}
            style={inputStyle(colors)}
          />
        </View>

        <ScrollView contentContainerStyle={{ gap: 10, paddingTop: 12, paddingBottom: Math.max(insets.bottom + 24, 36) }} keyboardShouldPersistTaps="handled">
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
                  <Pressable onPress={() => openEdit(s)} style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>{s.name}</Text>
                      {s.isExperimental ? (
                        <View
                          style={{
                            borderRadius: 999,
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            backgroundColor: colors.warningBg,
                          }}
                        >
                          <Text
                            style={{
                              color: colors.warningText,
                              fontSize: 11,
                              fontWeight: "700",
                            }}
                          >
                            Experimental
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{s.guardianName ? `Responsável: ${s.guardianName}` : "Sem responsável cadastrado"}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{s.positionPrimary || "indefinido"} • {s.athleteObjective || "base"}</Text>
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
                    <Pressable
                      onPress={() => removeStudent(s)}
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 21,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: colors.dangerSolidBg,
                        borderWidth: 1,
                        borderColor: colors.dangerSolidBg,
                      }}
                    >
                      <Ionicons name="trash-outline" size={20} color={colors.dangerSolidText} />
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>

      <ModalSheet
        visible={Boolean(editingStudent)}
        onClose={requestCloseEditModal}
        position="center"
        cardStyle={{
          width: "96%",
          maxWidth: 920,
          height: isCompactForm ? "92%" : "86%",
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
          padding: 16,
        }}
      >
        <View ref={containerRef} style={{ flex: 1, position: "relative" }}>
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
            showsVerticalScrollIndicator={false}
          >
            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.card, overflow: "hidden" }}>
              <Pressable
                onPress={() => toggleSection("studentData")}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: openSection === "studentData" ? 1 : 0, borderBottomColor: colors.border }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>Dados do aluno</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{studentDataSummary}</Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={colors.muted} style={{ transform: [{ rotate: openSection === "studentData" ? "180deg" : "0deg" }] }} />
              </Pressable>
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

                  <View style={rowStyle}>
                    <View style={colStyle}>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>Telefone do aluno</Text>
                      <TextInput value={phone} onChangeText={setPhone} placeholder="Telefone" placeholderTextColor={colors.placeholder} style={inputStyle(colors)} />
                    </View>
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
                  </View>
                  </View>
                </Animated.View>
              ) : null}
            </View>

            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.card, overflow: "hidden" }}>
              <Pressable
                onPress={() => toggleSection("sportProfile")}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: openSection === "sportProfile" ? 1 : 0, borderBottomColor: colors.border }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>Perfil esportivo</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{sportSummary}</Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={colors.muted} style={{ transform: [{ rotate: openSection === "sportProfile" ? "180deg" : "0deg" }] }} />
              </Pressable>
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
                  <View style={{ gap: 4 }}>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>Nível atual</Text>
                    <View ref={objectiveRef}>
                      <Pressable onPress={() => setDropKey(dropKey === "objective" ? null : "objective")} style={selectFieldStyle}>
                        <Text style={{ color: colors.text, fontSize: 13, fontWeight: "500" }}>{getSelectDisplayValue(objective)}</Text>
                        <Ionicons name="chevron-down" size={16} color={colors.muted} style={{ transform: [{ rotate: dropKey === "objective" ? "180deg" : "0deg" }] }} />
                      </Pressable>
                    </View>
                  </View>
                  </View>
                </Animated.View>
              ) : null}
            </View>

            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.card, overflow: "hidden" }}>
              <Pressable
                onPress={() => toggleSection("health")}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: openSection === "health" ? 1 : 0, borderBottomColor: colors.border }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>Saúde</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{healthSummary}</Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={colors.muted} style={{ transform: [{ rotate: openSection === "health" ? "180deg" : "0deg" }] }} />
              </Pressable>
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
                  <TextInput value={healthObs} onChangeText={setHealthObs} placeholder="Observações de saúde" placeholderTextColor={colors.placeholder} style={[inputStyle(colors), { minHeight: 84, textAlignVertical: "top" }]} multiline />
                  </View>
                </Animated.View>
              ) : null}
            </View>

            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.card, overflow: "hidden" }}>
              <Pressable
                onPress={() => toggleSection("guardian")}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: openSection === "guardian" ? 1 : 0, borderBottomColor: colors.border }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>Responsável</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{guardianSummary}</Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={colors.muted} style={{ transform: [{ rotate: openSection === "guardian" ? "180deg" : "0deg" }] }} />
              </Pressable>
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
                      <TextInput value={guardianPhone} onChangeText={setGuardianPhone} placeholder="Telefone responsável" placeholderTextColor={colors.placeholder} style={inputStyle(colors)} />
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
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: openSection === "links" ? 1 : 0, borderBottomColor: colors.border }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>Vínculos esportivos</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{linksSummary}</Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={colors.muted} style={{ transform: [{ rotate: openSection === "links" ? "180deg" : "0deg" }] }} />
              </Pressable>
              {linksAnim.isVisible ? (
                <Animated.View style={[linksAnim.animatedStyle, { overflow: "hidden" }]}>
                  <View style={{ gap: 6, padding: 12 }}>
                  <Text style={{ color: colors.text, fontSize: 13 }}>Turma vinculada: {cls?.name ?? "Não informado"}</Text>
                  <Text style={{ color: colors.text, fontSize: 13 }}>Unidade: {cls?.unit ?? "Não informado"}</Text>
                  <Text style={{ color: colors.text, fontSize: 13 }}>Categoria atual: {cls?.ageBand ?? "Não informado"}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>Histórico de mudanças de categoria/turma será exibido aqui na próxima etapa.</Text>
                  </View>
                </Animated.View>
              ) : null}
            </View>
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
              disabled={saving || !isEditDirty || !name.trim()}
              style={{
                borderRadius: 12,
                backgroundColor: colors.primaryBg,
                paddingVertical: 11,
                alignItems: "center",
                opacity: saving ? 0.7 : !isEditDirty || !name.trim() ? 0.45 : 1,
              }}
            >
              <Text
                style={{
                  color: colors.primaryText,
                  fontWeight: "700",
                }}
              >
                {saving ? "Salvando..." : "Salvar"}
              </Text>
            </Pressable>
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
            showVerticalScrollIndicator={false}
          >
            {activeOptions.map((opt, index) => (
              <Pressable key={`${opt}-${index}`} onPress={() => onSelect(opt)} style={{ paddingHorizontal: 12, paddingVertical: 10, backgroundColor: opt === activeValue ? colors.secondaryBg : colors.card }}>
                <Text style={{ color: colors.text, fontWeight: opt === activeValue ? "600" : "500" }}>{getOptionLabel(opt)}</Text>
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
    </SafeAreaView>
  );
}
