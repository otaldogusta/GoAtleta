import { useCallback } from "react";
import { Alert } from "react-native";
import type {
    AthleteLearningStyle,
    AthleteObjective,
    AthletePosition,
    ClassGroup,
    Student,
} from "../../../core/models";

export type UseOnEditStudentParams = {
  ageBandOptions: readonly string[];
  athleteLearningStyleOptions: readonly string[];
  athleteObjectiveOptions: readonly string[];
  athletePositionOptions: readonly string[];
  classById: Map<string, ClassGroup>;
  closeAllPickers: () => void;
  unitLabel: (value: string) => string;
  calculateAge: (iso: string) => number | null;
  // setters from useStudentForm
  setShowForm: (value: boolean) => void;
  setStudentFormError: (value: string) => void;
  setStudentDocumentsError: (value: { ra?: string; cpf?: string; rg?: string }) => void;
  setShowEditModal: (value: boolean) => void;
  setUnit: (value: string) => void;
  setAgeBand: (value: string) => void;
  setCustomAgeBand: (value: string) => void;
  setClassId: (value: string) => void;
  setEditingId: (value: string | null) => void;
  setEditingCreatedAt: (value: string | null) => void;
  setName: (value: string) => void;
  setCollegeCourse: (value: string) => void;
  setPhotoUrl: (value: string | null) => void;
  setPhotoMimeType: (value: string | null) => void;
  setEditSnapshot: (value: {
    unit: string;
    ageBand: string;
    customAgeBand: string;
    classId: string;
    name: string;
    collegeCourse: string;
    photoUrl: string | null;
    birthDate: string;
    phone: string;
    cpfDisplay: string;
    rgDocument: string;
    ra: string;
    loginEmail: string;
    guardianName: string;
    guardianPhone: string;
    guardianRelation: string;
    positionPrimary: AthletePosition;
    positionSecondary: AthletePosition;
    athleteObjective: AthleteObjective;
    learningStyle: AthleteLearningStyle;
    isExperimental: boolean;
    healthIssue: boolean;
    healthIssueNotes: string;
    medicationUse: boolean;
    medicationNotes: string;
    healthObservations: string;
  }) => void;
  setBirthDate: (value: string) => void;
  setAgeNumber: (value: number | null) => void;
  setPhone: (value: string) => void;
  setCpfDisplay: (value: string) => void;
  setCpfMaskedOriginal: (value: string) => void;
  setCpfRevealedValue: (value: string | null) => void;
  setIsCpfVisible: (value: boolean) => void;
  setCpfRevealUnavailable: (value: boolean) => void;
  setRgDocument: (value: string) => void;
  setRa: (value: string) => void;
  setLoginEmail: (value: string) => void;
  setGuardianName: (value: string) => void;
  setGuardianPhone: (value: string) => void;
  setGuardianRelation: (value: string) => void;
  setPositionPrimary: (value: AthletePosition) => void;
  setPositionSecondary: (value: AthletePosition) => void;
  setAthleteObjective: (value: AthleteObjective) => void;
  setLearningStyle: (value: AthleteLearningStyle) => void;
  setIsExperimental: (value: boolean) => void;
  setHealthIssue: (value: boolean) => void;
  setHealthIssueNotes: (value: string) => void;
  setMedicationUse: (value: boolean) => void;
  setMedicationNotes: (value: string) => void;
  setHealthObservations: (value: string) => void;
  setOpenEditSection: (value: "studentData" | "documents" | "sportProfile" | "health" | "guardian" | "links" | null) => void;
};

export function useOnEditStudent({
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
}: UseOnEditStudentParams) {
  const onEdit = useCallback(
    (student: Student) => {
      // Open first so a bad field doesn't block the modal entirely.
      setShowForm(false);
      setStudentFormError("");
      setStudentDocumentsError({});
      setShowEditModal(true);
      try {
        const safeText = (value: unknown) =>
          typeof value === "string" ? value : value == null ? "" : String(value);
        const cls = classById.get(student.classId) ?? null;
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
        const collegeCourseValue = safeText(student.collegeCourse);
        const loginEmailValue = safeText(student.loginEmail);
        const cpfDisplayValue = safeText(student.cpfMasked);
        const rgDocumentValue = safeText(student.rg);
        const raValue = safeText(student.ra);
        const guardianNameValue = safeText(student.guardianName);
        const guardianPhoneValue = safeText(student.guardianPhone);
        const guardianRelationValue = safeText(student.guardianRelation);
        const positionPrimaryValue = athletePositionOptions.includes(student.positionPrimary)
          ? student.positionPrimary
          : "indefinido";
        const positionSecondaryValue = athletePositionOptions.includes(student.positionSecondary)
          ? student.positionSecondary
          : "indefinido";
        const athleteObjectiveValue = athleteObjectiveOptions.includes(student.athleteObjective)
          ? student.athleteObjective
          : "base";
        const learningStyleValue = athleteLearningStyleOptions.includes(student.learningStyle)
          ? student.learningStyle
          : "misto";
        const isExperimentalValue = Boolean(student.isExperimental);
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
        setCollegeCourse(collegeCourseValue);
        setPhotoUrl(student.photoUrl ?? null);
        setPhotoMimeType(null);
        setEditSnapshot({
          unit: nextUnit,
          ageBand: nextAgeBand,
          customAgeBand: nextCustomAgeBand,
          classId: nextClassId,
          name: safeText(student.name),
          collegeCourse: collegeCourseValue,
          photoUrl: student.photoUrl ?? null,
          birthDate: birthDateValue,
          phone: student.phone,
          cpfDisplay: cpfDisplayValue,
          rgDocument: rgDocumentValue,
          ra: raValue,
          loginEmail: loginEmailValue,
          guardianName: guardianNameValue,
          guardianPhone: guardianPhoneValue,
          guardianRelation: guardianRelationValue,
          positionPrimary: positionPrimaryValue,
          positionSecondary: positionSecondaryValue,
          athleteObjective: athleteObjectiveValue,
          learningStyle: learningStyleValue,
          isExperimental: isExperimentalValue,
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
        setCpfDisplay(cpfDisplayValue);
        setCpfMaskedOriginal(cpfDisplayValue);
        setCpfRevealedValue(null);
        setIsCpfVisible(false);
        setCpfRevealUnavailable(false);
        setRgDocument(rgDocumentValue);
        setRa(raValue);
        setLoginEmail(loginEmailValue);
        setGuardianName(guardianNameValue);
        setGuardianPhone(guardianPhoneValue);
        setGuardianRelation(guardianRelationValue);
        setPositionPrimary(positionPrimaryValue);
        setPositionSecondary(positionSecondaryValue);
        setAthleteObjective(athleteObjectiveValue);
        setLearningStyle(learningStyleValue);
        setIsExperimental(isExperimentalValue);
        setHealthIssue(student.healthIssue ?? false);
        setHealthIssueNotes(healthIssueNotesValue);
        setMedicationUse(student.medicationUse ?? false);
        setMedicationNotes(medicationNotesValue);
        setHealthObservations(healthObservationsValue);
        setOpenEditSection("studentData");
        closeAllPickers();
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        Alert.alert("Erro ao abrir aluno", detail);
      }
    },
    [
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
    ]
  );

  return { onEdit };
}
