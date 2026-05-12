import { Ionicons } from "@expo/vector-icons";
import { RefObject, useCallback, useEffect, useMemo, useRef } from "react";
import {
    NativeScrollEvent,
    NativeSyntheticEvent,
    Platform,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";

import {
    getDemandIndexForModel,
    getLoadLabelForModel,
    type PeriodizationModel,
    type SportProfile,
    type VolumeLevel,
} from "../../core/periodization-basics";
import { formatPlannedLoad } from "../../core/periodization-load";
import type { VisibleMonthWeekSlot } from "./month-segments";
import { Pressable } from "../../ui/Pressable";
import { type ThemeColors } from "../../ui/app-theme";
import { getSectionCardStyle } from "../../ui/section-styles";

// ── Local helpers (mirror of parent-file helpers) ───────────────────────────

const normalizeText = (value: string): string => {
  if (!value) return value;
  let current = String(value);
  for (let i = 0; i < 2; i += 1) {
    current = current.replace(/\\\\u/gi, "\\u").replace(/\\\\U/gi, "\\U");
  }
  for (let i = 0; i < 3; i += 1) {
    const decoded = decodeUnicodeEscapes(tryJsonDecode(current));
    if (decoded === current) break;
    current = decoded;
  }
  if (/\\u[0-9a-fA-F]{4}/.test(current) || /\\U[0-9a-fA-F]{8}/.test(current)) {
    current = decodeUnicodeEscapes(current);
  }
  if (!/[\uFFFD?]/.test(current)) return current;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      current = decodeURIComponent(escape(current));
    } catch {
      break;
    }
    if (!/[\uFFFD?]/.test(current)) return current;
  }
  return current;
};

const tryJsonDecode = (value: string): string => {
  try {
    const parsed = JSON.parse(`"${value}"`);
    return typeof parsed === "string" ? parsed : value;
  } catch {
    return value;
  }
};

const decodeUnicodeEscapes = (value: string): string =>
  value.replace(/\\u([0-9a-fA-F]{4})/gi, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );

const getVolumePalette = (level: VolumeLevel, colors: ThemeColors) => {
  if (level === "baixo") {
    return { bg: colors.successBg, text: colors.successText, border: colors.successBg };
  }
  if (level === "médio") {
    return { bg: colors.warningBg, text: colors.warningText, border: colors.warningBg };
  }
  return { bg: colors.dangerBg, text: colors.dangerText, border: colors.dangerBorder };
};

// ── Types ────────────────────────────────────────────────────────────────────

export type WeekPlan = {
  classId?: string;
  startDate?: string;
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
  generationContextSnapshotJson?: string;
};

type Segment = { label: string; length: number };

// ── Props ────────────────────────────────────────────────────────────────────

export type CyclePlanTableProps = {
  colors: ThemeColors;

  // layout constants
  cyclePanelCellWidth: number;
  cyclePanelCellGap: number;
  cyclePanelLabelWidth: number;
  cyclePanelRowHeight: number;
  cyclePanelRowGap: number;

  // scroll ref (so parent can still call scrollTo on it)
  cyclePanelScrollRef: RefObject<ScrollView | null>;

  // title editor
  isEditingCycleTitle: boolean;
  cycleTitleDraft: string;
  setCycleTitleDraft: (value: string) => void;
  saveCycleTitleEditor: () => void;
  cancelCycleTitleEditor: () => void;
  openCycleTitleEditor: () => void;
  cyclePanelTitle: string;

  // data
  hasWeekPlans: boolean;
  weekPlans: WeekPlan[];
  visibleWeekSlots: VisibleMonthWeekSlot[];
  currentWeek: number;
  selectedWeekNumber: number;
  selectedWeekSlotKey?: string | null;
  monthSegments?: Segment[];
  monthWeekNumbers?: number[];
  macroSegments: Segment[];
  mesoSegments: Segment[];
  dominantBlockSegments: Segment[];

  // derived values
  weeklySessions: number;
  periodizationModel: PeriodizationModel;
  sportProfile: SportProfile;
  rawAgeBand?: string | null;

  // actions
  onSelectedWeekChange?: (week: number) => void;
  onSelectedWeekSlotChange?: (slotKey: string, week: number) => void;
  openWeekEditor: (
    week: number,
    options?: { displayWeekNumber?: number; visibleMonthKey?: string; slotKey?: string }
  ) => void;
};

// ── Component ────────────────────────────────────────────────────────────────

export function CyclePlanTable({
  colors,
  cyclePanelCellWidth,
  cyclePanelCellGap,
  cyclePanelLabelWidth,
  cyclePanelRowHeight,
  cyclePanelRowGap,
  cyclePanelScrollRef,
  isEditingCycleTitle,
  cycleTitleDraft,
  setCycleTitleDraft,
  saveCycleTitleEditor,
  cancelCycleTitleEditor,
  openCycleTitleEditor,
  cyclePanelTitle,
  hasWeekPlans,
  weekPlans,
  visibleWeekSlots,
  currentWeek,
  selectedWeekNumber,
  selectedWeekSlotKey,
  monthWeekNumbers: _monthWeekNumbers,
  macroSegments,
  mesoSegments,
  dominantBlockSegments,
  weeklySessions,
  periodizationModel,
  sportProfile,
  rawAgeBand,
  onSelectedWeekChange,
  onSelectedWeekSlotChange,
  openWeekEditor,
}: CyclePlanTableProps) {
  const snapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAppliedScrollXRef = useRef<number | null>(null);
  const isFirstScrollSyncRef = useRef(true);
  const cycleSnapInterval = useMemo(
    () => cyclePanelCellWidth + cyclePanelCellGap,
    [cyclePanelCellGap, cyclePanelCellWidth]
  );
  const displayWeeks = useMemo(
    () =>
      visibleWeekSlots
        .map((slot) => {
          const week = weekPlans.find((item) => item.week === slot.sourceWeekNumber);
          if (!week) return null;
          return { ...slot, week };
        })
        .filter(
          (
            item
          ): item is VisibleMonthWeekSlot & {
            week: WeekPlan;
          } => Boolean(item)
        ),
    [visibleWeekSlots, weekPlans]
  );
  const primarySlotKeyBySourceWeek = useMemo(() => {
    const byWeek = new Map<number, string>();
    displayWeeks.forEach((slot) => {
      if (!byWeek.has(slot.sourceWeekNumber)) {
        byWeek.set(slot.sourceWeekNumber, slot.key);
      }
    });
    return byWeek;
  }, [displayWeeks]);
  const resolveSegmentLabelForSourceWeek = useCallback(
    (segments: Segment[], sourceWeekNumber: number) => {
      const sourceIndex = weekPlans.findIndex((item) => item.week === sourceWeekNumber);
      if (sourceIndex < 0) return "";
      let cursor = 0;
      for (const segment of segments) {
        cursor += segment.length;
        if (sourceIndex < cursor) return segment.label;
      }
      return segments[segments.length - 1]?.label ?? "";
    },
    [weekPlans]
  );
  const buildDisplaySegments = useCallback(
    (segments: Segment[]) => {
      const result: Segment[] = [];
      displayWeeks.forEach((slot) => {
        const label = resolveSegmentLabelForSourceWeek(segments, slot.sourceWeekNumber);
        const last = result[result.length - 1];
        if (last?.label === label) {
          last.length += 1;
        } else {
          result.push({ label, length: 1 });
        }
      });
      return result;
    },
    [displayWeeks, resolveSegmentLabelForSourceWeek]
  );
  const displayMonthSegments = useMemo(() => {
    const result: Segment[] = [];
    displayWeeks.forEach((slot) => {
      const last = result[result.length - 1];
      if (last?.label === slot.monthLabel) {
        last.length += 1;
      } else {
        result.push({ label: slot.monthLabel, length: 1 });
      }
    });
    return result;
  }, [displayWeeks]);
  const displayMacroSegments = useMemo(() => buildDisplaySegments(macroSegments), [buildDisplaySegments, macroSegments]);
  const displayMesoSegments = useMemo(() => buildDisplaySegments(mesoSegments), [buildDisplaySegments, mesoSegments]);
  const displayDominantSegments = useMemo(
    () => buildDisplaySegments(dominantBlockSegments),
    [buildDisplaySegments, dominantBlockSegments]
  );

  const clearScheduledSnap = useCallback(() => {
    if (!snapTimeoutRef.current) return;
    clearTimeout(snapTimeoutRef.current);
    snapTimeoutRef.current = null;
  }, []);

  const snapToNearestWeek = useCallback(
    (offsetX: number, animated: boolean) => {
      if (!hasWeekPlans || !displayWeeks.length) return;

      const snappedIndex = Math.round(offsetX / cycleSnapInterval);
      const clampedIndex = Math.max(0, Math.min(snappedIndex, displayWeeks.length - 1));
      const nextOffsetX = clampedIndex * cycleSnapInterval;
      const nextSlot = displayWeeks[clampedIndex];
      const nextWeekNumber = nextSlot?.sourceWeekNumber ?? clampedIndex + 1;

      onSelectedWeekChange?.(nextWeekNumber);
      if (nextSlot) {
        onSelectedWeekSlotChange?.(nextSlot.key, nextWeekNumber);
      }

      if (Math.abs(nextOffsetX - offsetX) < 1) {
        lastAppliedScrollXRef.current = nextOffsetX;
        return;
      }
      lastAppliedScrollXRef.current = nextOffsetX;
      cyclePanelScrollRef.current?.scrollTo({ x: nextOffsetX, animated });
    },
    [
      cyclePanelScrollRef,
      cycleSnapInterval,
      displayWeeks,
      displayWeeks.length,
      hasWeekPlans,
      onSelectedWeekChange,
      onSelectedWeekSlotChange,
    ]
  );

  const handleCycleSnapEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      clearScheduledSnap();
      snapToNearestWeek(event.nativeEvent.contentOffset.x, false);
    },
    [clearScheduledSnap, snapToNearestWeek]
  );

  const handleCycleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (Platform.OS !== "web") return;
      clearScheduledSnap();

      const offsetX = event.nativeEvent.contentOffset.x;
      snapTimeoutRef.current = setTimeout(() => {
        snapTimeoutRef.current = null;
        snapToNearestWeek(offsetX, true);
      }, 96);
    },
    [clearScheduledSnap, snapToNearestWeek]
  );

  useEffect(() => {
    if (!hasWeekPlans || !displayWeeks.length) return;

    const targetIndex =
      selectedWeekSlotKey != null
        ? displayWeeks.findIndex((slot) => slot.key === selectedWeekSlotKey)
        : displayWeeks.findIndex((slot) => slot.sourceWeekNumber === (selectedWeekNumber || currentWeek));
    const clampedIndex = Math.max(0, targetIndex >= 0 ? targetIndex : 0);
    const scrollToX = Math.max(
      0,
      clampedIndex * (cyclePanelCellWidth + cyclePanelCellGap)
    );

    if (Math.abs((lastAppliedScrollXRef.current ?? -999999) - scrollToX) < 1) {
      return;
    }

    const timer = setTimeout(() => {
      lastAppliedScrollXRef.current = scrollToX;
      const shouldAnimate = !isFirstScrollSyncRef.current;
      cyclePanelScrollRef.current?.scrollTo({ x: scrollToX, animated: shouldAnimate });
      isFirstScrollSyncRef.current = false;
    }, 0);

    return () => clearTimeout(timer);
  }, [
    cyclePanelCellGap,
    cyclePanelCellWidth,
    cyclePanelScrollRef,
    displayWeeks,
    hasWeekPlans,
    currentWeek,
    selectedWeekNumber,
    selectedWeekSlotKey,
  ]);

  useEffect(() => {
    return () => {
      clearScheduledSnap();
    };
  }, [clearScheduledSnap]);

  return (
    <View
      style={[
        getSectionCardStyle(colors, "primary"),
        { borderLeftWidth: 1, borderLeftColor: colors.border, gap: 10 },
      ]}
    >
      <View>
        {isEditingCycleTitle ? (
          <View style={{ gap: 8 }}>
            <TextInput
              value={cycleTitleDraft}
              onChangeText={setCycleTitleDraft}
              placeholder={normalizeText("Digite o título do macrociclo")}
              placeholderTextColor={colors.muted}
              onSubmitEditing={saveCycleTitleEditor}
              autoFocus
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.inputBg,
                borderRadius: 10,
                color: colors.text,
                fontSize: 14,
                fontWeight: "700",
                paddingHorizontal: 10,
                paddingVertical: 8,
              }}
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={saveCycleTitleEditor}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 8,
                  backgroundColor: colors.primaryBg,
                }}
              >
                <Text style={{ color: colors.primaryText, fontSize: 12, fontWeight: "700" }}>
                  Salvar
                </Text>
              </Pressable>
              <Pressable
                onPress={cancelCycleTitleEditor}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.secondaryBg,
                }}
              >
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>
                  Cancelar
                </Text>
              </Pressable>
            </View>
          </View>
        ) : hasWeekPlans ? (
          <Pressable
            onPress={openCycleTitleEditor}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" }}
          >
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
              {normalizeText(cyclePanelTitle)}
            </Text>
            <Ionicons name="create-outline" size={14} color={colors.muted} />
          </Pressable>
        ) : (
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
            {normalizeText(cyclePanelTitle)}
          </Text>
        )}
      </View>

      {hasWeekPlans ? (
        <View style={{ flexDirection: "row" }}>
          {/* ── Coluna de labels fixada ── */}
          <View style={{ gap: cyclePanelRowGap, marginRight: 8 }}>
            {(["Mês", "Semana", "Frequência", "Período", "Mesociclo", "Bloco dominante", "Carga planejada", "Índice de demanda", "PSE alvo", "Carga interna"] as const).map((label) => (
              <View
                key={label}
                style={{
                  width: cyclePanelLabelWidth,
                  height: cyclePanelRowHeight,
                  justifyContent: "center",
                  paddingHorizontal: 10,
                  borderRadius: 8,
                  backgroundColor: colors.secondaryBg,
                }}
              >
                <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
                  {normalizeText(label)}
                </Text>
              </View>
            ))}
          </View>

          {/* ── Conteúdo scrollável ── */}
          <ScrollView
            ref={cyclePanelScrollRef}
            horizontal
            decelerationRate="fast"
            disableIntervalMomentum={Platform.OS !== "web"}
            snapToAlignment={Platform.OS !== "web" ? "start" : undefined}
            snapToInterval={Platform.OS !== "web" ? cycleSnapInterval : undefined}
            onScroll={handleCycleScroll}
            onMomentumScrollEnd={handleCycleSnapEnd}
            onScrollEndDrag={handleCycleSnapEnd}
            scrollEventThrottle={16}
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1 }}
          >
            <View style={{ gap: cyclePanelRowGap, paddingBottom: 2 }}>

              {/* Linha de meses */}
              <View style={{ flexDirection: "row", gap: cyclePanelCellGap }}>
                {displayMonthSegments.map((seg, idx) => (
                  <View
                    key={`month-${idx}`}
                    style={{
                      width: seg.length * cyclePanelCellWidth + Math.max(0, seg.length - 1) * cyclePanelCellGap,
                      height: cyclePanelRowHeight,
                      borderRadius: 8,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: colors.inputBg,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
                      {seg.label}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Linha de semanas */}
              <View style={{ flexDirection: "row", gap: cyclePanelCellGap }}>
                {displayWeeks.map((slot) => {
                  const isActive =
                    selectedWeekSlotKey != null
                      ? slot.key === selectedWeekSlotKey
                      : slot.sourceWeekNumber === selectedWeekNumber &&
                        primarySlotKeyBySourceWeek.get(slot.sourceWeekNumber) === slot.key;
                  const isCurrent = slot.sourceWeekNumber === currentWeek;
                  const isPast = slot.sourceWeekNumber < currentWeek;
                  return (
                    <Pressable
                      key={`head-${slot.key}`}
                      onPress={() => {
                        onSelectedWeekChange?.(slot.sourceWeekNumber);
                        onSelectedWeekSlotChange?.(slot.key, slot.sourceWeekNumber);
                        openWeekEditor(slot.sourceWeekNumber, {
                          displayWeekNumber: slot.monthWeekNumber,
                          visibleMonthKey: slot.monthKey,
                          slotKey: slot.key,
                        });
                      }}
                      style={{
                        width: cyclePanelCellWidth,
                        height: cyclePanelRowHeight,
                        borderRadius: 8,
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 3,
                        backgroundColor: isActive ? colors.inputBg : colors.secondaryBg,
                        borderWidth: 1,
                        borderColor: isActive ? colors.text : colors.border,
                        opacity: isPast ? 0.45 : 1,
                      }}
                    >
                      <Text style={{ color: colors.text, fontSize: 11, fontWeight: isActive ? "700" : "400" }}>
                        {`${slot.monthWeekNumber}`}
                      </Text>
                      {isCurrent ? (
                        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.text }} />
                      ) : (
                        <View style={{ width: 4, height: 4 }} />
                      )}
                    </Pressable>
                  );
                })}
              </View>

              {/* Frequência semanal */}
              <View style={{ flexDirection: "row", gap: cyclePanelCellGap }}>
                <View
                  style={{
                    width:
                      displayWeeks.length * cyclePanelCellWidth +
                      Math.max(0, displayWeeks.length - 1) * cyclePanelCellGap,
                    height: cyclePanelRowHeight,
                    borderRadius: 8,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.inputBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 10, fontWeight: "700" }}>
                    {`${weeklySessions} ${weeklySessions === 1 ? "sessão" : "sessões"}/semana`}
                  </Text>
                </View>
              </View>

              {/* Macrociclo */}
              <View style={{ flexDirection: "row", gap: cyclePanelCellGap }}>
                  {displayMacroSegments.map((seg, idx) => {
                    const bgColors = [colors.inputBg, colors.secondaryBg, colors.card];
                    return (
                      <View
                        key={`macro-${idx}`}
                        style={{
                          width: seg.length * cyclePanelCellWidth + Math.max(0, seg.length - 1) * cyclePanelCellGap,
                          height: cyclePanelRowHeight,
                          borderRadius: 8,
                          alignItems: "center",
                          justifyContent: "center",
                          paddingHorizontal: 6,
                          backgroundColor: bgColors[idx % bgColors.length],
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 10, fontWeight: "700" }}>
                          {seg.label}
                        </Text>
                      </View>
                    );
                  })}
              </View>

              {/* Mesociclos */}
              <View style={{ flexDirection: "row", gap: cyclePanelCellGap }}>
                {displayMesoSegments.map((seg, idx) => (
                  <View
                    key={`meso-${idx}`}
                    style={{
                      width: seg.length * cyclePanelCellWidth + Math.max(0, seg.length - 1) * cyclePanelCellGap,
                      height: cyclePanelRowHeight,
                      borderRadius: 8,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: idx % 2 === 0 ? colors.secondaryBg : colors.card,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 10, fontWeight: "700" }}>
                      {normalizeText(seg.label)}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Bloco dominante */}
              <View style={{ flexDirection: "row", gap: cyclePanelCellGap }}>
                {displayDominantSegments.map((seg, idx) => {
                  const bgColors = [colors.secondaryBg, colors.card, colors.inputBg, colors.card, colors.secondaryBg];
                  return (
                    <View
                      key={`dominant-${idx}`}
                      style={{
                        width: seg.length * cyclePanelCellWidth + Math.max(0, seg.length - 1) * cyclePanelCellGap,
                        height: cyclePanelRowHeight,
                        borderRadius: 8,
                        alignItems: "center",
                        justifyContent: "center",
                        paddingHorizontal: 6,
                        backgroundColor: bgColors[idx % bgColors.length],
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text numberOfLines={1} style={{ color: colors.text, fontSize: 10, fontWeight: "700" }}>
                        {seg.label}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {/* Carga */}
              <View style={{ flexDirection: "row", gap: cyclePanelCellGap }}>
                {displayWeeks.map((item) => {
                  const week = item.week;
                  const palette = getVolumePalette(week.volume, colors);
                  const isPast = item.sourceWeekNumber < currentWeek;
                  return (
                    <View
                      key={`load-${item.key}`}
                      style={{
                        width: cyclePanelCellWidth,
                        height: cyclePanelRowHeight,
                        borderRadius: 8,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: palette.bg,
                        opacity: isPast ? 0.45 : 1,
                      }}
                    >
                      <Text style={{ color: palette.text, fontSize: 10, fontWeight: "700" }}>
                        {getLoadLabelForModel(week.volume, periodizationModel)}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {/* Índice */}
              <View style={{ flexDirection: "row", gap: cyclePanelCellGap }}>
                {displayWeeks.map((item) => {
                  const week = item.week;
                  const isPast = item.sourceWeekNumber < currentWeek;
                  const intensity = getDemandIndexForModel(
                    week.volume,
                    periodizationModel,
                    weeklySessions,
                    sportProfile,
                    rawAgeBand
                  );
                  return (
                    <View
                      key={`idx-${item.key}`}
                      style={{
                        width: cyclePanelCellWidth,
                        height: cyclePanelRowHeight,
                        borderRadius: 8,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: colors.card,
                        borderWidth: 1,
                        borderColor: colors.border,
                        opacity: isPast ? 0.45 : 1,
                      }}
                    >
                      <Text style={{ color: colors.text, fontSize: 10, fontWeight: "700" }}>
                        {`${intensity}/10`}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {/* Meta PSE */}
              <View style={{ flexDirection: "row", gap: cyclePanelCellGap }}>
                {displayWeeks.map((item) => {
                  const week = item.week;
                  const isPast = item.sourceWeekNumber < currentWeek;
                  return (
                    <View
                      key={`pse-${item.key}`}
                      style={{
                        width: cyclePanelCellWidth,
                        height: cyclePanelRowHeight,
                        borderRadius: 8,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: colors.card,
                        borderWidth: 1,
                        borderColor: colors.border,
                        opacity: isPast ? 0.45 : 1,
                      }}
                    >
                      <Text style={{ color: colors.text, fontSize: 10, fontWeight: "600" }}>
                        {normalizeText(week.PSETarget)}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {/* Carga interna */}
              <View style={{ flexDirection: "row", gap: cyclePanelCellGap }}>
                {displayWeeks.map((item) => {
                  const week = item.week;
                  const isPast = item.sourceWeekNumber < currentWeek;
                  return (
                    <View
                      key={`internal-load-${item.key}`}
                      style={{
                        width: cyclePanelCellWidth,
                        height: cyclePanelRowHeight,
                        borderRadius: 8,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: colors.card,
                        borderWidth: 1,
                        borderColor: colors.border,
                        opacity: isPast ? 0.45 : 1,
                      }}
                    >
                      <Text style={{ color: colors.text, fontSize: 9, fontWeight: "700" }}>
                        {formatPlannedLoad(week.plannedWeeklyLoad)}
                      </Text>
                    </View>
                  );
                })}
              </View>

            </View>
          </ScrollView>
        </View>
      ) : (
        <View
          style={{
            padding: 12,
            borderRadius: 12,
            backgroundColor: colors.inputBg,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {normalizeText("Gere o ciclo para visualizar o painel semanal.")}
          </Text>
        </View>
      )}
    </View>
  );
}
