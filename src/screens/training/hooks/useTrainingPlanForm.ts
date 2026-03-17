import { useReducer, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TrainingPlanFormState = {
  title: string;
  tagsText: string;
  warmup: string;
  main: string;
  cooldown: string;
  warmupTime: string;
  mainTime: string;
  cooldownTime: string;
  editingId: string | null;
  editingCreatedAt: string | null;
  formUnit: string;
};

type SetFieldAction = {
  type: "SET_FIELD";
  field: keyof TrainingPlanFormState;
  value: TrainingPlanFormState[keyof TrainingPlanFormState];
};

type ResetAction = { type: "RESET" };

type Action = SetFieldAction | ResetAction;

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const INITIAL_STATE: TrainingPlanFormState = {
  title: "",
  tagsText: "",
  warmup: "",
  main: "",
  cooldown: "",
  warmupTime: "",
  mainTime: "",
  cooldownTime: "",
  editingId: null,
  editingCreatedAt: null,
  formUnit: "",
};

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function trainingPlanFormReducer(
  state: TrainingPlanFormState,
  action: Action
): TrainingPlanFormState {
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

export function useTrainingPlanForm() {
  const [planForm, dispatch] = useReducer(trainingPlanFormReducer, INITIAL_STATE);

  const setTitle = useCallback(
    (v: string) => dispatch({ type: "SET_FIELD", field: "title", value: v }),
    []
  );
  const setTagsText = useCallback(
    (v: string) => dispatch({ type: "SET_FIELD", field: "tagsText", value: v }),
    []
  );
  const setWarmup = useCallback(
    (v: string) => dispatch({ type: "SET_FIELD", field: "warmup", value: v }),
    []
  );
  const setMain = useCallback(
    (v: string) => dispatch({ type: "SET_FIELD", field: "main", value: v }),
    []
  );
  const setCooldown = useCallback(
    (v: string) => dispatch({ type: "SET_FIELD", field: "cooldown", value: v }),
    []
  );
  const setWarmupTime = useCallback(
    (v: string) => dispatch({ type: "SET_FIELD", field: "warmupTime", value: v }),
    []
  );
  const setMainTime = useCallback(
    (v: string) => dispatch({ type: "SET_FIELD", field: "mainTime", value: v }),
    []
  );
  const setCooldownTime = useCallback(
    (v: string) => dispatch({ type: "SET_FIELD", field: "cooldownTime", value: v }),
    []
  );
  const setEditingId = useCallback(
    (v: string | null) => dispatch({ type: "SET_FIELD", field: "editingId", value: v }),
    []
  );
  const setEditingCreatedAt = useCallback(
    (v: string | null) => dispatch({ type: "SET_FIELD", field: "editingCreatedAt", value: v }),
    []
  );
  const setFormUnit = useCallback(
    (v: string) => dispatch({ type: "SET_FIELD", field: "formUnit", value: v }),
    []
  );
  const resetPlanForm = useCallback(() => dispatch({ type: "RESET" }), []);

  return {
    planForm,
    setTitle,
    setTagsText,
    setWarmup,
    setMain,
    setCooldown,
    setWarmupTime,
    setMainTime,
    setCooldownTime,
    setEditingId,
    setEditingCreatedAt,
    setFormUnit,
    resetPlanForm,
  };
}
