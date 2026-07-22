import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, Text, useWindowDimensions, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";

import {
  getDemandIndexForModel,
  type PeriodizationModel,
  type SportProfile,
  type VolumeLevel,
} from "../../core/periodization-basics";
import { formatPlannedLoad } from "../../core/periodization-load";
import { radius } from "../../theme/tokens";
import type { ThemeColors } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { Pressable } from "../../ui/Pressable";
import { getSectionCardStyle } from "../../ui/section-styles";

type Segment = { label: string; length: number };

type WeekPlan = {
  week: number;
  title: string;
  focus: string;
  volume: VolumeLevel;
  notes: string[];
  dateRange?: string;
  sessionDatesLabel?: string;
  jumpTarget: string;
  PSETarget: string;
  plannedSessionLoad: number;
  plannedWeeklyLoad: number;
  source: "AUTO" | "MANUAL";
};

type Props = {
  colors: ThemeColors;
  cycleTitle: string;
  weekPlans: WeekPlan[];
  currentWeek: number;
  selectedWeekNumber: number;
  monthSegments: Segment[];
  periodSegments: Segment[];
  blockSegments: Segment[];
  weeklySessions: number;
  periodizationModel: PeriodizationModel;
  sportProfile: SportProfile;
  classTimeLabel: string;
  classSpaceLabel?: string;
  classConfigurationLabel: string;
  showManagerAction?: boolean;
  onSelectedWeekChange: (weekNumber: number) => void;
  onOpenManager: () => void;
  onOpenClassSettings: () => void;
  onEditSelectedWeek: (weekNumber: number) => void;
  onOpenPlanning: () => void;
};

const CELL_WIDTH = 54;
const LABEL_WIDTH = 92;
const MONTH_ROW_HEIGHT = 48;
const PERIOD_ROW_HEIGHT = 60;
const BLOCK_ROW_HEIGHT = 60;
const GRAPH_HEIGHT = 220;
const GRAPH_AXIS_HEIGHT = 28;
const GRAPH_PLOT_TOP = 30;
const GRAPH_PLOT_BOTTOM = 178;
const LOAD_GUIDES = [
  { label: "Alta", y: 48, tone: "danger" },
  { label: "Média", y: 105, tone: "warning" },
  { label: "Baixa", y: 162, tone: "success" },
] as const;
const MONTH_NAMES = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function resolveSegmentLabel(segments: Segment[], weekNumber: number) {
  let cursor = 0;
  for (const segment of segments) {
    cursor += segment.length;
    if (weekNumber <= cursor) return segment.label;
  }
  return segments.at(-1)?.label ?? "Sem bloco";
}

function volumeRatio(volume: VolumeLevel) {
  if (volume === "baixo") return 0.3;
  if (volume === "alto") return 0.82;
  return 0.56;
}

function buildSmoothGraphPath(points: Array<{ x: number; y: number }>) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  const tension = 0.72;
  return points.slice(1).reduce((path, point, index) => {
    const start = points[index];
    const previous = points[index - 1] ?? start;
    const next = points[index + 2] ?? point;
    const controlStartX = start.x + ((point.x - previous.x) / 6) * tension;
    const controlStartY = start.y + ((point.y - previous.y) / 6) * tension;
    const controlEndX = point.x - ((next.x - start.x) / 6) * tension;
    const controlEndY = point.y - ((next.y - start.y) / 6) * tension;

    return `${path} C ${controlStartX} ${controlStartY}, ${controlEndX} ${controlEndY}, ${point.x} ${point.y}`;
  }, `M ${points[0].x} ${points[0].y}`);
}

function capitalize(value: string) {
  if (!value) return value;
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function formatRangeLabel(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  const match = value.match(
    /^(\d{1,2})\/(\d{1,2})(?:\/\d{4})?\s*[-–]\s*(\d{1,2})\/(\d{1,2})(?:\/\d{4})?$/,
  );
  if (!match) return value.replace(/\s+-\s+/g, "–");

  const [, startDay, startMonth, endDay, endMonth] = match;
  const startLabel = MONTH_NAMES[Number(startMonth) - 1] ?? startMonth;
  const endLabel = MONTH_NAMES[Number(endMonth) - 1] ?? endMonth;
  return startMonth === endMonth
    ? `${Number(startDay)}–${Number(endDay)} ${endLabel}`
    : `${Number(startDay)} ${startLabel}–${Number(endDay)} ${endLabel}`;
}

function formatPointDate(value: string | undefined, fallback: string) {
  const range = formatRangeLabel(value, fallback);
  const rangeMatch = range.match(/^(\d+)(?:–\d+)?\s+([A-Za-zÀ-ÿ]+)/);
  if (rangeMatch) return `${rangeMatch[1]} ${rangeMatch[2]}`;
  return range;
}

function formatSessionDate(value: string) {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/\d{4})?$/);
  return match ? `${match[1].padStart(2, "0")}/${match[2].padStart(2, "0")}` : value.trim();
}

function resolveCycleHeading(cycleTitle: string) {
  if (cycleTitle === "Painel do ciclo") return "Ciclo anual";
  if (cycleTitle.toLocaleLowerCase("pt-BR").startsWith("macrociclo")) return cycleTitle;
  return `Macrociclo — ${cycleTitle}`;
}

function SegmentRow({
  segments,
  colors,
  tone,
}: {
  segments: Segment[];
  colors: ThemeColors;
  tone: "month" | "period" | "block";
}) {
  const height =
    tone === "month"
      ? MONTH_ROW_HEIGHT
      : tone === "period"
        ? PERIOD_ROW_HEIGHT
        : BLOCK_ROW_HEIGHT;

  return (
    <View style={{ flexDirection: "row", height }}>
      {segments.map((segment, index) => (
        <View
          key={`${tone}-${segment.label}-${index}`}
          style={{
            width: Math.max(CELL_WIDTH, segment.length * CELL_WIDTH),
            height,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 12,
            backgroundColor:
              tone === "period"
                ? colors.secondaryBg
                : tone === "block"
                  ? colors.card
                  : "transparent",
            borderTopWidth: tone === "month" ? 1 : 0,
            borderBottomWidth: 1,
            borderRightWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              color: colors.text,
              fontSize: tone === "month" ? 12 : 11,
              fontWeight: tone === "month" ? "600" : "700",
            }}
          >
            {segment.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Metric({
  label,
  value,
  colors,
  dotColor,
  last = false,
}: {
  label: string;
  value: string;
  colors: ThemeColors;
  dotColor?: string;
  last?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        minHeight: 44,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
        {dotColor ? (
          <View
            style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dotColor }}
          />
        ) : null}
        <Text
          style={{
            color: colors.text,
            fontSize: 12,
            fontWeight: "700",
            textAlign: "right",
          }}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

function ManagerAction({
  colors,
  onPress,
}: {
  colors: ThemeColors;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Gerenciar periodização"
      onPress={onPress}
      style={{
        minHeight: 44,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        borderRadius: radius.internal,
        backgroundColor: colors.primaryBg,
        paddingHorizontal: 18,
      }}
    >
      <GoAtletaIcon name="options" size={17} color={colors.primaryText} />
      <Text style={{ color: colors.primaryText, fontSize: 13, fontWeight: "700" }}>
        Gerenciar periodização
      </Text>
    </Pressable>
  );
}

export function PeriodizationOverviewWorkspace({
  colors,
  cycleTitle,
  weekPlans,
  currentWeek,
  selectedWeekNumber,
  monthSegments,
  periodSegments,
  blockSegments,
  weeklySessions,
  periodizationModel,
  sportProfile,
  classTimeLabel,
  classSpaceLabel = "Quadra",
  classConfigurationLabel,
  showManagerAction = true,
  onSelectedWeekChange,
  onOpenManager,
  onOpenClassSettings,
  onEditSelectedWeek,
  onOpenPlanning,
}: Props) {
  const { width } = useWindowDimensions();
  const split = width >= 1200;
  const compactHeader = width < 900;
  const timelineScrollRef = useRef<ScrollView | null>(null);
  const animateNextTimelineScrollRef = useRef(false);
  const [interactiveWeekNumber, setInteractiveWeekNumber] = useState(selectedWeekNumber);

  useEffect(() => {
    setInteractiveWeekNumber(selectedWeekNumber);
  }, [selectedWeekNumber]);

  const selectWeek = useCallback(
    (weekNumber: number) => {
      animateNextTimelineScrollRef.current = true;
      setInteractiveWeekNumber(weekNumber);
      onSelectedWeekChange(weekNumber);
    },
    [onSelectedWeekChange],
  );

  const selectedWeek =
    weekPlans.find((week) => week.week === interactiveWeekNumber) ?? weekPlans[0] ?? null;
  const contentWidth = Math.max(720, weekPlans.length * CELL_WIDTH);
  const selectedBlock = resolveSegmentLabel(blockSegments, selectedWeek?.week ?? 1);

  useEffect(() => {
    if (!selectedWeek) return;
    const visibleTimelineWidth = Math.max(
      260,
      width - LABEL_WIDTH - (split ? 430 : 72),
    );
    const selectedX = (selectedWeek.week - 1) * CELL_WIDTH + CELL_WIDTH / 2;
    const targetX = Math.max(0, selectedX - visibleTimelineWidth / 2);
    const animated = animateNextTimelineScrollRef.current;
    animateNextTimelineScrollRef.current = false;
    const timer = setTimeout(() => {
      timelineScrollRef.current?.scrollTo({ x: targetX, animated });
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedWeek, split, width]);

  const graphPoints = useMemo(
    () =>
      weekPlans.map((week, index) => {
        const x = index * CELL_WIDTH + CELL_WIDTH / 2;
        const y =
          GRAPH_PLOT_BOTTOM -
          volumeRatio(week.volume) * (GRAPH_PLOT_BOTTOM - GRAPH_PLOT_TOP);
        return { x, y, week };
      }),
    [weekPlans],
  );
  const smoothGraphPath = useMemo(
    () => buildSmoothGraphPath(graphPoints),
    [graphPoints],
  );

  const nextSessions = useMemo(() => {
    const startWeek = Math.max(currentWeek, selectedWeek?.week ?? currentWeek);
    const sessions = weekPlans
      .filter((week) => week.week >= startWeek)
      .flatMap((week) => {
        const labels = (week.sessionDatesLabel ?? "")
          .split("|")
          .map((item) => item.trim())
          .filter((item) => item && !item.toLocaleLowerCase("pt-BR").startsWith("sem sess"));
        if (labels.length) {
          return labels.map((label) => ({ label: formatSessionDate(label), week }));
        }
        return [
          {
            label: formatRangeLabel(week.dateRange, `Intervalo ${week.week}`),
            week,
          },
        ];
      });
    return sessions.slice(0, 2);
  }, [currentWeek, selectedWeek?.week, weekPlans]);

  if (!selectedWeek) {
    return (
      <View
        style={[
          getSectionCardStyle(colors, "neutral"),
          { gap: 12, alignItems: "flex-start" },
        ]}
      >
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>
          O ciclo ainda não foi gerado
        </Text>
        <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
          Configure a turma e gere o macrociclo para acompanhar períodos, blocos e
          evolução.
        </Text>
        <ManagerAction colors={colors} onPress={onOpenManager} />
      </View>
    );
  }

  const demand = getDemandIndexForModel(
    selectedWeek.volume,
    periodizationModel,
    weeklySessions,
    sportProfile,
  );
  const selectedRange = formatRangeLabel(
    selectedWeek.dateRange,
    `Intervalo ${selectedWeek.week}`,
  );
  const selectedPointDate = formatPointDate(selectedWeek.dateRange, `S${selectedWeek.week}`);
  const selectedGraphPoint = graphPoints.find(({ week }) => week.week === selectedWeek.week);
  const selectedX = (selectedWeek.week - 1) * CELL_WIDTH + CELL_WIDTH / 2;
  const intensityColor =
    selectedWeek.volume === "alto"
      ? colors.dangerText
      : selectedWeek.volume === "baixo"
        ? colors.successText
        : colors.warningText;
  const cycleHeading = resolveCycleHeading(cycleTitle);

  return (
    <View style={{ gap: 12 }}>
      {showManagerAction ? (
        <View style={{ alignItems: split ? "flex-end" : "stretch" }}>
          <ManagerAction colors={colors} onPress={onOpenManager} />
        </View>
      ) : null}

      <View
        style={[
          getSectionCardStyle(colors, "neutral", {
            padding: 0,
            radius: radius.card,
            shadow: false,
          }),
          { width: "100%", maxWidth: "100%", overflow: "hidden" },
        ]}
      >
        <View
          style={{
            padding: 16,
            flexDirection: compactHeader ? "column" : "row",
            alignItems: compactHeader ? "stretch" : "center",
            justifyContent: "space-between",
            gap: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text
                numberOfLines={2}
                style={{ flexShrink: 1, color: colors.text, fontSize: 16, fontWeight: "700" }}
              >
                {cycleHeading}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Editar nome do macrociclo"
                onPress={onOpenManager}
                style={{ width: 30, height: 30, alignItems: "center", justifyContent: "center" }}
              >
                <GoAtletaIcon name="edit" size={15} color={colors.muted} />
              </Pressable>
            </View>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: compactHeader ? "space-between" : "flex-end",
              gap: 16,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>
                {selectedPointDate}
              </Text>
              <View
                style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.successText }}
              />
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {selectedWeek.week === currentWeek ? "Ciclo ativo" : "Selecionado"}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Intervalo anterior"
                disabled={selectedWeek.week <= 1}
                onPress={() => selectWeek(Math.max(1, selectedWeek.week - 1))}
                style={{
                  width: 40,
                  height: 38,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: selectedWeek.week <= 1 ? 0.45 : 1,
                }}
              >
                <GoAtletaIcon name="chevronBack" size={17} color={colors.text} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Voltar ao intervalo atual"
                onPress={() => selectWeek(currentWeek)}
                style={{
                  minWidth: 56,
                  height: 38,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 12,
                }}
              >
                <Text style={{ color: colors.text, fontSize: 12 }}>Hoje</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Próximo intervalo"
                disabled={selectedWeek.week >= weekPlans.length}
                onPress={() => selectWeek(Math.min(weekPlans.length, selectedWeek.week + 1))}
                style={{
                  width: 40,
                  height: 38,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: selectedWeek.week >= weekPlans.length ? 0.45 : 1,
                }}
              >
                <GoAtletaIcon name="chevronForward" size={17} color={colors.text} />
              </Pressable>
            </View>
          </View>
        </View>

        <View
          style={{
            width: "100%",
            maxWidth: "100%",
            flexDirection: split ? "row" : "column",
            alignItems: "stretch",
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              ...(split ? { flex: 1, flexBasis: 0, width: 1 } : { width: "100%" }),
              minWidth: 0,
              maxWidth: "100%",
            }}
          >
            <View style={{ flexDirection: "row", minWidth: 0, overflow: "hidden" }}>
              <View
                style={{
                  width: LABEL_WIDTH,
                  flexShrink: 0,
                  backgroundColor: colors.background,
                  borderRightWidth: 1,
                  borderRightColor: colors.border,
                  zIndex: 2,
                }}
              >
                {[
                  ["Mês", MONTH_ROW_HEIGHT],
                  ["Período", PERIOD_ROW_HEIGHT],
                  ["Bloco", BLOCK_ROW_HEIGHT],
                ].map(([label, height]) => (
                  <View
                    key={String(label)}
                    style={{
                      height: Number(height),
                      justifyContent: "center",
                      paddingHorizontal: 14,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
                      {label}
                    </Text>
                  </View>
                ))}
                <View
                  style={{
                    height: GRAPH_HEIGHT,
                    position: "relative",
                  }}
                >
                  {LOAD_GUIDES.map((guide) => (
                    <Text
                      key={guide.label}
                      style={{
                        position: "absolute",
                        left: 14,
                        right: 8,
                        top: guide.y - 6,
                        color:
                          guide.tone === "danger"
                            ? colors.dangerText
                            : guide.tone === "warning"
                              ? colors.warningText
                              : colors.successText,
                        fontSize: 9,
                        lineHeight: 12,
                      }}
                    >
                      {guide.label}
                    </Text>
                  ))}
                </View>
                <View style={{ height: GRAPH_AXIS_HEIGHT }} />
              </View>

              <ScrollView
                ref={timelineScrollRef}
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator
                contentContainerStyle={{ width: contentWidth }}
                style={{ flex: 1, minWidth: 0, maxWidth: "100%" }}
              >
                <View style={{ width: contentWidth, position: "relative" }}>
                  <SegmentRow segments={monthSegments} colors={colors} tone="month" />
                  <SegmentRow segments={periodSegments} colors={colors} tone="period" />
                  <SegmentRow segments={blockSegments} colors={colors} tone="block" />

                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      left: selectedX,
                      top: MONTH_ROW_HEIGHT,
                      bottom: GRAPH_AXIS_HEIGHT,
                      borderLeftWidth: 1,
                      borderLeftColor: colors.successText,
                      borderStyle: "dashed",
                      zIndex: 3,
                    }}
                  />

                  <View style={{ width: contentWidth, height: GRAPH_HEIGHT }}>
                    <Svg width={contentWidth} height={GRAPH_HEIGHT} accessibilityLabel="Evolução do bloco">
                      {LOAD_GUIDES.map((guide) => (
                        <Line
                          key={guide.label}
                          x1={0}
                          x2={contentWidth}
                          y1={guide.y}
                          y2={guide.y}
                          stroke={
                            guide.tone === "danger"
                              ? colors.dangerText
                              : guide.tone === "warning"
                                ? colors.warningText
                                : colors.successText
                          }
                          strokeWidth={1}
                          strokeDasharray="5 5"
                          opacity={0.42}
                        />
                      ))}
                      <Path
                        d={smoothGraphPath}
                        fill="none"
                        stroke={colors.warningText}
                        strokeWidth={1.75}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        opacity={0.92}
                      />
                      {graphPoints.map(({ x, y, week }) => {
                        const active = week.week === selectedWeek.week;
                        const today = week.week === currentWeek;
                        return (
                          <Circle
                            key={week.week}
                            cx={x}
                            cy={y}
                            r={active ? 7 : today ? 5 : 4}
                            fill={active ? colors.primaryBg : colors.warningText}
                            stroke={active || today ? colors.successText : colors.warningText}
                            strokeWidth={active ? 2.5 : 1.25}
                            opacity={active ? 1 : 0.9}
                          />
                        );
                      })}
                    </Svg>

                    {selectedGraphPoint ? (
                      <View
                        pointerEvents="none"
                        style={{
                          position: "absolute",
                          left: Math.max(4, Math.min(contentWidth - 154, selectedGraphPoint.x - 75)),
                          top: Math.max(4, selectedGraphPoint.y - 48),
                          minWidth: 150,
                          borderRadius: 9,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: colors.background,
                          paddingHorizontal: 10,
                          paddingVertical: 7,
                          alignItems: "center",
                        }}
                      >
                        <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
                          {`${selectedRange} · ${formatPlannedLoad(selectedWeek.plannedWeeklyLoad)}`}
                        </Text>
                      </View>
                    ) : null}

                    <View
                      pointerEvents="box-none"
                      style={{ position: "absolute", left: 0, right: 0, top: 0, height: GRAPH_HEIGHT }}
                    >
                      {graphPoints.map(({ x, y, week }) => (
                        <Pressable
                          key={`week-point-${week.week}`}
                          accessibilityRole="button"
                          accessibilityLabel={`Selecionar ponto ${week.dateRange || week.week}`}
                          onPress={() => selectWeek(week.week)}
                          style={{
                            position: "absolute",
                            left: x - 16,
                            top: y - 16,
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                          }}
                        />
                      ))}
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", height: GRAPH_AXIS_HEIGHT }}>
                    {monthSegments.map((segment, index) => (
                      <View
                        key={`axis-${segment.label}-${index}`}
                        style={{
                          width: Math.max(CELL_WIDTH, segment.length * CELL_WIDTH),
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ color: colors.muted, fontSize: 10 }}>{segment.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>

          <View
            style={{
              width: split ? 290 : undefined,
              alignSelf: "stretch",
              flexShrink: 0,
              padding: 16,
              borderTopWidth: split ? 0 : 1,
              borderTopColor: colors.border,
              borderLeftWidth: split ? 1 : 0,
              borderLeftColor: colors.border,
              gap: 8,
            }}
          >
            <View style={{ gap: 5, paddingBottom: 6 }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>
                {selectedRange}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <View
                  style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.successText }}
                />
                <Text style={{ color: colors.successText, fontSize: 11 }}>
                  {selectedWeek.week === currentWeek ? "Selecionado" : "Intervalo selecionado"}
                </Text>
              </View>
            </View>
            <Metric label="Sessões" value={`${weeklySessions}`} colors={colors} />
            <Metric
              label="Volume"
              value={formatPlannedLoad(selectedWeek.plannedWeeklyLoad)}
              colors={colors}
            />
            <Metric
              label="Intensidade"
              value={capitalize(selectedWeek.volume)}
              colors={colors}
              dotColor={intensityColor}
            />
            <Metric label="Demanda" value={`${demand}/10`} colors={colors} />
            <Metric label="PSE alvo" value={selectedWeek.PSETarget} colors={colors} last />
            <View style={{ gap: 4, paddingTop: 8 }}>
              <Text style={{ color: colors.muted, fontSize: 11 }}>Foco do bloco</Text>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
                {selectedBlock}
              </Text>
              <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 11, lineHeight: 16 }}>
                {selectedWeek.focus || selectedWeek.title}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Editar intervalo ${selectedWeek.week}`}
              onPress={() => onEditSelectedWeek(selectedWeek.week)}
              style={{ alignSelf: "flex-start", minHeight: 36, justifyContent: "center", marginTop: 2 }}
            >
              <Text style={{ color: colors.infoText, fontSize: 12, fontWeight: "600" }}>
                Editar intervalo
              </Text>
            </Pressable>
            <Text style={{ color: colors.muted, fontSize: 10, lineHeight: 15 }}>
              Selecione outro ponto do gráfico para atualizar os dados.
            </Text>
          </View>
        </View>
      </View>

      <View style={{ flexDirection: split ? "row" : "column", gap: 12 }}>
        <View
          style={[
            getSectionCardStyle(colors, "neutral", { shadow: false }),
            {
              flex: 3,
              minWidth: 0,
              flexDirection: split ? "row" : "column",
              alignItems: split ? "center" : "stretch",
              justifyContent: "space-between",
              gap: 14,
            },
          ]}
        >
          <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View
                style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.successText }}
              />
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {selectedWeek.week === currentWeek ? "Hoje" : selectedRange}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>·</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{classTimeLabel}</Text>
            </View>
            <Text numberOfLines={2} style={{ color: colors.text, fontSize: 19, fontWeight: "700" }}>
              {selectedWeek.title || selectedBlock}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{classSpaceLabel}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {formatPlannedLoad(selectedWeek.plannedSessionLoad)} por sessão
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {`PSE ${selectedWeek.PSETarget}`}
              </Text>
            </View>
            <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>
              {`Objetivo: ${selectedWeek.focus || selectedBlock}`}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onOpenPlanning}
            style={{
              alignSelf: split ? "center" : "stretch",
              minHeight: 42,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.borderStrong ?? colors.border,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 18,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>
              Abrir planejamento
            </Text>
          </Pressable>
        </View>

        <View
          style={[
            getSectionCardStyle(colors, "neutral", { shadow: false }),
            { flex: 2, minWidth: 0, gap: 4 },
          ]}
        >
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700", marginBottom: 3 }}>
            Próximas sessões
          </Text>
          {nextSessions.map(({ label, week }, index) => (
            <Pressable
              key={`next-session-${week.week}-${label}-${index}`}
              accessibilityRole="button"
              onPress={() => selectWeek(week.week)}
              style={{
                minHeight: 46,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                borderTopWidth: index > 0 ? 1 : 0,
                borderTopColor: colors.border,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.secondaryBg,
                }}
              >
                <GoAtletaIcon name="calendar" size={15} color={colors.muted} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>
                  {`${label} · ${classTimeLabel}`}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 10 }}>Treino</Text>
              </View>
              <GoAtletaIcon name="chevronRight" size={15} color={colors.muted} />
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onOpenClassSettings}
        style={[
          getSectionCardStyle(colors, "neutral", { shadow: false }),
          {
            minHeight: 68,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingVertical: 12,
          },
        ]}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <GoAtletaIcon name="management" size={17} color={colors.muted} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
            Configuração da turma
          </Text>
          <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11 }}>
            {classConfigurationLabel}
          </Text>
        </View>
        <GoAtletaIcon name="chevronDown" size={17} color={colors.muted} />
      </Pressable>
    </View>
  );
}
