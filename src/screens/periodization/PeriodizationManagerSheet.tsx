import { useMemo, useState, type ReactNode } from "react";
import {
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, { Line, Path } from "react-native-svg";

import type { VolumeLevel } from "../../core/periodization-basics";
import type { ThemeColors } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { ModalSheet } from "../../ui/ModalSheet";
import { Pressable } from "../../ui/Pressable";

export type PeriodizationManagerDraft = {
  goal: string;
  mvLevel: string;
  daysOfWeek: number[];
  startTime: string;
  durationMinutes: number;
  cycleStartDate: string;
  cycleLengthWeeks: number;
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

const CYCLE_OPTIONS = [40, 44, 48, 52] as const;

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
    [...(first.daysOfWeek ?? [])].sort().join(",") ===
      [...(second.daysOfWeek ?? [])].sort().join(",")
  );
}

function loadRatio(volume: VolumeLevel) {
  if (volume === "alto") return 0.82;
  if (volume === "baixo") return 0.32;
  return 0.58;
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
}: {
  colors: ThemeColors;
  weekPlans: GraphWeek[];
  currentWeek: number;
}) {
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
  const maxWeek = Math.max(1, source.at(-1)?.week ?? 52);
  const maxLoad = Math.max(
    1,
    ...source.map((item) => item.plannedSessionLoad || 1),
  );
  const xForWeek = (week: number) =>
    plotLeft + ((week - 1) / Math.max(1, maxWeek - 1)) * (plotRight - plotLeft);
  const points = source.map((item, index) => {
    const base = loadRatio(item.volume);
    const intensity = Math.min(
      0.94,
      Math.max(0.16, (item.plannedSessionLoad || maxLoad * base) / maxLoad),
    );
    const technique = Math.min(
      0.9,
      0.38 + index / Math.max(1, source.length - 1) * 0.4 + base * 0.12,
    );
    const recovery =
      item.volume === "baixo" ? 0.84 : Math.max(0.2, 0.74 - intensity * 0.52);
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
      <Svg width={width} height={height}>
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
  const [draft, setDraft] = useState(initialDraft);
  const [savedDraft, setSavedDraft] = useState(initialDraft);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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

        <ScrollView
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          contentContainerStyle={{
            flexDirection: wide ? "row" : "column",
            alignItems: "stretch",
          }}
          style={{ flex: 1, minHeight: 0 }}
        >
          <View
            style={{
              width: wide ? "51%" : "100%",
              padding: compact ? 16 : 26,
              gap: 22,
              borderRightWidth: wide ? 1 : 0,
              borderRightColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
              Parâmetros do ciclo
            </Text>

            <View style={{ gap: 12 }}>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}>
                1. Turma
              </Text>
              <View style={{ flexDirection: compact ? "column" : "row", gap: 10 }}>
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
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {LEVEL_OPTIONS.map((option) => {
                      const active = draft.mvLevel === option.value;
                      return (
                        <Pressable
                          key={option.value}
                          onPress={() =>
                            setDraft((current) => ({
                              ...current,
                              mvLevel: option.value,
                            }))
                          }
                          style={{
                            minHeight: 34,
                            justifyContent: "center",
                            borderRadius: 9,
                            borderWidth: 1,
                            borderColor: active
                              ? colors.successBorder
                              : colors.border,
                            backgroundColor: active
                              ? colors.successBg
                              : colors.inputBg,
                            paddingHorizontal: 10,
                          }}
                        >
                          <Text
                            style={{
                              color: active ? colors.successText : colors.text,
                              fontSize: 10,
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
              <View style={{ flexDirection: compact ? "column" : "row", gap: 10 }}>
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
              <View style={{ flexDirection: compact ? "column" : "row", gap: 10 }}>
                <View style={{ flex: 1, gap: 6 }}>
                  <InputLabel colors={colors}>Data de início</InputLabel>
                  <TextInput
                    accessibilityLabel="Data de início do ciclo"
                    value={draft.cycleStartDate}
                    onChangeText={(cycleStartDate) =>
                      setDraft((current) => ({
                        ...current,
                        cycleStartDate,
                      }))
                    }
                    placeholder="AAAA-MM-DD"
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
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {CYCLE_OPTIONS.map((weeks) => {
                      const active = draft.cycleLengthWeeks === weeks;
                      return (
                        <Pressable
                          key={weeks}
                          onPress={() =>
                            setDraft((current) => ({
                              ...current,
                              cycleLengthWeeks: weeks,
                            }))
                          }
                          style={{
                            minHeight: 36,
                            justifyContent: "center",
                            borderRadius: 9,
                            borderWidth: 1,
                            borderColor: active
                              ? colors.successBorder
                              : colors.border,
                            backgroundColor: active
                              ? colors.successBg
                              : colors.inputBg,
                            paddingHorizontal: 10,
                          }}
                        >
                          <Text
                            style={{
                              color: active ? colors.successText : colors.text,
                              fontSize: 10,
                              fontWeight: "700",
                            }}
                          >
                            {weeks} semanas
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
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
              <View style={{ flexDirection: compact ? "column" : "row", gap: 10 }}>
                {[
                  ["Modelo aplicado", "Ondulatório"],
                  ["Recuperação planejada", "A cada 4 semanas"],
                  ["Faixa de intensidade", "PSE 3–6"],
                ].map(([label, value]) => (
                  <View key={label} style={{ flex: 1, gap: 6 }}>
                    <InputLabel colors={colors}>{label}</InputLabel>
                    <FieldShell colors={colors}>
                      <Text
                        style={{
                          color: colors.text,
                          fontSize: 11,
                          fontWeight: "700",
                        }}
                      >
                        {value}
                      </Text>
                    </FieldShell>
                  </View>
                ))}
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
          </View>

          <View
            style={{
              width: wide ? "49%" : "100%",
              padding: compact ? 16 : 26,
              gap: 22,
              borderTopWidth: wide ? 0 : 1,
              borderTopColor: colors.border,
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
                flexDirection: compact ? "column" : "row",
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
          </View>
        </ScrollView>

        <View
          style={{
            minHeight: compact ? 74 : 82,
            flexDirection: compact ? "column" : "row",
            alignItems: compact ? "stretch" : "center",
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
            onPress={() => setDraft(savedDraft)}
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
