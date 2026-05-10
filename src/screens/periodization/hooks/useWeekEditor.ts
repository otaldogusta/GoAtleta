import { useCallback, useReducer } from "react";
import type { SessionEnvironment } from "../../../core/models";
import type {
  SessionEnvironmentDecisions,
  SessionTrainingContextDecisions,
  SessionTrainingContextSelection,
} from "../application/session-environment-decisions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WeekEditorState = {
  editingWeek: number;
  editingWeekDisplayNumber: number;
  editingPlanId: string | null;
  editPhase: string;
  editTheme: string;
  editPedagogicalRule: string;
  editTechnicalFocus: string;
  editPhysicalFocus: string;
  editConstraints: string;
  editMvFormat: string;
  editWarmupProfile: string;
  editJumpTarget: string;
  editPSETarget: string;
  editSessionEnvironments: SessionEnvironmentDecisions;
  editSessionTrainingContexts: SessionTrainingContextDecisions;
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
  editingWeekDisplayNumber: 1,
  editingPlanId: null,
  editPhase: "",
  editTheme: "",
  editPedagogicalRule: "",
  editTechnicalFocus: "",
  editPhysicalFocus: "",
  editConstraints: "",
  editMvFormat: "",
  editWarmupProfile: "",
  editJumpTarget: "",
  editPSETarget: "",
  editSessionEnvironments: {},
  editSessionTrainingContexts: {},
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
  const setEditingWeekDisplayNumber = useCallback(
    (v: number) =>
      dispatch({ type: "SET_FIELD", field: "editingWeekDisplayNumber", value: v }),
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
  const setEditPedagogicalRule = useCallback(
    (v: string) => dispatch({ type: "SET_FIELD", field: "editPedagogicalRule", value: v }),
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
  const setEditSessionEnvironments = useCallback(
    (v: SessionEnvironmentDecisions) =>
      dispatch({ type: "SET_FIELD", field: "editSessionEnvironments", value: v }),
    []
  );
  const setEditSessionTrainingContexts = useCallback(
    (v: SessionTrainingContextDecisions) =>
      dispatch({ type: "SET_FIELD", field: "editSessionTrainingContexts", value: v }),
    []
  );
  const setEditSessionEnvironment = useCallback(
    (sessionIndex: number, value: SessionEnvironment) =>
      dispatch({
        type: "SET_FIELD",
        field: "editSessionEnvironments",
        value: {
          ...editor.editSessionEnvironments,
          [sessionIndex]: value,
        },
      }),
    [editor.editSessionEnvironments]
  );
  const setEditSessionTrainingContext = useCallback(
    (sessionIndex: number, value: SessionTrainingContextSelection) =>
      dispatch({
        type: "SET_FIELD",
        field: "editSessionTrainingContexts",
        value: {
          ...editor.editSessionTrainingContexts,
          [sessionIndex]: value,
        },
      }),
    [editor.editSessionTrainingContexts]
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
    setEditingWeekDisplayNumber,
    setEditingPlanId,
    setEditPhase,
    setEditTheme,
    setEditPedagogicalRule,
    setEditTechnicalFocus,
    setEditPhysicalFocus,
    setEditConstraints,
    setEditMvFormat,
    setEditWarmupProfile,
    setEditJumpTarget,
    setEditPSETarget,
    setEditSessionEnvironments,
    setEditSessionTrainingContexts,
    setEditSessionEnvironment,
    setEditSessionTrainingContext,
    setEditSource,
    setIsSavingWeek,
    resetWeekEditor,
  };
}
