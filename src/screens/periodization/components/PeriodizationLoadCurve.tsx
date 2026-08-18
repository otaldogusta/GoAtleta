import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Line, Path, Stop } from "react-native-svg";

import type { VolumeLevel } from "../../../core/periodization-basics";
import {
  normalizePeriodizationPolicy,
  resolvePeriodizationWeekPolicy,
  type PeriodizationLoadCurveModel,
} from "../../../core/periodization-policy";
import type { ThemeColors } from "../../../ui/app-theme";

export type PeriodizationGraphWeek = {
  week: number;
  volume: VolumeLevel;
  plannedSessionLoad: number;
};

export type PeriodizationLoadCurveDraft = {
  cycleLengthWeeks: number;
  loadModel: PeriodizationLoadCurveModel;
  recoveryWeeks: number;
  intensityMin: number;
  intensityMax: number;
};

function loadRatio(volume: VolumeLevel) {
  if (volume === "alto") return 0.82;
  if (volume === "baixo") return 0.32;
  return 0.58;
}

function cycleEnvelope(
  progress: number,
  peakAt: number,
  start: number,
  peak: number,
  end: number,
) {
  const clamped = Math.min(1, Math.max(0, progress));
  if (clamped <= peakAt) {
    const ratio = clamped / Math.max(peakAt, 0.01);
    const eased = (1 - Math.cos(Math.PI * ratio)) / 2;
    return start + (peak - start) * eased;
  }

  const ratio = (clamped - peakAt) / Math.max(1 - peakAt, 0.01);
  const eased = (1 - Math.cos(Math.PI * ratio)) / 2;
  return peak + (end - peak) * eased;
}

function smoothPath(points: { x: number; y: number }[]) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  return points.slice(1).reduce((path, point, index) => {
    const start = points[index];
    const previous = points[index - 1] ?? start;
    const next = points[index + 2] ?? point;
    const controlStartX = start.x + (point.x - previous.x) * 0.12;
    const controlStartY = start.y + (point.y - previous.y) * 0.12;
    const controlEndX = point.x - (next.x - start.x) * 0.12;
    const controlEndY = point.y - (next.y - start.y) * 0.12;
    return `${path} C ${controlStartX} ${controlStartY}, ${controlEndX} ${controlEndY}, ${point.x} ${point.y}`;
  }, `M ${points[0].x} ${points[0].y}`);
}

export function PeriodizationLoadCurve({
  colors,
  weekPlans,
  currentWeek,
  draft,
  compact = false,
}: {
  colors: ThemeColors;
  weekPlans: PeriodizationGraphWeek[];
  currentWeek: number;
  draft?: PeriodizationLoadCurveDraft;
  compact?: boolean;
}) {
  const previewDraft = draft ?? {
    cycleLengthWeeks: 52,
    loadModel: "ondulatorio" as const,
    recoveryWeeks: 4,
    intensityMin: 3,
    intensityMax: 6,
  };
  const [width, setWidth] = useState(520);
  const height = compact ? 104 : 205;
  const plotLeft = compact ? 10 : 24;
  const plotRight = Math.max(plotLeft + 1, width - 12);
  const plotTop = compact ? 13 : 24;
  const plotBottom = compact ? 73 : 156;
  const source = useMemo(() => {
    if (weekPlans.length) return weekPlans;
    return Array.from({ length: Math.max(1, previewDraft.cycleLengthWeeks) }, (_, index) => ({
      week: index + 1,
      volume:
        index % 4 === 3
          ? ("baixo" as const)
          : index > 27 && index < 40
            ? ("alto" as const)
            : ("médio" as const),
      plannedSessionLoad: 300 + Math.sin(index / 5) * 110 + index * 5,
    }));
  }, [previewDraft.cycleLengthWeeks, weekPlans]);
  const maxWeek = Math.max(1, previewDraft.cycleLengthWeeks || source.at(-1)?.week || 52);
  const maxLoad = Math.max(1, ...source.map((item) => item.plannedSessionLoad || 1));
  const policy = normalizePeriodizationPolicy(previewDraft);
  const xForWeek = (week: number) =>
    plotLeft + ((week - 1) / Math.max(1, maxWeek - 1)) * (plotRight - plotLeft);
  const points = source.map((item, index) => {
    const progress = index / Math.max(1, source.length - 1);
    const load = (item.plannedSessionLoad || maxLoad * loadRatio(item.volume)) / maxLoad;
    const weekPolicy = resolvePeriodizationWeekPolicy({
      policy,
      weekNumber: item.week,
      cycleLength: maxWeek,
    });
    const policyIntensity = weekPolicy.intensity / 10;
    const loadAdjustment = (load - 0.5) * 0.06;
    const technique = Math.min(
      0.94,
      Math.max(0.08, cycleEnvelope(progress, 0.68, 0.12, 0.9, 0.38) + loadAdjustment * 0.45),
    );
    const intensity = Math.min(
      0.88,
      Math.max(0.06, policyIntensity * 0.82 + cycleEnvelope(progress, 0.12, 0.02, 0.15, 0.04) + loadAdjustment),
    );
    const recovery = Math.min(
      0.72,
      Math.max(0.04, cycleEnvelope(progress, 0.65, 0.05, 0.58, 0.16) + (weekPolicy.recoveryWeek ? 0.16 : 0) + (item.volume === "baixo" ? 0.035 : 0)),
    );
    return {
      x: xForWeek(item.week),
      techniqueY: plotBottom - technique * (plotBottom - plotTop),
      intensityY: plotBottom - intensity * (plotBottom - plotTop),
      recoveryY: plotBottom - recovery * (plotBottom - plotTop),
    };
  });
  const techniquePath = smoothPath(points.map((point) => ({ x: point.x, y: point.techniqueY })));
  const intensityPath = smoothPath(points.map((point) => ({ x: point.x, y: point.intensityY })));
  const recoveryPath = smoothPath(points.map((point) => ({ x: point.x, y: point.recoveryY })));
  const toAreaPath = (path: string) => points.length
    ? `${path} L ${points.at(-1)?.x ?? plotRight} ${plotBottom} L ${points[0].x} ${plotBottom} Z`
    : "";
  const todayX = xForWeek(Math.min(maxWeek, Math.max(1, currentWeek)));
  const axisWeeks = [...new Set([1, Math.round(maxWeek * 0.25), Math.round(maxWeek * 0.5), Math.round(maxWeek * 0.75), maxWeek])];

  return (
    <View
      onLayout={compact ? undefined : (event) => setWidth(Math.max(280, Math.round(event.nativeEvent.layout.width)))}
      style={{ width: compact ? 520 : "100%", gap: compact ? 5 : 9 }}
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: compact ? 10 : 14 }}>
        {[
          ["#43D889", "Técnica"],
          ["#F3B84B", "Intensidade"],
          ["#62A9FF", "Recuperação"],
        ].map(([color, label]) => (
          <View key={label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: compact ? 12 : 18, height: compact ? 2 : 3, borderRadius: 2, backgroundColor: color }} />
            <Text style={{ color: colors.muted, fontSize: compact ? 8 : 10 }}>{label}</Text>
          </View>
        ))}
      </View>
      {!compact ? (
        <View style={{ flexDirection: "row", paddingLeft: plotLeft, paddingRight: 12 }}>
          {["Exploração", "Fundamentos", "Jogos reduzidos", "Consolidação"].map((label) => (
            <Text key={label} numberOfLines={1} style={{ flex: 1, color: colors.muted, fontSize: 9, textAlign: "center" }}>{label}</Text>
          ))}
        </View>
      ) : null}
      <Svg width={width} height={height} accessibilityLabel={`Curva do ciclo, semana atual ${currentWeek}`}>
        <Defs>
          <LinearGradient id="techniqueArea" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#43D889" stopOpacity={0.28} /><Stop offset="1" stopColor="#43D889" stopOpacity={0.02} /></LinearGradient>
          <LinearGradient id="intensityArea" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#F3B84B" stopOpacity={0.24} /><Stop offset="1" stopColor="#F3B84B" stopOpacity={0.02} /></LinearGradient>
          <LinearGradient id="recoveryArea" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#62A9FF" stopOpacity={0.26} /><Stop offset="1" stopColor="#62A9FF" stopOpacity={0.02} /></LinearGradient>
        </Defs>
        {[0, 0.5, 1].map((ratio) => {
          const y = plotTop + ratio * (plotBottom - plotTop);
          return <Line key={ratio} x1={plotLeft} x2={plotRight} y1={y} y2={y} stroke={colors.border} strokeWidth={1} />;
        })}
        <Line x1={todayX} x2={todayX} y1={plotTop - 7} y2={plotBottom + 12} stroke={colors.successText} strokeWidth={1.5} />
        <Path d={toAreaPath(techniquePath)} fill="url(#techniqueArea)" stroke="none" />
        <Path d={toAreaPath(intensityPath)} fill="url(#intensityArea)" stroke="none" />
        <Path d={toAreaPath(recoveryPath)} fill="url(#recoveryArea)" stroke="none" />
        <Path d={techniquePath} fill="none" stroke="#43D889" strokeWidth={compact ? 2 : 2.5} />
        <Path d={intensityPath} fill="none" stroke="#F3B84B" strokeWidth={compact ? 2 : 2.5} />
        <Path d={recoveryPath} fill="none" stroke="#62A9FF" strokeWidth={compact ? 2 : 2.5} />
      </Svg>
      <View style={{ marginTop: compact ? -30 : -43, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: plotLeft }}>
        {axisWeeks.map((week) => <Text key={week} style={{ color: colors.muted, fontSize: compact ? 8 : 10 }}>{week}</Text>)}
      </View>
      {!compact ? <Text style={{ color: colors.successText, fontSize: 10 }}>Hoje · semana {Math.min(maxWeek, Math.max(1, currentWeek))}</Text> : null}
    </View>
  );
}
