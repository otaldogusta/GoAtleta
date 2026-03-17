import { useReducer, useCallback } from "react";
import type { StudentPreRegistration } from "../../../core/models";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PreRegistrationFormState = {
  editingPreId: string | null;
  preChildName: string;
  preGuardianName: string;
  preGuardianPhone: string;
  preClassInterest: string;
  preUnitInterest: string;
  preTrialDate: string;
  preNotes: string;
  preStatus: StudentPreRegistration["status"];
  preRegistrationError: string;
  preRegistrationSearch: string;
};

type SetFieldAction = {
  type: "SET_FIELD";
  field: keyof PreRegistrationFormState;
  value: PreRegistrationFormState[keyof PreRegistrationFormState];
};

type ResetAction = { type: "RESET" };

type Action = SetFieldAction | ResetAction;

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const INITIAL_STATE: PreRegistrationFormState = {
  editingPreId: null,
  preChildName: "",
  preGuardianName: "",
  preGuardianPhone: "",
  preClassInterest: "",
  preUnitInterest: "",
  preTrialDate: "",
  preNotes: "",
  preStatus: "lead",
  preRegistrationError: "",
  preRegistrationSearch: "",
};

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function preRegistrationReducer(
  state: PreRegistrationFormState,
  action: Action
): PreRegistrationFormState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "RESET":
      return {
        ...INITIAL_STATE,
        preRegistrationSearch: state.preRegistrationSearch,
      };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePreRegistrationForm() {
  const [preForm, dispatch] = useReducer(preRegistrationReducer, INITIAL_STATE);

  const setEditingPreId = useCallback(
    (v: string | null) =>
      dispatch({ type: "SET_FIELD", field: "editingPreId", value: v }),
    []
  );
  const setPreChildName = useCallback(
    (v: string) =>
      dispatch({ type: "SET_FIELD", field: "preChildName", value: v }),
    []
  );
  const setPreGuardianName = useCallback(
    (v: string) =>
      dispatch({ type: "SET_FIELD", field: "preGuardianName", value: v }),
    []
  );
  const setPreGuardianPhone = useCallback(
    (v: string) =>
      dispatch({ type: "SET_FIELD", field: "preGuardianPhone", value: v }),
    []
  );
  const setPreClassInterest = useCallback(
    (v: string) =>
      dispatch({ type: "SET_FIELD", field: "preClassInterest", value: v }),
    []
  );
  const setPreUnitInterest = useCallback(
    (v: string) =>
      dispatch({ type: "SET_FIELD", field: "preUnitInterest", value: v }),
    []
  );
  const setPreTrialDate = useCallback(
    (v: string) =>
      dispatch({ type: "SET_FIELD", field: "preTrialDate", value: v }),
    []
  );
  const setPreNotes = useCallback(
    (v: string) =>
      dispatch({ type: "SET_FIELD", field: "preNotes", value: v }),
    []
  );
  const setPreStatus = useCallback(
    (v: StudentPreRegistration["status"]) =>
      dispatch({ type: "SET_FIELD", field: "preStatus", value: v }),
    []
  );
  const setPreRegistrationError = useCallback(
    (v: string) =>
      dispatch({ type: "SET_FIELD", field: "preRegistrationError", value: v }),
    []
  );
  const setPreRegistrationSearch = useCallback(
    (v: string) =>
      dispatch({ type: "SET_FIELD", field: "preRegistrationSearch", value: v }),
    []
  );
  const resetPreRegistrationForm = useCallback(
    () => dispatch({ type: "RESET" }),
    []
  );

  return {
    preForm,
    setEditingPreId,
    setPreChildName,
    setPreGuardianName,
    setPreGuardianPhone,
    setPreClassInterest,
    setPreUnitInterest,
    setPreTrialDate,
    setPreNotes,
    setPreStatus,
    setPreRegistrationError,
    setPreRegistrationSearch,
    resetPreRegistrationForm,
  };
}
