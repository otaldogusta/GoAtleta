import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenPageHeader } from "../../../src/components/ui/ScreenPageHeader";
import { VisualCourtCanvas } from "../../../src/components/visual-court/VisualCourtCanvas";
import { VisualCourtTimelineControls } from "../../../src/components/visual-court/VisualCourtTimelineControls";
import type { ClassGroup } from "../../../src/core/models";
import {
  addCourtVisualActorFromLegend,
  build5x1ServingPreset,
  buildDefenseBase6BackPreset,
  buildDidacticRotationGridPreset,
  buildRotation5x1Preset,
  deleteCourtVisualStepActor,
  duplicateCourtVisualStepActor,
  ensureCourtVisualPayloadBaselines,
  getNextStepIndex,
  getPreviousStepIndex,
  getCourtVisualStepAlignmentPositions,
  getStepAtIndex,
  normalizeCourtPayload,
  normalizeDefenseBase6BackPayload,
  resetCourtVisualStepAnimations,
  syncCourtVisualPairedTrajectories,
  type CourtVisualDocument,
  type CourtVisualLegendActorLabel,
  type CourtPoint,
  type CourtVisualPayload,
  updateCourtVisualStepActorPosition,
  updateCourtVisualStepActorStaticPosition,
} from "../../../src/core/visual-court";
import {
  ensureDefaultVisualPresets,
  getClassById,
  saveTechnicalVisual,
} from "../../../src/db/seed";
import { navigateBackOrReplace } from "../../../src/navigation/safe-router";
import { Button } from "../../../src/ui/Button";
import { Pressable } from "../../../src/ui/Pressable";
import { useAppTheme } from "../../../src/ui/app-theme";
import { GoAtletaIcon } from "../../../src/ui/icon-registry";
import { getSectionCardStyle } from "../../../src/ui/section-styles";

type VisualHistoryEntry = {
  payload: CourtVisualPayload;
  stepIndex: number;
};

const legendActorItems: Array<{
  color: string;
  label: CourtVisualLegendActorLabel;
}> = [
  { color: "#3DDC84", label: "Lv" },
  { color: "#22C55E", label: "Op" },
  { color: "#60A5FA", label: "P" },
  { color: "#8B5CF6", label: "C" },
  { color: "#A78BFA", label: "Lb" },
];

const getSaveablePayloadSignature = (payload: CourtVisualPayload) => {
  const normalized = normalizeCourtPayload(payload);
  return JSON.stringify({
    ...normalized,
    timeline: {
      steps: normalized.timeline.steps.map((step) => {
        const signatureStep = { ...step };
        delete signatureStep.baselineActorPositions;
        delete signatureStep.visibleLayerIds;
        return {
          ...signatureStep,
          actorPositions: getCourtVisualStepAlignmentPositions(normalized, step),
        };
      }),
    },
  });
};

const areSameCourtPoint = (
  left: CourtPoint | undefined,
  right: CourtPoint | undefined
) => {
  if (!left || !right) return false;
  return (
    Math.abs(left.x - right.x) <= 0.001 &&
    Math.abs(left.y - right.y) <= 0.001
  );
};

const getStepActorPoint = (
  payload: CourtVisualPayload,
  stepIndex: number,
  actorId: string
) => {
  const step = payload.timeline.steps[stepIndex];
  const actor = payload.actors.find((item) => item.id === actorId);
  return (
    step?.actorPositions[actorId] ??
    step?.baselineActorPositions?.[actorId] ??
    actor?.initialPosition
  );
};

const syncVisualDocument = (document: CourtVisualDocument): CourtVisualDocument => ({
  ...document,
  payload: syncCourtVisualPairedTrajectories(
    ensureCourtVisualPayloadBaselines(
      normalizeDefenseBase6BackPayload(document.payload)
    )
  ),
});

const getVisibleStepIndexes = (payload: CourtVisualPayload) =>
  payload.timeline.steps
    .map((step, index) => ({ step, index }))
    .filter(
      (item) =>
        item.step.phase !== "attack_shape" &&
        !(
          item.step.formationKind === "5x1_receive_3" &&
          item.step.phase === "receive_release"
        ) &&
        !(
          item.step.formationKind === "5x1_serving" &&
          item.step.phase === "serve_after_hit"
        )
    )
    .map((item) => item.index);

const getNextVisibleStepIndex = (
  payload: CourtVisualPayload,
  currentIndex: number
) => {
  const indexes = getVisibleStepIndexes(payload);
  if (!indexes.length) return getNextStepIndex(payload, currentIndex);
  const currentVisibleIndex = indexes.indexOf(currentIndex);
  if (currentVisibleIndex < 0) {
    return indexes.find((index) => index > currentIndex) ?? indexes[0];
  }
  return indexes[(currentVisibleIndex + 1) % indexes.length];
};

const getPreviousVisibleStepIndex = (
  payload: CourtVisualPayload,
  currentIndex: number
) => {
  const indexes = getVisibleStepIndexes(payload);
  if (!indexes.length) return getPreviousStepIndex(payload, currentIndex);
  const currentVisibleIndex = indexes.indexOf(currentIndex);
  if (currentVisibleIndex < 0) {
    return [...indexes].reverse().find((index) => index < currentIndex) ?? indexes[indexes.length - 1];
  }
  return indexes[(currentVisibleIndex - 1 + indexes.length) % indexes.length];
};

const getStepMovementCount = (payload: CourtVisualPayload, stepIndex: number) => {
  const step = getStepAtIndex(payload, stepIndex);
  return (step.trajectories ?? step.transitions)?.length ?? 0;
};

const getPlaybackAnimationStepIndex = (
  payload: CourtVisualPayload,
  currentIndex: number
) => {
  if (getStepMovementCount(payload, currentIndex) > 0) return currentIndex;

  const currentStep = getStepAtIndex(payload, currentIndex);
  if (
    currentStep.formationKind === "5x1_receive_3" &&
    currentStep.phase === "receive_legal"
  ) {
    return currentIndex;
  }

  const pairedPhase =
    currentStep.phase === "receive_legal"
      ? "receive_release"
      : currentStep.phase === "serve_base"
      ? "serve_after_hit"
      : null;
  if (!pairedPhase) return currentIndex;

  const pairedIndex = payload.timeline.steps.findIndex(
    (step, index) =>
      index !== currentIndex &&
      step.rotationIndex === currentStep.rotationIndex &&
      step.formationKind === currentStep.formationKind &&
      step.phase === pairedPhase &&
      getStepMovementCount(payload, index) > 0
  );

  return pairedIndex >= 0 ? pairedIndex : currentIndex;
};

const getPlaybackLandingStepIndex = (
  payload: CourtVisualPayload,
  currentIndex: number,
  animationStepIndex: number
) => {
  const currentStep = getStepAtIndex(payload, currentIndex);
  const animationStep = getStepAtIndex(payload, animationStepIndex);
  if (
    ((currentStep.formationKind === "5x1_receive_3" &&
      currentStep.phase === "receive_legal" &&
      animationStep.phase === "receive_release") ||
      (currentStep.formationKind === "5x1_serving" &&
        currentStep.phase === "serve_base" &&
        animationStep.phase === "serve_after_hit"))
  ) {
    return currentIndex;
  }
  return animationStepIndex;
};

const getInitialAnimationProgressForStep = (
  payload: CourtVisualPayload,
  stepIndex: number
) => {
  const animationStepIndex = getPlaybackAnimationStepIndex(payload, stepIndex);
  return getStepMovementCount(payload, animationStepIndex) > 0 ? 0 : undefined;
};

const buildLocalRotationDocument = (
  classId: string,
  organizationId?: string | null
): CourtVisualDocument => {
  const now = new Date().toISOString();
  return {
    id: "local_rotation_5x1",
    organizationId: organizationId ?? "",
    classId,
    sourceKind: "rotation",
    sourceId: "5x1_receive_3",
    title: "5x1 - Recepção",
    payload: buildRotation5x1Preset(),
    createdAt: now,
    updatedAt: now,
  };
};

const buildLocalServingDocument = (
  classId: string,
  organizationId?: string | null
): CourtVisualDocument => {
  const now = new Date().toISOString();
  return {
    id: "local_5x1_serving",
    organizationId: organizationId ?? "",
    classId,
    sourceKind: "rotation",
    sourceId: "5x1_serving",
    title: "5x1 base - equipe sacando",
    payload: build5x1ServingPreset(),
    createdAt: now,
    updatedAt: now,
  };
};

const buildLocalDefenseDocument = (
  classId: string,
  organizationId?: string | null
): CourtVisualDocument => {
  const now = new Date().toISOString();
  return {
    id: "local_defense_base_6_back",
    organizationId: organizationId ?? "",
    classId,
    sourceKind: "rotation",
    sourceId: "defense_base_6_back",
    title: "Defesa base — 6 fundo",
    payload: buildDefenseBase6BackPreset(),
    createdAt: now,
    updatedAt: now,
  };
};

const buildLocalDidacticDocument = (
  classId: string,
  organizationId?: string | null
): CourtVisualDocument => {
  const now = new Date().toISOString();
  return {
    id: "local_didactic_grid",
    organizationId: organizationId ?? "",
    classId,
    sourceKind: "free",
    sourceId: "didactic_grid",
    title: "Grade didática",
    payload: buildDidacticRotationGridPreset(),
    createdAt: now,
    updatedAt: now,
  };
};

export default function ClassVisualTechRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const classId = typeof id === "string" ? id : "";
  const router = useRouter();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [cls, setCls] = useState<ClassGroup | null>(null);
  const [documents, setDocuments] = useState<CourtVisualDocument[]>([]);
  const [activeDocument, setActiveDocument] = useState<CourtVisualDocument | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [animationProgress, setAnimationProgress] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const [isPositionEditMode, setIsPositionEditMode] = useState(false);
  const [isAnimationEditMode, setIsAnimationEditMode] = useState(false);
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");
  const undoStackRef = useRef<VisualHistoryEntry[]>([]);
  const redoStackRef = useRef<VisualHistoryEntry[]>([]);
  const pendingDragSnapshotRef = useRef<VisualHistoryEntry | null>(null);
  const activeDocumentRef = useRef<CourtVisualDocument | null>(null);
  const stepIndexRef = useRef(0);
  const hasLocalChangesRef = useRef(false);
  const savedPayloadSignatureRef = useRef("");

  const setLocalChanges = useCallback((nextValue: boolean) => {
    hasLocalChangesRef.current = nextValue;
    setHasLocalChanges(nextValue);
  }, []);

  const setSavedPayloadSnapshot = useCallback((payload: CourtVisualPayload) => {
    savedPayloadSignatureRef.current = getSaveablePayloadSignature(payload);
    setLocalChanges(false);
  }, [setLocalChanges]);

  const syncLocalChangesForPayload = useCallback(
    (nextPayload: CourtVisualPayload) => {
      const hasChanges =
        getSaveablePayloadSignature(nextPayload) !== savedPayloadSignatureRef.current;
      setLocalChanges(hasChanges);
      return hasChanges;
    },
    [setLocalChanges]
  );

  const payload: CourtVisualPayload = useMemo(
    () => activeDocument?.payload ?? buildRotation5x1Preset(),
    [activeDocument]
  );
  const currentStep = useMemo(() => getStepAtIndex(payload, stepIndex), [payload, stepIndex]);
  const visibleActorIds = useMemo(
    () => new Set(currentStep.visibleActorIds ?? payload.actors.map((actor) => actor.id)),
    [currentStep.visibleActorIds, payload.actors]
  );
  const selectedActor = useMemo(
    () =>
      selectedActorId && visibleActorIds.has(selectedActorId)
        ? payload.actors.find((actor) => actor.id === selectedActorId) ?? null
        : null,
    [payload.actors, selectedActorId, visibleActorIds]
  );
  const playbackAnimationStepIndex = useMemo(
    () => getPlaybackAnimationStepIndex(payload, stepIndex),
    [payload, stepIndex]
  );
  const canPlayCurrentStep = useMemo(
    () => getStepMovementCount(payload, playbackAnimationStepIndex) > 0,
    [payload, playbackAnimationStepIndex]
  );

  useEffect(() => {
    activeDocumentRef.current = activeDocument;
  }, [activeDocument]);

  useEffect(() => {
    stepIndexRef.current = stepIndex;
  }, [stepIndex]);

  useEffect(() => {
    if (selectedActorId && !visibleActorIds.has(selectedActorId)) {
      setSelectedActorId(null);
    }
  }, [selectedActorId, visibleActorIds]);

  const clearHistory = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    pendingDragSnapshotRef.current = null;
  }, []);

  const getCurrentHistoryEntry = useCallback((): VisualHistoryEntry | null => {
    const document = activeDocumentRef.current;
    if (!document) return null;
    return {
      payload: document.payload,
      stepIndex: stepIndexRef.current,
    };
  }, []);

  const pushUndoEntry = useCallback((entry: VisualHistoryEntry | null) => {
    if (!entry) return;
    undoStackRef.current = [...undoStackRef.current.slice(-49), entry];
    redoStackRef.current = [];
  }, []);

  const applyHistoryEntry = useCallback((entry: VisualHistoryEntry) => {
    setIsPlaying(false);
    setAnimationProgress(undefined);
    const currentDocument = activeDocumentRef.current;
    if (!currentDocument) return false;
    const nextDocument = {
      ...currentDocument,
      payload: entry.payload,
      updatedAt: new Date().toISOString(),
    };
    activeDocumentRef.current = nextDocument;
    setActiveDocument(nextDocument);
    setStepIndex(entry.stepIndex);
    const hasChanges = syncLocalChangesForPayload(entry.payload);
    setError("");
    return hasChanges;
  }, [syncLocalChangesForPayload]);

  const loadData = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    setError("");
    setStatusMessage("");
    try {
      const classData = await getClassById(classId);
      const visualPresets = await ensureDefaultVisualPresets({
        classId,
        organizationId: classData?.organizationId,
      });
      const fallback = buildLocalRotationDocument(classId, classData?.organizationId);
      const serving = buildLocalServingDocument(classId, classData?.organizationId);
      const defense = buildLocalDefenseDocument(classId, classData?.organizationId);
      const didactic = buildLocalDidacticDocument(classId, classData?.organizationId);
      const nextDocuments = (
        visualPresets.length ? visualPresets : [fallback, serving, defense, didactic]
      ).map(syncVisualDocument);
      const selected = nextDocuments[0] ?? fallback;
      setCls(classData);
      setDocuments(nextDocuments);
      activeDocumentRef.current = selected;
      setActiveDocument(selected);
      setStepIndex(0);
      setAnimationProgress(getInitialAnimationProgressForStep(selected.payload, 0));
      setSavedPayloadSnapshot(selected.payload);
      clearHistory();
      if (nextDocuments.some((item) => item.id.startsWith("local_"))) {
        setStatusMessage("Quadra visual local carregada neste dispositivo.");
      } else {
        setStatusMessage("Quadra visual carregada para esta turma.");
      }
    } catch {
      const fallback = buildLocalRotationDocument(classId);
      const serving = buildLocalServingDocument(classId);
      const defense = buildLocalDefenseDocument(classId);
      const didactic = buildLocalDidacticDocument(classId);
      const nextDocuments = [fallback, serving, defense, didactic].map(syncVisualDocument);
      const selected = nextDocuments[0] ?? fallback;
      activeDocumentRef.current = selected;
      setActiveDocument(selected);
      setDocuments(nextDocuments);
      setStepIndex(0);
      setAnimationProgress(getInitialAnimationProgressForStep(selected.payload, 0));
      setSavedPayloadSnapshot(selected.payload);
      clearHistory();
      setError("Não foi possível sincronizar agora. O preset local segue disponível.");
    } finally {
      setLoading(false);
    }
  }, [classId, clearHistory, setSavedPayloadSnapshot]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!isPlaying) return;
    if (!canPlayCurrentStep) {
      setIsPlaying(false);
      setAnimationProgress(undefined);
      return;
    }
    const step = getStepAtIndex(payload, playbackAnimationStepIndex);
    const duration = Math.max(450, step.durationMs / speed);
    const startedAt = Date.now();
    setAnimationProgress(0);
    const progressTimer = setInterval(() => {
      setAnimationProgress(Math.min(1, (Date.now() - startedAt) / duration));
    }, 32);
    const timer = setTimeout(() => {
      setAnimationProgress(1);
      setIsPlaying(false);
      setStepIndex((current) =>
        getPlaybackLandingStepIndex(payload, current, playbackAnimationStepIndex)
      );
    }, duration);
    return () => {
      clearTimeout(timer);
      clearInterval(progressTimer);
    };
  }, [canPlayCurrentStep, isPlaying, payload, playbackAnimationStepIndex, speed]);

  const handlePrevious = () => {
    const previousIndex = getPreviousVisibleStepIndex(payload, stepIndex);
    setIsPlaying(false);
    setAnimationProgress(getInitialAnimationProgressForStep(payload, previousIndex));
    setIsPositionEditMode(false);
    setIsAnimationEditMode(false);
    setSelectedActorId(null);
    setStepIndex(previousIndex);
  };

  const handleNext = () => {
    const nextIndex = getNextVisibleStepIndex(payload, stepIndex);
    setIsPlaying(false);
    setAnimationProgress(getInitialAnimationProgressForStep(payload, nextIndex));
    setIsPositionEditMode(false);
    setIsAnimationEditMode(false);
    setSelectedActorId(null);
    setStepIndex(nextIndex);
  };

  const handleSelectDocument = (document: CourtVisualDocument) => {
    setIsPlaying(false);
    setAnimationProgress(getInitialAnimationProgressForStep(document.payload, 0));
    setIsPositionEditMode(false);
    setIsAnimationEditMode(false);
    setSelectedActorId(null);
    setStepIndex(0);
    activeDocumentRef.current = document;
    setActiveDocument(document);
    setSavedPayloadSnapshot(document.payload);
    clearHistory();
  };

  const handleUndo = useCallback(() => {
    const previous = undoStackRef.current.pop();
    const current = getCurrentHistoryEntry();
    if (!previous || !current) return;
    redoStackRef.current = [...redoStackRef.current.slice(-49), current];
    pendingDragSnapshotRef.current = null;
    const hasChanges = applyHistoryEntry(previous);
    setStatusMessage(
      hasChanges
        ? "Ação desfeita. Use Salvar para guardar a quadra."
        : "Ação desfeita. Sem alterações para salvar."
    );
  }, [applyHistoryEntry, getCurrentHistoryEntry]);

  const handleRedo = useCallback(() => {
    const next = redoStackRef.current.pop();
    const current = getCurrentHistoryEntry();
    if (!next || !current) return;
    undoStackRef.current = [...undoStackRef.current.slice(-49), current];
    pendingDragSnapshotRef.current = null;
    const hasChanges = applyHistoryEntry(next);
    setStatusMessage(
      hasChanges
        ? "Ação refeita. Use Salvar para guardar a quadra."
        : "Ação refeita. Sem alterações para salvar."
    );
  }, [applyHistoryEntry, getCurrentHistoryEntry]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.addEventListener) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      if (event.shiftKey) {
        handleRedo();
        return;
      }
      handleUndo();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleRedo, handleUndo]);

  const updateActivePayload = useCallback(
    (updater: (payload: CourtVisualPayload) => CourtVisualPayload) => {
      const currentDocument = activeDocumentRef.current;
      if (!currentDocument) return;
      const nextDocument = {
        ...currentDocument,
        payload: updater(currentDocument.payload),
        updatedAt: new Date().toISOString(),
      };
      activeDocumentRef.current = nextDocument;
      setActiveDocument(nextDocument);
      syncLocalChangesForPayload(nextDocument.payload);
      setError("");
    },
    [syncLocalChangesForPayload]
  );

  const handleActorMove = useCallback(
    (actorId: string, point: CourtPoint) => {
      const shouldEditStaticPosition = isPositionEditMode || !isAnimationEditMode;
      setIsPlaying(false);
      setAnimationProgress(undefined);
      if (!isPositionEditMode && !isAnimationEditMode) {
        setIsPositionEditMode(true);
      }
      if (!pendingDragSnapshotRef.current) {
        pendingDragSnapshotRef.current = getCurrentHistoryEntry();
      }
      updateActivePayload((currentPayload) =>
        shouldEditStaticPosition
          ? updateCourtVisualStepActorStaticPosition(currentPayload, stepIndex, actorId, point)
          : updateCourtVisualStepActorPosition(currentPayload, stepIndex, actorId, point)
      );
    },
    [
      getCurrentHistoryEntry,
      isAnimationEditMode,
      isPositionEditMode,
      stepIndex,
      updateActivePayload,
    ]
  );

  const handleActorMoveEnd = useCallback(
    (actorId: string, point: CourtPoint) => {
      const before = pendingDragSnapshotRef.current ?? getCurrentHistoryEntry();
      const originalPoint = before
        ? getStepActorPoint(before.payload, before.stepIndex, actorId)
        : undefined;
      if (areSameCourtPoint(originalPoint, point)) {
        pendingDragSnapshotRef.current = null;
        return;
      }
      handleActorMove(actorId, point);
      pushUndoEntry(pendingDragSnapshotRef.current);
      pendingDragSnapshotRef.current = null;
      const isStaticEdit = isPositionEditMode || !isAnimationEditMode;
      setStatusMessage(
        isStaticEdit
          ? "Posição editada sem seta. Use Salvar para guardar a quadra."
          : "Animação com setas ajustada. Use Salvar para guardar o play."
      );
    },
    [
      getCurrentHistoryEntry,
      handleActorMove,
      isAnimationEditMode,
      isPositionEditMode,
      pushUndoEntry,
    ]
  );

  const handleAlignPassers = useCallback(() => {
    const isAlreadyAtAnimationStart =
      typeof animationProgress === "number" && animationProgress <= 0.001;
    if (!canPlayCurrentStep || isAlreadyAtAnimationStart) return;

    setIsPlaying(false);
    setAnimationProgress(0);
    setIsPositionEditMode(false);
    setIsAnimationEditMode(false);
    setSelectedActorId(null);
    setStatusMessage(
      currentStep.passers?.length
        ? "Passe voltou para o início da animação."
        : "Posições voltaram para o início da animação."
    );
  }, [animationProgress, canPlayCurrentStep, currentStep.passers?.length]);

  const handleResetAnimations = useCallback(() => {
    const before = getCurrentHistoryEntry();
    setIsPlaying(false);
    setAnimationProgress(undefined);
    setIsAnimationEditMode(false);
    updateActivePayload((currentPayload) =>
      resetCourtVisualStepAnimations(currentPayload, stepIndex)
    );
    pushUndoEntry(before);
    setStatusMessage("Animações do frame redefinidas. Use Salvar para guardar a quadra.");
  }, [getCurrentHistoryEntry, pushUndoEntry, stepIndex, updateActivePayload]);

  const handleTogglePositionEditMode = useCallback(() => {
    setIsPlaying(false);
    setAnimationProgress(getInitialAnimationProgressForStep(payload, stepIndex));
    setIsPositionEditMode((current) => {
      const next = !current;
      if (next) setIsAnimationEditMode(false);
      return next;
    });
  }, [payload, stepIndex]);

  const handleToggleAnimationEditMode = useCallback(() => {
    setIsPlaying(false);
    setAnimationProgress(undefined);
    setIsAnimationEditMode((current) => {
      const next = !current;
      if (next) setIsPositionEditMode(false);
      return next;
    });
  }, []);

  const handleAddLegendActor = useCallback(
    (label: CourtVisualLegendActorLabel) => {
      const before = getCurrentHistoryEntry();
      let nextSelectedActorId: string | null = null;
      setIsPlaying(false);
      setIsAnimationEditMode(false);
      setIsPositionEditMode(true);
      updateActivePayload((currentPayload) => {
        const previousIds = new Set(currentPayload.actors.map((actor) => actor.id));
        const nextPayload = addCourtVisualActorFromLegend(currentPayload, stepIndex, label);
        nextSelectedActorId =
          nextPayload.actors.find((actor) => !previousIds.has(actor.id))?.id ?? null;
        return nextPayload;
      });
      if (nextSelectedActorId) setSelectedActorId(nextSelectedActorId);
      pushUndoEntry(before);
      setStatusMessage(`${label} adicionado na quadra. Use Salvar para guardar.`);
    },
    [getCurrentHistoryEntry, pushUndoEntry, stepIndex, updateActivePayload]
  );

  const handleSelectActor = useCallback((actorId: string) => {
    setIsPlaying(false);
    setAnimationProgress(getInitialAnimationProgressForStep(payload, stepIndex));
    setSelectedActorId(actorId);
    if (!isAnimationEditMode) {
      setIsPositionEditMode(true);
    }
  }, [isAnimationEditMode, payload, stepIndex]);

  const handleDeselectActor = useCallback(() => {
    setSelectedActorId(null);
  }, []);

  const handleDuplicateSelectedActor = useCallback(() => {
    if (!selectedActorId) return;
    const before = getCurrentHistoryEntry();
    let nextSelectedActorId: string | null = null;
    setIsPlaying(false);
    setIsAnimationEditMode(false);
    setIsPositionEditMode(true);
    updateActivePayload((currentPayload) => {
      const previousIds = new Set(currentPayload.actors.map((actor) => actor.id));
      const nextPayload = duplicateCourtVisualStepActor(
        currentPayload,
        stepIndex,
        selectedActorId
      );
      nextSelectedActorId =
        nextPayload.actors.find((actor) => !previousIds.has(actor.id))?.id ?? null;
      return nextPayload;
    });
    if (nextSelectedActorId) setSelectedActorId(nextSelectedActorId);
    pushUndoEntry(before);
    setStatusMessage("Posição duplicada. Use Salvar para guardar.");
  }, [getCurrentHistoryEntry, pushUndoEntry, selectedActorId, stepIndex, updateActivePayload]);

  const handleDeleteSelectedActor = useCallback(() => {
    if (!selectedActorId) return;
    const before = getCurrentHistoryEntry();
    setIsPlaying(false);
    updateActivePayload((currentPayload) => {
      return deleteCourtVisualStepActor(
        currentPayload,
        stepIndex,
        selectedActorId
      );
    });
    setSelectedActorId(null);
    pushUndoEntry(before);
    setStatusMessage("Posição excluída do frame atual. Use Salvar para guardar.");
  }, [getCurrentHistoryEntry, pushUndoEntry, selectedActorId, stepIndex, updateActivePayload]);

  const handleTogglePlay = useCallback(() => {
    if (!canPlayCurrentStep && !isPlaying) return;
    setIsPositionEditMode(false);
    setIsAnimationEditMode(false);
    setIsPlaying((current) => !current);
  }, [canPlayCurrentStep, isPlaying]);

  const handleSave = async () => {
    const documentToSave = activeDocumentRef.current ?? activeDocument;
    if (!documentToSave || !classId || saving || !hasLocalChangesRef.current) return;
    setSaving(true);
    setStatusMessage("");
    setError("");
    try {
      const saved = await saveTechnicalVisual({
        id: documentToSave.id.startsWith("local_") ? undefined : documentToSave.id,
        organizationId: cls?.organizationId || documentToSave.organizationId,
        classId,
        sourceKind: documentToSave.sourceKind,
        sourceId: documentToSave.sourceId,
        title: documentToSave.title,
        payload: documentToSave.payload,
      });
      if (!saved) {
        setStatusMessage("Preset mantido localmente. A sincronização será liberada quando a tabela estiver aplicada.");
        return;
      }
      activeDocumentRef.current = saved;
      setActiveDocument(saved);
      setSavedPayloadSnapshot(saved.payload);
      setDocuments((current) => {
        const withoutSaved = current.filter(
          (item) =>
            item.id !== saved.id &&
            item.id !== documentToSave.id &&
            !(
              item.sourceKind === saved.sourceKind &&
              (item.sourceId ?? null) === (saved.sourceId ?? null) &&
              item.title === saved.title
            )
        );
        return [saved, ...withoutSaved];
      });
      setStatusMessage(
        saved.id.startsWith("local_")
          ? "Quadra visual salva neste dispositivo."
          : "Quadra visual salva."
      );
    } catch {
      setError("Não foi possível salvar agora. O roteiro permanece disponível localmente.");
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => {
    if (classId) {
      navigateBackOrReplace({
        router,
        fallback: { pathname: "/class/[id]", params: { id: classId } },
      });
      return;
    }
    navigateBackOrReplace({ router, fallback: "/classes" });
  };

  const alignButtonLabel = currentStep.passers?.length
    ? "Alinhar passe"
    : "Alinhar posições";
  const isAnimationPreviewAtStart =
    typeof animationProgress === "number" && animationProgress <= 0.001;
  const canAlignCurrentStep = canPlayCurrentStep && !isAnimationPreviewAtStart;
  const canResetCurrentAnimations = getStepMovementCount(payload, stepIndex) > 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, overflow: "visible" }}>
      <ScreenPageHeader
        title="Quadra visual"
        subtitle={
          cls?.name
            ? `${cls.name} - rodízio, movimentação e desenho técnico`
            : "Rodízio, movimentação e desenho técnico da turma"
        }
        onBack={goBack}
        right={
          <Button
            label="Salvar"
            onPress={handleSave}
            loading={saving}
            disabled={!hasLocalChanges}
            disabledOpacity={0.45}
          />
        }
      />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: Math.max(insets.bottom + 120, 144),
          gap: 16,
          width: "100%",
          maxWidth: 1280,
          alignSelf: "center",
        }}
        style={{ backgroundColor: colors.background }}
      >
        {loading ? (
          <View style={[getSectionCardStyle(colors, "neutral", { shadow: false }), { alignItems: "center" }]}>
            <ActivityIndicator color={colors.primaryBg} />
            <Text style={{ color: colors.muted }}>Carregando quadra visual...</Text>
          </View>
        ) : null}

        {error ? (
          <View style={getSectionCardStyle(colors, "warning", { shadow: false })}>
            <Text style={{ color: colors.warningText, fontWeight: "900" }}>Atenção</Text>
            <Text style={{ color: colors.warningText }}>{error}</Text>
          </View>
        ) : null}

        {statusMessage ? (
          <View style={getSectionCardStyle(colors, "info", { shadow: false })}>
            <Text style={{ color: colors.infoText, fontWeight: "900" }}>Status</Text>
            <Text style={{ color: colors.muted }}>{statusMessage}</Text>
          </View>
        ) : null}

        {!loading ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
            <View style={{ flex: 1.75, minWidth: 300, gap: 16 }}>
              <VisualCourtCanvas
                payload={payload}
                stepIndex={stepIndex}
                editable={!isPlaying}
                showMovementLines={isAnimationEditMode}
                animationProgress={animationProgress}
                animationStepIndex={
                  typeof animationProgress === "number"
                    ? playbackAnimationStepIndex
                    : undefined
                }
                selectedActorId={selectedActorId}
                onActorMove={handleActorMove}
                onActorMoveEnd={handleActorMoveEnd}
                onActorSelect={handleSelectActor}
                onCanvasPress={handleDeselectActor}
              />
              {currentStep.formationKind === "defense_base_6_back" && currentStep.note ? (
                <View style={getSectionCardStyle(colors, "info", { shadow: false })}>
                  <Text style={{ color: colors.infoText, fontWeight: "900" }}>
                    Defesa base — 6 fundo
                  </Text>
                  <Text style={{ color: colors.muted }}>{currentStep.note}</Text>
                </View>
              ) : null}
              {selectedActor ? (
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                  }}
                >
                  <Text style={{ color: colors.muted, fontWeight: "900" }}>
                    Selecionado
                  </Text>
                  <Text style={{ color: colors.text, fontWeight: "900" }}>
                    {selectedActor.label}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Duplicar posição selecionada"
                    onPress={handleDuplicateSelectedActor}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.secondaryBg,
                    }}
                  >
                    <GoAtletaIcon name="copy" size={16} color={colors.text} />
                    <Text style={{ color: colors.text, fontWeight: "900" }}>
                      Duplicar
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Excluir posição selecionada"
                    onPress={handleDeleteSelectedActor}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: colors.dangerBorder,
                      backgroundColor: colors.dangerSolidBg,
                    }}
                  >
                    <GoAtletaIcon name="trash" size={16} color={colors.dangerSolidText} />
                    <Text style={{ color: colors.dangerSolidText, fontWeight: "900" }}>
                      Excluir
                    </Text>
                  </Pressable>
                </View>
              ) : null}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Editar posições"
                  accessibilityState={{ selected: isPositionEditMode }}
                  onPress={handleTogglePositionEditMode}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    alignSelf: "flex-start",
                    paddingHorizontal: 12,
                    paddingVertical: 9,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: isPositionEditMode ? colors.primaryBg : colors.border,
                    backgroundColor: isPositionEditMode ? colors.primaryBg : colors.secondaryBg,
                  }}
                >
                  <GoAtletaIcon
                    name="pencil"
                    size={17}
                    color={isPositionEditMode ? colors.primaryText : colors.text}
                  />
                  <Text
                    style={{
                      color: isPositionEditMode ? colors.primaryText : colors.text,
                      fontWeight: "900",
                    }}
                  >
                    {isPositionEditMode ? "Editando posições" : "Editar posições"}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Animar movimento"
                  accessibilityState={{ selected: isAnimationEditMode }}
                  onPress={handleToggleAnimationEditMode}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    alignSelf: "flex-start",
                    paddingHorizontal: 12,
                    paddingVertical: 9,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: isAnimationEditMode ? colors.primaryBg : colors.border,
                    backgroundColor: isAnimationEditMode ? colors.primaryBg : colors.secondaryBg,
                  }}
                >
                  <GoAtletaIcon
                    name="compare"
                    size={17}
                    color={isAnimationEditMode ? colors.primaryText : colors.text}
                  />
                  <Text
                    style={{
                      color: isAnimationEditMode ? colors.primaryText : colors.text,
                      fontWeight: "900",
                    }}
                  >
                    {isAnimationEditMode ? "Animando movimento" : "Animar movimento"}
                  </Text>
                </Pressable>
                {canResetCurrentAnimations ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Redefinir animações"
                    onPress={handleResetAnimations}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      alignSelf: "flex-start",
                      paddingHorizontal: 12,
                      paddingVertical: 9,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.secondaryBg,
                    }}
                  >
                    <GoAtletaIcon name="refresh" size={17} color={colors.text} />
                    <Text style={{ color: colors.text, fontWeight: "900" }}>
                      Redefinir animações
                    </Text>
                  </Pressable>
                ) : null}
                {Boolean(currentStep.visibleActorIds?.length ?? payload.actors.length) ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={alignButtonLabel}
                    accessibilityState={{ disabled: !canAlignCurrentStep }}
                    disabled={!canAlignCurrentStep}
                    onPress={handleAlignPassers}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      alignSelf: "flex-start",
                      paddingHorizontal: 12,
                      paddingVertical: 9,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: canAlignCurrentStep ? colors.border : "rgba(148,163,184,0.16)",
                      backgroundColor: canAlignCurrentStep
                        ? colors.secondaryBg
                        : "rgba(15,23,42,0.52)",
                      opacity: canAlignCurrentStep ? 1 : 0.45,
                    }}
                  >
                    <GoAtletaIcon
                      name="align"
                      size={18}
                      color={canAlignCurrentStep ? colors.text : colors.muted}
                    />
                    <Text
                      style={{
                        color: canAlignCurrentStep ? colors.text : colors.muted,
                        fontWeight: "900",
                      }}
                    >
                      {alignButtonLabel}
                    </Text>
                  </Pressable>
                ) : null}
                {hasLocalChanges ? (
                  <Text style={{ color: colors.muted, alignSelf: "center" }}>
                    Alterações locais ainda não salvas.
                  </Text>
                ) : null}
              </View>
              <VisualCourtTimelineControls
                payload={payload}
                stepIndex={stepIndex}
                isPlaying={isPlaying}
                canPlay={canPlayCurrentStep}
                speed={speed}
                mode="rotation_phase"
                onPrevious={handlePrevious}
                onNext={handleNext}
                onTogglePlay={handleTogglePlay}
                onSelectStep={(index) => {
                  setIsPlaying(false);
                  setAnimationProgress(getInitialAnimationProgressForStep(payload, index));
                  setIsPositionEditMode(false);
                  setIsAnimationEditMode(false);
                  setSelectedActorId(null);
                  setStepIndex(index);
                }}
                onSetSpeed={setSpeed}
              />
            </View>

            <View style={{ flex: 0.65, minWidth: 260, gap: 14 }}>
              <View style={getSectionCardStyle(colors, "primary", { shadow: false })}>
                <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>
                  Sistema
                </Text>
                <Text style={{ color: colors.muted }}>
                  Selecione o roteiro visual ativo para a quadra.
                </Text>
                {documents.map((document) => {
                  const visibleStepCount = getVisibleStepIndexes(document.payload).length;

                  return (
                    <Pressable
                      key={document.id}
                      onPress={() => handleSelectDocument(document)}
                      style={{
                        padding: 12,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: activeDocument?.id === document.id ? colors.primaryBg : colors.border,
                        backgroundColor:
                          activeDocument?.id === document.id ? colors.primaryBg : colors.secondaryBg,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <GoAtletaIcon
                        name={document.sourceKind === "rotation" ? "repeat" : "map"}
                        size={18}
                        color={activeDocument?.id === document.id ? colors.primaryText : colors.text}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: activeDocument?.id === document.id ? colors.primaryText : colors.text,
                            fontWeight: "900",
                          }}
                        >
                          {document.title}
                        </Text>
                        <Text
                          style={{
                            color: activeDocument?.id === document.id ? colors.primaryText : colors.muted,
                            marginTop: 2,
                          }}
                        >
                          {visibleStepCount} passos
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <View style={getSectionCardStyle(colors, "neutral", { shadow: false })}>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: "900" }}>
                  Legenda
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {legendActorItems.map(({ color, label }) => (
                    <Pressable
                      key={label}
                      accessibilityRole="button"
                      accessibilityLabel={`Adicionar ${label}`}
                      onPress={() => handleAddLegendActor(label)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        paddingHorizontal: 8,
                        paddingVertical: 5,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.secondaryBg,
                      }}
                    >
                      <View
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: 5,
                          backgroundColor: color,
                        }}
                      />
                      <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}>
                        {label}
                      </Text>
                      <GoAtletaIcon name="add" size={13} color={colors.text} />
                    </Pressable>
                  ))}
                </View>
                <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>
                  P¹/P² = ponteiros. P1/P6/P5/P4/P3/P2 = posição do levantador.
                </Text>
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
