import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Pressable } from "../../../src/ui/Pressable";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import {
  getAttendanceByDate,
  getClassById,
  getTrainingPlans,
  getSessionLogByDate,
  getScoutingLogByDate,
  getStudentsByClass,
  saveSessionLog,
  saveScoutingLog,
} from "../../../src/db/seed";
import type { ClassGroup, SessionLog, TrainingPlan, ScoutingLog } from "../../../src/core/models";
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
import { useAppTheme } from "../../../src/ui/app-theme";
import { exportPdf, safeFileName } from "../../../src/pdf/export-pdf";
import { sessionPlanHtml } from "../../../src/pdf/templates/session-plan";
import { SessionPlanDocument } from "../../../src/pdf/session-plan-document";
import { sessionReportHtml } from "../../../src/pdf/templates/session-report";
import { SessionReportDocument } from "../../../src/pdf/session-report-document";
import { logAction } from "../../../src/observability/breadcrumbs";
import { measure } from "../../../src/observability/perf";
import { useSaveToast } from "../../../src/ui/save-toast";
import { Button } from "../../../src/ui/Button";
import { AnchoredDropdown } from "../../../src/ui/AnchoredDropdown";
import { useCollapsibleAnimation } from "../../../src/ui/use-collapsible";
import { ClassContextHeader } from "../../../src/ui/ClassContextHeader";

const sessionTabs = [
  { id: "treino", label: "Treino mais recente" },
  { id: "relatório", label: "Fazer relatório" },
  { id: "scouting", label: "Scouting" },
] as const;

type SessionTabId = (typeof sessionTabs)[number]["id"];

export default function SessionScreen() {
  const { id, date, autoReport, tab } = useLocalSearchParams<{
    id: string;
    date?: string;
    autoReport?: string;
    tab?: string;
  }>();
  const router = useRouter();
  const { colors, mode } = useAppTheme();
  const { showSaveToast } = useSaveToast();
  const [cls, setCls] = useState<ClassGroup | null>(null);
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [sessionLog, setSessionLog] = useState<SessionLog | null>(null);
  const [scoutingLog, setScoutingLog] = useState<ScoutingLog | null>(null);
  const [scoutingCounts, setScoutingCounts] = useState(createEmptyCounts());
  const [scoutingBaseline, setScoutingBaseline] = useState(createEmptyCounts());
  const [scoutingSaving, setScoutingSaving] = useState(false);
  const [scoutingMode, setScoutingMode] = useState<"treino" | "jogo">("treino");
  const [studentsCount, setStudentsCount] = useState(0);
  const [didAutoReport, setDidAutoReport] = useState(false);
  const [sessionTab, setSessionTab] = useState<SessionTabId>("treino");
  const [showAppliedPreview, setShowAppliedPreview] = useState(false);
  const [PSE, setPSE] = useState<number>(0);
  const [technique, setTechnique] = useState<"boa" | "ok" | "ruim" | "nenhum">(
    "nenhum"
  );
  const [activity, setActivity] = useState("");
  const [autoActivity, setAutoActivity] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [participantsCount, setParticipantsCount] = useState("");
  const [photos, setPhotos] = useState("");
  const [attendancePercent, setAttendancePercent] = useState<number | null>(null);
  const [showPsePicker, setShowPsePicker] = useState(false);
  const [showTechniquePicker, setShowTechniquePicker] = useState(false);
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
    (async () => {
      const data = await getClassById(id);
      if (alive) setCls(data);
      if (data) {
        const classStudents = await getStudentsByClass(data.id);
        if (alive) setStudentsCount(classStudents.length);
        const plans = await getTrainingPlans();
        const byClass = plans.filter((item) => item.classId === data.id);
        const byDate = byClass.find((item) => item.applyDate === sessionDate);
        const byWeekday = byClass.find((item) =>
          (item.applyDays ?? []).includes(weekdayId)
        );
        if (alive) setPlan(byDate ?? byWeekday ?? null);
        if (!alive) return;
      }
      if (id) {
        const log = await getSessionLogByDate(id, sessionDate);
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
        }
        const scouting = await getScoutingLogByDate(id, sessionDate, scoutingMode);
        if (alive) {
          const counts = scouting ? countsFromLog(scouting) : createEmptyCounts();
          setScoutingLog(scouting);
          setScoutingCounts(counts);
          setScoutingBaseline(counts);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, sessionDate, scoutingMode]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!id) return;
      const [attendanceRecords, students] = await Promise.all([
        getAttendanceByDate(id, sessionDate),
        getStudentsByClass(id),
      ]);
      if (!alive) return;
      if (attendanceRecords.length) {
        const present = attendanceRecords.filter(
          (record) => record.status === "presente"
        ).length;
        const total = attendanceRecords.length;
        const percent = total > 0 ? Math.round((present / total) * 100) : 0;
        setAttendancePercent(percent);
      } else if (students.length) {
        setAttendancePercent(0);
      } else {
        setAttendancePercent(null);
      }

      const plans = await getTrainingPlans();
      const byClass = plans.filter((item) => item.classId === id);
      const byDate = byClass.find((item) => item.applyDate === sessionDate);
      const byWeekday = byClass.find((item) =>
        (item.applyDays ?? []).includes(weekdayId)
      );
      const planForActivity = byDate ?? byWeekday ?? null;
      if (!planForActivity) return;
      const warmupText = planForActivity.warmup?.filter(Boolean).join(" / ") || "";
      const mainText = planForActivity.main?.filter(Boolean).join(" / ") || "";
      const cooldownText = planForActivity.cooldown?.filter(Boolean).join(" / ") || "";
      const fallback = [
        warmupText ? "Aquecimento: " + warmupText : "",
        mainText ? "Parte principal: " + mainText : "",
        cooldownText ? "Volta a calma: " + cooldownText : "",
      ]
        .filter(Boolean)
        .join(" | ");
      if (!fallback) return;
      setAutoActivity(fallback);
    })();
    return () => {
      alive = false;
    };
  }, [
    activity,
    id,
    sessionDate,
    weekdayId,
    sessionLog,
    PSE,
    technique,
    conclusion,
    participantsCount,
    photos,
    reportBaseline,
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
      const reportDate = await saveReport();
      if (reportDate) {
        router.replace({
          pathname: "/class/[id]/session",
          params: { id, date: reportDate, autoReport: "1" },
        });
      }
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
    ? "Aquecimento (" + plan.warmupTime + ")"
    : "Aquecimento (10 min)";
  const mainLabel = plan?.mainTime
    ? "Parte principal (" + plan.mainTime + ")"
    : "Parte principal (45 min)";
  const cooldownLabel = plan?.cooldownTime
    ? "Volta a calma (" + plan.cooldownTime + ")"
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
          time: plan.warmupTime || `${durations[0]} min`,
          items: warmup.map((name) => ({ name })),
        },
        {
          title: "Parte principal",
          time: plan.mainTime || `${durations[1]} min`,
          items: main.map((name) => ({ name })),
        },
        {
          title: "Volta a calma",
          time: plan.cooldownTime || `${durations[2]} min`,
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
    if (!cls || !sessionLog) return;
    const dateLabel = sessionDate.split("-").reverse().join("/");
    const reportMonth = monthLabel(sessionDate);
    const estimatedParticipants =
      studentsCount > 0
        ? Math.round((sessionLog.attendance / 100) * studentsCount)
        : 0;
    const participantsCount =
      sessionLog.participantsCount && sessionLog.participantsCount > 0
        ? sessionLog.participantsCount
        : estimatedParticipants || undefined;
    const reportData = {
      monthLabel: reportMonth,
      dateLabel,
      className: cls.name,
      unitLabel: cls.unit,
      activity: sessionLog.activity ?? "",
      conclusion: sessionLog.conclusion ?? "",
      participantsCount: participantsCount ?? 0,
      photos: sessionLog.photos ?? "",
      deadlineLabel: "último dia da escolinha do mês",
    };
    const html = sessionReportHtml(reportData);
    const webDocument =
      Platform.OS === "web" ? <SessionReportDocument data={reportData} /> : undefined;
    try {
      const safeClass = safeFileName(cls.name);
      const safeDate = safeFileName(sessionDate);
      const fileName = `relatorio-${safeClass}-${safeDate}.pdf`;
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
      };
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
    if (autoReport !== "1") return;
    if (!cls || !sessionLog || didAutoReport) return;
    setDidAutoReport(true);
    void handleExportReportPdf();
  }, [autoReport, cls, didAutoReport, sessionLog, studentsCount]);

  useEffect(() => {
    if (!tab) return;
    if (tab === "treino" || tab === "relatório" || tab === "scouting") {
      setSessionTab(tab);
    }
  }, [tab]);

  if (!cls) return null;

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, backgroundColor: colors.background }}>
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
            Ações rapidas
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
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: 12,
        }}
      >
        {sessionTabs.map((tab) => {
          const selected = sessionTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => {
                closePickers();
                setSessionTab(tab.id);
              }}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: selected ? colors.primaryBg : colors.card,
                borderWidth: selected ? 0 : 1,
                borderColor: selected ? "transparent" : colors.border,
                alignItems: "center",
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  color: selected ? colors.primaryText : colors.muted,
                  fontWeight: "700",
                  fontSize: 12,
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingVertical: 12, gap: 12 }}
        onScroll={syncPickerLayouts}
        scrollEventThrottle={16}
        scrollEnabled={!showPsePicker && !showTechniquePicker}
      >
        {sessionTab === "treino" && plan
          ? [
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
                      ? mode === "dark"
                        ? "#1e293b"
                        : "#e0f2fe"
                      : colors.card,
                  borderWidth: 1,
                  borderColor: index === activeIndex ? "#38bdf8" : colors.border,
                  shadowColor: "#000",
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
                            trimmed.toLowerCase().startsWith("objetivo especifico") ||
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
          : null}
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
                    pathname: "/calendar",
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
                    pathname: "/training",
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
              Guia rapido (0/1/2)
            </Text>
            {scoutingSkills.map((skill) => (
              <Text key={skill.id} style={{ color: colors.muted, fontSize: 12 }}>
                {skill.label}: {scoutingSkillHelp[skill.id].join(" | ")}
              </Text>
            ))}
          </View>
          <View style={{ gap: 10 }}>
            {scoutingSkills.map((skill, index) => {
              const metrics = scoutingTotals[index];
              const counts = scoutingCounts[skill.id];
              const goodPct = Math.round(metrics.goodPct * 100);
              return (
                <View
                  key={skill.id}
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
            })}
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
                Tecnica geral
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
                  borderRadius: 12,
                  backgroundColor: colors.inputBg,
                  color: colors.inputText,
                }}
              />
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
                  borderRadius: 12,
                  minHeight: 90,
                  textAlignVertical: "top",
                  backgroundColor: colors.inputBg,
                  color: colors.inputText,
                }}
              />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
                Fotos
              </Text>
              <TextInput
                placeholder="Cole links ou descreva as fotos"
                value={photos}
                onChangeText={(value) => {
                  setPhotos(value);
                  closePickers();
                }}
                placeholderTextColor={colors.placeholder}
                multiline
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 12,
                  borderRadius: 12,
                  minHeight: 80,
                  textAlignVertical: "top",
                  backgroundColor: colors.inputBg,
                  color: colors.inputText,
                }}
              />
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
            panelStyle={{
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.inputBg,
            }}
            scrollContentStyle={{ padding: 4 }}
          >
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n, index) => (
              <Pressable
                key={n}
                onPress={() => handleSelectPse(n)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: 10,
                  margin: index === 0 ? 6 : 2,
                  backgroundColor: PSE === n ? colors.primaryBg : "transparent",
                }}
              >
                <Text
                  style={{
                    color: PSE === n ? colors.primaryText : colors.text,
                    fontSize: 12,
                    fontWeight: PSE === n ? "700" : "500",
                  }}
                >
                  {n}
                </Text>
              </Pressable>
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
            panelStyle={{
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.inputBg,
            }}
            scrollContentStyle={{ padding: 4 }}
          >
            {(["nenhum", "boa", "ok", "ruim"] as const).map((value, index) => (
              <Pressable
                key={value}
                onPress={() => handleSelectTechnique(value)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: 10,
                  margin: index === 0 ? 6 : 2,
                  backgroundColor: technique === value ? colors.primaryBg : "transparent",
                }}
              >
                <Text
                  style={{
                    color: technique === value ? colors.primaryText : colors.text,
                    fontSize: 12,
                    fontWeight: technique === value ? "700" : "500",
                    textTransform: "capitalize",
                  }}
                >
                  {value}
                </Text>
              </Pressable>
            ))}
          </AnchoredDropdown>
        </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
