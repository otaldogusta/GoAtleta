import { useCallback, useEffect, useReducer, useRef } from "react";
import type { Student } from "../../../core/models";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StudentFormSection =
  | "studentData"
  | "academic"
  | "documents"
  | "sportProfile"
  | "health"
  | "guardian"
  | null;

export type EditSection = StudentFormSection | "links";

export type StudentFormState = {
  // Turma / unidade
  unit: string;
  ageBand: string;
  customAgeBand: string;
  classId: string;

  // Dados pessoais
  name: string;
  collegeCourse: string;
  photoUrl: string | null;
  photoMimeType: string | null;
  birthDate: string;
  ageNumber: number | null;
  phone: string;

  // Documentos
  cpfDisplay: string;
  cpfMaskedOriginal: string;
  cpfRevealedValue: string | null;
  isCpfVisible: boolean;
  cpfRevealUnavailable: boolean;
  revealCpfBusy: boolean;
  rgDocument: string;
  ra: string;
  loginEmail: string;

  // Responsável
  guardianName: string;
  guardianPhone: string;
  guardianRelation: string;

  // Perfil esportivo
  positionPrimary: Student["positionPrimary"];
  positionSecondary: Student["positionSecondary"];
  athleteObjective: Student["athleteObjective"];
  learningStyle: Student["learningStyle"];

  // Saúde
  healthIssue: boolean;
  healthIssueNotes: string;
  medicationUse: boolean;
  medicationNotes: string;
  healthObservations: string;
  isExperimental: boolean;

  // Metadados de edição
  editingId: string | null;
  editingCreatedAt: string | null;
  openCreateSection: StudentFormSection;
  openEditSection: EditSection;

  // Snapshot para detecção de dirty
  editSnapshot: Omit<
    StudentFormState,
    | "editingId"
    | "editingCreatedAt"
    | "openCreateSection"
    | "openEditSection"
    | "editSnapshot"
    | "photoMimeType"
    | "cpfMaskedOriginal"
    | "cpfRevealedValue"
    | "isCpfVisible"
    | "cpfRevealUnavailable"
    | "revealCpfBusy"
    | "ageNumber"
    | "formError"
    | "documentsError"
  > | null;

  // Erros
  formError: string;
  documentsError: { ra?: string; cpf?: string; rg?: string };
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type SetFieldAction = {
  type: "SET_FIELD";
  field: keyof Omit<StudentFormState, "editSnapshot" | "documentsError">;
  value: StudentFormState[keyof StudentFormState];
};

type SetDocumentsErrorAction = {
  type: "SET_DOCUMENTS_ERROR";
  patch:
    | { ra?: string; cpf?: string; rg?: string }
    | ((prev: StudentFormState["documentsError"]) => StudentFormState["documentsError"]);
};

type SetSnapshotAction = {
  type: "SET_SNAPSHOT";
  snapshot: StudentFormState["editSnapshot"];
};

type ResetAction = { type: "RESET" };
type ResetCreateAction = { type: "RESET_CREATE" };

type Action =
  | SetFieldAction
  | SetDocumentsErrorAction
  | SetSnapshotAction
  | ResetAction
  | ResetCreateAction;

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const INITIAL_FORM: StudentFormState = {
  unit: "",
  ageBand: "",
  customAgeBand: "",
  classId: "",
  name: "",
  collegeCourse: "",
  photoUrl: null,
  photoMimeType: null,
  birthDate: "",
  ageNumber: null,
  phone: "",
  cpfDisplay: "",
  cpfMaskedOriginal: "",
  cpfRevealedValue: null,
  isCpfVisible: false,
  cpfRevealUnavailable: false,
  revealCpfBusy: false,
  rgDocument: "",
  ra: "",
  loginEmail: "",
  guardianName: "",
  guardianPhone: "",
  guardianRelation: "",
  positionPrimary: "indefinido",
  positionSecondary: "indefinido",
  athleteObjective: "base",
  learningStyle: "misto",
  healthIssue: false,
  healthIssueNotes: "",
  medicationUse: false,
  medicationNotes: "",
  healthObservations: "",
  isExperimental: false,
  editingId: null,
  editingCreatedAt: null,
  openCreateSection: "studentData",
  openEditSection: null,
  editSnapshot: null,
  formError: "",
  documentsError: {},
};

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function studentFormReducer(
  state: StudentFormState,
  action: Action
): StudentFormState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };

    case "SET_DOCUMENTS_ERROR":
      {
      const nextPatch =
        typeof action.patch === "function"
          ? action.patch(state.documentsError)
          : action.patch;
      return {
        ...state,
        documentsError: { ...state.documentsError, ...nextPatch },
      };
      }

    case "SET_SNAPSHOT":
      return { ...state, editSnapshot: action.snapshot };

    case "RESET":
      return {
        ...INITIAL_FORM,
        openCreateSection: "studentData",
        openEditSection: null,
      };

    case "RESET_CREATE":
      return {
        ...state,
        unit: "",
        ageBand: "",
        classId: "",
        customAgeBand: "",
        formError: "",
        name: "",
        collegeCourse: "",
        photoUrl: null,
        photoMimeType: null,
        birthDate: "",
        ageNumber: null,
        phone: "",
        cpfDisplay: "",
        cpfMaskedOriginal: "",
        cpfRevealedValue: null,
        isCpfVisible: false,
        cpfRevealUnavailable: false,
        revealCpfBusy: false,
        rgDocument: "",
        ra: "",
        loginEmail: "",
        guardianName: "",
        guardianPhone: "",
        guardianRelation: "",
        positionPrimary: "indefinido",
        positionSecondary: "indefinido",
        athleteObjective: "base",
        learningStyle: "misto",
        isExperimental: false,
        healthIssue: false,
        healthIssueNotes: "",
        medicationUse: false,
        medicationNotes: "",
        healthObservations: "",
        openCreateSection: "studentData",
        documentsError: {},
      };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useStudentForm() {
  const [form, dispatch] = useReducer(studentFormReducer, INITIAL_FORM);
  const openCreateSectionRef = useRef<StudentFormState["openCreateSection"]>(form.openCreateSection);
  const openEditSectionRef = useRef<StudentFormState["openEditSection"]>(form.openEditSection);

  useEffect(() => {
    openCreateSectionRef.current = form.openCreateSection;
  }, [form.openCreateSection]);

  useEffect(() => {
    openEditSectionRef.current = form.openEditSection;
  }, [form.openEditSection]);

  // Setters individuais — mesma API que useState para minimizar diff no componente pai
  const setUnit = useCallback(
    (v: string) => dispatch({ type: "SET_FIELD", field: "unit", value: v }),
    []
  );
  const setAgeBand = useCallback(
    (v: string) =>
      dispatch({ type: "SET_FIELD", field: "ageBand", value: v }),
    []
  );
  const setCustomAgeBand = useCallback(
    (v: string) =>
      dispatch({ type: "SET_FIELD", field: "customAgeBand", value: v }),
    []
  );
  const setClassId = useCallback(
    (v: string) => dispatch({ type: "SET_FIELD", field: "classId", value: v }),
    []
  );
  const setName = useCallback(
    (v: string) => dispatch({ type: "SET_FIELD", field: "name", value: v }),
    []
  );
  const setCollegeCourse = useCallback(
    (v: string) =>
      dispatch({ type: "SET_FIELD", field: "collegeCourse", value: v }),
    []
  );
  const setPhotoUrl = useCallback(
    (v: string | null) =>
      dispatch({ type: "SET_FIELD", field: "photoUrl", value: v }),
    []
  );
  const setPhotoMimeType = useCallback(
    (v: string | null) =>
      dispatch({ type: "SET_FIELD", field: "photoMimeType", value: v }),
    []
  );
  const setBirthDate = useCallback(
    (v: string) =>
      dispatch({ type: "SET_FIELD", field: "birthDate", value: v }),
    []
  );
  const setAgeNumber = useCallback(
    (v: number | null) =>
      dispatch({ type: "SET_FIELD", field: "ageNumber", value: v }),
    []
  );
  const setPhone = useCallback(
    (v: string) => dispatch({ type: "SET_FIELD", field: "phone", value: v }),
    []
  );
  const setCpfDisplay = useCallback(
    (v: string) =>
      dispatch({ type: "SET_FIELD", field: "cpfDisplay", value: v }),
    []
  );
  const setCpfMaskedOriginal = useCallback(
    (v: string) =>
      dispatch({ type: "SET_FIELD", field: "cpfMaskedOriginal", value: v }),
    []
  );
  const setCpfRevealedValue = useCallback(
    (v: string | null) =>
      dispatch({ type: "SET_FIELD", field: "cpfRevealedValue", value: v }),
    []
  );
  const setIsCpfVisible = useCallback(
    (v: boolean) =>
      dispatch({ type: "SET_FIELD", field: "isCpfVisible", value: v }),
    []
  );
  const setCpfRevealUnavailable = useCallback(
    (v: boolean) =>
      dispatch({
        type: "SET_FIELD",
        field: "cpfRevealUnavailable",
        value: v,
      }),
    []
  );
  const setRevealCpfBusy = useCallback(
    (v: boolean) =>
      dispatch({ type: "SET_FIELD", field: "revealCpfBusy", value: v }),
    []
  );
  const setRgDocument = useCallback(
    (v: string) =>
      dispatch({ type: "SET_FIELD", field: "rgDocument", value: v }),
    []
  );
  const setRa = useCallback(
    (v: string) => dispatch({ type: "SET_FIELD", field: "ra", value: v }),
    []
  );
  const setLoginEmail = useCallback(
    (v: string) =>
      dispatch({ type: "SET_FIELD", field: "loginEmail", value: v }),
    []
  );
  const setGuardianName = useCallback(
    (v: string) =>
      dispatch({ type: "SET_FIELD", field: "guardianName", value: v }),
    []
  );
  const setGuardianPhone = useCallback(
    (v: string) =>
      dispatch({ type: "SET_FIELD", field: "guardianPhone", value: v }),
    []
  );
  const setGuardianRelation = useCallback(
    (v: string) =>
      dispatch({ type: "SET_FIELD", field: "guardianRelation", value: v }),
    []
  );
  const setPositionPrimary = useCallback(
    (v: Student["positionPrimary"]) =>
      dispatch({ type: "SET_FIELD", field: "positionPrimary", value: v }),
    []
  );
  const setPositionSecondary = useCallback(
    (v: Student["positionSecondary"]) =>
      dispatch({ type: "SET_FIELD", field: "positionSecondary", value: v }),
    []
  );
  const setAthleteObjective = useCallback(
    (v: Student["athleteObjective"]) =>
      dispatch({ type: "SET_FIELD", field: "athleteObjective", value: v }),
    []
  );
  const setLearningStyle = useCallback(
    (v: Student["learningStyle"]) =>
      dispatch({ type: "SET_FIELD", field: "learningStyle", value: v }),
    []
  );
  const setHealthIssue = useCallback(
    (v: boolean) =>
      dispatch({ type: "SET_FIELD", field: "healthIssue", value: v }),
    []
  );
  const setHealthIssueNotes = useCallback(
    (v: string) =>
      dispatch({ type: "SET_FIELD", field: "healthIssueNotes", value: v }),
    []
  );
  const setMedicationUse = useCallback(
    (v: boolean) =>
      dispatch({ type: "SET_FIELD", field: "medicationUse", value: v }),
    []
  );
  const setMedicationNotes = useCallback(
    (v: string) =>
      dispatch({ type: "SET_FIELD", field: "medicationNotes", value: v }),
    []
  );
  const setHealthObservations = useCallback(
    (v: string) =>
      dispatch({ type: "SET_FIELD", field: "healthObservations", value: v }),
    []
  );
  const setIsExperimental = useCallback(
    (v: boolean) =>
      dispatch({ type: "SET_FIELD", field: "isExperimental", value: v }),
    []
  );
  const setEditingId = useCallback(
    (v: string | null) =>
      dispatch({ type: "SET_FIELD", field: "editingId", value: v }),
    []
  );
  const setEditingCreatedAt = useCallback(
    (v: string | null) =>
      dispatch({ type: "SET_FIELD", field: "editingCreatedAt", value: v }),
    []
  );
  const setOpenCreateSection = useCallback(
    (v: StudentFormSection | ((prev: StudentFormSection) => StudentFormSection)) => {
      const nextValue = typeof v === "function" ? v(openCreateSectionRef.current) : v;
      dispatch({ type: "SET_FIELD", field: "openCreateSection", value: nextValue });
    },
    []
  );
  const setOpenEditSection = useCallback(
    (v: EditSection | ((prev: EditSection) => EditSection)) => {
      const nextValue = typeof v === "function" ? v(openEditSectionRef.current) : v;
      dispatch({ type: "SET_FIELD", field: "openEditSection", value: nextValue });
    },
    []
  );
  const setStudentFormError = useCallback(
    (v: string) =>
      dispatch({ type: "SET_FIELD", field: "formError", value: v }),
    []
  );
  const setStudentDocumentsError = useCallback(
    (
      patch:
        | { ra?: string; cpf?: string; rg?: string }
        | ((
            prev: StudentFormState["documentsError"]
          ) => StudentFormState["documentsError"])
    ) => {
      dispatch({ type: "SET_DOCUMENTS_ERROR", patch });
    },
    []
  );
  const setEditSnapshot = useCallback(
    (v: StudentFormState["editSnapshot"]) =>
      dispatch({ type: "SET_SNAPSHOT", snapshot: v }),
    []
  );

  const resetForm = useCallback(() => dispatch({ type: "RESET" }), []);
  const resetCreateForm = useCallback(
    () => dispatch({ type: "RESET_CREATE" }),
    []
  );

  return {
    form,
    // Setters individuais (compatíveis com uso atual no componente)
    setUnit,
    setAgeBand,
    setCustomAgeBand,
    setClassId,
    setName,
    setCollegeCourse,
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
    setEditingId,
    setEditingCreatedAt,
    setOpenCreateSection,
    setOpenEditSection,
    setStudentFormError,
    setStudentDocumentsError,
    setEditSnapshot,
    resetForm,
    resetCreateForm,
  };
}
