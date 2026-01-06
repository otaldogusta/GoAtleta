import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Pressable } from "../../../src/ui/Pressable";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getClassById,
  getTrainingPlans,
  getClasses,
  getSessionLogByDate,
} from "../../../src/db/seed";
import type { ClassGroup, SessionLog, TrainingPlan } from "../../../src/core/models";
import { useAppTheme } from "../../../src/ui/app-theme";
import { exportPdf, safeFileName } from "../../../src/pdf/export-pdf";
import { sessionPlanHtml } from "../../../src/pdf/templates/session-plan";
import { SessionPlanDocument } from "../../../src/pdf/web/session-plan-document";
import { logAction } from "../../../src/observability/breadcrumbs";
import { measure } from "../../../src/observability/perf";
import { useSaveToast } from "../../../src/ui/save-toast";

export default function SessionScreen() {
  const { id, date } = useLocalSearchParams<{ id: string; date?: string }>();
  const router = useRouter();
  const { colors, mode } = useAppTheme();
  const { showSaveToast } = useSaveToast();
  const [cls, setCls] = useState<ClassGroup | null>(null);
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [sessionLog, setSessionLog] = useState<SessionLog | null>(null);
  const sessionDate =
    typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : new Date().toISOString().slice(0, 10);
  const [scheduleText, setScheduleText] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [remainingSec, setRemainingSec] = useState(0);
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
    let alive = true;
    (async () => {
      const data = await getClassById(id);
      if (alive) setCls(data);
      if (data) {
        const plans = await getTrainingPlans();
        const byClass = plans.filter((item) => item.classId === data.id);
        const byDate = byClass.find((item) => item.applyDate === sessionDate);
        const byWeekday = byClass.find((item) =>
          (item.applyDays ?? []).includes(weekdayId)
        );
        if (alive) setPlan(byDate ?? byWeekday ?? null);
        const classes = await getClasses();
        const index = classes.findIndex((item) => item.id === data.id);
        if (index >= 0) {
          const parsed = parseTime(data.startTime || "");
          const startHour = parsed?.hour ?? 14 + index;
          const startMinute = parsed?.minute ?? 0;
          const durationMinutes = data.durationMinutes ?? 60;
          const time = formatRange(startHour, startMinute, durationMinutes);
          const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
          const days = data.daysOfWeek.length
            ? data.daysOfWeek.map((day) => dayNames[day]).join(", ")
            : "-";
          if (alive) setScheduleText("Dias: " + days + " - " + time);
        }
      }
      if (id) {
        const log = await getSessionLogByDate(id, sessionDate);
        if (alive) setSessionLog(log);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, sessionDate]);

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
  const headerSubtitle = block ? cls?.name + " - " + block : cls?.name ?? "";

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
      showSaveToast({ message: "Nao foi possivel gerar o PDF.", variant: "error" });
      Alert.alert("Falha ao exportar PDF", "Tente novamente.");
    }
  };

  useEffect(() => {
    setRemainingSec(durations[activeIndex] * 60);
    setRunning(false);
  }, [activeIndex, durations]);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      setRemainingSec((prev) => {
        if (prev <= 1) {
          setRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [running]);

  const formatTime = (value: number) => {
    const mins = Math.floor(value / 60);
    const secs = value % 60;
    return String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
  };

  if (!cls) return null;

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, backgroundColor: colors.background }}>
      <View style={{ gap: 6, marginBottom: 12 }}>
        <Text style={{ fontSize: 26, fontWeight: "700", color: colors.text }}>
          {title}
        </Text>
        <Text style={{ color: colors.muted }}>{headerSubtitle}</Text>
        {scheduleText ? (
          <Text style={{ color: colors.text }}>Horario: {scheduleText}</Text>
        ) : null}
        {showNoPlanNotice ? (
          <View
            style={{
              marginTop: 8,
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 12,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
              alignSelf: "flex-start",
            }}
          >
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              Sem treino aplicado para esse dia
            </Text>
          </View>
        ) : null}
      </View>

      {plan ? (
        <View
          style={{
            padding: 16,
            borderRadius: 20,
            backgroundColor: colors.primaryBg,
            marginBottom: 12,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.primaryText, fontSize: 14, opacity: 0.85 }}>
                Cronometro do bloco
              </Text>
              <Text style={{ color: colors.primaryText, fontSize: 28, fontWeight: "700" }}>
                {formatTime(remainingSec)}
              </Text>
            </View>
            <Pressable
              onPress={handleExportPdf}
              style={{
                alignSelf: "flex-start",
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: colors.secondaryBg,
              }}
            >
              <Text style={{ fontWeight: "700", color: colors.text }}>
                Exportar PDF
              </Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <Pressable
              onPress={() => setRunning((prev) => !prev)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: running ? colors.warningBg : colors.successBg,
              }}
            >
              <Text style={{ fontWeight: "700", color: colors.warningText }}>
                {running ? "Pausar" : "Iniciar"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setRemainingSec(durations[activeIndex] * 60);
                setRunning(false);
              }}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: colors.secondaryBg,
              }}
            >
              <Text style={{ fontWeight: "700", color: colors.text }}>Reset</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                setActiveIndex((prev) => Math.min(prev + 1, 2))
              }
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: colors.secondaryBg,
              }}
            >
              <Text style={{ fontWeight: "700", color: colors.text }}>
                Proximo bloco
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={{ paddingVertical: 12, gap: 12 }}>
        {plan
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
                <Text style={{ color: colors.muted, marginTop: 6 }}>
                  {section.items.length ? section.items.join(" - ") : "Sem itens"}
                </Text>
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
        {!plan ? (
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
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
            Relatorio da aula
          </Text>
          <Text style={{ color: colors.muted }}>
            {sessionDate.split("-").reverse().join("/")}
          </Text>
          {sessionLog ? (
            <View style={{ gap: 4 }}>
              <Text style={{ color: colors.text }}>
                {"RPE: " + sessionLog.rpe}
              </Text>
              <Text style={{ color: colors.text }}>
                {"Tecnica: " + sessionLog.technique}
              </Text>
              <Text style={{ color: colors.text }}>
                {"Presenca: " + sessionLog.attendance + "%"}
              </Text>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/class/[id]/log",
                    params: { id, date: sessionDate },
                  })
                }
                style={{
                  marginTop: 8,
                  alignSelf: "flex-start",
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  backgroundColor: colors.secondaryBg,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>
                  Editar relatorio
                </Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/class/[id]/log",
                  params: { id, date: sessionDate },
                })
              }
              style={{
                alignSelf: "flex-start",
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: colors.primaryBg,
              }}
            >
              <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
                Registrar relatorio
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}



