import { repairReceptionMiddleIdentity } from '../../core/court-reception-middle-identity';
import { replaceReceptionRotationSequence } from '../../core/court-simulation-sequence';
import { useCallback, useMemo, useState } from 'react';
import type { CourtVisualPayload } from '../../core/visual-court';
import type { useCourtEditor } from './useCourtEditor';

const noop = () => {};
/** Presentation state only: no queries, drafts, persistence or mutable history. */
export function useCourtReadOnlyController(source: CourtVisualPayload): ReturnType<typeof useCourtEditor> {
  const payload = useMemo(() => repairReceptionMiddleIdentity(replaceReceptionRotationSequence(source).payload), [source]);
  const [index, setIndex] = useState(0);
  const stepIndex = Math.min(index, payload.timeline.steps.length - 1);
  const selectStep = useCallback((value: number) => setIndex(Math.max(0, Math.min(payload.timeline.steps.length - 1, value))), [payload]);
  return useMemo(() => ({
    payload, stepIndex, cls: null, roster: [], documents: [], trashedIds: [], activeDocumentId: null,
    loading: false, opening: false, saving: false, departing: false, error: '', notice: '', dirty: false,
    needsSync: false, canSave: false, draftStatus: '', draftError: '', canUndo: false, canRedo: false,
    commit: noop, selectStep, undo: noop, redo: noop, setError: noop, setNotice: noop,
    open: async () => false, save: async () => false, preserveDraft: async () => false,
    leaveWithDraft: async () => false, setDocumentTrashed: async () => {},
  }), [payload, stepIndex, selectStep]);
}
