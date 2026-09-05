import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, Platform } from "react-native";

import type { SessionLog } from "../../../core/models";
import { saveSessionLog } from "../../../db/seed";
import {
  buildSessionReportDraftKey,
  clearSessionReportDraft,
  loadSessionReportDraft,
  saveSessionReportDraft,
  serializeSessionReportDraftValues,
  type SessionReportDraftValues,
} from "../application/session-report-draft";

type ReportTechnique = "boa" | "ok" | "ruim" | "nenhum";

type ReportBaseline = SessionReportDraftValues;

export type SessionReportDraftStatus =
  | "loading"
  | "idle"
  | "saving"
  | "saved"
  | "restored";

type SaveReportOptions = {
  activityFallback?: string;
};

type UseSessionReportParams = {
  userId?: string | null;
  organizationId?: string | null;
  classId: string;
  sessionDate: string;
  sessionLog: SessionLog | null;
  setSessionLog: (log: SessionLog | null) => void;
  attendancePercent: number | null;
};

const emptyReportBaseline = (): ReportBaseline => ({
  PSE: 0,
  technique: "nenhum",
  activity: "",
  conclusion: "",
  participantsCount: "",
  photos: "",
});

const toReportTechnique = (value: SessionLog["technique"] | undefined): ReportTechnique =>
  value ?? "nenhum";

const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const buildReportStateFromSessionLog = (log: SessionLog): ReportBaseline => ({
  PSE: typeof log.PSE === "number" ? log.PSE : 0,
  technique: toReportTechnique(log.technique),
  activity: log.activity ?? "",
  conclusion: log.conclusion ?? "",
  participantsCount:
    typeof log.participantsCount === "number" ? String(log.participantsCount) : "",
  photos: log.photos ?? "",
});

export function useSessionReport({
  userId,
  organizationId,
  classId,
  sessionDate,
  sessionLog,
  setSessionLog,
  attendancePercent,
}: UseSessionReportParams) {
  const incomingBaseline = useMemo(() => sessionLog
    ? buildReportStateFromSessionLog(sessionLog) : emptyReportBaseline(), [sessionLog]);
  const [PSE, setPSE] = useState<number>(incomingBaseline.PSE);
  const [technique, setTechnique] = useState<ReportTechnique>(incomingBaseline.technique);
  const [activity, setActivity] = useState(incomingBaseline.activity);
  const [conclusion, setConclusion] = useState(incomingBaseline.conclusion);
  const [participantsCount, setParticipantsCount] = useState(incomingBaseline.participantsCount);
  const [photos, setPhotos] = useState(incomingBaseline.photos);
  const [reportBaseline, setReportBaseline] =
    useState<ReportBaseline>(incomingBaseline);
  const [isSavingReport, setIsSavingReport] = useState(false);
  const [isDraftHydrated, setIsDraftHydrated] = useState(false);
  const [reportDraftStatus, setReportDraftStatus] =
    useState<SessionReportDraftStatus>("loading");
  const hydrationRunRef = useRef(0);
  const hydrationPendingRef = useRef(false);
  const editedDuringHydrationRef = useRef(false);
  const persistedDraftRef = useRef<{ key: string; signature: string } | null>(null);
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDraftRef = useRef<{
    key: string | null;
    values: SessionReportDraftValues;
    signature: string;
    shouldPersist: boolean;
  } | null>(null);

  const draftKey = useMemo(
    () =>
      buildSessionReportDraftKey({
        userId,
        organizationId,
        classId,
        sessionDate,
      }),
    [classId, organizationId, sessionDate, userId]
  );

  const [previousDraftKey, setPreviousDraftKey] = useState(draftKey);
  const [previousBaseline, setPreviousBaseline] = useState(incomingBaseline);
  if (previousDraftKey !== draftKey || previousBaseline !== incomingBaseline) {
    setPreviousDraftKey(draftKey);
    setPreviousBaseline(incomingBaseline);
    const baseline = incomingBaseline;
    setReportBaseline(baseline);
    setPSE(baseline.PSE);
    setTechnique(baseline.technique);
    setActivity(baseline.activity);
    setConclusion(baseline.conclusion);
    setParticipantsCount(baseline.participantsCount);
    setPhotos(baseline.photos);
    setIsDraftHydrated(false);
    setReportDraftStatus("loading");

  }

  const markEditedDuringHydration = useCallback(() => {
    if (hydrationPendingRef.current) {
      editedDuringHydrationRef.current = true;
    }
  }, []);

  const setDraftPSE = useCallback<Dispatch<SetStateAction<number>>>(
    (next) => {
      markEditedDuringHydration();
      setPSE(next);
    },
    [markEditedDuringHydration]
  );
  const setDraftTechnique = useCallback<Dispatch<SetStateAction<ReportTechnique>>>(
    (next) => {
      markEditedDuringHydration();
      setTechnique(next);
    },
    [markEditedDuringHydration]
  );
  const setDraftActivity = useCallback<Dispatch<SetStateAction<string>>>(
    (next) => {
      markEditedDuringHydration();
      setActivity(next);
    },
    [markEditedDuringHydration]
  );
  const setDraftConclusion = useCallback<Dispatch<SetStateAction<string>>>(
    (next) => {
      markEditedDuringHydration();
      setConclusion(next);
    },
    [markEditedDuringHydration]
  );
  const setDraftParticipantsCount = useCallback<Dispatch<SetStateAction<string>>>(
    (next) => {
      markEditedDuringHydration();
      setParticipantsCount(next);
    },
    [markEditedDuringHydration]
  );
  const setDraftPhotos = useCallback<Dispatch<SetStateAction<string>>>(
    (next) => {
      markEditedDuringHydration();
      setPhotos(next);
    },
    [markEditedDuringHydration]
  );

  useEffect(() => {
    const runId = hydrationRunRef.current + 1;
    hydrationRunRef.current = runId;
    hydrationPendingRef.current = true;
    editedDuringHydrationRef.current = false;
    persistedDraftRef.current = null;

    const baseline = incomingBaseline;

    void loadSessionReportDraft(draftKey)
      .then(async (draft) => {
        if (hydrationRunRef.current !== runId) return;
        const baselineSignature = serializeSessionReportDraftValues(baseline);
        const draftSignature = draft
          ? serializeSessionReportDraftValues(draft.values)
          : null;
        const hasRecoverableDraft =
          Boolean(draft && draftSignature !== baselineSignature);

        if (draft && !hasRecoverableDraft) {
          await clearSessionReportDraft(draftKey).catch(() => undefined);
        } else if (draft && draftSignature) {
          persistedDraftRef.current = {
            key: draftKey ?? "",
            signature: draftSignature,
          };
        }

        if (hydrationRunRef.current !== runId) return;
        if (!editedDuringHydrationRef.current && hasRecoverableDraft && draft) {
          setPSE(draft.values.PSE);
          setTechnique(draft.values.technique);
          setActivity(draft.values.activity);
          setConclusion(draft.values.conclusion);
          setParticipantsCount(draft.values.participantsCount);
          setPhotos(draft.values.photos);
        }

        setReportDraftStatus(hasRecoverableDraft ? "restored" : "idle");
      })
      .catch(() => {
        if (hydrationRunRef.current === runId) {
          setReportDraftStatus("idle");
        }
      })
      .finally(() => {
        if (hydrationRunRef.current !== runId) return;
        hydrationPendingRef.current = false;
        setIsDraftHydrated(true);
      });

    return () => {
      if (hydrationRunRef.current === runId) {
        hydrationPendingRef.current = false;
        hydrationRunRef.current += 1;
      }
    };
  }, [draftKey, incomingBaseline]);

  const saveReport = useCallback(
    async ({ activityFallback = "" }: SaveReportOptions = {}) => {
      if (!classId) return null;

      const dateValue = isIsoDate(sessionDate) ? sessionDate : null;
      const createdAt =
        sessionLog?.createdAt ??
        (dateValue
          ? new Date(`${dateValue}T12:00:00`).toISOString()
          : new Date().toISOString());
      const participantsRaw = participantsCount.trim();
      const participantsValue = participantsRaw ? Number(participantsRaw) : Number.NaN;
      const parsedParticipants =
        Number.isFinite(participantsValue) && participantsValue >= 0
          ? participantsValue
          : undefined;
      const activityValue = activity.trim() || activityFallback.trim();
      const attendanceValue =
        typeof attendancePercent === "number" ? attendancePercent : 0;
      const nextLog: SessionLog = {
        id: sessionLog?.id,
        clientId: sessionLog?.clientId,
        classId,
        PSE,
        technique,
        attendance: attendanceValue,
        activity: activityValue,
        conclusion,
        participantsCount: parsedParticipants,
        photos,
        createdAt,
      };

      if (draftSaveTimerRef.current) {
        clearTimeout(draftSaveTimerRef.current);
        draftSaveTimerRef.current = null;
      }
      setIsSavingReport(true);
      try {
        await saveSessionLog(nextLog);
        await clearSessionReportDraft(draftKey).catch(() => undefined);
        persistedDraftRef.current = null;
        setReportDraftStatus("idle");
        setActivity(activityValue);
        setReportBaseline({
          PSE,
          technique,
          activity: activityValue,
          conclusion,
          participantsCount:
            parsedParticipants !== undefined ? String(parsedParticipants) : "",
          photos,
        });
        setSessionLog(nextLog);
        return dateValue ?? new Date().toISOString().slice(0, 10);
      } finally {
        setIsSavingReport(false);
      }
    },
    [
      PSE,
      activity,
      attendancePercent,
      classId,
      conclusion,
      draftKey,
      participantsCount,
      photos,
      sessionDate,
      sessionLog?.clientId,
      sessionLog?.createdAt,
      sessionLog?.id,
      setSessionLog,
      technique,
    ]
  );

  const reportHasChanges = useMemo(
    () =>
      PSE !== reportBaseline.PSE ||
      technique !== reportBaseline.technique ||
      activity.trim() !== reportBaseline.activity.trim() ||
      conclusion.trim() !== reportBaseline.conclusion.trim() ||
      participantsCount.trim() !== reportBaseline.participantsCount.trim() ||
      photos.trim() !== reportBaseline.photos.trim(),
    [PSE, activity, conclusion, participantsCount, photos, reportBaseline, technique]
  );

  const reportDraftValues = useMemo<SessionReportDraftValues>(
    () => ({
      PSE,
      technique,
      activity,
      conclusion,
      participantsCount,
      photos,
    }),
    [PSE, activity, conclusion, participantsCount, photos, technique]
  );
  const reportDraftSignature = useMemo(
    () => serializeSessionReportDraftValues(reportDraftValues),
    [reportDraftValues]
  );

  useLayoutEffect(() => {
    latestDraftRef.current = {
      key: draftKey,
      values: reportDraftValues,
      signature: reportDraftSignature,
      shouldPersist: isDraftHydrated && reportHasChanges && !isSavingReport,
    };
  }, [draftKey, reportDraftValues, reportDraftSignature, isDraftHydrated, reportHasChanges, isSavingReport]);

  const persistCurrentDraft = useCallback(async () => {
    const current = latestDraftRef.current;
    if (!current?.key || !current.shouldPersist) return;
    if (
      persistedDraftRef.current?.key === current.key &&
      persistedDraftRef.current.signature === current.signature
    ) {
      return;
    }

    setReportDraftStatus("saving");
    try {
      const savedDraft = await saveSessionReportDraft(current.key, current.values);
      if (!savedDraft) return;
      persistedDraftRef.current = {
        key: current.key,
        signature: current.signature,
      };
      if (latestDraftRef.current?.key === current.key) {
        setReportDraftStatus("saved");
      }
    } catch {
      if (latestDraftRef.current?.key === current.key) {
        setReportDraftStatus("idle");
      }
    }
  }, []);

  useEffect(() => {
    if (!isDraftHydrated || !draftKey || isSavingReport) return;
    if (!reportHasChanges) {
      if (persistedDraftRef.current?.key === draftKey) {
        persistedDraftRef.current = null;
        void clearSessionReportDraft(draftKey);
      }
      return;
    }
    if (
      persistedDraftRef.current?.key === draftKey &&
      persistedDraftRef.current.signature === reportDraftSignature
    ) {
      return;
    }

    const timer = setTimeout(() => {
      draftSaveTimerRef.current = null;
      void persistCurrentDraft();
    }, 250);
    draftSaveTimerRef.current = timer;
    return () => {
      clearTimeout(timer);
      if (draftSaveTimerRef.current === timer) {
        draftSaveTimerRef.current = null;
      }
    };
  }, [
    draftKey,
    isDraftHydrated,
    isSavingReport,
    persistCurrentDraft,
    reportDraftSignature,
    reportHasChanges,
  ]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        void persistCurrentDraft();
      }
    });
    return () => subscription.remove();
  }, [persistCurrentDraft]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const flushDraft = () => {
      void persistCurrentDraft();
    };
    const flushHiddenDraft = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        flushDraft();
      }
    };

    window.addEventListener("pagehide", flushDraft);
    window.addEventListener("beforeunload", flushDraft);
    document.addEventListener("visibilitychange", flushHiddenDraft);
    return () => {
      window.removeEventListener("pagehide", flushDraft);
      window.removeEventListener("beforeunload", flushDraft);
      document.removeEventListener("visibilitychange", flushHiddenDraft);
    };
  }, [persistCurrentDraft]);

  return {
    PSE,
    setPSE: setDraftPSE,
    technique,
    setTechnique: setDraftTechnique,
    activity,
    setActivity: setDraftActivity,
    conclusion,
    setConclusion: setDraftConclusion,
    participantsCount,
    setParticipantsCount: setDraftParticipantsCount,
    photos,
    setPhotos: setDraftPhotos,
    reportBaseline,
    reportHasChanges,
    reportDraftStatus: isDraftHydrated && !reportHasChanges && !isSavingReport ? "idle" as const : reportDraftStatus,
    isSavingReport,
    saveReport,
  };
}
