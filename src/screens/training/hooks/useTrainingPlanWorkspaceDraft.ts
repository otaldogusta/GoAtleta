import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";

import type { TrainingPlan } from "../../../core/models";
import {
  clearTrainingPlanWorkspaceDraft,
  loadTrainingPlanWorkspaceDraft,
  saveTrainingPlanWorkspaceDraft,
  type TrainingPlanWorkspaceDraft,
} from "../application/training-plan-workspace-draft";

export type TrainingPlanWorkspaceDraftStatus =
  | "idle"
  | "saving"
  | "saved"
  | "restored"
  | "error";

type PendingWorkspaceDraft = {
  plan: TrainingPlan;
  lessonDate: string;
  signature: string;
};

const draftSignature = (plan: TrainingPlan, lessonDate: string) =>
  JSON.stringify({ plan, lessonDate });

export function useTrainingPlanWorkspaceDraft(key: string | null) {
  const [restoredDraft, setRestoredDraft] = useState<TrainingPlanWorkspaceDraft | null>(null);
  const [status, setStatus] = useState<TrainingPlanWorkspaceDraftStatus>("idle");
  const [isHydrated, setIsHydrated] = useState(false);
  const pendingRef = useRef<PendingWorkspaceDraft | null>(null);
  const persistedSignatureRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistCurrentDraft = useCallback(async () => {
    const current = pendingRef.current;
    if (!key || !current || current.signature === persistedSignatureRef.current) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setStatus("saving");
    try {
      const saved = await saveTrainingPlanWorkspaceDraft(key, current.plan, current.lessonDate);
      if (!saved) return;
      persistedSignatureRef.current = current.signature;
      if (pendingRef.current?.signature === current.signature) setStatus("saved");
    } catch {
      if (pendingRef.current?.signature === current.signature) setStatus("error");
    }
  }, [key]);

  const queueDraft = useCallback(
    (plan: TrainingPlan, lessonDate: string) => {
      const signature = draftSignature(plan, lessonDate);
      pendingRef.current = { plan, lessonDate, signature };
      if (!key || signature === persistedSignatureRef.current) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      setStatus("saving");
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void persistCurrentDraft();
      }, 300);
    },
    [key, persistCurrentDraft]
  );

  const clearDraft = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = null;
    persistedSignatureRef.current = "";
    setRestoredDraft(null);
    setStatus("idle");
    await clearTrainingPlanWorkspaceDraft(key);
  }, [key]);

  const consumeRestoredDraft = useCallback(() => {
    setRestoredDraft(null);
  }, []);

  useEffect(() => {
    let active = true;
    setIsHydrated(false);
    pendingRef.current = null;
    persistedSignatureRef.current = "";
    setRestoredDraft(null);
    setStatus("idle");
    if (!key) {
      setIsHydrated(true);
      return () => {
        active = false;
      };
    }

    void loadTrainingPlanWorkspaceDraft(key)
      .then((draft) => {
        if (!active || !draft) return;
        const signature = draftSignature(draft.plan, draft.lessonDate);
        pendingRef.current = { plan: draft.plan, lessonDate: draft.lessonDate, signature };
        persistedSignatureRef.current = signature;
        setRestoredDraft(draft);
        setStatus("restored");
      })
      .catch(() => {
        if (active) setStatus("error");
      })
      .finally(() => {
        if (active) setIsHydrated(true);
      });

    return () => {
      active = false;
    };
  }, [key]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") void persistCurrentDraft();
    });
    return () => subscription.remove();
  }, [persistCurrentDraft]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return undefined;
    const flush = () => {
      void persistCurrentDraft();
    };
    const flushHidden = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flushHidden);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flushHidden);
    };
  }, [persistCurrentDraft]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      void persistCurrentDraft();
    },
    [persistCurrentDraft]
  );

  return {
    restoredDraft,
    status,
    isHydrated,
    queueDraft,
    flushDraft: persistCurrentDraft,
    clearDraft,
    consumeRestoredDraft,
  };
}
