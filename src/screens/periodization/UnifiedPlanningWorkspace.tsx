import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import type { LessonBlock } from "../../core/models";
import { AnchoredDropdown } from "../../ui/AnchoredDropdown";
import { AnchoredDropdownOption } from "../../ui/AnchoredDropdownOption";
import type { ThemeColors } from "../../ui/app-theme";
import { useConfirmDialog } from "../../ui/confirm-dialog";
import { GoAtletaIcon, type GoAtletaIconName } from "../../ui/icon-registry";
import { Pressable } from "../../ui/Pressable";
import { useSaveToast } from "../../ui/save-toast";
import { useCollapsibleAnimation } from "../../ui/use-collapsible";
import { useContainerResponsiveLayout } from "../../ui/use-container-responsive-layout";
import {
  ClassPlanPreviewModal,
  type ClassPlanPeriodizationSource,
} from "../classes/components/ClassPlanPreviewModal";
import { regenerateMonthPlans } from "../planning/application/regenerate-month-plans";
import {
  buildMonthPlanningSummaries,
  type MonthPlanningSummary,
} from "../planning/application/month-planning-summary";
import type { ProfessorAgendaEvent } from "../planning/application/professor-agenda-events";
import { useMonthlyPlans } from "../planning/hooks/useMonthlyPlans";
import { useSessionTrainingPlan } from "../planning/hooks/useSessionTrainingPlan";
import {
  buildMonthCyclePresentations,
  monthNeedsRegeneration,
  type MonthCyclePresentation,
} from "./application/unified-planning-view-model";

type Props = {
  colors: ThemeColors;
  classId: string;
  initialMonthKey?: string;
  onOpenManager: () => void;
};

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const validMonthKey = (value: string | undefined) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value ?? ""));
const currentMonthKey = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
};
const capitalize = (value: string) => value ? `${value.charAt(0).toLocaleUpperCase("pt-BR")}${value.slice(1)}` : value;
const monthTitle = (monthKey: string) => {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return "Mês do ciclo";
  return capitalize(new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1)));
};
const dateRangeLabel = (events: ProfessorAgendaEvent[]) => {
  if (!events.length) return "Sem aulas";
  const first = events[0].date.slice(8, 10);
  const last = events[events.length - 1].date.slice(8, 10);
  const month = events[0].date.slice(5, 7);
  return first === last ? `${first}/${month}` : `${first}/${month} – ${last}/${month}`;
};
type PlanningVisualStatus = MonthCyclePresentation["planningStatus"];

const todayIsoKey = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
};
const planningStatusMeta = (status: PlanningVisualStatus, colors: ThemeColors) => {
  if (status === "pending") return { color: colors.warning, label: "Pendente" };
  if (status === "unplanned") return { color: colors.danger, label: "Não planejada" };
  return { color: colors.success, label: "Planejada" };
};
const lessonPlanningStatus = (event: ProfessorAgendaEvent): PlanningVisualStatus =>
  event.status === "needs_review" ? "pending" : "planned";
const resolveLoadTone = (values: number[], colors: ThemeColors) => {
  if (!values.length) return colors.muted;
  const peak = Math.max(...values);
  if (peak <= 3) return colors.info;
  if (peak <= 5) return colors.success;
  if (peak <= 7) return colors.warning;
  return colors.danger;
};
const cardStyle = (colors: ThemeColors) => ({
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 14,
  backgroundColor: colors.card,
});

function ActionButton({ colors, label, icon, onPress, primary = false, disabled = false }: {
  colors: ThemeColors;
  label: string;
  icon?: GoAtletaIconName;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 42,
        paddingHorizontal: 16,
        borderRadius: 10,
        borderWidth: primary ? 0 : 1,
        borderColor: colors.border,
        backgroundColor: primary ? colors.primaryBg : "transparent",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 8,
        opacity: disabled ? 0.58 : 1,
      }}
    >
      {icon ? <GoAtletaIcon name={icon} size={16} color={primary ? colors.primaryText : colors.text} /> : null}
      <Text style={{ color: primary ? colors.primaryText : colors.text, fontSize: 12, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}

function StatusChip({ colors, event }: { colors: ThemeColors; event: ProfessorAgendaEvent }) {
  const ready = event.status === "ready";
  const review = event.status === "needs_review";
  return (
    <View style={{
      alignSelf: "flex-start",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 5,
      backgroundColor: ready ? colors.successBg : review ? colors.warningBg : colors.secondaryBg,
    }}>
      <Text style={{ color: ready ? colors.successText : review ? colors.warningText : colors.muted, fontSize: 9, fontWeight: "800" }}>
        {event.statusLabel}
      </Text>
    </View>
  );
}

function LoadSparkline({ color, values, width = 56, height = 24 }: { color: string; values: number[]; width?: number; height?: number }) {
  if (!values.length) {
    return <View style={{ width, height, alignItems: "center", justifyContent: "center" }}><Text style={{ color, fontSize: 11 }}>—</Text></View>;
  }
  const resolvedValues = values.length === 1 ? [values[0], values[0]] : values;
  const path = resolvedValues.map((value, index) => {
    const x = (index / (resolvedValues.length - 1)) * width;
    const normalized = Math.max(0, Math.min(10, value)) / 10;
    const y = height - 2 - normalized * (height - 4);
    return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
  return (
    <Svg width={width} height={height} accessibilityLabel="Curva de carga">
      <Path d={path} fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function PlanningStatusLegend({ colors }: { colors: ThemeColors }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
      {(["planned", "pending", "unplanned"] as PlanningVisualStatus[]).map((status) => {
        const meta = planningStatusMeta(status, colors);
        return (
          <View key={status} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: meta.color }} />
            <Text style={{ color: colors.muted, fontSize: 9 }}>{meta.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function MonthRail({ colors, summaries, selectedMonthKey, selectedMonthEvents, presentations, horizontal, onSelect }: {
  colors: ThemeColors;
  summaries: MonthPlanningSummary[];
  selectedMonthKey: string;
  selectedMonthEvents: ProfessorAgendaEvent[];
  presentations: Map<string, MonthCyclePresentation>;
  horizontal: boolean;
  onSelect: (monthKey: string) => void;
}) {
  if (horizontal) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
        {summaries.map((summary) => {
          const presentation = presentations.get(summary.monthKey);
          const phase = presentation?.phase ?? "Sem semanas geradas";
          const selected = summary.monthKey === selectedMonthKey;
          const planningStatus = selected && selectedMonthEvents.some((event) => event.status === "needs_review")
            ? "pending"
            : presentation?.planningStatus ?? (summary.hasPlans ? "planned" : "unplanned");
          const status = planningStatusMeta(planningStatus, colors);
          const loadTone = resolveLoadTone(presentation?.loadValues ?? [], colors);
          const past = summary.monthKey < currentMonthKey();
          return (
            <Pressable key={summary.monthKey} accessibilityRole="button" accessibilityLabel={`Abrir ${summary.label}. Status: ${status.label}.`} onPress={() => onSelect(summary.monthKey)} style={{
              width: 138,
              padding: 10,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: selected ? status.color : colors.border,
              backgroundColor: selected ? colors.secondaryBg : "transparent",
              gap: 3,
              opacity: past ? selected ? 0.76 : 0.5 : 1,
            }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <View accessible accessibilityLabel={`Status: ${status.label}`} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: status.color }} />
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: "900" }}>{MONTH_NAMES[summary.month - 1]}</Text>
              </View>
              <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 10 }}>{phase}</Text>
              <Text style={{ color: colors.muted, fontSize: 9 }}>S{presentation?.weekRangeLabel ?? "—"} · {summary.estimatedLessonCount} aulas</Text>
              <LoadSparkline color={loadTone} values={presentation?.loadValues ?? []} width={54} height={19} />
            </Pressable>
          );
        })}
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <View style={{ flexDirection: "row", paddingHorizontal: 10, paddingBottom: 7 }}>
        <Text style={{ width: 44, color: colors.muted, fontSize: 9 }}>Mês</Text>
        <Text style={{ flex: 1, color: colors.muted, fontSize: 9 }}>Fase pedagógica</Text>
        <Text style={{ width: 54, color: colors.muted, fontSize: 9 }}>Semanas</Text>
        <Text style={{ width: 54, color: colors.muted, fontSize: 9 }}>Carga</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
        <View style={{ position: "absolute", left: 16, top: 11, bottom: 18, width: 1, backgroundColor: colors.border }} />
        {summaries.map((summary) => {
          const presentation = presentations.get(summary.monthKey);
          const phase = presentation?.phase ?? "Sem semanas geradas";
          const selected = summary.monthKey === selectedMonthKey;
          const planningStatus = selected && selectedMonthEvents.some((event) => event.status === "needs_review")
            ? "pending"
            : presentation?.planningStatus ?? (summary.hasPlans ? "planned" : "unplanned");
          const status = planningStatusMeta(planningStatus, colors);
          const loadTone = resolveLoadTone(presentation?.loadValues ?? [], colors);
          const past = summary.monthKey < currentMonthKey();
          return (
            <Pressable
              key={summary.monthKey}
              accessibilityRole="button"
              accessibilityLabel={`Abrir ${summary.label}. Status: ${status.label}.`}
              onPress={() => onSelect(summary.monthKey)}
              style={{
                minHeight: 53,
                paddingHorizontal: 9,
                borderRadius: 9,
                borderWidth: 1,
                borderColor: selected ? status.color : "transparent",
                backgroundColor: selected ? colors.secondaryBg : "transparent",
                flexDirection: "row",
                alignItems: "center",
                opacity: past ? selected ? 0.76 : 0.5 : 1,
              }}
            >
              <View style={{ width: 44, flexDirection: "row", alignItems: "center", gap: 9 }}>
                <View accessible accessibilityLabel={`Status: ${status.label}`} style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: status.color, borderWidth: 1, borderColor: colors.background }} />
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: selected ? "900" : "700" }}>{MONTH_NAMES[summary.month - 1]}</Text>
              </View>
              <Text numberOfLines={1} style={{ flex: 1, color: colors.muted, fontSize: 9 }}>{phase}</Text>
              <Text style={{ width: 54, color: selected ? colors.text : colors.muted, fontSize: 9 }}>{presentation?.weekRangeLabel ?? "—"}</Text>
              <View style={{ width: 54, alignItems: "flex-end" }}><LoadSparkline color={loadTone} values={presentation?.loadValues ?? []} width={51} height={20} /></View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function MonthOverview({ colors, monthKey, events, presentation, compact = false, needsRegeneration, isApplying, onRegenerate }: {
  colors: ThemeColors;
  monthKey: string;
  events: ProfessorAgendaEvent[];
  presentation?: MonthCyclePresentation;
  compact?: boolean;
  needsRegeneration: boolean;
  isApplying: boolean;
  onRegenerate: () => void;
}) {
  const representative = events.find((event) => !event.isMonthlyGameSession) ?? events[0];
  const focus = representative?.focusLabel || "Progressão definida pelo ciclo";
  const load = presentation?.loadRangeLabel || representative?.loadLabel || "Carga não gerada";
  const weekdays = [...new Set(events.map((event) => event.weekdayLabel))].join(" e ");
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: compact ? "column" : "row", alignItems: compact ? "stretch" : "center", justifyContent: "space-between", gap: 10 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: colors.text, fontSize: compact ? 19 : 20, fontWeight: "900" }}>{monthTitle(monthKey)}</Text>
          <Text style={{ color: colors.muted, fontSize: 10 }}>
            {presentation?.weekNumbers.length ? `Semanas ${presentation.weekRangeLabel}` : "Sem semanas geradas"}{presentation?.phase ? ` · ${presentation.phase}` : ""}
          </Text>
        </View>
        <ActionButton
          colors={colors}
          label={isApplying ? "Atualizando..." : needsRegeneration ? "Atualizar aulas do mês" : "Recalcular mês"}
          icon="refresh"
          primary={needsRegeneration}
          disabled={isApplying}
          onPress={onRegenerate}
        />
      </View>
      <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, flexDirection: compact ? "column" : "row", overflow: "hidden" }}>
        {[
          { icon: "planning" as GoAtletaIconName, label: "Foco do mês", value: focus },
          { icon: "trend" as GoAtletaIconName, label: "Carga prevista", value: load },
          { icon: "calendar" as GoAtletaIconName, label: "Aulas no mês", value: `${events.length} aulas${weekdays ? ` · ${weekdays}` : ""}` },
        ].map((item, index) => (
          <View key={item.label} style={{ flex: 1, minHeight: 66, padding: 11, flexDirection: "row", gap: 9, borderLeftWidth: !compact && index ? 1 : 0, borderTopWidth: compact && index ? 1 : 0, borderColor: colors.border }}>
            <GoAtletaIcon name={item.icon} size={18} color={colors.muted} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: colors.muted, fontSize: 9 }}>{item.label}</Text>
              <Text numberOfLines={2} style={{ color: colors.text, fontSize: 10, lineHeight: 14, fontWeight: "700" }}>{item.value}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

type LessonActionsLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function LessonRowActions({ colors, event, onShowDetails, onOpenPlan }: {
  colors: ThemeColors;
  event: ProfessorAgendaEvent;
  onShowDetails: () => void;
  onOpenPlan: () => void;
}) {
  const triggerRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [triggerLayout, setTriggerLayout] = useState<LessonActionsLayout | null>(null);
  const { animatedStyle, isVisible } = useCollapsibleAnimation(open, {
    durationIn: 150,
    durationOut: 110,
    translateY: -4,
  });

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => {
    if (open) {
      close();
      return;
    }

    triggerRef.current?.measureInWindow((x, y, width, height) => {
      const menuWidth = 218;
      setTriggerLayout({
        x: Math.max(12, x + width - menuWidth),
        y,
        width: menuWidth,
        height,
      });
      setOpen(true);
    });
  }, [close, open]);

  const runAction = useCallback((action: () => void) => {
    close();
    action();
  }, [close]);

  return (
    <>
      <View ref={triggerRef}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Mais ações da aula de ${event.dateLabel}`}
          accessibilityState={{ expanded: open }}
          onPress={toggle}
          style={(state) => ({
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: state.hovered ? colors.secondaryBg : "transparent",
          })}
        >
          <GoAtletaIcon name="ellipsisVertical" size={16} color={colors.muted} />
        </Pressable>
      </View>
      <AnchoredDropdown
        visible={isVisible}
        layout={triggerLayout}
        container={null}
        animationStyle={animatedStyle}
        zIndex={1400}
        maxHeight={116}
        nestedScrollEnabled={false}
        density="menu"
        interactiveRefs={[triggerRef]}
        onRequestClose={close}
        showVerticalScrollIndicator={false}
        panelStyle={{ backgroundColor: colors.card }}
        scrollContentStyle={{ padding: 6, gap: 2 }}
      >
        <AnchoredDropdownOption
          active={false}
          density="compact"
          onPress={() => runAction(onShowDetails)}
          style={{ backgroundColor: "transparent", borderColor: "transparent" }}
        >
          <View style={{ minHeight: 30, flexDirection: "row", alignItems: "center", gap: 9 }}>
            <GoAtletaIcon name="view" size={16} color={colors.muted} />
            <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>Ver detalhes</Text>
          </View>
        </AnchoredDropdownOption>
        <AnchoredDropdownOption
          active={false}
          density="compact"
          onPress={() => runAction(onOpenPlan)}
          style={{ backgroundColor: "transparent", borderColor: "transparent" }}
        >
          <View style={{ minHeight: 30, flexDirection: "row", alignItems: "center", gap: 9 }}>
            <GoAtletaIcon name="document" size={16} color={colors.muted} />
            <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>Abrir plano completo</Text>
          </View>
        </AnchoredDropdownOption>
      </AnchoredDropdown>
    </>
  );
}

function LessonRow({ colors, event, selected, durationMinutes, mobile, onPress, onOpenPlan }: {
  colors: ThemeColors;
  event: ProfessorAgendaEvent;
  selected: boolean;
  durationMinutes: number;
  mobile: boolean;
  onPress: () => void;
  onOpenPlan: () => void;
}) {
  const status = planningStatusMeta(lessonPlanningStatus(event), colors);
  const past = event.date < todayIsoKey();
  if (mobile) {
    return (
      <View
        style={{
          position: "relative",
          borderRadius: selected ? 9 : 0,
          borderWidth: selected ? 1 : 0,
          borderColor: status.color,
          opacity: past && !selected ? 0.52 : 1,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Abrir aula de ${event.dateLabel}`}
          onPress={onPress}
          style={{ padding: 12, paddingRight: 50, gap: 9 }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
              <View accessible accessibilityLabel={`Status: ${status.label}`} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: status.color }} />
              <Text style={{ color: colors.text, fontSize: 11, fontWeight: "800" }}>{event.weekdayLabel} · {event.dateLabel.slice(0, 5)}</Text>
            </View>
          </View>
          <Text style={{ color: colors.text, fontSize: 12, lineHeight: 17, fontWeight: "800" }}>
            S{event.weekNumber} · {event.isMonthlyGameSession ? "Jogo consolidado do mês" : event.title}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <Text style={{ color: colors.muted, fontSize: 10 }}>{durationMinutes} min · {event.roleLabel}</Text>
            <Text style={{ color: colors.muted, fontSize: 10 }}>{event.loadLabel || "Carga não informada"}</Text>
          </View>
        </Pressable>
        <View style={{ position: "absolute", right: 8, top: 8 }}>
          <LessonRowActions
            colors={colors}
            event={event}
            onShowDetails={() => {
              if (!selected) onPress();
            }}
            onOpenPlan={onOpenPlan}
          />
        </View>
      </View>
    );
  }
  return (
    <View
      style={{
        minHeight: 43,
        borderRadius: selected ? 7 : 0,
        borderWidth: selected ? 1 : 0,
        borderColor: status.color,
        flexDirection: "row",
        alignItems: "center",
        opacity: past && !selected ? 0.52 : 1,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Abrir aula de ${event.dateLabel}`}
        onPress={onPress}
        style={{
          minHeight: 41,
          paddingLeft: 9,
          flex: 1,
          minWidth: 0,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        <View accessible accessibilityLabel={`Status: ${status.label}`} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: status.color }} />
        <View style={{ width: 92, flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ color: colors.text, fontSize: 9, fontWeight: "800" }}>{event.weekdayLabel} · {event.dateLabel.slice(0, 5)}</Text>
        </View>
        <Text numberOfLines={2} style={{ flex: 1, color: colors.text, fontSize: 10, lineHeight: 13, fontWeight: "700" }}>
          S{event.weekNumber} · {event.isMonthlyGameSession ? "Jogo consolidado do mês" : event.title}
        </Text>
        <Text style={{ width: 47, color: colors.text, fontSize: 9, fontWeight: "700" }}>{durationMinutes} min</Text>
        <Text numberOfLines={1} style={{ width: 78, color: colors.muted, fontSize: 9, textAlign: "right" }}>{event.loadLabel || "Sem PSE"}</Text>
      </Pressable>
      <View style={{ paddingHorizontal: 4 }}>
        <LessonRowActions
          colors={colors}
          event={event}
          onShowDetails={() => {
            if (!selected) onPress();
          }}
          onOpenPlan={onOpenPlan}
        />
      </View>
    </View>
  );
}

function WeekGroups({ colors, events, selectedEventId, durationMinutes, mobile, onSelect, onOpenPlan, renderSelectedDetail }: {
  colors: ThemeColors;
  events: ProfessorAgendaEvent[];
  selectedEventId?: string;
  durationMinutes: number;
  mobile: boolean;
  onSelect: (event: ProfessorAgendaEvent) => void;
  onOpenPlan: (event: ProfessorAgendaEvent) => void;
  renderSelectedDetail?: (event: ProfessorAgendaEvent) => ReactNode;
}) {
  const groups = useMemo(() => {
    const byWeek = new Map<number, ProfessorAgendaEvent[]>();
    for (const event of events) byWeek.set(event.weekNumber, [...(byWeek.get(event.weekNumber) ?? []), event]);
    return [...byWeek.entries()].sort(([a], [b]) => a - b);
  }, [events]);
  if (!groups.length) {
    return <View style={[cardStyle(colors), { padding: 16, gap: 5 }]}><Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>Nenhuma aula gerada para este mês</Text><Text style={{ color: colors.muted, fontSize: 11 }}>Atualize o mês a partir dos parâmetros do ciclo.</Text></View>;
  }
  return (
    <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: "hidden" }}>
      {!mobile ? (
        <View style={{ minHeight: 30, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", backgroundColor: colors.secondaryBg }}>
          <Text style={{ width: 96, color: colors.muted, fontSize: 9 }}>Semana</Text>
          <Text style={{ width: 107, color: colors.muted, fontSize: 9 }}>Aulas</Text>
          <Text style={{ flex: 1, color: colors.muted, fontSize: 9 }}>Tema principal</Text>
          <Text style={{ width: 53, color: colors.muted, fontSize: 9 }}>Duração</Text>
          <Text style={{ width: 78, color: colors.muted, fontSize: 9 }}>Relação com o ciclo</Text>
        </View>
      ) : null}
      {groups.map(([weekNumber, weekEvents], groupIndex) => (
        <View key={weekNumber} style={{ flexDirection: mobile ? "column" : "row", borderTopWidth: groupIndex || !mobile ? 1 : 0, borderTopColor: colors.border }}>
          <View style={{ width: mobile ? "100%" : 96, padding: 9, gap: 2, backgroundColor: mobile ? colors.secondaryBg : "transparent" }}>
            <Text style={{ color: colors.text, fontSize: 11, fontWeight: "900" }}>Semana {weekNumber}</Text>
            <Text style={{ color: colors.muted, fontSize: 9 }}>{dateRangeLabel(weekEvents)}</Text>
          </View>
          <View style={{ flex: 1, borderLeftWidth: mobile ? 0 : 1, borderLeftColor: colors.border }}>
            {weekEvents.map((event, eventIndex) => (
              <View key={event.id} style={{ borderTopWidth: eventIndex ? 1 : 0, borderTopColor: colors.border }}>
                <LessonRow colors={colors} event={event} selected={selectedEventId === event.id} durationMinutes={durationMinutes} mobile={mobile} onPress={() => onSelect(event)} onOpenPlan={() => onOpenPlan(event)} />
                {mobile && selectedEventId === event.id && renderSelectedDetail ? (
                  <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>{renderSelectedDetail(event)}</View>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const DISTRIBUTION_COLORS = ["#67A9FF", "#7BD66B", "#B784F7", "#F1B44C"];
function resolveDistribution(blocks: LessonBlock[]) {
  return blocks.length ? blocks.map((block) => ({ label: block.label, minutes: block.durationMinutes })) : [
    { label: "Aquecimento", minutes: 10 },
    { label: "Jogo", minutes: 45 },
    { label: "Fechamento", minutes: 5 },
  ];
}
function TimeDonut({ colors, blocks }: { colors: ThemeColors; blocks: LessonBlock[] }) {
  const items = resolveDistribution(blocks);
  const total = Math.max(1, items.reduce((sum, item) => sum + item.minutes, 0));
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
      <View style={{ width: 112, height: 112, alignItems: "center", justifyContent: "center" }}>
        <Svg width={112} height={112} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }} accessibilityLabel="Distribuição do tempo da aula">
          <Circle cx={56} cy={56} r={radius} fill="none" stroke={colors.secondaryBg} strokeWidth={10} />
          {items.map((item, index) => {
            const length = (item.minutes / total) * circumference;
            const currentOffset = offset;
            offset += length;
            return <Circle key={`${item.label}-${index}`} cx={56} cy={56} r={radius} fill="none" stroke={DISTRIBUTION_COLORS[index % DISTRIBUTION_COLORS.length]} strokeWidth={10} strokeDasharray={`${Math.max(0, length - 2)} ${circumference}`} strokeDashoffset={-currentOffset} strokeLinecap="butt" />;
          })}
        </Svg>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>{total}</Text>
        <Text style={{ color: colors.muted, fontSize: 10 }}>min</Text>
      </View>
      <View style={{ flex: 1, gap: 8 }}>
        {items.map((item, index) => <View key={`${item.label}-${index}`} style={{ flexDirection: "row", gap: 7, alignItems: "flex-start" }}><View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 3, backgroundColor: DISTRIBUTION_COLORS[index % DISTRIBUTION_COLORS.length] }} /><View style={{ flex: 1 }}><Text style={{ color: colors.muted, fontSize: 10 }}>{item.label}</Text><Text style={{ color: colors.muted, fontSize: 9 }}>{item.minutes} min · {Math.round(item.minutes / total * 100)}%</Text></View></View>)}
      </View>
    </View>
  );
}

function LessonDetail({ colors, event, classTime, onOpen, onClear }: { colors: ThemeColors; event: ProfessorAgendaEvent | null; classTime: string; onOpen: () => void; onClear: () => void }) {
  if (!event) return <View style={{ padding: 18, gap: 5 }}><Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>Selecione uma aula</Text><Text style={{ color: colors.muted, fontSize: 11 }}>O vínculo com o ciclo aparecerá aqui.</Text></View>;
  const title = event.isMonthlyGameSession ? "Jogo consolidado do mês" : event.title;
  const summary = event.isMonthlyGameSession
    ? "Aplicação da regra mensal em jogo formal, com aquecimento breve, tomada de decisão, comunicação e execução coletiva."
    : event.objective || event.guidance.subtitle || "Plano alinhado ao foco da semana.";
  return (
    <View style={{ padding: 16, gap: 15 }}>
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <View style={{ flex: 1, gap: 5 }}><Text style={{ color: colors.text, fontSize: 15, fontWeight: "900" }}>{title}</Text><StatusChip colors={colors} event={event} /></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Fechar detalhes da aula" onPress={onClear} style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border }}>
            <GoAtletaIcon name="close" size={18} color={colors.text} />
          </Pressable>
        </View>
        <Text style={{ color: colors.muted, fontSize: 10 }}>{event.weekdayLabel} · {event.dateLabel} · {classTime}</Text>
      </View>
      <View style={{ gap: 7 }}>
        <Text style={{ color: colors.text, fontSize: 11, fontWeight: "800" }}>Origem</Text>
        <View style={{ flexDirection: "row", gap: 8 }}><GoAtletaIcon name="document" size={16} color={colors.muted} /><View style={{ flex: 1, gap: 2 }}><Text style={{ color: colors.text, fontSize: 10, fontWeight: "700" }}>{event.isMonthlyGameSession ? "Regra mensal do voleibol" : `Semana ${event.weekNumber} do ciclo`}</Text><Text style={{ color: colors.muted, fontSize: 9, lineHeight: 14 }}>{event.isMonthlyGameSession ? "Derivada da regra mensal aplicada ao ciclo." : `${event.plan.phase || "Fase ativa"} · ${event.loadLabel || "carga prevista"}.`}</Text></View></View>
      </View>
      <View style={{ height: 1, backgroundColor: colors.border }} />
      <View style={{ gap: 9 }}><Text style={{ color: colors.text, fontSize: 11, fontWeight: "800" }}>Distribuição do tempo</Text><TimeDonut colors={colors} blocks={event.blocks} /></View>
      <View style={{ height: 1, backgroundColor: colors.border }} />
      <View style={{ gap: 5 }}><Text style={{ color: colors.text, fontSize: 11, fontWeight: "800" }}>Resumo da aula</Text><Text style={{ color: colors.muted, fontSize: 9, lineHeight: 14 }}>{summary}</Text></View>
      <View style={{ height: 1, backgroundColor: colors.border }} />
      <View style={{ gap: 7 }}><Text style={{ color: colors.text, fontSize: 11, fontWeight: "800" }}>Relação com o ciclo</Text><View style={{ flexDirection: "row", gap: 9, alignItems: "center" }}><View style={{ minWidth: 58, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: colors.successBg, alignItems: "center" }}><Text style={{ color: colors.successText, fontSize: 9, fontWeight: "800" }}>{event.loadLabel || "Sem PSE"}</Text></View><Text style={{ flex: 1, color: colors.muted, fontSize: 9, lineHeight: 14 }}>{event.isMonthlyGameSession ? `Alinhada ao fechamento da semana ${event.weekNumber}, na fase ${event.plan.phase || "ativa"}.` : `${event.roleLabel}${event.loadLabel ? ` com ${event.loadLabel}` : ""}, dentro da fase ${event.plan.phase || "atual"}.`}</Text></View></View>
      <ActionButton colors={colors} label="Abrir plano completo" icon="view" onPress={onOpen} />
    </View>
  );
}

function UnconfiguredGate({ colors, onOpenManager }: { colors: ThemeColors; onOpenManager: () => void }) {
  return (
    <View style={[cardStyle(colors), { maxWidth: 720, width: "100%", alignSelf: "center", padding: 24, gap: 14, alignItems: "flex-start" }]}>
      <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: colors.infoBg, alignItems: "center", justifyContent: "center" }}><GoAtletaIcon name="periodization" size={24} color={colors.infoText} /></View>
      <View style={{ gap: 6 }}><Text style={{ color: colors.text, fontSize: 20, fontWeight: "900" }}>Configure a periodização para liberar o planejamento</Text><Text style={{ color: colors.muted, fontSize: 13, lineHeight: 20 }}>A agenda só será exibida depois que nível, início, duração e modelo de carga estiverem definidos. Assim, cada aula nasce vinculada ao ciclo correto.</Text></View>
      <ActionButton colors={colors} label="Configurar periodização" icon="options" primary onPress={onOpenManager} />
    </View>
  );
}

export function UnifiedPlanningWorkspace({ colors, classId, initialMonthKey, onOpenManager }: Props) {
  const { height } = useWindowDimensions();
  const { containerRef, layout, onLayout, width } = useContainerResponsiveLayout("dashboard");
  const mobile = layout.isMobile;
  const split = layout.supportsSplitView;
  const dense = layout.supportsDenseGrid;
  const [selectedMonthKey, setSelectedMonthKey] = useState(validMonthKey(initialMonthKey) ? String(initialMonthKey) : currentMonthKey());
  const [selectedEvent, setSelectedEvent] = useState<ProfessorAgendaEvent | null>(null);
  const [showLesson, setShowLesson] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const { confirm: confirmDialog } = useConfirmDialog();
  const { showSaveToast } = useSaveToast();
  const monthly = useMonthlyPlans(classId, selectedMonthKey);
  const sessionPlan = useSessionTrainingPlan({
    classGroup: monthly.selectedClass,
    students: monthly.students,
    calendarExceptions: monthly.calendarExceptions,
    recentAttendance: monthly.recentAttendance,
    recentSessionLogs: monthly.recentSessionLogs,
    studentContexts: monthly.studentContexts,
  });
  const summaries = useMemo(() => buildMonthPlanningSummaries(monthly.classPlans, monthly.selectedClass, monthly.activeCycle, monthly.calendarExceptions), [monthly.activeCycle, monthly.calendarExceptions, monthly.classPlans, monthly.selectedClass]);
  const visibleSummaries = useMemo(() => {
    const year = selectedMonthKey.slice(0, 4);
    const sameYear = summaries.filter((summary) => summary.monthKey.startsWith(`${year}-`));
    return sameYear.length ? sameYear : summaries;
  }, [selectedMonthKey, summaries]);
  const monthPresentations = useMemo(() => buildMonthCyclePresentations({ summaries: visibleSummaries, classPlans: monthly.classPlans, selectedClass: monthly.selectedClass, calendarExceptions: monthly.calendarExceptions }), [monthly.calendarExceptions, monthly.classPlans, monthly.selectedClass, visibleSummaries]);
  const currentPresentation = monthPresentations.get(selectedMonthKey);
  const needsRegeneration = monthNeedsRegeneration(monthly.weeklyItems.map((item) => item.plan), monthly.agendaEvents.length > 0);

  useEffect(() => {
    if (!summaries.length || summaries.some((summary) => summary.monthKey === selectedMonthKey)) return;
    const fallback = summaries.find((summary) => summary.monthKey >= currentMonthKey()) ?? summaries[0];
    if (fallback) setSelectedMonthKey(fallback.monthKey);
  }, [selectedMonthKey, summaries]);
  useEffect(() => {
    if (!monthly.agendaEvents.length) { setSelectedEvent(null); return; }
    setSelectedEvent((current) => {
      const persisted = monthly.agendaEvents.find((event) => event.id === current?.id);
      if (persisted) return persisted;
      if (!split) return null;
      return monthly.agendaEvents.find((event) => event.isMonthlyGameSession) ?? monthly.agendaEvents.at(-1) ?? monthly.agendaEvents[0];
    });
  }, [monthly.agendaEvents, split]);

  const applyMonth = useCallback(async () => {
    if (!monthly.selectedClass || isApplying) return;
    const confirmed = await confirmDialog({ title: `Atualizar ${monthTitle(selectedMonthKey)}?`, message: "As aulas automáticas serão recalculadas a partir da periodização. Planos personalizados e aulas concluídas serão preservados.", confirmLabel: "Atualizar mês", cancelLabel: "Continuar revisando", onConfirm: async () => {} });
    if (!confirmed) return;
    setIsApplying(true);
    try {
      const result = await regenerateMonthPlans({
        classGroup: monthly.selectedClass,
        monthKey: selectedMonthKey,
        classPlans: monthly.classPlans,
        activeCycle: monthly.activeCycle,
        activeCycleId: monthly.activeCycle?.id,
        activeCycleStartDate: monthly.activeCycle?.startDate,
        activeCycleEndDate: monthly.activeCycle?.endDate,
        calendarExceptions: monthly.calendarExceptions,
        students: monthly.students,
        recentAttendance: monthly.recentAttendance,
        recentSessionLogs: monthly.recentSessionLogs,
        studentContexts: monthly.studentContexts,
      });
      await monthly.reload();
      showSaveToast(result.status === "outside_cycle" ? { variant: "warning", message: "Este mês está fora do ciclo ativo. Revise os parâmetros do ciclo." } : { variant: "success", message: `${result.weeklyPlanCount} semana${result.weeklyPlanCount === 1 ? "" : "s"} atualizada${result.weeklyPlanCount === 1 ? "" : "s"}.` });
    } catch (error) { showSaveToast({ variant: "error", error }); } finally { setIsApplying(false); }
  }, [confirmDialog, isApplying, monthly, selectedMonthKey, showSaveToast]);

  if (monthly.isLoading && !monthly.selectedClass) return <View style={{ minHeight: 360, alignItems: "center", justifyContent: "center", gap: 10 }}><ActivityIndicator color={colors.primary} /><Text style={{ color: colors.muted, fontSize: 12 }}>Carregando ciclo e aulas...</Text></View>;
  if (monthly.error) return <View style={[cardStyle(colors), { maxWidth: 680, alignSelf: "center", padding: 20, gap: 12 }]}><Text style={{ color: colors.dangerText, fontSize: 16, fontWeight: "800" }}>Não foi possível carregar o planejamento</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{monthly.error}</Text><ActionButton colors={colors} label="Tentar novamente" icon="refresh" onPress={() => void monthly.reload()} /></View>;
  if (!monthly.isPeriodizationConfigured) return <UnconfiguredGate colors={colors} onOpenManager={onOpenManager} />;

  const classTime = [monthly.selectedClass?.startTime, monthly.selectedClass?.endTime].filter(Boolean).join(" – ");
  const durationMinutes = monthly.selectedClass?.durationMinutes ?? 60;
  const panelHeight = Math.max(590, height - 205);
  const selectMonth = (monthKey: string) => {
    setSelectedMonthKey(monthKey);
    setSelectedEvent(null);
    setShowLesson(false);
    sessionPlan.clear();
  };
  const selectEvent = (event: ProfessorAgendaEvent) => setSelectedEvent((current) => !split && current?.id === event.id ? null : event);
  const openEventPlan = async (event: ProfessorAgendaEvent) => {
    setSelectedEvent(event);
    try {
      await sessionPlan.loadOrGenerate(event);
      setShowLesson(true);
    } catch (error) {
      showSaveToast({
        variant: "error",
        message: "Não foi possível abrir o plano completo desta aula.",
        error,
      });
    }
  };
  const selectedPeriodizationSource: ClassPlanPeriodizationSource | undefined = selectedEvent
    ? {
        weekLabel: `Semana ${selectedEvent.weekNumber}`,
        phaseLabel: currentPresentation?.phase || selectedEvent.plan.phase || "Fase do ciclo",
        focusLabel: selectedEvent.focusLabel || selectedEvent.objective || selectedEvent.title,
        loadLabel: selectedEvent.loadLabel || currentPresentation?.loadRangeLabel || "Carga não informada",
        roleLabel: selectedEvent.roleLabel || "Aula do ciclo",
        monthlyGameSession: selectedEvent.isMonthlyGameSession,
      }
    : undefined;
  const monthRail = <MonthRail colors={colors} summaries={visibleSummaries} selectedMonthKey={selectedMonthKey} selectedMonthEvents={monthly.agendaEvents} presentations={monthPresentations} horizontal={!dense} onSelect={selectMonth} />;
  const detail = <LessonDetail colors={colors} event={selectedEvent} classTime={classTime || "Horário da turma"} onClear={() => setSelectedEvent(null)} onOpen={() => { if (selectedEvent) void openEventPlan(selectedEvent); }} />;
  const monthContent = (
    <View style={{ gap: 11 }}>
      <MonthOverview colors={colors} monthKey={selectedMonthKey} events={monthly.agendaEvents} presentation={currentPresentation} compact={!dense} needsRegeneration={needsRegeneration} isApplying={isApplying} onRegenerate={() => void applyMonth()} />
      <WeekGroups
        colors={colors}
        events={monthly.agendaEvents}
        selectedEventId={selectedEvent?.id}
        durationMinutes={durationMinutes}
        mobile={!split}
        onSelect={selectEvent}
        onOpenPlan={(event) => void openEventPlan(event)}
        renderSelectedDetail={!split ? () => detail : undefined}
      />
    </View>
  );

  return (
    <View ref={containerRef} onLayout={onLayout} style={{ gap: 0, borderTopWidth: layout.usesWorkspaceShell ? 1 : 0, borderTopColor: colors.border }}>
      {!dense ? <View style={{ paddingVertical: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}><View style={{ gap: 5 }}><View><Text style={{ color: colors.text, fontSize: 14, fontWeight: "900" }}>Ciclo {monthly.activeCycle?.year ?? selectedMonthKey.slice(0, 4)}</Text><Text style={{ color: colors.muted, fontSize: 10 }}>Trilho anual do ciclo</Text></View><PlanningStatusLegend colors={colors} /></View>{mobile ? <ActionButton colors={colors} label="Parâmetros" icon="options" onPress={onOpenManager} /> : null}</View>{monthRail}</View> : null}
      {dense ? (
        <View style={{ height: panelHeight, minHeight: 590, flexDirection: "row", backgroundColor: colors.background }}>
          <View style={{ width: "24%", minWidth: 252, maxWidth: 350, padding: 14, gap: 10, borderRightWidth: 1, borderRightColor: colors.border }}>
            <View style={{ gap: 6 }}><View style={{ gap: 2 }}><Text style={{ color: colors.text, fontSize: 15, fontWeight: "900" }}>Ciclo {monthly.activeCycle?.year ?? selectedMonthKey.slice(0, 4)}</Text><Text style={{ color: colors.muted, fontSize: 10 }}>Trilho anual do ciclo</Text></View><PlanningStatusLegend colors={colors} /></View>
            {monthRail}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator contentContainerStyle={{ padding: 14 }}>{monthContent}</ScrollView>
          </View>
          <View style={{ width: "27%", minWidth: 286, maxWidth: 380, borderLeftWidth: 1, borderLeftColor: colors.border }}>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator contentContainerStyle={{ minHeight: "100%" }}>{detail}</ScrollView>
          </View>
        </View>
      ) : split ? (
        <View style={{ height: panelHeight, minHeight: 590, flexDirection: "row", paddingVertical: 12 }}>
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator contentContainerStyle={{ paddingRight: 12 }}>{monthContent}</ScrollView>
          <View style={{ width: "38%", minWidth: 270, borderLeftWidth: 1, borderLeftColor: colors.border }}>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator>{detail}</ScrollView>
          </View>
        </View>
      ) : <View style={{ gap: 12, paddingVertical: 12 }}>{monthContent}</View>}
      {needsRegeneration ? <View style={{ flexDirection: width >= 640 ? "row" : "column", alignItems: width >= 640 ? "center" : "stretch", gap: 10, paddingVertical: 11, paddingHorizontal: dense ? 16 : 0, borderTopWidth: 1, borderTopColor: colors.border }}><View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 7 }}><GoAtletaIcon name="warning" size={16} color={colors.warningText} /><Text style={{ color: colors.muted, fontSize: 10 }}>O mês precisa ser atualizado. Planos personalizados e aulas concluídas serão preservados.</Text></View></View> : null}
      {showLesson && sessionPlan.plan && monthly.selectedClass && selectedEvent ? (
        <ClassPlanPreviewModal
          visible
          plan={sessionPlan.plan}
          classGroup={monthly.selectedClass}
          lessonDate={sessionPlan.lessonDate || selectedEvent.date}
          initialMode="preview"
          periodizationSource={selectedPeriodizationSource}
          onClose={() => {
            setShowLesson(false);
            sessionPlan.clear();
          }}
          onSavePlan={async (draft) => {
            const savedPlan = await sessionPlan.savePlan(draft);
            await monthly.reload();
            return savedPlan;
          }}
          onRemovePlan={async () => {
            await sessionPlan.removePlan();
            setShowLesson(false);
            await monthly.reload();
          }}
        />
      ) : null}
    </View>
  );
}
