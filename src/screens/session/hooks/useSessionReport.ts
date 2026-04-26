import { useCallback, useEffect, useMemo, useState } from "react";

import type { SessionLog } from "../../../core/models";
import { saveSessionLog } from "../../../db/seed";

type ReportTechnique = "boa" | "ok" | "ruim" | "nenhum";

type ReportBaseline = {
  PSE: number;
  technique: ReportTechnique;
  activity: string;
  conclusion: string;
  participantsCount: string;
  photos: string;
};

type SaveReportOptions = {
  activityFallback?: string;
};

type UseSessionReportParams = {
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
  classId,
  sessionDate,
  sessionLog,
  setSessionLog,
  attendancePercent,
}: UseSessionReportParams) {
  const [PSE, setPSE] = useState<number>(0);
  const [technique, setTechnique] = useState<ReportTechnique>("nenhum");
  const [activity, setActivity] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [participantsCount, setParticipantsCount] = useState("");
  const [photos, setPhotos] = useState("");
  const [reportBaseline, setReportBaseline] =
    useState<ReportBaseline>(emptyReportBaseline);
  const [isSavingReport, setIsSavingReport] = useState(false);

  useEffect(() => {
    const empty = emptyReportBaseline();
    setReportBaseline(empty);
    setPSE(empty.PSE);
    setTechnique(empty.technique);
    setActivity(empty.activity);
    setConclusion(empty.conclusion);
    setParticipantsCount(empty.participantsCount);
    setPhotos(empty.photos);
  }, [classId, sessionDate]);

  useEffect(() => {
    if (!sessionLog) return;
    const nextState = buildReportStateFromSessionLog(sessionLog);
    setPSE(nextState.PSE);
    setTechnique(nextState.technique);
    setActivity(nextState.activity);
    setConclusion(nextState.conclusion);
    setParticipantsCount(nextState.participantsCount);
    setPhotos(nextState.photos);
    setReportBaseline(nextState);
  }, [sessionLog]);

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

      setIsSavingReport(true);
      try {
        await saveSessionLog(nextLog);
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

  return {
    PSE,
    setPSE,
    technique,
    setTechnique,
    activity,
    setActivity,
    conclusion,
    setConclusion,
    participantsCount,
    setParticipantsCount,
    photos,
    setPhotos,
    reportBaseline,
    reportHasChanges,
    isSavingReport,
    saveReport,
  };
}
