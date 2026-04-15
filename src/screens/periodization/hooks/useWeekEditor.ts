import { useCallback, useReducer } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WeekEditorState = {
  editingWeek: number;
  editingPlanId: string | null;
  editPhase: string;
  editTheme: string;
  editTechnicalFocus: string;
  editPhysicalFocus: string;
  editConstraints: string;
  editMvFormat: string;
  editWarmupProfile: string;
  editJumpTarget: string;
  editPSETarget: string;
  editSource: "AUTO" | "MANUAL";
  isSavingWeek: boolean;
};

type SetFieldAction = {
  type: "SET_FIELD";
  field: keyof WeekEditorState;
  value: WeekEditorState[keyof WeekEditorState];
};

type ResetAction = { type: "RESET" };

type Action = SetFieldAction | ResetAction;

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const INITIAL_STATE: WeekEditorState = {
  editingWeek: 1,
  editingPlanId: null,
  editPhase: "",
  editTheme: "",
  editTechnicalFocus: "",
  editPhysicalFocus: "",
  editConstraints: "",
  editMvFormat: "",
  editWarmupProfile: "",
  editJumpTarget: "",
  editPSETarget: "",
  editSource: "AUTO",
  isSavingWeek: false,
};

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function weekEditorReducer(state: WeekEditorState, action: Action): WeekEditorState {
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

export function useWeekEditor() {
  const [editor, dispatch] = useReducer(weekEditorReducer, INITIAL_STATE);

  const setEditingWeek = useCallback(
    (v: number) => dispatch({ type: "SET_FIELD", field: "editingWeek", value: v }),
    []
  );
  const setEditingPlanId = useCallback(
    (v: string | null) => dispatch({ type: "SET_FIELD", field: "editingPlanId", value: v }),
    []
  );
  const setEditPhase = useCallback(
    (v: string) => dispatch({ type: "SET_FIELD", field: "editPhase", value: v }),
    []
  );
  const setEditTheme = useCallback(
    (v: string) => dispatch({ type: "SET_FIELD", field: "editTheme", value: v }),
    []
  );
  const setEditTechnicalFocus = useCallback(
    (v: string) => dispatch({ type: "SET_FIELD", field: "editTechnicalFocus", value: v }),
    []
  );
  const setEditPhysicalFocus = useCallback(
    (v: string) => dispatch({ type: "SET_FIELD", field: "editPhysicalFocus", value: v }),
    []
  );
  const setEditConstraints = useCallback(
    (v: string) => dispatch({ type: "SET_FIELD", field: "editConstraints", value: v }),
    []
  );
  const setEditMvFormat = useCallback(
    (v: string) => dispatch({ type: "SET_FIELD", field: "editMvFormat", value: v }),
    []
  );
  const setEditWarmupProfile = useCallback(
    (v: string) => dispatch({ type: "SET_FIELD", field: "editWarmupProfile", value: v }),
    []
  );
  const setEditJumpTarget = useCallback(
    (v: string) => dispatch({ type: "SET_FIELD", field: "editJumpTarget", value: v }),
    []
  );
  const setEditPSETarget = useCallback(
    (v: string) => dispatch({ type: "SET_FIELD", field: "editPSETarget", value: v }),
    []
  );
  const setEditSource = useCallback(
    (v: "AUTO" | "MANUAL") => dispatch({ type: "SET_FIELD", field: "editSource", value: v }),
    []
  );
  const setIsSavingWeek = useCallback(
    (v: boolean) => dispatch({ type: "SET_FIELD", field: "isSavingWeek", value: v }),
    []
  );
  const resetWeekEditor = useCallback(() => dispatch({ type: "RESET" }), []);

  return {
    editor,
    setEditingWeek,
    setEditingPlanId,
    setEditPhase,
    setEditTheme,
    setEditTechnicalFocus,
    setEditPhysicalFocus,
    setEditConstraints,
    setEditMvFormat,
    setEditWarmupProfile,
    setEditJumpTarget,
    setEditPSETarget,
    setEditSource,
    setIsSavingWeek,
    resetWeekEditor,
  };
}
