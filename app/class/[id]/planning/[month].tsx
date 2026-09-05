import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { ScreenPageHeader } from "../../../../src/components/ui/ScreenPageHeader";
import { ScreenLoadingState } from "../../../../src/components/ui/ScreenLoadingState";
import type { ClassGroup, ClassPlan } from "../../../../src/core/models";
import { resolveLearningObjectives } from "../../../../src/core/pedagogy/objective-language";
import {
  getClassById,
  getTrainingPlans,
  getTrainingSessionEvidenceByClass,
  listDailyLessonPlansByWeekIds,
} from "../../../../src/db/seed";
import { navigateBackOrReplace } from "../../../../src/navigation/safe-router";
import { useTrainerRouteScope } from "../../../../src/navigation/use-trainer-route-scope";
import { markRender, measureAsync } from "../../../../src/observability/perf";
import { exportPdf, safeFileName } from "../../../../src/pdf/export-pdf";
import { MonthlyLessonPlanDocument } from "../../../../src/pdf/monthly-lesson-plan-document";
import { SessionPlanDocument } from "../../../../src/pdf/session-plan-document";
import { monthlyPlanHtml } from "../../../../src/pdf/templates/monthly-plan";
import { sessionPlanHtml } from "../../../../src/pdf/templates/session-plan";
import type { WeekSessionPreview } from "../../../../src/screens/periodization/application/build-week-session-preview";
import { resolveLessonBlocksFromDailyPlan } from "../../../../src/screens/planning/application/daily-lesson-blocks";
import type { MonthPlanningSummary } from "../../../../src/screens/planning/application/month-planning-summary";
import {
  buildMonthlyPlanExportData,
  DEFAULT_MONTHLY_PLAN_PROFESSOR,
  formatMonthlyPlanAgeGroup,
  formatMonthlyPlanDateLabel,
  formatMonthlyPlanTimeLabel,
} from "../../../../src/screens/planning/application/monthly-plan-export";
import type {
  ProfessorAgendaCalendarDay,
  ProfessorAgendaEvent,
} from "../../../../src/screens/planning/application/professor-agenda-events";

import type { MonthRegenerationProgress } from "../../../../src/screens/planning/application/regenerate-month-plans";
import { regenerateMonthPlans } from "../../../../src/screens/planning/application/regenerate-month-plans";
import { DayLessonPlanModal } from "../../../../src/screens/planning/components/DayLessonPlanModal";
import { buildRecentSessionSummary } from "../../../../src/screens/session/application/build-recent-session-summary";

import {
  GoAtletaIcon,
  type GoAtletaIconName,
} from "../../../../src/ui/icon-registry";
import { useDailyLessonPlan } from "../../../../src/screens/planning/hooks/useDailyLessonPlan";
import { useMonthlyPlans } from "../../../../src/screens/planning/hooks/useMonthlyPlans";
import { useAppTheme } from "../../../../src/ui/app-theme";

import { DatePickerModal } from "../../../../src/ui/DatePickerModal";
import { Pressable } from "../../../../src/ui/Pressable";
import { useSaveToast } from "../../../../src/ui/save-toast";
import { getSectionCardStyle } from "../../../../src/ui/section-styles";
import { useSingleAccordion } from "../../../../src/ui/use-single-accordion";
import { getLessonBlockTimes } from "../../../../src/utils/lesson-block-times";

const toMonthTitle = (monthKey: string) => {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return monthKey;
  const date = new Date(year, Math.max(month - 1, 0), 1);
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(date);
};

const parseMonthKey = (value: string) => {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    month < 1 ||
    month > 12
  )
    return null;
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
  if (!parsed)
    return `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;
  return `${parsed.year}-${String(parsed.month).padStart(2, "0")}-01`;
};

const toMonthPickerLabel = (value: string) => {
  const parsed = parseMonthKey(value);
  if (!parsed) return value;
  const date = new Date(parsed.year, parsed.month - 1, 1);
  const label = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(date);
  return label
    .replace(/^./, (char) => char.toUpperCase())
    .replace(/\s+de\s+/i, " ");
};

const isGenericPlanningText = (value: string | undefined) => {
  const text = (value ?? "").trim();
  if (!text) return true;
  return /(aquecimento\s+e\s+mobilidade\s+especifica|aquecimento|mobilidade|atividade\s+principal|sessao|aula)/i.test(
    text,
  );
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

const buildMainDescriptionText = (
  mainDescription: string | undefined,
  specificObjective: string | undefined,
) => {
  const cleaned = (mainDescription ?? "").trim();
  if (!cleaned) return "";

  const isGenericMain =
    /(passam por esta(ç|c)(õ|o)es.*repetir os fundamentos|atividade curta em situa(ç|c)(ã|a)o de jogo)/i.test(
      cleaned,
    );

  if (!isGenericMain) return cleaned;

  const skillSet = resolveSkillSetText(specificObjective);
  return `Organizar estações de ${skillSet} com alvo. Depois, os alunos aplicam os fundamentos em uma atividade curta de jogo, com um novo desafio a cada rodada.`;
};

const WEEKDAY_HEADERS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

const getCompactWeekLabel = (event: ProfessorAgendaEvent) =>
  Number.isFinite(event.weekNumber)
    ? `S${event.weekNumber}`
    : event.weekLabel.replace(/^Semana\s+/i, "S");

const toTodayIsoDate = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
};

type PedagogicalTimelineSegment = {
  label: string;
  startWeek: number;
  endWeek: number;
};

const compactPhaseLabel = (value: string) => {
  const label = value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return label || "Desenvolvimento";
};

const buildPedagogicalTimeline = (
  plans: ClassPlan[],
): PedagogicalTimelineSegment[] => {
  const ordered = [...plans].sort((a, b) => a.weekNumber - b.weekNumber);
  return ordered.reduce<PedagogicalTimelineSegment[]>((segments, plan) => {
    const label = compactPhaseLabel(plan.phase || "Desenvolvimento");
    const previous = segments[segments.length - 1];
    if (
      previous &&
      previous.label === label &&
      plan.weekNumber <= previous.endWeek + 1
    ) {
      previous.endWeek = plan.weekNumber;
      return segments;
    }
    segments.push({
      label,
      startWeek: plan.weekNumber,
      endWeek: plan.weekNumber,
    });
    return segments;
  }, []);
};

function PeriodizationAction({
  label,
  icon,
  primary = false,
  disabled = false,
  colors,
  onPress,
}: {
  label: string;
  icon: GoAtletaIconName;
  primary?: boolean;
  disabled?: boolean;
  colors: ReturnType<typeof useAppTheme>["colors"];
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 42,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingHorizontal: 14,
        borderRadius: 12,
        backgroundColor: primary ? colors.primary : colors.secondaryBg,
        borderWidth: 1,
        borderColor: primary ? colors.primary : colors.border,
        opacity: disabled ? 0.65 : 1,
      }}
    >
      <GoAtletaIcon
        name={icon}
        size={16}
        color={primary ? colors.primaryText : colors.text}
      />
      <Text
        style={{
          color: primary ? colors.primaryText : colors.text,
          fontSize: 12,
          fontWeight: "900",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function PedagogicalTimelinePanel({
  plans,
  currentPlan,
  sessionCount,
  monthWeekCount,
  monthLabel,
  mobile,
  showCriteria,
  isUpdating,
  colors,
  onToggleCriteria,
  onOpenPeriodization,
  onUpdate,
}: {
  plans: ClassPlan[];
  currentPlan: ClassPlan | null;
  sessionCount: number;
  monthWeekCount: number;
  monthLabel: string;
  mobile: boolean;
  showCriteria: boolean;
  isUpdating: boolean;
  colors: ReturnType<typeof useAppTheme>["colors"];
  onToggleCriteria: () => void;
  onOpenPeriodization: () => void;
  onUpdate: () => void;
}) {
  const segments = buildPedagogicalTimeline(plans);
  const currentWeek = currentPlan?.weekNumber ?? segments[0]?.startWeek ?? 1;
  const currentFocus =
    currentPlan?.technicalFocus ||
    currentPlan?.theme ||
    currentPlan?.generalObjective ||
    "Foco do ciclo";
  const loadLabel = currentPlan?.rpeTarget
    ? `PSE ${currentPlan.rpeTarget}`
    : "Carga definida pelo ciclo";
  const timeline = (
    <View
      style={{
        flexDirection: "row",
        gap: 6,
        minWidth: mobile ? Math.max(560, segments.length * 142) : undefined,
      }}
    >
      {segments.map((segment, index) => {
        const active =
          currentWeek >= segment.startWeek && currentWeek <= segment.endWeek;
        const weekSpan = Math.max(1, segment.endWeek - segment.startWeek + 1);
        return (
          <View
            key={`${segment.label}-${segment.startWeek}`}
            style={{
              minWidth: mobile ? 136 : 92,
              flexGrow: mobile ? 0 : weekSpan,
              flexBasis: mobile ? 136 : 0,
              minHeight: 62,
              justifyContent: "center",
              gap: 4,
              paddingHorizontal: 10,
              paddingVertical: 9,
              borderRadius: 11,
              backgroundColor: active
                ? colors.successBg
                : index % 2 === 0
                  ? colors.secondaryBg
                  : colors.backgroundSubtle,
              borderWidth: 1,
              borderColor: active ? colors.successBorder : colors.border,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                color: active ? colors.successText : colors.text,
                fontSize: 11,
                fontWeight: "900",
              }}
            >
              {segment.label}
            </Text>
            <Text
              style={{ color: colors.muted, fontSize: 10, fontWeight: "700" }}
            >
              S{segment.startWeek}
              {segment.endWeek > segment.startWeek
                ? `–S${segment.endWeek}`
                : ""}
            </Text>
            {active ? (
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: colors.successText,
                  }}
                />
                <Text
                  style={{
                    color: colors.successText,
                    fontSize: 9,
                    fontWeight: "900",
                  }}
                >
                  {monthLabel} · S{currentWeek}
                </Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );

  return (
    <View
      style={[
        getSectionCardStyle(colors, "neutral", {
          padding: mobile ? 12 : 14,
          radius: 16,
          shadow: false,
        }),
        { gap: 14 },
      ]}
    >
      <View
        style={{
          flexDirection: mobile ? "column" : "row",
          alignItems: mobile ? "stretch" : "center",
          gap: 12,
        }}
      >
        <View
          style={{
            flex: 1,
            minWidth: 0,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 11,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.successBg,
            }}
          >
            <GoAtletaIcon
              name="periodization"
              size={18}
              color={colors.successText}
            />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}
            >
              Linha pedagógica
            </Text>
            <Text
              numberOfLines={1}
              style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}
            >
              O planejamento deste mês deriva do ciclo anual da turma.
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <GoAtletaIcon
            name="checkmarkCircle"
            size={16}
            color={colors.successText}
          />
          <Text
            style={{
              color: colors.successText,
              fontSize: 11,
              fontWeight: "900",
            }}
          >
            Planejamento alinhado
          </Text>
        </View>
      </View>

      {mobile ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 12 }}
        >
          {timeline}
        </ScrollView>
      ) : (
        timeline
      )}

      <View
        style={{
          flexDirection: mobile ? "column" : "row",
          alignItems: mobile ? "stretch" : "center",
          gap: 12,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              color: colors.muted,
              fontSize: 10,
              fontWeight: "800",
              textTransform: "uppercase",
            }}
          >
            Foco atual
          </Text>
          <Text
            numberOfLines={2}
            style={{
              color: colors.text,
              fontSize: 13,
              fontWeight: "900",
              marginTop: 3,
            }}
          >
            {currentFocus} · {loadLabel}
          </Text>
        </View>
        <View style={{ flexDirection: mobile ? "column" : "row", gap: 8 }}>
          <PeriodizationAction
            label="Abrir periodização"
            icon="open"
            colors={colors}
            onPress={onOpenPeriodization}
          />
          <PeriodizationAction
            label={
              isUpdating
                ? "Atualizando..."
                : "Atualizar a partir da periodização"
            }
            icon="sync"
            primary
            disabled={isUpdating}
            colors={colors}
            onPress={onUpdate}
          />
        </View>
      </View>

      <View
        style={{
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          gap: 8,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <GoAtletaIcon name="link" size={14} color={colors.muted} />
          <Text style={{ color: colors.muted, fontSize: 11, flex: 1 }}>
            {sessionCount} aula{sessionCount === 1 ? "" : "s"} derivada
            {sessionCount === 1 ? "" : "s"} de {monthWeekCount} semana
            {monthWeekCount === 1 ? "" : "s"} do ciclo
          </Text>
          <Pressable accessibilityRole="button" onPress={onToggleCriteria}>
            <Text
              style={{
                color: colors.successText,
                fontSize: 11,
                fontWeight: "900",
              }}
            >
              {showCriteria ? "Ocultar critérios" : "Ver critérios"}
            </Text>
          </Pressable>
        </View>
        {showCriteria ? (
          <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>
            Semanas, foco técnico, carga e aula de jogo são recalculados pela
            periodização. Planos editados manualmente e aulas concluídas são
            preservados.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function UnconfiguredPeriodizationGate({
  mobile,
  colors,
  onConfigure,
}: {
  mobile: boolean;
  colors: ReturnType<typeof useAppTheme>["colors"];
  onConfigure: () => void;
}) {
  return (
    <View
      style={{
        flex: 1,
        minHeight: mobile ? 480 : 560,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 16,
      }}
    >
      <View
        style={[
          getSectionCardStyle(colors, "neutral", {
            padding: mobile ? 22 : 30,
            radius: 18,
            shadow: false,
          }),
          { width: "100%", maxWidth: 620, alignItems: "center", gap: 14 },
        ]}
      >
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.successBg,
          }}
        >
          <GoAtletaIcon
            name="periodization"
            size={25}
            color={colors.successText}
          />
        </View>
        <View style={{ alignItems: "center", gap: 7 }}>
          <Text
            style={{
              color: colors.text,
              fontSize: mobile ? 20 : 23,
              lineHeight: mobile ? 26 : 30,
              fontWeight: "900",
              textAlign: "center",
            }}
          >
            Configure a periodização para criar o planejamento
          </Text>
          <Text
            style={{
              color: colors.muted,
              fontSize: 13,
              lineHeight: 20,
              textAlign: "center",
              maxWidth: 470,
            }}
          >
            Defina o objetivo, o nível e o ciclo pedagógico da turma. A agenda
            mensal será criada a partir dessa estrutura.
          </Text>
        </View>
        <PeriodizationAction
          label="Configurar periodização"
          icon="periodization"
          primary
          colors={colors}
          onPress={onConfigure}
        />
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 7,
            maxWidth: 470,
          }}
        >
          <GoAtletaIcon name="shield" size={15} color={colors.muted} />
          <Text
            style={{
              color: colors.muted,
              fontSize: 11,
              lineHeight: 17,
              flex: 1,
            }}
          >
            Edições manuais e aulas já concluídas serão preservadas quando o
            ciclo for configurado ou atualizado.
          </Text>
        </View>
      </View>
    </View>
  );
}

function MobileMonthAgenda({
  events,
  colors,
  onSelectEvent,
}: {
  events: ProfessorAgendaEvent[];
  colors: ReturnType<typeof useAppTheme>["colors"];
  onSelectEvent: (event: ProfessorAgendaEvent) => void;
}) {
  const grouped = events.reduce<
    { weekNumber: number; events: ProfessorAgendaEvent[] }[]
  >((weeks, event) => {
    const existing = weeks.find((week) => week.weekNumber === event.weekNumber);
    if (existing) existing.events.push(event);
    else weeks.push({ weekNumber: event.weekNumber, events: [event] });
    return weeks;
  }, []);

  return (
    <View style={{ gap: 10 }}>
      {grouped.map((week) => (
        <View
          key={week.weekNumber}
          style={[
            getSectionCardStyle(colors, "neutral", {
              padding: 0,
              radius: 14,
              shadow: false,
            }),
            { overflow: "hidden" },
          ]}
        >
          <View
            style={{
              paddingHorizontal: 13,
              paddingVertical: 10,
              backgroundColor: colors.backgroundSubtle,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Text
              style={{ color: colors.text, fontSize: 12, fontWeight: "900" }}
            >
              Semana {week.weekNumber}
            </Text>
          </View>
          {week.events.map((event, index) => (
            <Pressable
              key={event.id}
              accessibilityRole="button"
              accessibilityLabel={`Abrir aula de ${event.dateLabel}`}
              onPress={() => onSelectEvent(event)}
              style={{
                minHeight: 70,
                flexDirection: "row",
                alignItems: "center",
                gap: 11,
                paddingHorizontal: 13,
                paddingVertical: 10,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: colors.border,
                backgroundColor: event.isMonthlyGameSession
                  ? colors.successBg
                  : colors.card,
              }}
            >
              <View style={{ width: 44, alignItems: "center", gap: 2 }}>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 17,
                    fontWeight: "900",
                  }}
                >
                  {event.dayOfMonth}
                </Text>
                <Text
                  style={{
                    color: colors.muted,
                    fontSize: 10,
                    fontWeight: "800",
                  }}
                >
                  {event.weekdayLabel}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    color: colors.text,
                    fontSize: 13,
                    fontWeight: "900",
                  }}
                >
                  {event.title}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ color: colors.muted, fontSize: 10 }}
                >
                  {[event.roleLabel, event.loadLabel, event.focusLabel]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
              {event.isMonthlyGameSession ? (
                <View
                  style={{
                    paddingHorizontal: 7,
                    paddingVertical: 4,
                    borderRadius: 999,
                    backgroundColor: colors.successBorder,
                  }}
                >
                  <Text
                    style={{
                      color: colors.successText,
                      fontSize: 9,
                      fontWeight: "900",
                    }}
                  >
                    Jogo do mês
                  </Text>
                </View>
              ) : null}
              <GoAtletaIcon
                name="chevronForward"
                size={17}
                color={colors.muted}
              />
            </Pressable>
          ))}
        </View>
      ))}
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
  const badgeLabel =
    event.status === "needs_review" ? event.statusLabel : event.roleLabel;
  const badgeColor = event.isMonthlyGameSession
    ? colors.successText
    : event.status === "needs_review"
      ? colors.warningText
      : colors.muted;
  const badgeBg = event.isMonthlyGameSession
    ? colors.successBg
    : event.status === "needs_review"
      ? colors.warningBg
      : colors.secondaryBg;
  const planningMeta = [event.loadLabel, event.focusLabel]
    .filter(Boolean)
    .join(" · ");

  if (compact) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Abrir ${event.title}`}
        onPress={onPress}
        style={{
          minHeight: 34,
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
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            minWidth: 0,
          }}
        >
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
            style={{
              color: colors.text,
              fontSize: 10,
              fontWeight: "900",
              minWidth: 0,
              flexShrink: 1,
            }}
          >
            {getCompactWeekLabel(event)}
          </Text>
        </View>
        <Text
          numberOfLines={1}
          style={{ color: badgeColor, fontSize: 9, fontWeight: "800" }}
        >
          {badgeLabel}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={{
        gap: 3,
        minHeight: 56,
        paddingHorizontal: 7,
        paddingVertical: 6,
        borderRadius: 9,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 5,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            flex: 1,
            minWidth: 0,
          }}
        >
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
            style={{
              color: colors.text,
              fontSize: 10,
              fontWeight: "900",
              flexShrink: 1,
            }}
          >
            {getCompactWeekLabel(event)}
          </Text>
        </View>
        <View
          style={{
            paddingHorizontal: 5,
            paddingVertical: 2,
            borderRadius: 999,
            backgroundColor: badgeBg,
            maxWidth: "62%",
          }}
        >
          <Text
            numberOfLines={1}
            style={{ color: badgeColor, fontSize: 9, fontWeight: "800" }}
          >
            {badgeLabel}
          </Text>
        </View>
      </View>
      <Text
        numberOfLines={1}
        style={{
          color: colors.text,
          fontSize: 11,
          fontWeight: "800",
          lineHeight: 14,
        }}
      >
        {event.title}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          color: colors.muted,
          fontSize: 9,
          fontWeight: "700",
          lineHeight: 12,
        }}
      >
        {planningMeta}
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
    <View
      style={[
        getSectionCardStyle(colors, "neutral", {
          padding: compact ? 8 : 10,
          radius: 16,
          shadow: false,
        }),
        { gap: 8 },
      ]}
    >
      <View style={{ flexDirection: "row", gap: compact ? 4 : 6 }}>
        {WEEKDAY_HEADERS.map((label) => (
          <Text
            key={label}
            style={{
              flex: 1,
              color: colors.muted,
              fontSize: 11,
              fontWeight: "800",
              textAlign: "center",
            }}
          >
            {label}
          </Text>
        ))}
      </View>
      {rows.map((row, rowIndex) => (
        <View
          key={`row-${rowIndex}`}
          style={{ flexDirection: "row", gap: compact ? 4 : 6 }}
        >
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
                  backgroundColor: hasEvent
                    ? colors.secondaryBg
                    : colors.backgroundSubtle,
                  borderWidth: 1,
                  borderColor: hasEvent ? colors.successBorder : colors.border,
                  opacity: day.isCurrentMonth ? 1 : 0.35,
                }}
              >
                <Text
                  style={{
                    color: hasEvent ? colors.text : colors.muted,
                    fontSize: 12,
                    fontWeight: "900",
                  }}
                >
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
                  <Text
                    style={{
                      color: colors.muted,
                      fontSize: 10,
                      fontWeight: "700",
                    }}
                  >
                    +{day.events.length - visibleEventsLimit} aula
                    {day.events.length - visibleEventsLimit === 1 ? "" : "s"}
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

export default function ClassPlanningMonthRedirectRoute() {
  const { id, month } = useLocalSearchParams<{ id: string; month: string }>();
  const classId = typeof id === "string" ? id : "";
  const monthKey = typeof month === "string" ? month : "";

  return (
    <Redirect
      href={{
        pathname: "/class/[id]/periodization",
        params: {
          id: classId,
          classId,
          month: monthKey,
          backTo: `/class/${classId}`,
        },
      }}
    />
  );
}

export function LegacyClassPlanningMonthRoute() {
  markRender("screen.classPlanningMonth.render.root");

  const { id, month } = useLocalSearchParams<{ id: string; month: string }>();
  const router = useRouter();
  const scopedRoutes = useTrainerRouteScope();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors } = useAppTheme();
  const { showSaveToast } = useSaveToast();
  const classId = typeof id === "string" ? id : "";
  const monthKey = typeof month === "string" ? month : "";
  const {
    expandedKey: expandedWeekId,
    setExpandedKey: setExpandedWeekId,
    toggle: toggleExpandedWeek,
  } = useSingleAccordion(null, { switchDelayMs: 220 });
  const [selectedWeekPlan, setSelectedWeekPlan] = useState<ClassPlan | null>(
    null,
  );
  const [selectedSession, setSelectedSession] =
    useState<WeekSessionPreview | null>(null);
  const [selectedAgendaEvent, setSelectedAgendaEvent] =
    useState<ProfessorAgendaEvent | null>(null);
  const [monthRegenProgress, setMonthRegenProgress] =
    useState<MonthRegenerationProgress | null>(null);
  const [isRegeneratingMonth, setIsRegeneratingMonth] = useState(false);
  const [isExportingMonth, setIsExportingMonth] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showAlignmentCriteria, setShowAlignmentCriteria] = useState(false);

  const {
    selectedClass,
    activeCycle,
    calendarExceptions,
    students,
    recentAttendance,
    recentSessionLogs,
    classPlans,
    weeklyItems,
    agendaEvents,
    monthCalendarDays,
    isPeriodizationConfigured,
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
    calendarExceptions,
  });

  useEffect(() => {
    if (expandedWeekId === null) return;
    if (!weeklyItems.some((item) => item.plan.id === expandedWeekId)) {
      setExpandedWeekId(null);
    }
  }, [expandedWeekId, setExpandedWeekId, weeklyItems]);

  useCallback(
    (weekId: string) => {
      toggleExpandedWeek(weekId);
    },
    [toggleExpandedWeek],
  );

  const handleRegenerateMonth = async () => {
    setIsRegeneratingMonth(true);
    setMonthRegenProgress(null);
    try {
      // Fetch class group for blueprint generation
      const classGroup = (await measureAsync(
        "screen.classPlanningMonth.load.regenerationContext",
        () => getClassById(classId),
        { screen: "classPlanningMonth", classId, monthKey },
      )) as ClassGroup | null;
      if (!classGroup) {
        setMonthRegenProgress({
          stage: "complete",
          message: "Erro: turma não encontrada",
        });
        setIsRegeneratingMonth(false);
        return;
      }
      const [finalPlans, sessionEvidence] = await Promise.all([
        getTrainingPlans({
          organizationId: classGroup.organizationId,
          classId: classGroup.id,
          status: "final",
          orderBy: "createdat_desc",
          limit: 24,
        }),
        getTrainingSessionEvidenceByClass(classGroup.id, {
          organizationId: classGroup.organizationId,
        }),
      ]);
      const recentSessionSummaries = buildRecentSessionSummary({
        classId: classGroup.id,
        plans: finalPlans,
        sessions: sessionEvidence.sessions,
        attendance: sessionEvidence.attendance,
        sessionLogs: recentSessionLogs,
        limit: 6,
      });

      // Start regeneration with progress callback
      const result = await regenerateMonthPlans({
        classGroup,
        monthKey,
        classPlans,
        activeCycle,
        activeCycleId: activeCycle?.id,
        activeCycleStartDate: activeCycle?.startDate,
        activeCycleEndDate: activeCycle?.endDate,
        calendarExceptions,
        students,
        recentAttendance,
        recentSessionLogs,
        recentSessionSummaries,
        onProgress: (progress) => {
          setMonthRegenProgress(progress);
        },
      });

      // Reload data after completion
      await reload();
      if (result.status === "outside_cycle") {
        const message =
          "Este mês está fora do ciclo ativo. Ajuste o ciclo da turma antes de gerar os planos.";
        setMonthRegenProgress({ stage: "complete", message });
        showSaveToast({ message, variant: "warning" });
      } else {
        setMonthRegenProgress(null);
        showSaveToast({
          message: `${result.weeklyPlanCount} semana${result.weeklyPlanCount === 1 ? "" : "s"} atualizada${result.weeklyPlanCount === 1 ? "" : "s"}.`,
          variant: "success",
        });
      }
    } catch (err) {
      setMonthRegenProgress({
        stage: "complete",
        message: `Erro na regeneração: ${err instanceof Error ? err.message : "desconhecido"}`,
      });
    } finally {
      setIsRegeneratingMonth(false);
    }
  };

  const monthTitle = useMemo(
    () => toMonthTitle(monthKey).replace(/^./, (char) => char.toUpperCase()),
    [monthKey],
  );
  const monthSessionCount = agendaEvents.length;
  const isMobile = width < 768;
  const currentMonthPlan = useMemo(() => {
    if (!weeklyItems.length) return null;
    const today = toTodayIsoDate();
    const currentMonth = today.slice(0, 7);
    const orderedEvents = [...agendaEvents].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    const referenceEvent =
      monthKey === currentMonth
        ? ([...orderedEvents].reverse().find((event) => event.date <= today) ??
          orderedEvents[0])
        : monthKey < currentMonth
          ? orderedEvents[orderedEvents.length - 1]
          : orderedEvents[0];
    return referenceEvent?.plan ?? weeklyItems[0]?.plan ?? null;
  }, [agendaEvents, monthKey, weeklyItems]);

  const handleSelectAgendaEvent = useCallback((event: ProfessorAgendaEvent) => {
    setSelectedAgendaEvent(event);
    setSelectedWeekPlan(event.plan);
    setSelectedSession(event.session);
  }, []);

  const goToMonth = useCallback(
    (nextMonthKey: string) => {
      if (!classId || nextMonthKey === monthKey) return;
      router.replace({
        pathname: "/class/[id]/planning/[month]",
        params: { id: classId, month: nextMonthKey },
      });
    },
    [classId, monthKey, router],
  );

  const goToPreviousMonth = useCallback(() => {
    goToMonth(shiftMonthKey(monthKey, -1));
  }, [goToMonth, monthKey]);

  const goToNextMonth = useCallback(() => {
    goToMonth(shiftMonthKey(monthKey, 1));
  }, [goToMonth, monthKey]);

  const handleOpenPeriodization = useCallback(() => {
    if (!classId) return;
    router.push({
      pathname: "/class/[id]/periodization",
      params: {
        id: classId,
        classId,
        unit: selectedClass?.unit ?? "",
        backTo: `/class/${classId}/planning/${monthKey}`,
      },
    });
  }, [classId, monthKey, router, selectedClass?.unit]);

  const handleMonthPickerChange = useCallback(
    (value: string) => {
      const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(value);
      if (!match) return;
      goToMonth(`${match[1]}-${match[2]}`);
      setShowMonthPicker(false);
    },
    [goToMonth],
  );

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
    if (
      !selectedClass ||
      !selectedSession ||
      !selectedWeekPlan ||
      !selectedDailyPlan
    ) {
      showSaveToast({
        message: "Abra uma aula com plano carregado para exportar o PDF.",
        variant: "error",
      });
      return;
    }

    const dateLabel = formatMonthlyPlanDateLabel(selectedDailyPlan.date);
    const weekLabel = `SEMANA ${String(selectedWeekPlan.weekNumber || 0).padStart(2, "0")}`;
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
    const totalDuration = lessonBlocks.reduce(
      (sum, block) => sum + (block.durationMinutes || 0),
      0,
    );
    const fallbackTheme =
      selectedWeekPlan.theme ||
      selectedWeekPlan.technicalFocus ||
      selectedDailyPlan.mainPart ||
      selectedDailyPlan.title;
    const resolvedTitle = isGenericPlanningText(selectedDailyPlan.title)
      ? fallbackTheme
      : selectedDailyPlan.title;
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
      mainBlock?.activities
        .map((item) => item.description)
        .filter(Boolean)
        .join("\n") || selectedDailyPlan.mainPart;
    const resolvedMainDescription = buildMainDescriptionText(
      mainBlockDescription,
      resolvedSpecificObjective,
    );

    const pdfData = {
      className: selectedClass.name,
      ageGroup: formatMonthlyPlanAgeGroup(selectedClass.ageBand),
      unitLabel: selectedClass.unit,
      genderLabel: genderLabel.toLocaleLowerCase("pt-BR"),
      dateLabel,
      timeLabel: formatMonthlyPlanTimeLabel(selectedClass),
      weekLabel,
      title: resolvedTitle,
      objective: resolvedSpecificObjective || selectedWeekPlan.theme,
      generalObjective: resolvedGeneralObjective,
      specificObjective: resolvedSpecificObjective,
      weeklyFocus: selectedWeekPlan.theme || selectedWeekPlan.technicalFocus,
      pedagogicalRule: selectedWeekPlan.pedagogicalRule,
      totalTime: `${totalDuration > 0 ? totalDuration : blockTimes.totalMinutes} min`,
      notes: "",
      blocks: lessonBlocks.map((block) => ({
        key: block.key,
        label: block.label,
        durationMinutes: block.durationMinutes,
        activities:
          block.key === "main"
            ? block.activities.map((activity, index) =>
                index === 0
                  ? {
                      ...activity,
                      description:
                        resolvedMainDescription || activity.description,
                    }
                  : activity,
              )
            : block.activities,
      })),
      coachName: DEFAULT_MONTHLY_PLAN_PROFESSOR,
    };

    const html = sessionPlanHtml(pdfData);
    const webDocument =
      Platform.OS === "web" ? (
        <SessionPlanDocument data={pdfData} />
      ) : undefined;
    const safeClass = safeFileName(selectedClass.name);
    const safeDate = safeFileName(selectedDailyPlan.date);
    const fileName = `plano-aula-dia-${safeClass}-${safeDate}.pdf`;

    await exportPdf({ html, fileName, webDocument });
    showSaveToast({
      message: "PDF da aula gerado com contexto semanal.",
      variant: "success",
    });
  }, [
    selectedClass,
    selectedSession,
    selectedWeekPlan,
    selectedDailyPlan,
    showSaveToast,
  ]);

  const handleExportMonthPdf = useCallback(async () => {
    if (!selectedClass || !currentMonthSummary.hasPlans || isExportingMonth) {
      showSaveToast({
        message: "Este mês ainda não possui plano para exportar.",
        variant: "error",
      });
      return;
    }

    setIsExportingMonth(true);
    showSaveToast({ message: "Gerando PDF do mês...", variant: "success" });

    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      const monthPlans = weeklyItems.map((item) => item.plan);
      const dailyPlans = await listDailyLessonPlansByWeekIds(
        monthPlans.map((plan) => plan.id),
      );
      const dailyPlansByKeyForExport = Object.fromEntries(
        dailyPlans.map((plan) => [`${plan.weeklyPlanId}::${plan.date}`, plan]),
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
      const webDocument =
        Platform.OS === "web" ? (
          <MonthlyLessonPlanDocument data={data} />
        ) : undefined;

      await exportPdf({ html, fileName: `${fileBase}.pdf`, webDocument });

      showSaveToast({ message: "Plano mensal exportado.", variant: "success" });
    } catch (exportError) {
      showSaveToast({
        message:
          exportError instanceof Error
            ? exportError.message
            : "Falha ao exportar o plano mensal.",
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

    navigateBackOrReplace({ router, fallback: scopedRoutes.classes });
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
        subtitle={
          selectedClass?.name
            ? `${selectedClass.name} · planejamento pedagógico`
            : "Planejamento pedagógico"
        }
        onBack={handleBackToClass}
        right={
          isPeriodizationConfigured ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
                justifyContent: "flex-end",
              }}
            >
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
                  opacity:
                    isExportingMonth || !currentMonthSummary.hasPlans
                      ? 0.55
                      : 1,
                }}
              >
                {isExportingMonth ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <GoAtletaIcon name="download" size={18} color={colors.text} />
                )}
              </Pressable>
            </View>
          ) : null
        }
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
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
            <Text
              style={{
                color: colors.text,
                fontWeight: "800",
                fontSize: 12,
                textAlign: "center",
              }}
            >
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
            <GoAtletaIcon
              name="chevronForward"
              size={18}
              color={colors.muted}
            />
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
        {error ? (
          <View
            style={[
              getSectionCardStyle(colors, "primary", { radius: 14 }),
              { gap: 6 },
            ]}
          >
            <Text style={{ color: colors.dangerText, fontWeight: "700" }}>
              Falha ao carregar o planejamento
            </Text>
            <Text style={{ color: colors.muted }}>{error}</Text>
          </View>
        ) : !isPeriodizationConfigured ? (
          <UnconfiguredPeriodizationGate
            mobile={isMobile}
            colors={colors}
            onConfigure={handleOpenPeriodization}
          />
        ) : (
          <>
            <PedagogicalTimelinePanel
              plans={classPlans}
              currentPlan={currentMonthPlan}
              sessionCount={agendaEvents.length}
              monthWeekCount={weeklyItems.length}
              monthLabel={
                toMonthPickerLabel(monthKey).split(" ")[0] ?? monthTitle
              }
              mobile={isMobile}
              showCriteria={showAlignmentCriteria}
              isUpdating={isRegeneratingMonth}
              colors={colors}
              onToggleCriteria={() =>
                setShowAlignmentCriteria((current) => !current)
              }
              onOpenPeriodization={handleOpenPeriodization}
              onUpdate={() => {
                void handleRegenerateMonth();
              }}
            />

            {isRegeneratingMonth && monthRegenProgress ? (
              <View
                style={[
                  getSectionCardStyle(colors, "neutral", {
                    padding: 10,
                    radius: 12,
                    shadow: false,
                  }),
                  { gap: 4 },
                ]}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  {monthRegenProgress.message}
                </Text>
                {monthRegenProgress.total ? (
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    {monthRegenProgress.currentIndex}/{monthRegenProgress.total}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {!weeklyItems.length ? (
              <View
                style={[
                  getSectionCardStyle(colors, "primary", { radius: 16 }),
                  { gap: 6 },
                ]}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>
                  Sem semanas neste mês
                </Text>
                <Text style={{ color: colors.muted }}>
                  O mês ainda não possui planos semanais gerados para esta
                  turma.
                </Text>
              </View>
            ) : null}

            {isMobile && agendaEvents.length ? (
              <MobileMonthAgenda
                events={agendaEvents}
                colors={colors}
                onSelectEvent={handleSelectAgendaEvent}
              />
            ) : monthCalendarDays.length ? (
              <MonthCalendarGrid
                days={monthCalendarDays}
                compact={false}
                colors={colors}
                onSelectEvent={handleSelectAgendaEvent}
              />
            ) : null}
          </>
        )}
      </ScrollView>

      <DayLessonPlanModal
        visible={
          isPeriodizationConfigured &&
          Boolean(selectedWeekPlan && selectedSession)
        }
        initialPlan={selectedDailyPlan}
        dayLabel={
          selectedSession
            ? `${selectedSession.weekdayLabel} ${selectedSession.dateLabel}`
            : "Plano diário"
        }
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
