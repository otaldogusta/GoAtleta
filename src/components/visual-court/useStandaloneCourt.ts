import { useState } from "react";
import { buildSimulatedReceptionRotationPreset } from "../../core/court-simulation-sequence";
import type { EditorSnapshot } from "../../core/visual-court-editor";
import type { useCourtEditor } from "./useCourtEditor";

type History = { present: EditorSnapshot; past: EditorSnapshot[]; future: EditorSnapshot[] };
const start = (payload = buildSimulatedReceptionRotationPreset()): History => ({ present: { payload, stepIndex: 0 }, past: [], future: [] });
const noop = () => {};
const unavailable = async () => false;
const clampStep = (index: number, count: number) => Math.max(0, Math.min(index, count - 1));

/** Session state for the professor's independent court. No class or storage is loaded. */
export function useStandaloneCourt(): ReturnType<typeof useCourtEditor> {
  const [history, setHistory] = useState(() => start());
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  return {
    ...history.present,
    cls: null, roster: [], documents: [], trashedIds: [], activeDocumentId: null,
    loading: false, opening: false, saving: false, departing: false, dirty: false, needsSync: false, canSave: false,
    error, notice, draftStatus: "", draftError: "", autosaveStatus: "idle", autosaveError: "", retryAutosave: noop,
    canUndo: history.past.length > 0, canRedo: history.future.length > 0, setError, setNotice,
    commit: (update, stepIndex) => setHistory(current => {
      const payload = update(current.present.payload);
      if (payload === current.present.payload && stepIndex === undefined) return current;
      return {
        present: { payload, stepIndex: clampStep(stepIndex ?? current.present.stepIndex, payload.timeline.steps.length) },
        past: [...current.past.slice(-79), current.present], future: [],
      };
    }),
    selectStep: index => setHistory(current => ({ ...current, present: { ...current.present, stepIndex: clampStep(index, current.present.payload.timeline.steps.length) } })),
    undo: () => setHistory(current => current.past.length ? {
      present: current.past[current.past.length - 1], past: current.past.slice(0, -1), future: [current.present, ...current.future],
    } : current),
    redo: () => setHistory(current => current.future.length ? {
      present: current.future[0], past: [...current.past, current.present], future: current.future.slice(1),
    } : current),
    open: async payload => { setHistory(start(payload)); return true; },
    save: unavailable, preserveDraft: unavailable, leaveWithDraft: async onLeave => { onLeave(); return true; },
    setDocumentTrashed: async () => {},
  };
}
