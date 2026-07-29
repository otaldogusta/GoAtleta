import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  ScrollView,
  type StyleProp,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type View as ViewType,
  type ViewStyle,
} from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  Line,
  Path,
  Stop,
} from "react-native-svg";

import type { VolumeLevel } from "../../core/periodization-basics";
import type { ThemeColors } from "../../ui/app-theme";
import { AnchoredDropdown } from "../../ui/AnchoredDropdown";
import { AnchoredDropdownOption } from "../../ui/AnchoredDropdownOption";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { ModalSheet } from "../../ui/ModalSheet";
import { Pressable } from "../../ui/Pressable";

function ManagerSelect<T extends string | number>({ value, options, colors, onChange, label }: { value: T; options: readonly { value: T; label: string }[]; colors: ThemeColors; onChange: (value: T) => void; label: string }) {
  const triggerRef = useRef<ViewType | null>(null);
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const activeLabel = options.find((option) => option.value === value)?.label ?? String(value);
  const toggle = () => {
    if (open) return setOpen(false);
    triggerRef.current?.measureInWindow((x, y, width, height) => { setLayout({ x, y, width, height }); setOpen(true); });
  };
  return <>
    <View ref={triggerRef}><Pressable accessibilityRole="button" accessibilityLabel={label} onPress={toggle} style={{ minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.inputBg, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text numberOfLines={1} style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>{activeLabel}</Text><GoAtletaIcon name={open ? "chevronUp" : "chevronDown"} size={15} color={colors.muted} /></Pressable></View>
    <AnchoredDropdown visible={open} layout={layout} container={null} animationStyle={{}} zIndex={9200} maxHeight={180} nestedScrollEnabled portalToBodyOnWeb onRequestClose={() => setOpen(false)} interactiveRefs={[triggerRef]} density="compact">
      {options.map((option) => <AnchoredDropdownOption key={String(option.value)} active={option.value === value} density="compact" onPress={() => { onChange(option.value); setOpen(false); }}><Text style={{ color: option.value === value ? colors.primaryText : colors.text, fontSize: 12, fontWeight: "700" }}>{option.label}</Text></AnchoredDropdownOption>)}
    </AnchoredDropdown>
  </>;
}

export type PeriodizationManagerDraft = {
  goal: string;
  mvLevel: string;
  daysOfWeek: number[];
  startTime: string;
  durationMinutes: number;
  cycleStartDate: string;
  cycleLengthWeeks: number;
  loadModel: "ondulatorio" | "linear" | "blocos";
  recoveryWeeks: number;
  intensityMin: number;
  intensityMax: number;
};

export type PeriodizationManagerSection =
  | "cycle"
  | "agenda"
  | "class"
  | "exceptions";

type GraphWeek = {
  week: number;
  volume: VolumeLevel;
  plannedSessionLoad: number;
};

type Props = {
  visible: boolean;
  colors: ThemeColors;
  className: string;
  classSubtitle: string;
  initialDraft: PeriodizationManagerDraft;
  weekPlans: GraphWeek[];
  autoPlanCount: number;
  manualPlanCount: number;
  completedLessonCount: number;
  currentWeek: number;
  configured: boolean;
  saving: boolean;
  regenerating: boolean;
  error: string;
  advancedContent?: ReactNode;
  onClose: () => void;
  onSave: (draft: PeriodizationManagerDraft) => Promise<boolean>;
  onRegenerateAutomatic: () => void;
  onDuplicate: () => void;
  onResetAutomatic: () => void;
};

function ManagerBody({
  split,
  children,
}: {
  split: boolean;
  children: ReactNode;
}) {
  if (split) {
    return (
      <View
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          flexDirection: "row",
          alignItems: "stretch",
        }}
      >
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      contentContainerStyle={{
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        flexDirection: "column",
        alignItems: "stretch",
      }}
      style={{ flex: 1, minHeight: 0 }}
    >
      {children}
    </ScrollView>
  );
}

function ManagerPane({
  scrollable,
  containerStyle,
  contentStyle,
  children,
}: {
  scrollable: boolean;
  containerStyle: StyleProp<ViewStyle>;
  contentStyle: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  if (scrollable) {
    return (
      <ScrollView
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator
        style={[{ minHeight: 0, minWidth: 0 }, containerStyle]}
        contentContainerStyle={contentStyle}
      >
        {children}
      </ScrollView>
    );
  }

  return <View style={[containerStyle, contentStyle]}>{children}</View>;
}

const DAY_OPTIONS = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
] as const;

const LEVEL_OPTIONS = [
  { value: "MV1", label: "Iniciação" },
  { value: "MV2", label: "Formação" },
  { value: "MV3", label: "Rendimento" },
] as const;

const CYCLE_OPTIONS = [
  { value: 13, label: "Trimestral", detail: "3 meses" },
  { value: 26, label: "Semestral", detail: "6 meses" },
  { value: 39, label: "Nove meses", detail: "9 meses" },
  { value: 52, label: "Anual", detail: "12 meses" },
] as const;
const LOAD_MODEL_OPTIONS = [
  { value: "ondulatorio", label: "Ondulatório" },
  { value: "linear", label: "Linear" },
  { value: "blocos", label: "Blocos" },
] as const;
const RECOVERY_OPTIONS = [3, 4, 5] as const;

function formatBrazilianDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
}

function parseBrazilianDate(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  const formatted = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join("-");
  if (digits.length !== 8) return { display: formatted, iso: "" };
  return { display: formatted, iso: `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}` };
}

function draftsEqual(
  first: PeriodizationManagerDraft,
  second: PeriodizationManagerDraft,
) {
  if (!first || !second) return false;
  return (
    String(first.goal ?? "").trim() === String(second.goal ?? "").trim() &&
    first.mvLevel === second.mvLevel &&
    first.startTime === second.startTime &&
    first.durationMinutes === second.durationMinutes &&
    first.cycleStartDate === second.cycleStartDate &&
    first.cycleLengthWeeks === second.cycleLengthWeeks &&
    first.loadModel === second.loadModel &&
    first.recoveryWeeks === second.recoveryWeeks &&
    first.intensityMin === second.intensityMin &&
    first.intensityMax === second.intensityMax &&
    [...(first.daysOfWeek ?? [])].sort().join(",") ===
      [...(second.daysOfWeek ?? [])].sort().join(",")
  );
}

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

function InputLabel({
  colors,
  children,
}: {
  colors: ThemeColors;
  children: ReactNode;
}) {
  return (
    <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>
      {children}
    </Text>
  );
}

function FieldShell({
  colors,
  children,
  minWidth = 150,
}: {
  colors: ThemeColors;
  children: ReactNode;
  minWidth?: number;
}) {
  return (
    <View
      style={{
        minHeight: 44,
        minWidth,
        flex: 1,
        justifyContent: "center",
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        backgroundColor: colors.inputBg,
        paddingHorizontal: 12,
      }}
    >
      {children}
    </View>
  );
}

function ImpactRow({
  colors,
  icon,
  label,
  value,
}: {
  colors: ThemeColors;
  icon: "calendar" | "trend" | "refresh" | "students" | "checkmarkCircle";
  label: string;
  value: string;
}) {
  return (
    <View
      style={{
        minHeight: 46,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <GoAtletaIcon name={icon} size={17} color={colors.muted} />
      <Text
        style={{
          flex: 1,
          color: colors.text,
          fontSize: 12,
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          maxWidth: "52%",
          color: colors.muted,
          fontSize: 11,
          textAlign: "right",
        }}
      >
        {value}
      </Text>
      <GoAtletaIcon
        name="checkmarkCircle"
        size={16}
        color={colors.successText}
      />
    </View>
  );
}

function LoadPreview({
  colors,
  weekPlans,
  currentWeek,
  draft,
}: {
  colors: ThemeColors;
  weekPlans: GraphWeek[];
  currentWeek: number;
  draft?: PeriodizationManagerDraft;
}) {
  const previewDraft = draft ?? {
    goal: "",
    mvLevel: "",
    daysOfWeek: [],
    startTime: "",
    durationMinutes: 60,
    cycleStartDate: "",
    cycleLengthWeeks: 52,
    loadModel: "ondulatorio" as const,
    recoveryWeeks: 4,
    intensityMin: 3,
    intensityMax: 6,
  };
  const [width, setWidth] = useState(520);
  const height = 205;
  const plotLeft = 24;
  const plotRight = Math.max(plotLeft + 1, width - 12);
  const plotTop = 24;
  const plotBottom = 156;
  const source = useMemo(() => {
    if (weekPlans.length) return weekPlans;
    return Array.from({ length: 52 }, (_, index) => ({
      week: index + 1,
      volume:
        index % 4 === 3
          ? ("baixo" as const)
          : index > 27 && index < 40
            ? ("alto" as const)
            : ("médio" as const),
      plannedSessionLoad: 300 + Math.sin(index / 5) * 110 + index * 5,
    }));
  }, [weekPlans]);
  const maxWeek = Math.max(1, previewDraft.cycleLengthWeeks || source.at(-1)?.week || 52);
  const maxLoad = Math.max(
    1,
    ...source.map((item) => item.plannedSessionLoad || 1),
  );
  const xForWeek = (week: number) =>
    plotLeft + ((week - 1) / Math.max(1, maxWeek - 1)) * (plotRight - plotLeft);
  const points = source.map((item, index) => {
    const progress = index / Math.max(1, source.length - 1);
    const load = (item.plannedSessionLoad || maxLoad * loadRatio(item.volume)) / maxLoad;
    const modelFactor = previewDraft.loadModel === "linear" ? 0.06 : previewDraft.loadModel === "blocos" ? 0.1 : 0;
    const recoveryDip = index % Math.max(1, previewDraft.recoveryWeeks) === previewDraft.recoveryWeeks - 1 ? -0.08 : 0;
    const intensityFactor = ((previewDraft.intensityMax - previewDraft.intensityMin) / 10) * 0.08;
    const loadAdjustment = (load - 0.5) * 0.06 + modelFactor + recoveryDip + intensityFactor;
    const technique = Math.min(
      0.94,
      Math.max(
        0.08,
        cycleEnvelope(progress, 0.68, 0.12, 0.9, 0.38) +
          loadAdjustment * 0.45,
      ),
    );
    const intensity = Math.min(
      0.88,
      Math.max(
        0.06,
        cycleEnvelope(progress, 0.66, 0.08, 0.73, 0.24) +
          loadAdjustment,
      ),
    );
    const recovery = Math.min(
      0.72,
      Math.max(
        0.04,
        cycleEnvelope(progress, 0.65, 0.05, 0.58, 0.16) +
          (item.volume === "baixo" ? 0.035 : 0),
      ),
    );
    return {
      x: xForWeek(item.week),
      techniqueY: plotBottom - technique * (plotBottom - plotTop),
      intensityY: plotBottom - intensity * (plotBottom - plotTop),
      recoveryY: plotBottom - recovery * (plotBottom - plotTop),
    };
  });
  const techniquePath = smoothPath(
    points.map((point) => ({ x: point.x, y: point.techniqueY })),
  );
  const intensityPath = smoothPath(
    points.map((point) => ({ x: point.x, y: point.intensityY })),
  );
  const recoveryPath = smoothPath(
    points.map((point) => ({ x: point.x, y: point.recoveryY })),
  );
  const toAreaPath = (path: string) =>
    points.length
      ? `${path} L ${points.at(-1)?.x ?? plotRight} ${plotBottom} L ${points[0].x} ${plotBottom} Z`
      : "";
  const techniqueAreaPath = toAreaPath(techniquePath);
  const intensityAreaPath = toAreaPath(intensityPath);
  const recoveryAreaPath = toAreaPath(recoveryPath);
  const todayX = xForWeek(Math.min(maxWeek, Math.max(1, currentWeek)));

  return (
    <View
      onLayout={(event) =>
        setWidth(Math.max(280, Math.round(event.nativeEvent.layout.width)))
      }
      style={{ width: "100%", gap: 9 }}
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
        {[
          ["#43D889", "Técnica"],
          ["#F3B84B", "Intensidade"],
          ["#62A9FF", "Recuperação"],
        ].map(([color, label]) => (
          <View
            key={label}
            style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            <View
              style={{
                width: 18,
                height: 3,
                borderRadius: 2,
                backgroundColor: color,
              }}
            />
            <Text style={{ color: colors.muted, fontSize: 10 }}>{label}</Text>
          </View>
        ))}
      </View>
      <View
        style={{
          flexDirection: "row",
          paddingLeft: plotLeft,
          paddingRight: 12,
        }}
      >
        {["Exploração", "Fundamentos", "Jogos reduzidos", "Consolidação"].map(
          (label) => (
            <Text
              key={label}
              numberOfLines={1}
              style={{
                flex: 1,
                color: colors.muted,
                fontSize: 9,
                textAlign: "center",
              }}
            >
              {label}
            </Text>
          ),
        )}
      </View>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="techniqueArea" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#43D889" stopOpacity={0.28} />
            <Stop offset="1" stopColor="#43D889" stopOpacity={0.02} />
          </LinearGradient>
          <LinearGradient id="intensityArea" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#F3B84B" stopOpacity={0.24} />
            <Stop offset="1" stopColor="#F3B84B" stopOpacity={0.02} />
          </LinearGradient>
          <LinearGradient id="recoveryArea" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#62A9FF" stopOpacity={0.26} />
            <Stop offset="1" stopColor="#62A9FF" stopOpacity={0.02} />
          </LinearGradient>
        </Defs>
        {[0, 0.5, 1].map((ratio) => {
          const y = plotTop + ratio * (plotBottom - plotTop);
          return (
            <Line
              key={ratio}
              x1={plotLeft}
              x2={plotRight}
              y1={y}
              y2={y}
              stroke={colors.border}
              strokeWidth={1}
            />
          );
        })}
        <Line
          x1={todayX}
          x2={todayX}
          y1={plotTop - 7}
          y2={plotBottom + 12}
          stroke={colors.successText}
          strokeWidth={1.5}
        />
        <Path d={techniqueAreaPath} fill="url(#techniqueArea)" stroke="none" />
        <Path d={intensityAreaPath} fill="url(#intensityArea)" stroke="none" />
        <Path d={recoveryAreaPath} fill="url(#recoveryArea)" stroke="none" />
        <Path
          d={techniquePath}
          fill="none"
          stroke="#43D889"
          strokeWidth={2.5}
        />
        <Path
          d={intensityPath}
          fill="none"
          stroke="#F3B84B"
          strokeWidth={2.5}
        />
        <Path
          d={recoveryPath}
          fill="none"
          stroke="#62A9FF"
          strokeWidth={2.5}
        />
      </Svg>
      <View
        style={{
          marginTop: -43,
          flexDirection: "row",
          justifyContent: "space-between",
          paddingHorizontal: plotLeft,
        }}
      >
        {[1, 13, 26, 39, maxWeek].map((week) => (
          <Text key={week} style={{ color: colors.muted, fontSize: 10 }}>
            {week}
          </Text>
        ))}
      </View>
      <Text style={{ color: colors.successText, fontSize: 10 }}>
        Hoje · semana {Math.min(maxWeek, Math.max(1, currentWeek))}
      </Text>
    </View>
  );
}

export function PeriodizationManagerSheet({
  visible,
  colors,
  className,
  classSubtitle,
  initialDraft,
  weekPlans,
  autoPlanCount,
  manualPlanCount,
  completedLessonCount,
  currentWeek,
  configured,
  saving,
  regenerating,
  error,
  advancedContent,
  onClose,
  onSave,
  onRegenerateAutomatic,
  onDuplicate,
  onResetAutomatic,
}: Props) {
  const { width, height } = useWindowDimensions();
  const wide = width >= 1200;
  const compact = width < 760;
  const narrow = width < 980;
  const [draft, setDraft] = useState(initialDraft);
  const [savedDraft, setSavedDraft] = useState(initialDraft);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cycleDateInput, setCycleDateInput] = useState(() => formatBrazilianDate(initialDraft.cycleStartDate));
  const dirty = !draftsEqual(draft, savedDraft);
  const dayLabel = DAY_OPTIONS.filter((option) =>
    draft.daysOfWeek.includes(option.value),
  )
    .map((option) => option.label)
    .join(", ");
  const timeEndMinutes =
    Number(draft.startTime.slice(0, 2)) * 60 +
    Number(draft.startTime.slice(3, 5)) +
    draft.durationMinutes;
  const timeEnd = Number.isFinite(timeEndMinutes)
    ? `${String(Math.floor((timeEndMinutes % 1440) / 60)).padStart(2, "0")}:${String(timeEndMinutes % 60).padStart(2, "0")}`
    : "";
  const recommendedRecoveryWeeks = draft.intensityMax >= 8 ? 3 : draft.intensityMax >= 6 ? 4 : 5;

  const handleSave = async () => {
    const saved = await onSave(draft);
    if (saved) setSavedDraft(draft);
  };

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      position="center"
      containerPadding={compact ? 8 : 22}
      backdropOpacity={0.72}
      cardStyle={{
        alignSelf: "center",
        width: "100%",
        maxWidth: 1340,
        height: Math.min(height - (compact ? 16 : 44), 900),
        minWidth: 0,
        borderRadius: compact ? 18 : 22,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        overflow: "hidden",
      }}
    >
      <View style={{ flex: 1, width: "100%", overflow: "hidden" }}>
        <View
          style={{
            minHeight: compact ? 70 : 88,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingHorizontal: compact ? 16 : 28,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <Text
                style={{
                  color: colors.text,
                  fontSize: compact ? 19 : 22,
                  fontWeight: "800",
                }}
              >
                Gerenciar periodização
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  borderWidth: 1,
                  borderColor: configured
                    ? colors.successBorder
                    : colors.warningBorder,
                  borderRadius: 999,
                  paddingHorizontal: 9,
                  paddingVertical: 5,
                }}
              >
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: configured
                      ? colors.successText
                      : colors.warningText,
                  }}
                />
                <Text
                  style={{
                    color: configured
                      ? colors.successText
                      : colors.warningText,
                    fontSize: 11,
                    fontWeight: "700",
                  }}
                >
                  {configured ? "Ciclo ativo" : "Configuração pendente"}
                </Text>
              </View>
            </View>
            <Text
              numberOfLines={1}
              style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}
            >
              {className} · {classSubtitle}
            </Text>
          </View>

          <View style={{ position: "relative" }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mais ações da periodização"
              onPress={() => setMenuOpen((current) => !current)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <GoAtletaIcon
                name="ellipsisVertical"
                size={18}
                color={colors.text}
              />
            </Pressable>
            {menuOpen ? (
              <View
                style={{
                  position: "absolute",
                  top: 46,
                  right: 0,
                  width: 260,
                  zIndex: 40,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  padding: 6,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Redefinir semanas automáticas"
                  onPress={() => {
                    setMenuOpen(false);
                    onResetAutomatic();
                  }}
                  style={{
                    minHeight: 44,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 9,
                    borderRadius: 9,
                    paddingHorizontal: 10,
                  }}
                >
                  <GoAtletaIcon
                    name="trash"
                    size={17}
                    color={colors.dangerText}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.dangerText,
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      Redefinir automáticos
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 10 }}>
                      Preserva planos personalizados
                    </Text>
                  </View>
                </Pressable>
              </View>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar gerenciamento"
            onPress={onClose}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <GoAtletaIcon name="close" size={20} color={colors.text} />
          </Pressable>
        </View>

        <ManagerBody split={wide}>
          <ManagerPane
            scrollable={wide}
            containerStyle={{
              width: wide ? "51%" : "100%",
              maxWidth: "100%",
              minWidth: 0,
              borderRightWidth: wide ? 1 : 0,
              borderRightColor: colors.border,
            }}
            contentStyle={{
              padding: compact ? 16 : 26,
              gap: 22,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
              Parâmetros do ciclo
            </Text>

            <View style={{ gap: 12 }}>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}>
                1. Turma
              </Text>
              <View style={{ flexDirection: narrow ? "column" : "row", gap: 10 }}>
                <View style={{ flex: 1.5, minWidth: 0, gap: 6 }}>
                  <InputLabel colors={colors}>Objetivo pedagógico</InputLabel>
                  <TextInput
                    accessibilityLabel="Objetivo pedagógico"
                    value={draft.goal}
                    onChangeText={(goal) =>
                      setDraft((current) => ({ ...current, goal }))
                    }
                    placeholder="Desenvolvimento motor e fundamentos"
                    placeholderTextColor={colors.placeholder}
                    style={{
                      minHeight: 44,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 10,
                      backgroundColor: colors.inputBg,
                      color: colors.inputText,
                      paddingHorizontal: 12,
                      fontSize: 12,
                    }}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                  <InputLabel colors={colors}>Nível de desenvolvimento</InputLabel>
                  <ManagerSelect label="Nível de desenvolvimento" value={draft.mvLevel} options={LEVEL_OPTIONS} colors={colors} onChange={(mvLevel) => setDraft((current) => ({ ...current, mvLevel }))} />
                </View>
              </View>
              <Text style={{ color: colors.muted, fontSize: 10 }}>
                Idade e número de atletas vêm do cadastro da turma.
              </Text>
            </View>

            <View style={{ height: 1, backgroundColor: colors.border }} />

            <View style={{ gap: 12 }}>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}>
                2. Agenda
              </Text>
              <View style={{ gap: 6 }}>
                <InputLabel colors={colors}>Dias da semana</InputLabel>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {DAY_OPTIONS.map((option) => {
                    const active = draft.daysOfWeek.includes(option.value);
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() =>
                          setDraft((current) => ({
                            ...current,
                            daysOfWeek: active
                              ? current.daysOfWeek.filter(
                                  (day) => day !== option.value,
                                )
                              : [...current.daysOfWeek, option.value].sort(),
                          }))
                        }
                        style={{
                          minWidth: 48,
                          minHeight: 36,
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: 9,
                          borderWidth: 1,
                          borderColor: active
                            ? colors.successBorder
                            : colors.border,
                          backgroundColor: active
                            ? colors.successBg
                            : colors.inputBg,
                        }}
                      >
                        <Text
                          style={{
                            color: active ? colors.successText : colors.text,
                            fontSize: 11,
                            fontWeight: "700",
                          }}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <View style={{ flexDirection: narrow ? "column" : "row", gap: 10 }}>
                <View style={{ flex: 1, gap: 6 }}>
                  <InputLabel colors={colors}>Horário de início</InputLabel>
                  <TextInput
                    accessibilityLabel="Horário de início"
                    value={draft.startTime}
                    onChangeText={(startTime) =>
                      setDraft((current) => ({ ...current, startTime }))
                    }
                    placeholder="18:00"
                    placeholderTextColor={colors.placeholder}
                    style={{
                      minHeight: 44,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 10,
                      backgroundColor: colors.inputBg,
                      color: colors.inputText,
                      paddingHorizontal: 12,
                      fontSize: 12,
                    }}
                  />
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <InputLabel colors={colors}>Duração (min)</InputLabel>
                  <TextInput
                    accessibilityLabel="Duração em minutos"
                    value={String(draft.durationMinutes)}
                    keyboardType="number-pad"
                    onChangeText={(value) =>
                      setDraft((current) => ({
                        ...current,
                        durationMinutes: Number(value.replace(/\D/g, "")) || 0,
                      }))
                    }
                    style={{
                      minHeight: 44,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 10,
                      backgroundColor: colors.inputBg,
                      color: colors.inputText,
                      paddingHorizontal: 12,
                      fontSize: 12,
                    }}
                  />
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <InputLabel colors={colors}>Resumo</InputLabel>
                  <FieldShell colors={colors}>
                    <Text style={{ color: colors.text, fontSize: 11 }}>
                      {dayLabel || "Nenhum dia"} · {draft.startTime || "--:--"}
                      {timeEnd ? `–${timeEnd}` : ""}
                    </Text>
                  </FieldShell>
                </View>
              </View>
              <View style={{ flexDirection: narrow ? "column" : "row", gap: 10 }}>
                <View style={{ flex: 1, gap: 6 }}>
                  <InputLabel colors={colors}>Data de início</InputLabel>
                  <TextInput
                    accessibilityLabel="Data de início do ciclo"
                    value={cycleDateInput}
                    onChangeText={(value) => {
                      const parsed = parseBrazilianDate(value);
                      setCycleDateInput(parsed.display);
                      if (parsed.iso) setDraft((current) => ({ ...current, cycleStartDate: parsed.iso }));
                    }}
                    placeholder="DD-MM-AAAA"
                    placeholderTextColor={colors.placeholder}
                    style={{
                      minHeight: 44,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 10,
                      backgroundColor: colors.inputBg,
                      color: colors.inputText,
                      paddingHorizontal: 12,
                      fontSize: 12,
                    }}
                  />
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <InputLabel colors={colors}>Duração do ciclo</InputLabel>
                  <ManagerSelect label="Duração do ciclo" value={draft.cycleLengthWeeks} options={CYCLE_OPTIONS.map((option) => ({ value: option.value, label: `${option.label} · ${option.detail}` }))} colors={colors} onChange={(cycleLengthWeeks) => setDraft((current) => ({ ...current, cycleLengthWeeks }))} />
                </View>
              </View>
            </View>

            <View style={{ height: 1, backgroundColor: colors.border }} />

            <View style={{ gap: 12 }}>
              <View>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}>
                  3. Modelo de carga
                </Text>
                <Text style={{ color: colors.muted, fontSize: 10, marginTop: 3 }}>
                  Parâmetros calculados a partir do nível, da agenda e das semanas.
                </Text>
              </View>
              <View style={{ gap: 12 }}>
                <View style={{ gap: 6 }}>
                  <InputLabel colors={colors}>Modelo de carga</InputLabel>
                  <ManagerSelect label="Modelo de carga" value={draft.loadModel} options={LOAD_MODEL_OPTIONS} colors={colors} onChange={(loadModel) => setDraft((current) => ({ ...current, loadModel }))} />
                </View>
                <View style={{ gap: 6 }}>
                  <InputLabel colors={colors}>Recuperação planejada</InputLabel>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {RECOVERY_OPTIONS.map((weeks) => { const active = draft.recoveryWeeks === weeks; return <Pressable key={weeks} accessibilityRole="button" accessibilityLabel={`Recuperação a cada ${weeks} semanas`} onPress={() => setDraft((current) => ({ ...current, recoveryWeeks: weeks }))} style={{ minHeight: 36, justifyContent: "center", borderRadius: 9, borderWidth: 1, borderColor: active ? colors.successBorder : colors.border, backgroundColor: active ? colors.successBg : colors.inputBg, paddingHorizontal: 10 }}><Text style={{ color: active ? colors.successText : colors.text, fontSize: 11, fontWeight: "700" }}>A cada {weeks} semanas</Text></Pressable>; })}
                  </View>
                  <View style={{ borderWidth: 1, borderColor: colors.successBorder, backgroundColor: colors.successBg, borderRadius: 10, padding: 10, gap: 3 }}><Text style={{ color: colors.successText, fontSize: 10, fontWeight: "800" }}>Recuperação sugerida: a cada {recommendedRecoveryWeeks} semanas</Text><Text style={{ color: colors.muted, fontSize: 10 }}>Com PSE máximo {draft.intensityMax}, a prévia recomenda este intervalo. Se a carga registrada subir, antecipe a semana de recuperação.</Text></View>
                </View>
                <View style={{ flexDirection: narrow ? "column" : "row", gap: 10 }}>
                  {(["intensityMin", "intensityMax"] as const).map((field) => (
                    <View key={field} style={{ flex: 1, gap: 6 }}>
                      <InputLabel colors={colors}>{field === "intensityMin" ? "PSE mínimo" : "PSE máximo"}</InputLabel>
                      <TextInput accessibilityLabel={field === "intensityMin" ? "PSE mínimo" : "PSE máximo"} keyboardType="numeric" value={String(draft[field])} onChangeText={(value) => setDraft((current) => { const next = Math.max(0, Math.min(10, Number(value.replace(/[^0-9]/g, "")) || 0)); return { ...current, [field]: next, ...(field === "intensityMax" ? { recoveryWeeks: next >= 8 ? 3 : next >= 6 ? 4 : 5 } : {}) }; })} style={{ minHeight: 40, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.text, paddingHorizontal: 12, fontSize: 12, fontWeight: "700" }} />
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <View style={{ height: 1, backgroundColor: colors.border }} />

            <View style={{ gap: 10 }}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setAdvancedOpen((current) => !current)}
                style={{
                  minHeight: 42,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Text
                  style={{
                    flex: 1,
                    color: colors.text,
                    fontSize: 13,
                    fontWeight: "800",
                  }}
                >
                  4. Avançados
                  <Text style={{ color: colors.muted, fontWeight: "500" }}>
                    {" "}
                    · competição, pausas e disponibilidade
                  </Text>
                </Text>
                <GoAtletaIcon
                  name={advancedOpen ? "chevronUp" : "chevronDown"}
                  size={17}
                  color={colors.muted}
                />
              </Pressable>
              {advancedOpen ? advancedContent : null}
            </View>
          </ManagerPane>

          <ManagerPane
            scrollable={wide}
            containerStyle={{
              width: wide ? "49%" : "100%",
              maxWidth: "100%",
              minWidth: 0,
              borderTopWidth: wide ? 0 : 1,
              borderTopColor: colors.border,
            }}
            contentStyle={{
              padding: compact ? 16 : 26,
              gap: 22,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
              Prévia do impacto
            </Text>
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                Curva anual ({draft.cycleLengthWeeks} semanas)
              </Text>
              <LoadPreview
                colors={colors}
                weekPlans={weekPlans}
                currentWeek={currentWeek}
                draft={draft}
              />
            </View>

            <View style={{ gap: 10 }}>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>
                O que mudará ao salvar
              </Text>
              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                <ImpactRow
                  colors={colors}
                  icon="calendar"
                  label="Agenda"
                  value={dirty ? "Parâmetros serão atualizados" : "Sem alteração"}
                />
                <ImpactRow
                  colors={colors}
                  icon="trend"
                  label="Carga"
                  value="Curva recalculada na prévia"
                />
                <ImpactRow
                  colors={colors}
                  icon="refresh"
                  label="Semanas automáticas"
                  value={`${autoPlanCount} disponíveis para regerar`}
                />
                <ImpactRow
                  colors={colors}
                  icon="students"
                  label="Planos personalizados"
                  value={`${manualPlanCount} preservados`}
                />
                <ImpactRow
                  colors={colors}
                  icon="checkmarkCircle"
                  label="Aulas concluídas"
                  value={`${completedLessonCount} não alteradas`}
                />
              </View>
            </View>

            <View
              style={{
                flexDirection: narrow ? "column" : "row",
                gap: 10,
              }}
            >
              <Pressable
                accessibilityRole="button"
                disabled={regenerating || !configured}
                onPress={onRegenerateAutomatic}
                style={{
                  minHeight: 44,
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 10,
                  opacity: regenerating || !configured ? 0.55 : 1,
                }}
              >
                <GoAtletaIcon name="refresh" size={17} color={colors.text} />
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                  {regenerating ? "Regerando..." : "Regerar automáticos"}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={onDuplicate}
                style={{
                  minHeight: 44,
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  borderRadius: 10,
                }}
              >
                <GoAtletaIcon name="copy" size={17} color={colors.muted} />
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                  Duplicar em nova turma
                </Text>
              </Pressable>
            </View>

            <View
              style={{
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.successBorder,
                backgroundColor: colors.successBg,
                padding: 12,
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 9,
              }}
            >
              <GoAtletaIcon
                name="shield"
                size={18}
                color={colors.successText}
              />
              <Text
                style={{
                  flex: 1,
                  color: colors.successText,
                  fontSize: 11,
                  lineHeight: 16,
                }}
              >
                Salvar altera a configuração base. Regerar e redefinir atuam
                somente nas semanas automáticas; edições manuais são preservadas.
              </Text>
            </View>
          </ManagerPane>
        </ManagerBody>

        <View
          style={{
            minHeight: compact ? 74 : 82,
            flexDirection: narrow ? "column" : "row",
            alignItems: narrow ? "stretch" : "center",
            gap: 12,
            paddingHorizontal: compact ? 16 : 26,
            paddingVertical: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <GoAtletaIcon
              name={error ? "warningCircle" : dirty ? "info" : "checkmarkCircle"}
              size={18}
              color={
                error
                  ? colors.dangerText
                  : dirty
                    ? colors.warningText
                    : colors.successText
              }
            />
            <Text
              numberOfLines={2}
              style={{
                flex: 1,
                color: error
                  ? colors.dangerText
                  : dirty
                    ? colors.warningText
                    : colors.muted,
                fontSize: 11,
              }}
            >
              {error ||
                (dirty ? "Alterações não salvas" : "Configuração sincronizada")}
            </Text>
          </View>
          <Pressable
            disabled={!dirty || saving}
            onPress={() => { setDraft(savedDraft); setCycleDateInput(formatBrazilianDate(savedDraft.cycleStartDate)); }}
            style={{
              minHeight: 42,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 10,
              paddingHorizontal: 16,
              opacity: !dirty || saving ? 0.5 : 1,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
              Descartar rascunho
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!dirty || saving}
            onPress={() => void handleSave()}
            style={{
              minHeight: 46,
              minWidth: compact ? undefined : 190,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 11,
              backgroundColor: colors.primaryBg,
              paddingHorizontal: 20,
              opacity: !dirty || saving ? 0.55 : 1,
            }}
          >
            <Text
              style={{
                color: colors.primaryText,
                fontSize: 12,
                fontWeight: "800",
              }}
            >
              {saving ? "Salvando..." : "Salvar e aplicar"}
            </Text>
          </Pressable>
        </View>
      </View>
    </ModalSheet>
  );
}
