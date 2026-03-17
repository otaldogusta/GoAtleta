import { useReducer, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AcwrState = {
  acwrRatio: number | null;
  acwrMessage: string;
  acwrLimitError: string;
  acwrLimits: { high: string; low: string };
  painAlert: string;
  painAlertDates: string[];
};

type SetFieldAction = {
  type: "SET_FIELD";
  field: keyof AcwrState;
  value: AcwrState[keyof AcwrState];
};

type ResetAction = { type: "RESET" };

type Action = SetFieldAction | ResetAction;

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const INITIAL_STATE: AcwrState = {
  acwrRatio: null,
  acwrMessage: "",
  acwrLimitError: "",
  acwrLimits: { high: "1.3", low: "0.8" },
  painAlert: "",
  painAlertDates: [],
};

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function acwrReducer(state: AcwrState, action: Action): AcwrState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "RESET":
      return INITIAL_STATE;
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAcwrState() {
  const [acwr, dispatch] = useReducer(acwrReducer, INITIAL_STATE);

  const setAcwrRatio = useCallback(
    (v: number | null) => dispatch({ type: "SET_FIELD", field: "acwrRatio", value: v }),
    []
  );
  const setAcwrMessage = useCallback(
    (v: string) => dispatch({ type: "SET_FIELD", field: "acwrMessage", value: v }),
    []
  );
  const setAcwrLimitError = useCallback(
    (v: string) => dispatch({ type: "SET_FIELD", field: "acwrLimitError", value: v }),
    []
  );
  const setAcwrLimits = useCallback(
    (v: { high: string; low: string }) =>
      dispatch({ type: "SET_FIELD", field: "acwrLimits", value: v }),
    []
  );
  const setPainAlert = useCallback(
    (v: string) => dispatch({ type: "SET_FIELD", field: "painAlert", value: v }),
    []
  );
  const setPainAlertDates = useCallback(
    (v: string[]) => dispatch({ type: "SET_FIELD", field: "painAlertDates", value: v }),
    []
  );
  const resetAcwr = useCallback(() => dispatch({ type: "RESET" }), []);

  return {
    acwr,
    setAcwrRatio,
    setAcwrMessage,
    setAcwrLimitError,
    setAcwrLimits,
    setPainAlert,
    setPainAlertDates,
    resetAcwr,
  };
}
