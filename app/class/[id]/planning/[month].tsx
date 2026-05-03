// perf-check: ignore-render -- existing month planning route has no render boundary; this PR focuses on layout parity.
// perf-check: ignore-measure -- existing monthly planning hook remains the load boundary.
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Platform, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenLoadingState } from "../../../../src/components/ui/ScreenLoadingState";
import type { ClassGender, ClassGroup, ClassPlan } from "../../../../src/core/models";
import { resolveLearningObjectives } from "../../../../src/core/pedagogy/objective-language";
import {
    getClassById,
    getDailyLessonPlanByWeekAndDate,
    upsertDailyLessonPlan,
} from "../../../../src/db/seed";
import { exportPdf, safeFileName } from "../../../../src/pdf/export-pdf";
import { SessionPlanDocument } from "../../../../src/pdf/session-plan-document";
import { sessionPlanHtml } from "../../../../src/pdf/templates/session-plan";
import type { WeekSessionPreview } from "../../../../src/screens/periodization/application/build-week-session-preview";
import { resolveLessonBlocksFromDailyPlan } from "../../../../src/screens/planning/application/daily-lesson-blocks";
import { regenerateDailyLessonPlanFromWeek } from "../../../../src/screens/planning/application/regenerate-daily-lesson-plan";
import type { MonthRegenerationProgress } from "../../../../src/screens/planning/application/regenerate-month-plans";
import { regenerateMonthPlans } from "../../../../src/screens/planning/application/regenerate-month-plans";
import { DayLessonPlanModal } from "../../../../src/screens/planning/components/DayLessonPlanModal";
import { PlanningSyncStatusChip } from "../../../../src/screens/planning/components/PlanningSyncStatusChip";
import { useDailyLessonPlan } from "../../../../src/screens/planning/hooks/useDailyLessonPlan";
import { useMonthlyPlans } from "../../../../src/screens/planning/hooks/useMonthlyPlans";
import { useAppTheme } from "../../../../src/ui/app-theme";
import { getClassPalette } from "../../../../src/ui/class-colors";
import { ClassGenderBadge } from "../../../../src/ui/ClassGenderBadge";
import { LocationBadge } from "../../../../src/ui/LocationBadge";
import { Pressable } from "../../../../src/ui/Pressable";
import { useSaveToast } from "../../../../src/ui/save-toast";
import { useCollapsibleAnimation } from "../../../../src/ui/use-collapsible";
import { useSingleAccordion } from "../../../../src/ui/use-single-accordion";
import { getLessonBlockTimes } from "../../../../src/utils/lesson-block-times";

const toMonthTitle = (monthKey: string) => {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return monthKey;
  const date = new Date(year, Math.max(month - 1, 0), 1);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date);
};

const isKnownGender = (value: unknown): value is ClassGender =>
  value === "masculino" || value === "feminino" || value === "misto";

const trimPreview = (value: string | undefined, fallback: string) => {
  const cleaned = (value ?? "").trim();
  if (!cleaned) return fallback;
  return cleaned.length > 110 ? `${cleaned.slice(0, 107).trimEnd()}...` : cleaned;
};

const compactSummaryLine = (value: string | undefined, fallback: string) => {
  const raw = trimPreview(value, fallback)
    .replace(/^(aquecimento|parte principal|volta\s*a\s*calma)\s*:\s*/i, "")
    .replace(/^os alunos\s+/i, "")
    .replace(/^a turma\s+/i, "")
    .trim();
  if (!raw) return fallback;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

const isGenericPlanningText = (value: string | undefined) => {
  const text = (value ?? "").trim();
  if (!text) return true;
  return /(aquecimento\s+e\s+mobilidade\s+especifica|aquecimento|mobilidade|atividade\s+principal|sessao|aula)/i.test(text);
};

const resolveSkillSetText = (source: string | undefined) => {
  const text = (source ?? "").toLowerCase();
  const skills: string[] = [];
  if (text.includes("toque")) skills.push("toque");
  if (text.includes("manchete")) skills.push("manchete");
  if (text.includes("saque")) skills.push("saque curto");
  if (text.includes("levantamento")) skills.push("levantamento");
  if (text.includes("ataque")) skills.push("ataque");
  if (text.includes("bloqueio")) skills.push("bloqueio");
  if (text.includes("defesa")) skills.push("defesa");

  if (!skills.length) return "toque, manchete e saque curto";
  if (skills.length === 1) return skills[0];
  if (skills.length === 2) return `${skills[0]} e ${skills[1]}`;
  return `${skills.slice(0, -1).join(", ")} e ${skills[skills.length - 1]}`;
};

const buildMainDescriptionText = (mainDescription: string | undefined, specificObjective: string | undefined) => {
  const cleaned = (mainDescription ?? "").trim();
  if (!cleaned) return "";

  const isGenericMain = /(passam por esta(ç|c)(õ|o)es.*repetir os fundamentos|atividade curta em situa(ç|c)(ã|a)o de jogo)/i.test(
    cleaned
  );

  if (!isGenericMain) return cleaned;

  const skillSet = resolveSkillSetText(specificObjective);
  return `Organizar estações de ${skillSet} com alvo. Depois, os alunos aplicam os fundamentos em uma atividade curta de jogo, com um novo desafio a cada rodada.`;
};

function WeekAccordionCard({
  label,
  weekStartLabel,
  weekEndLabel,
  sessionsCount,
  summary,
  isExpanded,
  weekStatus,
  onToggle,
  colors,
  children,
}: {
  label: string;
  weekStartLabel: string;
  weekEndLabel: string;
  sessionsCount: number;
  summary: string;
  isExpanded: boolean;
  weekStatus: "out_of_sync" | null;
  onToggle: () => void;
  colors: ReturnType<typeof useAppTheme>["colors"];
  children: React.ReactNode;
}) {
  const chevronAnim = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;
  const { animatedStyle, isVisible } = useCollapsibleAnimation(isExpanded, {
    durationIn: 220,
    durationOut: 180,
    translateY: -8,
  });

  useEffect(() => {
    Animated.timing(chevronAnim, {
      toValue: isExpanded ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [chevronAnim, isExpanded]);

  const chevronRotate = chevronAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  return (
    <View
      style={{
        borderRadius: 18,
        borderWidth: 1,
        borderColor: isExpanded ? "rgba(47, 133, 90, 0.35)" : colors.border,
        backgroundColor: colors.card,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
        elevation: 3,
      }}
    >
      <Pressable
        onPress={onToggle}
        style={{
          paddingHorizontal: 16,
          paddingVertical: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
        }}
      >
        <View
          style={{
            width: 50,
            height: 50,
            borderRadius: 14,
            backgroundColor: isExpanded ? "rgba(47, 133, 90, 0.1)" : colors.secondaryBg,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: isExpanded ? "rgba(47, 133, 90, 0.28)" : colors.border,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 15 }}>
            {label.replace(/^Semana\s*/i, "")}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700" }}>sem</Text>
        </View>

        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>{label}</Text>
            {weekStatus ? <PlanningSyncStatusChip status={weekStatus} compact /> : null}
          </View>
          <Text style={{ color: colors.muted, fontSize: 13 }} numberOfLines={1}>
            {weekStartLabel} - {weekEndLabel}
          </Text>
          <Text style={{ color: colors.text, fontSize: 13 }} numberOfLines={1}>
            {summary}
          </Text>
        </View>

        <View style={{ alignItems: "flex-end", gap: 8 }}>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>
              {sessionsCount} aula{sessionsCount === 1 ? "" : "s"}
            </Text>
          </View>
          <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
            <Ionicons name="chevron-down" size={18} color={colors.muted} />
          </Animated.View>
        </View>
      </Pressable>

      {isVisible ? (
        <Animated.View
          style={{
            ...animatedStyle,
            pointerEvents: isExpanded ? "auto" : "none",
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingHorizontal: 16,
            paddingVertical: 14,
            gap: 10,
            backgroundColor: colors.secondaryBg,
          }}
        >
          {children}
        </Animated.View>
      ) : null}
    </View>
  );
}

export default function ClassPlanningMonthRoute() {
  const { id, month } = useLocalSearchParams<{ id: string; month: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const { showSaveToast } = useSaveToast();
  const classId = typeof id === "string" ? id : "";
  const monthKey = typeof month === "string" ? month : "";
  const { expandedKey: expandedWeekId, setExpandedKey: setExpandedWeekId, toggle: toggleExpandedWeek } =
    useSingleAccordion(null, { switchDelayMs: 220 });
  const [selectedWeekPlan, setSelectedWeekPlan] = useState<ClassPlan | null>(null);
  const [selectedSession, setSelectedSession] = useState<WeekSessionPreview | null>(null);
  const [monthRegenProgress, setMonthRegenProgress] = useState<MonthRegenerationProgress | null>(null);
  const [isRegeneratingMonth, setIsRegeneratingMonth] = useState(false);

  const { selectedClass, activeCycle, weeklyItems, dailyPlansByKey, isLoading, error, reload } = useMonthlyPlans(classId, monthKey);
  const isDesktop = width >= 1040;
  const isTablet = width >= 720;
  const classPalette = getClassPalette(selectedClass?.colorKey ?? null, colors, selectedClass?.unit ?? "");
  const classGender = isKnownGender(selectedClass?.gender) ? selectedClass.gender : "misto";
  const classAgeBand = selectedClass?.ageBand || selectedClass?.name?.replace(/^Turma\s*/i, "") || "-";

  const {
    plan: selectedDailyPlan,
    save: saveDailyLessonPlan,
    regenerate: regenerateSelectedDailyPlan,
  } = useDailyLessonPlan(selectedWeekPlan, selectedSession, {
    className: selectedClass?.name,
    ageBand: selectedClass?.ageBand,
    durationMinutes: selectedClass?.durationMinutes,
    cycleStartDate: activeCycle?.startDate,
    cycleEndDate: activeCycle?.endDate,
    classGroup: selectedClass,
  });

  useEffect(() => {
    if (expandedWeekId === null) return;
    if (!weeklyItems.some((item) => item.plan.id === expandedWeekId)) {
      setExpandedWeekId(null);
    }
  }, [expandedWeekId, setExpandedWeekId, weeklyItems]);

  const handleToggleWeek = useCallback((weekId: string) => {
    toggleExpandedWeek(weekId);
  }, [toggleExpandedWeek]);

  const handleRegenerateWeekSessions = async (plan: ClassPlan, sessions: WeekSessionPreview[]) => {
    const recentPlans = Object.values(dailyPlansByKey)
      .filter((item) => item.classId === plan.classId)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 12);

    for (const session of sessions) {
      const existing = await getDailyLessonPlanByWeekAndDate(plan.id, session.date);
      const regenerated = regenerateDailyLessonPlanFromWeek({
        existing,
        weeklyPlan: plan,
        session,
        context: {
          className: selectedClass?.name,
          ageBand: selectedClass?.ageBand,
          durationMinutes: selectedClass?.durationMinutes,
          cycleStartDate: activeCycle?.startDate,
          cycleEndDate: activeCycle?.endDate,
          classGroup: selectedClass,
          recentPlans,
        },
      });
      await upsertDailyLessonPlan(regenerated);
    }
    await reload();
  };

  const handleRegenerateMonth = useCallback(async () => {
    setIsRegeneratingMonth(true);
    setMonthRegenProgress(null);
    try {
      // Fetch class group for blueprint generation
      const classGroup = (await getClassById(classId)) as ClassGroup | null;
      if (!classGroup) {
        setMonthRegenProgress({
          stage: "complete",
          message: "Erro: turma não encontrada",
        });
        setIsRegeneratingMonth(false);
        return;
      }

      // Start regeneration with progress callback
      await regenerateMonthPlans({
        classGroup,
        monthKey,
        classPlans: weeklyItems.map((item) => item.plan),
        activeCycleStartDate: activeCycle?.startDate,
        activeCycleEndDate: activeCycle?.endDate,
        onProgress: (progress) => {
          setMonthRegenProgress(progress);
        },
      });

      // Reload data after completion
      await reload();
      setMonthRegenProgress(null);
    } catch (err) {
      setMonthRegenProgress({
        stage: "complete",
        message: `Erro na regeneração: ${err instanceof Error ? err.message : "desconhecido"}`,
      });
    } finally {
      setIsRegeneratingMonth(false);
    }
  }, [activeCycle?.endDate, activeCycle?.startDate, classId, monthKey, weeklyItems, reload]);

  const monthTitle = useMemo(
    () => toMonthTitle(monthKey).replace(/^./, (char) => char.toUpperCase()),
    [monthKey]
  );

  const handleExportDailyPdf = useCallback(async () => {
    if (!selectedClass || !selectedSession || !selectedWeekPlan || !selectedDailyPlan) {
      showSaveToast({ message: "Abra uma aula com plano carregado para exportar o PDF.", variant: "error" });
      return;
    }

    const dateLabel = `${selectedSession.weekdayLabel} ${selectedSession.dateLabel}`;
    const weekLabel = `${selectedWeekPlan.weekNumber || "-"}ª semana`;
    const genderLabel =
      selectedClass.gender === "masculino"
        ? "Masculino"
        : selectedClass.gender === "feminino"
          ? "Feminino"
          : "Misto";

    const blockTimes = getLessonBlockTimes(selectedClass.durationMinutes || 60);
    const lessonBlocks = resolveLessonBlocksFromDailyPlan({
      warmup: selectedDailyPlan.warmup,
      mainPart: selectedDailyPlan.mainPart,
      cooldown: selectedDailyPlan.cooldown,
      blocksJson: selectedDailyPlan.blocksJson,
    });
    const totalDuration = lessonBlocks.reduce((sum, block) => sum + (block.durationMinutes || 0), 0);
    const fallbackTheme = selectedWeekPlan.theme || selectedWeekPlan.technicalFocus || selectedDailyPlan.mainPart || selectedDailyPlan.title;
    const resolvedTitle = isGenericPlanningText(selectedDailyPlan.title) ? fallbackTheme : selectedDailyPlan.title;
    const resolvedSpecificObjectiveRaw =
      selectedWeekPlan.specificObjective?.trim() ||
      selectedWeekPlan.generalObjective?.trim() ||
      selectedWeekPlan.technicalFocus?.trim() ||
      selectedDailyPlan.mainPart?.trim() ||
      "";
    const resolvedObjectives = resolveLearningObjectives({
      generalObjective: selectedWeekPlan.generalObjective,
      specificObjective: resolvedSpecificObjectiveRaw,
      title: resolvedTitle,
      theme: selectedWeekPlan.theme,
      technicalFocus: selectedWeekPlan.technicalFocus,
      weeklyFocus: selectedWeekPlan.theme || selectedWeekPlan.technicalFocus,
      pedagogicalRule: selectedWeekPlan.pedagogicalRule,
      ageBand: selectedClass.ageBand,
      sportProfile: selectedClass.modality,
    });
    const resolvedSpecificObjective = resolvedObjectives.specificObjective;
    const resolvedGeneralObjective = resolvedObjectives.generalObjective;
    const mainBlock = lessonBlocks.find((block) => block.key === "main");
    const mainBlockDescription =
      mainBlock?.activities.map((item) => item.description).filter(Boolean).join("\n") ||
      selectedDailyPlan.mainPart;
    const resolvedMainDescription = buildMainDescriptionText(mainBlockDescription, resolvedSpecificObjective);

    const pdfData = {
      className: selectedClass.name,
      ageGroup: selectedClass.ageBand,
      unitLabel: selectedClass.unit,
      genderLabel,
      dateLabel,
      weekLabel,
      title: resolvedTitle,
      objective: resolvedSpecificObjective || selectedWeekPlan.theme,
      generalObjective: resolvedGeneralObjective,
      specificObjective: resolvedSpecificObjective,
      weeklyFocus: selectedWeekPlan.theme || selectedWeekPlan.technicalFocus,
      pedagogicalRule: selectedWeekPlan.pedagogicalRule,
      totalTime: `${totalDuration > 0 ? totalDuration : blockTimes.totalMinutes} min`,
      notes: selectedDailyPlan.observations,
      blocks: lessonBlocks.map((block) => ({
        key: block.key,
        label: block.label,
        durationMinutes: block.durationMinutes,
        activities:
          block.key === "main"
            ? block.activities.map((activity, index) =>
                index === 0
                  ? { ...activity, description: resolvedMainDescription || activity.description }
                  : activity
              )
            : block.activities,
      })),
    };

    const html = sessionPlanHtml(pdfData);
    const webDocument = Platform.OS === "web" ? <SessionPlanDocument data={pdfData} /> : undefined;
    const safeClass = safeFileName(selectedClass.name);
    const safeDate = safeFileName(selectedDailyPlan.date);
    const fileName = `plano-aula-dia-${safeClass}-${safeDate}.pdf`;

    await exportPdf({ html, fileName, webDocument });
    showSaveToast({ message: "PDF da aula gerado com contexto semanal.", variant: "success" });
  }, [selectedClass, selectedSession, selectedWeekPlan, selectedDailyPlan, showSaveToast]);
  const handleBackToMonths = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    if (classId) {
      router.replace({
        pathname: "/class/[id]/planning",
        params: { id: classId },
      });
      return;
    }

    router.replace("/");
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenLoadingState />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          gap: 16,
          paddingHorizontal: isDesktop ? 24 : 16,
          paddingTop: 16,
          paddingBottom: Math.max(insets.bottom + 40, 56),
          width: "100%",
          maxWidth: 1180,
          alignSelf: "center",
        }}
      >
        <View
          style={{
            flexDirection: isTablet ? "row" : "column",
            alignItems: isTablet ? "flex-start" : "stretch",
            justifyContent: "space-between",
            gap: 14,
          }}
        >
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable
                onPress={handleBackToMonths}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="chevron-back" size={22} color={colors.text} />
              </Pressable>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: isDesktop ? 30 : 26 }}>
                {monthTitle}
              </Text>
            </View>
            <Text style={{ color: colors.muted, fontSize: 14, marginLeft: isTablet ? 42 : 0 }}>
              Visão semanal e diária do planejamento.
            </Text>
          </View>

          <View style={{ alignItems: isTablet ? "flex-end" : "flex-start", gap: 6, maxWidth: "100%" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: classPalette.bg }} />
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
                Turma {classAgeBand}
              </Text>
              <ClassGenderBadge gender={classGender} size="md" />
            </View>
            <LocationBadge
              location={selectedClass?.unit || "Unidade"}
              palette={classPalette}
              size="sm"
              showIcon
            />
          </View>
        </View>

        <View
          style={{
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            padding: 14,
            flexDirection: isTablet ? "row" : "column",
            justifyContent: "space-between",
            alignItems: isTablet ? "center" : "stretch",
            gap: 12,
          }}
        >
          <View style={{ gap: 4 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}>Resumo do mês</Text>
            <Text style={{ color: colors.muted, fontWeight: "700" }}>
              {weeklyItems.length} semanas · {weeklyItems.reduce((sum, item) => sum + item.sessions.length, 0)} aulas
            </Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: isTablet ? "flex-end" : "flex-start" }}>
            <Pressable
              onPress={() => {
                void handleRegenerateMonth();
              }}
              disabled={isRegeneratingMonth || isLoading}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 9,
                borderRadius: 12,
                backgroundColor: colors.secondaryBg,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: isRegeneratingMonth ? 0.8 : 1,
              }}
            >
              {isRegeneratingMonth ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <Ionicons name="refresh" size={14} color={colors.text} />
              )}
              <Text
                style={{
                  color: colors.text,
                  fontWeight: "600",
                  fontSize: 12,
                }}
              >
                {isRegeneratingMonth ? "Regenerando..." : "Regenerar mês"}
              </Text>
            </Pressable>
          </View>
        </View>

          {monthRegenProgress && monthRegenProgress.stage !== "complete" ? (
            <View style={{ gap: 4, padding: 10, borderRadius: 12, backgroundColor: colors.secondaryBg }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <ActivityIndicator size="small" color={colors.primaryText} />
                <Text style={{ color: colors.text, fontWeight: "600" }}>{monthRegenProgress.message}</Text>
              </View>
              {monthRegenProgress.total ? (
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {monthRegenProgress.currentIndex}/{monthRegenProgress.total}
                </Text>
              ) : null}
            </View>
          ) : null}

        {error ? (
          <View style={{ gap: 6, paddingHorizontal: 10, paddingVertical: 12 }}>
            <Text style={{ color: colors.dangerText, fontWeight: "700" }}>Falha ao carregar o mês</Text>
            <Text style={{ color: colors.muted }}>{error}</Text>
          </View>
        ) : null}

        {!weeklyItems.length ? (
          <View style={{ gap: 6, paddingHorizontal: 10, paddingVertical: 12 }}>
            <Text style={{ color: colors.text, fontWeight: "700" }}>Sem semanas neste mês</Text>
            <Text style={{ color: colors.muted }}>
              O mês ainda não possui planos semanais gerados para esta turma.
            </Text>
          </View>
        ) : null}

        <View style={{ gap: 10 }}>
          {weeklyItems.map((item) => {
            const isExpanded = expandedWeekId === item.plan.id;
            const hasOutOfSyncDay = item.sessions.some((session) => {
              const key = `${item.plan.id}::${session.date}`;
              return dailyPlansByKey[key]?.syncStatus === "out_of_sync";
            });
            const weekStatus = hasOutOfSyncDay ? "out_of_sync" : null;
            return (
              <WeekAccordionCard
                key={item.plan.id}
                label={item.label}
                weekStartLabel={item.weekStartLabel}
                weekEndLabel={item.weekEndLabel}
                sessionsCount={item.sessions.length}
                summary={item.plan.theme?.trim() || item.plan.technicalFocus?.trim() || item.plan.generalObjective?.trim() || "Planejamento da semana"}
                isExpanded={isExpanded}
                weekStatus={weekStatus}
                onToggle={() => handleToggleWeek(item.plan.id)}
                colors={colors}
              >
                <Pressable
                  onPress={() => {
                    void handleRegenerateWeekSessions(item.plan, item.sessions);
                  }}
                  style={{
                    alignSelf: "flex-start",
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 12,
                    backgroundColor: colors.secondaryBg,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                    Regenerar aulas da semana
                  </Text>
                </Pressable>
                {item.sessions.map((session) => (
                  (() => {
                    const sessionPlan = dailyPlansByKey[`${item.plan.id}::${session.date}`];
                    const sessionBlocks = sessionPlan
                      ? resolveLessonBlocksFromDailyPlan({
                          warmup: sessionPlan.warmup,
                          mainPart: sessionPlan.mainPart,
                          cooldown: sessionPlan.cooldown,
                          blocksJson: sessionPlan.blocksJson,
                        })
                      : [];
                    const warmupPreview =
                      sessionBlocks.find((block) => block.key === "warmup")?.activities[0]?.name ||
                      sessionPlan?.warmup;
                    const mainPreview =
                      sessionBlocks.find((block) => block.key === "main")?.activities[0]?.name ||
                      sessionPlan?.mainPart;
                    const cooldownPreview =
                      sessionBlocks.find((block) => block.key === "cooldown")?.activities[0]?.name ||
                      sessionPlan?.cooldown;
                    const sessionStatus = sessionPlan?.syncStatus ?? "in_sync";
                    const showSessionStatus = sessionStatus !== "in_sync";

                    return (
                      <Pressable
                        key={session.date}
                        onPress={() => {
                          setSelectedWeekPlan(item.plan);
                          setSelectedSession(session);
                        }}
                        style={{
                          gap: 6,
                          backgroundColor: colors.secondaryBg,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          borderRadius: 12,
                        }}
                      >
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <Text style={{ color: colors.text, fontWeight: "700" }}>
                            {session.weekdayLabel} {session.dateLabel}
                          </Text>
                          {showSessionStatus ? <PlanningSyncStatusChip compact status={sessionStatus} /> : null}
                        </View>
                        <Text style={{ color: colors.muted, fontSize: 12 }}>
                          {compactSummaryLine(warmupPreview, "Revisão em dupla")}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 12 }}>
                          {compactSummaryLine(mainPreview, `Atividade principal com ${item.plan.theme || "fundamentos"}`)}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 12 }}>
                          {compactSummaryLine(cooldownPreview, "Conversa final")}
                        </Text>
                      </Pressable>
                    );
                  })()
                ))}
              </WeekAccordionCard>
            );
          })}
        </View>
      </ScrollView>

      <DayLessonPlanModal
        visible={Boolean(selectedWeekPlan && selectedSession)}
        initialPlan={selectedDailyPlan}
        dayLabel={selectedSession ? `${selectedSession.weekdayLabel} ${selectedSession.dateLabel}` : "Plano diário"}
        onClose={() => {
          setSelectedWeekPlan(null);
          setSelectedSession(null);
        }}
        onRegenerate={async () => {
          await regenerateSelectedDailyPlan();
          await reload();
        }}
        onSave={async (payload) => {
          await saveDailyLessonPlan(payload);
          await reload();
        }}
        onExportPdf={handleExportDailyPdf}
      />
    </SafeAreaView>
  );
}
