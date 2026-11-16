import { PlanningAssistantHost, usePlanningAssistant } from "./PlanningAssistant";
import { ProfilePlanReview } from "./components/ProfilePlanReview";
import { useActionSignal } from "../../hooks/use-action-signal";
import { Suspense, lazy, memo, type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, useWindowDimensions, View } from "react-native";
import { OperationalText as Text } from "../../ui/OperationalText";
import Svg, { Path } from "react-native-svg";

import { ResponsivePage } from "../../components/ui/ResponsivePage";
import type { ClassGroup, LessonBlock, PlanningCycle, RecentSessionSummary } from "../../core/models";
import { parsePeriodizationPolicy } from "../../core/periodization-policy";
import { resolveClassDevelopmentLevelLabel } from "../../core/class-development-level";
import { useWhatsAppSettings } from "../../ui/whatsapp-settings-context";
import { AnchoredDropdown } from "../../ui/AnchoredDropdown";
import { AnchoredDropdownOption } from "../../ui/AnchoredDropdownOption";
import type { ThemeColors } from "../../ui/app-theme";
import { useConfirmDialog } from "../../ui/confirm-dialog";
import { GoAtletaIcon, type GoAtletaIconName } from "../../ui/icon-registry";
import { Pressable } from "../../ui/Pressable";
import { formatShortDate } from "../../ui/DateInput";
import { useSaveToast } from "../../ui/save-toast";
import { ShimmerBlock } from "../../ui/Shimmer";
import { useCollapsibleAnimation } from "../../ui/use-collapsible";
import { useContainerResponsiveLayout } from "../../ui/use-container-responsive-layout";
import type { ClassPlanPeriodizationSource } from "../classes/components/ClassPlanPreviewModal";
import {
  ClassPlanModalFrame,
  ClassPlanModalHeader,
  isClassPlanPhoneLayout,
} from "../classes/components/ClassPlanModalFrame";
import { PlanTimeDistribution } from "../classes/components/PlanTimeDistribution";
import { regenerateMonthPlans } from "../planning/application/regenerate-month-plans";
import { isMonthWithinPlanningCycle } from "../planning/application/planning-cycle-selection";
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
  resolveDefaultSelectedAgendaEvent,
  resolveUnifiedPlanningContextLayout,
  type MonthCyclePresentation,
} from "./application/unified-planning-view-model";
import {
  PeriodizationLoadCurve,
  type PeriodizationLoadCurveDraft,
} from "./components/PeriodizationLoadCurve";
import { compactUiMetrics } from "../../theme/tokens";
import { getClassAssignmentScheduleLabels } from "../coordination/application/class-assignment-meta";

const ClassPlanPreviewModal = lazy(() =>
  import("../classes/components/ClassPlanPreviewModal").then((module) => ({
    default: module.ClassPlanPreviewModal,
  }))
);

type ClassPlanModalHostProps = {
  colors: ThemeColors;
  className: string;
  lessonDate: string;
  onClose: () => void;
  children?: ReactNode;
};

function ClassPlanLoadingContent({ colors, className, lessonDate, onClose }: Omit<ClassPlanModalHostProps, "children">) {
  const { width } = useWindowDimensions();
  const phoneLayout = isClassPlanPhoneLayout(width);
  const formattedDate = lessonDate.split("-").reverse().join("/");

  return (
    <>
      <ClassPlanModalHeader
        phoneLayout={phoneLayout}
        borderColor={colors.border}
        textColor={colors.text}
        mutedColor={colors.muted}
        title="Plano da aula"
        subtitle={`${className} · ${formattedDate}`}
      >
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fechar plano"
          style={({ pressed }) => ({
            width: phoneLayout ? 38 : 42,
            height: phoneLayout ? 38 : 42,
            borderRadius: phoneLayout ? 19 : 21,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.72 : 1,
          })}
        >
          <GoAtletaIcon name="close" size={compactUiMetrics.iconSize} color={colors.text} />
        </Pressable>
      </ClassPlanModalHeader>
      <View
        accessibilityLiveRegion="polite"
        accessibilityRole="progressbar"
        style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: colors.backgroundSubtle }}
      >
        <ActivityIndicator size="small" color={colors.primaryBg} />
        <Text style={{ color: colors.text, fontSize: compactUiMetrics.bodyFontSize, fontWeight: "800" }}>Carregando plano…</Text>
      </View>
    </>
  );
}

function ClassPlanModalHost({ colors, className, lessonDate, onClose, children }: ClassPlanModalHostProps) {
  const modalContentSafeAreaStyle = {
    flex: 1,
    minHeight: 0,
  } as const;

  return (
    <ClassPlanModalFrame
      visible
      onClose={onClose}
      borderColor={colors.border}
    >
      <PlanningAssistantHost colors={colors} surface="lesson">
      <View style={modalContentSafeAreaStyle}>
        {children ?? (
          <ClassPlanLoadingContent
            colors={colors}
            className={className}
            lessonDate={lessonDate}
            onClose={onClose}
          />
        )}
      </View>
      </PlanningAssistantHost>
    </ClassPlanModalFrame>
  );
}

type Props = {
  colors: ThemeColors;
  classId: string;
  initialMonthKey?: string;
  operationalCycle?: PlanningCycle | null;
  archivedCycles?: PlanningCycle[];
  recentSessionSummaries?: RecentSessionSummary[];
  regenerateMonthSignal?: number;
  refreshSignal?: number;
  onMonthChange?: (monthKey: string) => void;
  onOpenManager: (mode?: "manage" | "create-next") => void;
  onRegenerateCycle?: () => void;
};

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const validMonthKey = (value: string | undefined) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value ?? ""));

const currentMonthKey = (targetYear?: string) => {
  const today = new Date();
  const year = targetYear && /^\d{4}$/.test(targetYear) ? targetYear : String(today.getFullYear());
  return `${year}-${String(today.getMonth() + 1).padStart(2, "0")}`;
};
const capitalize = (value: string) => value ? `${value.charAt(0).toLocaleUpperCase("pt-BR")}${value.slice(1)}` : value;
export const monthTitle = (monthKey: string) => {
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

const todayIsoKey = (targetYear?: string) => {
  const today = new Date();
  const year = targetYear && /^\d{4}$/.test(targetYear) ? targetYear : String(today.getFullYear());
  return `${year}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
};
const planningStatusMeta = (status: PlanningVisualStatus, colors: ThemeColors) => {
  if (status === "pending") return { color: colors.warning, label: "Pendente" };
  if (status === "unplanned") return { color: colors.danger, label: "Não planejada" };
  return { color: colors.success, label: "Planejada" };
};
const lessonStatusMeta = (event: ProfessorAgendaEvent, history: RecentSessionSummary | undefined, colors: ThemeColors) => {
  if (history?.executionState === "skipped") {
    return { label: "Cancelada", color: colors.muted, icon: "closeCircle" } as const;
  }
  if (history?.executionState === "confirmed_executed" || history?.wasConfirmedExecuted) {
    return { label: "Concluída", color: colors.successText, icon: "checkmarkCircle" } as const;
  }
  if (event.status === "needs_review") {
    return { label: "Revisar plano", color: colors.warningText, icon: "warningCircle" } as const;
  }
  if (history?.executionState === "applied_not_confirmed" || history?.wasApplied) {
    return { label: "Plano aplicado", color: colors.infoText, icon: "success" } as const;
  }
  if (event.status === "ready") {
    return { label: "Plano pronto", color: colors.infoText, icon: "document" } as const;
  }
  return { label: "Prevista", color: colors.muted, icon: "calendar" } as const;
};
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
        minHeight: compactUiMetrics.touchTarget,
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

const LoadSparkline = memo(function LoadSparkline({ color, values, width = 56, height = 24 }: { color: string; values: number[]; width?: number; height?: number }) {
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
});

const PlanningStatusLegend = memo(function PlanningStatusLegend({ colors }: { colors: ThemeColors }) {
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
});

const MonthRail = memo(function MonthRail({ colors, summaries, selectedMonthKey, selectedMonthEvents, presentations, horizontal, referenceMonthKey, onSelect }: {
  colors: ThemeColors;
  summaries: MonthPlanningSummary[];
  selectedMonthKey: string;
  selectedMonthEvents: ProfessorAgendaEvent[];
  presentations: Map<string, MonthCyclePresentation>;
  horizontal: boolean;
  referenceMonthKey?: string;
  onSelect: (monthKey: string) => void;
}) {
  const activeCurrentMonth = referenceMonthKey ?? currentMonthKey();
  const horizontalRailRef = useRef<ScrollView>(null);
  const lastScrolledMonthIndexRef = useRef<number | null>(null);
  const selectedMonthIndex = summaries.findIndex((summary) => summary.monthKey === selectedMonthKey);

  useEffect(() => {
    if (!horizontal || selectedMonthIndex < 0) return;
    const animate =
      lastScrolledMonthIndexRef.current !== null &&
      lastScrolledMonthIndexRef.current !== selectedMonthIndex;
    const frame = requestAnimationFrame(() => {
      horizontalRailRef.current?.scrollTo({
        x: selectedMonthIndex * 146,
        animated: animate,
      });
      lastScrolledMonthIndexRef.current = selectedMonthIndex;
    });
    return () => cancelAnimationFrame(frame);
  }, [horizontal, selectedMonthIndex]);

  if (horizontal) {
    return (
      <ScrollView ref={horizontalRailRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
        {summaries.map((summary) => {
          const presentation = presentations.get(summary.monthKey);
          const phase = presentation?.phase ?? "Sem semanas geradas";
          const selected = summary.monthKey === selectedMonthKey;
          const planningStatus = selected && selectedMonthEvents.some((event) => event.status === "needs_review")
            ? "pending"
            : presentation?.planningStatus ?? (summary.hasPlans ? "planned" : "unplanned");
          const status = planningStatusMeta(planningStatus, colors);
          const loadTone = resolveLoadTone(presentation?.loadValues ?? [], colors);
          const past = summary.monthKey < activeCurrentMonth;
          return (
            <Pressable key={summary.monthKey} accessibilityRole="button" aria-pressed={selected} accessibilityLabel={`Abrir ${summary.label}. Status: ${status.label}. ${phase}. Semanas ${presentation?.weekRangeLabel ?? "não geradas"}. ${summary.estimatedLessonCount} aulas.`} accessibilityState={{ selected }} onPress={() => onSelect(summary.monthKey)} style={{
              width: 138,
              minHeight: compactUiMetrics.touchTarget,
              padding: 10,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: selected ? status.color : colors.border,
              backgroundColor: selected ? colors.secondaryBg : "transparent",
              gap: 3,
            }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: status.color, opacity: past && !selected ? 0.6 : 1 }} />
                <Text style={{ color: past && !selected ? colors.muted : colors.text, fontSize: compactUiMetrics.bodyFontSize, fontWeight: "900" }}>{MONTH_NAMES[summary.month - 1]}</Text>
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
          const past = summary.monthKey < activeCurrentMonth;
          return (
            <Pressable
              key={summary.monthKey}
              accessibilityRole="button"
              accessibilityLabel={`Abrir ${summary.label}. Status: ${status.label}.`}
              accessibilityState={{ selected }}
              onPress={() => onSelect(summary.monthKey)}
              style={{
                minHeight: 53,
                paddingHorizontal: 9,
                borderLeftWidth: 2,
                borderLeftColor: selected ? colors.primaryBg : "transparent",
                backgroundColor: selected ? colors.secondaryBg : "transparent",
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <View style={{ width: 44, flexDirection: "row", alignItems: "center", gap: 9 }}>
                <View accessible accessibilityLabel={`Status: ${status.label}`} style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: status.color, borderWidth: 1, borderColor: colors.background, opacity: past && !selected ? 0.6 : 1 }} />
                <Text style={{ color: past && !selected ? colors.muted : colors.text, fontSize: 12, fontWeight: selected ? "600" : "400" }}>{MONTH_NAMES[summary.month - 1]}</Text>
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
});



const MonthContextSummary = memo(function MonthContextSummary({ colors, events, presentation, compact = false, horizontal = false }: {
  colors: ThemeColors;
  events: ProfessorAgendaEvent[];
  presentation?: MonthCyclePresentation;
  compact?: boolean;
  horizontal?: boolean;
}) {
  const firstWithFocus = events.find((event) => Boolean(event.focusLabel || event.objective));
  const mainFocus = presentation?.phase || firstWithFocus?.focusLabel || firstWithFocus?.objective || "Fase base";
  const loadTarget = presentation?.loadRangeLabel || "PSE moderada";
  const gameDays = events.filter((event) => event.isMonthlyGameSession).length;
  const gameLabel = gameDays > 0 ? `${gameDays} jogo${gameDays > 1 ? "s" : ""}` : "Sem jogo formal";
  const blocks = [
    { key: "focus", label: "Foco do mês", value: `${mainFocus}${presentation?.weekRangeLabel && presentation.weekRangeLabel !== "—" ? ` · S${presentation.weekRangeLabel}` : ""}` },
    { key: "load", label: "Carga prevista", value: loadTarget },
    { key: "sessions", label: "Aulas no mês", value: `${events.length} aulas · ${gameLabel}` },
  ];
  return (
    <View style={{ flexDirection: horizontal ? "row" : "column", gap: 12, paddingVertical: 4 }}>
      {blocks.map((block) => {
        return (
          <View key={block.key} style={{ flex: horizontal ? 1 : undefined, minWidth: 0, flexDirection: horizontal ? "column" : "row", alignItems: horizontal ? "flex-start" : "center", gap: horizontal ? 4 : 12 }}>
            <Text style={{ width: horizontal ? undefined : 88, color: colors.muted, fontSize: compactUiMetrics.metadataFontSize }}>{block.label}</Text>
            <View style={{ flex: horizontal ? undefined : 1, minWidth: 0, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              <Text numberOfLines={compact ? 2 : undefined} style={{ flexShrink: 1, color: colors.text, fontSize: compactUiMetrics.bodyFontSize, fontWeight: "600" }}>{block.value}</Text>
              {block.key === "load" && presentation?.loadValues.length ? <LoadSparkline color={resolveLoadTone(presentation.loadValues, colors)} values={presentation.loadValues} width={48} height={18} /> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
});

const LOAD_MODEL_LABELS: Record<string, string> = {
  ondulatorio: "Ondulatório",
  linear: "Linear",
  linear_reverso: "Linear reverso",
  blocos: "Blocos",
};

const GOAL_LABELS: Record<string, string> = {
  iniciacao: "Iniciação esportiva",
  desenvolvimento: "Desenvolvimento motor e técnico",
  aperfeicoamento: "Aperfeiçoamento e consolidação",
  competicao: "Competição e performance",
};

const resolveGoalLabel = (goal?: string) => {
  const normalized = (goal ?? "").trim();
  if (!normalized) return "Desenvolvimento geral";
  return GOAL_LABELS[normalized.toLocaleLowerCase("pt-BR")] ?? normalized;
};

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

const LessonRow = memo(function LessonRow({ colors, event, history, selected, durationMinutes, mobile, referenceTodayIso, onPress, onOpenPlan }: {
  colors: ThemeColors;
  event: ProfessorAgendaEvent;
  history?: RecentSessionSummary;
  selected: boolean;
  durationMinutes: number;
  mobile: boolean;
  referenceTodayIso?: string;
  onPress: () => void;
  onOpenPlan: () => void;
}) {
  const status = lessonStatusMeta(event, history, colors);
  const past = event.date < (referenceTodayIso ?? todayIsoKey());
  if (mobile) {
    return (
      <View
        style={{
          position: "relative",
          borderRadius: selected ? 9 : 0,
          borderWidth: selected ? 1 : 0,
          borderColor: status.color,
        }}
      >
        <Pressable
          nativeID={`periodization-lesson-${event.id}`}
          accessibilityRole="button"
          accessibilityLabel={`Abrir aula de ${event.dateLabel}. ${status.label}`}
          accessibilityState={{ selected }}
          onPress={onPress}
          style={{ padding: 12, paddingRight: 50, gap: 9 }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 7 }}>
              <GoAtletaIcon name={status.icon} size={compactUiMetrics.secondaryIconSize} color={status.color} />
              <Text style={{ color: past && !selected ? colors.muted : colors.text, fontSize: 11, fontWeight: "800" }}>{event.weekdayLabel} · {event.dateLabel.slice(0, 5)}</Text>
              <Text style={{ color: status.color, fontSize: compactUiMetrics.metadataFontSize, fontWeight: "600" }}>{status.label}</Text>
            </View>
          </View>
          <Text style={{ color: past && !selected ? colors.muted : colors.text, fontSize: 12, lineHeight: 17, fontWeight: "800" }}>
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
      }}
    >
      <Pressable
        nativeID={`periodization-lesson-${event.id}`}
        accessibilityRole="button"
        accessibilityLabel={`Abrir aula de ${event.dateLabel}. ${status.label}`}
        accessibilityState={{ selected }}
        onPress={onPress}
        style={{
          minHeight: compactUiMetrics.touchTarget,
          paddingLeft: 9,
          flex: 1,
          minWidth: 0,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        <GoAtletaIcon name={status.icon} size={compactUiMetrics.secondaryIconSize} color={status.color} />
        <View style={{ width: 104, justifyContent: "center", gap: 2 }}>
          <Text style={{ color: past && !selected ? colors.muted : colors.text, fontSize: 9, fontWeight: "800" }}>{event.weekdayLabel} · {event.dateLabel.slice(0, 5)}</Text>
          <Text style={{ color: status.color, fontSize: compactUiMetrics.metadataFontSize }}>{status.label}</Text>
        </View>
        <Text numberOfLines={2} style={{ flex: 1, color: past && !selected ? colors.muted : colors.text, fontSize: 10, lineHeight: 13, fontWeight: "700" }}>
          S{event.weekNumber} · {event.isMonthlyGameSession ? "Jogo consolidado do mês" : event.title}
        </Text>
        <Text style={{ width: 47, color: past && !selected ? colors.muted : colors.text, fontSize: 9, fontWeight: "700" }}>{durationMinutes} min</Text>
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
});

const WeekGroups = memo(function WeekGroups({ colors, events, historyByDate, historical, selectedEventId, durationMinutes, mobile, referenceTodayIso, onSelect, onOpenPlan, renderSelectedDetail }: {
  colors: ThemeColors;
  events: ProfessorAgendaEvent[];
  historyByDate: Map<string, RecentSessionSummary>;
  historical: boolean;
  selectedEventId?: string;
  durationMinutes: number;
  mobile: boolean;
  referenceTodayIso?: string;
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
    return <View style={[cardStyle(colors), { padding: 16, gap: 5 }]}>
      <Text style={{ color: colors.text, fontSize: compactUiMetrics.bodyFontSize, fontWeight: "800" }}>
        {historical ? "Nenhuma aula registrada neste mês" : "Nenhuma aula gerada para este mês"}
      </Text>
      {!historical ? <Text style={{ color: colors.muted, fontSize: compactUiMetrics.bodyFontSize }}>Use Atualizar mês para gerar as aulas do ciclo.</Text> : null}
    </View>;
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
      {groups.map(([weekNumber, weekEvents], groupIndex) => {
        const isWeekPast = weekEvents.every((event) => event.date < (referenceTodayIso ?? todayIsoKey()));
        return (
          <View key={weekNumber} style={{ flexDirection: mobile ? "column" : "row", borderTopWidth: groupIndex || !mobile ? 1 : 0, borderTopColor: colors.border }}>
            <View style={{ width: mobile ? "100%" : 96, padding: 9, gap: 2, backgroundColor: mobile ? colors.secondaryBg : "transparent" }}>
              <Text style={{ color: isWeekPast ? colors.muted : colors.text, fontSize: 11, fontWeight: "900" }}>Semana {weekNumber}</Text>
              <Text style={{ color: colors.muted, fontSize: 9 }}>{dateRangeLabel(weekEvents)}</Text>
            </View>
            <View style={{ flex: 1, borderLeftWidth: mobile ? 0 : 1, borderLeftColor: colors.border }}>
              {weekEvents.map((event, eventIndex) => (
                <View key={event.id} style={{ borderTopWidth: eventIndex ? 1 : 0, borderTopColor: colors.border }}>
                  <LessonRow colors={colors} event={event} history={historyByDate.get(event.date)} selected={selectedEventId === event.id} durationMinutes={durationMinutes} mobile={mobile} referenceTodayIso={referenceTodayIso} onPress={() => onSelect(event)} onOpenPlan={() => onOpenPlan(event)} />
                  {selectedEventId === event.id && renderSelectedDetail ? (
                    <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>{renderSelectedDetail(event)}</View>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
});

function resolveDistribution(blocks: LessonBlock[]) {
  return blocks.length ? blocks.map((block) => ({ label: block.label, minutes: block.durationMinutes })) : [
    { label: "Aquecimento", minutes: 10 },
    { label: "Parte principal", minutes: 45 },
    { label: "Volta à calma", minutes: 5 },
  ];
}
function TimeDonut({ colors, blocks }: { colors: ThemeColors; blocks: LessonBlock[] }) {
  return <PlanTimeDistribution colors={colors} items={resolveDistribution(blocks)} compact emphasized showLegend={false} showHoverTooltip />;
}

const LessonDetail = memo(function LessonDetail({ colors, event, history, monthPresentation, classGroup, cycle, onOpen, onClear, showClose }: {
  colors: ThemeColors;
  event: ProfessorAgendaEvent | null;
  history?: RecentSessionSummary;
  monthPresentation?: MonthCyclePresentation;
  classGroup: ClassGroup;
  cycle?: PlanningCycle | null;
  onOpen: () => void;
  onClear: () => void;
  showClose: boolean;
}) {
  if (!event) return (
    <View style={{ padding: 18, gap: 5 }}>
      <View style={{ gap: 5 }}><Text style={{ color: colors.text, fontSize: compactUiMetrics.bodyFontSize, fontWeight: "800" }}>Visão do mês</Text><Text style={{ color: colors.muted, fontSize: 11 }}>Selecione uma aula para ver os detalhes.</Text></View>
    </View>
  );
  const title = event.isMonthlyGameSession ? "Jogo consolidado do mês" : event.title;
  const policy = parsePeriodizationPolicy(cycle?.periodizationPolicyJson);
  const cycleLengthWeeks = Math.max(1, classGroup.cycleLengthWeeks || 52);
  const curveDraft: PeriodizationLoadCurveDraft = {
    cycleLengthWeeks,
    loadModel: policy.loadModel,
    recoveryWeeks: policy.recoveryWeeks,
    intensityMin: policy.intensityMin,
    intensityMax: policy.intensityMax,
  };
  const durationMinutes = resolveDistribution(event.blocks).reduce((total, item) => total + item.minutes, 0);
  const phaseLabel = monthPresentation?.phase || event.plan.phase || "Fase ativa";
  const status = lessonStatusMeta(event, history, colors);
  const schedule = getClassAssignmentScheduleLabels(classGroup);
  return (
    <View style={{ padding: 16, gap: 14, overflow: "visible" }}>
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6 }}>
            <GoAtletaIcon name={status.icon} size={compactUiMetrics.secondaryIconSize} color={status.color} />
            <Text style={{ flexShrink: 1, color: colors.muted, fontSize: compactUiMetrics.metadataFontSize }}>{event.weekdayLabel} · {event.dateLabel.slice(0, 5)} · {classGroup.startTime || "Horário não informado"}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ color: colors.text, fontSize: 10, fontWeight: "800" }}>{durationMinutes} min</Text>
            {showClose ? <Pressable accessibilityRole="button" accessibilityLabel="Fechar detalhes da aula" onPress={onClear} style={{ width: compactUiMetrics.touchTarget, height: compactUiMetrics.touchTarget, borderRadius: 22, alignItems: "center", justifyContent: "center" }}>
              <GoAtletaIcon name="close" size={16} color={colors.text} />
            </Pressable> : null}
          </View>
        </View>
        <Text style={{ color: colors.text, fontSize: compactUiMetrics.bodyFontSize, lineHeight: compactUiMetrics.bodyLineHeight, fontWeight: "900" }}>{title}</Text>
        <Text style={{ color: colors.muted, fontSize: compactUiMetrics.metadataFontSize }}>
          {status.label} · Semana {event.weekNumber} · {phaseLabel} · {event.loadLabel || "Sem PSE"}
        </Text>
        <Text style={{ color: colors.muted, fontSize: compactUiMetrics.metadataFontSize }}>Turma · {schedule.daysLabel}</Text>
        {event.decisionReasons.length ? (
          <View style={{ gap: 4 }}>
            <Text style={{ color: colors.text, fontSize: 11, fontWeight: "800" }}>Por que este plano</Text>
            {event.decisionReasons.map((reason, index) => (
              <Text key={`${reason.message}-${index}`} style={{ color: colors.muted, fontSize: 10, lineHeight: 14 }}>
                {reason.message}{reason.evidence ? ` · ${reason.evidence}` : ""}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
      <View style={{ height: 1, backgroundColor: colors.border }} />
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, overflow: "visible" }}>
        <View style={{ width: 112, gap: 8, zIndex: 10, overflow: "visible" }}>
          <Text style={{ color: colors.text, fontSize: 11, fontWeight: "800" }}>Carga da aula</Text>
          <TimeDonut colors={colors} blocks={event.blocks} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
          <Text style={{ color: colors.text, fontSize: 11, fontWeight: "800" }}>Curva do ciclo</Text>
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator
            style={{ width: "100%", minHeight: 128 }}
            contentContainerStyle={{ paddingBottom: 5 }}
          >
            <PeriodizationLoadCurve
              colors={colors}
              weekPlans={[]}
              currentWeek={event.weekNumber}
              draft={curveDraft}
              compact
            />
          </ScrollView>
        </View>
      </View>
      <ActionButton colors={colors} label="Abrir plano completo" icon="document" primary onPress={onOpen} />
    </View>
  );
});

type PlanningGateAction = { label: string; icon: GoAtletaIconName; onPress: () => void };

function PlanningGate({ colors, title, description, action, secondaryAction, focusHeading = false }: {
  colors: ThemeColors;
  title: string;
  description: string;
  action?: PlanningGateAction;
  secondaryAction?: PlanningGateAction;
  focusHeading?: boolean;
}) {
  return (
    <ResponsivePage variant="dashboard" style={{ paddingHorizontal: 16, paddingVertical: 20 }}>
      <View style={[cardStyle(colors), { maxWidth: 440, width: "100%", alignSelf: "center", padding: 20, gap: 20 }]}>
        <View style={{ gap: 4 }}>
          <Text nativeID={focusHeading ? "periodization-outside-cycle" : undefined} tabIndex={focusHeading ? -1 : undefined} accessibilityRole="header" style={{ color: colors.text, fontSize: compactUiMetrics.titleFontSize, fontWeight: "800" }}>{title}</Text>
          <Text style={{ color: colors.muted, fontSize: compactUiMetrics.bodyFontSize, lineHeight: compactUiMetrics.bodyLineHeight }}>{description}</Text>
        </View>
        {action ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <ActionButton colors={colors} {...action} primary />
            {secondaryAction ? <ActionButton colors={colors} {...secondaryAction} /> : null}
          </View>
        ) : null}
      </View>
    </ResponsivePage>
  );
}

function PlanningWorkspaceLoadingState({
  colors,
  dense,
  split,
  panelHeight,
}: {
  colors: ThemeColors;
  dense: boolean;
  split: boolean;
  panelHeight: number;
}) {
  const contentSkeleton = (
    <View style={{ flex: 1, minWidth: 0, gap: 12 }}>
      <ShimmerBlock style={{ height: 92, width: "100%", borderRadius: 14 }} />
      <ShimmerBlock style={{ height: 228, width: "100%", borderRadius: 14 }} />
    </View>
  );

  if (dense) {
    return (
      <View
        accessibilityLabel="Carregando planejamento"
        style={{
          minHeight: 590,
          height: panelHeight,
          flexDirection: "row",
          backgroundColor: colors.background,
        }}
      >
        <View
          style={{
            width: "24%",
            minWidth: 252,
            maxWidth: 350,
            padding: 14,
            gap: 10,
            borderRightWidth: 1,
            borderRightColor: colors.border,
          }}
        >
          <ShimmerBlock style={{ height: 24, width: 118, borderRadius: 8 }} />
          {Array.from({ length: 8 }).map((_, index) => (
            <ShimmerBlock
              key={`planning-month-loading-${index}`}
              style={{ height: 44, width: "100%", borderRadius: 10 }}
            />
          ))}
        </View>
        <View style={{ flex: 1, minWidth: 0, padding: 14 }}>
          {contentSkeleton}
        </View>
        <View
          style={{
            width: "27%",
            minWidth: 286,
            maxWidth: 380,
            padding: 14,
            borderLeftWidth: 1,
            borderLeftColor: colors.border,
          }}
        >
          <ShimmerBlock style={{ height: 184, width: "100%", borderRadius: 14 }} />
        </View>
      </View>
    );
  }

  return (
    <View
      accessibilityLabel="Carregando planejamento"
      style={{ gap: 12, paddingVertical: 12 }}
    >
      <ShimmerBlock style={{ height: 82, width: "100%", borderRadius: 14 }} />
      <View style={{ flexDirection: split ? "row" : "column", gap: 12 }}>
        {contentSkeleton}
        {split ? (
          <ShimmerBlock
            style={{ height: 320, width: "38%", minWidth: 270, borderRadius: 14 }}
          />
        ) : null}
      </View>
    </View>
  );
}

export function UnifiedPlanningWorkspace({ colors, classId, initialMonthKey, operationalCycle, archivedCycles, recentSessionSummaries, regenerateMonthSignal, refreshSignal = 0, onMonthChange, onOpenManager, onRegenerateCycle }: Props) {
  const assistant = usePlanningAssistant();
  const { coachName, coachNameByClass } = useWhatsAppSettings();
  const { height } = useWindowDimensions();
  const { containerRef, layout, onLayout, width } = useContainerResponsiveLayout("dashboard");

  const split = layout.supportsSplitView;
  const dense = layout.supportsDenseGrid;
  const contextLayout = useMemo(() => resolveUnifiedPlanningContextLayout(width), [width]);
  const [selectedMonthKey, setSelectedMonthKey] = useState(validMonthKey(initialMonthKey) ? String(initialMonthKey) : currentMonthKey());
  const [selectedEvent, setSelectedEvent] = useState<ProfessorAgendaEvent | null>(null);
  const detailReturnFocus = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (selectedEvent || !detailReturnFocus.current) return;
    const targetId = detailReturnFocus.current;
    detailReturnFocus.current = null;
    if (typeof document === "undefined") return;
    const trigger = document.getElementById(targetId);
    if (trigger?.isConnected && !trigger.closest("[inert]") && trigger.getClientRects().length) {
      trigger.focus({ preventScroll: true });
    }
  }, [selectedEvent]);
  const [showLesson, setShowLesson] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const { confirm: confirmDialog } = useConfirmDialog();
  const { showSaveToast } = useSaveToast();
  const monthly = useMonthlyPlans(classId, selectedMonthKey);
  const monthCycle = isMonthWithinPlanningCycle(monthly.activeCycle, selectedMonthKey) ? monthly.activeCycle : null;
  const yearFocus = useRef<{ direction: "previous" | "next"; month: string; trigger: Element | null } | null>(null);
  const returnDirection = useRef<"previous" | "next" | null>(null);
  const loadingWorkspace = monthly.isInitialLoading || (monthly.isLoading && !monthCycle);

  useLayoutEffect(() => {
    const request = yearFocus.current;
    if (!request || loadingWorkspace || request.month !== selectedMonthKey) return;
    if (typeof document === "undefined" || monthly.error) {
      yearFocus.current = null;
      return;
    }
    if (!monthCycle && isMonthWithinPlanningCycle(operationalCycle, selectedMonthKey)) return;
    const frame = requestAnimationFrame(() => {
      if (document.activeElement === request.trigger) return;
      if (document.activeElement !== document.body) {
        yearFocus.current = null;
        return;
      }
      const target = document.getElementById(
        monthCycle ? `periodization-year-${request.direction}` : "periodization-outside-cycle",
      );
      if (target?.getClientRects().length && !target.closest("[inert]")) {
        if (!monthCycle) target.tabIndex = -1;
        target.focus();
        if (document.activeElement === target) {
          if (!monthCycle) returnDirection.current = request.direction;
        }
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [loadingWorkspace, monthCycle, monthly.error, operationalCycle, selectedMonthKey]);
  const canUpdateMonth = Boolean(monthly.selectedClass && monthCycle?.status === "active" && !monthly.error && !isApplying);
  const historyByDate = useMemo(() => {
    const byDate = new Map<string, RecentSessionSummary>();
    const ambiguousDates = new Set<string>();
    for (const summary of recentSessionSummaries ?? []) {
      const date = summary.sessionDate.slice(0, 10);
      if (byDate.has(date)) ambiguousDates.add(date);
      byDate.set(date, summary);
    }
    const seenAgendaDates = new Set<string>();
    for (const event of monthly.agendaEvents) {
      if (seenAgendaDates.has(event.date)) ambiguousDates.add(event.date);
      seenAgendaDates.add(event.date);
    }
    for (const date of ambiguousDates) byDate.delete(date);
    return byDate;
  }, [monthly.agendaEvents, recentSessionSummaries]);
  const reloadMonthly = monthly.reload;
  const lastRefreshSignalRef = useRef(refreshSignal);
  const sessionPlan = useSessionTrainingPlan({
    classGroup: monthly.selectedClass,
    students: monthly.students,
    calendarExceptions: monthly.calendarExceptions,
    recentAttendance: monthly.recentAttendance,
    recentSessionLogs: monthly.recentSessionLogs,
    studentContexts: monthly.studentContexts,
  });
  const setSelection = assistant?.setSelection;
  const setLesson = assistant?.setLesson;
  useEffect(() => {
    setSelection?.({ month: selectedMonthKey, cycleId: monthly.activeCycle?.id, weekId: selectedEvent?.weekId, weekNumber: selectedEvent?.weekNumber, lessonDate: selectedEvent?.date, lessonId: selectedEvent?.dailyPlan?.id });
  }, [setSelection, selectedMonthKey, monthly.activeCycle?.id, selectedEvent]);
  useEffect(() => { setLesson?.(showLesson ? {} : null); return () => setLesson?.(null); }, [showLesson, setLesson]);
  const summaries = useMemo(() => buildMonthPlanningSummaries(monthly.classPlans, monthly.selectedClass, monthly.activeCycle, monthly.calendarExceptions), [monthly.activeCycle, monthly.calendarExceptions, monthly.classPlans, monthly.selectedClass]);
  const selectedCycleYear = String(
    monthly.activeCycle?.year ||
    monthly.activeCycle?.startDate?.slice(0, 4) ||
    new Date().getFullYear()
  );
  const selectedYear = selectedMonthKey.slice(0, 4) || selectedCycleYear;

  const visibleSummaries = useMemo(() => {
    const yearNum = Number.parseInt(selectedYear, 10);
    const byMonth = new Map<string, MonthPlanningSummary>();
    for (const s of summaries) {
      if (s.monthKey.startsWith(`${selectedYear}-`)) {
        byMonth.set(s.monthKey, s);
      }
    }
    const result: MonthPlanningSummary[] = [];
    for (let m = 1; m <= 12; m++) {
      const monthKey = `${selectedYear}-${String(m).padStart(2, "0")}`;
      const existing = byMonth.get(monthKey);
      if (existing) {
        result.push(existing);
      } else {
        const date = new Date(yearNum, m - 1, 1);
        result.push({
          monthKey,
          label: new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date),
          year: yearNum,
          month: m,
          weekCount: 0,
          estimatedLessonCount: 0,
          hasPlans: false,
        });
      }
    }
    return result;
  }, [selectedYear, summaries]);

  const handleChangeYear = useCallback((direction: "previous" | "next", newYear: string) => {
    const monthPart = selectedMonthKey.slice(5, 7) || "01";
    const nextMonthKey = `${newYear}-${monthPart}`;
    returnDirection.current = null;
    if (typeof document !== "undefined" && document.activeElement?.id === `periodization-year-${direction}`) {
      yearFocus.current = { direction, month: nextMonthKey, trigger: document.activeElement };
    }
    setSelectedMonthKey(nextMonthKey);
    onMonthChange?.(nextMonthKey);
  }, [onMonthChange, selectedMonthKey]);

  const monthPresentations = useMemo(() => buildMonthCyclePresentations({ summaries: visibleSummaries, classPlans: monthly.classPlans, selectedClass: monthly.selectedClass, calendarExceptions: monthly.calendarExceptions }), [monthly.calendarExceptions, monthly.classPlans, monthly.selectedClass, visibleSummaries]);
  const currentPresentation = monthPresentations.get(selectedMonthKey);
  const needsRegeneration = monthNeedsRegeneration(monthly.weeklyItems.map((item) => item.plan), monthly.agendaEvents.length > 0);

  const contextualTodayIso = todayIsoKey(selectedYear);
  const contextualCurrentMonthKey = currentMonthKey(selectedYear);

  useEffect(() => {
    onMonthChange?.(selectedMonthKey);
  }, [onMonthChange, selectedMonthKey]);

  useEffect(() => {
    if (lastRefreshSignalRef.current === refreshSignal) return;
    lastRefreshSignalRef.current = refreshSignal;
    void reloadMonthly();
  }, [reloadMonthly, refreshSignal]);

  const eventContext = [classId, selectedMonthKey, contextualTodayIso].join(":");
  const [previousEventContext, setPreviousEventContext] = useState(eventContext);
  const [previousAgendaEvents, setPreviousAgendaEvents] = useState(monthly.agendaEvents);
  if (previousEventContext !== eventContext || previousAgendaEvents !== monthly.agendaEvents) {
    setPreviousEventContext(eventContext);
    setPreviousAgendaEvents(monthly.agendaEvents);
    setSelectedEvent(monthly.agendaEvents.find(event => event.id === selectedEvent?.id) ?? (split
      ? resolveDefaultSelectedAgendaEvent(monthly.agendaEvents, undefined, contextualTodayIso)
      : null));
  }

  const applyMonth = useCallback(async () => {
    if (!monthly.selectedClass || !canUpdateMonth || !monthCycle) return;
    const confirmed = await confirmDialog({ title: `Atualizar ${monthTitle(selectedMonthKey)}?`, message: "As aulas automáticas serão recalculadas a partir da periodização. Planos personalizados e aulas concluídas serão preservados.", confirmLabel: "Atualizar mês", cancelLabel: "Continuar revisando", onConfirm: async () => { } });
    if (!confirmed) return;
    setIsApplying(true);
    try {
      const result = await regenerateMonthPlans({
        classGroup: monthly.selectedClass,
        monthKey: selectedMonthKey,
        classPlans: monthly.classPlans,
        activeCycle: monthCycle,
        activeCycleId: monthCycle.id,
        activeCycleStartDate: monthCycle.startDate,
        activeCycleEndDate: monthCycle.endDate,
        calendarExceptions: monthly.calendarExceptions,
        students: monthly.students,
        recentAttendance: monthly.recentAttendance,
        recentSessionLogs: monthly.recentSessionLogs,
        studentContexts: monthly.studentContexts,
      });
      await monthly.reload();
      showSaveToast(result.status === "outside_cycle" ? { variant: "warning", message: "Este mês está fora do ciclo ativo. Revise os parâmetros do ciclo." } : { variant: "success", message: `${result.weeklyPlanCount} semana${result.weeklyPlanCount === 1 ? "" : "s"} atualizada${result.weeklyPlanCount === 1 ? "" : "s"}.` });
    } catch (error) { showSaveToast({ variant: "error", error }); } finally { setIsApplying(false); }
  }, [canUpdateMonth, confirmDialog, monthCycle, monthly, selectedMonthKey, showSaveToast]);

  useActionSignal(
    regenerateMonthSignal,
    canUpdateMonth,
    () => { void applyMonth(); },
  );

  const selectMonth = useCallback((monthKey: string) => {
    yearFocus.current = null;
    returnDirection.current = null;
    setSelectedMonthKey(monthKey);
  }, []);

  const selectEvent = useCallback((event: ProfessorAgendaEvent) => {
    setSelectedEvent((current) => (current?.id === event.id ? null : event));
  }, []);

  const closeEventDetail = useCallback(() => {
    if (selectedEvent) detailReturnFocus.current = `periodization-lesson-${selectedEvent.id}`;
    setSelectedEvent(null);
  }, [selectedEvent]);

  const openEventPlan = async (event: ProfessorAgendaEvent) => {
    setSelectedEvent(event);
    setShowLesson(true);
    try {
      await sessionPlan.loadOrGenerate(event);
    } catch (error) {
      setShowLesson(false);
      showSaveToast({
        variant: "error",
        message: "Não foi possível abrir o plano completo desta aula.",
        error,
      });
    }
  };

  const panelHeight = Math.max(590, height - 205);

  if (loadingWorkspace) {
    return (
      <ResponsivePage
        variant="dashboard"
        gap={0}
        style={{ paddingHorizontal: layout.gutter }}
      >
        <View
          ref={containerRef}
          onLayout={onLayout}
          style={{
            gap: 0,
            borderTopWidth: layout.usesWorkspaceShell ? 1 : 0,
            borderTopColor: colors.border,
          }}
        >
          <PlanningWorkspaceLoadingState
            colors={colors}
            dense={dense}
            split={split}
            panelHeight={panelHeight}
          />
        </View>
      </ResponsivePage>
    );
  }

  if (monthly.error) {
    return <PlanningGate colors={colors}
      title="Não foi possível carregar a agenda"
      description={`${monthTitle(selectedMonthKey)} · Tente carregar o planejamento novamente.`}
      action={{ label: "Tentar novamente", icon: "refresh", onPress: () => { void reloadMonthly(); } }}
    />;
  }
  if (!monthly.isPeriodizationConfigured) {
    return <PlanningGate colors={colors}
      title="Prepare o ciclo da turma"
      description="Defina o nível, o início, a duração e a carga do ciclo para abrir a agenda."
      action={{ label: "Configurar periodização", icon: "options", onPress: () => onOpenManager() }}
    />;
  }
  if (!monthCycle) {
    const latestArchive = (archivedCycles ?? []).reduce<PlanningCycle | undefined>((latest, cycle) =>
      !latest || cycle.endDate > latest.endDate ? cycle : latest, undefined);
    const historyMonth = latestArchive?.endDate.slice(0, 7);
    const historyAction: PlanningGateAction | undefined = historyMonth && historyMonth !== selectedMonthKey
      ? { label: "Ver último mês do histórico", icon: "archive", onPress: () => selectMonth(historyMonth) }
      : undefined;
    if (operationalCycle) {
      const startMonth = operationalCycle.startDate.slice(0, 7);
      const endMonth = operationalCycle.endDate.slice(0, 7);
      const activeMonth = selectedMonthKey < startMonth ? startMonth : endMonth;
      return <PlanningGate colors={colors}
        focusHeading
        title="Mês fora do ciclo ativo"
        description={`${monthTitle(selectedMonthKey)} · O ciclo ativo vai de ${formatShortDate(operationalCycle.startDate.slice(0, 10))} a ${formatShortDate(operationalCycle.endDate.slice(0, 10))}.`}
        action={activeMonth !== selectedMonthKey ? {
          label: `Ir para ${monthTitle(activeMonth).toLowerCase()}`,
          icon: "calendar",
          onPress: () => {
            const direction = returnDirection.current;
            selectMonth(activeMonth);
            if (direction && typeof document !== "undefined") {
              yearFocus.current = { direction, month: activeMonth, trigger: document.activeElement };
            }
          },
        } : historyAction}
        secondaryAction={activeMonth !== selectedMonthKey ? historyAction : undefined}
      />;
    }
    return <PlanningGate colors={colors}
      title={latestArchive ? "Ciclo encerrado" : "Nenhum ciclo disponível para este mês"}
      description={latestArchive ? "Consulte os planos de aulas no histórico ou prepare o próximo ciclo." : monthTitle(selectedMonthKey)}
      action={{ label: latestArchive ? "Criar próximo ciclo" : "Configurar periodização", icon: "options", onPress: () => onOpenManager(latestArchive ? "create-next" : "manage") }}
      secondaryAction={historyAction}
    />;
  }

  const activePolicy = parsePeriodizationPolicy(monthly.activeCycle?.periodizationPolicyJson);
  const durationMinutes = monthly.selectedClass?.durationMinutes ?? 60;
  const classLevelLabel = monthly.selectedClass?.mvLevel
    ? resolveClassDevelopmentLevelLabel(monthly.selectedClass)
    : "Não definido";
  const objectiveLabel = resolveGoalLabel(monthly.selectedClass?.goal);
  const loadModelLabel = `${LOAD_MODEL_LABELS[activePolicy.loadModel]} · PSE ${activePolicy.intensityMin}–${activePolicy.intensityMax}`;

  const selectedPeriodizationSource: ClassPlanPeriodizationSource | undefined = selectedEvent
    ? {
      weekLabel: `Semana ${selectedEvent.weekNumber}`,
      phaseLabel: currentPresentation?.phase || selectedEvent.plan.phase || "Fase do ciclo",
      focusLabel: selectedEvent.focusLabel || selectedEvent.objective || selectedEvent.title,
      loadLabel: selectedEvent.loadLabel || currentPresentation?.loadRangeLabel || "Carga não informada",
      roleLabel: selectedEvent.roleLabel || "Aula do ciclo",
      monthlyGameSession: selectedEvent.isMonthlyGameSession,
      classLevelLabel,
      objectiveLabel,
      loadModelLabel,
      beforeLabel: `${classLevelLabel} · ${objectiveLabel}`,
      nowLabel: `${currentPresentation?.phase || selectedEvent.plan.phase || "Fase do ciclo"} · ${selectedEvent.focusLabel || selectedEvent.title}`,
      afterLabel: "Edições e relatórios orientarão as próximas aulas; o histórico concluído será preservado.",
    }
    : undefined;
  const monthRail = <MonthRail colors={colors} summaries={visibleSummaries} selectedMonthKey={selectedMonthKey} selectedMonthEvents={monthly.agendaEvents} presentations={monthPresentations} horizontal={!dense} referenceMonthKey={contextualCurrentMonthKey} onSelect={selectMonth} />;
  const detail = monthly.selectedClass ? <LessonDetail colors={colors} event={selectedEvent} history={selectedEvent ? historyByDate.get(selectedEvent.date) : undefined} monthPresentation={currentPresentation} classGroup={monthly.selectedClass} cycle={monthCycle} onClear={closeEventDetail} showClose={!split} onOpen={() => { if (selectedEvent) void openEventPlan(selectedEvent); }} /> : null;
  const isStackedMobile = width < 560;
  const sideMonthSummary = !split && width >= 800;
  const monthContent = (
    <View style={{ gap: 12, flexDirection: sideMonthSummary ? "row" : "column", alignItems: "flex-start" }}>
      <View style={{ flex: sideMonthSummary ? 1 : undefined, width: sideMonthSummary ? undefined : "100%", minWidth: 0, gap: 11 }}>
      {needsRegeneration && monthCycle.status === "active" ? (
        <View style={[cardStyle(colors), { padding: 12, gap: 8, alignItems: "flex-start", backgroundColor: colors.warningBg }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <GoAtletaIcon name="warningCircle" size={16} color={colors.warningText} />
            <Text style={{ flexShrink: 1, color: colors.warningText, fontSize: compactUiMetrics.bodyFontSize, fontWeight: "800" }}>{monthly.agendaEvents.length ? "Aulas automáticas precisam de atualização" : "Agenda do mês ainda sem aulas"}</Text>
          </View>
          <ActionButton colors={colors} label={isApplying ? "Atualizando mês" : "Atualizar mês"} primary disabled={!canUpdateMonth} onPress={() => { void applyMonth(); }} />
        </View>
      ) : null}
      {!split && !sideMonthSummary ? (
        <MonthContextSummary
          colors={colors}
          events={monthly.agendaEvents}
          presentation={currentPresentation}
          compact
          horizontal={contextLayout.horizontalContext}
        />
      ) : null}
      <WeekGroups
        colors={colors}
        events={monthly.agendaEvents}
        historical={monthly.isHistoricalCycle}
        historyByDate={historyByDate}
        selectedEventId={selectedEvent?.id}
        durationMinutes={durationMinutes}
        mobile={isStackedMobile}
        referenceTodayIso={contextualTodayIso}
        onSelect={selectEvent}
        onOpenPlan={(event: ProfessorAgendaEvent) => void openEventPlan(event)}
        renderSelectedDetail={!split ? () => detail : undefined}
      />
      </View>
      {sideMonthSummary ? <View style={{ width: 210 }}><MonthContextSummary colors={colors} events={monthly.agendaEvents} presentation={currentPresentation} compact /></View> : null}
    </View>
  );

  return (
    <PlanningAssistantHost colors={colors} surface="workspace">
    <ResponsivePage
      variant="dashboard"
      gap={0}
      style={{ paddingHorizontal: Math.max(16, layout.gutter) }}
    >
      <View ref={containerRef} onLayout={onLayout} style={{ gap: 0, borderTopWidth: layout.usesWorkspaceShell ? 1 : 0, borderTopColor: colors.border }}>
        {monthly.selectedClass?.pedagogicalProfile && !monthly.isHistoricalCycle ? <ProfilePlanReview key={monthly.selectedClass.id} classGroup={monthly.selectedClass} events={monthly.agendaEvents} students={monthly.students ?? []} calendarExceptions={monthly.calendarExceptions} sessionLogs={monthly.recentSessionLogs} onApplied={() => void reloadMonthly()} /> : null}
        {!dense ? (
          <View style={{ paddingTop: 4, gap: 4, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ color: colors.text, fontSize: compactUiMetrics.bodyFontSize, fontWeight: "600" }}>Ciclo</Text>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Ano anterior (${Number(selectedYear) - 1})`}
                    nativeID="periodization-year-previous"
                    onPress={() => handleChangeYear("previous", String(Number(selectedYear) - 1))}
                    style={({ pressed }) => ({ width: compactUiMetrics.touchTarget, height: compactUiMetrics.touchTarget, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
                  >
                    <GoAtletaIcon name="chevronBack" size={13} color={colors.text} />
                  </Pressable>
                  <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600", minWidth: 34, textAlign: "center" }}>{selectedYear}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Próximo ano (${Number(selectedYear) + 1})`}
                    nativeID="periodization-year-next"
                    onPress={() => handleChangeYear("next", String(Number(selectedYear) + 1))}
                    style={({ pressed }) => ({ width: compactUiMetrics.touchTarget, height: compactUiMetrics.touchTarget, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
                  >
                    <GoAtletaIcon name="chevronForward" size={13} color={colors.text} />
                  </Pressable>
                </View>
              </View>
              {monthly.isHistoricalCycle ? (
                <View style={{ backgroundColor: colors.card, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ color: colors.muted, fontSize: 9, fontWeight: "700" }}>Histórico</Text>
                </View>
              ) : null}
            </View>
            {monthRail}
          </View>
        ) : null}
        {dense ? (
          <View style={{ height: panelHeight, minHeight: 590, flexDirection: "row", backgroundColor: colors.background }}>
            <View style={{ width: "24%", minWidth: 252, maxWidth: 350, padding: 14, gap: 10, borderRightWidth: 1, borderRightColor: colors.border }}>
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ color: colors.text, fontSize: compactUiMetrics.bodyFontSize, fontWeight: "600" }}>Ciclo</Text>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Ano anterior (${Number(selectedYear) - 1})`}
                        nativeID="periodization-year-previous"
                        onPress={() => handleChangeYear("previous", String(Number(selectedYear) - 1))}
                        style={({ pressed }) => ({ width: compactUiMetrics.touchTarget, height: compactUiMetrics.touchTarget, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
                      >
                        <GoAtletaIcon name="chevronBack" size={13} color={colors.text} />
                      </Pressable>
                      <Text style={{ color: colors.text, fontSize: compactUiMetrics.bodyFontSize, fontWeight: "600", minWidth: 34, textAlign: "center" }}>{selectedYear}</Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Próximo ano (${Number(selectedYear) + 1})`}
                        nativeID="periodization-year-next"
                        onPress={() => handleChangeYear("next", String(Number(selectedYear) + 1))}
                        style={({ pressed }) => ({ width: compactUiMetrics.touchTarget, height: compactUiMetrics.touchTarget, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
                      >
                        <GoAtletaIcon name="chevronForward" size={13} color={colors.text} />
                      </Pressable>
                    </View>
                  </View>
                  {monthly.isHistoricalCycle ? (
                    <View style={{ backgroundColor: colors.card, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}>
                      <Text style={{ color: colors.muted, fontSize: 9, fontWeight: "700" }}>Histórico</Text>
                    </View>
                  ) : null}
                </View>
                <PlanningStatusLegend colors={colors} />
              </View>
              {monthRail}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator contentContainerStyle={{ padding: 14 }}>{monthContent}</ScrollView>
            </View>
            <View style={{ width: "27%", minWidth: 286, maxWidth: 380, borderLeftWidth: 1, borderLeftColor: colors.border }}>
              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator>{detail}</ScrollView>
            </View>
          </View>
        ) : split ? (
          <View style={{ height: panelHeight, minHeight: 590, flexDirection: "row", paddingVertical: 12 }}>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator contentContainerStyle={{ paddingRight: 12 }}>{monthContent}</ScrollView>
            <View style={{ width: "38%", minWidth: 270, borderLeftWidth: 1, borderLeftColor: colors.border }}>
              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator >{detail}</ScrollView>
            </View>
          </View>
        ) : <View style={{ gap: 12, paddingVertical: 12 }}>{monthContent}</View>}
        {showLesson && monthly.selectedClass && selectedEvent ? (
          <ClassPlanModalHost
            colors={colors}
            className={monthly.selectedClass.name}
            lessonDate={selectedEvent.date}
            onClose={() => {
              setShowLesson(false);
              sessionPlan.clear();
            }}
          >
            {sessionPlan.plan ? (
            <Suspense
              fallback={(
                <ClassPlanLoadingContent
                  colors={colors}
                  className={monthly.selectedClass.name}
                  lessonDate={selectedEvent.date}
                  onClose={() => {
                    setShowLesson(false);
                    sessionPlan.clear();
                  }}
                />
              )}
            >
              <ClassPlanPreviewModal
                visible
                plan={sessionPlan.plan}
                classGroup={monthly.selectedClass}
                coachName={coachNameByClass[monthly.selectedClass.id] || coachName}
                lessonDate={sessionPlan.lessonDate || selectedEvent.date}
                initialMode="preview"
                presentation="embedded"
                periodizationSource={selectedPeriodizationSource}
                onClose={() => {
                  setShowLesson(false);
                  sessionPlan.clear();
                }}
                onDraftChange={(draft) => setLesson?.({ draft })}
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
            </Suspense>
            ) : null}
          </ClassPlanModalHost>
        ) : null}
      </View>
    </ResponsivePage>
    </PlanningAssistantHost>
  );
}
