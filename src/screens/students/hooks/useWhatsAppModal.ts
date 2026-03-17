import { useReducer, useCallback } from "react";
import type { WhatsAppTemplateId } from "../../../utils/whatsapp-templates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Layout = { x: number; y: number; width: number; height: number };

export type WhatsAppModalState = {
  showWhatsAppModal: boolean;
  whatsappNotice: string;
  showRevokeConfirm: boolean;
  selectedStudentId: string | null;
  selectedContactType: "guardian" | "student";
  selectedTemplateId: WhatsAppTemplateId | null;
  selectedTemplateLabel: string | null;
  customFields: Record<string, string>;
  customStudentMessage: string;
  showTemplateList: boolean;
  whatsappContainerWindow: { x: number; y: number } | null;
  templateTriggerLayout: Layout | null;
};

type SetFieldAction = {
  type: "SET_FIELD";
  field: keyof WhatsAppModalState;
  value: WhatsAppModalState[keyof WhatsAppModalState];
};

type ResetAction = { type: "RESET" };

type Action = SetFieldAction | ResetAction;

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const INITIAL_STATE: WhatsAppModalState = {
  showWhatsAppModal: false,
  whatsappNotice: "",
  showRevokeConfirm: false,
  selectedStudentId: null,
  selectedContactType: "guardian",
  selectedTemplateId: null,
  selectedTemplateLabel: null,
  customFields: {},
  customStudentMessage: "",
  showTemplateList: false,
  whatsappContainerWindow: null,
  templateTriggerLayout: null,
};

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function whatsAppModalReducer(
  state: WhatsAppModalState,
  action: Action
): WhatsAppModalState {
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

export function useWhatsAppModal() {
  const [waModal, dispatch] = useReducer(whatsAppModalReducer, INITIAL_STATE);

  const setShowWhatsAppModal = useCallback(
    (v: boolean) =>
      dispatch({ type: "SET_FIELD", field: "showWhatsAppModal", value: v }),
    []
  );
  const setWhatsappNotice = useCallback(
    (v: string) =>
      dispatch({ type: "SET_FIELD", field: "whatsappNotice", value: v }),
    []
  );
  const setShowRevokeConfirm = useCallback(
    (v: boolean) =>
      dispatch({ type: "SET_FIELD", field: "showRevokeConfirm", value: v }),
    []
  );
  const setSelectedStudentId = useCallback(
    (v: string | null) =>
      dispatch({ type: "SET_FIELD", field: "selectedStudentId", value: v }),
    []
  );
  const setSelectedContactType = useCallback(
    (v: "guardian" | "student") =>
      dispatch({ type: "SET_FIELD", field: "selectedContactType", value: v }),
    []
  );
  const setSelectedTemplateId = useCallback(
    (v: WhatsAppTemplateId | null) =>
      dispatch({ type: "SET_FIELD", field: "selectedTemplateId", value: v }),
    []
  );
  const setSelectedTemplateLabel = useCallback(
    (v: string | null) =>
      dispatch({
        type: "SET_FIELD",
        field: "selectedTemplateLabel",
        value: v,
      }),
    []
  );
  const setCustomFields = useCallback(
    (v: Record<string, string>) =>
      dispatch({ type: "SET_FIELD", field: "customFields", value: v }),
    []
  );
  const setCustomStudentMessage = useCallback(
    (v: string) =>
      dispatch({
        type: "SET_FIELD",
        field: "customStudentMessage",
        value: v,
      }),
    []
  );
  const setShowTemplateList = useCallback(
    (v: boolean) =>
      dispatch({ type: "SET_FIELD", field: "showTemplateList", value: v }),
    []
  );
  const setWhatsappContainerWindow = useCallback(
    (v: { x: number; y: number } | null) =>
      dispatch({
        type: "SET_FIELD",
        field: "whatsappContainerWindow",
        value: v,
      }),
    []
  );
  const setTemplateTriggerLayout = useCallback(
    (v: Layout | null) =>
      dispatch({
        type: "SET_FIELD",
        field: "templateTriggerLayout",
        value: v,
      }),
    []
  );
  const resetWhatsAppModal = useCallback(() => dispatch({ type: "RESET" }), []);

  return {
    waModal,
    setShowWhatsAppModal,
    setWhatsappNotice,
    setShowRevokeConfirm,
    setSelectedStudentId,
    setSelectedContactType,
    setSelectedTemplateId,
    setSelectedTemplateLabel,
    setCustomFields,
    setCustomStudentMessage,
    setShowTemplateList,
    setWhatsappContainerWindow,
    setTemplateTriggerLayout,
    resetWhatsAppModal,
  };
}
