import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenPageHeader } from "../../../../src/components/ui/ScreenPageHeader";
import { ScreenLoadingState } from "../../../../src/components/ui/ScreenLoadingState";
import type { ClassGroup, ClassPlan } from "../../../../src/core/models";
import { resolveLearningObjectives } from "../../../../src/core/pedagogy/objective-language";
import {
    getClassById,
    getDailyLessonPlanByWeekAndDate,
    listDailyLessonPlansByWeekIds,
    upsertDailyLessonPlan,
} from "../../../../src/db/seed";
import { navigateBackOrReplace } from "../../../../src/navigation/safe-router";
import { exportPdf, safeFileName } from "../../../../src/pdf/export-pdf";
import { MonthlyLessonPlanDocument } from "../../../../src/pdf/monthly-lesson-plan-document";
import { SessionPlanDocument } from "../../../../src/pdf/session-plan-document";
import { monthlyPlanHtml } from "../../../../src/pdf/templates/monthly-plan";
import { sessionPlanHtml } from "../../../../src/pdf/templates/session-plan";
import type { WeekSessionPreview } from "../../../../src/screens/periodization/application/build-week-session-preview";
import { resolveLessonBlocksFromDailyPlan } from "../../../../src/screens/planning/application/daily-lesson-blocks";
import type { MonthPlanningSummary } from "../../../../src/screens/planning/application/month-planning-summary";
import { buildMonthlyPlanExportData } from "../../../../src/screens/planning/application/monthly-plan-export";
import type {
  ProfessorAgendaCalendarDay,
  ProfessorAgendaEvent,
} from "../../../../src/screens/planning/application/professor-agenda-events";
import { regenerateDailyLessonPlanFromWeek } from "../../../../src/screens/planning/application/regenerate-daily-lesson-plan";
import type { MonthRegenerationProgress } from "../../../../src/screens/planning/application/regenerate-month-plans";
import { regenerateMonthPlans } from "../../../../src/screens/planning/application/regenerate-month-plans";
import { DayLessonPlanModal } from "../../../../src/screens/planning/components/DayLessonPlanModal";
import { PlanningSyncStatusChip } from "../../../../src/screens/planning/components/PlanningSyncStatusChip";
import { GoAtletaIcon, type GoAtletaIconName } from "../../../../src/ui/icon-registry";
import { useDailyLessonPlan } from "../../../../src/screens/planning/hooks/useDailyLessonPlan";
import { useMonthlyPlans } from "../../../../src/screens/planning/hooks/useMonthlyPlans";
import { useAppTheme } from "../../../../src/ui/app-theme";
import { CollapsibleSection } from "../../../../src/ui/CollapsibleSection";
import { DatePickerModal } from "../../../../src/ui/DatePickerModal";
import { Pressable } from "../../../../src/ui/Pressable";
import { useSaveToast } from "../../../../src/ui/save-toast";
import { getSectionCardStyle } from "../../../../src/ui/section-styles";
import { useSingleAccordion } from "../../../../src/ui/use-single-accordion";
import { getLessonBlockTimes } from "../../../../src/utils/lesson-block-times";
import { markRender } from "../../../../src/observability/perf";

const toMonthTitle = (monthKey: string) => {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return monthKey;
  const date = new Date(year, Math.max(month - 1, 0), 1);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date);
};

const parseMonthKey = (value: string) => {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return { year, month };
};

const shiftMonthKey = (value: string, delta: number) => {
  const parsed = parseMonthKey(value);
  if (!parsed) return value;
  const date = new Date(parsed.year, parsed.month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const toMonthPickerValue = (value: string) => {
  const parsed = parseMonthKey(value);
  if (!parsed) return `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;
  return `${parsed.year}-${String(parsed.month).padStart(2, "0")}-01`;
};

const toMonthPickerLabel = (value: string) => {
  const parsed = parseMonthKey(value);
  if (!parsed) return value;
  const date = new Date(parsed.year, parsed.month - 1, 1);
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date);
  return label.replace(/^./, (char) => char.toUpperCase()).replace(/\s+de\s+/i, " ");
};

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
  return (
    <CollapsibleSection
      expanded={isExpanded}
      onToggle={onToggle}
      containerStyle={[
        getSectionCardStyle(colors, "primary", { padding: 11, radius: 14, shadow: false }),
        { borderWidth: 1, borderColor: colors.border, gap: 6 },
      ]}
      header={
        <View style={{ gap: 5 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>{label}</Text>
            <View
              style={{
                borderRadius: 999,
                paddingHorizontal: 8,
                paddingVertical: 3,
                backgroundColor: colors.secondaryBg,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>
                {sessionsCount} aula{sessionsCount === 1 ? "" : "s"}
              </Text>
            </View>
          </View>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {weekStartLabel} - {weekEndLabel}
          </Text>
          <Text style={{ color: colors.text, fontSize: 13, lineHeight: 17 }} numberOfLines={1}>
            {summary}
          </Text>
        </View>
      }
      headerStyle={{ flexDirection: "row", alignItems: "center", gap: 10 }}
      contentContainerStyle={{
        gap: 8,
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: colors.border,
      }}
      rightAdornment={weekStatus ? <PlanningSyncStatusChip status={weekStatus} compact /> : null}
      chevronColor={colors.muted}
      contentDurationIn={220}
      contentDurationOut={180}
      contentTranslateY={-8}
    >
      {children}
    </CollapsibleSection>
  );
}

function PlanningPill({
  icon,
  label,
  colors,
}: {
  icon?: GoAtletaIconName;
  label: string;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        maxWidth: "100%",
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: colors.secondaryBg,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      {icon ? <GoAtletaIcon name={icon} size={13} color={colors.muted} /> : null}
      <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700", flexShrink: 1 }}>{label}</Text>
    </View>
  );
}

const WEEKDAY_HEADERS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

const getCompactWeekLabel = (event: ProfessorAgendaEvent) =>
  Number.isFinite(event.weekNumber) ? `S${event.weekNumber}` : event.weekLabel.replace(/^Semana\s+/i, "S");

const toTodayIsoDate = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
};

const joinShortList = (items: string[]) => {
  const unique = [...new Set(items.map((item) => item.trim()).filter(Boolean))];
  if (!unique.length) return "-";
  if (unique.length === 1) return unique[0];
  if (unique.length === 2) return `${unique[0]} e ${unique[1]}`;
  return `${unique.slice(0, 2).join(", ")} +${unique.length - 2}`;
};

const buildMonthFocusSummary = (weeklyItems: Array<{ plan: ClassPlan }>) => {
  const focuses = weeklyItems
    .map((item) => item.plan.theme || item.plan.technicalFocus || item.plan.generalObjective || "")
    .map((item) => item.trim())
    .filter(Boolean);
  return joinShortList(focuses);
};

function SummaryMetric({
  icon,
  label,
  value,
  colors,
}: {
  icon: GoAtletaIconName;
  label: string;
  value: string;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minWidth: 128, flexGrow: 1, flexBasis: 0 }}>
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.secondaryBg,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <GoAtletaIcon name={icon} size={15} color={colors.muted} />
      </View>
      <View style={{ minWidth: 0, flex: 1 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, fontWeight: "900" }}>
          {value}
        </Text>
        <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>
          {label}
        </Text>
      </View>
    </View>
  );
}

function MonthSummaryPanel({
  events,
  weekCount,
  focus,
  colors,
}: {
  events: ProfessorAgendaEvent[];
  weekCount: number;
  focus: string;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  const todayIso = toTodayIsoDate();
  const nextEvent = events.find((event) => event.date >= todayIso) ?? events[0] ?? null;
  const classDayCount = new Set(events.map((event) => event.date)).size;
  const weekdaySummary = joinShortList(events.map((event) => event.weekdayLabel));
  const nextEventLabel = nextEvent ? `${nextEvent.dateLabel.slice(0, 5)} · ${getCompactWeekLabel(nextEvent)}` : "-";
  const nextEventTitle = nextEvent?.title ?? "Sem aula programada";

  return (
    <View style={[getSectionCardStyle(colors, "neutral", { padding: 12, radius: 14, shadow: false }), { gap: 12 }]}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <View style={{ minWidth: 0, flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 15 }}>Resumo do mês</Text>
          <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
            {focus}
          </Text>
        </View>
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
          {weekCount} semana{weekCount === 1 ? "" : "s"}
        </Text>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <SummaryMetric
          icon="calendar"
          label="aulas no mês"
          value={`${events.length} aula${events.length === 1 ? "" : "s"}`}
          colors={colors}
        />
        <SummaryMetric
          icon="agenda"
          label="dias com aula"
          value={`${classDayCount} dia${classDayCount === 1 ? "" : "s"}`}
          colors={colors}
        />
        <SummaryMetric icon="repeat" label="rotina" value={weekdaySummary} colors={colors} />
        <SummaryMetric icon="flag" label="próxima aula" value={nextEventLabel} colors={colors} />
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <GoAtletaIcon name="chevronForwardCircle" size={16} color={colors.muted} />
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 12, fontWeight: "800", flex: 1 }}>
          {nextEventTitle}
        </Text>
      </View>
    </View>
  );
}

function CalendarEventCard({
  event,
  compact = false,
  colors,
  onPress,
}: {
  event: ProfessorAgendaEvent;
  compact?: boolean;
  colors: ReturnType<typeof useAppTheme>["colors"];
  onPress: () => void;
}) {
  const statusColor =
    event.status === "needs_review"
      ? colors.warningText
      : event.status === "ready"
        ? colors.successText
        : colors.muted;
  const statusBg =
    event.status === "needs_review"
      ? colors.warningBg
      : event.status === "ready"
        ? colors.successBg
        : colors.secondaryBg;

  if (compact) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Abrir ${event.title}`}
        onPress={onPress}
        style={{
          minHeight: 24,
          justifyContent: "center",
          gap: 3,
          paddingHorizontal: 5,
          paddingVertical: 5,
          borderRadius: 9,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, minWidth: 0 }}>
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: statusColor,
            }}
          />
          <Text
            numberOfLines={1}
            style={{ color: colors.text, fontSize: 10, fontWeight: "900", minWidth: 0, flexShrink: 1 }}
          >
            {getCompactWeekLabel(event)}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={{
        gap: 3,
        minHeight: 42,
        paddingHorizontal: 7,
        paddingVertical: 6,
        borderRadius: 9,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 5 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flex: 1, minWidth: 0 }}>
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: statusColor,
            }}
          />
          <Text numberOfLines={1} style={{ color: colors.text, fontSize: 10, fontWeight: "900", flexShrink: 1 }}>
            {getCompactWeekLabel(event)}
          </Text>
        </View>
        <View
          style={{
            paddingHorizontal: 5,
            paddingVertical: 2,
            borderRadius: 999,
            backgroundColor: statusBg,
            maxWidth: "62%",
          }}
        >
          <Text numberOfLines={1} style={{ color: statusColor, fontSize: 9, fontWeight: "800" }}>
            {event.statusLabel}
          </Text>
        </View>
      </View>
      <Text numberOfLines={1} style={{ color: colors.text, fontSize: 11, fontWeight: "800", lineHeight: 14 }}>
        {event.title}
      </Text>
    </Pressable>
  );
}

function MonthCalendarGrid({
  days,
  compact,
  colors,
  onSelectEvent,
}: {
  days: ProfessorAgendaCalendarDay[];
  compact: boolean;
  colors: ReturnType<typeof useAppTheme>["colors"];
  onSelectEvent: (event: ProfessorAgendaEvent) => void;
}) {
  const rows: ProfessorAgendaCalendarDay[][] = [];
  for (let index = 0; index < days.length; index += 7) {
    rows.push(days.slice(index, index + 7));
  }

  return (
    <View style={[getSectionCardStyle(colors, "neutral", { padding: compact ? 8 : 10, radius: 16, shadow: false }), { gap: 8 }]}>
      <View style={{ flexDirection: "row", gap: compact ? 4 : 6 }}>
        {WEEKDAY_HEADERS.map((label) => (
          <Text key={label} style={{ flex: 1, color: colors.muted, fontSize: 11, fontWeight: "800", textAlign: "center" }}>
            {label}
          </Text>
        ))}
      </View>
      {rows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={{ flexDirection: "row", gap: compact ? 4 : 6 }}>
          {row.map((day) => {
            const hasEvent = day.events.length > 0;
            const visibleEventsLimit = compact ? 2 : 3;
            return (
              <View
                key={day.date}
                style={{
                  flex: 1,
                  minHeight: compact ? 78 : 108,
                  gap: compact ? 4 : 6,
                  padding: compact ? 5 : 8,
                  borderRadius: compact ? 10 : 12,
                  backgroundColor: hasEvent ? colors.secondaryBg : colors.backgroundSubtle,
                  borderWidth: 1,
                  borderColor: hasEvent ? colors.successBorder : colors.border,
                  opacity: day.isCurrentMonth ? 1 : 0.35,
                }}
              >
                <Text style={{ color: hasEvent ? colors.text : colors.muted, fontSize: 12, fontWeight: "900" }}>
                  {day.dayOfMonth}
                </Text>
                {day.events.slice(0, visibleEventsLimit).map((event) => (
                  <CalendarEventCard
                    key={event.id}
                    event={event}
                    compact={compact}
                    colors={colors}
                    onPress={() => onSelectEvent(event)}
                  />
                ))}
                {day.events.length > visibleEventsLimit ? (
                  <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700" }}>
                    +{day.events.length - visibleEventsLimit} aula{day.events.length - visibleEventsLimit === 1 ? "" : "s"}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export default function ClassPlanningMonthRoute() {
  // perf-check: ignore-measure — a carga real é instrumentada dentro de useMonthlyPlans.
  markRender("screen.planningMonth.render.root");
  const { id, month } = useLocalSearchParams<{ id: string; month: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors } = useAppTheme();
  const { showSaveToast } = useSaveToast();
  const classId = typeof id === "string" ? id : "";
  const monthKey = typeof month === "string" ? month : "";
  const { expandedKey: expandedWeekId, setExpandedKey: setExpandedWeekId, toggle: toggleExpandedWeek } =
    useSingleAccordion(null, { switchDelayMs: 220 });
  const [selectedWeekPlan, setSelectedWeekPlan] = useState<ClassPlan | null>(null);
  const [selectedSession, setSelectedSession] = useState<WeekSessionPreview | null>(null);
  const [selectedAgendaEvent, setSelectedAgendaEvent] = useState<ProfessorAgendaEvent | null>(null);
  const [monthRegenProgress, setMonthRegenProgress] = useState<MonthRegenerationProgress | null>(null);
  const [isRegeneratingMonth, setIsRegeneratingMonth] = useState(false);
  const [isExportingMonth, setIsExportingMonth] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const {
    selectedClass,
    activeCycle,
    calendarExceptions,
    students,
    recentAttendance,
    recentSessionLogs,
    weeklyItems,
    agendaEvents,
    monthCalendarDays,
    dailyPlansByKey,
    isLoading,
    error,
    reload,
  } = useMonthlyPlans(classId, monthKey);

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
        calendarExceptions,
        students,
        recentAttendance,
        recentSessionLogs,
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
  }, [
    activeCycle?.endDate,
    activeCycle?.startDate,
    calendarExceptions,
    classId,
    monthKey,
    recentAttendance,
    recentSessionLogs,
    students,
    weeklyItems,
    reload,
  ]);

  const monthTitle = useMemo(
    () => toMonthTitle(monthKey).replace(/^./, (char) => char.toUpperCase()),
    [monthKey]
  );
  const monthSessionCount = agendaEvents.length;
  const monthFocusSummary = useMemo(() => buildMonthFocusSummary(weeklyItems), [weeklyItems]);
  const isCompactCalendar = width < 900;

  const handleSelectAgendaEvent = useCallback((event: ProfessorAgendaEvent) => {
    setSelectedAgendaEvent(event);
    setSelectedWeekPlan(event.plan);
    setSelectedSession(event.session);
  }, []);

  const goToMonth = useCallback((nextMonthKey: string) => {
    if (!classId || nextMonthKey === monthKey) return;
    router.replace({
      pathname: "/class/[id]/planning/[month]",
      params: { id: classId, month: nextMonthKey },
    });
  }, [classId, monthKey, router]);

  const goToPreviousMonth = useCallback(() => {
    goToMonth(shiftMonthKey(monthKey, -1));
  }, [goToMonth, monthKey]);

  const goToNextMonth = useCallback(() => {
    goToMonth(shiftMonthKey(monthKey, 1));
  }, [goToMonth, monthKey]);

  const handleMonthPickerChange = useCallback((value: string) => {
    const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(value);
    if (!match) return;
    goToMonth(`${match[1]}-${match[2]}`);
    setShowMonthPicker(false);
  }, [goToMonth]);

  const currentMonthSummary = useMemo<MonthPlanningSummary>(() => {
    const parsed = parseMonthKey(monthKey);
    return {
      monthKey,
      label: toMonthTitle(monthKey),
      year: parsed?.year ?? new Date().getFullYear(),
      month: parsed?.month ?? new Date().getMonth() + 1,
      weekCount: weeklyItems.length,
      estimatedLessonCount: monthSessionCount,
      hasPlans: weeklyItems.length > 0,
    };
  }, [monthKey, monthSessionCount, weeklyItems.length]);

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

  const handleExportMonthPdf = useCallback(async () => {
    if (!selectedClass || !currentMonthSummary.hasPlans || isExportingMonth) {
      showSaveToast({ message: "Este mês ainda não possui plano para exportar.", variant: "error" });
      return;
    }

    setIsExportingMonth(true);
    showSaveToast({ message: "Gerando PDF do mês...", variant: "success" });

    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      const monthPlans = weeklyItems.map((item) => item.plan);
      const dailyPlans = await listDailyLessonPlansByWeekIds(monthPlans.map((plan) => plan.id));
      const dailyPlansByKeyForExport = Object.fromEntries(
        dailyPlans.map((plan) => [`${plan.weeklyPlanId}::${plan.date}`, plan])
      );
      const data = buildMonthlyPlanExportData({
        classGroup: selectedClass,
        month: currentMonthSummary,
        plans: monthPlans,
        dailyPlansByKey: dailyPlansByKeyForExport,
        exceptions: calendarExceptions,
      });
      const html = monthlyPlanHtml(data);
      const fileBase = `plano-mensal-${safeFileName(selectedClass.name)}-${safeFileName(monthKey)}`;
      const webDocument = Platform.OS === "web" ? <MonthlyLessonPlanDocument data={data} /> : undefined;

      await exportPdf({ html, fileName: `${fileBase}.pdf`, webDocument });

      showSaveToast({ message: "Plano mensal exportado.", variant: "success" });
    } catch (exportError) {
      showSaveToast({
        message: exportError instanceof Error ? exportError.message : "Falha ao exportar o plano mensal.",
        variant: "error",
      });
    } finally {
      setIsExportingMonth(false);
    }
  }, [
    calendarExceptions,
    currentMonthSummary,
    isExportingMonth,
    monthKey,
    selectedClass,
    showSaveToast,
    weeklyItems,
  ]);

  const handleBackToClass = () => {
    if (classId) {
      navigateBackOrReplace({
        router,
        fallback: { pathname: "/class/[id]", params: { id: classId } },
      });
      return;
    }

    navigateBackOrReplace({ router, fallback: "/classes" });
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
      <ScreenPageHeader
        title={monthTitle}
        subtitle={selectedClass?.name ? `${selectedClass.name} · calendário de aulas` : "Calendário de aulas"}
        onBack={handleBackToClass}
        right={
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Exportar plano mensal"
              onPress={() => {
                void handleExportMonthPdf();
              }}
              disabled={isExportingMonth || !currentMonthSummary.hasPlans}
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.secondaryBg,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: isExportingMonth || !currentMonthSummary.hasPlans ? 0.55 : 1,
              }}
            >
              {isExportingMonth ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <GoAtletaIcon name="download" size={18} color={colors.text} />
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Regenerar mês"
              onPress={() => {
                void handleRegenerateMonth();
              }}
              disabled={isRegeneratingMonth || isLoading}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 10,
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
                <GoAtletaIcon name="refresh" size={14} color={colors.text} />
              )}
              <Text style={{ color: colors.text, fontWeight: "600", fontSize: 12 }}>
                {isRegeneratingMonth ? "Regenerando..." : "Regenerar mês"}
              </Text>
            </Pressable>
          </View>
        }
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mês anterior"
            onPress={goToPreviousMonth}
            hitSlop={8}
            style={{
              width: 36,
              height: 36,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 18,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <GoAtletaIcon name="chevronBack" size={18} color={colors.muted} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Escolher mês do calendário"
            onPress={() => setShowMonthPicker(true)}
            style={{
              minWidth: 140,
              height: 36,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 14,
              borderRadius: 18,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 12, textAlign: "center" }}>
              {toMonthPickerLabel(monthKey)}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Próximo mês"
            onPress={goToNextMonth}
            hitSlop={8}
            style={{
              width: 36,
              height: 36,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 18,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <GoAtletaIcon name="chevronForward" size={18} color={colors.muted} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir sincronização no Assistente"
            onPress={() => router.push({
              pathname: "/assistant",
              params: {
                classId,
                month: monthKey,
                source: "planning-document-sync",
              },
            })}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              height: 36,
              paddingHorizontal: 14,
              borderRadius: 18,
              backgroundColor: colors.primary,
            }}
          >
            <GoAtletaIcon name="sparkles" size={14} color={colors.primaryText} />
            <Text style={{ color: colors.primaryText, fontWeight: "700", fontSize: 12 }}>Sincronizar</Text>
          </Pressable>
        </View>
      </ScreenPageHeader>
      <ScrollView
        contentContainerStyle={{
          gap: 12,
          paddingHorizontal: 16,
          paddingTop: 2,
          paddingBottom: Math.max(insets.bottom + 104, 128),
        }}
      >
        <MonthSummaryPanel
          events={agendaEvents}
          weekCount={weeklyItems.length}
          focus={monthFocusSummary}
          colors={colors}
        />

        {isRegeneratingMonth && monthRegenProgress ? (
          <View style={[getSectionCardStyle(colors, "neutral", { padding: 10, radius: 12, shadow: false }), { gap: 4 }]}>
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>{monthRegenProgress.message}</Text>
            {monthRegenProgress.total ? (
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {monthRegenProgress.currentIndex}/{monthRegenProgress.total}
              </Text>
            ) : null}
          </View>
        ) : null}

        {error ? (
          <View style={[getSectionCardStyle(colors, "primary", { radius: 14 }), { gap: 6 }]}>
            <Text style={{ color: colors.dangerText, fontWeight: "700" }}>Falha ao carregar o mês</Text>
            <Text style={{ color: colors.muted }}>{error}</Text>
          </View>
        ) : null}

        {!weeklyItems.length ? (
          <View style={[getSectionCardStyle(colors, "primary", { radius: 16 }), { gap: 6 }]}>
            <Text style={{ color: colors.text, fontWeight: "700" }}>Sem semanas neste mês</Text>
            <Text style={{ color: colors.muted }}>
              O mês ainda não possui planos semanais gerados para esta turma.
            </Text>
          </View>
        ) : null}

        {monthCalendarDays.length ? (
          <MonthCalendarGrid
            days={monthCalendarDays}
            compact={isCompactCalendar}
            colors={colors}
            onSelectEvent={handleSelectAgendaEvent}
          />
        ) : null}
      </ScrollView>

      <DayLessonPlanModal
        visible={Boolean(selectedWeekPlan && selectedSession)}
        initialPlan={selectedDailyPlan}
        dayLabel={selectedSession ? `${selectedSession.weekdayLabel} ${selectedSession.dateLabel}` : "Plano diário"}
        coachGuidance={selectedAgendaEvent?.guidance}
        onClose={() => {
          setSelectedWeekPlan(null);
          setSelectedSession(null);
          setSelectedAgendaEvent(null);
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
      <DatePickerModal
        visible={showMonthPicker}
        value={toMonthPickerValue(monthKey)}
        onChange={handleMonthPickerChange}
        onClose={() => setShowMonthPicker(false)}
        closeOnSelect
        closeOnMonthYearSelect
        initialViewMode="month"
      />
    </SafeAreaView>
  );
}
