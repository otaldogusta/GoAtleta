import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import type { LessonBlock } from "../../core/models";
import type { ThemeColors } from "../../ui/app-theme";
import { useConfirmDialog } from "../../ui/confirm-dialog";
import { GoAtletaIcon, type GoAtletaIconName } from "../../ui/icon-registry";
import { Pressable } from "../../ui/Pressable";
import { useSaveToast } from "../../ui/save-toast";
import { DayLessonPlanModal } from "../planning/components/DayLessonPlanModal";
import { regenerateMonthPlans } from "../planning/application/regenerate-month-plans";
import {
  buildMonthPlanningSummaries,
  type MonthPlanningSummary,
} from "../planning/application/month-planning-summary";
import type { ProfessorAgendaEvent } from "../planning/application/professor-agenda-events";
import { useDailyLessonPlan } from "../planning/hooks/useDailyLessonPlan";
import { useMonthlyPlans } from "../planning/hooks/useMonthlyPlans";

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
const phaseTone = (phase: string, colors: ThemeColors) => {
  const normalized = phase.toLocaleLowerCase("pt-BR");
  if (normalized.includes("explor")) return colors.info;
  if (normalized.includes("fundament")) return "#4ADBC0";
  if (normalized.includes("jogo")) return colors.warning;
  if (normalized.includes("consol")) return "#B784F7";
  return colors.success;
};
const phaseByMonthFallback = (value: string | undefined, fallback: string) => String(value ?? "").trim() || fallback;
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

function LoadSparkline({ color, seed = 0, width = 56, height = 24 }: { color: string; seed?: number; width?: number; height?: number }) {
  const values = useMemo(() => {
    const middle = 9 + (seed % 4);
    return [18, 17, 15, middle + 4, middle + 1, middle - 2, middle, Math.max(3, middle - 5)];
  }, [seed]);
  const path = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = Math.max(2, Math.min(height - 2, value));
    return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
  return (
    <Svg width={width} height={height} accessibilityLabel="Curva de carga">
      <Path d={path} fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function MonthRail({ colors, summaries, selectedMonthKey, classPlans, horizontal, onSelect }: {
  colors: ThemeColors;
  summaries: MonthPlanningSummary[];
  selectedMonthKey: string;
  classPlans: ReturnType<typeof useMonthlyPlans>["classPlans"];
  horizontal: boolean;
  onSelect: (monthKey: string) => void;
}) {
  const phaseByMonth = useMemo(() => {
    const result = new Map<string, string>();
    for (const plan of classPlans) {
      const key = String(plan.startDate ?? "").slice(0, 7);
      if (key && !result.has(key)) result.set(key, plan.phase || "Ciclo");
    }
    let lastPhase = "Ciclo";
    for (const summary of summaries) {
      const phase = phaseByMonthFallback(result.get(summary.monthKey), lastPhase);
      result.set(summary.monthKey, phase);
      lastPhase = phase;
    }
    return result;
  }, [classPlans, summaries]);

  if (horizontal) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
        {summaries.map((summary, index) => {
          const phase = phaseByMonth.get(summary.monthKey) ?? "Ciclo";
          const tone = phaseTone(phase, colors);
          const selected = summary.monthKey === selectedMonthKey;
          return (
            <Pressable key={summary.monthKey} onPress={() => onSelect(summary.monthKey)} style={{
              width: 138,
              padding: 10,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: selected ? tone : colors.border,
              backgroundColor: selected ? colors.secondaryBg : "transparent",
              gap: 3,
            }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tone }} />
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: "900" }}>{MONTH_NAMES[summary.month - 1]}</Text>
              </View>
              <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 10 }}>{phase}</Text>
              <Text style={{ color: colors.muted, fontSize: 9 }}>{summary.weekCount} sem. · {summary.estimatedLessonCount} aulas</Text>
              <LoadSparkline color={tone} seed={index} width={54} height={19} />
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
        {summaries.map((summary, index) => {
          const phase = phaseByMonth.get(summary.monthKey) ?? "Ciclo";
          const tone = phaseTone(phase, colors);
          const selected = summary.monthKey === selectedMonthKey;
          return (
            <Pressable
              key={summary.monthKey}
              accessibilityRole="button"
              accessibilityLabel={`Abrir ${summary.label}`}
              onPress={() => onSelect(summary.monthKey)}
              style={{
                minHeight: 53,
                paddingHorizontal: 9,
                borderRadius: 9,
                borderWidth: 1,
                borderColor: selected ? tone : "transparent",
                backgroundColor: selected ? colors.secondaryBg : "transparent",
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <View style={{ width: 44, flexDirection: "row", alignItems: "center", gap: 9 }}>
                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: tone, borderWidth: 1, borderColor: colors.background }} />
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: selected ? "900" : "700" }}>{MONTH_NAMES[summary.month - 1]}</Text>
              </View>
              <Text numberOfLines={1} style={{ flex: 1, color: colors.muted, fontSize: 9 }}>{phase}</Text>
              <Text style={{ width: 54, color: selected ? colors.text : colors.muted, fontSize: 9 }}>{summary.weekCount ? `${summary.month === 1 ? 1 : Math.max(1, summary.month * 4 - 3)}–${Math.max(summary.month * 4, summary.month * 4 - 3 + summary.weekCount - 1)}` : "—"}</Text>
              <View style={{ width: 54, alignItems: "flex-end" }}><LoadSparkline color={tone} seed={index} width={51} height={20} /></View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function MonthOverview({ colors, monthKey, events, compact = false }: {
  colors: ThemeColors;
  monthKey: string;
  events: ProfessorAgendaEvent[];
  compact?: boolean;
}) {
  const representative = events.find((event) => !event.isMonthlyGameSession) ?? events[0];
  const focus = representative?.focusLabel || "Progressão definida pelo ciclo";
  const load = representative?.loadLabel || "Carga definida pelo ciclo";
  const weekdays = [...new Set(events.map((event) => event.weekdayLabel))].join(" e ");
  return (
    <View style={{ gap: 10 }}>
      <View style={{ gap: 2 }}>
        <Text style={{ color: colors.text, fontSize: compact ? 19 : 20, fontWeight: "900" }}>{monthTitle(monthKey)}</Text>
        <Text style={{ color: colors.muted, fontSize: 10 }}>
          {events.length ? `Semanas ${events[0].weekNumber}–${events.at(-1)?.weekNumber}` : "Mês do ciclo"}{representative?.plan.phase ? ` · ${representative.plan.phase}` : ""}
        </Text>
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

function LessonRow({ colors, event, selected, durationMinutes, mobile, onPress }: {
  colors: ThemeColors;
  event: ProfessorAgendaEvent;
  selected: boolean;
  durationMinutes: number;
  mobile: boolean;
  onPress: () => void;
}) {
  const tone = colors.success;
  if (mobile) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Abrir aula de ${event.dateLabel}`}
        onPress={onPress}
        style={{
          padding: 12,
          borderRadius: selected ? 9 : 0,
          borderWidth: selected ? 1 : 0,
          borderColor: tone,
          gap: 9,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: tone }} />
            <Text style={{ color: colors.text, fontSize: 11, fontWeight: "800" }}>{event.weekdayLabel} · {event.dateLabel.slice(0, 5)}</Text>
          </View>
          <StatusChip colors={colors} event={event} />
        </View>
        <Text style={{ color: colors.text, fontSize: 12, lineHeight: 17, fontWeight: "800" }}>
          S{event.weekNumber} · {event.isMonthlyGameSession ? "Jogo consolidado do mês" : event.title}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <Text style={{ color: colors.muted, fontSize: 10 }}>{durationMinutes} min · {event.roleLabel}</Text>
          <LoadSparkline color={tone} seed={event.weekNumber} width={56} height={18} />
        </View>
      </Pressable>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir aula de ${event.dateLabel}`}
      onPress={onPress}
      style={{
        minHeight: 43,
        paddingHorizontal: 9,
        borderRadius: selected ? 7 : 0,
        borderWidth: selected ? 1 : 0,
        borderColor: tone,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
      }}
    >
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: tone }} />
      <View style={{ width: 92, flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Text style={{ color: colors.text, fontSize: 9, fontWeight: "800" }}>{event.weekdayLabel} · {event.dateLabel.slice(0, 5)}</Text>
        <StatusChip colors={colors} event={event} />
      </View>
      <Text numberOfLines={2} style={{ flex: 1, color: colors.text, fontSize: 10, lineHeight: 13, fontWeight: "700" }}>
        S{event.weekNumber} · {event.isMonthlyGameSession ? "Jogo consolidado do mês" : event.title}
      </Text>
      <Text style={{ width: 47, color: colors.text, fontSize: 9, fontWeight: "700" }}>{durationMinutes} min</Text>
      <View style={{ width: 58, alignItems: "flex-end" }}><LoadSparkline color={tone} seed={event.weekNumber} width={49} height={18} /></View>
      <GoAtletaIcon name="ellipsisVertical" size={14} color={colors.muted} />
    </Pressable>
  );
}

function WeekGroups({ colors, events, selectedEventId, durationMinutes, mobile, onSelect, renderSelectedDetail }: {
  colors: ThemeColors;
  events: ProfessorAgendaEvent[];
  selectedEventId?: string;
  durationMinutes: number;
  mobile: boolean;
  onSelect: (event: ProfessorAgendaEvent) => void;
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
                <LessonRow colors={colors} event={event} selected={selectedEventId === event.id} durationMinutes={durationMinutes} mobile={mobile} onPress={() => onSelect(event)} />
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

function LessonDetail({ colors, event, classTime, onOpen }: { colors: ThemeColors; event: ProfessorAgendaEvent | null; classTime: string; onOpen: () => void }) {
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
          <GoAtletaIcon name="close" size={18} color={colors.text} />
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
      <View style={{ gap: 7 }}><Text style={{ color: colors.text, fontSize: 11, fontWeight: "800" }}>Relação com o ciclo</Text><View style={{ flexDirection: "row", gap: 9, alignItems: "center" }}><LoadSparkline color={colors.success} seed={event.weekNumber} width={54} height={20} /><Text style={{ flex: 1, color: colors.muted, fontSize: 9, lineHeight: 14 }}>{event.isMonthlyGameSession ? `Alinhada ao fechamento da semana ${event.weekNumber}, na fase ${event.plan.phase || "ativa"}.` : `${event.roleLabel}${event.loadLabel ? ` com ${event.loadLabel}` : ""}, dentro da fase ${event.plan.phase || "atual"}.`}</Text></View></View>
      <ActionButton colors={colors} label="Ver aula" icon="view" onPress={onOpen} />
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
  const { width, height } = useWindowDimensions();
  const desktop = width >= 1100;
  const tablet = width >= 720 && width < 1100;
  const mobile = width < 720;
  const [selectedMonthKey, setSelectedMonthKey] = useState(validMonthKey(initialMonthKey) ? String(initialMonthKey) : currentMonthKey());
  const [selectedEvent, setSelectedEvent] = useState<ProfessorAgendaEvent | null>(null);
  const [showLesson, setShowLesson] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const { confirm: confirmDialog } = useConfirmDialog();
  const { showSaveToast } = useSaveToast();
  const monthly = useMonthlyPlans(classId, selectedMonthKey);
  const summaries = useMemo(() => buildMonthPlanningSummaries(monthly.classPlans, monthly.selectedClass, monthly.activeCycle, monthly.calendarExceptions), [monthly.activeCycle, monthly.calendarExceptions, monthly.classPlans, monthly.selectedClass]);
  const visibleSummaries = useMemo(() => {
    const year = selectedMonthKey.slice(0, 4);
    const sameYear = summaries.filter((summary) => summary.monthKey.startsWith(`${year}-`));
    return sameYear.length ? sameYear : summaries;
  }, [selectedMonthKey, summaries]);

  useEffect(() => {
    if (!summaries.length || summaries.some((summary) => summary.monthKey === selectedMonthKey)) return;
    const fallback = summaries.find((summary) => summary.monthKey >= currentMonthKey()) ?? summaries[0];
    if (fallback) setSelectedMonthKey(fallback.monthKey);
  }, [selectedMonthKey, summaries]);
  useEffect(() => {
    if (!monthly.agendaEvents.length) { setSelectedEvent(null); return; }
    setSelectedEvent((current) => monthly.agendaEvents.find((event) => event.id === current?.id) ?? monthly.agendaEvents.find((event) => event.isMonthlyGameSession) ?? monthly.agendaEvents.at(-1) ?? monthly.agendaEvents[0]);
  }, [monthly.agendaEvents]);

  const daily = useDailyLessonPlan(selectedEvent?.plan ?? null, selectedEvent?.session ?? null, {
    className: monthly.selectedClass?.name,
    ageBand: monthly.selectedClass?.ageBand,
    durationMinutes: monthly.selectedClass?.durationMinutes,
    cycleStartDate: monthly.activeCycle?.startDate,
    cycleEndDate: monthly.activeCycle?.endDate,
    classGroup: monthly.selectedClass,
    calendarExceptions: monthly.calendarExceptions,
  });

  const applyMonth = useCallback(async () => {
    if (!monthly.selectedClass || isApplying) return;
    const confirmed = await confirmDialog({ title: `Atualizar ${monthTitle(selectedMonthKey)}?`, message: "As aulas automáticas serão recalculadas a partir da periodização. Planos personalizados e aulas concluídas serão preservados.", confirmLabel: "Atualizar mês", cancelLabel: "Continuar revisando", onConfirm: async () => {} });
    if (!confirmed) return;
    setIsApplying(true);
    try {
      const result = await regenerateMonthPlans({ classGroup: monthly.selectedClass, monthKey: selectedMonthKey, classPlans: monthly.classPlans, activeCycle: monthly.activeCycle, activeCycleId: monthly.activeCycle?.id, activeCycleStartDate: monthly.activeCycle?.startDate, activeCycleEndDate: monthly.activeCycle?.endDate, calendarExceptions: monthly.calendarExceptions, students: monthly.students, recentAttendance: monthly.recentAttendance, recentSessionLogs: monthly.recentSessionLogs });
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
  const selectMonth = (monthKey: string) => { setSelectedMonthKey(monthKey); setSelectedEvent(null); };
  const monthRail = <MonthRail colors={colors} summaries={visibleSummaries} selectedMonthKey={selectedMonthKey} classPlans={monthly.classPlans} horizontal={!desktop} onSelect={selectMonth} />;
  const detail = <LessonDetail colors={colors} event={selectedEvent} classTime={classTime || "Horário da turma"} onOpen={() => setShowLesson(true)} />;
  const monthContent = (
    <View style={{ gap: 11 }}>
      <MonthOverview colors={colors} monthKey={selectedMonthKey} events={monthly.agendaEvents} compact={mobile} />
      <WeekGroups
        colors={colors}
        events={monthly.agendaEvents}
        selectedEventId={selectedEvent?.id}
        durationMinutes={durationMinutes}
        mobile={mobile}
        onSelect={setSelectedEvent}
        renderSelectedDetail={mobile ? () => detail : undefined}
      />
    </View>
  );

  return (
    <View style={{ gap: 0, borderTopWidth: desktop ? 1 : 0, borderTopColor: colors.border }}>
      {!desktop ? <View style={{ paddingVertical: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}><View><Text style={{ color: colors.text, fontSize: 14, fontWeight: "900" }}>Ciclo {monthly.activeCycle?.year ?? selectedMonthKey.slice(0, 4)}</Text><Text style={{ color: colors.muted, fontSize: 10 }}>Trilho anual do ciclo</Text></View>{tablet ? <ActionButton colors={colors} label="Parâmetros" icon="options" onPress={onOpenManager} /> : null}</View>{monthRail}</View> : null}
      {desktop ? (
        <View style={{ height: panelHeight, minHeight: 590, flexDirection: "row", backgroundColor: colors.background }}>
          <View style={{ width: "24%", minWidth: 252, maxWidth: 350, padding: 14, gap: 10, borderRightWidth: 1, borderRightColor: colors.border }}>
            <View style={{ gap: 2 }}><Text style={{ color: colors.text, fontSize: 15, fontWeight: "900" }}>Ciclo {monthly.activeCycle?.year ?? selectedMonthKey.slice(0, 4)}</Text><Text style={{ color: colors.muted, fontSize: 10 }}>Trilho anual do ciclo</Text></View>
            {monthRail}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator contentContainerStyle={{ padding: 14 }}>{monthContent}</ScrollView>
          </View>
          <View style={{ width: "27%", minWidth: 286, maxWidth: 380, borderLeftWidth: 1, borderLeftColor: colors.border }}>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator contentContainerStyle={{ minHeight: "100%" }}>{detail}</ScrollView>
          </View>
        </View>
      ) : tablet ? (
        <View style={{ height: panelHeight, minHeight: 590, flexDirection: "row", paddingVertical: 12 }}>
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator contentContainerStyle={{ paddingRight: 12 }}>{monthContent}</ScrollView>
          <View style={{ width: "38%", minWidth: 270, borderLeftWidth: 1, borderLeftColor: colors.border }}>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator>{detail}</ScrollView>
          </View>
        </View>
      ) : <View style={{ gap: 12, paddingVertical: 12 }}>{monthContent}</View>}
      <View style={{ flexDirection: width >= 640 ? "row" : "column", alignItems: width >= 640 ? "center" : "stretch", justifyContent: "space-between", gap: 10, paddingVertical: 11, paddingHorizontal: desktop ? 16 : 0, borderTopWidth: 1, borderTopColor: colors.border }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 7 }}><GoAtletaIcon name="info" size={16} color={colors.muted} /><Text style={{ color: colors.muted, fontSize: 10 }}>Planos personalizados são preservados · aulas concluídas não serão alteradas</Text></View>
        <ActionButton colors={colors} label={isApplying ? "Atualizando mês..." : `Aplicar ajustes de ${monthTitle(selectedMonthKey).split(" de ")[0].toLocaleLowerCase("pt-BR")}`} primary disabled={isApplying} onPress={() => void applyMonth()} />
      </View>
      <DayLessonPlanModal visible={showLesson} initialPlan={daily.plan} dayLabel={selectedEvent ? `${selectedEvent.weekdayLabel} · ${selectedEvent.dateLabel}` : "Aula"} coachGuidance={selectedEvent?.guidance} onClose={() => setShowLesson(false)} onRegenerate={async () => { await daily.regenerate(); await monthly.reload(); }} onSave={async (payload) => { await daily.save(payload); await monthly.reload(); showSaveToast({ variant: "success", message: "Plano da aula atualizado." }); }} />
    </View>
  );
}
