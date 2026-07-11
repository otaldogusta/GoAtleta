import { Animated, ScrollView, Text, TextInput, View } from "react-native";

import type { ClassGroup } from "../../core/models";
import { type VolumeLevel, volumeOrder } from "../../core/periodization-basics";
import { type ThemeColors } from "../../ui/app-theme";
import { Pressable } from "../../ui/Pressable";
import { getSectionCardStyle } from "../../ui/section-styles";
import { CyclePlanTable, type CyclePlanTableProps, type WeekPlan } from "./CyclePlanTable";
import { GoAtletaIcon } from "../../ui/icon-registry";

// ── Local helpers ─────────────────────────────────────────────────────────────

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

// ── Types ─────────────────────────────────────────────────────────────────────

type SectionOpenState = {
  load: boolean;
  guides: boolean;
  cycle: boolean;
  week: boolean;
};

export type CycleTabProps = {
  // theme
  colors: ThemeColors;

  // CyclePlanTable props (forwarded verbatim)
  cyclePanelCellWidth: number;
  cyclePanelCellGap: number;
  cyclePanelLabelWidth: number;
  cyclePanelRowHeight: number;
  cyclePanelRowGap: number;
  cyclePanelScrollRef: CyclePlanTableProps["cyclePanelScrollRef"];
  isEditingCycleTitle: boolean;
  cycleTitleDraft: string;
  setCycleTitleDraft: (value: string) => void;
  saveCycleTitleEditor: () => void;
  cancelCycleTitleEditor: () => void;
  openCycleTitleEditor: () => void;
  cyclePanelTitle: string;
  hasWeekPlans: boolean;
  weekPlans: WeekPlan[];
  currentWeek: number;
  selectedWeekNumber: number;
  monthWeekNumbers: number[];
  monthSegments: Array<{ label: string; length: number }>;
  macroSegments: Array<{ label: string; length: number }>;
  mesoSegments: Array<{ label: string; length: number }>;
  dominantBlockSegments: Array<{ label: string; length: number }>;
  weeklySessions: number;
  periodizationModel: CyclePlanTableProps["periodizationModel"];
  sportProfile: CyclePlanTableProps["sportProfile"];
  onSelectedWeekChange: (week: number) => void;
  openWeekEditor: (week: number) => void;

  // Carga semanal section
  sectionOpen: SectionOpenState;
  toggleSection: (key: "load" | "guides" | "cycle" | "week") => void;
  showLoadContent: boolean;
  loadAnimStyle: any;
  progressBars: number[];
  acwrLimits: { high: string; low: string };
  setAcwrLimits: (v: { high: string; low: string }) => void;
  acwrLimitError: string;
  acwrMessage: string;
  volumeToPSE: Record<VolumeLevel, string>;
  sessionsPerWeek: number;

  // Guias section
  showGuideContent: boolean;
  guideAnimStyle: any;
  summary: string[];

  // Ciclo section
  showCycleContent: boolean;
  cycleAnimStyle: any;
  cycleFilter: "all" | "manual" | "auto";
  setCycleFilter: (value: "all" | "manual" | "auto") => void;
  selectedClass: ClassGroup | null;
  filteredWeekPlans: WeekPlan[];
};

// ── Component ─────────────────────────────────────────────────────────────────

export function CycleTab({
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
  currentWeek,
  selectedWeekNumber,
  monthWeekNumbers,
  monthSegments,
  macroSegments,
  mesoSegments,
  dominantBlockSegments,
  weeklySessions,
  periodizationModel,
  sportProfile,
  onSelectedWeekChange,
  openWeekEditor,
  sectionOpen,
  toggleSection,
  showLoadContent,
  loadAnimStyle,
  progressBars,
  acwrLimits,
  setAcwrLimits,
  acwrLimitError,
  acwrMessage,
  volumeToPSE,
  sessionsPerWeek,
  showGuideContent,
  guideAnimStyle,
  summary,
  showCycleContent,
  cycleAnimStyle,
  cycleFilter,
  setCycleFilter,
  selectedClass,
  filteredWeekPlans,
}: CycleTabProps) {
  return (
    <>

      <CyclePlanTable
        colors={colors}
        cyclePanelCellWidth={cyclePanelCellWidth}
        cyclePanelCellGap={cyclePanelCellGap}
        cyclePanelLabelWidth={cyclePanelLabelWidth}
        cyclePanelRowHeight={cyclePanelRowHeight}
        cyclePanelRowGap={cyclePanelRowGap}
        cyclePanelScrollRef={cyclePanelScrollRef}
        isEditingCycleTitle={isEditingCycleTitle}
        cycleTitleDraft={cycleTitleDraft}
        setCycleTitleDraft={setCycleTitleDraft}
        saveCycleTitleEditor={saveCycleTitleEditor}
        cancelCycleTitleEditor={cancelCycleTitleEditor}
        openCycleTitleEditor={openCycleTitleEditor}
        cyclePanelTitle={cyclePanelTitle}
        hasWeekPlans={hasWeekPlans}
        weekPlans={weekPlans}
        currentWeek={currentWeek}
        selectedWeekNumber={selectedWeekNumber}
        monthWeekNumbers={monthWeekNumbers}
        monthSegments={monthSegments}
        macroSegments={macroSegments}
        mesoSegments={mesoSegments}
        dominantBlockSegments={dominantBlockSegments}
        weeklySessions={weeklySessions}
        periodizationModel={periodizationModel}
        sportProfile={sportProfile}
        onSelectedWeekChange={onSelectedWeekChange}
        openWeekEditor={openWeekEditor}
      />

      {!hasWeekPlans ? (
        <View style={getSectionCardStyle(colors, "neutral")}>
          <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
            {normalizeText("Nenhum ciclo salvo para esta turma.")}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {normalizeText("Use a visão geral para gerar um novo ciclo.")}
          </Text>
        </View>
      ) : (
        <>

        <View
          style={[
            getSectionCardStyle(colors, "primary"),
            { borderLeftWidth: 1, borderLeftColor: colors.border },
          ]}
        >

        <Pressable

          onPress={() => toggleSection("load")}

          style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}

        >

          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>

            {normalizeText("Carga semanal")}

          </Text>

          <GoAtletaIcon

            name={sectionOpen.load ? "chevronUp" : "chevronDown"}

            size={18}

            color={colors.muted}

          />

        </Pressable>

        <Text style={{ color: colors.muted, fontSize: 12 }}>

          {normalizeText("Distribuição de intensidade ao longo do ciclo")}

        </Text>

        { showLoadContent ? (

          <Animated.View style={[{ gap: 12 }, loadAnimStyle]}>

            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator
              style={{ width: "100%", maxWidth: "100%" }}
              contentContainerStyle={{
                minWidth: "100%",
                flexDirection: "row",
                alignItems: "flex-end",
                gap: 8,
                paddingRight: 8,
                paddingBottom: 4,
              }}
            >

          {progressBars.map((ratio, index) => {

            const level = weekPlans[index]?.volume ?? "médio";

            const isActive = index + 1 === selectedWeekNumber;

            const palette = getVolumePalette(level, colors);

            return (

              <View key={String(index)} style={{ alignItems: "center", gap: 6 }}>

                <View

                  style={{

                    width: 22,

                    height: 120 * ratio + 16,

                    borderRadius: 10,

                    backgroundColor: palette.bg,

                    opacity: isActive ? 1 : 0.55,

                  }}

                />

                <Text style={{ color: colors.muted, fontSize: 11 }}>

                  S{index + 1}

                </Text>

              </View>

            );

            })}

        </ScrollView>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>

          {volumeOrder.map((level) => {

            const palette = getVolumePalette(level, colors);

            return (

              <View

                key={level}

                style={{

                  paddingVertical: 3,

                  paddingHorizontal: 8,

                  borderRadius: 999,

                  backgroundColor: palette.bg,

                }}

              >

                <Text style={{ color: palette.text, fontSize: 11 }}>

                  {normalizeText(`${level} - ${volumeToPSE[level]}`)}

                </Text>

              </View>

              );

            })}

        </View>

        <View
          style={{
            gap: 10,
            padding: 12,
            borderRadius: 14,
            backgroundColor: colors.secondaryBg,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}>
              Faixa segura de carga
            </Text>
            <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.inputBg }}>
              <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700" }}>Configuração avançada</Text>
            </View>
          </View>
          <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 16 }}>
            Compara a carga recente com a carga habitual da turma. A referência recomendada fica entre 0,8 e 1,3.
          </Text>

          <View style={{ flexDirection: "row", gap: 12 }}>

            <View style={{ flex: 1, gap: 6 }}>

              <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>

                Alerta acima de

              </Text>

              <TextInput

                value={acwrLimits.high}

                onChangeText={(value) =>
                  setAcwrLimits({ ...acwrLimits, high: value.replace(",", ".") })
                }

                keyboardType="numeric"

                placeholder="1.3"

                placeholderTextColor={colors.placeholder}

                style={{

                  borderWidth: 1,

                  borderColor: colors.border,

                  padding: 10,

                  borderRadius: 10,

                  backgroundColor: colors.inputBg,

                  color: colors.inputText,

                }}

              />

            </View>

            <View style={{ flex: 1, gap: 6 }}>

              <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>

                Alerta abaixo de

              </Text>

              <TextInput

                value={acwrLimits.low}

                onChangeText={(value) =>
                  setAcwrLimits({ ...acwrLimits, low: value.replace(",", ".") })
                }

                keyboardType="numeric"

                placeholder="0.8"

                placeholderTextColor={colors.placeholder}

                style={{

                  borderWidth: 1,

                  borderColor: colors.border,

                  padding: 10,

                  borderRadius: 10,

                  backgroundColor: colors.inputBg,

                  color: colors.inputText,

                }}

              />

            </View>

          </View>

          <Text style={{ color: colors.muted, fontSize: 10 }}>
            Os valores são salvos automaticamente para esta turma.
          </Text>

          { acwrLimitError ? (

            <Text style={{ color: colors.dangerText, fontSize: 12 }}>

              {acwrLimitError}

            </Text>

          ) : null}

          { !acwrLimitError && acwrMessage ? (

            <Text style={{ color: colors.muted, fontSize: 12 }}>

              {acwrMessage}

            </Text>

          ) : null}

        </View>

          </Animated.View>

        ) : null}

        </View>


        </>
      )}

    </>
  );
}
