import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import type { RefObject } from "react";
import { useMemo } from "react";
import {
    Animated,
    Text,
    TextInput,
    View,
} from "react-native";
import type { Student } from "../../core/models";
import { deriveStudentHealthAssessment } from "../../core/student-health";
import { normalizeRaDigits } from "../../utils/student-ra";
import type { ThemeColors } from "../../ui/app-theme";
import { Button } from "../../ui/Button";
import { DateInput } from "../../ui/DateInput";
import { Pressable } from "../../ui/Pressable";
import { StudentAcademicFields } from "./components/StudentAcademicFields";
import { StudentDocumentsFields } from "./components/StudentDocumentsFields";
import type { StudentFormSection } from "./hooks/useStudentForm";

const safeText = (value: unknown) => String(value ?? "");

type CollapsibleAnim = {
    isVisible: boolean;
    animatedStyle: any;
};

type ConfirmDialogOptions = {
    title: string;
    message: string;
    tone: "default" | "danger";
    confirmLabel: string;
    cancelLabel: string;
    onConfirm: () => void;
};

type DocumentsError = {
    ra?: string;
    cpf?: string;
    rg?: string;
};

type SelectFieldStyle = {
    paddingVertical: number;
    paddingHorizontal: number;
    borderRadius: number;
    backgroundColor: string;
    borderWidth: number;
    borderColor: string;
    flexDirection: "row";
    alignItems: "center";
    justifyContent: "space-between";
    gap: number;
};

export type StudentRegistrationTabProps = {
    colors: ThemeColors;
    selectFieldStyle: SelectFieldStyle;

    // Photo
    photoUrl: string | null;
    setShowPhotoSheet: (v: boolean) => void;

    // Type picker
    isExperimental: boolean;
    showTypePicker: boolean;
    typeTriggerRef: RefObject<View | null>;
    toggleFormPicker: (target: "unit" | "class" | "guardianRelation" | "type") => void;

    // Section accordion state & animations
    openCreateSection: StudentFormSection;
    toggleCreateSection: (section: "studentData" | "academic" | "documents" | "sportProfile" | "health" | "guardian") => void;
    createStudentDataAnim: CollapsibleAnim;
    createAcademicAnim: CollapsibleAnim;
    createDocumentsAnim: CollapsibleAnim;
    createSportAnim: CollapsibleAnim;
    createHealthAnim: CollapsibleAnim;
    createGuardianAnim: CollapsibleAnim;

    // Student data fields
    name: string;
    setName: (v: string) => void;
    formatName: (v: string) => string;
    collegeCourse: string;
    setCollegeCourse: (v: string) => void;

    unit: string;
    showUnitPicker: boolean;
    unitTriggerRef: RefObject<View | null>;

    selectedClassName: string;
    showClassPicker: boolean;
    classTriggerRef: RefObject<View | null>;

    studentFormError: string;

    birthDate: string;
    setBirthDate: (v: string) => void;
    setShowCalendar: (v: boolean) => void;
    ageNumber: number | null;

    phone: string;
    setPhone: (v: string) => void;
    formatPhone: (v: string) => string;

    // Academic fields
    ra: string;
    setRa: (v: string) => void;

    cpfDisplay: string;
    setCpfDisplay: (v: string) => void;
    setIsCpfVisible: (v: boolean) => void;
    setCpfRevealedValue: (v: string | null) => void;
    setCpfRevealUnavailable: (v: boolean) => void;

    rgDocument: string;
    setRgDocument: (v: string) => void;

    editingId: string | null;
    canRevealCpf: boolean;
    isCpfVisible: boolean;
    revealCpfBusy: boolean;
    handleRevealEditingCpf: () => void;
    studentDocumentsError: DocumentsError;

    // Documents fields
    setStudentDocumentsError: (patch: DocumentsError | ((prev: DocumentsError) => DocumentsError)) => void;

    loginEmail: string;
    setLoginEmail: (v: string) => void;
    formatEmail: (v: string) => string;

    // Sport profile fields
    positionPrimary: Student["positionPrimary"];
    setPositionPrimary: (v: Student["positionPrimary"]) => void;
    positionSecondary: Student["positionSecondary"];
    setPositionSecondary: (v: Student["positionSecondary"]) => void;
    athleteObjective: Student["athleteObjective"];
    setAthleteObjective: (v: Student["athleteObjective"]) => void;
    learningStyle: Student["learningStyle"];
    setLearningStyle: (v: Student["learningStyle"]) => void;

    // Health fields
    healthIssue: boolean;
    setHealthIssue: (v: boolean) => void;
    healthIssueNotes: string;
    setHealthIssueNotes: (v: string) => void;
    medicationUse: boolean;
    setMedicationUse: (v: boolean) => void;
    medicationNotes: string;
    setMedicationNotes: (v: string) => void;
    healthObservations: string;
    setHealthObservations: (v: string) => void;

    // Guardian fields
    guardianName: string;
    setGuardianName: (v: string) => void;
    guardianPhone: string;
    setGuardianPhone: (v: string) => void;
    guardianRelation: string;
    showGuardianRelationPicker: boolean;
    guardianRelationTriggerRef: RefObject<View | null>;

    // Actions
    canSaveStudent: boolean;
    onSave: () => void;
    isFormDirty: any;
    doResetForm: () => void;
    confirmDialog: (options: ConfirmDialogOptions) => void;
};

export function StudentRegistrationTab({
    colors,
    selectFieldStyle,
    photoUrl,
    setShowPhotoSheet,
    isExperimental,
    showTypePicker,
    typeTriggerRef,
    toggleFormPicker,
    openCreateSection,
    toggleCreateSection,
    createStudentDataAnim,
    createAcademicAnim,
    createDocumentsAnim,
    createSportAnim,
    createHealthAnim,
    createGuardianAnim,
    name,
    setName,
    formatName,
    collegeCourse,
    setCollegeCourse,
    unit,
    showUnitPicker,
    unitTriggerRef,
    selectedClassName,
    showClassPicker,
    classTriggerRef,
    studentFormError,
    birthDate,
    setBirthDate,
    setShowCalendar,
    ageNumber,
    phone,
    setPhone,
    formatPhone,
    ra,
    setRa,
    cpfDisplay,
    setCpfDisplay,
    setIsCpfVisible,
    setCpfRevealedValue,
    setCpfRevealUnavailable,
    rgDocument,
    setRgDocument,
    editingId,
    canRevealCpf,
    isCpfVisible,
    revealCpfBusy,
    handleRevealEditingCpf,
    studentDocumentsError,
    setStudentDocumentsError,
    loginEmail,
    setLoginEmail,
    formatEmail,
    positionPrimary,
    setPositionPrimary,
    positionSecondary,
    setPositionSecondary,
    athleteObjective,
    setAthleteObjective,
    learningStyle,
    setLearningStyle,
    healthIssue,
    setHealthIssue,
    healthIssueNotes,
    setHealthIssueNotes,
    medicationUse,
    setMedicationUse,
    medicationNotes,
    setMedicationNotes,
    healthObservations,
    setHealthObservations,
    guardianName,
    setGuardianName,
    guardianPhone,
    setGuardianPhone,
    guardianRelation,
    showGuardianRelationPicker,
    guardianRelationTriggerRef,
    canSaveStudent,
    onSave,
    isFormDirty,
    doResetForm,
    confirmDialog,
}: StudentRegistrationTabProps) {
    const createHealthAssessment = useMemo(
        () =>
            deriveStudentHealthAssessment({
                healthIssue,
                healthIssueNotes,
                medicationUse,
                medicationNotes,
                healthObservations,
            }),
        [healthIssue, healthIssueNotes, healthObservations, medicationNotes, medicationUse]
    );

    return (
        <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Pressable
                  onPress={() => setShowPhotoSheet(true)}
                  style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.secondaryBg, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", overflow: "hidden" }}
                >
                  {photoUrl ? <Image source={{ uri: photoUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : <Ionicons name="person" size={22} color={colors.text} />}
                </Pressable>
                <Pressable onPress={() => setShowPhotoSheet(true)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.secondaryBg, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>Adicionar foto</Text>
                </Pressable>
              </View>
              <View style={{ width: 190, maxWidth: "100%" }}>
                <View ref={typeTriggerRef}>
                  <Pressable onPress={() => toggleFormPicker("type")} style={selectFieldStyle}>
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>{isExperimental ? "Experimental" : "Aluno regular"}</Text>
                    <Ionicons name="chevron-down" size={16} color={colors.muted} style={{ transform: [{ rotate: showTypePicker ? "180deg" : "0deg" }] }} />
                  </Pressable>
                </View>
              </View>
            </View>

            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.card, overflow: "hidden" }}>
              <Pressable onPress={() => toggleCreateSection("studentData")} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>Dados do aluno</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{name.trim() || "Nome, unidade, turma..."}</Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={colors.muted} style={{ transform: [{ rotate: openCreateSection === "studentData" ? "180deg" : "0deg" }] }} />
              </Pressable>
              {openCreateSection === "studentData" ? <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 12 }} /> : null}
              {createStudentDataAnim.isVisible ? (
                <Animated.View style={[createStudentDataAnim.animatedStyle, { overflow: "hidden" }]}>
                  <View style={{ gap: 10, padding: 12 }}>
                    <TextInput placeholder="Nome do aluno" value={name} onChangeText={setName} onBlur={() => setName(formatName(name))} placeholderTextColor={colors.placeholder} style={{ borderWidth: 1, borderColor: colors.border, padding: 12, borderRadius: 12, backgroundColor: colors.background, color: colors.inputText }} />
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                      <View style={{ flex: 1, minWidth: 140, gap: 4 }}>
                        <Text style={{ color: colors.muted, fontSize: 11 }}>Unidade</Text>
                        <View ref={unitTriggerRef}>
                          <Pressable onPress={() => toggleFormPicker("unit")} style={selectFieldStyle}>
                            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>{unit || "Selecione a unidade"}</Text>
                            <Ionicons name="chevron-down" size={16} color={colors.muted} style={{ transform: [{ rotate: showUnitPicker ? "180deg" : "0deg" }] }} />
                          </Pressable>
                        </View>
                      </View>
                      <View style={{ flex: 1, minWidth: 140, gap: 4 }}>
                        <Text style={{ color: colors.muted, fontSize: 11 }}>Turma</Text>
                        <View ref={classTriggerRef}>
                          <Pressable onPress={() => toggleFormPicker("class")} style={selectFieldStyle}>
                            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>{selectedClassName || "Selecione a turma"}</Text>
                            <Ionicons name="chevron-down" size={16} color={colors.muted} style={{ transform: [{ rotate: showClassPicker ? "180deg" : "0deg" }] }} />
                          </Pressable>
                        </View>
                      </View>
                    </View>
                    {studentFormError ? <Text style={{ color: colors.dangerText, fontSize: 12 }}>{studentFormError}</Text> : null}
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                      <View style={{ flex: 1, minWidth: 140, gap: 4 }}>
                        <DateInput value={birthDate} onChange={setBirthDate} placeholder="Data de nascimento" onOpenCalendar={() => setShowCalendar(true)} />
                        <Text style={{ color: colors.muted, fontSize: 12 }}>{ageNumber !== null ? `Idade: ${ageNumber} anos` : "Idade calculada automaticamente"}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 140, gap: 4 }}>
                        <TextInput placeholder="Telefone" value={phone} onChangeText={(v) => setPhone(formatPhone(v))} keyboardType="phone-pad" placeholderTextColor={colors.placeholder} style={{ borderWidth: 1, borderColor: colors.border, padding: 12, borderRadius: 12, backgroundColor: colors.background, color: colors.inputText }} />
                      </View>
                    </View>
                  </View>
                </Animated.View>
              ) : null}
            </View>

            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.card, overflow: "hidden" }}>
              <Pressable onPress={() => toggleCreateSection("academic")} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>Perfil Acadêmico</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{[safeText(ra).trim() ? `RA: ${safeText(ra)}` : "", safeText(collegeCourse).trim() ? safeText(collegeCourse) : ""].filter(Boolean).join(" • ") || "RA e curso..."}</Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={colors.muted} style={{ transform: [{ rotate: openCreateSection === "academic" ? "180deg" : "0deg" }] }} />
              </Pressable>
              {openCreateSection === "academic" ? <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 12 }} /> : null}
              {createAcademicAnim.isVisible ? (
                <Animated.View style={[createAcademicAnim.animatedStyle, { overflow: "hidden" }]}>
                  <View style={{ gap: 10, padding: 12 }}>
                    <StudentAcademicFields
                      ra={ra}
                      collegeCourse={collegeCourse}
                      onChangeRa={(value) => {
                        setRa(value);
                        setStudentDocumentsError((prev) => ({ ...prev, ra: undefined }));
                      }}
                      onChangeCollegeCourse={setCollegeCourse}
                      errors={studentDocumentsError}
                    />
                  </View>
                </Animated.View>
              ) : null}
            </View>

            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.card, overflow: "hidden" }}>
              <Pressable onPress={() => toggleCreateSection("documents")} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>Documentos</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{[cpfDisplay.trim() ? "CPF" : "", rgDocument.trim() ? "RG" : "", loginEmail.trim() ? "e-mail" : ""].filter(Boolean).join(", ") || "CPF, RG, e-mail..."}</Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={colors.muted} style={{ transform: [{ rotate: openCreateSection === "documents" ? "180deg" : "0deg" }] }} />
              </Pressable>
              {openCreateSection === "documents" ? <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 12 }} /> : null}
              {createDocumentsAnim.isVisible ? (
                <Animated.View style={[createDocumentsAnim.animatedStyle, { overflow: "hidden" }]}>
                  <View style={{ gap: 10, padding: 12 }}>
                    <StudentDocumentsFields
                      cpfDisplay={cpfDisplay}
                      rg={rgDocument}
                      onChangeCpf={(value) => { setCpfDisplay(value); setIsCpfVisible(false); setCpfRevealedValue(null); setCpfRevealUnavailable(false); setStudentDocumentsError((prev) => ({ ...prev, cpf: undefined })); }}
                      onChangeRg={setRgDocument}
                      showRevealCpfButton={Boolean(editingId && canRevealCpf)}
                      isCpfVisible={isCpfVisible}
                      revealCpfBusy={revealCpfBusy}
                      onRevealCpf={handleRevealEditingCpf}
                      errors={studentDocumentsError}
                    />
                    <View style={{ gap: 4 }}>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>Email do aluno (login)</Text>
                      <TextInput placeholder="email@exemplo.com" value={loginEmail} onChangeText={setLoginEmail} onBlur={() => setLoginEmail(formatEmail(loginEmail))} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} placeholderTextColor={colors.placeholder} style={{ borderWidth: 1, borderColor: colors.border, padding: 12, borderRadius: 12, backgroundColor: colors.background, color: colors.inputText }} />
                    </View>
                  </View>
                </Animated.View>
              ) : null}
            </View>

            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.card, overflow: "hidden" }}>
              <Pressable onPress={() => toggleCreateSection("sportProfile")} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>Perfil esportivo</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{[positionPrimary, positionSecondary].filter((v) => v && v !== "indefinido").join(", ") || "Posições, objetivo..."}</Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={colors.muted} style={{ transform: [{ rotate: openCreateSection === "sportProfile" ? "180deg" : "0deg" }] }} />
              </Pressable>
              {openCreateSection === "sportProfile" ? <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 12 }} /> : null}
              {createSportAnim.isVisible ? (
                <Animated.View style={[createSportAnim.animatedStyle, { overflow: "hidden" }]}>
                  <View style={{ gap: 10, padding: 12 }}>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                      <View style={{ flex: 1, minWidth: 140, gap: 4 }}>
                        <Text style={{ color: colors.muted, fontSize: 11 }}>Posição principal</Text>
                        <TextInput placeholder="indefinido | levantador | oposto..." value={positionPrimary} onChangeText={(v) => setPositionPrimary((v.trim().toLowerCase() as Student["positionPrimary"]) || "indefinido")} placeholderTextColor={colors.placeholder} style={{ borderWidth: 1, borderColor: colors.border, padding: 12, borderRadius: 12, backgroundColor: colors.background, color: colors.inputText }} />
                      </View>
                      <View style={{ flex: 1, minWidth: 140, gap: 4 }}>
                        <Text style={{ color: colors.muted, fontSize: 11 }}>Posição secundária</Text>
                        <TextInput placeholder="indefinido | ponteiro | libero..." value={positionSecondary} onChangeText={(v) => setPositionSecondary((v.trim().toLowerCase() as Student["positionSecondary"]) || "indefinido")} placeholderTextColor={colors.placeholder} style={{ borderWidth: 1, borderColor: colors.border, padding: 12, borderRadius: 12, backgroundColor: colors.background, color: colors.inputText }} />
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                      <View style={{ flex: 1, minWidth: 140, gap: 4 }}>
                        <Text style={{ color: colors.muted, fontSize: 11 }}>Objetivo esportivo</Text>
                        <TextInput placeholder="ludico | base | rendimento" value={athleteObjective} onChangeText={(v) => setAthleteObjective((v.trim().toLowerCase() as Student["athleteObjective"]) || "base")} placeholderTextColor={colors.placeholder} style={{ borderWidth: 1, borderColor: colors.border, padding: 12, borderRadius: 12, backgroundColor: colors.background, color: colors.inputText }} />
                      </View>
                      <View style={{ flex: 1, minWidth: 140, gap: 4 }}>
                        <Text style={{ color: colors.muted, fontSize: 11 }}>Estilo de aprendizagem</Text>
                        <TextInput placeholder="misto | visual | auditivo | cinestesico" value={learningStyle} onChangeText={(v) => setLearningStyle((v.trim().toLowerCase() as Student["learningStyle"]) || "misto")} placeholderTextColor={colors.placeholder} style={{ borderWidth: 1, borderColor: colors.border, padding: 12, borderRadius: 12, backgroundColor: colors.background, color: colors.inputText }} />
                      </View>
                    </View>
                  </View>
                </Animated.View>
              ) : null}
            </View>

            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.card, overflow: "hidden" }}>
              <Pressable onPress={() => toggleCreateSection("health")} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>Saúde</Text>
                    {createHealthAssessment.level !== "apto" ? (
                      <View
                        style={{
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor:
                            createHealthAssessment.level === "revisar"
                              ? colors.dangerBorder
                              : colors.warningBg,
                          backgroundColor:
                            createHealthAssessment.level === "revisar"
                              ? colors.dangerBg
                              : colors.warningBg,
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                        }}
                      >
                        <Text
                          style={{
                            color:
                              createHealthAssessment.level === "revisar"
                                ? colors.dangerText
                                : colors.warningText,
                            fontSize: 10,
                            fontWeight: "700",
                          }}
                        >
                          {createHealthAssessment.label}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{createHealthAssessment.summary}</Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={colors.muted} style={{ transform: [{ rotate: openCreateSection === "health" ? "180deg" : "0deg" }] }} />
              </Pressable>
              {openCreateSection === "health" ? <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 12 }} /> : null}
              {createHealthAnim.isVisible ? (
                <Animated.View style={[createHealthAnim.animatedStyle, { overflow: "hidden" }]}>
                  <View style={{ gap: 10, padding: 12 }}>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                      <View style={{ flex: 1, minWidth: 140, gap: 8 }}>
                        <Text style={{ color: colors.muted, fontSize: 12 }}>Problema de saúde?</Text>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <Pressable onPress={() => { setHealthIssue(false); setHealthIssueNotes(""); }} style={{ paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: !healthIssue ? colors.primaryBg : colors.secondaryBg }}>
                            <Text style={{ color: !healthIssue ? colors.primaryText : colors.text, fontWeight: "700" }}>Não</Text>
                          </Pressable>
                          <Pressable onPress={() => setHealthIssue(true)} style={{ paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: healthIssue ? colors.primaryBg : colors.secondaryBg }}>
                            <Text style={{ color: healthIssue ? colors.primaryText : colors.text, fontWeight: "700" }}>Sim</Text>
                          </Pressable>
                        </View>
                        {healthIssue ? <TextInput placeholder="Descreva a questão de saúde" value={healthIssueNotes} onChangeText={setHealthIssueNotes} placeholderTextColor={colors.placeholder} multiline style={{ borderWidth: 1, borderColor: colors.border, padding: 12, borderRadius: 12, backgroundColor: colors.background, color: colors.inputText, minHeight: 72, textAlignVertical: "top" }} /> : null}
                      </View>
                      <View style={{ flex: 1, minWidth: 140, gap: 8 }}>
                        <Text style={{ color: colors.muted, fontSize: 12 }}>Uso contínuo de medicação?</Text>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <Pressable onPress={() => { setMedicationUse(false); setMedicationNotes(""); }} style={{ paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: !medicationUse ? colors.primaryBg : colors.secondaryBg }}>
                            <Text style={{ color: !medicationUse ? colors.primaryText : colors.text, fontWeight: "700" }}>Não</Text>
                          </Pressable>
                          <Pressable onPress={() => setMedicationUse(true)} style={{ paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: medicationUse ? colors.primaryBg : colors.secondaryBg }}>
                            <Text style={{ color: medicationUse ? colors.primaryText : colors.text, fontWeight: "700" }}>Sim</Text>
                          </Pressable>
                        </View>
                        {medicationUse ? <TextInput placeholder="Qual medicação?" value={medicationNotes} onChangeText={setMedicationNotes} placeholderTextColor={colors.placeholder} multiline style={{ borderWidth: 1, borderColor: colors.border, padding: 12, borderRadius: 12, backgroundColor: colors.background, color: colors.inputText, minHeight: 72, textAlignVertical: "top" }} /> : null}
                      </View>
                    </View>
                    <TextInput placeholder="Outras observações" value={healthObservations} onChangeText={setHealthObservations} placeholderTextColor={colors.placeholder} multiline style={{ borderWidth: 1, borderColor: colors.border, padding: 12, borderRadius: 12, backgroundColor: colors.background, color: colors.inputText, minHeight: 80, textAlignVertical: "top" }} />
                  </View>
                </Animated.View>
              ) : null}
            </View>

            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.card, overflow: "hidden" }}>
              <Pressable onPress={() => toggleCreateSection("guardian")} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>Responsável</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{guardianName.trim() || "Nome e contato do responsável..."}</Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={colors.muted} style={{ transform: [{ rotate: openCreateSection === "guardian" ? "180deg" : "0deg" }] }} />
              </Pressable>
              {openCreateSection === "guardian" ? <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 12 }} /> : null}
              {createGuardianAnim.isVisible ? (
                <Animated.View style={[createGuardianAnim.animatedStyle, { overflow: "hidden" }]}>
                  <View style={{ gap: 10, padding: 12 }}>
                    <TextInput placeholder="Nome do responsável" value={guardianName} onChangeText={setGuardianName} onBlur={() => setGuardianName(formatName(guardianName))} placeholderTextColor={colors.placeholder} style={{ borderWidth: 1, borderColor: colors.border, padding: 12, borderRadius: 12, backgroundColor: colors.background, color: colors.inputText }} />
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                      <View style={{ flex: 1, minWidth: 140, gap: 4 }}>
                        <Text style={{ color: colors.muted, fontSize: 11 }}>Telefone do responsável</Text>
                        <TextInput placeholder="Telefone do responsável" value={guardianPhone} onChangeText={(v) => setGuardianPhone(formatPhone(v))} keyboardType="phone-pad" placeholderTextColor={colors.placeholder} style={{ borderWidth: 1, borderColor: colors.border, padding: 12, borderRadius: 12, backgroundColor: colors.background, color: colors.inputText }} />
                      </View>
                      <View style={{ flex: 1, minWidth: 140, gap: 4 }}>
                        <Text style={{ color: colors.muted, fontSize: 11 }}>Parentesco</Text>
                        <View ref={guardianRelationTriggerRef}>
                          <Pressable onPress={() => toggleFormPicker("guardianRelation")} style={selectFieldStyle}>
                            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>{guardianRelation || "Selecione"}</Text>
                            <Ionicons name="chevron-down" size={16} color={colors.muted} style={{ transform: [{ rotate: showGuardianRelationPicker ? "180deg" : "0deg" }] }} />
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  </View>
                </Animated.View>
              ) : null}
            </View>

            <Button label={editingId ? "Salvar alterações" : "Adicionar aluno"} onPress={onSave} disabled={!canSaveStudent} />
            {editingId ? (
              <Button
                label="Cancelar edição"
                variant="secondary"
                onPress={() => {
                  if (isFormDirty) {
                    confirmDialog({
                      title: "Sair sem salvar?",
                      message: "Você tem alterações não salvas.",
                      tone: "default",
                      confirmLabel: "Descartar",
                      cancelLabel: "Continuar",
                      onConfirm: () => { doResetForm(); },
                    });
                    return;
                  }
                  doResetForm();
                }}
              />
            ) : null}
        </View>
    );
}
