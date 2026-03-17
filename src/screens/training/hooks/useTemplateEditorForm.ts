import { useReducer, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TemplateEditorFormState = {
  templateTitle: string;
  templateAge: string;
  templateTags: string;
  templateWarmup: string;
  templateMain: string;
  templateCooldown: string;
  templateWarmupTime: string;
  templateMainTime: string;
  templateCooldownTime: string;
  templateEditorId: string | null;
  templateEditorCreatedAt: string | null;
  templateEditorSource: "built" | "custom";
  templateEditorTemplateId: string | null;
  templateEditorComposerHeight: number;
  templateEditorKeyboardHeight: number;
  renameTemplateId: string | null;
  renameTemplateText: string;
  showTemplateEditor: boolean;
  showTemplateCloseConfirm: boolean;
};

type SetFieldAction = {
  type: "SET_FIELD";
  field: keyof TemplateEditorFormState;
  value: TemplateEditorFormState[keyof TemplateEditorFormState];
};

type ResetAction = { type: "RESET" };

type Action = SetFieldAction | ResetAction;

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const INITIAL_STATE: TemplateEditorFormState = {
  templateTitle: "",
  templateAge: "",
  templateTags: "",
  templateWarmup: "",
  templateMain: "",
  templateCooldown: "",
  templateWarmupTime: "",
  templateMainTime: "",
  templateCooldownTime: "",
  templateEditorId: null,
  templateEditorCreatedAt: null,
  templateEditorSource: "custom",
  templateEditorTemplateId: null,
  templateEditorComposerHeight: 0,
  templateEditorKeyboardHeight: 0,
  renameTemplateId: null,
  renameTemplateText: "",
  showTemplateEditor: false,
  showTemplateCloseConfirm: false,
};

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function templateEditorFormReducer(
  state: TemplateEditorFormState,
  action: Action
): TemplateEditorFormState {
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

export function useTemplateEditorForm() {
  const [templateForm, dispatch] = useReducer(templateEditorFormReducer, INITIAL_STATE);

  const setTemplateTitle = useCallback(
    (v: string) => dispatch({ type: "SET_FIELD", field: "templateTitle", value: v }),
    []
  );
  const setTemplateAge = useCallback(
    (v: string) => dispatch({ type: "SET_FIELD", field: "templateAge", value: v }),
    []
  );
  const setTemplateTags = useCallback(
    (v: string) => dispatch({ type: "SET_FIELD", field: "templateTags", value: v }),
    []
  );
  const setTemplateWarmup = useCallback(
    (v: string) => dispatch({ type: "SET_FIELD", field: "templateWarmup", value: v }),
    []
  );
  const setTemplateMain = useCallback(
    (v: string) => dispatch({ type: "SET_FIELD", field: "templateMain", value: v }),
    []
  );
  const setTemplateCooldown = useCallback(
    (v: string) => dispatch({ type: "SET_FIELD", field: "templateCooldown", value: v }),
    []
  );
  const setTemplateWarmupTime = useCallback(
    (v: string) => dispatch({ type: "SET_FIELD", field: "templateWarmupTime", value: v }),
    []
  );
  const setTemplateMainTime = useCallback(
    (v: string) => dispatch({ type: "SET_FIELD", field: "templateMainTime", value: v }),
    []
  );
  const setTemplateCooldownTime = useCallback(
    (v: string) => dispatch({ type: "SET_FIELD", field: "templateCooldownTime", value: v }),
    []
  );
  const setTemplateEditorId = useCallback(
    (v: string | null) => dispatch({ type: "SET_FIELD", field: "templateEditorId", value: v }),
    []
  );
  const setTemplateEditorCreatedAt = useCallback(
    (v: string | null) =>
      dispatch({ type: "SET_FIELD", field: "templateEditorCreatedAt", value: v }),
    []
  );
  const setTemplateEditorSource = useCallback(
    (v: "built" | "custom") =>
      dispatch({ type: "SET_FIELD", field: "templateEditorSource", value: v }),
    []
  );
  const setTemplateEditorTemplateId = useCallback(
    (v: string | null) =>
      dispatch({ type: "SET_FIELD", field: "templateEditorTemplateId", value: v }),
    []
  );
  const setTemplateEditorComposerHeight = useCallback(
    (v: number) =>
      dispatch({ type: "SET_FIELD", field: "templateEditorComposerHeight", value: v }),
    []
  );
  const setTemplateEditorKeyboardHeight = useCallback(
    (v: number) =>
      dispatch({ type: "SET_FIELD", field: "templateEditorKeyboardHeight", value: v }),
    []
  );
  const setRenameTemplateId = useCallback(
    (v: string | null) => dispatch({ type: "SET_FIELD", field: "renameTemplateId", value: v }),
    []
  );
  const setRenameTemplateText = useCallback(
    (v: string) => dispatch({ type: "SET_FIELD", field: "renameTemplateText", value: v }),
    []
  );
  const setShowTemplateEditor = useCallback(
    (v: boolean) => dispatch({ type: "SET_FIELD", field: "showTemplateEditor", value: v }),
    []
  );
  const setShowTemplateCloseConfirm = useCallback(
    (v: boolean) => dispatch({ type: "SET_FIELD", field: "showTemplateCloseConfirm", value: v }),
    []
  );
  const resetTemplateForm = useCallback(() => dispatch({ type: "RESET" }), []);

  return {
    templateForm,
    setTemplateTitle,
    setTemplateAge,
    setTemplateTags,
    setTemplateWarmup,
    setTemplateMain,
    setTemplateCooldown,
    setTemplateWarmupTime,
    setTemplateMainTime,
    setTemplateCooldownTime,
    setTemplateEditorId,
    setTemplateEditorCreatedAt,
    setTemplateEditorSource,
    setTemplateEditorTemplateId,
    setTemplateEditorComposerHeight,
    setTemplateEditorKeyboardHeight,
    setRenameTemplateId,
    setRenameTemplateText,
    setShowTemplateEditor,
    setShowTemplateCloseConfirm,
    resetTemplateForm,
  };
}
