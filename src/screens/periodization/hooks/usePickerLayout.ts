import { useReducer, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Layout = { x: number; y: number; width: number; height: number };

export type PickerLayoutState = {
  showUnitPicker: boolean;
  showClassPicker: boolean;
  showMesoPicker: boolean;
  showMicroPicker: boolean;
  classPickerTop: number;
  unitPickerTop: number;
  classTriggerLayout: Layout | null;
  unitTriggerLayout: Layout | null;
  mesoTriggerLayout: Layout | null;
  microTriggerLayout: Layout | null;
  containerWindow: { x: number; y: number } | null;
};

type SetFieldAction = {
  type: "SET_FIELD";
  field: keyof PickerLayoutState;
  value: PickerLayoutState[keyof PickerLayoutState];
};

type CloseAllAction = { type: "CLOSE_ALL" };

type TogglePickerAction = {
  type: "TOGGLE_PICKER";
  target: "unit" | "class" | "meso" | "micro";
};

type Action = SetFieldAction | CloseAllAction | TogglePickerAction;

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const INITIAL_STATE: PickerLayoutState = {
  showUnitPicker: false,
  showClassPicker: false,
  showMesoPicker: false,
  showMicroPicker: false,
  classPickerTop: 0,
  unitPickerTop: 0,
  classTriggerLayout: null,
  unitTriggerLayout: null,
  mesoTriggerLayout: null,
  microTriggerLayout: null,
  containerWindow: null,
};

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function pickerLayoutReducer(state: PickerLayoutState, action: Action): PickerLayoutState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "CLOSE_ALL":
      return {
        ...state,
        showUnitPicker: false,
        showClassPicker: false,
        showMesoPicker: false,
        showMicroPicker: false,
      };
    case "TOGGLE_PICKER":
      return {
        ...state,
        showUnitPicker: action.target === "unit" ? !state.showUnitPicker : false,
        showClassPicker: action.target === "class" ? !state.showClassPicker : false,
        showMesoPicker: action.target === "meso" ? !state.showMesoPicker : false,
        showMicroPicker: action.target === "micro" ? !state.showMicroPicker : false,
      };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePickerLayout() {
  const [pickers, dispatch] = useReducer(pickerLayoutReducer, INITIAL_STATE);

  const setShowUnitPicker = useCallback(
    (v: boolean) => dispatch({ type: "SET_FIELD", field: "showUnitPicker", value: v }),
    []
  );
  const setShowClassPicker = useCallback(
    (v: boolean) => dispatch({ type: "SET_FIELD", field: "showClassPicker", value: v }),
    []
  );
  const setShowMesoPicker = useCallback(
    (v: boolean) => dispatch({ type: "SET_FIELD", field: "showMesoPicker", value: v }),
    []
  );
  const setShowMicroPicker = useCallback(
    (v: boolean) => dispatch({ type: "SET_FIELD", field: "showMicroPicker", value: v }),
    []
  );
  const setClassPickerTop = useCallback(
    (v: number) => dispatch({ type: "SET_FIELD", field: "classPickerTop", value: v }),
    []
  );
  const setUnitPickerTop = useCallback(
    (v: number) => dispatch({ type: "SET_FIELD", field: "unitPickerTop", value: v }),
    []
  );
  const setClassTriggerLayout = useCallback(
    (v: Layout | null) => dispatch({ type: "SET_FIELD", field: "classTriggerLayout", value: v }),
    []
  );
  const setUnitTriggerLayout = useCallback(
    (v: Layout | null) => dispatch({ type: "SET_FIELD", field: "unitTriggerLayout", value: v }),
    []
  );
  const setMesoTriggerLayout = useCallback(
    (v: Layout | null) => dispatch({ type: "SET_FIELD", field: "mesoTriggerLayout", value: v }),
    []
  );
  const setMicroTriggerLayout = useCallback(
    (v: Layout | null) => dispatch({ type: "SET_FIELD", field: "microTriggerLayout", value: v }),
    []
  );
  const setContainerWindow = useCallback(
    (v: { x: number; y: number } | null) =>
      dispatch({ type: "SET_FIELD", field: "containerWindow", value: v }),
    []
  );
  const closeAllPickers = useCallback(() => dispatch({ type: "CLOSE_ALL" }), []);
  const togglePicker = useCallback(
    (target: "unit" | "class" | "meso" | "micro") =>
      dispatch({ type: "TOGGLE_PICKER", target }),
    []
  );

  const isPickerOpen =
    pickers.showUnitPicker ||
    pickers.showClassPicker ||
    pickers.showMesoPicker ||
    pickers.showMicroPicker;

  return {
    pickers,
    isPickerOpen,
    setShowUnitPicker,
    setShowClassPicker,
    setShowMesoPicker,
    setShowMicroPicker,
    setClassPickerTop,
    setUnitPickerTop,
    setClassTriggerLayout,
    setUnitTriggerLayout,
    setMesoTriggerLayout,
    setMicroTriggerLayout,
    setContainerWindow,
    closeAllPickers,
    togglePicker,
  };
}
