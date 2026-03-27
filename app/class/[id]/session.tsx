import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Animated,
    Easing,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Pressable } from "../../../src/ui/Pressable";
import { ScreenBackdrop } from "../../../src/components/ui/ScreenBackdrop";

import { rewriteReportText, type ReportRewriteField } from "../../../src/api/ai";
import type { ClassGroup, ScoutingLog, SessionLog, TrainingPlan } from "../../../src/core/models";
import {
    buildLogFromCounts,
    countsFromLog,
    createEmptyCounts,
    getFocusSuggestion,
    getSkillMetrics,
    getTotalActions,
    scoutingEnvioTooltip,
    scoutingInitiationNote,
    scoutingPriorityNote,
    scoutingSkillHelp,
    scoutingSkills,
} from "../../../src/core/scouting";
import {
    getAttendanceByDate,
    getClassById,
    getScoutingLogByDate,
    getSessionLogByDate,
    getStudentsByClass,
    getTrainingPlans,
    saveScoutingLog,
    saveSessionLog,
} from "../../../src/db/seed";
import { logAction } from "../../../src/observability/breadcrumbs";
import { measure } from "../../../src/observability/perf";
import { exportPdf, safeFileName } from "../../../src/pdf/export-pdf";
import { SessionPlanDocument } from "../../../src/pdf/session-plan-document";
import { SessionReportDocument } from "../../../src/pdf/session-report-document";
import { sessionPlanHtml } from "../../../src/pdf/templates/session-plan";
import { sessionReportHtml } from "../../../src/pdf/templates/session-report";
import { AnchoredDropdown } from "../../../src/ui/AnchoredDropdown";
import { useAppTheme } from "../../../src/ui/app-theme";
import { Button } from "../../../src/ui/Button";
import { ClassContextHeader } from "../../../src/ui/ClassContextHeader";
import { ModalSheet } from "../../../src/ui/ModalSheet";
import { AnchoredDropdownOption } from "../../../src/ui/AnchoredDropdownOption";
import { useSaveToast } from "../../../src/ui/save-toast";
import { ShimmerBlock } from "../../../src/ui/Shimmer";
import { ScreenLoadingState } from "../../../src/components/ui/ScreenLoadingState";
import { useCollapsibleAnimation } from "../../../src/ui/use-collapsible";
import { formatClock, formatDuration } from "../../../src/utils/format-time";

const sessionTabs = [
  { id: "treino", label: "Treino mais recente" },
  { id: "relatório", label: "Fazer relatório" },
  { id: "scouting", label: "Scouting" },
] as const;

type SessionTabId = (typeof sessionTabs)[number]["id"];
const REPORT_REWRITE_MAX_CHARS = 1200;
const REPORT_RELEVANT_MIN_CHARS = 24;
const REPORT_RELEVANT_MIN_WORDS = 5;
const REPORT_PHOTO_LIMIT = 3;

const parseReportPhotoUris = (raw: string): string[] => {
  const value = raw.trim();
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
        .slice(0, REPORT_PHOTO_LIMIT);
    }
  } catch {
    // ignore invalid JSON and fallback to line-based parsing
  }
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, REPORT_PHOTO_LIMIT);
};

const serializeReportPhotoUris = (uris: string[]) =>
  JSON.stringify(
    uris
      .map((item) => String(item ?? "").trim())
      .filter(Boolean)
      .slice(0, REPORT_PHOTO_LIMIT)
  );

const inferMimeTypeFromUri = (uri: string) => {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic") || lower.endsWith(".heif")) return "image/heic";
  return "image/jpeg";
};

const isLocalImageUri = (uri: string) => /^file:|^content:/i.test(uri);
const summarizePlanItems = (items: string[] | undefined, limit = 2) =>
  (items ?? [])
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, limit)
    .join(" / ");

const buildSimpleActivityFromPlan = (plan: TrainingPlan | null) => {
  if (!plan) return "";
  const title = String(plan.title ?? "").trim();
  const warmup = summarizePlanItems(plan.warmup, 1);
  const main = summarizePlanItems(plan.main, 2);
  const cooldown = summarizePlanItems(plan.cooldown, 1);

  const parts = [
    title,
    warmup ? `Aquecimento: ${warmup}` : "",
    main ? `Principal: ${main}` : "",
    cooldown ? `Volta a calma: ${cooldown}` : "",
  ]
    .filter(Boolean)
    .join(". ");

  return parts.trim();
};

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) {
        reject(new Error("empty_data_url"));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("file_reader_error"));
    reader.readAsDataURL(blob);
  });

const convertWebImageUriForPdf = async (uri: string) => {
  const normalized = String(uri ?? "").trim();
  if (!normalized) return normalized;
  if (/^data:image\//i.test(normalized)) return normalized;
  try {
    const response = await fetch(normalized);
    if (!response.ok) return normalized;
    const blob = await response.blob();
    return await blobToDataUrl(blob);
  } catch {
    return normalized;
  }
};

export default function SessionScreen() {
  const { id, date, tab } = useLocalSearchParams<{
    id: string;
    date?: string;
    tab?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, mode } = useAppTheme();
  const { showSaveToast } = useSaveToast();
  const [cls, setCls] = useState<ClassGroup | null>(null);
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isLoadingSessionExtras, setIsLoadingSessionExtras] = useState(true);
  const [sessionLog, setSessionLog] = useState<SessionLog | null>(null);
  const [scoutingLog, setScoutingLog] = useState<ScoutingLog | null>(null);
  const [scoutingCounts, setScoutingCounts] = useState(createEmptyCounts());
  const [scoutingBaseline, setScoutingBaseline] = useState(createEmptyCounts());
  const [scoutingSaving, setScoutingSaving] = useState(false);
  const [scoutingMode, setScoutingMode] = useState<"treino" | "jogo">("treino");
  const [studentsCount, setStudentsCount] = useState(0);
  const [sessionTab, setSessionTab] = useState<SessionTabId>("treino");
  const sessionTabAnim = useRef<Record<SessionTabId, Animated.Value>>({
    treino: new Animated.Value(1),
    relatório: new Animated.Value(0),
    scouting: new Animated.Value(0),
  }).current;
  const [showAppliedPreview, setShowAppliedPreview] = useState(false);
  const [PSE, setPSE] = useState<number>(0);
  const [technique, setTechnique] = useState<"boa" | "ok" | "ruim" | "nenhum">(
    "nenhum"
  );
  const [activity, setActivity] = useState("");
  const [autoActivity, setAutoActivity] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [isRewritingActivity, setIsRewritingActivity] = useState(false);
  const [isRewritingConclusion, setIsRewritingConclusion] = useState(false);
  const [participantsCount, setParticipantsCount] = useState("");
  const [photos, setPhotos] = useState("");
  const [isPickingPhoto, setIsPickingPhoto] = useState(false);
  const [photoActionIndex, setPhotoActionIndex] = useState<number | null>(null);
  const [attendancePercent, setAttendancePercent] = useState<number | null>(null);
  const [showPsePicker, setShowPsePicker] = useState(false);
  const [showTechniquePicker, setShowTechniquePicker] = useState(false);
  const [showPlanFabMenu, setShowPlanFabMenu] = useState(false);
  const [containerWindow, setContainerWindow] = useState<{ x: number; y: number } | null>(null);
  const [pseTriggerLayout, setPseTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [techniqueTriggerLayout, setTechniqueTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [reportBaseline, setReportBaseline] = useState({
    PSE: 0,
    technique: "nenhum" as "boa" | "ok" | "ruim" | "nenhum",
    activity: "",
    conclusion: "",
    participantsCount: "",
    photos: "",
  });
  const containerRef = useRef<View>(null);
  const pseTriggerRef = useRef<View>(null);
  const techniqueTriggerRef = useRef<View>(null);
  const lastRewriteAppliedRef = useRef<{
    field: ReportRewriteField;
    previousText: string;
    nextText: string;
  } | null>(null);
  const { animatedStyle: psePickerAnimStyle, isVisible: showPsePickerContent } =
    useCollapsibleAnimation(showPsePicker, { translateY: -6 });
  const { animatedStyle: techniquePickerAnimStyle, isVisible: showTechniquePickerContent } =
    useCollapsibleAnimation(showTechniquePicker, { translateY: -6 });
  const sessionDate =
    typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : new Date().toISOString().slice(0, 10);
  const [activeIndex, setActiveIndex] = useState(0);
  const parseTime = (value: string) => {
    const parts = value.split(":");
    const hour = Number(parts[0]);
    const minute = Number(parts[1] ?? "0");
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return { hour, minute };
  };
  const formatRange = (hour: number, minute: number, durationMinutes: number) => {
    const start = String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");
    const endTotal = hour * 60 + minute + durationMinutes;
    const endHour = Math.floor(endTotal / 60) % 24;
    const endMinute = endTotal % 60;
    const end = String(endHour).padStart(2, "0") + ":" + String(endMinute).padStart(2, "0");
    return start + " - " + end;
  };
  const weekdayId = useMemo(() => {
    const dateObj = new Date(sessionDate);
    const day = dateObj.getDay();
    return day === 0 ? 7 : day;
  }, [sessionDate]);

  useEffect(() => {
    setReportBaseline({
      PSE: 0,
      technique: "nenhum",
      activity: "",
      conclusion: "",
      participantsCount: "",
      photos: "",
    });
    setPSE(0);
    setTechnique("nenhum");
    setActivity("");
    setConclusion("");
    setParticipantsCount("");
    setPhotos("");
  }, [id, sessionDate]);

  const togglePicker = (target: "pse" | "technique") => {
    setShowPsePicker((prev) => (target === "pse" ? !prev : false));
    setShowTechniquePicker((prev) => (target === "technique" ? !prev : false));
  };

  const closePickers = () => {
    setShowPsePicker(false);
    setShowTechniquePicker(false);
  };

  const handleSelectPse = (value: number) => {
    setPSE(value);
    setShowPsePicker(false);
  };

  const handleSelectTechnique = (value: "boa" | "ok" | "ruim" | "nenhum") => {
    setTechnique(value);
    setShowTechniquePicker(false);
  };

  const handleApplyAutoActivity = () => {
    if (!autoActivity.trim()) return;
    if (activity.trim()) return;
    setActivity(autoActivity);
    closePickers();
    showSaveToast({
      message: "Atividade preenchida a partir do treino.",
      variant: "info",
    });
  };
  const canApplyAutoActivity = !!autoActivity.trim() && !activity.trim();
  const normalizeRewriteInput = (value: string) => value.trim().replace(/\s+/g, " ");
  const isRelevantForRewrite = (value: string) => {
    const normalized = normalizeRewriteInput(value);
    if (!normalized) return false;
    if (normalized.length < REPORT_RELEVANT_MIN_CHARS) return false;
    const words = normalized.split(" ").filter(Boolean);
    return words.length >= REPORT_RELEVANT_MIN_WORDS;
  };
  const canSuggestActivity = isRelevantForRewrite(activity);
  const canSuggestConclusion = isRelevantForRewrite(conclusion);
  const reportPhotoUris = useMemo(() => parseReportPhotoUris(photos), [photos]);

  const getRewriteFieldLabel = (field: ReportRewriteField) =>
    field === "activity" ? "Atividade" : "Conclusão";

  const applyPickedPhoto = (uri: string, replaceIndex?: number) => {
    setPhotos((previous) => {
      const list = parseReportPhotoUris(previous);
      if (
        typeof replaceIndex === "number" &&
        replaceIndex >= 0 &&
        replaceIndex < list.length
      ) {
        list[replaceIndex] = uri;
      } else if (list.length < REPORT_PHOTO_LIMIT) {
        list.push(uri);
      }
      return serializeReportPhotoUris(list);
    });
  };

  const pickReportPhoto = async (
    source: "camera" | "library",
    replaceIndex?: number
  ) => {
    if (isPickingPhoto) return;
    if (
      typeof replaceIndex !== "number" &&
      reportPhotoUris.length >= REPORT_PHOTO_LIMIT
    ) {
      showSaveToast({
        message: `Limite de ${REPORT_PHOTO_LIMIT} fotos por relatório.`,
        variant: "info",
      });
      return;
    }

    setIsPickingPhoto(true);
    try {
      if (source === "camera") {
        if (Platform.OS === "web") {
          showSaveToast({
            message: "Câmera indisponível no navegador. Use a galeria.",
            variant: "info",
          });
          return;
        }
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (permission.status !== "granted") {
          showSaveToast({
            message: "Permissão de câmera não concedida.",
            variant: "error",
          });
          return;
        }
      } else if (Platform.OS !== "web") {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permission.status !== "granted") {
          showSaveToast({
            message: "Permissão da galeria não concedida.",
            variant: "error",
          });
          return;
        }
      }

      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.8,
              allowsEditing: true,
              aspect: [4, 3],
              base64: Platform.OS === "web",
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.8,
              allowsEditing: true,
              aspect: [4, 3],
              base64: Platform.OS === "web",
            });

      const asset = result.assets?.[0];
      if (result.canceled || !asset?.uri) return;
      let photoUri = asset.uri;
      if (Platform.OS === "web" && asset.base64) {
        const mimeType =
          typeof asset.mimeType === "string" && asset.mimeType.trim()
            ? asset.mimeType
            : inferMimeTypeFromUri(asset.uri);
        photoUri = `data:${mimeType};base64,${asset.base64}`;
      }
      applyPickedPhoto(photoUri, replaceIndex);
    } catch {
      showSaveToast({
        message: "Não foi possível selecionar a foto.",
        variant: "error",
      });
    } finally {
      setIsPickingPhoto(false);
    }
  };

  const removePhotoAtIndex = (index: number) => {
    setPhotos((previous) => {
      const list = parseReportPhotoUris(previous);
      list.splice(index, 1);
      return serializeReportPhotoUris(list);
    });
  };

  const serializePhotosForPdf = async (rawPhotos: string) => {
    const uris = parseReportPhotoUris(rawPhotos).slice(0, 6);
    if (!uris.length) return rawPhotos;
    const resolved = await Promise.all(
      uris.map(async (uri) => {
        if (Platform.OS === "web") {
          return convertWebImageUriForPdf(uri);
        }
        if (!isLocalImageUri(uri)) return uri;
        try {
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: (FileSystem as any).EncodingType?.Base64 ?? "base64",
          });
          const mime = inferMimeTypeFromUri(uri);
          return `data:${mime};base64,${base64}`;
        } catch {
          return "";
        }
      })
    );
    return JSON.stringify(resolved.filter(Boolean));
  };

  const handleRewriteField = async (field: ReportRewriteField) => {
    const rawValue = field === "activity" ? activity : conclusion;
    const trimmed = normalizeRewriteInput(rawValue);
    const fieldLabel = getRewriteFieldLabel(field);

    if (!trimmed) {
      showSaveToast({
        message: `Preencha ${fieldLabel.toLowerCase()} antes de melhorar o texto.`,
        variant: "info",
      });
      return;
    }

    if (trimmed.length > REPORT_REWRITE_MAX_CHARS) {
      showSaveToast({
        message: `Limite de ${REPORT_REWRITE_MAX_CHARS} caracteres em ${fieldLabel.toLowerCase()}.`,
        variant: "error",
      });
      return;
    }

    if (field === "activity") {
      setIsRewritingActivity(true);
    } else {
      setIsRewritingConclusion(true);
    }

    logAction("IA melhorar texto iniciado", {
      classId: id,
      field,
      chars: trimmed.length,
      trigger: "manual",
    });

    try {
      const { rewrittenText } = await rewriteReportText({
        field,
        text: trimmed,
        mode: "projeto_social",
        maxChars: REPORT_REWRITE_MAX_CHARS,
        classId: typeof id === "string" ? id : undefined,
      });

      const currentText = normalizeRewriteInput(
        field === "activity" ? activity : conclusion
      );
      if (currentText !== trimmed) {
        return;
      }

      const previousText = field === "activity" ? activity : conclusion;
      if (field === "activity") {
        setActivity(rewrittenText);
      } else {
        setConclusion(rewrittenText);
      }
      lastRewriteAppliedRef.current = {
        field,
        previousText,
        nextText: rewrittenText,
      };
      showSaveToast({
        message: "Texto melhorado e aplicado.",
        variant: "success",
        actionLabel: "Desfazer",
        onAction: () => {
          const snapshot = lastRewriteAppliedRef.current;
          if (!snapshot) return;
          if (snapshot.field === "activity") {
            setActivity(snapshot.previousText);
          } else {
            setConclusion(snapshot.previousText);
          }
        },
        durationMs: 4200,
      });
      logAction("IA melhorar texto sucesso", { classId: id, field, trigger: "manual" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      showSaveToast({
        message: message || "Não foi possível melhorar o texto agora.",
        variant: "error",
      });
      logAction("IA melhorar texto falha", {
        classId: id,
        field,
        trigger: "manual",
        reason: message || "unknown",
      });
    } finally {
      if (field === "activity") {
        setIsRewritingActivity(false);
      } else {
        setIsRewritingConclusion(false);
      }
    }
  };

  const syncPickerLayouts = () => {
    const hasPickerOpen = showPsePicker || showTechniquePicker;
    if (!hasPickerOpen) return;
    requestAnimationFrame(() => {
      if (showPsePicker) {
        pseTriggerRef.current?.measureInWindow((x, y, width, height) => {
          setPseTriggerLayout({ x, y, width, height });
        });
      }
      if (showTechniquePicker) {
        techniqueTriggerRef.current?.measureInWindow((x, y, width, height) => {
          setTechniqueTriggerLayout({ x, y, width, height });
        });
      }
      containerRef.current?.measureInWindow((x, y) => {
        setContainerWindow({ x, y });
      });
    });
  };

  useEffect(() => {
    let alive = true;
    setIsLoadingSession(true);
    (async () => {
      try {
        const data = await getClassById(id);
        if (alive) setCls(data);
        if (data) {
          const [classStudents, plans] = await Promise.all([
            getStudentsByClass(data.id),
            getTrainingPlans({
              organizationId: data.organizationId ?? null,
              classId: data.id,
            }),
          ]);
          if (alive) setStudentsCount(classStudents.length);
          const byClass = plans.filter((item) => item.classId === data.id);
          const byDate = byClass.find((item) => item.applyDate === sessionDate);
          const byWeekday = byClass.find((item) =>
            (item.applyDays ?? []).includes(weekdayId)
          );
          if (alive) setPlan(byDate ?? byWeekday ?? null);
          if (!alive) return;
        }
        if (id) {
          const [log, scouting] = await Promise.all([
            getSessionLogByDate(id, sessionDate),
            getScoutingLogByDate(id, sessionDate, scoutingMode),
          ]);
          if (alive) {
            setSessionLog(log);
            if (log) {
              setPSE(typeof log.PSE === "number" ? log.PSE : 0);
              setTechnique(
                (log.technique as "boa" | "ok" | "ruim" | "nenhum") ?? "nenhum"
              );
              setActivity(log.activity ?? "");
              setConclusion(log.conclusion ?? "");
              setParticipantsCount(
                typeof log.participantsCount === "number"
                  ? String(log.participantsCount)
                  : ""
              );
              setPhotos(log.photos ?? "");
              setReportBaseline({
                PSE: typeof log.PSE === "number" ? log.PSE : 0,
                technique:
                  (log.technique as "boa" | "ok" | "ruim" | "nenhum") ?? "nenhum",
                activity: log.activity ?? "",
                conclusion: log.conclusion ?? "",
                participantsCount:
                  typeof log.participantsCount === "number"
                    ? String(log.participantsCount)
                    : "",
                photos: log.photos ?? "",
              });
            }
            const counts = scouting ? countsFromLog(scouting) : createEmptyCounts();
            setScoutingLog(scouting);
            setScoutingCounts(counts);
            setScoutingBaseline(counts);
          }
        }
      } finally {
        if (alive) setIsLoadingSession(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, sessionDate, scoutingMode]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setIsLoadingSessionExtras(true);
      try {
        if (!id) return;
        const attendanceRecords = await getAttendanceByDate(id, sessionDate);
        if (!alive) return;
        if (attendanceRecords.length) {
          const present = attendanceRecords.filter(
            (record) => record.status === "presente"
          ).length;
          const total = attendanceRecords.length;
          const percent = total > 0 ? Math.round((present / total) * 100) : 0;
          setAttendancePercent(percent);
        } else if (studentsCount > 0) {
          setAttendancePercent(0);
        } else {
          setAttendancePercent(null);
        }
        if (!plan) return;
        const fallback = buildSimpleActivityFromPlan(plan);
        if (fallback) {
          setAutoActivity(fallback);
        }
      } finally {
        if (alive) setIsLoadingSessionExtras(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [
    id,
    sessionDate,
    plan,
    studentsCount,
  ]);

  useEffect(() => {
    syncPickerLayouts();
  }, [showPsePicker, showTechniquePicker]);

  const saveReport = async () => {
    if (!cls) return null;
    const dateValue =
      typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? date
        : null;
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
    const activityValue = activity.trim() || autoActivity.trim();
    const attendanceValue =
      typeof attendancePercent === "number" ? attendancePercent : 0;
    await saveSessionLog({
      id: sessionLog?.id,
      clientId: sessionLog?.clientId,
      classId: cls.id,
      PSE,
      technique,
      attendance: attendanceValue,
      activity: activityValue,
      conclusion,
      participantsCount: parsedParticipants,
      photos,
      createdAt,
    });
    setActivity(activityValue);
    setReportBaseline({
      PSE,
      technique,
      activity: activityValue,
      conclusion,
      participantsCount: parsedParticipants !== undefined ? String(parsedParticipants) : "",
      photos,
    });
    setSessionLog({
      id: sessionLog?.id,
      clientId: sessionLog?.clientId,
      classId: cls.id,
      PSE,
      technique,
      attendance: attendanceValue,
      activity: activityValue,
      conclusion,
      participantsCount: parsedParticipants,
      photos,
      createdAt,
    });
    return dateValue ?? new Date().toISOString().slice(0, 10);
  };

  const reportHasChanges =
    PSE !== reportBaseline.PSE ||
    technique !== reportBaseline.technique ||
    activity.trim() !== reportBaseline.activity.trim() ||
    conclusion.trim() !== reportBaseline.conclusion.trim() ||
    participantsCount.trim() !== reportBaseline.participantsCount.trim() ||
    photos.trim() !== reportBaseline.photos.trim();

  async function handleSaveReport() {
    try {
      await saveReport();
      showSaveToast({ message: "Relatório salvo com sucesso.", variant: "success" });
    } catch (error) {
      showSaveToast({ message: "Não foi possível salvar o relatório.", variant: "error" });
      Alert.alert("Falha ao salvar", "Tente novamente.");
    }
  }

  async function handleSaveAndGenerateReport() {
    try {
      await saveReport();
      await handleExportReportPdf();
    } catch (error) {
      showSaveToast({ message: "Não foi possível salvar o relatório.", variant: "error" });
      Alert.alert("Falha ao salvar", "Tente novamente.");
    }
  }

  const title = plan ? "Treino mais recente" : "Aula do dia";
  const block = plan?.title ?? "";
  const warmup = plan?.warmup ?? [];
  const main = plan?.main ?? [];
  const cooldown = plan?.cooldown ?? [];
  const warmupLabel = plan?.warmupTime
    ? "Aquecimento (" + formatDuration(plan.warmupTime) + ")"
    : "Aquecimento (10 min)";
  const mainLabel = plan?.mainTime
    ? "Parte principal (" + formatClock(plan.mainTime) + ")"
    : "Parte principal (45 min)";
  const cooldownLabel = plan?.cooldownTime
    ? "Volta a calma (" + formatDuration(plan.cooldownTime) + ")"
    : "Volta a calma (5 min)";
  const showNoPlanNotice = !plan;
  const className = cls?.name ?? "";
  const classAgeBand = cls?.ageBand ?? "";
  const classGender = cls?.gender ?? "misto";
  const dateLabel = sessionDate.split("-").reverse().join("/");
  const parsedStart = cls?.startTime ? parseTime(cls.startTime) : null;
  const timeLabel =
    parsedStart && cls
    ? formatRange(parsedStart.hour, parsedStart.minute, cls.durationMinutes ?? 60)
    : "";

  const parseMinutes = (value: string, fallback: number) => {
    const match = value.match(/\d+/);
    if (!match) return fallback;
    const minutes = Number(match[0]);
    return Number.isFinite(minutes) && minutes > 0 ? minutes : fallback;
  };

  const durations = useMemo(() => {
    if (!plan) return [0, 0, 0];
    return [
      plan.warmupTime ? parseMinutes(plan.warmupTime, 10) : 10,
      plan.mainTime ? parseMinutes(plan.mainTime, 45) : 45,
      plan.cooldownTime ? parseMinutes(plan.cooldownTime, 5) : 5,
    ];
  }, [plan]);

  const totalMinutes = durations.reduce((sum, value) => sum + value, 0);

  const updateScoutingCount = (
    skillId: (typeof scoutingSkills)[number]["id"],
    score: 0 | 1 | 2,
    delta: 1 | -1
  ) => {
    setScoutingCounts((prev) => {
      const current = prev[skillId][score];
      const nextValue = Math.max(0, current + delta);
      return {
        ...prev,
        [skillId]: {
          ...prev[skillId],
          [score]: nextValue,
        },
      };
    });
  };

  const scoutingHasChanges = useMemo(() => {
    return scoutingSkills.some((skill) => {
      const current = scoutingCounts[skill.id];
      const base = scoutingBaseline[skill.id];
      return current[0] !== base[0] || current[1] !== base[1] || current[2] !== base[2];
    });
  }, [scoutingBaseline, scoutingCounts]);

  const scoutingTotals = useMemo(
    () => scoutingSkills.map((skill) => getSkillMetrics(scoutingCounts[skill.id])),
    [scoutingCounts]
  );

  const totalActions = useMemo(
    () => getTotalActions(scoutingCounts),
    [scoutingCounts]
  );

  const focusSuggestion = useMemo(
    () => getFocusSuggestion(scoutingCounts, 10),
    [scoutingCounts]
  );
  const monthLabel = (value: string) => {
    const [year, month] = value.split("-");
    const names = [
      "Janeiro",
      "Fevereiro",
      "Marco",
      "Abril",
      "Maio",
      "Junho",
      "Julho",
      "Agosto",
      "Setembro",
      "Outubro",
      "Novembro",
      "Dezembro",
    ];
    const index = Math.max(0, Math.min(11, Number(month) - 1));
    return `${names[index]}/${year}`;
  };

  const handleExportPdf = async () => {
    if (!plan || !cls) return;
    const dateLabel = sessionDate.split("-").reverse().join("/");
    const dateObj = new Date(sessionDate + "T00:00:00");
    const weekdayLabel = dateObj.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const pdfData = {
      className: cls.name,
      ageGroup: cls.ageBand,
      unitLabel: cls.unit,
      dateLabel: weekdayLabel,
      title: plan.title,
      totalTime: `${totalMinutes} min`,
      blocks: [
        {
          title: "Aquecimento",
          time: plan.warmupTime ? formatDuration(plan.warmupTime) : `${durations[0]} min`,
          items: warmup.map((name) => ({ name })),
        },
        {
          title: "Parte principal",
          time: plan.mainTime ? formatClock(plan.mainTime) : `${durations[1]} min`,
          items: main.map((name) => ({ name })),
        },
        {
          title: "Volta a calma",
          time: plan.cooldownTime ? formatDuration(plan.cooldownTime) : `${durations[2]} min`,
          items: cooldown.map((name) => ({ name })),
        },
      ],
    };
    const html = sessionPlanHtml(pdfData);
    const webDocument =
      Platform.OS === "web" ? <SessionPlanDocument data={pdfData} /> : undefined;

    try {
      const safeClass = safeFileName(cls.name);
      const safeDate = safeFileName(sessionDate);
      const fileName = `plano-aula-${safeClass}-${safeDate}.pdf`;
      await measure("exportSessionPdf", () =>
        exportPdf({
          html,
          fileName,
          webDocument,
        })
      );
      logAction("Exportar PDF", { classId: cls.id, date: sessionDate });
      showSaveToast({ message: "PDF gerado com sucesso.", variant: "success" });
    } catch (error) {
      showSaveToast({ message: "Não foi possível gerar o PDF.", variant: "error" });
      Alert.alert("Falha ao exportar PDF", "Tente novamente.");
    }
  };

  const handleExportReportPdf = async () => {
    if (!cls) return;
    const dateLabel = sessionDate.split("-").reverse().join("/");
    const reportMonth = monthLabel(sessionDate);
    const attendanceFromLog =
      typeof sessionLog?.attendance === "number" ? sessionLog.attendance : 0;
    const estimatedParticipants =
      studentsCount > 0
        ? Math.round((attendanceFromLog / 100) * studentsCount)
        : 0;
    const participantsRaw = participantsCount.trim();
    const participantsValue = participantsRaw ? Number(participantsRaw) : Number.NaN;
    const participantsForPdf =
      Number.isFinite(participantsValue) && participantsValue >= 0
        ? participantsValue
        : sessionLog?.participantsCount && sessionLog.participantsCount > 0
        ? sessionLog.participantsCount
        : estimatedParticipants || undefined;
    const photosForPdf = await serializePhotosForPdf(photos);
    const activityValue =
      activity.trim() || autoActivity.trim() || (sessionLog?.activity ?? "");
    const conclusionValue = conclusion.trim() || (sessionLog?.conclusion ?? "");
    const reportData = {
      monthLabel: reportMonth,
      dateLabel,
      className: cls.name,
      unitLabel: cls.unit,
      activity: activityValue,
      conclusion: conclusionValue,
      participantsCount: participantsForPdf ?? 0,
      photos: photosForPdf,
      deadlineLabel: "último dia da escolinha do mês",
    };
    const html = sessionReportHtml(reportData);
    const webDocument =
      Platform.OS === "web" ? <SessionReportDocument data={reportData} /> : undefined;
    try {
      const safeClass = safeFileName(cls.name);
      const safeDate = safeFileName(sessionDate);
      const fileName = `relatório-${safeClass}-${safeDate}.pdf`;
      await measure("exportSessionReportPdf", () =>
        exportPdf({
          html,
          fileName,
          webDocument,
        })
      );
      logAction("Exportar relatório PDF", { classId: cls.id, date: sessionDate });
      showSaveToast({ message: "Relatório gerado com sucesso.", variant: "success" });
    } catch (error) {
      showSaveToast({ message: "Não foi possível gerar o relatório.", variant: "error" });
      Alert.alert("Falha ao exportar PDF", "Tente novamente.");
    }
  };

  const handleSaveScouting = async () => {
    if (!cls) return;
    setScoutingSaving(true);
    try {
      const now = new Date().toISOString();
      const base: Omit<ScoutingLog, "serve0" | "serve1" | "serve2" | "receive0" | "receive1" | "receive2" | "set0" | "set1" | "set2" | "attackSend0" | "attackSend1" | "attackSend2"> =
        scoutingLog ?? {
          id: "scout_" + Date.now(),
          classId: cls.id,
          unit: cls.unit,
          mode: scoutingMode,
          date: sessionDate,
          createdAt: now,
        };
      const payload = {
        ...buildLogFromCounts(base, scoutingCounts),
        mode: scoutingMode,
      } as Parameters<typeof saveScoutingLog>[0];
      const saved = await saveScoutingLog(payload);
      setScoutingLog(saved);
      setScoutingBaseline(countsFromLog(saved));
      showSaveToast({ message: "Scouting salvo com sucesso.", variant: "success" });
    } catch (error) {
      showSaveToast({ message: "Não foi possível salvar o scouting.", variant: "error" });
      Alert.alert("Falha ao salvar", "Tente novamente.");
    } finally {
      setScoutingSaving(false);
    }
  };

  useEffect(() => {
    if (!tab) return;
    if (tab === "treino" || tab === "relatório" || tab === "scouting") {
      setSessionTab(tab);
    }
  }, [tab]);

  useEffect(() => {
    (Object.keys(sessionTabAnim) as SessionTabId[]).forEach((tabKey) => {
      Animated.timing(sessionTabAnim[tabKey], {
        toValue: sessionTab === tabKey ? 1 : 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    });
  }, [sessionTab, sessionTabAnim]);

  if (isLoadingSession) {
    return <ScreenLoadingState />;
  }

  if (isLoadingSessionExtras) {
    return <ScreenLoadingState />;
  }

  if (!cls) {
    return <ScreenLoadingState />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenBackdrop />
      <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 16 : 0}
        >
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
      <ClassContextHeader
        title={title}
        className={className}
        unit={cls?.unit}
        ageBand={classAgeBand}
        gender={classGender}
        classColorKey={cls?.colorKey}
        dateLabel={dateLabel}
        timeLabel={timeLabel}
        notice={showNoPlanNotice ? "Sem treino aplicado para esse dia" : undefined}
      />

      {plan ? (
        <View
          style={{
            padding: 16,
            borderRadius: 20,
            backgroundColor: colors.primaryBg,
            marginBottom: 12,
          }}
        >
          <Text style={{ color: colors.primaryText, fontSize: 14, opacity: 0.85 }}>
            Ações rápidas
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/class/[id]/attendance",
                  params: { id: cls.id, date: sessionDate },
                })
              }
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: colors.secondaryBg,
              }}
            >
              <Text style={{ fontWeight: "700", color: colors.text }}>
                Fazer chamada
              </Text>
            </Pressable>
            <Pressable
              onPress={handleExportPdf}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: colors.secondaryBg,
              }}
            >
              <Text style={{ fontWeight: "700", color: colors.text }}>
                Exportar plano
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          gap: 6,
          backgroundColor: colors.secondaryBg,
          padding: 6,
          borderRadius: 999,
          marginBottom: 12,
        }}
      >
        {sessionTabs.map((tab) => {
          const tabProgress = sessionTabAnim[tab.id];
          const tabScale = tabProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [0.95, 1],
          });
          const tabOpacity = tabProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [0.68, 1],
          });
          const tabBackground = tabProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [colors.card, colors.primaryBg],
          });
          const tabTextColor = tabProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [colors.text, colors.primaryText],
          });
          return (
            <Animated.View
              key={tab.id}
              style={{
                flex: 1,
                borderRadius: 999,
                opacity: tabOpacity,
                transform: [{ scale: tabScale }],
                backgroundColor: tabBackground,
              }}
            >
            <Pressable
              onPress={() => {
                closePickers();
                setSessionTab(tab.id);
              }}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 999,
                alignItems: "center",
              }}
            >
              <Animated.Text
                numberOfLines={1}
                style={{
                  color: tabTextColor,
                  fontWeight: "700",
                  fontSize: 12,
                }}
              >
                {tab.label}
              </Animated.Text>
            </Pressable>
            </Animated.View>
          );
        })}
      </View>

      </View>

      <ScrollView
        contentContainerStyle={{
          paddingVertical: 12,
          paddingHorizontal: 16,
          paddingBottom: Math.max(136, insets.bottom + 112),
          gap: 12,
        }}
        onScrollBeginDrag={() => {
          closePickers();
          setShowPlanFabMenu(false);
        }}
        onScroll={syncPickerLayouts}
        scrollEventThrottle={16}
        scrollEnabled={!showPsePicker && !showTechniquePicker}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      >
        {sessionTab === "treino" && plan ? (
          [
              { label: warmupLabel, items: warmup },
              { label: mainLabel, items: main },
              { label: cooldownLabel, items: cooldown },
            ].map((section, index) => (
              <View
                key={section.label}
                style={{
                  padding: 14,
                  borderRadius: 18,
                  backgroundColor:
                    index === activeIndex
                      ? colors.secondaryBg
                      : colors.card,
                  borderWidth: 1,
                  borderColor: index === activeIndex ? colors.primaryBg : colors.border,
                  shadowColor: colors.background,
                  shadowOpacity: 0.04,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 2,
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
                  {section.label}
                </Text>
                <Text style={{ color: colors.text, marginTop: 4 }}>
                  {"Tempo: " + durations[index] + " min"}
                </Text>
                    <View style={{ marginTop: 6, gap: 4 }}>
                      {section.items.length ? (
                        section.items.map((item, itemIndex) => {
                          const trimmed = item.trim();
                          const isMeta =
                            trimmed.toLowerCase().startsWith("objetivo geral") ||
                            trimmed.toLowerCase().startsWith("objetivo específico") ||
                            trimmed.toLowerCase().startsWith("observações");
                          return (
                            <Text
                              key={`${section.label}-${itemIndex}`}
                              style={{
                                color: isMeta ? colors.text : colors.muted,
                                fontWeight: isMeta ? "600" : "400",
                              }}
                            >
                              {isMeta ? trimmed : `- ${trimmed}`}
                            </Text>
                          );
                        })
                      ) : (
                        <Text style={{ color: colors.muted }}>Sem itens</Text>
                      )}
                    </View>
                <Pressable
                  onPress={() => setActiveIndex(index)}
                  style={{
                    marginTop: 10,
                    alignSelf: "flex-start",
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 999,
                    backgroundColor: index === activeIndex ? colors.primaryBg : colors.secondaryBg,
                  }}
                >
                  <Text
                    style={{
                      color: index === activeIndex ? colors.primaryText : colors.text,
                      fontWeight: "700",
                    }}
                  >
                    {index === activeIndex ? "Bloco atual" : "Usar bloco"}
                  </Text>
                </Pressable>
              </View>
            ))
        ) : null}
        {sessionTab === "treino" && !plan ? (
          <View
            style={{
              padding: 14,
              borderRadius: 18,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              shadowColor: "#000",
              shadowOpacity: 0.04,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 6 },
              elevation: 2,
              gap: 10,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
              Sem plano aplicado
            </Text>
            <Text style={{ color: colors.muted }}>
              Escolha um treino salvo ou crie um novo plano de aula.
            </Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/prof/calendar",
                    params: {
                      targetClassId: cls?.id ?? "",
                      targetDate: sessionDate,
                      openApply: "1",
                    },
                  })
                }
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  backgroundColor: colors.primaryBg,
                }}
              >
                <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
                  Aplicar treino
                </Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/prof/planning",
                    params: {
                      targetClassId: cls?.id ?? "",
                      targetDate: sessionDate,
                      openForm: "1",
                    },
                  })
                }
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  backgroundColor: colors.secondaryBg,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>
                  Criar plano
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        {sessionTab === "scouting" ? (
        <View
          style={{
            padding: 14,
            borderRadius: 18,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: "#000",
            shadowOpacity: 0.04,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 6 },
            elevation: 2,
            gap: 10,
          }}
        >
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
              Scouting (0-1-2)
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              Toque para somar, segure para remover.
            </Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
              {(["treino", "jogo"] as const).map((mode) => {
                const isActive = scoutingMode === mode;
                return (
                  <Pressable
                    key={mode}
                    onPress={() => setScoutingMode(mode)}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: isActive ? colors.primaryBg : colors.border,
                      backgroundColor: isActive ? colors.primaryBg : colors.secondaryBg,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: isActive ? colors.primaryText : colors.text,
                        fontWeight: "700",
                      }}
                    >
                      {mode === "treino" ? "Treino" : "Jogo"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {scoutingInitiationNote}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {scoutingPriorityNote}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {scoutingEnvioTooltip}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              Total de ações: {totalActions}
            </Text>
          </View>
          <View
            style={{
              padding: 10,
              borderRadius: 12,
              backgroundColor: colors.inputBg,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 6,
            }}
          >
            <Text style={{ fontWeight: "700", color: colors.text, fontSize: 12 }}>
              Guia rápido (0/1/2)
            </Text>
            <FlatList
              data={scoutingSkills}
              keyExtractor={(skill) => skill.id}
              scrollEnabled={false}
              contentContainerStyle={{ gap: 2 }}
              renderItem={({ item: skill }) => (
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {skill.label}: {scoutingSkillHelp[skill.id].join(" | ")}
                </Text>
              )}
            />
          </View>
          <View style={{ gap: 10 }}>
            <FlatList
              data={scoutingSkills}
              keyExtractor={(skill) => skill.id}
              scrollEnabled={false}
              contentContainerStyle={{ gap: 10 }}
              renderItem={({ item: skill, index }) => {
                const metrics = scoutingTotals[index];
                const counts = scoutingCounts[skill.id];
                const goodPct = Math.round(metrics.goodPct * 100);
                return (
                  <View
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      backgroundColor: colors.secondaryBg,
                      borderWidth: 1,
                      borderColor: colors.border,
                      gap: 8,
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ fontWeight: "700", color: colors.text }}>
                        {skill.label}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                        {metrics.total} ações | media {metrics.avg.toFixed(2)}
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {([0, 1, 2] as const).map((score) => {
                        const palette =
                          score === 2
                            ? { bg: colors.successBg, text: colors.successText }
                            : score === 1
                              ? { bg: colors.inputBg, text: colors.text }
                              : { bg: colors.dangerSolidBg, text: colors.dangerSolidText };
                        return (
                          <Pressable
                            key={score}
                            onPress={() => updateScoutingCount(skill.id, score, 1)}
                            onLongPress={() => updateScoutingCount(skill.id, score, -1)}
                            onContextMenu={(event) => {
                              if (event && typeof (event as { preventDefault?: () => void }).preventDefault === "function") {
                                (event as { preventDefault: () => void }).preventDefault();
                              }
                              updateScoutingCount(skill.id, score, -1);
                            }}
                            delayLongPress={200}
                            style={{
                              flex: 1,
                              paddingVertical: 8,
                              borderRadius: 12,
                              alignItems: "center",
                              backgroundColor: palette.bg,
                            }}
                          >
                            <Text style={{ color: palette.text, fontWeight: "700" }}>
                              {score}
                            </Text>
                            <Text style={{ color: palette.text, fontSize: 11, opacity: 0.9 }}>
                              x{counts[score]}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      Boas (2): {goodPct}%
                    </Text>
                  </View>
                );
              }}
            />
          </View>
          {focusSuggestion ? (
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>
                Foco da próxima aula: {focusSuggestion.label}
              </Text>
              <Text style={{ color: colors.muted }}>{focusSuggestion.text}</Text>
            </View>
          ) : (
            <Text style={{ color: colors.muted }}>
              Registre pelo menos 10 ações para sugerir o foco.
            </Text>
          )}
          <Pressable
            onPress={handleSaveScouting}
            disabled={!scoutingHasChanges || scoutingSaving}
            style={{
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor:
                !scoutingHasChanges || scoutingSaving
                  ? colors.primaryDisabledBg
                  : colors.primaryBg,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color:
                  !scoutingHasChanges || scoutingSaving
                    ? colors.secondaryText
                    : colors.primaryText,
                fontWeight: "700",
              }}
            >
              Salvar scouting
            </Text>
          </Pressable>
        </View>
        ) : null}
        {sessionTab === "relatório" ? (
        <View
          ref={containerRef}
          onLayout={syncPickerLayouts}
          style={{
            padding: 14,
            borderRadius: 18,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            position: "relative",
            shadowColor: "#000",
            shadowOpacity: 0.04,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 6 },
            elevation: 2,
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
            Relatório da aula
          </Text>
          <Text style={{ color: colors.muted }}>
            {sessionDate.split("-").reverse().join("/")}
          </Text>
          {!sessionLog ? (
            <Text style={{ color: colors.muted }}>
              Nenhum relatório registrado ainda.
            </Text>
          ) : null}
          {sessionLog ? (
            <View
              style={{
                alignSelf: "flex-start",
                paddingVertical: 4,
                paddingHorizontal: 8,
                borderRadius: 10,
                backgroundColor: colors.successBg,
                marginTop: 4,
              }}
            >
              <Text style={{ color: colors.successText, fontSize: 11, fontWeight: "700" }}>
                Editando relatório existente
              </Text>
            </View>
          ) : null}
          <View style={{ gap: 12, marginTop: 12 }}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
                PSE (0-10)
              </Text>
              <View ref={pseTriggerRef}>
                <Pressable
                  onPress={() => togglePicker("pse")}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: colors.inputBg,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                    {String(PSE)}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={colors.muted}
                    style={{ transform: [{ rotate: showPsePicker ? "180deg" : "0deg" }] }}
                  />
                </Pressable>
              </View>
              </View>

              <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
                Técnica geral
              </Text>
              <View ref={techniqueTriggerRef}>
                <Pressable
                  onPress={() => togglePicker("technique")}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: colors.inputBg,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                    {technique}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={colors.muted}
                    style={{
                      transform: [{ rotate: showTechniquePicker ? "180deg" : "0deg" }],
                    }}
                  />
                </Pressable>
              </View>
            </View>
            </View>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
                Número de participantes
              </Text>
                <TextInput
                  placeholder="Ex: 12"
                  value={participantsCount}
                  onChangeText={setParticipantsCount}
                  keyboardType="numeric"
                  placeholderTextColor={colors.placeholder}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: colors.inputBg,
                  color: colors.inputText,
                }}
              />
            </View>

              <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
                Atividade
              </Text>
              <View style={{ position: "relative" }}>
                <TextInput
                  placeholder="Resumo da atividade principal"
                  value={activity}
                  onChangeText={(value) => {
                    setActivity(value);
                    closePickers();
                  }}
                  placeholderTextColor={colors.placeholder}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: 12,
                    paddingRight: 52,
                    borderRadius: 12,
                    backgroundColor: colors.inputBg,
                    color: colors.inputText,
                  }}
                />
                {(canSuggestActivity || isRewritingActivity) ? (
                  <Pressable
                    onPress={() => void handleRewriteField("activity")}
                    disabled={isRewritingActivity}
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      marginTop: -15,
                      borderRadius: 999,
                      width: 30,
                      height: 30,
                      backgroundColor: colors.primaryBg,
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: isRewritingActivity ? 0.65 : 1,
                    }}
                  >
                    <Ionicons
                      name={isRewritingActivity ? "hourglass-outline" : "sparkles-outline"}
                      size={14}
                      color={colors.primaryText}
                    />
                  </Pressable>
                ) : null}
              </View>
            </View>
            </View>
            {autoActivity ? (
              <View
                style={{
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: colors.secondaryBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  gap: 6,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>
                      Preview do treino aplicado
                    </Text>
                    <Pressable
                      onPress={handleApplyAutoActivity}
                      disabled={!canApplyAutoActivity}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 999,
                        backgroundColor: canApplyAutoActivity
                          ? colors.primaryBg
                          : colors.secondaryBg,
                        opacity: canApplyAutoActivity ? 1 : 0.6,
                      }}
                    >
                      <Text
                        style={{
                          color: canApplyAutoActivity ? colors.primaryText : colors.muted,
                          fontWeight: "700",
                          fontSize: 12,
                        }}
                      >
                        Aplicar
                      </Text>
                    </Pressable>
                  </View>
                  <Pressable onPress={() => setShowAppliedPreview((prev) => !prev)}>
                    <Ionicons
                      name="chevron-down"
                      size={16}
                      color={colors.muted}
                      style={{
                        transform: [{ rotate: showAppliedPreview ? "180deg" : "0deg" }],
                      }}
                    />
                  </Pressable>
                </View>
                {showAppliedPreview ? (
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {autoActivity}
                  </Text>
                ) : null}
                {!canApplyAutoActivity ? (
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    Limpe o campo para aplicar do treino.
                  </Text>
                ) : null}
              </View>
            ) : null}

            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
                Conclusão
              </Text>
              <View style={{ position: "relative" }}>
                <TextInput
                  placeholder="Observações finais da aula"
                  value={conclusion}
                  onChangeText={(value) => {
                    setConclusion(value);
                    closePickers();
                  }}
                  placeholderTextColor={colors.placeholder}
                  multiline
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: 12,
                    paddingRight: 52,
                    borderRadius: 12,
                    minHeight: 90,
                    textAlignVertical: "top",
                    backgroundColor: colors.inputBg,
                    color: colors.inputText,
                  }}
                />
                {(canSuggestConclusion || isRewritingConclusion) ? (
                  <Pressable
                    onPress={() => void handleRewriteField("conclusion")}
                    disabled={isRewritingConclusion}
                    style={{
                      position: "absolute",
                      right: 8,
                      top: 8,
                      borderRadius: 999,
                      width: 30,
                      height: 30,
                      backgroundColor: colors.primaryBg,
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: isRewritingConclusion ? 0.65 : 1,
                    }}
                  >
                    <Ionicons
                      name={isRewritingConclusion ? "hourglass-outline" : "sparkles-outline"}
                      size={14}
                      color={colors.primaryText}
                    />
                  </Pressable>
                ) : null}
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
                Fotos
              </Text>
              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  backgroundColor: colors.inputBg,
                  padding: 10,
                  gap: 10,
                }}
              >
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    onPress={() => {
                      void pickReportPhoto("camera");
                    }}
                    disabled={isPickingPhoto || reportPhotoUris.length >= REPORT_PHOTO_LIMIT}
                    style={{
                      flex: 1,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.secondaryBg,
                      paddingVertical: 9,
                      alignItems: "center",
                      opacity:
                        isPickingPhoto || reportPhotoUris.length >= REPORT_PHOTO_LIMIT
                          ? 0.6
                          : 1,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                      {isPickingPhoto ? "Abrindo..." : "Tirar foto"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      void pickReportPhoto("library");
                    }}
                    disabled={isPickingPhoto || reportPhotoUris.length >= REPORT_PHOTO_LIMIT}
                    style={{
                      flex: 1,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.secondaryBg,
                      paddingVertical: 9,
                      alignItems: "center",
                      opacity:
                        isPickingPhoto || reportPhotoUris.length >= REPORT_PHOTO_LIMIT
                          ? 0.6
                          : 1,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                      Galeria
                    </Text>
                  </Pressable>
                </View>

                {reportPhotoUris.length ? (
                  <FlatList
                    data={reportPhotoUris}
                    keyExtractor={(uri, index) => `${uri}_${index}`}
                    numColumns={Platform.OS === "web" ? 4 : 3}
                    scrollEnabled={false}
                    contentContainerStyle={{ gap: 8 }}
                    columnWrapperStyle={{ gap: 8 }}
                    renderItem={({ item: uri, index }) => (
                      <Pressable
                        onPress={() => setPhotoActionIndex(index)}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          height: Platform.OS === "web" ? 112 : undefined,
                          aspectRatio: Platform.OS === "web" ? undefined : 1,
                          borderRadius: 10,
                          overflow: "hidden",
                          borderWidth: 1,
                          borderColor: colors.border,
                          position: "relative",
                          backgroundColor: colors.secondaryBg,
                        }}
                      >
                        <Image
                          source={{ uri }}
                          resizeMode="cover"
                          style={{ width: "100%", height: "100%" }}
                        />
                        <View
                          style={{
                            position: "absolute",
                            right: 6,
                            bottom: 6,
                            width: 24,
                            height: 24,
                            borderRadius: 999,
                            backgroundColor: "rgba(0,0,0,0.72)",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Ionicons name="create-outline" size={12} color={colors.primaryText} />
                        </View>
                      </Pressable>
                    )}
                  />
                ) : null}
              </View>
            </View>

            <View style={{ gap: 8 }}>
              <Button
                label={sessionLog ? "Salvar alterações" : "Salvar"}
                variant="secondary"
                onPress={handleSaveReport}
                disabled={!reportHasChanges}
              />
              <Button
                label="Gerar relatório"
                onPress={handleSaveAndGenerateReport}
              />
            </View>
          </View>

          <AnchoredDropdown
            visible={showPsePickerContent}
            layout={pseTriggerLayout}
            container={containerWindow}
            animationStyle={psePickerAnimStyle}
            zIndex={420}
            maxHeight={220}
            nestedScrollEnabled
            onRequestClose={closePickers}
            panelStyle={{
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
            }}
            scrollContentStyle={{ padding: 8, gap: 6 }}
          >
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <AnchoredDropdownOption
                key={n}
                active={PSE === n}
                onPress={() => handleSelectPse(n)}
              >
                <Text
                  style={{
                    color: PSE === n ? colors.primaryText : colors.text,
                    fontSize: 14,
                    fontWeight: PSE === n ? "700" : "500",
                  }}
                >
                  {n}
                </Text>
              </AnchoredDropdownOption>
            ))}
          </AnchoredDropdown>

          <AnchoredDropdown
            visible={showTechniquePickerContent}
            layout={techniqueTriggerLayout}
            container={containerWindow}
            animationStyle={techniquePickerAnimStyle}
            zIndex={420}
            maxHeight={160}
            nestedScrollEnabled
            onRequestClose={closePickers}
            panelStyle={{
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
            }}
            scrollContentStyle={{ padding: 8, gap: 6 }}
          >
            {(["nenhum", "boa", "ok", "ruim"] as const).map((value) => (
              <AnchoredDropdownOption
                key={value}
                active={technique === value}
                onPress={() => handleSelectTechnique(value)}
              >
                <Text
                  style={{
                    color: technique === value ? colors.primaryText : colors.text,
                    fontSize: 14,
                    fontWeight: technique === value ? "700" : "500",
                    textTransform: "capitalize",
                  }}
                >
                  {value}
                </Text>
              </AnchoredDropdownOption>
            ))}
          </AnchoredDropdown>

          <ModalSheet
            visible={photoActionIndex !== null}
            onClose={() => setPhotoActionIndex(null)}
            position="center"
            overlayZIndex={30000}
            backdropOpacity={0.7}
            cardStyle={{
              width: "100%",
              maxWidth: 420,
              borderRadius: 18,
              backgroundColor: colors.background,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 16,
              gap: 10,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>
              Foto do relatório
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              Escolha uma ação
            </Text>
            <View style={{ gap: 8, marginTop: 6 }}>
              <Pressable
                onPress={() => {
                  if (photoActionIndex === null) return;
                  setPhotoActionIndex(null);
                  void pickReportPhoto("camera", photoActionIndex);
                }}
                style={{
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.secondaryBg,
                  paddingVertical: 10,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>
                  Substituir (câmera)
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (photoActionIndex === null) return;
                  setPhotoActionIndex(null);
                  void pickReportPhoto("library", photoActionIndex);
                }}
                style={{
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.secondaryBg,
                  paddingVertical: 10,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>
                  Substituir (galeria)
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (photoActionIndex === null) return;
                  removePhotoAtIndex(photoActionIndex);
                  setPhotoActionIndex(null);
                }}
                style={{
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.dangerBorder,
                  backgroundColor: colors.dangerBg,
                  paddingVertical: 10,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.dangerText, fontWeight: "700" }}>
                  Remover
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setPhotoActionIndex(null)}
                style={{
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  paddingVertical: 10,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>
                  Cancelar
                </Text>
              </Pressable>
            </View>
          </ModalSheet>
        </View>
        ) : null}
      </ScrollView>

      {sessionTab === "treino" && showPlanFabMenu ? (
        <Pressable
          onPress={() => setShowPlanFabMenu(false)}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: 3180,
          }}
        />
      ) : null}

      {sessionTab === "treino" && showPlanFabMenu ? (
        <View
          style={{
            ...(Platform.OS === "web"
              ? ({ position: "fixed", right: 16, bottom: Math.max(insets.bottom + 234, 250) } as any)
              : { position: "absolute" as const, right: 16, bottom: Math.max(insets.bottom + 234, 250) }),
            width: 210,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            padding: 8,
            gap: 8,
            zIndex: 3190,
          }}
        >
          <Pressable
            onPress={() => {
              setShowPlanFabMenu(false);
              router.push({
                pathname: "/prof/planning",
                params: {
                  targetClassId: cls?.id ?? "",
                  openImport: "1",
                },
              });
            }}
            disabled={!cls}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.background,
              borderRadius: 10,
              paddingHorizontal: 10,
              paddingVertical: 9,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              opacity: cls ? 1 : 0.65,
            }}
          >
            <Ionicons name="cloud-upload-outline" size={16} color={colors.text} />
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
              Importar plano
            </Text>
          </Pressable>
        </View>
      ) : null}

      {sessionTab === "treino" ? (
        <Pressable
          onPress={() => setShowPlanFabMenu((current) => !current)}
          style={{
            ...(Platform.OS === "web"
              ? ({ position: "fixed", right: 16, bottom: Math.max(insets.bottom + 166, 182) } as any)
              : { position: "absolute" as const, right: 16, bottom: Math.max(insets.bottom + 166, 182) }),
            width: 54,
            height: 54,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primaryBg,
            borderWidth: 1,
            borderColor: colors.primaryBg,
            zIndex: 3200,
            shadowColor: "#000",
            shadowOpacity: 0.2,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 8,
          }}
        >
          <Ionicons
            name={showPlanFabMenu ? "close" : "add"}
            size={24}
            color={colors.primaryText}
          />
        </Pressable>
      ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
